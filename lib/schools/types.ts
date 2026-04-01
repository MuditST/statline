import type { SportType } from '@/types';

export type SchoolPlatform = 'sidearm' | 'wmt' | 'hybrid' | 'gtech';
export type ConfiguredSchoolSource = 'config' | 'sheet';

export interface ConfiguredSchoolOption {
    id: string;
    name: string;
    sport: SportType;
    platform: SchoolPlatform;
    rosterUrl: string;
    statsUrl: string;
    helperUrl: string;
    source: ConfiguredSchoolSource;
}
