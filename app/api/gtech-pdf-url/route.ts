import { NextRequest, NextResponse } from 'next/server';
import { getSchoolById } from '@/config/schools';
import { scrapeGtechPdfUrl } from '@/lib/pdf/gtech-scraper';
import type { SportType } from '@/types';

interface GtechPdfUrlResponse {
    success: boolean;
    pdfUrl?: string;
    error?: string;
}

/**
 * Lightweight endpoint to fetch the current GT stats PDF URL.
 * Called once when the user selects a GT school, so the Dialog
 * can show a direct "Open PDF" link.
 */
export async function POST(request: NextRequest) {
    try {
        const { sport } = (await request.json()) as { sport?: SportType };

        if (!sport) {
            return NextResponse.json<GtechPdfUrlResponse>(
                { success: false, error: 'Missing sport parameter' },
                { status: 400 }
            );
        }

        const school = getSchoolById('georgia-tech');
        if (!school?.statsPageUrls?.[sport]) {
            return NextResponse.json<GtechPdfUrlResponse>(
                { success: false, error: `No GT stats page URL for ${sport}` },
                { status: 404 }
            );
        }

        const pdfUrl = await scrapeGtechPdfUrl(school.statsPageUrls[sport]!);

        if (!pdfUrl) {
            return NextResponse.json<GtechPdfUrlResponse>(
                {
                    success: false,
                    error: 'Could not find stats PDF link on GT team page. The page layout may have changed.',
                },
                { status: 404 }
            );
        }

        return NextResponse.json<GtechPdfUrlResponse>({
            success: true,
            pdfUrl,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json<GtechPdfUrlResponse>(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
