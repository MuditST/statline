/**
 * WMT Games API parser for schools using WMT Digital platform.
 * 
 * Fetches structured JSON from api.wmt.games instead of parsing PDFs.
 * Supports baseball, basketball, and volleyball.
 * 
 * API: https://api.wmt.games/api/statistics/teams/{teamId}/players?per_page=150
 */

import type { PlayerStats } from '@/lib/parsers/baseball';
import type { BasketballPlayerRaw } from '@/lib/parsers/basketball';
import type { VolleyballPlayerRaw } from '@/lib/parsers/volleyball';

// ---------------------------------------------------------------------------
// Team ID resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a WMT team_id from a user-provided URL.
 * 
 * Accepts:
 *  - Direct API URL: https://api.wmt.games/api/statistics/teams/609508/players
 *  - Stats page URL: https://odusports.com/sports/baseball/stats/season/2025
 *    (team_id scraped from page HTML)
 */
export async function resolveWmtTeamId(url: string): Promise<string> {
    // 1. Check if it's a direct API URL — extract team_id from path
    const apiMatch = url.match(/api\.wmt\.games.*teams\/(\d{5,7})/);
    if (apiMatch) {
        return apiMatch[1];
    }

    // 2. Otherwise scrape the stats page HTML
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch WMT stats page: ${response.status}`);
    }
    const html = await response.text();

    const patterns = [
        /wmt\.games\/[^/]+\/stats\/season\/(\d{5,7})/,
        /teams\/(\d{5,7})/,
        /[,"](\d{6,7})[",:]/,
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
            return match[1];
        }
    }

    throw new Error(
        'Could not find WMT team_id. Try pasting the direct API URL instead (e.g. https://api.wmt.games/api/statistics/teams/609508/players)'
    );
}

// ---------------------------------------------------------------------------
// Shared types & helpers
// ---------------------------------------------------------------------------

/** Raw player object from WMT API (same shape for all sports) */
interface WmtApiPlayer {
    id: number;
    team_id: number;
    first_name: string;
    last_name: string;
    jersey_no: string;
    position_code: string;
    class_short_descr: string;
    statistic: {
        data: {
            season: {
                gamesPlayed: number;
                columns: Array<{
                    period: number;
                    statistic: Record<string, number | string | null>;
                }>;
            } | [];
            career: {
                gamesPlayed: number;
                columns: Array<{
                    period: number;
                    statistic: Record<string, number | string | null>;
                }>;
            } | null;
        };
    };
}

interface WmtApiResponse {
    data: WmtApiPlayer[];
}

type Stats = Record<string, number | string | null> | undefined;

function num(stats: Stats, key: string): number {
    if (!stats) return 0;
    const v = stats[key];
    if (v === null || v === undefined) return 0;
    return typeof v === 'number' ? v : Number(v) || 0;
}

function str(stats: Stats, key: string): string {
    if (!stats) return '';
    const v = stats[key];
    if (v === null || v === undefined) return '';
    return String(v);
}

function pct(stats: Stats, key: string): string {
    if (!stats) return '.000';
    const v = stats[key];
    if (v === null || v === undefined) return '.000';
    const n = typeof v === 'number' ? v : Number(v);
    if (isNaN(n)) return '.000';
    // API returns percentage as whole number (e.g. 20 = 20%), convert to decimal string
    return (n / 100).toFixed(3).replace(/^0/, '');
}

/** Fetch raw WMT API data for a given team */
async function fetchWmtPlayers(teamId: string): Promise<WmtApiPlayer[]> {
    const url = `https://api.wmt.games/api/statistics/teams/${teamId}/players?per_page=150`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`WMT API error: ${response.status} ${response.statusText}`);
    }

    const json: WmtApiResponse = await response.json();
    return json.data;
}

/** Get season stats for a player, or undefined if none */
function getSeasonStats(player: WmtApiPlayer): Stats {
    const season = player.statistic?.data?.season;
    if (Array.isArray(season)) return undefined; // empty array = no stats
    return season?.columns?.[0]?.statistic;
}

