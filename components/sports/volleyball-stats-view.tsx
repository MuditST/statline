'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupText, ButtonGroupSeparator } from '@/components/ui/button-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { createOrderedVolleyballRoster, type OrderedVolleyballPlayer } from '@/lib/volleyball/ordering';
import { getVolleyballCatStats, formatCatValue } from '@/lib/volleyball/cat-stats';
import type { StatsViewProps } from '@/lib/sports/types';
import type { VolleyballPlayerRaw } from '@/lib/parsers/volleyball';
import { Copy, Download, MoreHorizontal } from 'lucide-react';
import { StatsTableSkeleton } from '@/components/stats-table-skeleton';
import { downloadCsv, excelSafe } from '@/lib/utils/export';
import { createDisplayRows, isGapRow } from '@/lib/utils/display-rows';
import { useCopyFeedback } from '@/lib/hooks/use-copy-feedback';

interface VolleyballStatsViewProps extends StatsViewProps {
    statsData: {
        players: VolleyballPlayerRaw[];
    } | null;
}

export function VolleyballStatsView({ roster, statsData, isLoading }: VolleyballStatsViewProps) {
    const [activeTab, setActiveTab] = useState<'roster' | 'stats'>('roster');
    const { copied, copiedType, copyWithFeedback } = useCopyFeedback();

    // Merge roster with stats and order into 1-99 format
    const orderedData = useMemo(() => {
        if (!statsData) return [];
        return createOrderedVolleyballRoster(roster, statsData.players);
    }, [roster, statsData]);

    // Create display rows with collapsed gaps
    const displayRows = useMemo(() => createDisplayRows(orderedData), [orderedData]);

    const hasData = roster.length > 0;

    // Copy roster handler - no headers, just data
    const handleCopyRoster = async () => {
        if (!orderedData.length) return;
        // Format: jersey firstname lastname pos height weight birthday hometown year
        const rows = orderedData.map(r => [
            r.displayJersey,
            r.player?.firstName || '',
            r.player?.lastName || '',
            r.player?.pos || '',
            r.player?.height || '',
            ' ', // weight - space to prevent Excel from collapsing
            ' ', // birthday - space to prevent Excel from collapsing
            r.player?.hometown || '',
            r.player?.year || ''
        ].join('\t'));
        await copyWithFeedback(rows.join('\n'), 'Roster');
    };

    // Copy stats handler - CAT1 blank CAT2 blank CAT3 format
    const handleCopyStats = async () => {
        if (!orderedData.length) return;
        const rows = orderedData.map(r => {
            const s = r.player?.stats;
            let c1 = '', c2 = '', c3 = '';
            if (s) {
                const cats = getVolleyballCatStats(s);
                c1 = formatCatValue(cats[0].value, cats[0].label);
                c2 = formatCatValue(cats[1].value, cats[1].label);
                c3 = formatCatValue(cats[2].value, cats[2].label);
            }
            // Format: CAT1 blank CAT2 blank CAT3
            return [c1, '', c2, '', c3].join('\t');
        });
        await copyWithFeedback(rows.join('\n'), 'Stats');
    };

    // Download roster CSV - no Row column, includes Weight and Birthday (empty)
    const handleDownloadRoster = () => {
        if (!orderedData.length) return;
        const headers = ['Jersey', 'First Name', 'Last Name', 'POS', 'Height', 'Weight', 'Birthday', 'Hometown', 'Year'];
        const rows = orderedData.map(r => [
            r.displayJersey,
            `"${r.player?.firstName || ''}"`,
            `"${r.player?.lastName || ''}"`,
            r.player?.pos || '',
            r.player?.height || '',
            '', // weight
            '', // birthday
            `"${r.player?.hometown || ''}"`,
            r.player?.year || ''
        ].join(','));
        downloadCsv([headers.join(','), ...rows].join('\n'), 'volleyball_roster');
    };

    // Download stats CSV
    const handleDownloadStats = () => {
        if (!orderedData.length) return;
        const headers = ['Row', 'Jersey', 'Player Name', 'CAT1', 'CAT2', 'CAT3'];
        const rows = orderedData.map(r => {
            const s = r.player?.stats;
            let c1 = '', c2 = '', c3 = '';
            if (s) {
                const cats = getVolleyballCatStats(s);
                c1 = formatCatValue(cats[0].value, cats[0].label);
                c2 = formatCatValue(cats[1].value, cats[1].label);
                c3 = formatCatValue(cats[2].value, cats[2].label);
            }
            return [
                r.row,
                r.displayJersey,
                `"${r.player?.name || ''}"`,
                `"${c1}"`, `"${c2}"`, `"${c3}"`
            ].join(',');
        });
        downloadCsv([headers.join(','), ...rows].join('\n'), 'volleyball_stats');
    };


    // Raw Stats download handler - exports ALL PDF columns in 1-99 order
    const handleDownloadRawStats = () => {
        const headers = ['Row', 'Jersey', 'Name', 'SP', 'K', 'K/S', 'E', 'TA', 'PCT', 'A', 'A/S', 'SA', 'SE', 'SA/S', 'RE', 'DIG', 'DIG/S', 'BS', 'BA', 'BLK', 'BLK/S', 'BE', 'BHE', 'PTS'];
        const rows: string[] = [headers.join(',')];
        for (let row = 1; row <= 99; row++) {
            const entry = orderedData.find(d => d.row === row);
            if (entry && entry.player?.stats) {
                const s = entry.player.stats;
                rows.push([row, entry.displayJersey, `"${entry.player.name}"`, s.sp, s.k, s.kPerSet, s.e, s.ta, s.pct, s.a, s.aPerSet, s.sa, s.se, s.saPerSet, s.re, s.dig, s.digPerSet, s.bs, s.ba, s.blk, s.blkPerSet, s.be, s.bhe, s.pts].join(','));
            } else {
                rows.push([row, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''].join(','));
            }
        }
        downloadCsv(rows.join('\n'), 'volleyball-raw-stats');
    };

    if (!hasData && !isLoading) return null;

    return (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'roster' | 'stats')}>
            {/* Centered Tabs */}
            <div className="flex justify-center mb-4">
                <TabsList>
                    <TabsTrigger value="roster" className="px-8">Roster</TabsTrigger>
                    <TabsTrigger value="stats" className="px-8">Stats</TabsTrigger>
                </TabsList>
            </div>

            {/* Export Buttons */}
            <div className="flex justify-center mb-6">
                {activeTab === 'roster' && (
                    <ButtonGroup>
                        <ButtonGroupText className="text-sm">Export</ButtonGroupText>
                        <Button
                            variant={copied && copiedType === 'Roster' ? 'default' : 'outline'}
                            size="sm"
                            onClick={handleCopyRoster}
                        >
                            <Copy className="h-4 w-4" />
                            {copied && copiedType === 'Roster' ? 'Copied!' : 'Roster'}
                        </Button>
                        <ButtonGroupSeparator />
                        <Button size="sm" variant="outline" onClick={handleDownloadRoster}>
                            <Download className="h-4 w-4" />
                            Csv
                        </Button>
                    </ButtonGroup>
                )}
                {activeTab === 'stats' && (
                    <ButtonGroup>
                        <ButtonGroupText className="text-sm">Export</ButtonGroupText>
                        <Button
                            variant={copied && copiedType === 'Stats' ? 'default' : 'outline'}
                            size="sm"
                            onClick={handleCopyStats}
                        >
                            <Copy className="h-4 w-4" />
                            {copied && copiedType === 'Stats' ? 'Copied!' : 'Stats'}
                        </Button>
                        <ButtonGroupSeparator />
                        <Button size="sm" variant="outline" onClick={handleDownloadStats}>
                            <Download className="h-4 w-4" />
                            Csv
                        </Button>
                        <ButtonGroupSeparator />
                        <Button size="sm" variant="outline" onClick={handleDownloadRawStats}>
                            <Download className="h-4 w-4" />
                            Raw
                        </Button>
                    </ButtonGroup>
                )}
            </div>

            {/* Roster Tab */}
            <TabsContent value="roster" className="mt-0">
                {isLoading ? <StatsTableSkeleton /> : (
                    <div className="overflow-auto border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">Jersey</TableHead>
                                    <TableHead>First Name</TableHead>
                                    <TableHead>Last Name</TableHead>
                                    <TableHead>POS</TableHead>
                                    <TableHead>Height</TableHead>
                                    <TableHead>Weight</TableHead>
                                    <TableHead>Birthday</TableHead>
                                    <TableHead>Hometown</TableHead>
                                    <TableHead>Year</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {displayRows.map((item) => {
                                    if (isGapRow(item)) {
                                        return (
                                            <TableRow key={`gap-${item.startRow}`} className="bg-muted/30 hover:bg-muted/30">
                                                <TableCell colSpan={9} className="py-2 text-center text-xs text-muted-foreground">
                                                    <MoreHorizontal className="inline h-4 w-4 mr-1" />
                                                    {item.count} empty rows ({item.startRow}–{item.startRow + item.count - 1})
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }
                                    const row = item as OrderedVolleyballPlayer;
                                    return (
                                        <TableRow key={row.row} className={!row.player ? 'bg-muted/10' : undefined}>
                                            <TableCell className="py-1 font-bold">{row.displayJersey}</TableCell>
                                            <TableCell className="py-1">{row.player?.firstName}</TableCell>
                                            <TableCell className="py-1">{row.player?.lastName}</TableCell>
                                            <TableCell className="py-1">{row.player?.pos}</TableCell>
                                            <TableCell className="py-1">{row.player?.height}</TableCell>
                                            <TableCell className="py-1"></TableCell>
                                            <TableCell className="py-1"></TableCell>
                                            <TableCell className="py-1">{row.player?.hometown}</TableCell>
                                            <TableCell className="py-1">{row.player?.year}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </TabsContent>

            {/* Stats Tab */}
            <TabsContent value="stats" className="mt-0">
                {isLoading ? <StatsTableSkeleton /> : (
                    <div className="overflow-auto border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">Jersey</TableHead>
                                    <TableHead>Player Name</TableHead>
                                    <TableHead className="w-32">CAT1</TableHead>
                                    <TableHead className="w-32">CAT2</TableHead>
                                    <TableHead className="w-32">CAT3</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {displayRows.map((item) => {
                                    if (isGapRow(item)) {
                                        return (
                                            <TableRow key={`gap-stats-${item.startRow}`} className="bg-muted/30 hover:bg-muted/30">
                                                <TableCell colSpan={5} className="py-2 text-center text-xs text-muted-foreground">
                                                    <MoreHorizontal className="inline h-4 w-4 mr-1" />
                                                    {item.count} empty rows ({item.startRow}–{item.startRow + item.count - 1})
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }
                                    const row = item as OrderedVolleyballPlayer;
                                    const s = row.player?.stats;
                                    let c1 = '', c2 = '', c3 = '';
                                    if (s) {
                                        const cats = getVolleyballCatStats(s);
                                        c1 = formatCatValue(cats[0].value, cats[0].label);
                                        c2 = formatCatValue(cats[1].value, cats[1].label);
                                        c3 = formatCatValue(cats[2].value, cats[2].label);
                                    }
                                    return (
                                        <TableRow key={`stats-${row.row}`} className={!row.player ? 'bg-muted/10' : undefined}>
                                            <TableCell className="py-1 font-bold">{row.displayJersey}</TableCell>
                                            <TableCell className="py-1">{row.player?.name}</TableCell>
                                            <TableCell className="py-1 text-xs">{c1}</TableCell>
                                            <TableCell className="py-1 text-xs">{c2}</TableCell>
                                            <TableCell className="py-1 text-xs">{c3}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </TabsContent>
        </Tabs>
    );
}
