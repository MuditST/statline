'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupText, ButtonGroupSeparator } from '@/components/ui/button-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatsTableSkeleton } from '@/components/stats-table-skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { createOrderedBasketballRoster, type OrderedBasketballPlayer } from '@/lib/basketball/ordering';
import type { StatsViewProps } from '@/lib/sports/types';
import type { BasketballPlayerRaw } from '@/lib/parsers/basketball';
import { Copy, Download, MoreHorizontal } from 'lucide-react';
import { downloadCsv, excelSafe, safeValue } from '@/lib/utils/export';
import { yearToText } from '@/lib/utils/roster';
import { createDisplayRows, isGapRow } from '@/lib/utils/display-rows';
import { useCopyFeedback } from '@/lib/hooks/use-copy-feedback';

interface BasketballStatsViewProps extends StatsViewProps {
    statsData: {
        players: BasketballPlayerRaw[];
    } | null;
}

/** Format a decimal percentage string (e.g. ".452" or "0.452") to "45.2%" */
function formatPct(pct: string | undefined): string {
    if (!pct) return '';
    const num = parseFloat(pct);
    if (isNaN(num)) return pct;
    return `${Math.floor(num * 100)}%`;
}

/** Calculate per-game stat, return formatted string */
function perGame(total: number | undefined, gpGs: string | undefined): string {
    if (total === undefined || total === 0 || !gpGs) return '0';
    const gp = parseInt(gpGs);
    if (!gp || gp === 0) return '0';
    const avg = total / gp;
    return avg % 1 === 0 ? avg.toString() : avg.toFixed(1);
}

