// Soccer PDF parser - extracts player and goalie statistics from SIDEARM Sports PDFs
// @ts-ignore - Direct import avoids index.js side effects in Next.js build
import pdf from 'pdf-parse/lib/pdf-parse.js';

interface TextItem {
    str: string;
    x: number;
    y: number;
}

export interface SoccerPlayerRaw {
    number: string;
    name: string;
    gp: number;
    g: number;
    a: number;
    pts: number;
    sh: number;
    shPct: string;
    sog: number;
    sogPct: string;
    yc: number;
    rc: number;
    gw: number;
    pkAtt: string;
}

export interface SoccerGoalieRaw {
    number: string;
    name: string;
    gp: number;
    min: string;
    ga: number;
    gaa: string;
    save: number;
    pct: string;
    wlt: string;
    sho: number;
}

const PLAYER_COLUMNS = {
    jersey: { min: 215, max: 235 },
    name: { min: 236, max: 338 },
    gp: { min: 330, max: 350 },
    g: { min: 351, max: 370 },
    a: { min: 368, max: 385 },
    pts: { min: 384, max: 408 },
    sh: { min: 407, max: 430 },
    shPct: { min: 429, max: 462 },
    sog: { min: 460, max: 484 },
    sogPct: { min: 483, max: 518 },
    ycRc: { min: 517, max: 546 },
    gw: { min: 545, max: 568 },
    pkAtt: { min: 567, max: 600 },
};

const GOALIE_COLUMNS = {
    jersey: { min: 215, max: 235 },
    name: { min: 236, max: 338 },
    gp: { min: 330, max: 350 },
    min: { min: 350, max: 400 },
    ga: { min: 398, max: 420 },
    gaa: { min: 418, max: 448 },
    save: { min: 446, max: 480 },
    pct: { min: 478, max: 520 },
    wlt: { min: 518, max: 560 },
    sho: { min: 558, max: 600 },
};

function getItemInRange(items: TextItem[], min: number, max: number): string {
    const item = items.find(i => i.x >= min && i.x <= max);
    return item?.str || '';
}

export async function parseSoccerPdf(url: string): Promise<{ players: SoccerPlayerRaw[]; goalies: SoccerGoalieRaw[] }> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    let allItems: TextItem[] = [];

    await pdf(buffer, {
        pagerender: (pageData: any) => {
            return pageData.getTextContent({ normalizeWhitespace: false })
                .then((textContent: any) => {
                    allItems = textContent.items.map((item: any) => ({
                        str: item.str,
                        x: Math.round(item.transform[4]),
                        y: Math.round(item.transform[5]),
                    }));
                    return '';
                });
        }
    });

    const playerHeader = allItems.find(i => i.str === 'Player' && i.x > 200 && i.x < 280);
    const goalieHeader = allItems.find(i => i.str === 'Goalie' && i.x > 200 && i.x < 280);

    if (!playerHeader) {
        return { players: [], goalies: [] };
    }

    const playerHeaderY = playerHeader.y;
    const goalieHeaderY = goalieHeader?.y || 0;

    const rowMap = new Map<number, TextItem[]>();
    for (const item of allItems) {
        let foundRow = false;
        for (const [y, items] of rowMap) {
            if (Math.abs(item.y - y) <= 3) {
                items.push(item);
                foundRow = true;
                break;
            }
        }
        if (!foundRow) {
            rowMap.set(item.y, [item]);
        }
    }

    const players: SoccerPlayerRaw[] = [];
    const goalies: SoccerGoalieRaw[] = [];

    for (const [y, items] of rowMap) {
        items.sort((a, b) => a.x - b.x);

        const jersey = getItemInRange(items, PLAYER_COLUMNS.jersey.min, PLAYER_COLUMNS.jersey.max);
        if (!jersey || !jersey.match(/^\d+$/)) continue;

        const nameItems = items.filter(i => i.x > PLAYER_COLUMNS.name.min && i.x < PLAYER_COLUMNS.name.max);
        const name = nameItems.map(n => n.str).join(' ').trim();
        if (!name || name.includes('Total') || name.includes('Opponent')) continue;

        if (goalieHeaderY > 0 && y < goalieHeaderY && y > goalieHeaderY - 200) {
            const wlt = getItemInRange(items, GOALIE_COLUMNS.wlt.min, GOALIE_COLUMNS.wlt.max);
            // Goalie rows usually have these fields. WLT might be empty for some backups, so be lenient if jersey matches
            if (wlt.includes('-') || jersey) {
                goalies.push({
                    number: jersey,
                    name,
                    gp: parseInt(getItemInRange(items, GOALIE_COLUMNS.gp.min, GOALIE_COLUMNS.gp.max)) || 0,
                    min: getItemInRange(items, GOALIE_COLUMNS.min.min, GOALIE_COLUMNS.min.max),
                    ga: parseInt(getItemInRange(items, GOALIE_COLUMNS.ga.min, GOALIE_COLUMNS.ga.max)) || 0,
                    gaa: getItemInRange(items, GOALIE_COLUMNS.gaa.min, GOALIE_COLUMNS.gaa.max),
                    save: parseInt(getItemInRange(items, GOALIE_COLUMNS.save.min, GOALIE_COLUMNS.save.max)) || 0,
                    pct: getItemInRange(items, GOALIE_COLUMNS.pct.min, GOALIE_COLUMNS.pct.max),
                    wlt,
                    sho: parseInt(getItemInRange(items, GOALIE_COLUMNS.sho.min, GOALIE_COLUMNS.sho.max).split('/')[0]) || 0,
                });
            }
        } else if (y < playerHeaderY) {
            const ycRc = getItemInRange(items, PLAYER_COLUMNS.ycRc.min, PLAYER_COLUMNS.ycRc.max);
            const [yc, rc] = ycRc.includes('-') ? ycRc.split('-').map(Number) : [0, 0];

            players.push({
                number: jersey,
                name,
                gp: parseInt(getItemInRange(items, PLAYER_COLUMNS.gp.min, PLAYER_COLUMNS.gp.max)) || 0,
                g: parseInt(getItemInRange(items, PLAYER_COLUMNS.g.min, PLAYER_COLUMNS.g.max)) || 0,
                a: parseInt(getItemInRange(items, PLAYER_COLUMNS.a.min, PLAYER_COLUMNS.a.max)) || 0,
                pts: parseInt(getItemInRange(items, PLAYER_COLUMNS.pts.min, PLAYER_COLUMNS.pts.max)) || 0,
                sh: parseInt(getItemInRange(items, PLAYER_COLUMNS.sh.min, PLAYER_COLUMNS.sh.max)) || 0,
                shPct: getItemInRange(items, PLAYER_COLUMNS.shPct.min, PLAYER_COLUMNS.shPct.max),
                sog: parseInt(getItemInRange(items, PLAYER_COLUMNS.sog.min, PLAYER_COLUMNS.sog.max)) || 0,
                sogPct: getItemInRange(items, PLAYER_COLUMNS.sogPct.min, PLAYER_COLUMNS.sogPct.max),
                yc: yc || 0,
                rc: rc || 0,
                gw: parseInt(getItemInRange(items, PLAYER_COLUMNS.gw.min, PLAYER_COLUMNS.gw.max)) || 0,
                pkAtt: getItemInRange(items, PLAYER_COLUMNS.pkAtt.min, PLAYER_COLUMNS.pkAtt.max) || '0-0',
            });
        }
    }

    players.sort((a, b) => parseInt(a.number) - parseInt(b.number));
    goalies.sort((a, b) => parseInt(a.number) - parseInt(b.number));

    return { players, goalies };
}
