// Basketball PDF parser - extracts player statistics from SIDEARM Sports PDFs
// @ts-ignore - Direct import avoids index.js side effects in Next.js build
import pdf from 'pdf-parse/lib/pdf-parse.js';

interface TextItem {
    str: string;
    x: number;
    y: number;
}

export interface BasketballPlayerRaw {
    number: string;
    name: string;
    gpGs: string;
    min: number;
    minAvg: string;
    fgMade: number;
    fgAtt: number;
    fgPct: string;
    threeFgFga: string;
    threeFgPct: string;
    ftFta: string;
    ftPct: string;
    offReb: number;
    defReb: number;
    totReb: number;
    rebAvg: string;
    pf: number;
    dq: number;
    ast: number;
    to: number;
    blk: number;
    stl: number;
    pts: number;
    ptsAvg: string;
}

// Column X position ranges for basketball stats PDF
const PLAYER_COLUMNS = {
    jersey: { min: 15, max: 32 },
    name: { min: 33, max: 120 },
    gpGs: { min: 121, max: 148 },
    min: { min: 149, max: 170 },
    minAvg: { min: 171, max: 198 },
    fgFga: { min: 199, max: 234 },
    fgPct: { min: 235, max: 258 },
    threeFgFga: { min: 259, max: 292 },
    threeFgPct: { min: 293, max: 318 },
    ftFta: { min: 315, max: 348 },
    ftPct: { min: 349, max: 372 },
    offReb: { min: 373, max: 392 },
    defReb: { min: 393, max: 412 },
    totReb: { min: 413, max: 432 },
    rebAvg: { min: 433, max: 452 },
    pf: { min: 453, max: 468 },
    dq: { min: 469, max: 484 },
    ast: { min: 485, max: 502 },
    to: { min: 503, max: 518 },
    blk: { min: 519, max: 535 },
    stl: { min: 536, max: 554 },
    pts: { min: 555, max: 575 },
    ptsAvg: { min: 576, max: 600 },
};

function getItemInRange(items: TextItem[], min: number, max: number): string {
    const item = items.find(i => i.x >= min && i.x <= max);
    return item?.str?.trim() || '';
}

function parseFgFga(fgFga: string): { made: number; att: number } {
    const match = fgFga.match(/^(\d+)-(\d+)$/);
    if (match) {
        return { made: parseInt(match[1]), att: parseInt(match[2]) };
    }
    return { made: 0, att: 0 };
}

