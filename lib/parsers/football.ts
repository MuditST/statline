import { fetchAndParsePdf } from '@/lib/pdf/parser';

export interface FootballPassingStats {
    comp: number;
    att: number;
    int: number;
    yds: number;
    td: number;
    long: number;
    avgGame: number;
}

export interface FootballRushingStats {
    att: number;
    gain: number;
    loss: number;
    net: number;
    avg: number;
    td: number;
    long: number;
    avgGame: number;
}

export interface FootballReceivingStats {
    no: number;
    yds: number;
    avg: number;
    td: number;
    long: number;
    avgGame: number;
}

export interface FootballDefensiveStats {
    solo: number;
    asst: number;
    tot: number;
    tfl: string; // "8.0-24"
    sacks: string; // "2.0-12"
    int: string; // "1-23" or "1"
    pbu: number;
    qbh: number;
    ff: number;
    fr: string; // "1-0"
    blk: number;
    saf: number;
}

export interface FootballKickingStats {
    fgm: number;
    fga: number;
    pct: number;
    long: number;
    pat: string; // "20-21"
    pts: number;
}

export interface FootballPuntingStats {
    no: number;
    yds: number;
    avg: number;
    long: number;
    tb: number;
    fc: number;
    i20: number;
    plus50: number;
    blk: number;
}

export interface FootballPlayerRaw {
    jersey: string;
    name: string;
    passing?: FootballPassingStats;
    rushing?: FootballRushingStats;
    receiving?: FootballReceivingStats;
    defense?: FootballDefensiveStats;
    kicking?: FootballKickingStats;
    punting?: FootballPuntingStats;
    returns?: {
        krNo: number;
        krYds: number;
        krTd: number;
        krLong: number;
        prNo: number;
        prYds: number;
        prTd: number;
        prLong: number;
    };
}

// Standalone parser
export interface ParseResult<T> {
    players: T[];
    success: boolean;
    error?: string;
}

export class FootballParser {
    // Removed getSportName() as it was part of BaseParser

