import type { RosterPlayer } from '../roster/extractor';
import type { VolleyballPlayerRaw } from '../parsers/volleyball';
import { jerseyToRow, findMatchingStats } from '../utils/player-matching';

export interface OrderedVolleyballPlayer {
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
        stats?: VolleyballPlayerRaw;
    };
}

/**
 * Merge roster with PDF stats and order into 1-99 rows
 * 
 * Uses the shared player matching strategy:
 * - Primary: Jersey + any first/last name match
 * - Fallback: Exact first AND last name match (for jersey changes)
 */
export function createOrderedVolleyballRoster(
    roster: RosterPlayer[],
    playerStats: VolleyballPlayerRaw[]
): OrderedVolleyballPlayer[] {
    // 1. Initialize empty rows 1-99
    const rows = new Map<number, OrderedVolleyballPlayer>();
    for (let i = 1; i <= 99; i++) {
        let displayJersey = String(i);
        if (i === 90) displayJersey = '0';
        if (i === 99) displayJersey = '00';

        rows.set(i, {
            row: i,
            displayJersey
        });
    }

    // 2. Process Roster Players (Primary Source)
    for (const player of roster) {
        const rowNum = jerseyToRow(player.number);
        if (rowNum === 0) continue;

        // Use shared matching utility
        const stats = findMatchingStats(
            { firstName: player.firstName, lastName: player.lastName, number: player.number },
            playerStats || []
        );

        const rosterFullName = `${player.firstName} ${player.lastName}`;

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
