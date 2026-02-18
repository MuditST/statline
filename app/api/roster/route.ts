import { NextRequest, NextResponse } from 'next/server';
import { extractRoster, type RosterPlayer } from '@/lib/roster/extractor';
import { getSchoolById } from '@/config/schools';
import { fetchRosterWithFallback, generateRosterUrls } from '@/lib/url/generator';
import type { SportType } from '@/types';

export interface RosterResponse {
    success: boolean;
    data?: RosterPlayer[];
    error?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { schoolId, sport, customRosterUrl } = body as {
            schoolId?: string;
            sport: SportType;
            customRosterUrl?: string;
        };

        let rosterUrl: string;

        // Use custom URL if provided, otherwise use auto-detection
        if (customRosterUrl) {
            rosterUrl = customRosterUrl;
        } else {
            if (!schoolId) {
                return NextResponse.json<RosterResponse>(
                    { success: false, error: 'Missing schoolId or customRosterUrl' },
                    { status: 400 }
                );
            }

            const school = getSchoolById(schoolId);
            if (!school) {
                return NextResponse.json<RosterResponse>(
                    { success: false, error: `School not found: ${schoolId}` },
                    { status: 404 }
                );
            }

            if (!school.sports.includes(sport)) {
                return NextResponse.json<RosterResponse>(
                    { success: false, error: `Sport not configured for ${school.name}: ${sport}` },
                    { status: 404 }
                );
            }

            // Use direct roster URL if the school has one configured (e.g. Georgia Tech)
            if (school.rosterUrls?.[sport]) {
                const directUrl = school.rosterUrls[sport]!;
                const players = await extractRoster(directUrl);
                return NextResponse.json<RosterResponse>({
                    success: true,
                    data: players,
                });
            }

            // Try auto-detecting the roster URL format (Sidearm schools)
            const result = await fetchRosterWithFallback(school.domain, sport);
            if (result) {
                // We got the HTML directly, extract roster from it
                const players = await extractRoster(result.url);
                return NextResponse.json<RosterResponse>({
                    success: true,
                    data: players,
                });
            }

            // Fallback: try the first generated URL
            const urls = generateRosterUrls(school.domain, sport);
            rosterUrl = urls[0];
        }

        // Extract roster data
        const players = await extractRoster(rosterUrl);

        return NextResponse.json<RosterResponse>({
            success: true,
            data: players,
        });

    } catch (error) {
        console.error('Roster fetch error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error occurred';

        return NextResponse.json<RosterResponse>(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