    public async parse(text: string): Promise<ParseResult<FootballPlayerRaw>> {
        const players = new Map<string, FootballPlayerRaw>();
        const lines = text.split('\n');

        // Track current section
        let currentSection: 'Rushing' | 'Passing' | 'Receiving' | 'PuntReturns' | 'KickReturns' | 'Interceptions' | 'Scoring' | 'TotalOffense' | 'FieldGoals' | 'Punting' | 'Kickoffs' | 'AllPurpose' | 'Defense' | null = null;

        // Helper to get or create player logic
        const getOrCreatePlayer = (jersey: string, name: string): FootballPlayerRaw => {
            // Key by jersey+name: same player appearing in multiple stat sections
            // (e.g. Rushing + Receiving) gets merged, while different players sharing
            // a jersey number (Offense vs Defense) stay separate.
            const key = `${jersey}-${name}`;
            if (!players.has(key)) {
                players.set(key, { jersey, name });
            }
            return players.get(key)!;
        };

        for (const line of lines) {
            let trimmed = line.trim();
            if (!trimmed) continue;

            // Check if a section header is embedded mid-line (data + "# Section" on the same line)
            // This happens when PDF text extraction concatenates adjacent columns.
            // e.g. "11 Gillon, Noah 4 71.03 17-39-2 43.59 % 175 0 34 43.75 # Kick Returns NO YRDS AVG TD LG"
            // We need to process the data part FIRST, then switch sections.
            const sectionHeaders = [
                '# Rushing', '# Passing', '# Receiving', '# Punt Returns',
                '# Kick Returns', '# Interceptions', '# Scoring',
                '# Field Goals', '# Punting', '# Defensive Leaders',
                '# Total Offense', '# All Purpose'
            ];

            let embeddedSection: string | null = null;
            for (const header of sectionHeaders) {
                const idx = trimmed.indexOf(header);
                if (idx > 0) {
                    // Section header is mid-line — split: process data before it
                    embeddedSection = header;
                    trimmed = trimmed.substring(0, idx).trim();
                    break;
                }
            }

            // Detect Section Headers (only when they start the line)
            if (trimmed.startsWith('# Rushing') || trimmed === 'Rushing') { currentSection = 'Rushing'; continue; }
            if (trimmed.startsWith('# Passing') || trimmed === 'Passing') { currentSection = 'Passing'; continue; }
            if (trimmed.startsWith('# Receiving') || trimmed === 'Receiving') { currentSection = 'Receiving'; continue; }
            if (trimmed.startsWith('# Punt Returns')) { currentSection = 'PuntReturns'; continue; }
            if (trimmed.startsWith('# Kick Returns')) { currentSection = 'KickReturns'; continue; }
            if (trimmed.startsWith('# Interceptions')) { currentSection = 'Interceptions'; continue; }
            if (trimmed.startsWith('# Scoring')) { currentSection = 'Scoring'; continue; }
            if (trimmed.startsWith('# Field Goals')) { currentSection = 'FieldGoals'; continue; }
            if (trimmed.startsWith('# Punting')) { currentSection = 'Punting'; continue; }
            if (trimmed.startsWith('# Defensive Leaders') || trimmed.includes('Tackles Sacks Pass Defense')) { currentSection = 'Defense'; continue; }

            // Skip headers that repeat or totals
            if (trimmed.startsWith('Total') || trimmed.startsWith('Opponents') || trimmed.startsWith('Team')) continue;
            if (trimmed.includes('GP ATT GAIN')) continue; // Header row residue

            try {
                if (currentSection === 'Rushing') {
                    // Match: jersey, name (greedy up to last alpha/punct before GP column), GP, ATT, GAIN, LOSS, NET, AVG, TD, LONG, AVG/G
                    const match = trimmed.match(/^(\d+)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(-?\d+)\s+(-?\d+\.?\d*)\s+(\d+)\s+(\d+)\s+(-?\d+\.?\d*)/);
                    if (match) {
                        const [_, jersey, name, gp, att, gain, loss, net, avg, td, long, avgg] = match;
                        const p = getOrCreatePlayer(jersey, name.trim());
                        p.rushing = {
                            att: parseInt(att),
                            gain: parseInt(gain),
                            loss: parseInt(loss),
                            net: parseInt(net),
                            avg: parseFloat(avg),
                            td: parseInt(td),
                            long: parseInt(long),
                            avgGame: parseFloat(avgg)
                        };
                    }
                } else if (currentSection === 'Passing') {
                    const match = trimmed.match(/^(\d+)\s+([A-Za-z\s.,'-]+?)\s+(\d+)\s+(\d+\.?\d*)\s+(\d+)-(\d+)-(\d+)\s/);
                    if (match) {
                        const [_, jersey, name, gp, rating, comp, att, int] = match;
                        // Remaining stats after CMP-ATT-INT: pct, yds, td, lg, avg/g
                        const rest = trimmed.substring(match[0].length);
                        const parts = rest.split(/\s+/).filter(s => s && s !== '%');
                        // parts: [64.86, 1296, 13, 70, 129.60] approx
                        if (parts.length >= 5) {
                            const p = getOrCreatePlayer(jersey, name.trim());
                            p.passing = {
                                comp: parseInt(comp),
                                att: parseInt(att),
                                int: parseInt(int),
                                yds: parseInt(parts[1]), // index 0 is pct
                                td: parseInt(parts[2]),
                                long: parseInt(parts[3]),
                                avgGame: parseFloat(parts[4])
                            };
                        }
                    }
                } else if (currentSection === 'Receiving') {
                    const match = trimmed.match(/^(\d+)\s+([A-Za-z\s.,'-]+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(-?\d+\.?\d*)\s+(\d+)\s+(\d+)\s+(-?\d+\.?\d*)/);
                    if (match) {
                        const [_, jersey, name, gp, no, yds, avg, td, long, avgg] = match;
                        const p = getOrCreatePlayer(jersey, name.trim());
                        p.receiving = {
                            no: parseInt(no),
                            yds: parseInt(yds),
                            avg: parseFloat(avg),
                            td: parseInt(td),
                            long: parseInt(long),
                            avgGame: parseFloat(avgg)
                        };
                    }
                } else if (currentSection === 'Defense') {
                    // This is hard to regex because of dashes and "—".
                    // Strategy: Extract Number + Name + GP, then split the rest.
                    const match = trimmed.match(/^(\d+)\s+([A-Za-z\s.,'-]+?)\s+(\d+)\s+/);
                    if (match) {
                        const [_, jersey, name, gp] = match;
                        const restOfLine = trimmed.substring(match[0].length).trim();
                        // Split by whitespace
                        const parts = restOfLine.split(/\s+/);
                        // Expected Columns after GP: Solo, Asst, Tot, TFL, Sacks, INT, BU, QBH, RCV, FF, KICK, SAF
                        // Count: 12 cols

                        if (parts.length >= 12) {
                            const p = getOrCreatePlayer(jersey, name.trim());
                            p.defense = {
                                solo: parseInt(parts[0]) || 0,
                                asst: parseInt(parts[1]) || 0,
                                tot: parseFloat(parts[2]) || 0,
                                tfl: parts[3],
                                sacks: parts[4],
                                int: parts[5],
                                pbu: parseInt(parts[6]) || 0,
                                qbh: parseInt(parts[7]) || 0,
                                fr: parts[8],
                                ff: parseInt(parts[9]) || 0,
                                blk: parseInt(parts[10]) || 0,
                                saf: parseInt(parts[11]) || 0
                            };
                        }
                    }
                } else if (currentSection === 'Punting') {
                    const match = trimmed.match(/^(\d+)\s+([A-Za-z\s.,'-]+?)\s+(\d+)\s+/);
                    if (match) {
                        const [_, jersey, name, no] = match;
                        // Format: # Name NO YDS AVG LNG TB FC 50+ I20 BLKD
                        const rest = trimmed.substring(match[0].length);
                        const parts = rest.split(/\s+/);
                        if (parts.length >= 8) {
                            const p = getOrCreatePlayer(jersey, name.trim());
                            p.punting = {
                                no: parseInt(match[3]), // The regex captured NO as group 3
                                yds: parseInt(parts[0]),
                                avg: parseFloat(parts[1]),
                                long: parseInt(parts[2]),
                                tb: parseInt(parts[3]),
                                fc: parseInt(parts[4]),
                                i20: parseInt(parts[5]),
                                plus50: parseInt(parts[6]),
                                blk: parseInt(parts[7])
                            };
                        }
                    }
                } else if (currentSection === 'FieldGoals') {
                    const match = trimmed.match(/^(\d+)\s+([A-Za-z\s.,'-]+?)\s+(\d+)-(\d+)\s+(\d+\.?\d*)\s+%/);
                    if (match) {
                        const [_, jersey, name, fgm, fga, pct] = match;

                        // Extract rest: i20 20-29 30-39 40-49 50+ LG BLK
                        const rest = trimmed.substring(match[0].length).trim();
                        const parts = rest.split(/\s+/);

                        // LG is second to last, BLK is last
                        // Usually 7 columns after PCT %: i20, 20-29, 30-39, 40-49, 50+, LG, BLK
                        if (parts.length >= 2) {
                            const p = getOrCreatePlayer(jersey, name.trim());
                            if (!p.kicking) p.kicking = { fgm: 0, fga: 0, pct: 0, long: 0, pat: '', pts: 0 };

                            p.kicking.fgm = parseInt(fgm);
                            p.kicking.fga = parseInt(fga);
                            p.kicking.pct = parseFloat(pct);
                            p.kicking.long = parseInt(parts[parts.length - 2]); // LG
                            // BLK is ignored in our interface but could be added
                        }
                    }
                } else if (currentSection === 'Scoring') {
                    // Match jersey, then name (until we hit digit or em-dash)
                    const match = trimmed.match(/^(\d+)\s+([A-Za-z\s.,'-]+?)\s+(?=\d|—)/);
                    if (match) {
                        const [_, jersey, name] = match;
                        const rest = trimmed.substring(match[0].length).trim();
                        const parts = rest.split(/\s+/);
                        // Cols: TD, FG, KICK(PAT), RUSH, RCV, PASS, DXP, SAF, PTS
                        // Count: 9 columns
                        if (parts.length >= 9) {
                            const p = getOrCreatePlayer(jersey, name.trim());
                            if (!p.kicking) p.kicking = { fgm: 0, fga: 0, pct: 0, long: 0, pat: '', pts: 0 };

                            const pat = parts[2]; // KICK column
                            const pts = parts[8]; // PTS column

                            p.kicking.pat = pat === '—' ? '' : pat;
                            p.kicking.pts = pts === '—' ? 0 : parseInt(pts);
                        }
                    }
                } else if (currentSection === 'PuntReturns') {
                    // Cols: NO YRDS AVG TD LG
                    // Match jersey, then name (until we hit a digit)
                    const match = trimmed.match(/^(\d+)\s+([A-Za-z\s.,'-]+?)\s+(?=\d)/);
                    if (match) {
                        const [_, jersey, name] = match;
                        const rest = trimmed.substring(match[0].length).trim();
                        const parts = rest.split(/\s+/);
                        if (parts.length >= 5) {
                            const p = getOrCreatePlayer(jersey, name.trim());
                            if (!p.returns) p.returns = { krNo: 0, krYds: 0, krTd: 0, krLong: 0, prNo: 0, prYds: 0, prTd: 0, prLong: 0 };

                            p.returns.prNo = parseInt(parts[0]);
                            p.returns.prYds = parseInt(parts[1]);
                            // avg skipped
                            p.returns.prTd = parseInt(parts[3]);
                            p.returns.prLong = parseInt(parts[4]);
                        }
                    }
                } else if (currentSection === 'KickReturns') {
                    // Cols: NO YRDS AVG TD LG
                    // Match jersey, then name (until we hit a digit)
                    const match = trimmed.match(/^(\d+)\s+([A-Za-z\s.,'-]+?)\s+(?=\d)/);
                    if (match) {
                        const [_, jersey, name] = match;
                        const rest = trimmed.substring(match[0].length).trim();
                        const parts = rest.split(/\s+/);
                        if (parts.length >= 5) {
                            const p = getOrCreatePlayer(jersey, name.trim());
                            if (!p.returns) p.returns = { krNo: 0, krYds: 0, krTd: 0, krLong: 0, prNo: 0, prYds: 0, prTd: 0, prLong: 0 };

                            p.returns.krNo = parseInt(parts[0]);
                            p.returns.krYds = parseInt(parts[1]);
                            // avg skipped
                            p.returns.krTd = parseInt(parts[3]);
                            p.returns.krLong = parseInt(parts[4]);
                        }
                    }
                }
            } catch (e) {
                // Ignore parse errors for single lines
            }

            // If we detected an embedded section header earlier, switch to that section now
            // (after processing the data portion of the line above)
            if (embeddedSection) {
                if (embeddedSection.includes('Rushing')) currentSection = 'Rushing';
                else if (embeddedSection.includes('Passing')) currentSection = 'Passing';
                else if (embeddedSection.includes('Receiving')) currentSection = 'Receiving';
                else if (embeddedSection.includes('Punt Returns')) currentSection = 'PuntReturns';
                else if (embeddedSection.includes('Kick Returns')) currentSection = 'KickReturns';
                else if (embeddedSection.includes('Interceptions')) currentSection = 'Interceptions';
                else if (embeddedSection.includes('Scoring')) currentSection = 'Scoring';
                else if (embeddedSection.includes('Field Goals')) currentSection = 'FieldGoals';
                else if (embeddedSection.includes('Punting')) currentSection = 'Punting';
                else if (embeddedSection.includes('Defensive')) currentSection = 'Defense';
            }
        }

        return {
            players: Array.from(players.values()),
            success: true
        };
    }
}

export async function parseFootballPdf(url: string) {
    const text = await fetchAndParsePdf(url);
    const parser = new FootballParser();
    return parser.parse(text);
}
