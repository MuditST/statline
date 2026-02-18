import type { RosterPlayer } from '../roster/extractor';
import type { SoccerPlayerRaw, SoccerGoalieRaw } from '../parsers/soccer';
import { jerseyToRow, findMatchingStats } from '../utils/player-matching';

export interface OrderedSoccerPlayer {
    row: number;         // 1-99
    displayJersey: string; // The jersey number to display (e.g. "0", "00", "5")
    player?: {
        name: string;
        firstName: string;
        lastName: string;
        pos: string;
        height: string;
        hometown: string;
        year: string;
        stats?: SoccerPlayerRaw | SoccerGoalieRaw;
    };
}

/**
 * Merge roster with PDF stats (field + goalie) and order into 1-99 rows
 * 
 * Uses the shared player matching strategy:
 * - Primary: Jersey + any first/last name match
 * - Fallback: Exact first AND last name match (for jersey changes)
 */
export function createOrderedSoccerRoster(
    roster: RosterPlayer[],
    fieldStats: SoccerPlayerRaw[],
    goalieStats: SoccerGoalieRaw[]
): OrderedSoccerPlayer[] {
    // 1. Initialize empty rows 1-99
    const rows = new Map<number, OrderedSoccerPlayer>();
    for (let i = 1; i <= 99; i++) {
        let displayJersey = String(i);
        if (i === 90) displayJersey = '0';
        if (i === 99) displayJersey = '00';

        rows.set(i, {
            row: i,
            displayJersey
        });
    }

    // 2. Combine field and goalie stats into one array for matching
    // NOTE: Put goalies FIRST so that if a player appears in both (e.g. infinite 0s in field stats),
    // we match the goalie stats first.
    const allStats: (SoccerPlayerRaw | SoccerGoalieRaw)[] = [
        ...(Array.isArray(goalieStats) ? goalieStats : []),
        ...(Array.isArray(fieldStats) ? fieldStats : [])
    ];

    // 3. Process Roster Players (Primary Source)
    for (const player of roster) {
        const rowNum = jerseyToRow(player.number);
        if (rowNum === 0) continue;

        // Use shared matching utility
        const stats = findMatchingStats(
            { firstName: player.firstName, lastName: player.lastName, number: player.number },
            allStats
        );


        const rosterFullName = `${player.firstName} ${player.lastName}`;

        // Add to row (overwrite empty slot)
        // Note: Use hometown directly - roster extractor already includes state
        rows.set(rowNum, {
            row: rowNum,
            displayJersey: player.number,
            player: {
                name: rosterFullName,
                firstName: player.firstName,
                lastName: player.lastName,
                pos: player.position,
                height: player.height,
                hometown: player.hometown,
                year: player.year,
                stats
            }
        });
    }

    return Array.from(rows.values());
}

