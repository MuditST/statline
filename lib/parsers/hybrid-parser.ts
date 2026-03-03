/**
 * Universal hybrid stats parser for pasted PDF/page text.
 *
 * Dynamically reads the header line to build a column map, so it works with
 * any stat column order (sidearm, GT, etc.) and handles extra columns.
 *
 * Automatically detects and normalizes spaced-out decimals from PDF copy-paste
 * using column-count comparison and W-L anchor patterns.
 */
import type { RosterPlayer } from '@/lib/roster/extractor';
import type { BattingRaw, PitchingRaw, PlayerStats } from '@/lib/parsers/baseball';
import { normalizeJersey, looseNameMatch, exactNameMatch } from '@/lib/utils/player-matching';

// Maps any header label to a canonical name (case-insensitive).
// Handles GT ("K", "HP") vs sidearm ("so", "hp") differences.
const COLUMN_ALIASES: Record<string, string> = {
    'avg': 'avg', 'gp-gs': 'gp-gs',
    'ab': 'ab', 'r': 'r', 'h': 'h',
    '2b': '2b', '3b': '3b', 'hr': 'hr',
    'xb': '_skip', 'rbi': 'rbi', 'tb': '_skip',
    'slg%': '_skip', 'slg': '_skip', 'bb': 'bb',
    'hp': 'hbp', 'hbp': 'hbp',
    'so': 'so', 'k': 'so',
    'gdp': 'gdp', 'ob%': '_skip', 'obp': '_skip',
    'sf': 'sf', 'sh': 'sh', 'sb-att': 'sb-att',
    'po': '_skip', 'a': '_skip', 'e': '_skip', 'fld%': '_skip',
    'era': 'era', 'w-l': 'w-l',
    'app': 'app', 'gs': 'gs', 'cg': 'cg',
    'sho': 'sho', 'sv': 'sv', 'ip': 'ip', 'er': 'er',
    'whip': '_skip', 'b/avg': '_skip', 'avg_p': '_skip',
    'wp': '_skip', 'bk': '_skip', 'sfa': '_skip', 'sha': '_skip',
};

interface ColumnMap { [canonical: string]: number; }

/** Parse header line into column map. Skips first token ("Player"/"PLAYER"). */
function parseHeaderLine(headerLine: string): ColumnMap {
    const tokens = headerLine.trim().split(/\s+/).map(t => t.toLowerCase());
    const map: ColumnMap = {};
    for (let i = 1; i < tokens.length; i++) {
        const canonical = COLUMN_ALIASES[tokens[i]] || tokens[i];
        if (canonical !== '_skip') map[canonical] = i - 1;
    }
    return map;
}

/**
 * Collapse spaced-out decimals from PDF copy-paste.
 *
 * Step 1: ERA anchored to W-L — "4 . 1 1 1-0" → "4.11 1-0"
 *   (backtracking resolves ambiguity like "0 . 0 0 0-0" → "0.00 0-0")
 * Step 2: .ddd patterns — ". 4 5 7" → ".457"
 */
function normalizeSpacedNumbers(text: string): string {
    return text.split('\n').map(line => {
        line = line.replace(/(\d+)\s+\.\s+(\d)\s+(\d)\s+(\d+-\d+)/g, '$1.$2$3 $4');
        line = line.replace(/\.\s+(\d)\s+(\d)\s+(\d)/g, '.$1$2$3');
        return line;
    }).join('\n');
}

/** Column-count heuristic: if player lines have way more tokens than header, normalization is needed. */
function detectNormalizationNeeded(headerTokenCount: number, playerLines: string[]): boolean {
    if (playerLines.length === 0) return false;
    const avgTokens = playerLines.slice(0, 5)
        .map(l => l.trim().split(/\s+/).length)
        .reduce((a, b) => a + b, 0) / Math.min(playerLines.length, 5);
    return avgTokens > headerTokenCount + 4;
}

interface ParsedPlayerLine {
    jerseyNumber: string;
    name: string;
    statsTokens: string[];
}

/**
 * Parse a player data line. Handles two formats:
 *   Sidearm: "5 Name .457 10-10 35 ..." (jersey# first)
 *   GT:      "MCCOLLUM, Leighton .300 3-3 10 ..." (LASTNAME, first)
 */
