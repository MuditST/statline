import type { RosterPlayer } from '@/lib/roster/extractor';
import type { SportConfig } from './types';
import { VolleyballStatsView } from '../../components/sports/volleyball-stats-view';

export const volleyballConfig: SportConfig = {
    id: 'womens-volleyball',
    name: "Women's Volleyball",
    rosterColumns: [
        { key: 'number', label: '#', getValue: (p: RosterPlayer) => p.number },
        { key: 'name', label: 'Name', getValue: (p: RosterPlayer) => `${p.firstName} ${p.lastName}` },
        { key: 'position', label: 'Pos', getValue: (p: RosterPlayer) => p.position },
        { key: 'height', label: 'Ht', getValue: (p: RosterPlayer) => p.height },
        { key: 'year', label: 'Yr', getValue: (p: RosterPlayer) => p.year },
        { key: 'hometown', label: 'Hometown', getValue: (p: RosterPlayer) => p.hometown },
    ],
    getRosterExportData: (roster: RosterPlayer[]) => ({
        headers: ['#', 'First Name', 'Last Name', 'Pos', 'Height', 'Year', 'Hometown'],
        rows: roster.map(p => [
            p.number,
            p.firstName,
            p.lastName,
            p.position,
            p.height,
            p.year,
            p.hometown
        ])
    }),
    StatsViewComponent: VolleyballStatsView,
};
