import type { SportType } from '@/types';
import type { SportConfig } from './types';
import { baseballConfig } from './baseball.config';
import { softballConfig } from './softball.config';
import { soccerConfig } from './soccer.config';
import { basketballConfig } from './basketball.config';
import { volleyballConfig } from './volleyball.config';
import { footballConfig } from './football.config';

/**
 * Registry of all sport configurations
 */
const SPORT_CONFIGS: Record<string, SportConfig> = {
    'baseball': baseballConfig,
    'softball': softballConfig,
    'mens-soccer': soccerConfig,
    'womens-soccer': { ...soccerConfig, id: 'womens-soccer', name: 'Women\'s Soccer' },
    'mens-basketball': { ...basketballConfig, id: 'mens-basketball', name: 'Men\'s Basketball' },
    'womens-basketball': { ...basketballConfig, id: 'womens-basketball', name: 'Women\'s Basketball' },
    'womens-volleyball': volleyballConfig,
    'football': footballConfig,
};

/**
 * Get sport configuration by sport type
 */
export function getSportConfig(sport: SportType): SportConfig {
    const config = SPORT_CONFIGS[sport];

    if (!config) {
        console.warn(`No config found for sport: ${sport}, using baseball as fallback`);
        return baseballConfig;
    }

    return config;
}

// Re-export configs
export { baseballConfig } from './baseball.config';
export { softballConfig } from './softball.config';
export { soccerConfig } from './soccer.config';
export { basketballConfig } from './basketball.config';
export { volleyballConfig } from './volleyball.config';
export { footballConfig } from './football.config';
export * from './types';
