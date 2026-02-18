// @ts-ignore - Importing directly to avoid index.js side effects in Next.js build
import pdf from 'pdf-parse/lib/pdf-parse.js';

/**
 * Fetches a PDF from a URL and returns its text content
 * 
 * @param url - URL of the PDF to fetch
 * @returns Extracted text content from the PDF
 */
export async function fetchAndParsePdf(url: string): Promise<string> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Custom renderer that sorts text items by visual position
    // PDF items come in stream order, not visual order - we need to reorder them
    const renderPage = (pageData: any) => {
        const render_options = {
            normalizeWhitespace: false,
            disableCombineTextItems: false
        };

        return pageData.getTextContent(render_options)
            .then(function (textContent: any) {
                // Collect all items with their positions
                interface TextItem {
                    str: string;
                    x: number;
                    y: number;
                    height: number;
                }

                const items: TextItem[] = textContent.items.map((item: any) => ({
                    str: item.str,
                    x: item.transform[4],      // X position
                    y: item.transform[5],      // Y position (higher = higher on page)
                    height: item.height || 10  // Text height for line grouping
                }));

                // Sort by Y (descending - top of page first) then by X (ascending - left to right)
                items.sort((a, b) => {
                    // Group items within similar Y positions (same line)
                    const yDiff = b.y - a.y;
                    if (Math.abs(yDiff) > 5) { // Items more than 5 units apart vertically = different lines
                        return yDiff; // Higher Y first (top of page)
                    }
                    return a.x - b.x; // Same line: sort by X (left to right)
                });

                // Build text with proper line breaks and spacing
                let text = '';
                let lastY: number | null = null;

                for (const item of items) {
                    if (lastY !== null) {
                        const yDiff = Math.abs(item.y - lastY);
                        if (yDiff > 3) {
                            // New line (use smaller threshold for tighter line detection)
                            text += '\n';
                        } else {
                            // Same line - always add space between text items
                            // PDF stores each word/number as separate items
                            text += ' ';
                        }
                    }
                    text += item.str;
                    lastY = item.y;
                }

                return text;
            });
    };

    // Parse the PDF using pdf-parse with custom renderer
    const result = await pdf(buffer, {
        pagerender: renderPage
    });

    return result.text;
}

/**
 * Parses PDF text into sections based on headers
 * Sidearm PDFs have consistent headers like:
 * - "All games Sorted by Batting Avg"
 * - "All games Sorted by Earned Run Avg"
 * 
 * @param text - Raw text from PDF
 * @returns Object with named sections
 */
export function splitIntoSections(text: string): Record<string, string> {
    const sections: Record<string, string> = {};

    // Common section headers in Sidearm baseball PDFs
    const sectionPatterns = [
        { key: 'batting', pattern: /All games Sorted by Batting Avg/i },
        { key: 'pitching', pattern: /All games Sorted by Earned Run Avg/i },
    ];

    // Find each section's start position
    const sectionStarts: { key: string; start: number }[] = [];

    for (const { key, pattern } of sectionPatterns) {
        const match = text.match(pattern);
        if (match && match.index !== undefined) {
            sectionStarts.push({ key, start: match.index });
        }
    }

    // Sort by position in text
    sectionStarts.sort((a, b) => a.start - b.start);

    // Extract each section's content
    for (let i = 0; i < sectionStarts.length; i++) {
        const current = sectionStarts[i];
        const next = sectionStarts[i + 1];

        const endPos = next ? next.start : text.length;
        sections[current.key] = text.slice(current.start, endPos).trim();
    }

    return sections;
}

/**
 * Parse team info from the top of the PDF
 */
export function parseTeamInfo(text: string): {
    name: string;
    record: string;
    asOfDate: string;
} | null {
    // Pattern: "2025 Georgia State University Baseball\nOverall Statistics (as of May 17, 2025)"
    const nameMatch = text.match(/^\d{4}\s+(.+?)\s+(Baseball|Softball)/m);
    const recordMatch = text.match(/Overall Record:\s*([\d-]+)/);
    const dateMatch = text.match(/as of\s+([^)]+)/i);

    if (nameMatch) {
        return {
            name: nameMatch[1].trim(),
            record: recordMatch ? recordMatch[1] : '',
            asOfDate: dateMatch ? dateMatch[1].trim() : '',
        };
    }

    return null;
}
