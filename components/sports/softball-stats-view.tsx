'use client';

import { BaseballStatsView } from './baseball-stats-view';
import type { StatsViewProps } from '@/lib/sports/types';
import type { BattingRaw, PitchingRaw } from '@/lib/parsers/baseball';

interface SoftballStatsViewProps extends StatsViewProps {
    statsData: { batting: BattingRaw[]; pitching: PitchingRaw[] };
}

/**
 * Softball reuses the baseball view with 'softball' file naming
 */
export function SoftballStatsView(props: SoftballStatsViewProps) {
    return <BaseballStatsView {...props} sportName="softball" />;
}
