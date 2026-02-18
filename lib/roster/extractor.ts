import * as cheerio from 'cheerio';

/**
 * Roster player data - matches Excel export format
 */
export interface RosterPlayer {
    lastName: string;
    firstName: string;
    number: string;
    position: string;
    bats: string;      // May be empty
    throws: string;    // May be empty
    hometown: string;
    state: string;
    height: string;    // Format: 6'2"
    weight: string;    // May be empty
    year: string;      // 1, 2, 3, 4
    age: string;       // May be empty (MM/DD/YY format)
}

/**
 * Abbreviate spelled-out position names (WMT rosters use "Guard", "Forward", etc.)
 * Sidearm rosters already use abbreviations (G, F, C) — those pass through unchanged.
 */
function abbreviatePosition(pos: string): string {
    if (!pos) return '';
    // If already short (1-3 chars like G, F, C, IF, OF, RHP) keep as-is
    if (pos.length <= 3 && !pos.includes('/')) return pos;

    const abbrevMap: Record<string, string> = {
        'guard': 'G',
        'forward': 'F',
        'center': 'C',
        'point guard': 'PG',
        'shooting guard': 'SG',
        'small forward': 'SF',
        'power forward': 'PF',
        // Volleyball
        'setter': 'S',
        'libero': 'L',
        'outside hitter': 'OH',
        'middle blocker': 'MB',
        'opposite': 'OPP',
        'defensive specialist': 'DS',
        'right side hitter': 'RS',
        // Baseball
        'pitcher': 'P',
        'catcher': 'C',
        'infielder': 'IF',
        'outfielder': 'OF',
        'designated hitter': 'DH',
        'utility': 'UTL',
        'first base': '1B',
        'second base': '2B',
        'third base': '3B',
        'shortstop': 'SS',
    };

    // Handle compound positions: "Guard/Forward" → "G/F"
    if (pos.includes('/')) {
        return pos.split('/').map(p => abbreviatePosition(p.trim())).join('/');
    }

    return abbrevMap[pos.toLowerCase()] || pos;
}

/**
 * Fetches and parses roster data from a print roster page
 * 
 * @param url - Print roster URL (e.g., https://site.com/sports/baseball/roster?print=true)
 * @returns Array of roster players
 */
export async function extractRoster(url: string): Promise<RosterPlayer[]> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch roster: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const players: RosterPlayer[] = [];

    // Find the roster table - look for table with jersey number column
    const tables = $('table');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rosterTableEl: any = null;

    tables.each((_, table) => {
        const headerRow = $(table).find('tr').first();
        const headers: string[] = [];
        headerRow.find('th, td').each((__, el) => {
            headers.push($(el).text().trim().toLowerCase());
        });

        // Check if this table has roster-like headers
        const hasJerseyCol = headers.some((h: string) => h === '#' || h === 'no.' || h === 'no' || h === 'number' || h.startsWith('#') || h.includes('jersey'));
        const hasNameCol = headers.some((h: string) => h.includes('name'));

        if (hasJerseyCol && hasNameCol) {
            rosterTableEl = table;
            return false; // break
        }
    });

    if (!rosterTableEl) {
        throw new Error('Could not find roster table on page');
    }

    const rosterTable = $(rosterTableEl);

    // Get header indices
    const headerRow = rosterTable.find('tr').first();
    const headers: string[] = [];
    headerRow.find('th, td').each((_, el) => {
        headers.push($(el).text().trim().toLowerCase());
    });

    const getIndex = (patterns: string[], skipIdx?: number): number => {
        return headers.findIndex((h: string, i: number) => {
            if (skipIdx !== undefined && i === skipIdx) return false;
            return patterns.some((p: string) => h.includes(p));
        });
    };

    const jerseyIdx = getIndex(['#', 'no.', 'no', 'number']);
    const nameIdx = getIndex(['name', 'full name'], jerseyIdx);  // skip jersey col
    const posIdx = getIndex(['pos', 'position']);
    const htIdx = getIndex(['ht', 'height']);
    const wtIdx = getIndex(['wt', 'weight']);
    const yearIdx = getIndex(['year', 'academic', 'yr', 'cl.', 'cl', 'class', 'elig']);
    const hometownIdx = getIndex(['hometown', 'high school']);
    const btIdx = getIndex(['b/t', 'bats']);

    // Parse each row
    const rows = rosterTable.find('tr').slice(1); // skip header

    rows.each((_, row) => {
        const cells = $(row).find('td, th');
        if (cells.length < 3) return; // skip empty rows

        const getText = (idx: number): string => {
            if (idx < 0 || idx >= cells.length) return '';
            return $(cells[idx]).text().trim();
        };

        const jerseyNumber = getText(jerseyIdx);
        const fullName = getText(nameIdx);
        const position = getText(posIdx);
        const height = getText(htIdx);
        const weight = getText(wtIdx);
        const year = getText(yearIdx);
        const hometownFull = getText(hometownIdx);

        // Parse B/T column if available (e.g. "R/R", "L/R")
        const btRaw = getText(btIdx);
        let bats = '';
        let throws_ = '';
        if (btRaw && btRaw.includes('/')) {
            const [b, t] = btRaw.split('/');
            bats = b.trim();
            throws_ = t.trim();
        }

        // Skip if no name (jersey number may be empty for some schools)
        if (!fullName) return;

        // Parse name into first/last
        const nameParts = splitName(fullName);

        // Parse hometown/state/high school
        const locationParts = parseHometown(hometownFull);

        // Combine city and state for display (e.g., "Gulf Shores, Ala")
        const hometownDisplay = locationParts.state
            ? `${locationParts.city}, ${locationParts.state}`
            : locationParts.city;

        players.push({
            number: jerseyNumber,
            firstName: nameParts.firstName,
            lastName: nameParts.lastName,
            position: abbreviatePosition(position),
            bats,
            throws: throws_,
            hometown: hometownDisplay,
            state: locationParts.state,
            height: formatHeight(height),
            weight: weight,
            year: yearToNumber(year),
            age: '',       // Not available from print roster
        });
    });

    // Sort by jersey number - 0 and 00 go to the end
    players.sort((a, b) => {
        const toSortKey = (num: string) => {
            if (num === '0') return 100;
            if (num === '00') return 101;
            return parseInt(num) || 0;
        };
        return toSortKey(a.number) - toSortKey(b.number);
    });

    return players;
}