/** Sort players by jersey number (00 -> 99). Players without names go to end. */
function sortByJersey<T extends { number: string; name?: string }>(players: T[]): T[] {
    return players.sort((a, b) => {
        // Players without names go to the very end
        const aHasName = !!(a as any).name?.trim();
        const bHasName = !!(b as any).name?.trim();
        if (aHasName !== bHasName) return aHasName ? -1 : 1;

        const numA = a.number === '00' ? -1 : parseInt(a.number) || 999;
        const numB = b.number === '00' ? -1 : parseInt(b.number) || 999;
        return numA - numB;
    });
}

// ---------------------------------------------------------------------------
// Baseball
// ---------------------------------------------------------------------------

function has(stats: Stats, key: string): boolean {
    if (!stats) return false;
    return stats[key] !== undefined && stats[key] !== null;
}

export async function parseWmtBaseballApi(teamId: string): Promise<PlayerStats[]> {
    const players = await fetchWmtPlayers(teamId);

    const result = players.map((player): PlayerStats => {
        const stats = getSeasonStats(player);
        const isBatter = has(stats, 'sAtBats');
        const isPitcher = has(stats, 'sInningsPitched');

        return {
            number: player.jersey_no || '',
            name: `${player.first_name} ${player.last_name}`,

            // Batting
            ab: isBatter ? String(num(stats, 'sAtBats')) : '',
            r: isBatter ? String(num(stats, 'sRuns')) : '',
            h: isBatter ? String(num(stats, 'sHits')) : '',
            doubles: isBatter ? String(num(stats, 'sDoubles')) : '',
            triples: isBatter ? String(num(stats, 'sTriples')) : '',
            hr: isBatter ? String(num(stats, 'sHomeRuns')) : '',
            rbi: isBatter ? String(num(stats, 'sRunsBattedIn')) : '',
            bb: isBatter ? String(num(stats, 'sWalks')) : '',
            hbp: isBatter ? String(num(stats, 'sHitByPitch')) : '',
            so: isBatter ? String(num(stats, 'sStrikeoutsHitting')) : '',
            gdp: isBatter ? String(num(stats, 'sGroundedIntoDoublePlay')) : '',
            sf: isBatter ? String(num(stats, 'sSacrificeFlies')) : '',
            sh: isBatter ? String(num(stats, 'sSacrificeHitsAllowed')) : '',
            sb: isBatter ? String(num(stats, 'sStolenBases')) : '',
            cs: isBatter ? String(num(stats, 'sCaughtStealingBy')) : '',

            // Pitching
            w: isPitcher ? String(num(stats, 'sIndWon')) : '',
            l: isPitcher ? String(num(stats, 'sIndLost')) : '',
            g: isPitcher ? String(num(stats, 'sPitchingAppearances')) : '',
            gs: isPitcher ? String(num(stats, 'sPitcherGamesStarted')) : '',
            cg: isPitcher ? String(num(stats, 'sCompleteGames')) : '',
            sho: isPitcher ? String(num(stats, 'sShutouts')) : '',
            sv: isPitcher ? String(num(stats, 'sSaves')) : '',
            ip: isPitcher ? str(stats, 'sInningsPitched') : '',
            h_pitch: isPitcher ? String(num(stats, 'sHitsAllowed')) : '',
            r_pitch: isPitcher ? String(num(stats, 'sRunsAllowed')) : '',
            er: isPitcher ? String(num(stats, 'sEarnedRuns')) : '',
            bb_pitch: isPitcher ? String(num(stats, 'sBasesOnBallsAllowed')) : '',
            so_pitch: isPitcher ? String(num(stats, 'sStrikeouts')) : '',
            hr_pitch: isPitcher ? String(num(stats, 'sHomeRunsAllowed')) : '',
            hbp_pitch: isPitcher ? String(num(stats, 'sHitBattersPitching')) : '',
        };
    });

    return sortByJersey(result);
}

// ---------------------------------------------------------------------------
// Basketball
// ---------------------------------------------------------------------------

