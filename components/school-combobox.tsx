'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { SchoolInfoPopover } from '@/components/school-info-popover';
import { getSchoolsBySport, getSchoolById, type SchoolConfig } from '@/config/schools';
import { getSavedSchools, getSavedSchool, deleteSchool, type SavedSchool } from '@/lib/storage/schools';
import { generateRosterUrls, generateStatsUrls } from '@/lib/url/generator';
import type { SportType } from '@/types';

interface MergedSchool {
    id: string;
    name: string;
    isCustomized: boolean;
    isCustomOnly: boolean; // Not in config, only in localStorage
    rosterUrl: string;
    statsUrl: string;
    platform?: 'gtech' | 'wmt';
}

interface SchoolComboboxProps {
    value: string;
    onValueChange: (value: string) => void;
    sport: SportType;
    onEditSchool?: (school: { name: string; rosterUrl: string; statsUrl: string }) => void;
    onSchoolDeleted?: () => void;
}

export function SchoolCombobox({
    value,
    onValueChange,
    sport,
    onEditSchool,
    onSchoolDeleted,
}: SchoolComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [width, setWidth] = React.useState(0);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const [refreshKey, setRefreshKey] = React.useState(0);

    // Get config and saved schools, merge them
    const mergedSchools = React.useMemo(() => {
        const configSchools = getSchoolsBySport(sport);
        const savedSchools = getSavedSchools(sport);

        const merged: MergedSchool[] = [];

        // First, add config schools (potentially with overrides)
        for (const config of configSchools) {
            const saved = savedSchools.find(s => s.id === config.id);

            if (saved) {
                // Has custom override
                merged.push({
                    id: config.id,
                    name: config.name,
                    isCustomized: true,
                    isCustomOnly: false,
                    rosterUrl: saved.rosterUrl,
                    statsUrl: saved.statsUrl,
                    platform: saved.platform || config.platform,
                });
            } else {
                // Use config URLs — for WMT/GT schools, use the overrides from config
                // rather than auto-generating Sidearm URLs
                const rosterUrl = config.rosterUrls?.[sport]
                    || generateRosterUrls(config.domain, sport)[0] || '';

                let statsUrl: string;
                if (config.platform === 'wmt' && config.wmtTeamId?.[sport]) {
                    statsUrl = `https://api.wmt.games/api/statistics/teams/${config.wmtTeamId[sport]}/players`;
                } else if (config.statsUrls?.[sport]) {
                    statsUrl = config.statsUrls[sport]!;
                } else {
                    statsUrl = generateStatsUrls(config.sidearmDomain, sport, config.s3Region)[0] || '';
                }

                merged.push({
                    id: config.id,
                    name: config.name,
                    isCustomized: false,
                    isCustomOnly: false,
                    rosterUrl,
                    statsUrl,
                    platform: config.platform,
                });
            }
        }

        // Then, add custom-only schools (not in config)
        for (const saved of savedSchools) {
            const existsInConfig = configSchools.some(c => c.id === saved.id);
            if (!existsInConfig) {
                merged.push({
                    id: saved.id,
                    name: saved.name,
                    isCustomized: true,
                    isCustomOnly: true,
                    rosterUrl: saved.rosterUrl,
                    statsUrl: saved.statsUrl,
                    platform: saved.platform,
                });
            }
        }

        // Sort alphabetically
        return merged.sort((a, b) => a.name.localeCompare(b.name));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sport, refreshKey]);

    const selectedSchool = mergedSchools.find((s) => s.id === value);

    // Measure trigger width when popover opens
    React.useEffect(() => {
        if (open && triggerRef.current) {
            setWidth(triggerRef.current.offsetWidth);
        }
    }, [open]);

    // Reset selection if current school doesn't exist in merged list
    React.useEffect(() => {
        if (value && !mergedSchools.find(s => s.id === value)) {
            onValueChange('');
        }
    }, [sport, value, mergedSchools, onValueChange]);

    const handleEdit = () => {
        if (selectedSchool && onEditSchool) {
            onEditSchool({
                name: selectedSchool.name,
                rosterUrl: selectedSchool.rosterUrl,
                statsUrl: selectedSchool.statsUrl,
            });
        }
    };

    const handleDelete = () => {
        if (selectedSchool) {
            deleteSchool(selectedSchool.id, sport);
            // If it's custom-only, clear selection
            if (selectedSchool.isCustomOnly) {
                onValueChange('');
            }
            // Trigger refresh
            setRefreshKey(k => k + 1);
            onSchoolDeleted?.();
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        ref={triggerRef}
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="flex-1 justify-between font-normal"
                    >
                        <span className="flex items-center gap-2">
                            {selectedSchool?.name ?? 'Select a school...'}
                            {selectedSchool?.isCustomized && (
                                <span className="h-2 w-2 rounded-full bg-primary" title="Custom URLs" />
                            )}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="p-0"
                    style={{ width: width > 0 ? width : undefined }}
                >
                    <Command>
                        <CommandInput placeholder="Search schools..." />
                        <CommandList>
                            <CommandEmpty>
                                No schools found. Use the custom URL option to add one.
                            </CommandEmpty>
                            <CommandGroup>
                                {mergedSchools.map((school) => (
                                    <CommandItem
                                        key={school.id}
                                        value={school.name}
                                        onSelect={() => {
                                            onValueChange(school.id);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                'mr-2 h-4 w-4',
                                                value === school.id ? 'opacity-100' : 'opacity-0'
                                            )}
                                        />
                                        <span className="flex items-center gap-2">
                                            {school.name}
                                            {school.isCustomized && (
                                                <span
                                                    className="h-1.5 w-1.5 rounded-full bg-primary"
                                                    title="Custom URLs"
                                                />
                                            )}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {/* Info popover - always visible, disabled when no school selected */}
            <SchoolInfoPopover
                schoolName={selectedSchool?.name ?? ''}
                rosterUrl={selectedSchool?.rosterUrl ?? ''}
                statsUrl={selectedSchool?.statsUrl ?? ''}
                isCustomized={selectedSchool?.isCustomized ?? false}
                platform={selectedSchool?.platform}
                onEdit={handleEdit}
                onDelete={selectedSchool?.isCustomized ? handleDelete : undefined}
                disabled={!selectedSchool}
            />
        </div>
    );
}