/**
 * Split full name into first and last name
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
    // Handle "Last, First" format
    if (fullName.includes(',')) {
        const [last, first] = fullName.split(',').map(s => s.trim());
        return { firstName: first || '', lastName: last || '' };
    }

    // Handle "First Last" format
    const parts = fullName.split(' ').filter(Boolean);
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' };
    }

    // Last part is last name, rest is first name
    const lastName = parts.pop() || '';
    const firstName = parts.join(' ');

    return { firstName, lastName };
}

/**
 * Parse hometown string into city, state, and high school
 * Returns city as "City, State" format when state is present
 */
function parseHometown(hometown: string): { city: string; state: string; highSchool: string } {
    if (!hometown) {
        return { city: '', state: '', highSchool: '' };
    }

    // Split by "/" to separate high school
    const [location, ...schoolParts] = hometown.split('/').map(s => s.trim());
    const highSchool = schoolParts.join(' / ').trim();

    // Parse city and state from location (handles "City, State" or "City, St." format)
    const locationMatch = location.match(/^(.+?),\s*([A-Za-z.]+)\.?$/);

    if (locationMatch) {
        const cityName = locationMatch[1].trim();
        // Clean up state abbreviation (remove period)
        const stateName = locationMatch[2].trim().replace('.', '');
        return {
            city: `${cityName}`,  // Just city name
            state: stateName,
            highSchool,
        };
    }

    return { city: location, state: '', highSchool };
}

/**
 * Format height from "5-9" or "5-10" to "5'9" or "5'10" format
 */
function formatHeight(height: string): string {
    if (!height) return '';

    // Already in correct format
    if (height.includes("'")) return height;

    // Convert "5-9" to "5'9"
    const match = height.match(/^(\d+)-(\d+)$/);
    if (match) {
        return `${match[1]}'${match[2]}`;
    }

    return height;
}

/**
 * Convert year string to number (1-FR, 2-SO, 3-JR, 4-SR/GR)
 */
function yearToNumber(year: string): string {
    const normalized = year.toLowerCase().trim();

    // Already a number
    if (/^\d+$/.test(normalized)) return normalized;

    // Map year strings to numbers
    if (normalized.includes('fr') || normalized.includes('fy')) return '1';
    if (normalized.includes('so')) return '2';
    if (normalized.includes('jr') || normalized.includes('jun')) return '3';
    if (normalized.includes('sr') || normalized.includes('sen') || normalized.includes('gr')) return '4';

    return '';
}
