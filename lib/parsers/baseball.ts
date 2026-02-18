// Baseball/Softball PDF parser - extracts batting and pitching stats from Sidearm Sports PDFs
import type { RosterPlayer } from '@/lib/roster/extractor';
import { normalizeJersey, looseNameMatch, exactNameMatch } from '@/lib/utils/player-matching';

/**
 * Merged player stats (batting + pitching combined per player)
 */
export interface PlayerStats {
    number: string;
    name: string;

    // Batting stats (empty string if not available)
    ab: string;
    r: string;
    h: string;
    doubles: string;
    triples: string;
    hr: string;
    rbi: string;
    bb: string;
    hbp: string;
    so: string;
    gdp: string;
    sf: string;
    sh: string;
    sb: string;
    cs: string;

    // Pitching stats (empty string if not available)
    w: string;
    l: string;
    g: string;
    gs: string;
    cg: string;
    sho: string;
    sv: string;
    ip: string;
    h_pitch: string;
    r_pitch: string;
    er: string;
    bb_pitch: string;
    so_pitch: string;
    hr_pitch: string;
    hbp_pitch: string;
}

export interface BattingRaw {
    number: string;
    name: string;
    ab: number;
    r: number;
    h: number;
    doubles: number;
    triples: number;
    hr: number;
    rbi: number;
    bb: number;
    hbp: number;
    so: number;
    gdp: number;
    sf: number;
    sh: number;
    sb: number;
    att: number;
}

export interface PitchingRaw {
    number: string;
    name: string;
    w: number;
    l: number;
    app: number;
    gs: number;
    cg: number;
    sho: string;
    sv: number;
    ip: string;
    h: number;
    r: number;
    er: number;
    bb: number;
    so: number;
    hr: number;
    hbp: number;
}

/**
 * Parse PDF text into batting and pitching stat arrays.
 *
 * Section headers identify batting vs pitching:
 * - "Sorted by Batting Avg" → batting section
 * - "Sorted by Earned Run Avg" → pitching section
 */
export function parsePdfStats(text: string): { batting: BattingRaw[]; pitching: PitchingRaw[] } {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const batting: BattingRaw[] = [];
    const pitching: PitchingRaw[] = [];

    let inBatting = false;
    let inPitching = false;

    for (const line of lines) {
        if (line.includes('Sorted by Batting Avg')) {
            inBatting = true;
            inPitching = false;
            continue;
        }
        if (line.includes('Sorted by Earned Run Avg')) {
            inBatting = false;
            inPitching = true;
            continue;
        }
        if (line.includes('Sorted by Fielding')) {
            inBatting = false;
            inPitching = false;
            continue;
        }

        // Skip headers and summary rows
        if (line.startsWith('#') && line.includes('Player')) continue;
        if (line.startsWith('Totals') || line.startsWith('Opponents')) continue;
        if (line.startsWith('LOB:') || line.startsWith('PB:')) continue;

        const match = line.match(/^(\d+)\s+(.+)/);
        if (!match) continue;

        const number = match[1];
        const rest = match[2];

        if (inBatting) {
            const stats = parseBattingLine(number, rest);
            if (stats) batting.push(stats);
        } else if (inPitching) {
            const stats = parsePitchingLine(number, rest);
            if (stats) pitching.push(stats);
        }
    }

    return { batting, pitching };
}

/**
 * Parse a batting line.
 * Format: Name .AVG GP-GS AB R H 2B 3B HR RBI TB SLG% BB HBP SO GDP OB% SF SH SB-ATT ...
 */
function parseBattingLine(number: string, line: string): BattingRaw | null {
    const nameMatch = line.match(/^(.+?)\s+(\.\d+|\d\.\d+)\s+/);
    if (!nameMatch) return null;

    const name = nameMatch[1].trim();
    const avg = nameMatch[2];
    const avgIndex = line.indexOf(avg);
    const statsStr = line.substring(avgIndex).trim();
    const parts = statsStr.split(/\s+/);

    // AVG GP-GS AB R H 2B 3B HR RBI TB SLG% BB HBP SO GDP OB% SF SH SB-ATT ...
    //  0    1    2  3 4  5  6  7   8   9   10  11  12 13  14  15  16 17  18
    if (parts.length < 19) return null;

    const sbAtt = parts[18] || '0-0';
    const [sbStr, attStr] = sbAtt.split('-');
    const sb = parseInt(sbStr) || 0;
    const att = parseInt(attStr) || 0;

    return {
        number,
        name,
        ab: parseInt(parts[2]) || 0,
        r: parseInt(parts[3]) || 0,
        h: parseInt(parts[4]) || 0,
        doubles: parseInt(parts[5]) || 0,
        triples: parseInt(parts[6]) || 0,
        hr: parseInt(parts[7]) || 0,
        rbi: parseInt(parts[8]) || 0,
        bb: parseInt(parts[11]) || 0,
        hbp: parseInt(parts[12]) || 0,
        so: parseInt(parts[13]) || 0,
        gdp: parseInt(parts[14]) || 0,
        sf: parseInt(parts[16]) || 0,
        sh: parseInt(parts[17]) || 0,
        sb,
        att,
    };
}

