import { NextRequest, NextResponse } from 'next/server';
import { fetchAndParsePdf } from '@/lib/pdf/parser';
import { getSchoolById } from '@/config/schools';
import { generateStatsUrls } from '@/lib/url/generator';
import type { SportType } from '@/types';

export interface PdfResponse {
    success: boolean;
    text?: string;
    error?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url, schoolId, sport, wmtStatsPageUrl } = body as {
            url?: string;
            schoolId?: string;
            sport?: SportType;
            wmtStatsPageUrl?: string;
        };

        // ===== WMT custom school — auto-discover team_id from stats page =====
        if (wmtStatsPageUrl && sport) {
            const { resolveWmtTeamId, parseWmtBaseballApi, parseWmtBasketballApi, parseWmtVolleyballApi } =
                await import('@/lib/parsers/wmt-api');

            const teamId = await resolveWmtTeamId(wmtStatsPageUrl);

            if (sport === 'baseball' || sport === 'softball') {
                const players = await parseWmtBaseballApi(teamId);
                return NextResponse.json({ success: true, type: 'gtech', data: players });
            }
            if (sport === 'mens-basketball' || sport === 'womens-basketball') {
                const { players } = await parseWmtBasketballApi(teamId);
                return NextResponse.json({ success: true, type: 'basketball', data: { players } });
            }
            if (sport === 'womens-volleyball') {
                const { players } = await parseWmtVolleyballApi(teamId);
                return NextResponse.json({ success: true, type: 'volleyball', data: { players } });
            }

            return NextResponse.json<PdfResponse>(
                { success: false, error: `WMT not supported for ${sport} yet` },
                { status: 404 }
            );
        }

        // ===== Custom URL (no school config) =====
        if (url && !schoolId) {
            // If sport is provided, route to sport-specific parser
            if (sport) {
                if (sport === 'mens-soccer' || sport === 'womens-soccer') {
                    const { parseSoccerPdf } = await import('@/lib/parsers/soccer');
                    const { players, goalies } = await parseSoccerPdf(url);
                    return NextResponse.json({ success: true, type: 'soccer', data: { players, goalies } });
                }
                if (sport === 'mens-basketball' || sport === 'womens-basketball') {
                    const { parseBasketballPdf } = await import('@/lib/parsers/basketball');
                    const { players } = await parseBasketballPdf(url);
                    return NextResponse.json({ success: true, type: 'basketball', data: { players } });
                }
                if (sport === 'womens-volleyball') {
                    const { parseVolleyballPdf } = await import('@/lib/parsers/volleyball');
                    const { players } = await parseVolleyballPdf(url);
                    return NextResponse.json({ success: true, type: 'volleyball', data: { players } });
                }
                if (sport === 'football') {
                    const { parseFootballPdf } = await import('@/lib/parsers/football');
                    const { players } = await parseFootballPdf(url);
                    return NextResponse.json({ success: true, type: 'football', data: { players } });
                }
            }

            // Default: parse as baseball/softball PDF
            const text = await fetchAndParsePdf(url);
            const { parsePdfStats } = await import('@/lib/parsers/baseball');
            const { batting, pitching } = parsePdfStats(text);
            return NextResponse.json({
                success: true,
                type: 'baseball',
                data: { batting, pitching },
            });
        }

        // ===== Configured school =====
        if (schoolId && sport) {
            const school = getSchoolById(schoolId);
            if (!school) {
                return NextResponse.json<PdfResponse>(
                    { success: false, error: `School not found: ${schoolId}` },
                    { status: 404 }
                );
            }

            if (!school.sports.includes(sport)) {
                return NextResponse.json<PdfResponse>(
                    { success: false, error: `Sport not configured for ${school.name}: ${sport}` },
                    { status: 404 }
                );
            }

            // ===== WMT platform — fetch stats from api.wmt.games JSON API =====
            if (school.platform === 'wmt') {
                const wmtTeamId = school.wmtTeamId?.[sport];
                if (!wmtTeamId) {
                    return NextResponse.json<PdfResponse>(
                        { success: false, error: `Missing WMT team ID for ${school.name} ${sport}` },
                        { status: 404 }
                    );
                }

                // Baseball
                if (sport === 'baseball' || sport === 'softball') {
                    const { parseWmtBaseballApi } = await import('@/lib/parsers/wmt-api');
                    const players = await parseWmtBaseballApi(wmtTeamId);
                    return NextResponse.json({
                        success: true,
                        type: 'gtech',
                        data: players,
                    });
                }

                // Basketball
                if (sport === 'mens-basketball' || sport === 'womens-basketball') {
                    const { parseWmtBasketballApi } = await import('@/lib/parsers/wmt-api');
                    const { players } = await parseWmtBasketballApi(wmtTeamId);
                    return NextResponse.json({
                        success: true,
                        type: 'basketball',
                        data: { players },
                    });
                }

                // Volleyball
                if (sport === 'womens-volleyball') {
                    const { parseWmtVolleyballApi } = await import('@/lib/parsers/wmt-api');
                    const { players } = await parseWmtVolleyballApi(wmtTeamId);
                    return NextResponse.json({
                        success: true,
                        type: 'volleyball',
                        data: { players },
                    });
                }

                return NextResponse.json<PdfResponse>(
                    { success: false, error: `WMT API not yet implemented for ${sport}` },
                    { status: 404 }
                );
            }

            // ===== Georgia Tech — GT-specific PDF parser (non-Sidearm) =====
            if (school.platform === 'gtech' && sport === 'baseball') {
                const { mergeGtechStats } = await import('@/lib/pdf/gtech-parser');
                const { extractRoster } = await import('@/lib/roster/extractor');

                const statsUrl = school.statsUrls?.[sport];
                const rosterUrl = school.rosterUrls?.[sport];
                if (!statsUrl || !rosterUrl) {
                    return NextResponse.json<PdfResponse>(
                        { success: false, error: `Missing GT URLs for ${sport}` },
                        { status: 404 }
                    );
                }

                const roster = await extractRoster(rosterUrl);
                const merged = await mergeGtechStats(roster, statsUrl);

                return NextResponse.json({
                    success: true,
                    type: 'gtech',
                    data: merged,
                });
            }

            // Special handling for Soccer (MSOC/WSOC) - return parsed JSON directly
            if (sport === 'mens-soccer' || sport === 'womens-soccer') {
                const { parseSoccerPdf } = await import('@/lib/parsers/soccer');

                // Try URLs with s3Region support
                const urls = generateStatsUrls(school.sidearmDomain, sport, school.s3Region);

                for (const tryUrl of urls) {
                    try {
                        const { players, goalies } = await parseSoccerPdf(tryUrl);
                        if (players.length > 0 || goalies.length > 0) {
                            return NextResponse.json({
                                success: true,
                                type: 'soccer',
                                data: { players, goalies }
                            });
                        }
                    } catch (e) {
                        const errorMessage = e instanceof Error ? e.message : String(e);
                        console.warn(`Failed to parse soccer PDF at ${tryUrl}: ${errorMessage}`);
                        continue;
                    }
                }

                throw new Error('Could not parse soccer stats from any URL');
            }

            // Special handling for Basketball (MBB/WBB) - return parsed JSON directly
            if (sport === 'mens-basketball' || sport === 'womens-basketball') {
                const { parseBasketballPdf } = await import('@/lib/parsers/basketball');

                // Try URLs with s3Region support
                const urls = generateStatsUrls(school.sidearmDomain, sport, school.s3Region);

                for (const tryUrl of urls) {
                    try {
                        const { players } = await parseBasketballPdf(tryUrl);
                        if (players.length > 0) {
                            return NextResponse.json({
                                success: true,
                                type: 'basketball',
                                data: { players }
                            });
                        }
                    } catch (e) {
                        const errorMessage = e instanceof Error ? e.message : String(e);
                        console.warn(`Failed to parse basketball PDF at ${tryUrl}: ${errorMessage}`);
                        continue;
                    }
                }

                throw new Error('Could not parse basketball stats from any URL');
            }

            // Special handling for Volleyball - return parsed JSON directly
            if (sport === 'womens-volleyball') {
                const { parseVolleyballPdf } = await import('@/lib/parsers/volleyball');

                // Try URLs with s3Region support
                const urls = generateStatsUrls(school.sidearmDomain, sport, school.s3Region);

                for (const tryUrl of urls) {
                    try {
                        const { players } = await parseVolleyballPdf(tryUrl);
                        if (players.length > 0) {
                            return NextResponse.json({
                                success: true,
                                type: 'volleyball',
                                data: { players }
                            });
                        }
                    } catch (e) {
                        const errorMessage = e instanceof Error ? e.message : String(e);
                        console.warn(`Failed to parse volleyball PDF at ${tryUrl}: ${errorMessage}`);
                        continue;
                    }
                }

                throw new Error('Could not parse volleyball stats from any URL');
            }

            // Special handling for Football - return parsed JSON directly
            if (sport === 'football') {
                const { parseFootballPdf } = await import('@/lib/parsers/football');

                // Try URLs with s3Region support
                const urls = generateStatsUrls(school.sidearmDomain, sport, school.s3Region);

                for (const tryUrl of urls) {
                    try {
                        const { players } = await parseFootballPdf(tryUrl);
                        if (players.length > 0) {
                            return NextResponse.json({
                                success: true,
                                type: 'football',
                                data: { players }
                            });
                        }
                    } catch (e) {
                        const errorMessage = e instanceof Error ? e.message : String(e);
                        console.warn(`Failed to parse football PDF at ${tryUrl}: ${errorMessage}`);
                        continue;
                    }
                }

                throw new Error('Could not parse football stats from any URL');
            }


            // Baseball/Softball — parse PDF and return structured data
            const { parsePdfStats } = await import('@/lib/parsers/baseball');
            const urls = generateStatsUrls(school.sidearmDomain, sport, school.s3Region);

            for (const tryUrl of urls) {
                try {
                    const text = await fetchAndParsePdf(tryUrl);
                    if (text && text.length > 100) {
                        const { batting, pitching } = parsePdfStats(text);
                        return NextResponse.json({
                            success: true,
                            type: 'baseball',
                            data: { batting, pitching },
                        });
                    }
                } catch {
                    continue;
                }
            }

            return NextResponse.json<PdfResponse>(
                { success: false, error: 'Could not find valid stats PDF for this school/sport' },
                { status: 404 }
            );
        }

        // No valid parameters provided
        return NextResponse.json<PdfResponse>(
            { success: false, error: 'Missing URL or schoolId/sport parameters' },
            { status: 400 }
        );

    } catch (error) {
        console.error('PDF fetch error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error occurred';

        return NextResponse.json<PdfResponse>(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
