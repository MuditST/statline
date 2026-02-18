import type { SportConfig, RosterColumn } from './types';
import type { RosterPlayer } from '@/lib/roster/extractor';
import { SoccerStatsView } from '@/components/sports/soccer-stats-view';

/**
 * Roster columns for soccer
 * Note: Soccer rosters don't have bats/throws, but have different positions
 */
const SOCCER_ROSTER_COLUMNS: RosterColumn[] = [
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
 * Generate roster export data for soccer
 */
function getRosterExportData(roster: RosterPlayer[]) {
    const headers = SOCCER_ROSTER_COLUMNS.map(col => col.label);
    const rows = roster.map(player =>
        SOCCER_ROSTER_COLUMNS.map(col => col.getValue(player))
    );

    return { headers, rows };
}

/**
 * Soccer sport configuration
 */
export const soccerConfig: SportConfig = {
    id: 'mens-soccer',
    name: 'Men\'s Soccer',
    rosterColumns: SOCCER_ROSTER_COLUMNS,
    getRosterExportData,
    StatsViewComponent: SoccerStatsView,
};
