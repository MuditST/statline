import 'server-only';

import { getSchoolById, getSchoolsBySport, type SchoolConfig } from '@/config/schools';
import type { SportType } from '@/types';
import { generateRosterUrls, generateStatsUrls } from '@/lib/url/generator';
import { getGoogleSheetsSchoolOverrides } from './sheets';
import type { ConfiguredSchoolOption } from './types';

function buildConfiguredOption(school: SchoolConfig, sport: SportType): ConfiguredSchoolOption | null {
    if (!school.sports.includes(sport)) {
        return null;
    }

    const platform = school.platform ?? 'sidearm';
    const rosterUrl = school.rosterUrls?.[sport]
        || generateRosterUrls(school.domain, sport)[0]
        || '';

    if (!rosterUrl) {
        return null;
    }

    if (platform === 'wmt') {
        const teamId = school.wmtTeamId?.[sport];
        if (!teamId) {
            return null;
        }

        return {
            id: school.id,
            name: school.name,
            sport,
            platform,
            rosterUrl,
            statsUrl: `https://api.wmt.games/api/statistics/teams/${teamId}/players`,
            helperUrl: '',
            source: 'config',
        };
    }

    if (platform === 'hybrid') {
        return {
            id: school.id,
            name: school.name,
            sport,
            platform,
            rosterUrl,
            statsUrl: '',
            helperUrl: school.statsPageUrls?.[sport] || school.statsUrls?.[sport] || '',
            source: 'config',
        };
    }

    if (platform === 'gtech') {
        return {
            id: school.id,
            name: school.name,
            sport,
            platform,
            rosterUrl,
            statsUrl: '',
            helperUrl: school.statsPageUrls?.[sport] || '',
            source: 'config',
        };
    }

    return {
        id: school.id,
        name: school.name,
        sport,
        platform,
        rosterUrl,
        statsUrl: school.statsUrls?.[sport]
            || generateStatsUrls(school.sidearmDomain, sport, school.s3Region)[0]
            || '',
        helperUrl: '',
        source: 'config',
    };
}

function buildConfiguredOptionsForSport(sport: SportType): ConfiguredSchoolOption[] {
    return getSchoolsBySport(sport)
        .map((school) => buildConfiguredOption(school, sport))
        .filter((school): school is ConfiguredSchoolOption => school !== null);
}

export async function getConfiguredSchoolOptionsForSport(sport: SportType): Promise<ConfiguredSchoolOption[]> {
    const configOptions = buildConfiguredOptionsForSport(sport);
    const sheetOptions = (await getGoogleSheetsSchoolOverrides())
        .filter((school) => school.sport === sport);

    const merged = new Map<string, ConfiguredSchoolOption>();

    for (const school of configOptions) {
        merged.set(school.id, school);
    }

    for (const school of sheetOptions) {
        merged.set(school.id, school);
    }

    return Array.from(merged.values())
        .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getConfiguredSchoolOption(id: string, sport: SportType): Promise<ConfiguredSchoolOption | null> {
    const configuredSchools = await getConfiguredSchoolOptionsForSport(sport);
    return configuredSchools.find((school) => school.id === id) ?? null;
}

export function getPresetSchoolConfig(id: string): SchoolConfig | undefined {
    return getSchoolById(id);
}
