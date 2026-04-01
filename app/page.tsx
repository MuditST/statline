'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Toaster, toast } from 'sonner';
import { ConfiguredSchoolCombobox } from '@/components/configured-school-combobox';
import { SportSelector } from '@/components/sport-selector';
import { CustomUrlForm } from '@/components/custom-url-form';
import { StatsPasteDialog } from '@/components/gtech-paste-dialog';
import { ModeToggle } from '@/components/mode-toggle';
import { HelpCircle, Loader2 } from 'lucide-react';
import { getSportConfig } from '@/lib/sports';
import { saveSchool, getSavedSchool } from '@/lib/storage/schools';
import type { SportType } from '@/types';
import type { RosterPlayer } from '@/lib/roster/extractor';
import type { RosterResponse } from '@/app/api/roster/route';
import type { ConfiguredSchoolOption } from '@/lib/schools/types';

export default function Home() {
    // Selection state
    const [selectedSport, setSelectedSport] = useState<SportType>('baseball');
    const [selectedSchool, setSelectedSchool] = useState('');
    const [useCustomUrls, setUseCustomUrls] = useState(false);
    const [customSchoolName, setCustomSchoolName] = useState('');
    const [customRosterUrl, setCustomRosterUrl] = useState('');
    const [customStatsUrl, setCustomStatsUrl] = useState('');
    const [customPlatform, setCustomPlatform] = useState<'sidearm' | 'wmt' | 'hybrid'>('sidearm');
    const [customPastedStats, setCustomPastedStats] = useState('');
    const [editingSchoolId, setEditingSchoolId] = useState('');
    const [comboboxKey, setComboboxKey] = useState(0);
    const [gtechPastedStats, setGtechPastedStats] = useState('');

    // Data state
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rosterData, setRosterData] = useState<RosterPlayer[]>([]);
    const [statsData, setStatsData] = useState<unknown>(null);
    const [configuredSchools, setConfiguredSchools] = useState<ConfiguredSchoolOption[]>([]);
    const [isConfigLoading, setIsConfigLoading] = useState(false);

    // Detect effective platform — localStorage override (per-sport) takes priority,
    // config platform only applies if config lists this sport
    const selectedSchoolConfig = selectedSchool
        ? configuredSchools.find((school) => school.id === selectedSchool)
        : null;
    const selectedSchoolOverride = selectedSchool ? getSavedSchool(selectedSchool, selectedSport) : null;
    const configPlatform = selectedSchoolConfig?.platform;
    const effectiveSchoolPlatform = selectedSchoolOverride?.platform ?? configPlatform;
    const isGtechSchool = effectiveSchoolPlatform === 'gtech';
    const isHybridSchool = effectiveSchoolPlatform === 'hybrid';
    const selectedSchoolHelperUrl = selectedSchoolConfig?.helperUrl ?? '';

    useEffect(() => {
        let cancelled = false;

        const loadConfiguredSchools = async () => {
            setIsConfigLoading(true);

            try {
                const response = await fetch(`/api/config/schools?sport=${selectedSport}`);
                const json = await response.json();

                if (!response.ok || !json.success) {
                    throw new Error(json.error || 'Failed to load school config');
                }

                if (!cancelled) {
                    setConfiguredSchools(json.data ?? []);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to load school config:', err);
                    setConfiguredSchools([]);
                }
            } finally {
                if (!cancelled) {
                    setIsConfigLoading(false);
                }
            }
        };

        loadConfiguredSchools();

        return () => {
            cancelled = true;
        };
    }, [selectedSport]);

    useEffect(() => {
        setRosterData([]);
        setStatsData(null);
        setError(null);
        setSelectedSchool('');
        setCustomSchoolName('');
        setCustomRosterUrl('');
        setCustomStatsUrl('');
        setCustomPlatform('sidearm');
        setGtechPastedStats('');
        setCustomPastedStats('');
        setEditingSchoolId('');
    }, [selectedSport]);

    // Reset custom form when toggling on (clears stale data from previous entries)
    const handleCustomUrlToggle = useCallback((checked: boolean) => {
        setUseCustomUrls(checked);
        if (checked) {
            setCustomSchoolName('');
            setCustomRosterUrl('');
            setCustomStatsUrl('');
            setCustomPlatform('sidearm');
            setCustomPastedStats('');
            setEditingSchoolId('');
        }
    }, []);

    const canFetch = useCustomUrls
        ? customPlatform === 'hybrid'
            ? customRosterUrl && customPastedStats.trim()
            : customRosterUrl && customStatsUrl
        : isGtechSchool
            ? selectedSchool && gtechPastedStats.trim() && !isConfigLoading
            : isHybridSchool
                ? selectedSchool && gtechPastedStats.trim() && !isConfigLoading
                : selectedSchool && !isConfigLoading;

    const hasData = rosterData.length > 0;

    // Get sport configuration
    const sportConfig = getSportConfig(selectedSport);
    const StatsViewComponent = sportConfig.StatsViewComponent;

    // Handle editing a school from the info popover
    const handleEditSchool = useCallback((school: { id?: string; name: string; rosterUrl: string; statsUrl: string; platform?: 'sidearm' | 'gtech' | 'wmt' | 'hybrid' }) => {
        setUseCustomUrls(true);
        setEditingSchoolId(school.id || '');
        setCustomSchoolName(school.name);
        setCustomRosterUrl(school.rosterUrl);
        setCustomStatsUrl(school.statsUrl);
        setCustomPlatform(school.platform === 'wmt' ? 'wmt' : school.platform === 'hybrid' ? 'hybrid' : 'sidearm');
    }, []);

    // Handle school deletion callback
    const handleSchoolDeleted = useCallback(() => {
        toast.success('School removed from list');
        setComboboxKey(k => k + 1);
    }, []);

    const handleGetStats = async () => {
        if (!canFetch) return;

        setIsLoading(true);
        setError(null);

        try {
            // Determine URLs to use
            let rosterUrlToFetch = customRosterUrl;
            let statsUrlToFetch = customStatsUrl;
            let isUsingCustom = useCustomUrls;
            let effectivePlatform: 'sidearm' | 'wmt' | 'hybrid' = useCustomUrls ? customPlatform : 'sidearm';

            // If not using custom form, check for localStorage override
            if (!useCustomUrls && selectedSchool) {
                const savedOverride = getSavedSchool(selectedSchool, selectedSport);
                if (savedOverride) {
                    rosterUrlToFetch = savedOverride.rosterUrl;
                    statsUrlToFetch = savedOverride.statsUrl;
                    isUsingCustom = true;
                    if (savedOverride.platform) {
                        effectivePlatform = savedOverride.platform;
                    }
                } else {
                    const school = configuredSchools.find((item) => item.id === selectedSchool);
                    if (!school) {
                        throw new Error('School not found');
                    }
                }
            }

            // 1. Fetch roster data
            const rosterRes = await fetch('/api/roster', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    schoolId: isUsingCustom ? undefined : selectedSchool,
                    sport: selectedSport,
                    customRosterUrl: isUsingCustom ? rosterUrlToFetch : undefined,
                }),
            });

            const rosterJson: RosterResponse = await rosterRes.json();

            if (!rosterJson.success) {
                throw new Error(rosterJson.error || 'Failed to fetch roster');
            }

            const roster = rosterJson.data || [];
            setRosterData(roster);

            // 2. Fetch stats
            const pdfBody = isUsingCustom
                ? effectivePlatform === 'wmt'
                    ? { wmtStatsPageUrl: statsUrlToFetch, sport: selectedSport }
                    : effectivePlatform === 'hybrid'
                        ? { pastedStats: customPastedStats, sport: selectedSport }
                        : { url: statsUrlToFetch, sport: selectedSport }
                : {
                    schoolId: selectedSchool,
                    sport: selectedSport,
                    ...((isGtechSchool || isHybridSchool) && gtechPastedStats.trim() ? { pastedStats: gtechPastedStats } : {}),
                };

            const pdfRes = await fetch('/api/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pdfBody),
            });

            const pdfJson = await pdfRes.json();

            if (!pdfJson.success) {
                const statsError = pdfJson.error || 'Failed to fetch stats';
                console.error('Stats error:', statsError);
                // Show error to user but don't throw — roster may still work
                toast.error(statsError);
            }

            // 3. Handle response based on sport type
            let statsLoaded = false;
            if (pdfJson.data) {
                setStatsData(pdfJson.data);
                statsLoaded = true;
            }

            // Show warning if roster loaded but stats didn't
            if (roster.length > 0 && !statsLoaded && !pdfJson.error) {
                setError('Roster loaded but stats could not be parsed. Try using Custom URLs with the correct stats source.');
            }

            // Show error if nothing loaded at all
            if (roster.length === 0 && !statsLoaded) {
                setError('Could not fetch roster or stats. Try using Custom URLs or check that the school/sport is correct.');
            }

            // Save to localStorage only if BOTH roster and stats loaded successfully
            if (roster.length > 0 && statsLoaded && useCustomUrls && customSchoolName.trim()) {
                saveSchool({
                    id: editingSchoolId || undefined,
                    name: customSchoolName.trim(),
                    sport: selectedSport,
                    rosterUrl: customRosterUrl,
                    statsUrl: customPlatform === 'hybrid' ? '' : customStatsUrl,
                    ...(customPlatform !== 'sidearm' ? { platform: customPlatform as 'wmt' | 'hybrid' } : {}),
                });
                toast.success(`${customSchoolName.trim()} saved`);
                setComboboxKey(k => k + 1);
            }

        } catch (err) {
            const message = err instanceof Error ? err.message : 'An error occurred';
            setError(message);
            setRosterData([]);
            setStatsData(null);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <TooltipProvider>
                <div className="min-h-screen bg-background">
                    {/* Header */}
                    <header className="bg-background pt-8 pb-6">
                        <div className="container mx-auto flex items-center justify-center gap-3">
                            <img
                                src="/logo.png"
                                alt="Statline Logo"
                                className="h-10 w-10 rounded-xl"
                            />
                            <h1 className="text-3xl font-bold tracking-tight">Statline</h1>
                        </div>
                    </header>

                    <main className="container mx-auto px-4 pb-6 space-y-6">
                        {/* Selection Card */}
                        <Card className="border-none shadow-none">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="flex items-center text-base font-medium">
                                    Select Options
                                </CardTitle>

                                {/* Custom URLs Toggle */}
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="custom-urls" className="text-sm text-muted-foreground">
                                        Custom URLs
                                    </Label>
                                    <Switch
                                        id="custom-urls"
                                        checked={useCustomUrls}
                                        onCheckedChange={handleCustomUrlToggle}
                                    />
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Enable to enter custom roster and stats URLs</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    <ModeToggle />
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-6">
                                {/* Sport Selection */}
                                <SportSelector
                                    value={selectedSport}
                                    onChange={setSelectedSport}
                                />

                                {/* School Selection or Custom URLs */}
                                {!useCustomUrls ? (
                                    <div className="space-y-2">
                                        <Label className="text-sm text-muted-foreground">School</Label>
                                        <ConfiguredSchoolCombobox
                                            key={comboboxKey}
                                            value={selectedSchool}
                                            onValueChange={setSelectedSchool}
                                            sport={selectedSport}
                                            configuredSchools={configuredSchools}
                                            onEditSchool={handleEditSchool}
                                            onSchoolDeleted={handleSchoolDeleted}
                                        />
                                    </div>
                                ) : (
                                    <CustomUrlForm
                                        schoolName={customSchoolName}
                                        rosterUrl={customRosterUrl}
                                        statsUrl={customStatsUrl}
                                        platform={customPlatform}
                                        sport={selectedSport}
                                        pastedStats={customPastedStats}
                                        onSchoolNameChange={setCustomSchoolName}
                                        onRosterUrlChange={setCustomRosterUrl}
                                        onStatsUrlChange={setCustomStatsUrl}
                                        onPlatformChange={setCustomPlatform}
                                        onPastedStatsChange={setCustomPastedStats}
                                    />
                                )}

                                {/* GT Paste Stats — shows PDF link (only when NOT in custom URL mode) */}
                                {!useCustomUrls && isGtechSchool && (
                                    <StatsPasteDialog
                                        sport={selectedSport}
                                        pastedStats={gtechPastedStats}
                                        onStatsChange={setGtechPastedStats}
                                        showGtechPdfLink
                                    />
                                )}

                                {/* Hybrid Paste Stats — no PDF link (only when NOT in custom URL mode) */}
                                {!useCustomUrls && isHybridSchool && (
                                    <StatsPasteDialog
                                        sport={selectedSport}
                                        pastedStats={gtechPastedStats}
                                        onStatsChange={setGtechPastedStats}
                                        helperUrl={selectedSchoolHelperUrl}
                                    />
                                )}

                                {/* Get Stats Button */}
                                <Button
                                    className="w-full"
                                    size="lg"
                                    disabled={!canFetch || isLoading}
                                    onClick={handleGetStats}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        useCustomUrls && customSchoolName.trim()
                                            ? 'Save School & Get Stats'
                                            : 'Get Stats'
                                    )}
                                </Button>

                                {/* Error Message */}
                                {error && (
                                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                                        {error}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Data Section - Sport-specific view */}
                        {hasData && (
                            <Card className="border-none shadow-none">
                                <CardContent className="pt-6">
                                    <StatsViewComponent
                                        roster={rosterData}
                                        statsData={statsData}
                                        isLoading={isLoading}
                                    />
                                </CardContent>
                            </Card>
                        )}
                    </main>
                </div>
            </TooltipProvider>
            <Toaster position="bottom-right" richColors />
        </>
    );
}
