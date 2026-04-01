import { NextRequest, NextResponse } from 'next/server';
import type { SportType } from '@/types';
import { getConfiguredSchoolOptionsForSport } from '@/lib/schools/resolved';

export async function GET(request: NextRequest) {
    const sport = request.nextUrl.searchParams.get('sport') as SportType | null;

    if (!sport) {
        return NextResponse.json(
            { success: false, error: 'Missing sport query parameter' },
            { status: 400 }
        );
    }

    try {
        const schools = await getConfiguredSchoolOptionsForSport(sport);
        return NextResponse.json({
            success: true,
            data: schools,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
