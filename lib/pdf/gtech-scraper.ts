/**
 * Scrape the current GT stats PDF URL from a GT team page.
 *
 * GT updates their stats PDF after every game, so the URL changes
 * (e.g. GT-Baseball-Season-Stats-2026-4.pdf → ...2026-5.pdf).
 * Instead of hardcoding, we scrape the team page and find the
 * <a>Stats</a> link that points to the PDF.
 */
import * as cheerio from 'cheerio';

/**
 * Fetch a GT team page and extract the stats PDF URL from the nav.
 * Returns the absolute PDF URL, or null if not found.
 */
export async function scrapeGtechPdfUrl(
    teamPageUrl: string
): Promise<string | null> {
    const response = await fetch(teamPageUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Statline/1.0)',
        },
    });

    if (!response.ok) {
        console.error(
            `Failed to fetch GT team page: ${response.status} ${response.statusText}`
        );
        return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Look for an <a> tag whose text is "Stats" (case-insensitive)
    // that links to a PDF file
    let pdfUrl: string | null = null;

    $('a').each((_, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href') || '';

        if (
            text.toLowerCase() === 'stats' &&
            href.toLowerCase().endsWith('.pdf')
        ) {
            // Resolve relative URLs
            if (href.startsWith('http')) {
                pdfUrl = href;
            } else {
                const base = new URL(teamPageUrl);
                pdfUrl = new URL(href, base.origin).toString();
            }
            return false; // break out of .each()
        }
    });

    return pdfUrl;
}
