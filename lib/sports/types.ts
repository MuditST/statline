import type { SportType } from '@/types';
import type { RosterPlayer } from '@/lib/roster/extractor';

/**
 * Column configuration for roster display
 */
export interface RosterColumn {
    key: string;
    label: string;
    getValue: (player: RosterPlayer) => string;
}

/**
 * Props for sport-specific stats view components.
 * `statsData` is intentionally untyped here — each sport component accepts this
 * prop and narrows it via its own interface (e.g., SoccerStatsViewProps).
 */
export interface StatsViewProps {
    roster: RosterPlayer[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Each sport component narrows this via its own extended props interface
    statsData: any;
    isLoading: boolean;
}

/**
 * Sport configuration defining all sport-specific behavior
 */
export interface SportConfig {
    id: SportType;
    name: string;

    // Roster configuration
    rosterColumns: RosterColumn[];
    getRosterExportData: (roster: RosterPlayer[]) => {
        headers: string[];
        rows: string[][];
    };

    // Stats view component
    StatsViewComponent: React.ComponentType<StatsViewProps>;
}
