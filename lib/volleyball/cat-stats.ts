import type { VolleyballPlayerRaw } from '../parsers/volleyball';

export interface CatStat {
    label: string;
    value: number | string;
}

/**
 * CAT stat priority order for volleyball
 * 
 * Priority (highest to lowest):
 * 1. Points (PTS) - Overall contribution
 * 2. Kills (K) - Offensive attacks
 * 3. Assists (A) - Playmaking/setting
 * 4. Digs (DIG) - Defensive plays
 * 5. Blocks (BLK) - Net defense
 * 6. Service Aces (SA) - Serving
 */
const STAT_PRIORITY: { key: keyof VolleyballPlayerRaw; label: string; isDecimal?: boolean }[] = [
    { key: 'pts', label: 'PTS', isDecimal: true },
    { key: 'k', label: 'Kills' },
    { key: 'a', label: 'Assists' },
    { key: 'dig', label: 'Digs' },
    { key: 'blk', label: 'BLK', isDecimal: true },
    { key: 'sa', label: 'SA' },
];


/**
 * Get the top 3 non-zero stats for a volleyball player
 * Returns stats in priority order, filtering out zeros
 */
export function getVolleyballCatStats(stats: VolleyballPlayerRaw): CatStat[] {
    const result: CatStat[] = [];

    for (const priority of STAT_PRIORITY) {
        if (result.length >= 3) break;

        const rawValue = stats[priority.key];

        // Handle decimal strings like "173.0" for PTS/BLK
        if (priority.isDecimal) {
            const numValue = parseFloat(String(rawValue));
            if (numValue > 0) {
                result.push({ label: priority.label, value: rawValue });
            }
        } else {
            // Handle integer values
            const numValue = typeof rawValue === 'number' ? rawValue : parseInt(String(rawValue));
            if (numValue > 0) {
                result.push({ label: priority.label, value: numValue });
            }
        }
    }

    // Pad with empty values if needed
    while (result.length < 3) {
        result.push({ label: '', value: '' });
    }

    return result;
}

/**
 * Format a CAT value with its label for display/export
 */
export function formatCatValue(value: number | string, label: string): string {
    if (value === '' || value === 0 || label === '') return '';
    return `${value} ${label}`;
}
