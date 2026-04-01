import 'server-only';

import { unstable_cache } from 'next/cache';
import type { SportType } from '@/types';
import type { ConfiguredSchoolOption } from './types';

type SheetPlatform = 'sidearm' | 'wmt' | 'hybrid';

const DEFAULT_SHEET_NAME = 'Config';
const DEFAULT_REVALIDATE_SECONDS = 300;
const SUPPORTED_SPORTS = new Set<SportType>([
    'baseball',
    'softball',
    'mens-basketball',
    'womens-basketball',
    'mens-soccer',
    'womens-soccer',
    'womens-volleyball',
    'football',
]);
const SUPPORTED_PLATFORMS = new Set<SheetPlatform>(['sidearm', 'wmt', 'hybrid']);

interface RawSheetRow {
    enabled: string;
    school_id: string;
    school_name: string;
    sport: string;
    platform: string;
    roster_url: string;
    sidearm_url: string;
    wmt_url: string;
    hybrid_url: string;
}

function getSpreadsheetId(): string | null {
    const explicitId = process.env.GOOGLE_SHEETS_CONFIG_SPREADSHEET_ID?.trim();
    if (explicitId) {
        return explicitId;
    }

    const sheetUrl = process.env.GOOGLE_SHEETS_CONFIG_URL?.trim();
    if (!sheetUrl) {
        return null;
    }

    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match?.[1] ?? null;
}

function getSheetName(): string {
    return process.env.GOOGLE_SHEETS_CONFIG_SHEET_NAME?.trim() || DEFAULT_SHEET_NAME;
}

function getRevalidateSeconds(): number {
    const raw = process.env.GOOGLE_SHEETS_CONFIG_REVALIDATE_SECONDS;
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REVALIDATE_SECONDS;
}

function buildCsvUrl(spreadsheetId: string, sheetName: string): string {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentValue += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            currentRow.push(currentValue);
            currentValue = '';
            continue;
        }

        if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i += 1;
            }

            currentRow.push(currentValue);
            rows.push(currentRow);
            currentRow = [];
            currentValue = '';
            continue;
        }

        currentValue += char;
    }

    if (currentValue.length > 0 || currentRow.length > 0) {
        currentRow.push(currentValue);
        rows.push(currentRow);
    }

    return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

function normalizeHeader(header: string): string {
    return header.trim().toLowerCase();
}

function normalizeCell(cell: string): string {
    return cell.trim();
}

function isEnabled(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
}

function normalizeSport(value: string): SportType | null {
    const normalized = value.trim().toLowerCase() as SportType;
    return SUPPORTED_SPORTS.has(normalized) ? normalized : null;
}

function normalizePlatform(value: string): SheetPlatform | null {
    const normalized = value.trim().toLowerCase() as SheetPlatform;
    return SUPPORTED_PLATFORMS.has(normalized) ? normalized : null;
}

function parseRows(csvText: string): RawSheetRow[] {
    const rows = parseCsv(csvText);
    if (rows.length === 0) {
        return [];
    }

    const [headerRow, ...dataRows] = rows;
    const headers = headerRow.map(normalizeHeader);

    return dataRows.map((row) => {
        const values = row.map(normalizeCell);

        const getValue = (columnName: keyof RawSheetRow): string => {
            const index = headers.indexOf(columnName);
            return index >= 0 ? values[index] ?? '' : '';
        };

        return {
            enabled: getValue('enabled'),
            school_id: getValue('school_id'),
            school_name: getValue('school_name'),
            sport: getValue('sport'),
            platform: getValue('platform'),
            roster_url: getValue('roster_url'),
            sidearm_url: getValue('sidearm_url'),
            wmt_url: getValue('wmt_url'),
            hybrid_url: getValue('hybrid_url'),
        };
    });
}

function toConfiguredSchoolOption(row: RawSheetRow): ConfiguredSchoolOption | null {
    if (!isEnabled(row.enabled)) {
        return null;
    }

    const sport = normalizeSport(row.sport);
    const platform = normalizePlatform(row.platform);
    const schoolId = row.school_id.trim();
    const schoolName = row.school_name.trim();
    const rosterUrl = row.roster_url.trim();

    if (!sport || !platform || !schoolId || !schoolName || !rosterUrl) {
        return null;
    }

    const statsUrl = platform === 'sidearm'
        ? row.sidearm_url.trim()
        : platform === 'wmt'
            ? row.wmt_url.trim()
            : '';

    const helperUrl = platform === 'hybrid'
        ? row.hybrid_url.trim()
        : '';

    if ((platform === 'sidearm' || platform === 'wmt') && !statsUrl) {
        return null;
    }

    return {
        id: schoolId,
        name: schoolName,
        sport,
        platform,
        rosterUrl,
        statsUrl,
        helperUrl,
        source: 'sheet',
    };
}

const getCachedSheetOverrides = unstable_cache(
    async (): Promise<ConfiguredSchoolOption[]> => {
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) {
            return [];
        }

        const csvUrl = buildCsvUrl(spreadsheetId, getSheetName());
        const response = await fetch(csvUrl, {
            next: { revalidate: getRevalidateSeconds() },
        });

        if (!response.ok) {
            throw new Error(`Google Sheets config fetch failed: ${response.status} ${response.statusText}`);
        }

        const csvText = await response.text();
        return parseRows(csvText)
            .map(toConfiguredSchoolOption)
            .filter((school): school is ConfiguredSchoolOption => school !== null);
    },
    ['google-sheets-school-config'],
    { revalidate: DEFAULT_REVALIDATE_SECONDS }
);

export async function getGoogleSheetsSchoolOverrides(): Promise<ConfiguredSchoolOption[]> {
    try {
        return await getCachedSheetOverrides();
    } catch (error) {
        console.error('Failed to load Google Sheets school config:', error);
        return [];
    }
}