export function BasketballStatsView({ roster, statsData, isLoading }: BasketballStatsViewProps) {
    const [activeTab, setActiveTab] = useState<'roster' | 'stats'>('roster');
    const { copied, copiedType, copyWithFeedback } = useCopyFeedback();

    const orderedData = useMemo(() => {
        if (!statsData) return [];
        return createOrderedBasketballRoster(roster, statsData.players);
    }, [roster, statsData]);

    const displayRows = useMemo(() => createDisplayRows(orderedData), [orderedData]);

    const hasData = roster.length > 0;

    const handleCopyRoster = async () => {
        if (!orderedData.length) return;
        const rows = orderedData.map(r => [
            r.displayJersey,
            r.player?.firstName || '',
            r.player?.lastName || '',
            r.player?.pos || '',
            r.player?.height || '',
            '',
            '',
            r.player?.hometown || '',
            yearToText(r.player?.year || '')
        ].join('\t'));
        await copyWithFeedback(rows.join('\n'), 'Roster');
    };

    const handleCopyStats = async () => {
        if (!orderedData.length) return;
        const rows = orderedData.map(r => {
            const s = r.player?.stats;
            return [
                s?.ptsAvg || '',
                formatPct(s?.fgPct),
                formatPct(s?.threeFgPct),
                formatPct(s?.ftPct),
                s?.rebAvg || '',
                perGame(s?.ast, s?.gpGs),
                perGame(s?.blk, s?.gpGs),
                perGame(s?.stl, s?.gpGs),
                s?.minAvg || ''
            ].join('\t');
        });
        await copyWithFeedback(rows.join('\n'), 'Stats');
    };

    const handleDownloadRoster = () => {
        if (!orderedData.length) return;
        const headers = ['Jersey', 'First Name', 'Last Name', 'Pos', 'Height', 'Weight', 'Birthday', 'Hometown', 'Year'];
        const rows = orderedData.map(r => [
            r.displayJersey,
            `"${r.player?.firstName || ''}"`,
            `"${r.player?.lastName || ''}"`,
            r.player?.pos || '',
            r.player?.height || '',
            '',
            '',
            `"${r.player?.hometown || ''}"`,
            yearToText(r.player?.year || '')
        ].join(','));
        downloadCsv([headers.join(','), ...rows].join('\n'), 'basketball_roster');
    };

    const handleDownloadStats = () => {
        if (!orderedData.length) return;
        const headers = ['Row', 'Jersey', 'Player Name', 'PTS/G', 'FG%', '3PT%', 'FT%', 'REB/G', 'AST/G', 'BLK/G', 'STL/G', 'MIN/G'];
        const rows = orderedData.map(r => {
            const s = r.player?.stats;
            return [
                r.row,
                r.displayJersey,
                `"${r.player?.name || ''}"`,
                s?.ptsAvg || '',
                formatPct(s?.fgPct),
                formatPct(s?.threeFgPct),
                formatPct(s?.ftPct),
                s?.rebAvg || '',
                perGame(s?.ast, s?.gpGs),
                perGame(s?.blk, s?.gpGs),
                perGame(s?.stl, s?.gpGs),
                s?.minAvg || ''
            ].join(',');
        });
        downloadCsv([headers.join(','), ...rows].join('\n'), 'basketball_stats');
    };


    const handleDownloadRawStats = () => {
        const headers = ['Row', 'Jersey', 'Name', 'GP-GS', 'MIN', 'MIN/G', 'FG-FGA', 'FG%', '3FG-FGA', '3FG%', 'FT-FTA', 'FT%', 'OFF', 'DEF', 'TOT', 'REB/G', 'PF', 'DQ', 'A', 'TO', 'BLK', 'STL', 'PTS', 'PTS/G'];
        const rows: string[] = [headers.join(',')];
        for (let row = 1; row <= 99; row++) {
            const entry = orderedData.find(d => d.row === row);
            if (entry && entry.player?.stats) {
                const s = entry.player.stats;
                rows.push([
                    row,
                    entry.displayJersey,
                    `"${entry.player.name}"`,
                    excelSafe(s.gpGs),
                    s.min,
                    s.minAvg,
                    excelSafe(`${s.fgMade}-${s.fgAtt}`),
                    s.fgPct,
                    excelSafe(s.threeFgFga),
                    s.threeFgPct,
                    excelSafe(s.ftFta),
                    s.ftPct,
                    s.offReb,
                    s.defReb,
                    s.totReb,
                    s.rebAvg,
                    s.pf,
                    s.dq,
                    s.ast,
                    s.to,
                    s.blk,
                    s.stl,
                    s.pts,
                    s.ptsAvg
                ].join(','));
            } else {
                rows.push([row, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''].join(','));
            }
        }
        downloadCsv(rows.join('\n'), 'basketball-raw-stats');
    };

    if (!hasData && !isLoading) return null;

    return (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'roster' | 'stats')}>
            <div className="flex justify-center mb-4">
                <TabsList>
                    <TabsTrigger value="roster" className="px-8">Roster</TabsTrigger>
                    <TabsTrigger value="stats" className="px-8">Stats</TabsTrigger>
                </TabsList>
            </div>

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

            <TabsContent value="roster" className="mt-0">
                {isLoading ? <StatsTableSkeleton /> : (
                    <div className="overflow-auto border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16 font-semibold">Jersey</TableHead>
                                    <TableHead>First Name</TableHead>
                                    <TableHead>Last Name</TableHead>
                                    <TableHead>Pos</TableHead>
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
                                    const row = item as OrderedBasketballPlayer;
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
                                            <TableCell className="py-1">{yearToText(row.player?.year || '')}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="stats" className="mt-0">
                {isLoading ? <StatsTableSkeleton /> : (
                    <div className="overflow-auto border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead className="w-16">Jersey</TableHead>
                                    <TableHead>Player Name</TableHead>
                                    <TableHead className="text-center">PTS</TableHead>
                                    <TableHead className="text-center">FG %</TableHead>
                                    <TableHead className="text-center">3PT%</TableHead>
                                    <TableHead className="text-center">FT%</TableHead>
                                    <TableHead className="text-center">REB</TableHead>
                                    <TableHead className="text-center">AST</TableHead>
                                    <TableHead className="text-center">BLK</TableHead>
                                    <TableHead className="text-center">STL</TableHead>
                                    <TableHead className="text-center">MIN</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {displayRows.map((item) => {
                                    if (isGapRow(item)) {
                                        return (
                                            <TableRow key={`gap-${item.startRow}`} className="bg-muted/30 hover:bg-muted/30">
                                                <TableCell colSpan={12} className="py-2 text-center text-xs text-muted-foreground">
                                                    <MoreHorizontal className="inline h-4 w-4 mr-1" />
                                                    {item.count} empty rows ({item.startRow}–{item.startRow + item.count - 1})
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }
                                    const row = item as OrderedBasketballPlayer;
                                    const s = row.player?.stats;
                                    return (
                                        <TableRow key={row.row} className={!row.player ? 'bg-muted/10' : undefined}>
                                            <TableCell className="py-1 font-mono text-xs text-muted-foreground">{row.row}</TableCell>
                                            <TableCell className="py-1 font-bold">{row.displayJersey}</TableCell>
                                            <TableCell className="py-1">{row.player?.name}</TableCell>
                                            <TableCell className="py-1 text-center font-mono">{s?.ptsAvg}</TableCell>
                                            <TableCell className="py-1 text-center font-mono text-xs">{formatPct(s?.fgPct)}</TableCell>
                                            <TableCell className="py-1 text-center font-mono text-xs">{formatPct(s?.threeFgPct)}</TableCell>
                                            <TableCell className="py-1 text-center font-mono text-xs">{formatPct(s?.ftPct)}</TableCell>
                                            <TableCell className="py-1 text-center font-mono">{s?.rebAvg}</TableCell>
                                            <TableCell className="py-1 text-center font-mono">{perGame(s?.ast, s?.gpGs)}</TableCell>
                                            <TableCell className="py-1 text-center font-mono">{perGame(s?.blk, s?.gpGs)}</TableCell>
                                            <TableCell className="py-1 text-center font-mono">{perGame(s?.stl, s?.gpGs)}</TableCell>
                                            <TableCell className="py-1 text-center font-mono">{s?.minAvg}</TableCell>
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
