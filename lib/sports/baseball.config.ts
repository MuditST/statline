import type { SportConfig, RosterColumn } from './types';
import type { RosterPlayer } from '@/lib/roster/extractor';
import { BaseballStatsView } from '@/components/sports/baseball-stats-view';

/**
 * Roster columns for baseball
 */
const BASEBALL_ROSTER_COLUMNS: RosterColumn[] = [
    { key: 'lastName', label: 'Last Name', getValue: (p) => p.lastName },
    { key: 'firstName', label: 'First Name', getValue: (p) => p.firstName },
    { key: 'number', label: '#', getValue: (p) => p.number },
    { key: 'position', label: 'Pos', getValue: (p) => p.position },
    { key: 'bats', label: 'Bats', getValue: (p) => p.bats },
    { key: 'throws', label: 'Throws', getValue: (p) => p.throws },
    { key: 'height', label: 'Height', getValue: (p) => p.height },
    { key: 'weight', label: 'Weight', getValue: (p) => p.weight },
    { key: 'year', label: 'Year', getValue: (p) => p.year },
    { key: 'hometown', label: 'Hometown', getValue: (p) => p.hometown },
    { key: 'state', label: 'State', getValue: (p) => p.state },
];

/**
 * Generate roster export data for baseball
 */
function getRosterExportData(roster: RosterPlayer[]) {
    const headers = BASEBALL_ROSTER_COLUMNS.map(col => col.label);
    const rows = roster.map(player =>
        BASEBALL_ROSTER_COLUMNS.map(col => col.getValue(player))
    );

    return { headers, rows };
}

/**
 * Baseball sport configuration
 */
export const baseballConfig: SportConfig = {
    id: 'baseball',
    name: 'Baseball',
    rosterColumns: BASEBALL_ROSTER_COLUMNS,
    getRosterExportData,
    StatsViewComponent: BaseballStatsView,
};
