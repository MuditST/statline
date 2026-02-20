import type { BasketballPlayerRaw } from '@/lib/parsers/basketball';

export interface CatStat {
    label: string;
    value: string;
}

interface RankedStat {
    label: string;
    displayValue: string;
    score: number;
    /** Tiebreaker: lower number = higher priority when scores are equal */
    priority: number;
}

/**
 * Get top N cat stats for a basketball player, ranked by normalized score.
 *
 * Normalization puts all stats on a comparable ~0-15 scale:
 *   PPG, RPG, APG, BPG, SPG  → per-game value as-is
 *   FG%, 3PT%                → decimal × 10
 *   FT%                      → decimal × 6.66 (de-weighted since FT% is naturally higher)
 *   MPG                      → raw ÷ 10, only included if raw > 30
 *
 * Tiebreaker order: 3PT% → FG% → FT% → BPG → SPG → RPG → APG → MPG
 * PPG is always pinned to column 1 when selected.
 */
export function getBasketballCatStats(player: BasketballPlayerRaw, count: number = 3): CatStat[] {
    const candidates: RankedStat[] = [];

    const ptsAvg = parseFloat(player.ptsAvg);
    if (ptsAvg > 0) candidates.push({ label: 'PPG', displayValue: player.ptsAvg, score: ptsAvg, priority: 0 });

    const gp = parseInt(player.gpGs) || 0;

    const threePct = parseFloat(player.threeFgPct);
    if (threePct > 0) candidates.push({ label: '3-PT FG', displayValue: `${Math.floor(threePct * 100)}%`, score: threePct * 10, priority: 1 });

    const fgPct = parseFloat(player.fgPct);
    if (fgPct > 0) candidates.push({ label: 'FG', displayValue: `${Math.floor(fgPct * 100)}%`, score: fgPct * 10, priority: 2 });

    const ftPct = parseFloat(player.ftPct);
    if (ftPct > 0) candidates.push({ label: 'FT', displayValue: `${Math.floor(ftPct * 100)}%`, score: ftPct * 6.66, priority: 3 });

    if (gp > 0 && player.blk > 0) {
        const bpg = player.blk / gp;
        candidates.push({ label: 'BPG', displayValue: bpg % 1 === 0 ? bpg.toString() : bpg.toFixed(1), score: bpg, priority: 4 });
    }

    if (gp > 0 && player.stl > 0) {
        const spg = player.stl / gp;
        candidates.push({ label: 'SPG', displayValue: spg % 1 === 0 ? spg.toString() : spg.toFixed(1), score: spg, priority: 5 });
    }

    const rebAvg = parseFloat(player.rebAvg);
    if (rebAvg > 0) candidates.push({ label: 'RPG', displayValue: player.rebAvg, score: rebAvg, priority: 6 });

    if (gp > 0 && player.ast > 0) {
        const apg = player.ast / gp;
        candidates.push({ label: 'APG', displayValue: apg % 1 === 0 ? apg.toString() : apg.toFixed(1), score: apg, priority: 7 });
    }

    const minAvg = parseFloat(player.minAvg);
    if (minAvg > 30) candidates.push({ label: 'MPG', displayValue: player.minAvg, score: minAvg / 10, priority: 8 });

    // Sort by score descending, then by priority ascending (tiebreaker)
    candidates.sort((a, b) => b.score - a.score || a.priority - b.priority);

    // Check if PPG is in the top 3 candidates (regardless of requested count)
    const ppgInTop3 = candidates.slice(0, 3).some(c => c.label === 'PPG');

    let picked = candidates.slice(0, count);

    // If PPG is in top 3 but didn't make the cut for requested count, force it in
    if (ppgInTop3 && !picked.some(c => c.label === 'PPG')) {
        const ppg = candidates.find(c => c.label === 'PPG')!;
        picked = [ppg, ...picked.slice(0, count - 1)];
    }

    // If all picked stats are percentages, force PPG in to ensure variety
    const pctLabels = new Set(['FG', '3-PT FG', 'FT']);
    const allPct = picked.length > 0 && picked.every(c => pctLabels.has(c.label));
    if (allPct) {
        const ppg = candidates.find(c => c.label === 'PPG');
        if (ppg) {
            // Replace the lowest-scoring percentage stat with PPG
            picked[picked.length - 1] = ppg;
        }
    }

    // Pin PPG to column 1 if it's in the selection
    const ppgIdx = picked.findIndex(c => c.label === 'PPG');
    if (ppgIdx > 0) {
        const [ppg] = picked.splice(ppgIdx, 1);
        picked.unshift(ppg);
    }

    const stats: CatStat[] = picked.map(c => ({
        label: c.label,
        value: c.displayValue,
    }));

    // Pad with empty stats
    while (stats.length < count) {
        stats.push({ label: '', value: '' });
    }

    return stats;
}

/**
 * Format a cat stat for display/copy: "VALUE LABEL" (e.g., "14.2 PPG", "36% FG")
 */
export function formatCatValue(stat: CatStat): string {
    if (!stat.label || !stat.value) return '';
    return `${stat.value} ${stat.label}`;
}
