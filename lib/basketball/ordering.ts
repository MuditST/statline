import type { RosterPlayer } from '../roster/extractor';
import type { BasketballPlayerRaw } from '../parsers/basketball';
import { jerseyToRow, findMatchingStats } from '../utils/player-matching';

export interface OrderedBasketballPlayer {
    row: number;
    displayJersey: string;
    player?: {
        name: string;
        firstName: string;
        lastName: string;
        pos: string;
        height: string;
        hometown: string;
        year: string;
        stats?: BasketballPlayerRaw;
    };
}

/**
 * Merge roster with PDF stats and order into 1-99 rows
 * 
 * Uses the shared player matching strategy:
 * - Primary: Jersey + any first/last name match
 * - Fallback: Exact first AND last name match (for jersey changes)
 */
export function createOrderedBasketballRoster(
    roster: RosterPlayer[],
    playerStats: BasketballPlayerRaw[]
): OrderedBasketballPlayer[] {
    // Initialize empty rows 1-99
    const rows = new Map<number, OrderedBasketballPlayer>();
    for (let i = 1; i <= 99; i++) {
        let displayJersey = String(i);
        if (i === 90) displayJersey = '0';
        if (i === 99) displayJersey = '00';
        rows.set(i, { row: i, displayJersey });
    }

    // Process Roster Players
    for (const player of roster) {
        const rowNum = jerseyToRow(player.number);
        if (rowNum === 0) continue;

        // Use shared matching utility
        const stats = findMatchingStats(
            { firstName: player.firstName, lastName: player.lastName, number: player.number },
            playerStats || []
        );

        rows.set(rowNum, {
            row: rowNum,
            displayJersey: player.number,
            player: {
                name: `${player.firstName} ${player.lastName}`,
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
