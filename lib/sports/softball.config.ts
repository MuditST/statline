import type { SportConfig, RosterColumn } from './types';
import type { RosterPlayer } from '@/lib/roster/extractor';
import { SoftballStatsView } from '@/components/sports/softball-stats-view';

/**
 * Roster columns for softball (same as baseball)
 */
const SOFTBALL_ROSTER_COLUMNS: RosterColumn[] = [
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
 * Generate roster export data for softball
 */
function getRosterExportData(roster: RosterPlayer[]) {
    const headers = SOFTBALL_ROSTER_COLUMNS.map(col => col.label);
    const rows = roster.map(player =>
        SOFTBALL_ROSTER_COLUMNS.map(col => col.getValue(player))
    );

    return { headers, rows };
}

/**
 * Softball sport configuration
 */
export const softballConfig: SportConfig = {
    id: 'softball',
    name: 'Softball',
    rosterColumns: SOFTBALL_ROSTER_COLUMNS,
    getRosterExportData,
    StatsViewComponent: SoftballStatsView,
};
