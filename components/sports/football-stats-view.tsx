'use client';

import { useState, useMemo } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText, ButtonGroupSeparator } from '@/components/ui/button-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Download, MoreHorizontal } from 'lucide-react';
import { StatsTableSkeleton } from '@/components/stats-table-skeleton';
import type { StatsViewProps } from '@/lib/sports/types';
import { createOrderedFootballRoster, OrderedFootballPlayer } from '@/lib/football/ordering';
import {
    FootballPlayerRaw,
    FootballPassingStats,
    FootballRushingStats,
    FootballReceivingStats,
    FootballDefensiveStats,
    FootballKickingStats,
    FootballPuntingStats
} from '@/lib/parsers/football';
import { getFootballCatStats, formatCatValue, CatStat } from '@/lib/football/cat-stats';
import { downloadCsv } from '@/lib/utils/export';
import { useCopyFeedback } from '@/lib/hooks/use-copy-feedback';

type TabType = 'roster' | 'stats';

/**
 * Create display rows for a category, collapsing 5+ empty rows
 */
function createDisplayRows(
    orderedPlayers: OrderedFootballPlayer[],
    filterFn: (p: OrderedFootballPlayer) => boolean
): (OrderedFootballPlayer | { type: 'gap'; count: number; startSlot: number })[] {
    const display: (OrderedFootballPlayer | { type: 'gap'; count: number; startSlot: number })[] = [];

    // Build map of occupied slots for players who pass the filter
    const occupiedSlots = new Map<number, OrderedFootballPlayer>();
    orderedPlayers
        .filter(p => p.slot >= 1 && filterFn(p))
        .forEach(p => occupiedSlots.set(p.slot, p));

    let gapStart = -1;
    let gapCount = 0;

    for (let slot = 1; slot <= 99; slot++) {
        const player = occupiedSlots.get(slot);

        if (!player) {
            if (gapStart === -1) {
                gapStart = slot;
                gapCount = 1;
            } else {
                gapCount++;
            }
        } else {
            // Flush gap
            if (gapCount > 0) {
                if (gapCount >= 5) {
                    display.push({ type: 'gap', count: gapCount, startSlot: gapStart });
                } else {
                    for (let i = 0; i < gapCount; i++) {
                        // Show slot number even for empty rows 
                        const slotNum = gapStart + i;
                        let displayJersey = String(slotNum);
                        if (slotNum === 90) displayJersey = '0';
                        if (slotNum === 99) displayJersey = '00';
                        display.push({
                            slot: slotNum,
                            display: displayJersey,
                            name: '',
                            jersey: displayJersey,
                            height: '',
                            weight: '',
                            year: '',
                            hometown: '',
                            position: ''
                        });
                    }
                }
                gapStart = -1;
                gapCount = 0;
            }
            display.push(player);
        }
    }

    // Final gap
    if (gapCount >= 5) {
        display.push({ type: 'gap', count: gapCount, startSlot: gapStart });
    } else if (gapCount > 0) {
        for (let i = 0; i < gapCount; i++) {
            display.push({
                slot: gapStart + i,
                display: '',
                name: '',
                jersey: '',
                height: '',
                weight: '',
                year: '',
                hometown: '',
                position: ''
            });
        }
    }

    return display;
}

