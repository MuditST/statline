/**
 * Display row utilities for 1-99 ordered sport views.
 *
 * These utilities handle collapsing consecutive empty jersey slots
 * into a single "gap" indicator row in the UI — keeping the table
 * compact while still showing the full 1-99 slot range.
 */

/** Sentinel row that represents a collapsed run of empty slots */
export interface GapRow {
    type: 'gap';
    count: number;
    startRow: number;
}

/** Any player row type that has a `row` number and optional `player` */
interface OrderedRow {
    row: number;
    player?: unknown;
}

/**
 * Transform an ordered 1-99 player array into display rows,
 * collapsing runs of 5+ consecutive empty slots into a single
 * gap indicator.
 *
 * - Runs of fewer than 5 empty rows are kept individually.
 * - Populated rows are always included.
 *
 * Used by basketball, soccer, and volleyball views.
 * Football uses its own variant with a filter function.
 */
export function createDisplayRows<T extends OrderedRow>(
    orderedData: T[]
): (T | GapRow)[] {
    const display: (T | GapRow)[] = [];
    let gapStart = -1;
    let gapCount = 0;

    for (const row of orderedData) {
        if (!row.player) {
            if (gapStart === -1) {
                gapStart = row.row;
                gapCount = 1;
            } else {
                gapCount++;
            }
        } else {
            // Player present — flush any pending gap
            if (gapCount > 0) {
                if (gapCount >= 5) {
                    display.push({ type: 'gap', count: gapCount, startRow: gapStart });
                } else {
                    for (let i = 0; i < gapCount; i++) {
                        const emptyRow = orderedData.find(r => r.row === gapStart + i);
                        if (emptyRow) display.push(emptyRow);
                    }
                }
                gapStart = -1;
                gapCount = 0;
            }
            display.push(row);
        }
    }

    // Flush trailing gap
    if (gapCount >= 5) {
        display.push({ type: 'gap', count: gapCount, startRow: gapStart });
    } else if (gapCount > 0) {
        for (let i = 0; i < gapCount; i++) {
            const emptyRow = orderedData.find(r => r.row === gapStart + i);
            if (emptyRow) display.push(emptyRow);
        }
    }

    return display;
}

/** Type guard to check if a row is a gap indicator */
export function isGapRow(row: unknown): row is GapRow {
    return typeof row === 'object' && row !== null && 'type' in row && (row as GapRow).type === 'gap';
}