export async function parseBasketballPdf(url: string): Promise<{ players: BasketballPlayerRaw[] }> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    let currentPage = 0;
    let page1Items: TextItem[] = [];

    await pdf(buffer, {
        pagerender: (pageData: any) => {
            currentPage++;
            return pageData.getTextContent({ normalizeWhitespace: false })
                .then((textContent: any) => {
                    if (currentPage === 1) {
                        page1Items = textContent.items.map((item: any) => ({
                            str: item.str,
                            x: Math.round(item.transform[4]),
                            y: Math.round(item.transform[5]),
                        }));
                    }
                    return '';
                });
        }
    });

    if (page1Items.length === 0) {
        return { players: [] };
    }

    // Group items by Y position (rows)
    const rowMap = new Map<number, TextItem[]>();
    for (const item of page1Items) {
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

    // Find header row to identify data section
    let headerY = 0;
    for (const [y, items] of rowMap) {
        const rowText = items.map(i => i.str).join(' ');
        if (rowText.includes('GP-GS') && rowText.includes('FG-FGA')) {
            headerY = y;
            break;
        }
    }

    if (headerY === 0) {
        return { players: [] };
    }

    const players: BasketballPlayerRaw[] = [];
    const seenJerseys = new Set<string>();

    const sortedRows = [...rowMap.entries()].sort((a, b) => b[0] - a[0]);

    for (const [y, items] of sortedRows) {
        if (y >= headerY) continue;

        items.sort((a, b) => a.x - b.x);

        const jersey = getItemInRange(items, PLAYER_COLUMNS.jersey.min, PLAYER_COLUMNS.jersey.max);
        if (!jersey || !jersey.match(/^\d+$/)) continue;

        const nameItems = items.filter(i => i.x > PLAYER_COLUMNS.name.min && i.x < PLAYER_COLUMNS.name.max);
        const name = nameItems.map(n => n.str).join(' ').replace(/\s+/g, ' ').trim();

        if (!name || name.includes('Total') || name.includes('Opponents')) continue;
        if (seenJerseys.has(jersey)) continue;
        seenJerseys.add(jersey);

        const fgFgaStr = getItemInRange(items, PLAYER_COLUMNS.fgFga.min, PLAYER_COLUMNS.fgFga.max);
        const { made: fgMade, att: fgAtt } = parseFgFga(fgFgaStr);

        players.push({
            number: jersey,
            name,
            gpGs: getItemInRange(items, PLAYER_COLUMNS.gpGs.min, PLAYER_COLUMNS.gpGs.max),
            min: parseInt(getItemInRange(items, PLAYER_COLUMNS.min.min, PLAYER_COLUMNS.min.max)) || 0,
            minAvg: getItemInRange(items, PLAYER_COLUMNS.minAvg.min, PLAYER_COLUMNS.minAvg.max),
            fgMade,
            fgAtt,
            fgPct: getItemInRange(items, PLAYER_COLUMNS.fgPct.min, PLAYER_COLUMNS.fgPct.max),
            threeFgFga: getItemInRange(items, PLAYER_COLUMNS.threeFgFga.min, PLAYER_COLUMNS.threeFgFga.max),
            threeFgPct: getItemInRange(items, PLAYER_COLUMNS.threeFgPct.min, PLAYER_COLUMNS.threeFgPct.max),
            ftFta: getItemInRange(items, PLAYER_COLUMNS.ftFta.min, PLAYER_COLUMNS.ftFta.max),
            ftPct: getItemInRange(items, PLAYER_COLUMNS.ftPct.min, PLAYER_COLUMNS.ftPct.max),
            offReb: parseInt(getItemInRange(items, PLAYER_COLUMNS.offReb.min, PLAYER_COLUMNS.offReb.max)) || 0,
            defReb: parseInt(getItemInRange(items, PLAYER_COLUMNS.defReb.min, PLAYER_COLUMNS.defReb.max)) || 0,
            totReb: parseInt(getItemInRange(items, PLAYER_COLUMNS.totReb.min, PLAYER_COLUMNS.totReb.max)) || 0,
            rebAvg: getItemInRange(items, PLAYER_COLUMNS.rebAvg.min, PLAYER_COLUMNS.rebAvg.max),
            pf: parseInt(getItemInRange(items, PLAYER_COLUMNS.pf.min, PLAYER_COLUMNS.pf.max)) || 0,
            dq: parseInt(getItemInRange(items, PLAYER_COLUMNS.dq.min, PLAYER_COLUMNS.dq.max)) || 0,
            ast: parseInt(getItemInRange(items, PLAYER_COLUMNS.ast.min, PLAYER_COLUMNS.ast.max)) || 0,
            to: parseInt(getItemInRange(items, PLAYER_COLUMNS.to.min, PLAYER_COLUMNS.to.max)) || 0,
            blk: parseInt(getItemInRange(items, PLAYER_COLUMNS.blk.min, PLAYER_COLUMNS.blk.max)) || 0,
            stl: parseInt(getItemInRange(items, PLAYER_COLUMNS.stl.min, PLAYER_COLUMNS.stl.max)) || 0,
            pts: parseInt(getItemInRange(items, PLAYER_COLUMNS.pts.min, PLAYER_COLUMNS.pts.max)) || 0,
            ptsAvg: getItemInRange(items, PLAYER_COLUMNS.ptsAvg.min, PLAYER_COLUMNS.ptsAvg.max),
        });
    }

    // Sort by jersey number (00 -> 99, 0 -> 90)
    players.sort((a, b) => {
        const numA = a.number === '00' ? 99 : a.number === '0' ? 90 : parseInt(a.number);
        const numB = b.number === '00' ? 99 : b.number === '0' ? 90 : parseInt(b.number);
        return numA - numB;
    });

    return { players };
}
