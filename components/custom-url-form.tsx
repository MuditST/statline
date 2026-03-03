'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { StatsPasteDialog } from '@/components/gtech-paste-dialog';
import type { SportType } from '@/types';

interface CustomUrlFormProps {
    schoolName: string;
    rosterUrl: string;
    statsUrl: string;
    platform: 'sidearm' | 'wmt' | 'hybrid';
    sport: SportType;
    pastedStats: string;
    onSchoolNameChange: (value: string) => void;
    onRosterUrlChange: (value: string) => void;
    onStatsUrlChange: (value: string) => void;
    onPlatformChange: (value: 'sidearm' | 'wmt' | 'hybrid') => void;
    onPastedStatsChange: (value: string) => void;
}

/**
 * Form for entering custom roster and stats URLs.
 *
 * Platform tabs:
 * - Sidearm (default): roster URL + stats PDF URL
 * - WMT: roster URL + stats/API URL
 * - Hybrid: roster URL + paste stats (no stats URL needed)
 */
export function CustomUrlForm({
    schoolName,
    rosterUrl,
    statsUrl,
    platform,
    sport,
    pastedStats,
    onSchoolNameChange,
    onRosterUrlChange,
    onStatsUrlChange,
    onPlatformChange,
    onPastedStatsChange,
}: CustomUrlFormProps) {
    const isHybrid = platform === 'hybrid';
    const isWmt = platform === 'wmt';

    // Determine available platforms based on sport
    const hasWmt = sport === 'baseball' || sport === 'softball'
        || sport === 'womens-volleyball'
        || sport === 'mens-basketball' || sport === 'womens-basketball';
    const hasHybrid = sport === 'baseball' || sport === 'softball';
    const showTabs = hasWmt || hasHybrid;

    return (
        <div className="space-y-4">
            {/* School Name + Platform Tabs — single row */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="school-name" className="text-sm text-muted-foreground">
                            School Name
                        </Label>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Optional. If provided, this school will be saved for future use.</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    {showTabs && (
                        <Tabs
                            value={platform}
                            onValueChange={(v) => onPlatformChange(v as 'sidearm' | 'wmt' | 'hybrid')}
                        >
                            <TabsList className="h-7">
                                <TabsTrigger value="sidearm" className="text-xs px-2.5 py-1 h-5">
                                    Sidearm
                                </TabsTrigger>
                                {hasWmt && (
                                    <TabsTrigger value="wmt" className="text-xs px-2.5 py-1 h-5">
                                        WMT
                                    </TabsTrigger>
                                )}
                                {hasHybrid && (
                                    <TabsTrigger value="hybrid" className="text-xs px-2.5 py-1 h-5">
                                        Hybrid
                                    </TabsTrigger>
                                )}
                            </TabsList>
                        </Tabs>
                    )}
                </div>
                <Input
                    id="school-name"
                    placeholder="School Name (optional)"
                    value={schoolName}
                    onChange={(e) => onSchoolNameChange(e.target.value)}
                />
            </div>

            {/* Roster URL */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Label htmlFor="roster-url" className="text-sm text-muted-foreground">
                        Roster URL
                    </Label>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                            {isWmt ? (
                                <p>Go to the school&apos;s roster page and copy the URL.</p>
                            ) : isHybrid ? (
                                <p>Go to the school&apos;s roster page and copy the URL.</p>
                            ) : (
                                <p>Go to the school&apos;s roster page, click Print, and copy the URL</p>
                            )}
                        </TooltipContent>
                    </Tooltip>
                </div>
                <Input
                    id="roster-url"
                    placeholder={isWmt || isHybrid
                        ? 'https://school.com/sports/sport/roster'
                        : 'https://school.com/sports/sport/roster?print=true'
                    }
                    value={rosterUrl}
                    onChange={(e) => onRosterUrlChange(e.target.value)}
                />
            </div>

            {/* Stats URL (Sidearm/WMT only) or Paste Dialog (Hybrid) */}
            {isHybrid ? (
                <StatsPasteDialog
                    sport={sport}
                    pastedStats={pastedStats}
                    onStatsChange={onPastedStatsChange}
                />
            ) : (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="stats-url" className="text-sm text-muted-foreground">
                            {isWmt ? 'Stats / API URL' : 'Stats URL'}
                        </Label>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                                {isWmt ? (
                                    <p>Paste the stats page URL or the direct WMT API URL (e.g. api.wmt.games/api/statistics/teams/609508/players)</p>
                                ) : (
                                    <p>Go to the school&apos;s stats page, click View PDF, then view fullscreen and copy the URL</p>
                                )}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <Input
                        id="stats-url"
                        placeholder={isWmt
                            ? 'Stats page URL or api.wmt.games/api/statistics/teams/.../players'
                            : 'https://s3.amazonaws.com/sidearm.sites/school.com/stats/sport/year/pdf/cume.pdf'
                        }
                        value={statsUrl}
                        onChange={(e) => onStatsUrlChange(e.target.value)}
                    />
                </div>
            )}
        </div>
    );
}
