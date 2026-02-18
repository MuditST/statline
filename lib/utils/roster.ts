/**
 * Shared roster formatting utilities.
 */

/**
 * Convert numeric class year to standard abbreviation.
 *
 * Maps: 1 → FR, 2 → SO, 3 → JR, 4 → SR
 * Returns the original value if already a text label or unrecognized.
 */
export function yearToText(year: string): string {
    switch (year) {
        case '1': return 'FR';
        case '2': return 'SO';
        case '3': return 'JR';
        case '4': return 'SR';
        default: return year;
    }
}
