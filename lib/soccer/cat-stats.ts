import type { SoccerPlayerRaw, SoccerGoalieRaw } from '@/lib/parsers/soccer';

interface CatStat {
    label: string;
    value: number | string;
}

/**
 * Priority order for field player stats (picks first 3 non-zero values)
 * Goals → Assists → Pts → SOG → SH
 */
const FIELD_PLAYER_PRIORITY: { key: keyof SoccerPlayerRaw; label: string }[] = [
    { key: 'g', label: 'Goals' },
    { key: 'a', label: 'Assists' },
    { key: 'pts', label: 'Pts' },
    { key: 'sog', label: 'SOG' },
    { key: 'sh', label: 'SH' },
];

/**
 * Calculate CAT stats for a field player
 * Returns top 3 non-zero stats based on priority order
 */
export function getFieldPlayerCatStats(player: SoccerPlayerRaw): CatStat[] {
    const stats: CatStat[] = [];

    for (const { key, label } of FIELD_PLAYER_PRIORITY) {
        const value = player[key];
        // Skip zeros and non-numeric values
        if (typeof value === 'number' && value > 0) {
            stats.push({ label, value });
            if (stats.length >= 3) break;
        }
    }

    // Pad with empty stats if we don't have 3
    while (stats.length < 3) {
        stats.push({ label: '', value: '' });
    }

    return stats;
}

/**
 * Calculate CAT stats for a goalie
 * Goalies use fixed stats: Saves, GA, SHO
 */
export function getGoalieCatStats(goalie: SoccerGoalieRaw): CatStat[] {
    return [
        { label: 'Saves', value: goalie.save },
        { label: 'GA', value: goalie.ga },
        { label: 'SHO', value: goalie.sho },
    ];
}

/**
 * Format a CAT value for display
 */
export function formatCatValue(value: number | string | undefined, label: string): string {
    if (value === undefined || value === '' || value === '-' || label === '') return '';
    return `${value} ${label}`;
}
