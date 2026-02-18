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
import { createOrderedSoccerRoster, type OrderedSoccerPlayer } from '@/lib/soccer/ordering';
import { getFieldPlayerCatStats, getGoalieCatStats, formatCatValue } from '@/lib/soccer/cat-stats';
import type { StatsViewProps } from '@/lib/sports/types';
import type { SoccerPlayerRaw, SoccerGoalieRaw } from '@/lib/parsers/soccer';
import { Copy, Download, MoreHorizontal } from 'lucide-react';
import { StatsTableSkeleton } from '@/components/stats-table-skeleton';
import { downloadCsv, excelSafe } from '@/lib/utils/export';
import { createDisplayRows, isGapRow } from '@/lib/utils/display-rows';
import { useCopyFeedback } from '@/lib/hooks/use-copy-feedback';

interface SoccerStatsViewProps extends StatsViewProps {
    statsData: {
        players: SoccerPlayerRaw[];
        goalies: SoccerGoalieRaw[];
    } | null;
}

export function SoccerStatsView({ roster, statsData, isLoading }: SoccerStatsViewProps) {
    const [activeTab, setActiveTab] = useState<'roster' | 'stats'>('roster');
    const { copied, copiedType, copyWithFeedback } = useCopyFeedback();

    // Merge roster with stats and order into 1-99 format
    const orderedData = useMemo(() => {
        if (!statsData) return [];
        return createOrderedSoccerRoster(
            roster,
            statsData.players,
            statsData.goalies
        );
    }, [roster, statsData]);

    // Create display rows with collapsed gaps
    const displayRows = useMemo(() => createDisplayRows(orderedData), [orderedData]);

    const hasData = roster.length > 0;

    // Copy handlers - data only, no headers
    const handleCopyRoster = async () => {
        if (!orderedData.length) return;
        // Format: Display, FirstName, LastName, POS, Height, Weight (blank), Birthday (blank), Hometown, Year
        const rows = orderedData.map(r => [
            r.displayJersey,
            r.player?.firstName || '',
            r.player?.lastName || '',
            r.player?.pos || '',
            r.player?.height || '',
            '', // Weight (blank)
            '', // Birthday (blank)
            r.player?.hometown || '',
            r.player?.year || ''
        ].join('\t'));
        await copyWithFeedback(rows.join('\n'), 'Roster');
    };

    const handleCopyGoals = async () => {
        if (!orderedData.length) return;
        // Copy only goals values (no headers, no player info)
        const rows = orderedData.map(r => {
            const stats = r.player?.stats;
            const goals = stats && 'g' in stats ? String(stats.g) : '';
            return goals;
        });
        await copyWithFeedback(rows.join('\n'), 'Goals');
    };

    const handleCopyStats = async () => {
        if (!orderedData.length) return;
        // Format: CAT1, blank column, CAT2, blank column, CAT3 (no player name/jersey)
        const rows = orderedData.map(r => {
            const stats = r.player?.stats;
            let c1 = '', c2 = '', c3 = '';
            if (stats) {
                const cats = 'g' in stats
                    ? getFieldPlayerCatStats(stats)
                    : getGoalieCatStats(stats);
                c1 = formatCatValue(cats[0].value, cats[0].label);
                c2 = formatCatValue(cats[1].value, cats[1].label);
                c3 = formatCatValue(cats[2].value, cats[2].label);
            }
            return [c1, '', c2, '', c3].join('\t');
        });
        await copyWithFeedback(rows.join('\n'), 'Stats');
    };

    // Download handlers - with headers
    const handleDownloadRoster = () => {
        if (!orderedData.length) return;
        // Same format as copy roster but with headers
        const headers = ['Jersey', 'First Name', 'Last Name', 'POS', 'Height', 'Weight', 'Birthday', 'Hometown', 'Year'];
        const rows = orderedData.map(r => [
            r.displayJersey,
            `"${r.player?.firstName || ''}"`,
            `"${r.player?.lastName || ''}"`,
            r.player?.pos || '',
            r.player?.height || '',
            '', // Weight (blank)
            '', // Birthday (blank)
            `"${r.player?.hometown || ''}"`,
            r.player?.year || ''
        ].join(','));
        downloadCsv([headers.join(','), ...rows].join('\n'), 'soccer_roster');
    };

    const handleDownloadGoals = () => {
        if (!orderedData.length) return;
        // Format: Jersey, Name, Goals
        const headers = ['Jersey', 'Name', 'Goals'];
        const rows = orderedData.map(r => {
            const stats = r.player?.stats;
            const goals = stats && 'g' in stats ? String(stats.g) : '';
            return [r.displayJersey, `"${r.player?.name || ''}"`, goals].join(',');
        });
        downloadCsv([headers.join(','), ...rows].join('\n'), 'soccer_goals');
    };

    const handleDownloadStats = () => {
        if (!orderedData.length) return;
        // Format: Display Jersey, Player Name, CAT1, CAT2, CAT3
        const headers = ['Jersey', 'Player Name', 'CAT1', 'CAT2', 'CAT3'];
        const rows = orderedData.map(r => {
            const stats = r.player?.stats;
            let c1 = '', c2 = '', c3 = '';
            if (stats) {
                const cats = 'g' in stats
                    ? getFieldPlayerCatStats(stats)
                    : getGoalieCatStats(stats);
                c1 = formatCatValue(cats[0].value, cats[0].label);
                c2 = formatCatValue(cats[1].value, cats[1].label);
                c3 = formatCatValue(cats[2].value, cats[2].label);
            }
            return [r.displayJersey, `"${r.player?.name || ''}"`, `"${c1}"`, `"${c2}"`, `"${c3}"`].join(',');
        });
        downloadCsv([headers.join(','), ...rows].join('\n'), 'soccer_stats');
    };


    const handleDownloadRawStats = () => {
        const rows: string[] = [];
        // Header with ALL PDF columns
        const headers = ['Jersey', 'Name', 'GP', 'G', 'A', 'PTS', 'SH', 'SH%', 'SOG', 'SOG%', 'YC-RC', 'GW', 'PK-A'];
        rows.push(headers.join(','));

        // Go from 1 to 99 in order
        for (let row = 1; row <= 99; row++) {
            const entry = orderedData.find(d => d.row === row);
            const displayJersey = row === 90 ? '0' : (row === 99 ? '00' : String(row));

            if (entry && entry.player && entry.player.stats) {
                const s = entry.player.stats;
                if ('g' in s) {
                    // Field player - use excelSafe for dash values
                    rows.push([displayJersey, `"${entry.player.name}"`, s.gp, s.g, s.a, s.pts, s.sh, excelSafe(s.shPct), s.sog, excelSafe(s.sogPct), excelSafe(`${s.yc}-${s.rc}`), s.gw, excelSafe(s.pkAtt)].join(','));
                } else {
                    // Goalie - different columns
                    rows.push([displayJersey, `"${entry.player.name}"`, s.gp, '', '', '', '', '', '', '', '', '', ''].join(','));
                }
            } else {
                // Empty row - still show display jersey
                rows.push([displayJersey, '', '', '', '', '', '', '', '', '', '', '', ''].join(','));
            }
        }
        downloadCsv(rows.join('\n'), 'soccer-raw-stats');
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
                        <Button
                            variant={copied && copiedType === 'Goals' ? 'default' : 'outline'}
                            size="sm"
                            onClick={handleCopyGoals}
                        >
                            <Copy className="h-4 w-4" />
                            {copied && copiedType === 'Goals' ? 'Copied!' : 'Goals'}
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
                                    const row = item as OrderedSoccerPlayer;
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
                                    <TableHead className="w-24">CAT1</TableHead>
                                    <TableHead className="w-24">CAT2</TableHead>
                                    <TableHead className="w-24">CAT3</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {displayRows.map((item) => {
                                    if (isGapRow(item)) {
                                        return (
                                            <TableRow key={`gap-${item.startRow}`} className="bg-muted/30 hover:bg-muted/30">
                                                <TableCell colSpan={5} className="py-2 text-center text-xs text-muted-foreground">
                                                    <MoreHorizontal className="inline h-4 w-4 mr-1" />
                                                    {item.count} empty rows ({item.startRow}–{item.startRow + item.count - 1})
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }
                                    const row = item as OrderedSoccerPlayer;
                                    const stats = row.player?.stats;
                                    let c1 = '', c2 = '', c3 = '';
                                    if (stats) {
                                        const cats = 'g' in stats
                                            ? getFieldPlayerCatStats(stats)
                                            : getGoalieCatStats(stats);
                                        c1 = formatCatValue(cats[0].value, cats[0].label);
                                        c2 = formatCatValue(cats[1].value, cats[1].label);
                                        c3 = formatCatValue(cats[2].value, cats[2].label);
                                    }
                                    return (
                                        <TableRow key={row.row} className={!row.player ? 'bg-muted/10' : undefined}>
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
