'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { RosterPlayer } from '@/lib/roster/extractor';

interface RosterTableProps {
    data: RosterPlayer[];
    isLoading?: boolean;
}

const COLUMNS: { key: keyof RosterPlayer; header: string; align?: 'center' | 'left' }[] = [
    { key: 'lastName', header: 'Last Name' },
    { key: 'firstName', header: 'First Name' },
    { key: 'number', header: '#', align: 'center' },
    { key: 'position', header: 'Pos', align: 'center' },
    { key: 'bats', header: 'Bats', align: 'center' },
    { key: 'throws', header: 'Throws', align: 'center' },
    { key: 'hometown', header: 'Hometown' },
    { key: 'state', header: 'State' },
    { key: 'height', header: 'Height', align: 'center' },
    { key: 'weight', header: 'Weight', align: 'center' },
    { key: 'year', header: 'Year', align: 'center' },
];

export function RosterTable({ data, isLoading }: RosterTableProps) {
    if (isLoading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                ))}
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="py-12 text-center text-muted-foreground">
                No roster data available
            </div>
        );
    }

    return (
        <div className="rounded-md border overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        {COLUMNS.map((col) => (
                            <TableHead key={col.key} className={`whitespace-nowrap${col.align === 'center' ? ' text-center' : ''}`}>
                                {col.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((player, idx) => (
                        <TableRow key={`${player.number}-${idx}`}>
                            {COLUMNS.map((col) => (
                                <TableCell key={col.key} className={`whitespace-nowrap${col.align === 'center' ? ' text-center' : ''}`}>
                                    {col.key === 'hometown' && player.state
                                        ? player.hometown.replace(new RegExp(`,?\\s*${player.state}$`), '')
                                        : player[col.key]}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
