/**
 * Georgia Tech stats text parser
 *
 * GT uses a unique stats PDF format (not Sidearm). Because the PDF's internal
 * text stream merges adjacent column values, standard JS PDF libraries
 * (pdf-parse / pdfjs-dist) cannot reliably extract structured data.
 *
 * Instead, users copy-paste text from the PDF (Ctrl+A → Ctrl+C). The pasted
 * text is whitespace-separated — each column value naturally separated by
 * spaces — making it trivial to parse with simple string splitting.
 *
 * This handles both GT baseball and GT softball (identical format).
 */
import type { RosterPlayer } from '@/lib/roster/extractor';
import type { PlayerStats } from '@/lib/parsers/baseball';

// ===== Data structures =====

interface GtechBattingRaw {
    name: string;
    ab: number; r: number; h: number;
    doubles: number; triples: number; hr: number;
    rbi: number; bb: number; hbp: number; so: number;
    gdp: number; sf: number; sh: number;
    sb: number; att: number;
}

interface GtechPitchingRaw {
    name: string;
    w: number; l: number; app: number; gs: number;
    cg: number; sho: string; sv: number; ip: string;
    h: number; r: number; er: number; bb: number;
    so: number; hr: number; hbp: number;
}


// ===== Line parsing =====

/**
 * Detect if a line is a player data row.
 * Player lines start with an uppercase LASTNAME followed by a comma and first name.
 * Skips header, totals, opponents, separator, and note lines.
 */
function isPlayerLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('---')) return false;
    if (trimmed.startsWith('PLAYER')) return false;
    if (trimmed.startsWith('Totals')) return false;
    if (trimmed.startsWith('Opponents')) return false;
    if (trimmed.startsWith('Others')) return false;
    if (trimmed.startsWith('LOB')) return false;
    if (trimmed.startsWith('PB')) return false;
    if (trimmed.startsWith('Georgia Tech')) return false;
    if (trimmed.startsWith('(As of')) return false;
    if (trimmed.startsWith('Overall')) return false;
    if (trimmed.startsWith('Record:')) return false;

    // Must contain a comma (LASTNAME, Firstname pattern)
    return /^[A-Z][A-Z]+,\s/.test(trimmed);
}

/**
 * Extract player name from a line.
 * GT PDF format: "LASTNAME, Firstname" followed by stats.
 * The name ends where the first stat value begins (a number or dot-number).
 */
