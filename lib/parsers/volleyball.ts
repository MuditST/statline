// Volleyball PDF parser with column-aware extraction
// @ts-ignore - Importing directly to avoid index.js side effects in Next.js build
import pdf from 'pdf-parse/lib/pdf-parse.js';

interface TextItem {
    str: string;
    x: number;
    y: number;
}

export interface VolleyballPlayerRaw {
    number: string;
    name: string;
    sp: number;       // Sets Played
    k: number;        // Kills
    kPerSet: string;  // Kills per set
    e: number;        // Errors
    ta: number;       // Total Attacks
    pct: string;      // Attack percentage
    a: number;        // Assists
    aPerSet: string;  // Assists per set
    sa: number;       // Service Aces
    se: number;       // Service Errors
    saPerSet: string; // Service Aces per set
    re: number;       // Receive Errors
    dig: number;      // Digs
    digPerSet: string;// Digs per set
    bs: number;       // Block Solo
    ba: number;       // Block Assists
    blk: string;      // Total Blocks (BS + 0.5*BA)
    blkPerSet: string;// Blocks per set
    be: number;       // Block Errors
    bhe: number;      // Ball Handling Errors
    pts: string;      // Points (decimal)
}

/**
 * Column X position ranges for volleyball stats
 * Based on GSU PDF analysis (Jan 2026)
 */
const PLAYER_COLUMNS = {
    jersey: { min: 15, max: 32 },
    name: { min: 33, max: 112 },
    sp: { min: 113, max: 125 },
    k: { min: 126, max: 155 },
    kPerSet: { min: 156, max: 180 },
    e: { min: 181, max: 200 },
    ta: { min: 201, max: 225 },
    pct: { min: 226, max: 255 },
    a: { min: 256, max: 275 },
    aPerSet: { min: 276, max: 305 },
    sa: { min: 306, max: 325 },
    se: { min: 326, max: 345 },
    saPerSet: { min: 346, max: 370 },
    re: { min: 371, max: 385 },
    dig: { min: 386, max: 408 },
    digPerSet: { min: 409, max: 438 },
    bs: { min: 439, max: 458 },
    ba: { min: 459, max: 478 },
    blk: { min: 479, max: 500 },
    blkPerSet: { min: 501, max: 530 },
    be: { min: 531, max: 548 },
    bhe: { min: 549, max: 568 },
    pts: { min: 569, max: 600 },
};

function getItemInRange(items: TextItem[], min: number, max: number): string {
    const item = items.find(i => i.x >= min && i.x <= max);
    return item?.str?.trim() || '';
}

/**
 * Fetch and parse volleyball PDF with column-aware extraction
 */
