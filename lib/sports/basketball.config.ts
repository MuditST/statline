import type { SportConfig, RosterColumn } from './types';
import type { RosterPlayer } from '@/lib/roster/extractor';
import { BasketballStatsView } from '@/components/sports/basketball-stats-view';

/**
 * Roster columns for basketball
 */
const BASKETBALL_ROSTER_COLUMNS: RosterColumn[] = [
    { key: 'lastName', label: 'Last Name', getValue: (p) => p.lastName },
    { key: 'firstName', label: 'First Name', getValue: (p) => p.firstName },
    { key: 'number', label: '#', getValue: (p) => p.number },
    { key: 'position', label: 'Pos', getValue: (p) => p.position },
    { key: 'height', label: 'Height', getValue: (p) => p.height },
    { key: 'year', label: 'Year', getValue: (p) => p.year },
    { key: 'hometown', label: 'Hometown', getValue: (p) => p.hometown },
    { key: 'state', label: 'State', getValue: (p) => p.state },
];

/**
 * Generate roster export data for basketball
 */
function getRosterExportData(roster: RosterPlayer[]) {
    const headers = BASKETBALL_ROSTER_COLUMNS.map(col => col.label);
    const rows = roster.map(player =>
        BASKETBALL_ROSTER_COLUMNS.map(col => col.getValue(player))
    );

    return { headers, rows };
}

/**
 * Basketball sport configuration
 */
export const basketballConfig: SportConfig = {
    id: 'mens-basketball',
    name: 'Men\'s Basketball',
    rosterColumns: BASKETBALL_ROSTER_COLUMNS,
    getRosterExportData,
    StatsViewComponent: BasketballStatsView,
};