function parsePlayerLine(line: string): ParsedPlayerLine | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('---')) return null;
    if (/^(player\s|#\s)/i.test(trimmed)) return null;
    if (/^(totals|opponents|others)\b/i.test(trimmed)) return null;
    if (/^(lob|pb|dp|ibb|picked|sba)/i.test(trimmed)) return null;
    if (/^(record:|overall|\(as of|\(all games)/i.test(trimmed)) return null;
    if (/^\d{4}\s+\w/i.test(trimmed) && /baseball|softball/i.test(trimmed)) return null;

    // Format 1: Jersey number first
    const jerseyMatch = trimmed.match(/^(\d+)\s+(.+)/);
    if (jerseyMatch) {
        const rest = jerseyMatch[2];
        const statsStart = rest.match(/^(.+?)\s+(\.\d{3}|\d+\.\d{2,3})\s/);
        if (statsStart) {
            return {
                jerseyNumber: jerseyMatch[1],
                name: statsStart[1].trim(),
                statsTokens: rest.substring(rest.indexOf(statsStart[2])).trim().split(/\s+/),
            };
        }
        return null;
    }

    // Format 2: LASTNAME, Firstname
    const gtMatch = trimmed.match(
        /^([A-Z][A-Za-z'-]+,\s+[A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*)?)\s+([\d.\-].*)$/
    );
    if (gtMatch) {
        return {
            jerseyNumber: '',
            name: gtMatch[1].trim(),
            statsTokens: gtMatch[2].trim().split(/\s+/),
        };
    }

    return null;
}

function extractBatting(parsed: ParsedPlayerLine, colMap: ColumnMap): BattingRaw {
    const t = parsed.statsTokens;
    const getInt = (col: string) => { const i = colMap[col]; return (i !== undefined && i < t.length) ? parseInt(t[i]) || 0 : 0; };
    const getStr = (col: string) => { const i = colMap[col]; return (i !== undefined && i < t.length) ? t[i] : ''; };
    const sbAtt = getStr('sb-att') || '0-0';
    const [sbStr, attStr] = sbAtt.split('-');
    return {
        number: parsed.jerseyNumber, name: parsed.name,
        ab: getInt('ab'), r: getInt('r'), h: getInt('h'),
        doubles: getInt('2b'), triples: getInt('3b'), hr: getInt('hr'),
        rbi: getInt('rbi'), bb: getInt('bb'), hbp: getInt('hbp'), so: getInt('so'),
        gdp: getInt('gdp'), sf: getInt('sf'), sh: getInt('sh'),
        sb: parseInt(sbStr) || 0, att: parseInt(attStr) || 0,
    };
}

function extractPitching(parsed: ParsedPlayerLine, colMap: ColumnMap): PitchingRaw {
    const t = parsed.statsTokens;
    const getInt = (col: string) => { const i = colMap[col]; return (i !== undefined && i < t.length) ? parseInt(t[i]) || 0 : 0; };
    const getStr = (col: string) => { const i = colMap[col]; return (i !== undefined && i < t.length) ? t[i] : ''; };
    const wl = getStr('w-l') || '0-0';
    const [wStr, lStr] = wl.split('-');
    return {
        number: parsed.jerseyNumber, name: parsed.name,
        w: parseInt(wStr) || 0, l: parseInt(lStr) || 0,
        app: getInt('app'), gs: getInt('gs'), cg: getInt('cg'),
        sho: getStr('sho') || '0', sv: getInt('sv'),
        ip: getStr('ip') || '0',
        h: getInt('h'), r: getInt('r'), er: getInt('er'),
        bb: getInt('bb'), so: getInt('so'), hr: getInt('hr'), hbp: getInt('hbp'),
    };
}

/**
 * Parse pasted stats text into batting and pitching arrays.
 *
 * 1. Finds section headers (case-insensitive)
 * 2. Parses header lines to build column maps
 * 3. Detects normalization need via column count
 * 4. Parses player lines using dynamic column maps
 */
export function parseHybridStats(text: string): {
    batting: BattingRaw[];
    pitching: PitchingRaw[];
} {
    const lines = text.split(/\r?\n/);
    let battingColMap: ColumnMap = {};
    let pitchingColMap: ColumnMap = {};
    let needsNormalization = false;

    // First pass: find headers and detect normalization need
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        const isBattingSection = /sorted by batting avg/i.test(line)
            || (line.includes('PLAYER') && line.includes('AVG') && line.includes('GP-GS'));
        const isPitchingSection = /sorted by earned run avg/i.test(line)
            || (line.includes('PLAYER') && line.includes('ERA') && line.includes('W-L'));

        if (!isBattingSection && !isPitchingSection) continue;

        // Find header line
        for (let j = i; j < Math.min(i + 5, lines.length); j++) {
            const headerLine = lines[j].trim();
            if (!headerLine || !/^(player|#)/i.test(headerLine)) continue;

            const colMap = parseHeaderLine(headerLine);
            const headerTokenCount = headerLine.split(/\s+/).length;

            if (isBattingSection) battingColMap = colMap;
            else pitchingColMap = colMap;

            // Sample player lines for normalization detection
            const sampleLines: string[] = [];
            for (let k = j + 1; k < Math.min(j + 6, lines.length); k++) {
                const pl = lines[k].trim();
                if (pl && !pl.startsWith('---') && !/^(totals|opponents)/i.test(pl) && pl.length > 10) {
                    sampleLines.push(pl);
                }
            }
            if (detectNormalizationNeeded(headerTokenCount, sampleLines)) {
                needsNormalization = true;
            }
            break;
        }

        // GT: header line IS the section line
        if (isBattingSection && /^player/i.test(line)) battingColMap = parseHeaderLine(line);
        if (isPitchingSection && /^player/i.test(line)) pitchingColMap = parseHeaderLine(line);
    }

    const processedText = needsNormalization ? normalizeSpacedNumbers(text) : text;
    const processedLines = processedText.split(/\r?\n/);
    const batting: BattingRaw[] = [];
    const pitching: PitchingRaw[] = [];
    let section: 'none' | 'batting' | 'pitching' = 'none';

    for (const line of processedLines) {
        const trimmed = line.trim();

        if (/sorted by batting avg/i.test(trimmed)
            || (trimmed.includes('PLAYER') && trimmed.includes('AVG') && trimmed.includes('GP-GS'))) {
            section = 'batting'; continue;
        }
        if (/sorted by earned run avg/i.test(trimmed)
            || (trimmed.includes('PLAYER') && trimmed.includes('ERA') && trimmed.includes('W-L'))) {
            section = 'pitching'; continue;
        }
        if (/sorted by fielding/i.test(trimmed)
            || (trimmed.includes('PLAYER') && trimmed.includes('FLD%') && !trimmed.includes('AVG') && !trimmed.includes('ERA'))) {
            section = 'none'; continue;
        }

        if (/^(player|#)/i.test(trimmed)) continue;
        if (section === 'none') continue;

        const parsed = parsePlayerLine(trimmed);
        if (!parsed) continue;

        if (section === 'batting' && Object.keys(battingColMap).length > 0) {
            batting.push(extractBatting(parsed, battingColMap));
        } else if (section === 'pitching' && Object.keys(pitchingColMap).length > 0) {
            pitching.push(extractPitching(parsed, pitchingColMap));
        }
    }

    return { batting, pitching };
}

/** Parse pasted stats and merge with roster data. */
export function mergeHybridStats(
    roster: RosterPlayer[],
    pastedStatsText: string
): PlayerStats[] {
    const { batting, pitching } = parseHybridStats(pastedStatsText);

    return roster.map(player => {
        const fullName = `${player.firstName} ${player.lastName}`;
        const playerJersey = normalizeJersey(player.number);

        // Match batting: jersey+name → exact name → GT name format
        let bat = batting.find(b =>
            b.number && normalizeJersey(b.number) === playerJersey &&
            looseNameMatch(player.firstName, player.lastName, b.name)
        ) ?? batting.find(b =>
            b.number && exactNameMatch(player.firstName, player.lastName, b.name)
        ) ?? batting.find(b => !b.number && matchGtName(b.name, player));

        // Match pitching (same strategy)
        let pitch = pitching.find(p =>
            p.number && normalizeJersey(p.number) === playerJersey &&
            looseNameMatch(player.firstName, player.lastName, p.name)
        ) ?? pitching.find(p =>
            p.number && exactNameMatch(player.firstName, player.lastName, p.name)
        ) ?? pitching.find(p => !p.number && matchGtName(p.name, player));

        return {
            number: player.number, name: fullName,
            ab: bat ? String(bat.ab) : '', r: bat ? String(bat.r) : '',
            h: bat ? String(bat.h) : '', doubles: bat ? String(bat.doubles) : '',
            triples: bat ? String(bat.triples) : '', hr: bat ? String(bat.hr) : '',
            rbi: bat ? String(bat.rbi) : '', bb: bat ? String(bat.bb) : '',
            hbp: bat ? String(bat.hbp) : '', so: bat ? String(bat.so) : '',
            gdp: bat ? String(bat.gdp) : '', sf: bat ? String(bat.sf) : '',
            sh: bat ? String(bat.sh) : '', sb: bat ? String(bat.sb) : '',
            cs: bat ? String(bat.att - bat.sb) : '',
            w: pitch ? String(pitch.w) : '', l: pitch ? String(pitch.l) : '',
            g: pitch ? String(pitch.app) : '', gs: pitch ? String(pitch.gs) : '',
            cg: pitch ? String(pitch.cg) : '', sho: pitch ? String(pitch.sho) : '',
            sv: pitch ? String(pitch.sv) : '', ip: pitch ? pitch.ip : '',
            h_pitch: pitch ? String(pitch.h) : '', r_pitch: pitch ? String(pitch.r) : '',
            er: pitch ? String(pitch.er) : '', bb_pitch: pitch ? String(pitch.bb) : '',
            so_pitch: pitch ? String(pitch.so) : '', hr_pitch: pitch ? String(pitch.hr) : '',
            hbp_pitch: pitch ? String(pitch.hbp) : '',
        };
    });
}

function normalizeName(name: string): string {
    return name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+(jr|sr|ii|iii|iv)\.?$/i, '')
        .trim();
}

/** Match GT "LASTNAME, Firstname" against roster player. */
function matchGtName(gtName: string, player: RosterPlayer): boolean {
    const commaIdx = gtName.indexOf(',');
    if (commaIdx < 0) return false;
    const gtLast = normalizeName(gtName.substring(0, commaIdx));
    const gtFirst = normalizeName(gtName.substring(commaIdx + 1));
    const rosterLast = normalizeName(player.lastName);
    const rosterFirst = normalizeName(player.firstName);
    if (gtLast !== rosterLast) return false;
    return gtFirst === rosterFirst || rosterFirst.startsWith(gtFirst) || gtFirst.startsWith(rosterFirst);
}

/** Validate pasted text for stats headers (case-insensitive, both sidearm and GT). */
export function validateHybridPastedStats(text: string): {
    valid: boolean;
    hasBatting: boolean;
    hasPitching: boolean;
    message: string;
} {
    const lines = text.split('\n');

    const hasBatting = lines.some(l => {
        const lower = l.toLowerCase();
        return (lower.includes('player') && lower.includes('avg') && lower.includes('ab'))
            || lower.includes('sorted by batting avg');
    });

    const hasPitching = lines.some(l => {
        const lower = l.toLowerCase();
        return (lower.includes('player') && lower.includes('era') && lower.includes('ip'))
            || lower.includes('sorted by earned run avg');
    });

    if (hasBatting && hasPitching) return { valid: true, hasBatting: true, hasPitching: true, message: 'Stats found' };
    if (hasBatting) return { valid: true, hasBatting: true, hasPitching: false, message: 'Batting found (pitching missing)' };
    if (hasPitching) return { valid: true, hasBatting: false, hasPitching: true, message: 'Pitching found (batting missing)' };
    return { valid: false, hasBatting: false, hasPitching: false, message: 'No stats headers found — make sure you copied the full page.' };
}