export function FootballStatsView({ roster, statsData, isLoading }: StatsViewProps) {
    const [activeTab, setActiveTab] = useState<TabType>('roster');
    const { copied, copiedType, copyWithFeedback } = useCopyFeedback();

    // Process Data
    const orderedPlayers = useMemo(() => {
        if (!statsData || !statsData.players) return [];
        const mappedRoster = roster.map(p => ({
            ...p,
            jersey: p.number,
            name: `${p.firstName} ${p.lastName}`
        }));
        return createOrderedFootballRoster(mappedRoster, statsData.players as FootballPlayerRaw[]);
    }, [roster, statsData]);

    // Create display rows for roster (all players) and stats (players with any stats)
    const rosterDisplayRows = useMemo(() => createDisplayRows(orderedPlayers, () => true), [orderedPlayers]);
    const statsDisplayRows = useMemo(() => createDisplayRows(orderedPlayers, (p) => !!p.stats), [orderedPlayers]);

    // Inactive players for roster tab
    const inactivePlayers = useMemo(() =>
        orderedPlayers.filter(p => p.slot === -1), [orderedPlayers]);

    const hasData = roster.length > 0;

    // Helper to get 4 stats for a player (with priority-based category selection)
    // Condenses: filters out empty/zero stats so non-empty stats appear first
    const getPlayerStats = (player: OrderedFootballPlayer): { stats: CatStat[]; category: string } => {
        if (!player.stats) return { stats: [], category: '' };
        const catStats = getFootballCatStats(player.stats);

        // Filter out empty/zero stats - condense left so all values are first
        const nonEmpty = catStats.stats.filter(s => {
            // Skip if no label
            if (!s.label || s.label === '') return false;

            // Skip if value is undefined, null, or empty string
            if (s.value === undefined || s.value === null || s.value === '') return false;

            // Skip if value is a dash (no data indicator)
            if (s.value === '-' || s.value === '—' || s.value === '–') return false;

            // Skip if value is zero (number or string)
            if (s.value === 0 || s.value === '0') return false;

            // Skip patterns like "0-0", "0.0", "0.00" 
            const strVal = String(s.value).trim();
            if (/^0([.\-\/]0+)?$/.test(strVal)) return false;

            return true;
        });

        // Pad to exactly 4 stats (condensed left, empty at end)
        const result: CatStat[] = [];
        for (let i = 0; i < 4; i++) {
            result.push(nonEmpty[i] || { label: '', value: '' });
        }

        return { stats: result, category: catStats.category };
    };

    // Copy Roster handler - ALL 99 rows, empty rows show slot number as jersey
    const handleCopyRoster = async () => {
        // Build a map of slot -> player for quick lookup
        const playerBySlot = new Map<number, OrderedFootballPlayer>();
        orderedPlayers.filter(p => p.slot >= 1 && p.slot <= 99).forEach(p => {
            playerBySlot.set(p.slot, p);
        });

        // Generate all 99 rows
        const rows: string[] = [];
        for (let slot = 1; slot <= 99; slot++) {
            const player = playerBySlot.get(slot);
            if (player && player.name) {
                const nameParts = player.name.split(' ');
                rows.push([
                    player.display,
                    nameParts[0] || '',
                    nameParts.slice(1).join(' ') || '',
                    player.position,
                    player.height,
                    player.weight,
                    player.hometown,
                    player.year
                ].join('\t'));
            } else {
                // Empty row - jersey = slot number (converted for 0/00)
                let displayJersey = String(slot);
                if (slot === 90) displayJersey = '0';
                if (slot === 99) displayJersey = '00';
                rows.push([displayJersey, '', '', '', '', '', '', ''].join('\t'));
            }
        }

        // Add blank row then inactive players
        if (inactivePlayers.length > 0) {
            rows.push(''); // blank separator
            inactivePlayers.forEach(p => {
                const nameParts = p.name.split(' ');
                rows.push([
                    p.display,
                    nameParts[0] || '',
                    nameParts.slice(1).join(' ') || '',
                    p.position,
                    p.height,
                    p.weight,
                    p.hometown,
                    p.year
                ].join('\t'));
            });
        }

        await copyWithFeedback(rows.join('\n'), 'Roster');
    };

    // Copy Stats handler - 1-99 order with jersey/name from roster, then STAT1-4 with blank columns
    const handleCopyStats = async () => {
        // Build slot lookup
        const playerBySlot = new Map<number, OrderedFootballPlayer>();
        orderedPlayers.filter(p => p.slot >= 1 && p.slot <= 99).forEach(p => {
            playerBySlot.set(p.slot, p);
        });

        const rows: string[] = [];
        for (let slot = 1; slot <= 99; slot++) {
            const player = playerBySlot.get(slot);
            if (player && player.name) {
                const { stats } = getPlayerStats(player);
                const statValues: string[] = [];
                for (let i = 0; i < 4; i++) {
                    const s = stats[i];
                    statValues.push(formatCatValue(s?.value, s?.label));
                    if (i < 3) statValues.push(''); // blank column after each except last
                }
                rows.push(statValues.join('\t'));
            } else {
                // Empty row — 7 empty tab-separated cols (4 stats + 3 blanks)
                rows.push(['', '', '', '', '', '', ''].join('\t'));
            }
        }
        await copyWithFeedback(rows.join('\n'), 'Stats');
    };

    // Download Roster CSV - with headers, includes # column (1-99, blank row, -1 for inactive)
    const handleDownloadRoster = () => {
        const headers = ['#', 'Jersey', 'First Name', 'Last Name', 'POS', 'Height', 'Weight', 'Hometown', 'Year'];
        const rows: string[] = [headers.join(',')];

        // Active players (slots 1-99)
        orderedPlayers
            .filter(p => p.slot >= 1)
            .forEach(p => {
                const nameParts = p.name.split(' ');
                rows.push([
                    p.slot,
                    p.display,
                    `"${nameParts[0] || ''}"`,
                    `"${nameParts.slice(1).join(' ') || ''}"`,
                    p.position,
                    p.height,
                    p.weight,
                    `"${p.hometown}"`,
                    p.year
                ].join(','));
            });

        // Blank row then inactive players
        if (inactivePlayers.length > 0) {
            rows.push(Array(9).fill('').join(',')); // empty row
            inactivePlayers.forEach(p => {
                const nameParts = p.name.split(' ');
                rows.push([
                    -1,
                    p.display,
                    `"${nameParts[0] || ''}"`,
                    `"${nameParts.slice(1).join(' ') || ''}"`,
                    p.position,
                    p.height,
                    p.weight,
                    `"${p.hometown}"`,
                    p.year
                ].join(','));
            });
        }

        downloadCsv(rows.join('\n'), 'football-roster');
    };

    // Download Stats CSV - 1-99 order with jersey/name, then category + stats
    const handleDownloadStats = () => {
        const headers = ['#', 'Jersey', 'Name', 'Category', 'STAT1', 'STAT2', 'STAT3', 'STAT4'];
        const rows: string[] = [headers.join(',')];

        // Build slot lookup
        const playerBySlot = new Map<number, OrderedFootballPlayer>();
        orderedPlayers.filter(p => p.slot >= 1 && p.slot <= 99).forEach(p => {
            playerBySlot.set(p.slot, p);
        });

        for (let slot = 1; slot <= 99; slot++) {
            const p = playerBySlot.get(slot);
            if (p && p.name) {
                const { stats, category } = getPlayerStats(p);
                rows.push([
                    slot,
                    csvSafe(p.display),
                    `"${p.name}"`,
                    p.stats ? category : '',
                    ...stats.map(s => `"${csvSafe(formatCatValue(s?.value, s?.label))}"`)
                ].join(','));
            } else {
                rows.push([slot, '', '', '', '', '', '', ''].join(','));
            }
        }
        downloadCsv(rows.join('\n'), 'football-stats');
    };

    // Helper to sanitize values for CSV - handles em-dashes and Excel date prevention
    const csvSafe = (val: string | number | undefined): string => {
        if (val === undefined || val === null || val === '') return '';
        let s = String(val);
        // Em-dash and en-dash represent "no value" in the source data - replace with empty
        if (s === '—' || s === '–' || s === '\u2014' || s === '\u2013') return '';
        // Replace any remaining em-dashes/en-dashes with regular dashes
        s = s.replace(/[\u2013\u2014]/g, '-');
        // If the value contains a dash (like 0-1, 2.0-3), prefix with tab to prevent Excel date interpretation
        if (s.includes('-') && /\d/.test(s)) {
            return `\t${s}`;
        }
        return s;
    };

    // Download Raw Stats - master table with ALL columns from all categories - shows ALL players
    const handleDownloadRaw = () => {
        const headers = [
            '#', 'Jersey', 'Name',
            // Passing
            'PASS_COMP', 'PASS_ATT', 'PASS_PCT', 'PASS_YDS', 'PASS_TD', 'PASS_INT', 'PASS_LONG',
            // Rushing
            'RUSH_ATT', 'RUSH_GAIN', 'RUSH_LOSS', 'RUSH_NET', 'RUSH_AVG', 'RUSH_TD', 'RUSH_LONG',
            // Receiving
            'REC_NO', 'REC_YDS', 'REC_AVG', 'REC_TD', 'REC_LONG',
            // Defense
            'DEF_TOT', 'DEF_SOLO', 'DEF_ASST', 'DEF_TFL', 'DEF_SACKS', 'DEF_INT', 'DEF_PBU', 'DEF_QBH', 'DEF_FF', 'DEF_FR',
            // Kicking
            'KICK_FGM', 'KICK_FGA', 'KICK_PCT', 'KICK_LONG', 'KICK_PAT', 'KICK_PTS',
            // Punting
            'PUNT_NO', 'PUNT_YDS', 'PUNT_AVG', 'PUNT_LONG', 'PUNT_TB', 'PUNT_I20'
        ];

        const rows: string[] = [headers.join(',')];

        for (let slot = 1; slot <= 99; slot++) {
            const p = orderedPlayers.find(pl => pl.slot === slot);
            if (p) {
                const s = p.stats;
                const pass: Partial<FootballPassingStats> = s?.passing || {};
                const rush: Partial<FootballRushingStats> = s?.rushing || {};
                const rec: Partial<FootballReceivingStats> = s?.receiving || {};
                const def: Partial<FootballDefensiveStats> = s?.defense || {};
                const kick: Partial<FootballKickingStats> = s?.kicking || {};
                const punt: Partial<FootballPuntingStats> = s?.punting || {};

                // Calculate pass percentage safely
                const passPct = pass.comp !== undefined && pass.att !== undefined && pass.att > 0
                    ? ((pass.comp / pass.att) * 100).toFixed(1)
                    : '';

                rows.push([
                    slot,
                    csvSafe(p.display),
                    `"${p.name}"`,
                    // Passing
                    pass.comp ?? '', pass.att ?? '', passPct,
                    pass.yds ?? '', pass.td ?? '', pass.int ?? '', pass.long ?? '',
                    // Rushing
                    rush.att ?? '', rush.gain ?? '', rush.loss ?? '', rush.net ?? '', rush.avg ?? '', rush.td ?? '', rush.long ?? '',
                    // Receiving
                    rec.no ?? '', rec.yds ?? '', rec.avg ?? '', rec.td ?? '', rec.long ?? '',
                    // Defense
                    def.tot ?? '', def.solo ?? '', def.asst ?? '', csvSafe(def.tfl), csvSafe(def.sacks),
                    csvSafe(def.int), def.pbu ?? '', def.qbh ?? '', def.ff ?? '', csvSafe(def.fr),
                    // Kicking
                    kick.fgm ?? '', kick.fga ?? '', kick.pct ?? '', kick.long ?? '', csvSafe(kick.pat), kick.pts ?? '',
                    // Punting
                    punt.no ?? '', punt.yds ?? '', punt.avg ?? '', punt.long ?? '', punt.tb ?? '', punt.i20 ?? ''
                ].join(','));
            } else {
                // Empty row - no player at this slot
                rows.push([slot, '', '', ...Array(headers.length - 3).fill('')].join(','));
            }
        }

        downloadCsv(rows.join('\n'), 'football-raw-stats');
    };

    if (!hasData && !isLoading) return null;

    // Render a gap row
    const renderGapRow = (item: { type: 'gap'; count: number; startSlot: number }, colSpan: number, keyPrefix: string) => (
        <TableRow key={`${keyPrefix}-gap-${item.startSlot}`} className="bg-muted/30 hover:bg-muted/30">
            <TableCell colSpan={colSpan} className="py-2 text-center text-xs text-muted-foreground">
                <MoreHorizontal className="inline h-4 w-4 mr-1" />
                {item.count} empty rows ({item.startSlot}–{item.startSlot + item.count - 1})
            </TableCell>
        </TableRow>
    );

    // Render empty row for roster (with # column to prevent collapse)
    const renderEmptyRosterRow = (slot: number, colSpan: number, keyPrefix: string) => {
        // Convert slot to display jersey
        let displayJersey = String(slot);
        if (slot === 90) displayJersey = '0';
        if (slot === 99) displayJersey = '00';
        return (
            <TableRow key={`${keyPrefix}-empty-${slot}`} className="bg-muted/10">
                <TableCell className="py-1 font-mono text-xs text-muted-foreground">{slot}</TableCell>
                <TableCell className="py-1 font-bold">{displayJersey}</TableCell>
                <TableCell className="py-1" colSpan={colSpan - 2}></TableCell>
            </TableRow>
        );
    };

    // Render empty row for stats (with # column)
    const renderEmptyStatsRow = (slot: number, colSpan: number, keyPrefix: string) => (
        <TableRow key={`${keyPrefix}-empty-${slot}`} className="bg-muted/10">
            <TableCell className="py-1 font-mono text-xs text-muted-foreground">{slot}</TableCell>
            <TableCell className="py-1" colSpan={colSpan - 1}></TableCell>
        </TableRow>
    );

    return (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
            {/* Tabs */}
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
                        <Button size="sm" variant="outline" onClick={handleDownloadRaw}>
                            <Download className="h-4 w-4" />
                            Raw
                        </Button>
                    </ButtonGroup>
                )}
            </div>

            {/* Roster Tab - no # column */}
            <TabsContent value="roster" className="mt-0">
                {isLoading ? <StatsTableSkeleton /> : (
                    <div className="overflow-auto border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead className="w-16">Jersey</TableHead>
                                    <TableHead>First Name</TableHead>
                                    <TableHead>Last Name</TableHead>
                                    <TableHead>POS</TableHead>
                                    <TableHead>Height</TableHead>
                                    <TableHead>Weight</TableHead>
                                    <TableHead>Hometown</TableHead>
                                    <TableHead>Year</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rosterDisplayRows.map((item) => {
                                    if ('type' in item && item.type === 'gap') {
                                        return renderGapRow(item, 9, 'roster');
                                    }
                                    const player = item as OrderedFootballPlayer;
                                    if (!player.name) return renderEmptyRosterRow(player.slot, 9, 'roster');
                                    const nameParts = player.name.split(' ');
                                    return (
                                        <TableRow key={`roster-${player.slot}`}>
                                            <TableCell className="py-1 font-mono text-xs text-muted-foreground">{player.slot}</TableCell>
                                            <TableCell className="py-1 font-bold">{player.display}</TableCell>
                                            <TableCell className="py-1">{nameParts[0]}</TableCell>
                                            <TableCell className="py-1">{nameParts.slice(1).join(' ')}</TableCell>
                                            <TableCell className="py-1">{player.position}</TableCell>
                                            <TableCell className="py-1">{player.height}</TableCell>
                                            <TableCell className="py-1">{player.weight}</TableCell>
                                            <TableCell className="py-1">{player.hometown}</TableCell>
                                            <TableCell className="py-1">{player.year}</TableCell>
                                        </TableRow>
                                    );
                                })}
                                {/* Inactive section */}
                                {inactivePlayers.length > 0 && (
                                    <>
                                        <TableRow className="bg-red-50">
                                            <TableCell colSpan={9} className="text-center text-red-600 font-medium py-2">
                                                Inactive Players (No Stats / Duplicate)
                                            </TableCell>
                                        </TableRow>
                                        {inactivePlayers.map((player, idx) => {
                                            const nameParts = player.name.split(' ');
                                            return (
                                                <TableRow key={`inactive-${idx}`} className="bg-red-50/50">
                                                    <TableCell className="py-1 font-bold">{player.display}</TableCell>
                                                    <TableCell className="py-1">{nameParts[0]}</TableCell>
                                                    <TableCell className="py-1">{nameParts.slice(1).join(' ')}</TableCell>
                                                    <TableCell className="py-1">{player.position}</TableCell>
                                                    <TableCell className="py-1">{player.height}</TableCell>
                                                    <TableCell className="py-1">{player.weight}</TableCell>
                                                    <TableCell className="py-1">{player.hometown}</TableCell>
                                                    <TableCell className="py-1">{player.year}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </TabsContent>

            {/* Stats Tab - with # column */}
            <TabsContent value="stats" className="mt-0">
                {isLoading ? <StatsTableSkeleton /> : (
                    <div className="overflow-auto border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead className="w-16">Jersey</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="w-28">STAT1</TableHead>
                                    <TableHead className="w-28">STAT2</TableHead>
                                    <TableHead className="w-28">STAT3</TableHead>
                                    <TableHead className="w-28">STAT4</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {statsDisplayRows.map((item) => {
                                    if ('type' in item && item.type === 'gap') {
                                        return renderGapRow(item, 7, 'stats');
                                    }
                                    const player = item as OrderedFootballPlayer;
                                    if (!player.name || !player.stats) return renderEmptyStatsRow(player.slot, 7, 'stats');

                                    const { stats } = getPlayerStats(player);

                                    return (
                                        <TableRow key={`stats-${player.slot}`}>
                                            <TableCell className="py-1 font-mono text-xs text-muted-foreground">{player.slot}</TableCell>
                                            <TableCell className="py-1 font-bold">{player.display}</TableCell>
                                            <TableCell className="py-1">{player.name}</TableCell>
                                            {stats.map((s, i) => (
                                                <TableCell key={i} className="py-1 text-xs">
                                                    {formatCatValue(s?.value, s?.label)}
                                                </TableCell>
                                            ))}
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
