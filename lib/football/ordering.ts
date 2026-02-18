import { FootballPlayerRaw } from "@/lib/parsers/football";
import { normalizeName, normalizeJersey, looseNameMatch, exactNameMatch, extractFirstName, extractLastName } from "../utils/player-matching";

export interface Player {
    jersey: string;
    name: string;
    height: string;
    weight: string;
    year: string;
    hometown: string;
    position: string;
}

export interface OrderedFootballPlayer extends Player {
    /** Assigned slot (1-99 for active, -1 for inactive) */
    slot: number;
    /** Display number (the actual jersey number worn) */
    display: string;
    stats?: FootballPlayerRaw;
}

/**
 * Match a football player with their stats
 * Football uses combined 'name' field instead of firstName/lastName
 * 
 * Uses the shared matching strategy:
 * - Primary: Jersey + any first/last name match
 * - Fallback: Exact first AND last name match (for jersey changes)
 */
function matchFootballPlayerStats(
    player: Player,
    stats: FootballPlayerRaw[],
    usedStats: Set<string>
): FootballPlayerRaw | undefined {
    // Parse roster name into first/last (format: "First Last")
    const rosterFirst = extractFirstName(player.name);
    const rosterLast = extractLastName(player.name);

    // Primary: Try to find stats with matching jersey + loose name match
    const primaryMatch = stats.find(stat => {
        if (usedStats.has(stat.name + stat.jersey)) return false;

        const jerseyMatch = normalizeJersey(stat.jersey) === normalizeJersey(player.jersey);
        if (!jerseyMatch) return false;

        return looseNameMatch(rosterFirst, rosterLast, stat.name);
    });

    if (primaryMatch) {
        return primaryMatch;
    }

    // Fallback: Try to find stats with exact name match (different jersey)
    const fallbackMatch = stats.find(stat => {
        if (usedStats.has(stat.name + stat.jersey)) return false;

        // Only use fallback if jersey is different
        if (normalizeJersey(stat.jersey) === normalizeJersey(player.jersey)) return false;

        return exactNameMatch(rosterFirst, rosterLast, stat.name);
    });

    return fallbackMatch;
}

export function createOrderedFootballRoster(
    roster: Player[],
    stats: FootballPlayerRaw[]
): OrderedFootballPlayer[] {
    const usedStats = new Set<string>();
    const safeStats = Array.isArray(stats) ? stats : [];

    // Step 1: Match roster players with their stats
    const playersWithStats: Array<Player & { stats?: FootballPlayerRaw }> = roster.map(player => {
        const matchedStat = matchFootballPlayerStats(player, safeStats, usedStats);

        if (matchedStat) {
            usedStats.add(matchedStat.name + matchedStat.jersey);
            return { ...player, stats: matchedStat };
        }

        return { ...player };
    });

    // NOTE: We intentionally do NOT add players from stats who aren't in roster.
    // The roster page is the source of truth for current players.
    // Stats-only players likely graduated/transferred and shouldn't be shown.

    // Step 2: Assign slots (1-99 for active, -1 for inactive)
    const slotAssignment = new Map<number, OrderedFootballPlayer>(); // slot -> player
    const needsSlot: Array<Player & { stats?: FootballPlayerRaw }> = []; // Players needing alternative slots
    const inactivePlayers: OrderedFootballPlayer[] = []; // players assigned to -1

    // Track which slots are occupied
    const occupiedSlots = new Set<number>();

    // Group players by jersey number to detect duplicates
    const playersByJersey = new Map<number, Array<Player & { stats?: FootballPlayerRaw }>>();
    playersWithStats.forEach(p => {
        const jerseyNum = parseInt(p.jersey);
        const key = isNaN(jerseyNum) ? -999 : jerseyNum;
        if (!playersByJersey.has(key)) {
            playersByJersey.set(key, []);
        }
        playersByJersey.get(key)!.push(p);
    });

    // Process each jersey number
    const jerseyNumbers = Array.from(playersByJersey.keys()).sort((a, b) => a - b);

    for (const jerseyNum of jerseyNumbers) {
        const players = playersByJersey.get(jerseyNum)!;
        const isValidSlot = jerseyNum >= 1 && jerseyNum <= 99;

        if (players.length === 1) {
            const player = players[0];
            if (isValidSlot) {
                // Valid jersey, assign to natural slot
                occupiedSlots.add(jerseyNum);
                slotAssignment.set(jerseyNum, {
                    ...player,
                    slot: jerseyNum,
                    display: player.jersey
                });
            } else {
                // Invalid jersey (0, negative, or >99) - try to find empty slot
                needsSlot.push(player);
            }
        } else {
            // Duplicate jerseys - sort by who has stats (stats first)
            const sorted = [...players].sort((a, b) => {
                const aHasStats = a.stats ? 1 : 0;
                const bHasStats = b.stats ? 1 : 0;
                return bHasStats - aHasStats; // Stats first
            });

            // First player (with stats if any) gets the original slot if valid
            const firstPlayer = sorted[0];
            if (isValidSlot) {
                occupiedSlots.add(jerseyNum);
                slotAssignment.set(jerseyNum, {
                    ...firstPlayer,
                    slot: jerseyNum,
                    display: firstPlayer.jersey
                });
            } else {
                // Invalid jersey - add to needsSlot to try finding an empty slot
                needsSlot.push(firstPlayer);
            }

            // Remaining players need alternative slots - add ALL to needsSlot
            // They'll be placed in empty slots or go inactive if no room
            for (let i = 1; i < sorted.length; i++) {
                needsSlot.push(sorted[i]);
            }
        }
    }

    // Step 3: Assign empty slots to ALL players who need them (duplicates/invalid jersey)
    // Try to place everyone before marking anyone inactive
    for (const player of needsSlot) {
        let foundSlot = -1;
        for (let slot = 1; slot <= 99; slot++) {
            if (!occupiedSlots.has(slot)) {
                foundSlot = slot;
                break;
            }
        }

        if (foundSlot !== -1) {
            occupiedSlots.add(foundSlot);
            slotAssignment.set(foundSlot, {
                ...player,
                slot: foundSlot,
                display: player.jersey // Shows actual jersey number
            });
        } else {
            // No empty slots left - truly inactive
            inactivePlayers.push({
                ...player,
                slot: -1,
                display: player.jersey
            });
        }
    }

    // Step 4: Build final ordered list
    // Active players sorted by slot (1-99), then inactive (-1)
    const activeBySlot = Array.from(slotAssignment.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([_, player]) => player);

    return [...activeBySlot, ...inactivePlayers];
}
