// =============================================================================
// CORE TYPES FOR STATLINE
// =============================================================================

/**
 * Supported sports
 */
export type SportType =
    | 'baseball'
    | 'softball'
    | 'mens-basketball'
    | 'womens-basketball'
    | 'mens-soccer'
    | 'womens-soccer'
    | 'womens-volleyball'
    | 'football';

/**
 * Sidearm Sports URL sport codes
 */
export const SPORT_CODES: Record<SportType, string> = {
    'baseball': 'bb',
    'softball': 'sb',
    'mens-basketball': 'mbball',
    'womens-basketball': 'wbball',
    'mens-soccer': 'msoc',
    'womens-soccer': 'wsoc',
    'womens-volleyball': 'wvball',
    'football': 'fb',
};
