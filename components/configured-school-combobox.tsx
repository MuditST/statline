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
import { getSavedSchools, deleteSchool } from '@/lib/storage/schools';
import type { SportType } from '@/types';
import type { ConfiguredSchoolOption } from '@/lib/schools/types';

interface MergedSchool {
    id: string;
    name: string;
    source: 'config' | 'sheet' | 'custom';
    isCustomOnly: boolean;
    rosterUrl: string;
    statsUrl: string;
    helperUrl: string;
    platform?: 'sidearm' | 'gtech' | 'wmt' | 'hybrid';
}

interface ConfiguredSchoolComboboxProps {
    value: string;
    onValueChange: (value: string) => void;
    sport: SportType;
    configuredSchools: ConfiguredSchoolOption[];
    onEditSchool?: (school: { id: string; name: string; rosterUrl: string; statsUrl: string; platform?: 'sidearm' | 'gtech' | 'wmt' | 'hybrid' }) => void;
    onSchoolDeleted?: () => void;
}

export function ConfiguredSchoolCombobox({
    value,
    onValueChange,
    sport,
    configuredSchools,
    onEditSchool,
    onSchoolDeleted,
}: ConfiguredSchoolComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [width, setWidth] = React.useState(0);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const [refreshKey, setRefreshKey] = React.useState(0);

    const mergedSchools = React.useMemo(() => {
        void refreshKey;
        const savedSchools = getSavedSchools(sport);
        const merged: MergedSchool[] = [];

        for (const configuredSchool of configuredSchools) {
            const saved = savedSchools.find((school) => school.id === configuredSchool.id);

            if (saved) {
                merged.push({
                    id: configuredSchool.id,
                    name: configuredSchool.name,
                    source: 'custom',
                    isCustomOnly: false,
                    rosterUrl: saved.rosterUrl,
                    statsUrl: saved.statsUrl,
                    helperUrl: configuredSchool.helperUrl,
                    platform: saved.platform || configuredSchool.platform,
                });
                continue;
            }

            merged.push({
                id: configuredSchool.id,
                name: configuredSchool.name,
                source: configuredSchool.source,
                isCustomOnly: false,
                rosterUrl: configuredSchool.rosterUrl,
                statsUrl: configuredSchool.statsUrl,
                helperUrl: configuredSchool.helperUrl,
                platform: configuredSchool.platform,
            });
        }

        for (const saved of savedSchools) {
            const existsInConfigured = configuredSchools.some((school) => school.id === saved.id);
            if (!existsInConfigured) {
                merged.push({
                    id: saved.id,
                    name: saved.name,
                    source: 'custom',
                    isCustomOnly: true,
                    rosterUrl: saved.rosterUrl,
                    statsUrl: saved.statsUrl,
                    helperUrl: '',
                    platform: saved.platform,
                });
            }
        }

        return merged.sort((a, b) => a.name.localeCompare(b.name));
    }, [configuredSchools, refreshKey, sport]);

    const selectedSchool = mergedSchools.find((school) => school.id === value);

    React.useEffect(() => {
        if (open && triggerRef.current) {
            setWidth(triggerRef.current.offsetWidth);
        }
    }, [open]);

    React.useEffect(() => {
        if (value && !mergedSchools.find((school) => school.id === value)) {
            onValueChange('');
        }
    }, [sport, value, mergedSchools, onValueChange]);

    const handleEdit = () => {
        if (selectedSchool && onEditSchool) {
            onEditSchool({
                id: selectedSchool.id,
                name: selectedSchool.name,
                rosterUrl: selectedSchool.rosterUrl,
                statsUrl: selectedSchool.statsUrl,
                platform: selectedSchool.platform,
            });
        }
    };

    const handleDelete = () => {
        if (selectedSchool) {
            deleteSchool(selectedSchool.id, sport);
            if (selectedSchool.isCustomOnly) {
                onValueChange('');
            }
            setRefreshKey((current) => current + 1);
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
                            {selectedSchool?.source === 'custom' && (
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
                                            {school.source === 'custom' && (
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

            <SchoolInfoPopover
                schoolName={selectedSchool?.name ?? ''}
                rosterUrl={selectedSchool?.rosterUrl ?? ''}
                statsUrl={selectedSchool?.statsUrl ?? ''}
                helperUrl={selectedSchool?.helperUrl ?? ''}
                source={selectedSchool?.source ?? 'config'}
                platform={selectedSchool?.platform}
                onEdit={handleEdit}
                onDelete={selectedSchool?.source === 'custom' ? handleDelete : undefined}
                disabled={!selectedSchool}
            />
        </div>
    );
}
