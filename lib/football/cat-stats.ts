import { FootballPlayerRaw } from "@/lib/parsers/football";

export interface CatStat {
    label: string;
    value: string | number;
}

export interface FootballCatStats {
    category: 'Passing' | 'Rushing' | 'Receiving' | 'Defense' | 'Kicking' | 'Punting' | 'General';
    stats: CatStat[];
}

/**
 * Format a CAT value for display (matches soccer format)
 * Returns "VALUE LABEL" format e.g., "1004 YDS"
 */
export function formatCatValue(value: number | string | undefined, label: string): string {
    if (value === undefined || value === '' || value === '-' || value === '—' || value === '–' || label === '') return '';
    // Replace em-dashes/en-dashes in values with regular dashes
    const cleanValue = String(value).replace(/[\u2013\u2014]/g, '-');
    return `${cleanValue} ${label}`;
}

export function getFootballCatStats(player: FootballPlayerRaw): FootballCatStats {
    // Determine Category Priority

    // 1. Passing
    if (player.passing && player.passing.att > 0) {
        const passing = player.passing;
        const passAtt = passing.att;
        const rushAtt = player.rushing?.att || 0;

        if (passAtt > 10 || passAtt > rushAtt) {
            return {
                category: 'Passing',
                stats: [
                    { label: 'PCT', value: ((passing.comp / passing.att) * 100).toFixed(1) + '%' },
                    { label: 'YDS', value: passing.yds },
                    { label: 'TD', value: passing.td },
                    { label: 'INT', value: passing.int }
                ]
            };
        }
    }

    // 2. Rushing
    if (player.rushing && player.rushing.att > 0) {
        const rushing = player.rushing;
        const rushAtt = rushing.att;
        const recNo = player.receiving?.no || 0;

        if (rushAtt >= recNo) {
            return {
                category: 'Rushing',
                stats: [
                    { label: 'CAR', value: rushing.att },
                    { label: 'YDS', value: rushing.net || rushing.gain },
                    { label: 'AVG', value: rushing.avg },
                    { label: 'TD', value: rushing.td }
                ]
            };
        }
    }

    // 3. Receiving
    if (player.receiving && player.receiving.no > 0) {
        const receiving = player.receiving;
        return {
            category: 'Receiving',
            stats: [
                { label: 'REC', value: receiving.no },
                { label: 'YDS', value: receiving.yds },
                { label: 'AVG', value: receiving.avg },
                { label: 'TD', value: receiving.td }
            ]
        };
    }

    // 4. Defense - 5 stats
    if (player.defense && player.defense.tot > 0) {
        const defense = player.defense;
        return {
            category: 'Defense',
            stats: [
                { label: 'TKLS', value: defense.tot },
                { label: 'TFL', value: defense.tfl || 0 },
                { label: 'SACKS', value: defense.sacks || 0 },
                { label: 'PBU', value: defense.pbu || 0 },
                { label: 'INT', value: defense.int || 0 }
            ]
        };
    }

    // 5. Punting
    if (player.punting && player.punting.no > 0) {
        const punting = player.punting;
        return {
            category: 'Punting',
            stats: [
                { label: 'PUNTS', value: punting.no },
                { label: 'AVG', value: punting.avg },
                { label: 'LONG', value: punting.long },
                { label: 'I20', value: punting.i20 }
            ]
        };
    }

    // 6. Kicking (Field Goals)
    if (player.kicking && player.kicking.fga > 0) {
        const kicking = player.kicking;
        return {
            category: 'Kicking',
            stats: [
                { label: 'FG', value: `${kicking.fgm}/${kicking.fga}` },
                { label: 'PCT', value: kicking.pct + '%' },
                { label: 'LONG', value: kicking.long },
                { label: 'PTS', value: kicking.pts }
            ]
        };
    }

    return {
        category: 'General',
        stats: []
    };
}
