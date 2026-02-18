'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { StatsTableSkeleton } from '@/components/stats-table-skeleton';
import type { PlayerStats } from '@/lib/parsers/baseball';

interface StatsTableProps {
    data: PlayerStats[];
    isLoading?: boolean;
}

const COLUMNS: { key: keyof PlayerStats; header: string; group: 'info' | 'batting' | 'pitching'; align?: 'left' }[] = [
    // Info
    { key: 'number', header: '#', group: 'info' },
    { key: 'name', header: 'Name', group: 'info', align: 'left' },
    // Batting
    { key: 'ab', header: 'AB', group: 'batting' },
    { key: 'r', header: 'R', group: 'batting' },
    { key: 'h', header: 'H', group: 'batting' },
    { key: 'doubles', header: '2B', group: 'batting' },
    { key: 'triples', header: '3B', group: 'batting' },
    { key: 'hr', header: 'HR', group: 'batting' },
    { key: 'rbi', header: 'RBI', group: 'batting' },
    { key: 'bb', header: 'BB', group: 'batting' },
    { key: 'hbp', header: 'HBP', group: 'batting' },
    { key: 'so', header: 'SO', group: 'batting' },
    { key: 'gdp', header: 'GDP', group: 'batting' },
    { key: 'sf', header: 'SF', group: 'batting' },
    { key: 'sh', header: 'SH', group: 'batting' },
    { key: 'sb', header: 'SB', group: 'batting' },
    { key: 'cs', header: 'CS', group: 'batting' },
    // Pitching
    { key: 'w', header: 'W', group: 'pitching' },
    { key: 'l', header: 'L', group: 'pitching' },
    { key: 'g', header: 'G', group: 'pitching' },
    { key: 'gs', header: 'GS', group: 'pitching' },
    { key: 'cg', header: 'CG', group: 'pitching' },
    { key: 'sho', header: 'SHO', group: 'pitching' },
    { key: 'sv', header: 'SV', group: 'pitching' },
    { key: 'ip', header: 'IP', group: 'pitching' },
    { key: 'h_pitch', header: 'H', group: 'pitching' },
    { key: 'r_pitch', header: 'R', group: 'pitching' },
    { key: 'er', header: 'ER', group: 'pitching' },
    { key: 'bb_pitch', header: 'BB', group: 'pitching' },
    { key: 'so_pitch', header: 'SO', group: 'pitching' },
    { key: 'hr_pitch', header: 'HR', group: 'pitching' },
    { key: 'hbp_pitch', header: 'HBP', group: 'pitching' },
];

export function StatsTable({ data, isLoading }: StatsTableProps) {
    if (isLoading) {
        return <StatsTableSkeleton />;
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
        return (
            <div className="py-12 text-center text-muted-foreground">
                No stats data available
            </div>
        );
    }

    return (
        <div className="rounded-md border overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        {COLUMNS.map((col) => (
                            <TableHead
                                key={col.key}
                                className={`whitespace-nowrap${col.align === 'left' ? '' : ' text-center'}`}
                            >
                                {col.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((player, idx) => (
                        <TableRow key={`${player.number}-${idx}`}>
                            {COLUMNS.map((col) => (
                                <TableCell
                                    key={col.key}
                                    className={`whitespace-nowrap${col.align === 'left' ? '' : ' text-center'}`}
                                >
                                    {player[col.key]}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