/**
 * Parse a pitching line.
 * Format: Name ERA W-L APP GS CG SHO SV IP H R ER BB SO 2B 3B HR B/AVG WP HP ...
 */
function parsePitchingLine(number: string, line: string): PitchingRaw | null {
    const nameMatch = line.match(/^(.+?)\s+(\d+\.\d+)\s+/);
    if (!nameMatch) return null;

    const name = nameMatch[1].trim();
    const era = nameMatch[2];
    const eraIndex = line.indexOf(era);
    const statsStr = line.substring(eraIndex).trim();
    const parts = statsStr.split(/\s+/);

    // ERA W-L APP GS CG SHO SV IP H R ER BB SO 2B 3B HR B/AVG WP HP ...
    //  0   1   2   3  4  5   6  7  8 9 10 11 12 13 14 15   16  17 18
    if (parts.length < 13) return null;

    const wl = parts[1] || '0-0';
    const [wStr, lStr] = wl.split('-');

    return {
        number,
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
        hr: parseInt(parts[15]) || 0,
        hbp: parseInt(parts[18]) || 0,
    };
}

/**
 * Merge roster with parsed batting and pitching stats.
 *
 * Matching strategy (shared with all sports):
 * - Primary: Jersey number + first OR last name match
 * - Fallback: Exact first AND last name match (handles jersey changes)
 */
export function mergeBaseballStats(
    roster: RosterPlayer[],
    batting: BattingRaw[],
    pitching: PitchingRaw[]
): PlayerStats[] {
    return roster.map(player => {
        const name = `${player.firstName} ${player.lastName}`;
        const playerJersey = normalizeJersey(player.number);

        // Primary: jersey + any name match
        let bat = batting.find(b =>
            normalizeJersey(b.number) === playerJersey &&
            looseNameMatch(player.firstName, player.lastName, b.name)
        );
        let pitch = pitching.find(p =>
            normalizeJersey(p.number) === playerJersey &&
            looseNameMatch(player.firstName, player.lastName, p.name)
        );

        // Fallback: exact name match with different jersey (handles jersey changes)
        if (!bat) {
            bat = batting.find(b =>
                normalizeJersey(b.number) !== playerJersey &&
                exactNameMatch(player.firstName, player.lastName, b.name)
            );
        }
        if (!pitch) {
            pitch = pitching.find(p =>
                normalizeJersey(p.number) !== playerJersey &&
                exactNameMatch(player.firstName, player.lastName, p.name)
            );
        }

        return {
            number: player.number,
            name,
            ab: bat ? String(bat.ab) : '',
            r: bat ? String(bat.r) : '',
            h: bat ? String(bat.h) : '',
            doubles: bat ? String(bat.doubles) : '',
            triples: bat ? String(bat.triples) : '',
            hr: bat ? String(bat.hr) : '',
            rbi: bat ? String(bat.rbi) : '',
            bb: bat ? String(bat.bb) : '',
            hbp: bat ? String(bat.hbp) : '',
            so: bat ? String(bat.so) : '',
            gdp: bat ? String(bat.gdp) : '',
            sf: bat ? String(bat.sf) : '',
            sh: bat ? String(bat.sh) : '',
            sb: bat ? String(bat.sb) : '',
            cs: bat ? String(bat.att - bat.sb) : '',
            w: pitch ? String(pitch.w) : '',
            l: pitch ? String(pitch.l) : '',
            g: pitch ? String(pitch.app) : '',
            gs: pitch ? String(pitch.gs) : '',
            cg: pitch ? String(pitch.cg) : '',
            sho: pitch ? String(pitch.sho) : '',
            sv: pitch ? String(pitch.sv) : '',
            ip: pitch ? pitch.ip : '',
            h_pitch: pitch ? String(pitch.h) : '',
            r_pitch: pitch ? String(pitch.r) : '',
            er: pitch ? String(pitch.er) : '',
            bb_pitch: pitch ? String(pitch.bb) : '',
            so_pitch: pitch ? String(pitch.so) : '',
            hr_pitch: pitch ? String(pitch.hr) : '',
            hbp_pitch: pitch ? String(pitch.hbp) : '',
        };
    });
}
