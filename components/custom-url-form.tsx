'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface CustomUrlFormProps {
    schoolName: string;
    rosterUrl: string;
    statsUrl: string;
    platform: 'sidearm' | 'wmt';
    onSchoolNameChange: (value: string) => void;
    onRosterUrlChange: (value: string) => void;
    onStatsUrlChange: (value: string) => void;
    onPlatformChange: (value: 'sidearm' | 'wmt') => void;
}

/**
 * Form for entering custom roster and stats URLs
 */
export function CustomUrlForm({
    schoolName,
    rosterUrl,
    statsUrl,
    platform,
    onSchoolNameChange,
    onRosterUrlChange,
    onStatsUrlChange,
    onPlatformChange,
}: CustomUrlFormProps) {
    const isWmt = platform === 'wmt';

    return (
        <div className="space-y-4">
            {/* School Name + Platform Toggle — single row */}
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
                    {/* Compact platform toggle */}
                    <div className="flex items-center gap-2">
                        <Label htmlFor="wmt-toggle" className="text-xs text-muted-foreground">
                            WMT
                        </Label>
                        <Switch
                            id="wmt-toggle"
                            checked={isWmt}
                            onCheckedChange={(checked) => onPlatformChange(checked ? 'wmt' : 'sidearm')}
                        />
                    </div>
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
                            ) : (
                                <p>Go to the school&apos;s roster page, click Print, and copy the URL</p>
                            )}
                        </TooltipContent>
                    </Tooltip>
                </div>
                <Input
                    id="roster-url"
                    placeholder={isWmt
                        ? 'https://school.com/sports/sport/roster'
                        : 'https://school.com/sports/sport/roster?print=true'
                    }
                    value={rosterUrl}
                    onChange={(e) => onRosterUrlChange(e.target.value)}
                />
            </div>

            {/* Stats URL */}
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
        </div>
    );
}