function extractNameAndStats(line: string): { name: string; stats: string } | null {
    const trimmed = line.trim();

    // Match: "LASTNAME, Firstname" followed by whitespace then a stat value
    // Stats start with a number or .number (batting avg) or negative number
    const match = trimmed.match(/^([A-Z][A-Za-z'-]+,\s+[A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*)?)\s+([\d.\-].*)$/);
    if (match) {
        return { name: match[1].trim(), stats: match[2].trim() };
    }

    return null;
}

/**
 * Parse a GT batting line's stats portion.
 *
 * Column order (from header):
 * AVG GP-GS AB R H 2B 3B HR XB RBI TB SLG BB HP K GDP OB% SF SH SB-ATT PO A E FLD%
 *  0    1    2  3 4  5  6  7  8   9  10  11 12 13 14 15 16  17 18   19   20 21 22 23
 */
function parseGtechBattingStats(name: string, statsStr: string): GtechBattingRaw | null {
    const parts = statsStr.split(/\s+/);
    if (parts.length < 19) return null;

    // Find SB-ATT (contains a dash within, like "2-4" or "0-0")
    // It's at index 19 in the ideal case, but spacing can shift things
    let sbAttIdx = -1;
    for (let i = 18; i < parts.length; i++) {
        if (/^\d+-\d+$/.test(parts[i])) {
            sbAttIdx = i;
            break;
        }
    }

    // GP-GS is at index 1 (contains a dash like "6-6")
    // AVG is at index 0
    // Stats start at index 2 (AB)
    const ab = parseInt(parts[2]) || 0;
    const r = parseInt(parts[3]) || 0;
    const h = parseInt(parts[4]) || 0;
    const doubles = parseInt(parts[5]) || 0;
    const triples = parseInt(parts[6]) || 0;
    const hr = parseInt(parts[7]) || 0;
    // XB at index 8 — skip (derived stat)
    const rbi = parseInt(parts[9]) || 0;
    // TB at index 10 — skip (derived stat)
    // SLG at index 11 — skip
    const bb = parseInt(parts[12]) || 0;
    const hbp = parseInt(parts[13]) || 0;
    const so = parseInt(parts[14]) || 0;
    const gdp = parseInt(parts[15]) || 0;
    // OB% at index 16 — skip
    const sf = parseInt(parts[17]) || 0;
    const sh = parseInt(parts[18]) || 0;

    let sb = 0, att = 0;
    if (sbAttIdx >= 0) {
        const [sbStr, attStr] = parts[sbAttIdx].split('-');
        sb = parseInt(sbStr) || 0;
        att = parseInt(attStr) || 0;
    }

    return { name, ab, r, h, doubles, triples, hr, rbi, bb, hbp, so, gdp, sf, sh, sb, att };
}

/**
 * Parse a GT pitching line's stats portion.
 *
 * Column order (from header):
 * ERA W-L APP GS CG SHO SV IP H R ER BB K WHIP 2B 3B HR AVG WP HP BK SFA SHA
 *  0   1   2   3  4  5   6  7  8 9 10 11 12 13  14 15 16  17  18 19 20 21  22
 */
function parseGtechPitchingStats(name: string, statsStr: string): GtechPitchingRaw | null {
    const parts = statsStr.split(/\s+/);
    if (parts.length < 13) return null;

    // W-L at index 1 (contains a dash like "1-0")
    const wl = parts[1] || '0-0';
    const [wStr, lStr] = wl.split('-');

    // IP is at index 7 — keep as string (e.g., "39.1")
    // ERA is at index 0 — skip (derived stat)
    // WHIP is at index 13 — skip (derived stat)

    return {
        name,
        w: parseInt(wStr) || 0,
        l: parseInt(lStr) || 0,
        app: parseInt(parts[2]) || 0,
        gs: parseInt(parts[3]) || 0,
        cg: parseInt(parts[4]) || 0,
        sho: parts[5] || '0',
        sv: parseInt(parts[6]) || 0,
        ip: parts[7] || '0',
        h: parseInt(parts[8]) || 0,
        r: parseInt(parts[9]) || 0,
        er: parseInt(parts[10]) || 0,
        bb: parseInt(parts[11]) || 0,
        so: parseInt(parts[12]) || 0,
        // After WHIP (13): 2B(14) 3B(15) HR(16) AVG(17) WP(18) HP(19)
        hr: parseInt(parts[16]) || 0,
        hbp: parseInt(parts[19]) || 0,
    };
}

// ===== Section parsing =====

/**
 * Parse the full pdfToText output into batting and pitching arrays.
 *
 * Section detection:
 * - Batting header: line containing "PLAYER" and "AVG" and "GP-GS"
 * - Pitching header: line containing "PLAYER" and "ERA" and "W-L"
 * - Fielding header: line containing "PLAYER" and "FLD%" without AVG/ERA → end of parsing
 */
function parseGtechText(text: string): {
    batting: GtechBattingRaw[];
    pitching: GtechPitchingRaw[];
} {
    const lines = text.split(/\r?\n/);
    const batting: GtechBattingRaw[] = [];
    const pitching: GtechPitchingRaw[] = [];

    let section: 'none' | 'batting' | 'pitching' = 'none';

    for (const line of lines) {
        const trimmed = line.trim();

        // Detect section headers
        if (trimmed.includes('PLAYER') && trimmed.includes('AVG') && trimmed.includes('GP-GS')) {
            section = 'batting';
            continue;
        }
        if (trimmed.includes('PLAYER') && trimmed.includes('ERA') && trimmed.includes('W-L')) {
            section = 'pitching';
            continue;
        }
        // Fielding section or page break → stop current section
        if (trimmed.includes('PLAYER') && trimmed.includes('FLD%') && !trimmed.includes('AVG') && !trimmed.includes('ERA')) {
            section = 'none';
            continue;
        }
        // Page break (form feed) can also signal section end
        if (trimmed.startsWith('\f')) {
            section = 'none';
            continue;
        }

        if (section === 'none') continue;
        if (!isPlayerLine(line)) continue;

        const parsed = extractNameAndStats(line);
        if (!parsed) continue;

        if (section === 'batting') {
            const stats = parseGtechBattingStats(parsed.name, parsed.stats);
            if (stats) batting.push(stats);
        } else if (section === 'pitching') {
            const stats = parseGtechPitchingStats(parsed.name, parsed.stats);
            if (stats) pitching.push(stats);
        }
    }

    return { batting, pitching };
}

// ===== Name matching =====

function normalizeName(name: string): string {
    return name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+(jr|sr|ii|iii|iv)\.?$/i, '')
        .trim();
}

function findRosterMatch(pdfName: string, roster: RosterPlayer[]): RosterPlayer | undefined {
    const commaIdx = pdfName.indexOf(',');
    if (commaIdx < 0) return undefined;
    const pdfLast = normalizeName(pdfName.substring(0, commaIdx));
    const pdfFirst = normalizeName(pdfName.substring(commaIdx + 1));

    const lastNameMatches = roster.filter(p => normalizeName(p.lastName) === pdfLast);
    if (lastNameMatches.length === 0) return undefined;
    if (lastNameMatches.length === 1) return lastNameMatches[0];

    return lastNameMatches.find(p => normalizeName(p.firstName) === pdfFirst)
        || lastNameMatches.find(p =>
            normalizeName(p.firstName).startsWith(pdfFirst) ||
            pdfFirst.startsWith(normalizeName(p.firstName)))
        || lastNameMatches[0];
}

/**
 * Parse pasted GT stats text (batting + pitching) and merge with roster.
 * Works for both GT baseball and GT softball (same format).
 *
 * The `pastedStatsText` parameter should be the raw text the user gets
 * by opening the GT PDF in a browser and pressing Ctrl+A → Ctrl+C.
 */
export function mergeGtechStats(
    roster: RosterPlayer[],
    pastedStatsText: string
): PlayerStats[] {
    const { batting, pitching } = parseGtechText(pastedStatsText);

    return roster.map(player => {
        const fullName = `${player.firstName} ${player.lastName}`;
        const bat = batting.find(b => findRosterMatch(b.name, [player]) !== undefined);
        const pitch = pitching.find(p => findRosterMatch(p.name, [player]) !== undefined);

        return {
            number: player.number,
            name: fullName,
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