export async function parseVolleyballPdf(url: string): Promise<{ players: VolleyballPlayerRaw[] }> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Track items per page - we only want page 1
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
        if (rowText.includes('Player') && rowText.includes('SP') && rowText.includes('PTS')) {
            headerY = y;
            break;
        }
    }

    if (headerY === 0) {
        return { players: [] };
    }

    const players: VolleyballPlayerRaw[] = [];

    // Sort rows by Y descending (top to bottom)
    const sortedRows = [...rowMap.entries()].sort((a, b) => b[0] - a[0]);

    // Handle multi-line names (like "de Pinho, Maria" / "Cecilia")
    let pendingName = '';
    let pendingY = 0;

    for (const [y, items] of sortedRows) {
        // Skip header and above
        if (y >= headerY) continue;

        items.sort((a, b) => a.x - b.x);

        // First item must be jersey number
        const jersey = getItemInRange(items, PLAYER_COLUMNS.jersey.min, PLAYER_COLUMNS.jersey.max);

        // Check if this is a continuation line (name only, no jersey)
        if (!jersey && items.length < 5 && pendingY > 0) {
            // This might be a name continuation - skip it
            pendingName = items.map(i => i.str).join(' ').trim();
            continue;
        }

        if (!jersey || !jersey.match(/^\d+$/) || jersey === 'TM') continue;

        // Get name - join multiple items in name range
        const nameItems = items.filter(i => i.x > PLAYER_COLUMNS.name.min && i.x < PLAYER_COLUMNS.name.max);
        let name = nameItems.map(n => n.str).join(' ').replace(/\s+/g, ' ').trim();

        // If there was a pending name continuation, append it
        if (pendingName && Math.abs(pendingY - y) < 15) {
            name = `${pendingName} ${name}`.trim();
        }
        pendingName = '';
        pendingY = y;

        // Skip Total/Opponents/Team rows
        if (!name || name.includes('Total') || name.includes('Opponents') || name.includes('Team')) continue;

        players.push({
            number: jersey,
            name,
            sp: parseInt(getItemInRange(items, PLAYER_COLUMNS.sp.min, PLAYER_COLUMNS.sp.max)) || 0,
            k: parseInt(getItemInRange(items, PLAYER_COLUMNS.k.min, PLAYER_COLUMNS.k.max)) || 0,
            kPerSet: getItemInRange(items, PLAYER_COLUMNS.kPerSet.min, PLAYER_COLUMNS.kPerSet.max),
            e: parseInt(getItemInRange(items, PLAYER_COLUMNS.e.min, PLAYER_COLUMNS.e.max)) || 0,
            ta: parseInt(getItemInRange(items, PLAYER_COLUMNS.ta.min, PLAYER_COLUMNS.ta.max)) || 0,
            pct: getItemInRange(items, PLAYER_COLUMNS.pct.min, PLAYER_COLUMNS.pct.max),
            a: parseInt(getItemInRange(items, PLAYER_COLUMNS.a.min, PLAYER_COLUMNS.a.max)) || 0,
            aPerSet: getItemInRange(items, PLAYER_COLUMNS.aPerSet.min, PLAYER_COLUMNS.aPerSet.max),
            sa: parseInt(getItemInRange(items, PLAYER_COLUMNS.sa.min, PLAYER_COLUMNS.sa.max)) || 0,
            se: parseInt(getItemInRange(items, PLAYER_COLUMNS.se.min, PLAYER_COLUMNS.se.max)) || 0,
            saPerSet: getItemInRange(items, PLAYER_COLUMNS.saPerSet.min, PLAYER_COLUMNS.saPerSet.max),
            re: parseInt(getItemInRange(items, PLAYER_COLUMNS.re.min, PLAYER_COLUMNS.re.max)) || 0,
            dig: parseInt(getItemInRange(items, PLAYER_COLUMNS.dig.min, PLAYER_COLUMNS.dig.max)) || 0,
            digPerSet: getItemInRange(items, PLAYER_COLUMNS.digPerSet.min, PLAYER_COLUMNS.digPerSet.max),
            bs: parseInt(getItemInRange(items, PLAYER_COLUMNS.bs.min, PLAYER_COLUMNS.bs.max)) || 0,
            ba: parseInt(getItemInRange(items, PLAYER_COLUMNS.ba.min, PLAYER_COLUMNS.ba.max)) || 0,
            blk: getItemInRange(items, PLAYER_COLUMNS.blk.min, PLAYER_COLUMNS.blk.max),
            blkPerSet: getItemInRange(items, PLAYER_COLUMNS.blkPerSet.min, PLAYER_COLUMNS.blkPerSet.max),
            be: parseInt(getItemInRange(items, PLAYER_COLUMNS.be.min, PLAYER_COLUMNS.be.max)) || 0,
            bhe: parseInt(getItemInRange(items, PLAYER_COLUMNS.bhe.min, PLAYER_COLUMNS.bhe.max)) || 0,
            pts: getItemInRange(items, PLAYER_COLUMNS.pts.min, PLAYER_COLUMNS.pts.max),
        });
    }

    // Sort by jersey number (treating "00" as 99, "0" as 90)
    players.sort((a, b) => {
        const numA = a.number === '00' ? 99 : a.number === '0' ? 90 : parseInt(a.number);
        const numB = b.number === '00' ? 99 : b.number === '0' ? 90 : parseInt(b.number);
        return numA - numB;
    });

    return { players };
}