export async function parseWmtBasketballApi(teamId: string): Promise<{ players: BasketballPlayerRaw[] }> {
    const apiPlayers = await fetchWmtPlayers(teamId);

    const players = apiPlayers
        .filter(p => {
            const stats = getSeasonStats(p);
            return stats && num(stats, 'sGames') > 0;
        })
        .map((player): BasketballPlayerRaw => {
            const stats = getSeasonStats(player);
            const gp = num(stats, 'sGames');
            const gs = num(stats, 'sGamesStarted');
            const fgMade = num(stats, 'sFieldGoalsMade');
            const fgAtt = num(stats, 'sFieldGoalsAttempted');

            return {
                number: player.jersey_no || '',
                name: `${player.first_name} ${player.last_name}`,
                gpGs: `${gp}-${gs}`,
                min: Math.floor(num(stats, 'sMinutesPlayed') / 60),
                minAvg: gp > 0 ? (Math.floor(num(stats, 'sMinutesPlayed') / 60) / gp).toFixed(1) : '0.0',
                fgMade,
                fgAtt,
                fgPct: pct(stats, 'sFieldGoalPct'),
                threeFgFga: `${num(stats, 'sThreePointFieldGoalsMade')}-${num(stats, 'sThreePointFieldGoalsAttempted')}`,
                threeFgPct: pct(stats, 's3PointFGPercent'),
                ftFta: `${num(stats, 'sFreeThrowsMade')}-${num(stats, 'sFreeThrowsAttempted')}`,
                ftPct: pct(stats, 'sFreeThrowPct'),
                offReb: num(stats, 'sOffensiveRebounds'),
                defReb: num(stats, 'sDefensiveRebounds'),
                totReb: num(stats, 'sTotalRebounds'),
                rebAvg: gp > 0 ? (num(stats, 'sTotalRebounds') / gp).toFixed(1) : '0.0',
                pf: num(stats, 'sPersonalFouls'),
                dq: num(stats, 'sDisqualifications'),
                ast: num(stats, 'sAssists'),
                to: num(stats, 'sTurnovers'),
                blk: num(stats, 'sBlockedShots'),
                stl: num(stats, 'sSteals'),
                pts: num(stats, 'sPoints'),
                ptsAvg: gp > 0 ? (num(stats, 'sPoints') / gp).toFixed(1) : '0.0',
            };
        });

    return { players: sortByJersey(players) };
}

// ---------------------------------------------------------------------------
// Volleyball
// ---------------------------------------------------------------------------

export async function parseWmtVolleyballApi(teamId: string): Promise<{ players: VolleyballPlayerRaw[] }> {
    const apiPlayers = await fetchWmtPlayers(teamId);

    const players = apiPlayers
        .filter(p => {
            const stats = getSeasonStats(p);
            return stats && has(stats, 'sSets');
        })
        .map((player): VolleyballPlayerRaw => {
            const stats = getSeasonStats(player);
            const sp = num(stats, 'sSets');

            return {
                number: player.jersey_no || '',
                name: `${player.first_name} ${player.last_name}`,
                sp,
                k: num(stats, 'sKills'),
                kPerSet: sp > 0 ? (num(stats, 'sKills') / sp).toFixed(2) : '0.00',
                e: num(stats, 'sErrors'),
                ta: num(stats, 'sTotalAttacks'),
                pct: str(stats, 'sAttackPCT') || '.000',
                a: num(stats, 'sAssists'),
                aPerSet: sp > 0 ? (num(stats, 'sAssists') / sp).toFixed(2) : '0.00',
                sa: num(stats, 'sServiceAces'),
                se: num(stats, 'sServiceErrors'),
                saPerSet: sp > 0 ? (num(stats, 'sServiceAces') / sp).toFixed(2) : '0.00',
                re: num(stats, 'sReceptionErrors'),
                dig: num(stats, 'sDigs'),
                digPerSet: sp > 0 ? (num(stats, 'sDigs') / sp).toFixed(2) : '0.00',
                bs: num(stats, 'sBlockSolos'),
                ba: num(stats, 'sBlockAssists'),
                blk: (num(stats, 'sBlockSolos') + num(stats, 'sBlockAssists') * 0.5).toFixed(1),
                blkPerSet: sp > 0
                    ? ((num(stats, 'sBlockSolos') + num(stats, 'sBlockAssists') * 0.5) / sp).toFixed(2)
                    : '0.00',
                be: num(stats, 'sBlockErrors'),
                bhe: num(stats, 'sBallHandlingErrors'),
                pts: (num(stats, 'sPoints') || num(stats, 'sKills') + num(stats, 'sServiceAces') +
                    num(stats, 'sBlockSolos') + num(stats, 'sBlockAssists') * 0.5).toFixed(1),
            };
        });

    return { players: sortByJersey(players) };
}

// Backward compat alias (used by existing baseball route)
export const parseWmtApi = parseWmtBaseballApi;
