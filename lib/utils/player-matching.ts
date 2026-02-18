/**
 * Shared player matching utilities for StatLine
 * 
 * These functions are used across all sports to:
 * 1. Normalize jerseys and names for comparison
 * 2. Match roster players with their stats (from PDF)
 * 3. Convert jersey numbers to spreadsheet row positions
 */

/**
 * Normalize name for comparison - removes punctuation, lowercases
 */
export function normalizeName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Normalize jersey number for comparison
 * "01" -> "1", "00" -> "00", "0" -> "0"
 */
export function normalizeJersey(jersey: string): string {
    if (jersey === '00' || jersey === '0') return jersey;
    return String(parseInt(jersey) || jersey);
}

/**
 * Convert jersey number string to spreadsheet row number (1-99)
 * Used by sports that need 1-99 row mapping (volleyball, basketball, soccer, football)
 * 
 * Mapping:
 * - 1-89: Maps directly to row number
 * - 90-98: Maps directly to row number
 * - 0: Maps to row 90
 * - 00: Maps to row 99
 */
export function jerseyToRow(jersey: string): number {
    if (jersey === '0') return 90;
    if (jersey === '00') return 99;

    const num = parseInt(jersey);
    if (!isNaN(num) && num >= 1 && num < 90) return num;
    if (num >= 90 && num <= 98) return num;

    return 0; // Invalid
}

/**
 * Extract last name from "Last, First" or "First Last" format
 */
export function extractLastName(name: string): string {
    if (name.includes(',')) {
        return name.split(',')[0].trim();
    }
    const parts = name.trim().split(/\s+/);
    return parts[parts.length - 1] || '';
}

/**
 * Extract first name from "Last, First" or "First Last" format
 */
export function extractFirstName(name: string): string {
    if (name.includes(',')) {
        return name.split(',')[1]?.trim().split(/\s+/)[0] || '';
    }
    const parts = name.trim().split(/\s+/);
    return parts[0] || '';
}

/**
 * Check if either first OR last name matches (loose matching for primary jersey match)
 * Used when jersey numbers match - we just need to verify it's likely the same person
 */
export function looseNameMatch(
    rosterFirst: string,
    rosterLast: string,
    statsName: string
): boolean {
    const rFirst = normalizeName(rosterFirst);
    const rLast = normalizeName(rosterLast);
    const statsFirst = normalizeName(extractFirstName(statsName));
    const statsLast = normalizeName(extractLastName(statsName));

    // Check last name match (includes partial matches for nicknames)
    const lastMatches = rLast === statsLast ||
        rLast.includes(statsLast) ||
        statsLast.includes(rLast);

    // Check first name match (includes partial matches for nicknames)
    const firstMatches = rFirst === statsFirst ||
        rFirst.includes(statsFirst) ||
        statsFirst.includes(rFirst);

    // Either first OR last name matching is sufficient when jersey matches
    return lastMatches || firstMatches;
}

/**
 * Check if both first AND last names match exactly (strict matching for fallback)
 * Used when jersey numbers DON'T match - we need high confidence it's the same player
 */
export function exactNameMatch(
    rosterFirst: string,
    rosterLast: string,
    statsName: string
): boolean {
    const rFirst = normalizeName(rosterFirst);
    const rLast = normalizeName(rosterLast);
    const statsFirst = normalizeName(extractFirstName(statsName));
    const statsLast = normalizeName(extractLastName(statsName));

    // Both first AND last must match exactly
    return rFirst === statsFirst && rLast === statsLast;
}

/**
 * Primary matching strategy: Jersey number + loose name match
 * If jersey matches, we just need first OR last name to match
 */
export function primaryMatch(
    rosterJersey: string,
    rosterFirst: string,
    rosterLast: string,
    statsJersey: string,
    statsName: string
): boolean {
    const jerseyMatches = normalizeJersey(rosterJersey) === normalizeJersey(statsJersey);
    if (!jerseyMatches) return false;

    return looseNameMatch(rosterFirst, rosterLast, statsName);
}

/**
 * Fallback matching strategy: Exact first AND last name match (ignores jersey)
 * Used when player changed jersey numbers between seasons
 */
export function fallbackMatch(
    rosterFirst: string,
    rosterLast: string,
    statsName: string
): boolean {
    return exactNameMatch(rosterFirst, rosterLast, statsName);
}

/**
 * Find matching stats for a roster player using the two-phase strategy:
 * 1. Primary: Jersey + loose name match
 * 2. Fallback: Exact first AND last name match (if primary fails)
 * 
 * @param rosterPlayer - Player from roster (with firstName, lastName, number)
 * @param allStats - All stats entries from PDF
 * @returns Matched stats entry or undefined
 */
export function findMatchingStats<T extends { number: string; name: string }>(
    rosterPlayer: { firstName: string; lastName: string; number: string },
    allStats: T[]
): T | undefined {
    if (!Array.isArray(allStats) || allStats.length === 0) {
        return undefined;
    }

    // Phase 1: Try primary match (jersey + loose name)
    const primaryResult = allStats.find(stats =>
        primaryMatch(
            rosterPlayer.number,
            rosterPlayer.firstName,
            rosterPlayer.lastName,
            stats.number,
            stats.name
        )
    );

    if (primaryResult) {
        return primaryResult;
    }

    // Phase 2: Try fallback match (exact name, different jersey)
    const fallbackResult = allStats.find(stats =>
        normalizeJersey(stats.number) !== normalizeJersey(rosterPlayer.number) &&
        fallbackMatch(rosterPlayer.firstName, rosterPlayer.lastName, stats.name)
    );

    return fallbackResult;
}
