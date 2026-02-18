import type { SportType } from '@/types';

/**
 * Sidearm Sports S3 base URL for stats PDFs
 */
const SIDEARM_S3_BASE = 'https://s3.us-east-2.amazonaws.com/sidearm.nextgen.sites';

/**
 * Sport code patterns for Sidearm URLs
 * Schools may use either abbreviated or full names - we try both
 * Order matters - most common patterns first
 */
const SPORT_URL_PATTERNS: Record<SportType, string[]> = {
    'baseball': ['baseball', 'bb'],
    'softball': ['softball', 'sb'],
    'mens-basketball': ['mbball', 'mens-basketball', 'mbb'],
    'womens-basketball': ['wbball', 'womens-basketball', 'wbb'],
    'mens-soccer': ['msoc', 'mens-soccer', 'msoccer'],
    'womens-soccer': ['wsoc', 'womens-soccer', '4wsoccer', 'soccr'],
    'womens-volleyball': ['vb', 'wvball', 'womens-volleyball', 'wvb'],
    // Football: try 'football' FIRST since most schools use that, then 'fb' as fallback
    'football': ['football', 'fb'],
};

/**
 * Generate possible stats PDF URLs for a school
 * Returns URLs to try in order (with different sport codes)
 * For academic year sports (basketball, volleyball), we try previous calendar year first
 * since the season starts in fall (e.g., 2025-26 season uses 2025 folder)
 */
export function generateStatsUrls(
    sidearmDomain: string,
    sport: SportType,
    s3Region: 'us-east-1' | 'us-east-2' = 'us-east-2'
): string[] {
    const currentYear = new Date().getFullYear();
    const patterns = SPORT_URL_PATTERNS[sport] || [sport];
    const urls: string[] = [];

    // Base URL depends on region - some schools use nextgen, some use regular
    const baseUrl = s3Region === 'us-east-1'
        ? `https://s3.us-east-1.amazonaws.com/sidearm.sites`
        : `https://s3.us-east-2.amazonaws.com/sidearm.nextgen.sites`;

    // NOTE: We don't include website URLs (domain/sports/sport/stats/year/pdf) for football
    // because those return HTML pages, not actual PDF files. The S3 bucket has the real PDFs.


    // Try current year first with all sport code patterns (S3 bucket)
    for (const sportCode of patterns) {
        urls.push(`${baseUrl}/${sidearmDomain}/stats/${sportCode}/${currentYear}/pdf/cume.pdf`);
    }

    // Then try previous year with all sport code patterns (S3 bucket)
    for (const sportCode of patterns) {
        urls.push(`${baseUrl}/${sidearmDomain}/stats/${sportCode}/${currentYear - 1}/pdf/cume.pdf`);
    }

    return urls;
}

/**
 * Generate possible roster URLs for a school
 * Returns URLs to try in order (?print=true first, then /print)
 */
export function generateRosterUrls(
    baseDomain: string,
    sport: SportType
): string[] {
    const sportPath = sport === 'mens-basketball' ? 'mens-basketball' :
        sport === 'womens-basketball' ? 'womens-basketball' :
            sport === 'mens-soccer' ? 'mens-soccer' :
                sport === 'womens-soccer' ? 'womens-soccer' :
                    sport === 'womens-volleyball' ? 'womens-volleyball' :
                        sport;

    return [
        `https://${baseDomain}/sports/${sportPath}/roster?print=true`,
        `https://${baseDomain}/sports/${sportPath}/roster/print`,
    ];
}

/**
 * Fetch with fallback - tries multiple URLs until one succeeds
 */
export async function fetchWithFallback(
    urls: string[],
    validator: (response: Response, text: string) => boolean
): Promise<{ url: string; text: string } | null> {
    for (const url of urls) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; StatlineBot/1.0)',
                },
            });

            if (!response.ok) continue;

            const text = await response.text();

            // Run the validator to ensure this is valid data
            if (validator(response, text)) {
                return { url, text };
            }
        } catch {
            // Network error, try next URL
            continue;
        }
    }

    return null;
}

/**
 * Validate that a PDF response contains actual PDF data
 */
export function isValidPdfResponse(response: Response, text: string): boolean {
    // PDFs start with %PDF
    return text.startsWith('%PDF') || text.startsWith('%pdf');
}

/**
 * Validate that a roster page response contains a proper roster table
 * Print pages typically have:
 * - A table with roster data
 * - Player rows with jersey numbers
 * - Minimal navigation/footer content
 */
export function isValidRosterPage(response: Response, html: string): boolean {
    // Check for roster table indicators
    const hasTable = html.includes('<table');
    const hasRosterContent =
        html.includes('Pos.') ||
        html.includes('Position') ||
        html.includes('Hometown') ||
        html.includes('Year');

    // Print pages are typically smaller and don't have full navigation
    const isLikelyPrintPage = html.length < 800000; // Normal pages are huge

    // Should NOT be a redirect to home page
    const isNotHomePage = !html.includes('id="homepage"') &&
        !html.includes('class="home-');

    return hasTable && hasRosterContent && isLikelyPrintPage && isNotHomePage;
}

/**
 * Fetch stats PDF with automatic year fallback
 */
export async function fetchStatsWithFallback(
    sidearmDomain: string,
    sport: SportType
): Promise<{ url: string; buffer: ArrayBuffer } | null> {
    const urls = generateStatsUrls(sidearmDomain, sport);

    for (const url of urls) {
        try {
            const response = await fetch(url);
            if (!response.ok) continue;

            const buffer = await response.arrayBuffer();
            const bytes = new Uint8Array(buffer);

            // Check PDF magic bytes
            if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
                return { url, buffer };
            }
        } catch {
            continue;
        }
    }

    return null;
}

/**
 * Fetch roster page with automatic format fallback
 */
export async function fetchRosterWithFallback(
    baseDomain: string,
    sport: SportType
): Promise<{ url: string; html: string } | null> {
    const urls = generateRosterUrls(baseDomain, sport);

    for (const url of urls) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });

            if (!response.ok) continue;

            const html = await response.text();

            if (isValidRosterPage(response, html)) {
                return { url, html };
            }
        } catch {
            continue;
        }
    }

    return null;
}
