/**
 * Shared CSV export and clipboard utilities.
 *
 * These helpers are used across all sport view components
 * for consistent copy-to-clipboard and CSV download behavior.
 */

/**
 * Download a string as a dated CSV file.
 *
 * Filename format: `{name}_{YYYY-MM-DD}.csv`
 */
export function downloadCsv(content: string, filename: string): void {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * Prevent Excel from interpreting values as dates or formulas.
 *
 * Values containing `-` or `/` (e.g. "0/0", "3-5", IP like "6.1")
 * are wrapped as `="value"` so Excel treats them as literal text.
 */
export function excelSafe(val: string | number | undefined): string {
    if (val === undefined || val === '') return '';
    const s = String(val);
    if (s.includes('-') || s.includes('/')) return `="${s}"`;
    return s;
}

/**
 * Safely convert a value to string, preserving `0` instead of
 * treating it as empty. Returns empty string for undefined/null/''.
 */
export function safeValue(val: string | number | undefined): string {
    if (val === undefined || val === null || val === '') return '';
    return String(val);
}
