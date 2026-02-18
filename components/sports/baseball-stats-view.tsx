'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupText, ButtonGroupSeparator } from '@/components/ui/button-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatsTable } from '@/components/stats-table';
import { RosterTable } from '@/components/roster-table';
import { Copy, Download } from 'lucide-react';
import type { StatsViewProps } from '@/lib/sports/types';
import type { BattingRaw, PitchingRaw, PlayerStats } from '@/lib/parsers/baseball';
import { mergeBaseballStats } from '@/lib/parsers/baseball';
import { downloadCsv, excelSafe } from '@/lib/utils/export';
import { useCopyFeedback } from '@/lib/hooks/use-copy-feedback';

interface BaseballStatsViewProps extends StatsViewProps {
    statsData: { batting: BattingRaw[]; pitching: PitchingRaw[] } | PlayerStats[];
    sportName?: string;
}

export function BaseballStatsView({ roster, statsData, isLoading, sportName = 'baseball' }: BaseballStatsViewProps) {
    // WMT/GT return pre-merged PlayerStats[]; Sidearm returns { batting, pitching }
    const mergedStats = useMemo(
        () => Array.isArray(statsData)
            ? statsData
            : mergeBaseballStats(roster, statsData?.batting ?? [], statsData?.pitching ?? []),
        [roster, statsData]
    );
    const [activeTab, setActiveTab] = useState<'roster' | 'stats'>('roster');
    const { copied, copiedType, copyWithFeedback } = useCopyFeedback();

    const hasData = roster.length > 0;

    // Copy all stats with headers
    const handleCopyAllStats = async () => {
        if (mergedStats.length === 0) return;

        const headers = ['#', 'Name', 'AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'HBP', 'SO', 'GDP', 'SF', 'SH', 'SB', 'CS', 'W', 'L', 'G', 'GS', 'CG', 'SHO', 'SV', 'IP', 'H', 'R', 'ER', 'BB', 'SO', 'HR', 'HBP'];
        const rows = mergedStats.map(p => [
            p.number, p.name, p.ab, p.r, p.h, p.doubles, p.triples, p.hr, p.rbi, p.bb, p.hbp, p.so, p.gdp, p.sf, p.sh, p.sb, p.cs,
            p.w, p.l, p.g, p.gs, p.cg, p.sho, p.sv, p.ip, p.h_pitch, p.r_pitch, p.er, p.bb_pitch, p.so_pitch, p.hr_pitch, p.hbp_pitch
        ].join('\t'));

        const text = [headers.join('\t'), ...rows].join('\n');
        await copyWithFeedback(text, 'All');
    };

    // Copy batting stats only
    const handleCopyBatting = async () => {
        if (mergedStats.length === 0) return;

        const rows = mergedStats.map(p => [
            p.ab, p.r, p.h, p.doubles, p.triples, p.hr, p.rbi, p.bb, p.hbp, p.so, p.gdp, p.sf, p.sh, p.sb, p.cs
        ].join('\t'));

        await copyWithFeedback(rows.join('\n'), 'Batting');
    };

    // Copy pitching stats only
    const handleCopyPitching = async () => {
        if (mergedStats.length === 0) return;

        const rows = mergedStats.map(p => [
            p.w, p.l, p.g, p.gs, p.cg, p.sho, p.sv, p.ip, p.h_pitch, p.r_pitch, p.er, p.bb_pitch, p.so_pitch, p.hr_pitch, p.hbp_pitch
        ].join('\t'));

        await copyWithFeedback(rows.join('\n'), 'Pitching');
    };

    // Copy roster - data only, no headers
    const handleCopyRoster = async () => {
        if (roster.length === 0) return;

        const rows = roster.map(p => {
            const city = p.state ? p.hometown.replace(new RegExp(`,?\\s*${p.state}$`), '') : p.hometown;
            return [
                p.lastName, p.firstName, p.number, p.position, p.bats, p.throws, city, p.state, p.height, p.weight, p.year
            ].join('\t');
        });

        await copyWithFeedback(rows.join('\n'), 'Roster');
    };

    // Download stats as CSV
    const handleDownloadStats = () => {
        if (mergedStats.length === 0) return;

        const headers = ['#', 'Name', 'AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'HBP', 'SO', 'GDP', 'SF', 'SH', 'SB', 'CS', 'W', 'L', 'G', 'GS', 'CG', 'SHO', 'SV', 'IP', 'H', 'R', 'ER', 'BB', 'SO', 'HR', 'HBP'];
        const rows = mergedStats.map(p => [
            p.number, `"${p.name}"`, p.ab, p.r, p.h, p.doubles, p.triples, p.hr, p.rbi, p.bb, p.hbp, p.so, p.gdp, p.sf, p.sh, p.sb, p.cs,
            p.w, p.l, p.g, p.gs, p.cg, excelSafe(p.sho), p.sv, excelSafe(p.ip), p.h_pitch, p.r_pitch, p.er, p.bb_pitch, p.so_pitch, p.hr_pitch, p.hbp_pitch
        ].join(','));

        const csv = [headers.join(','), ...rows].join('\n');
        downloadCsv(csv, `${sportName}_stats`);
    };

    // Download roster as CSV — same columns as copy roster but with headers
    const handleDownloadRoster = () => {
        if (roster.length === 0) return;

        const headers = ['Last Name', 'First Name', '#', 'Pos', 'Bats', 'Throws', 'Hometown', 'State', 'Height', 'Weight', 'Year'];
        const rows = roster.map(p => {
            const city = p.state ? p.hometown.replace(new RegExp(`,?\\s*${p.state}$`), '') : p.hometown;
            return [
                `"${p.lastName}"`, `"${p.firstName}"`, p.number, p.position, p.bats, p.throws, `"${city}"`, p.state, p.height, p.weight, p.year
            ].join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        downloadCsv(csv, `${sportName}_roster`);
    };

    if (!hasData) return null;

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
                {activeTab === 'stats' ? (
                    <ButtonGroup>
                        <ButtonGroupText className="text-sm">
                            Export
                        </ButtonGroupText>
                        <Button
                            variant={copied && copiedType === 'All' ? 'default' : 'outline'}
                            size="sm"
                            onClick={handleCopyAllStats}
                        >
                            <Copy className="h-4 w-4" />
                            {copied && copiedType === 'All' ? 'Copied!' : 'All Stats'}
                        </Button>
                        <Button
                            variant={copied && copiedType === 'Batting' ? 'default' : 'outline'}
                            size="sm"
                            onClick={handleCopyBatting}
                        >
                            <Copy className="h-4 w-4" />
                            {copied && copiedType === 'Batting' ? 'Copied!' : 'Batting'}
                        </Button>
                        <Button
                            variant={copied && copiedType === 'Pitching' ? 'default' : 'outline'}
                            size="sm"
                            onClick={handleCopyPitching}
                        >
                            <Copy className="h-4 w-4" />
                            {copied && copiedType === 'Pitching' ? 'Copied!' : 'Pitching'}
                        </Button>
                        <ButtonGroupSeparator />
                        <Button size="sm" variant="outline" onClick={handleDownloadStats}>
                            <Download className="h-4 w-4" />
                            Csv
                        </Button>
                    </ButtonGroup>
                ) : (
                    <ButtonGroup>
                        <ButtonGroupText className="text-sm">
                            Export
                        </ButtonGroupText>
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
            </div>

            <TabsContent value="roster" className="mt-0">
                <RosterTable data={roster} isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="stats" className="mt-0">
                <StatsTable data={mergedStats} isLoading={isLoading} />
            </TabsContent>
        </Tabs>
    );
}
