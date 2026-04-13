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

type CheerioSelection = cheerio.Cheerio<any>;

interface SidearmEmbeddedPlayer {
    first_name?: string;
    last_name?: string;
    hometown?: string | null;
    highschool?: string | null;
    previous_school?: string | null;
    weight?: number | string | null;
    height_feet?: number | string | null;
    height_inches?: number | string | null;
    position_short?: string | null;
    position_long?: string | null;
    jersey_number?: string | null;
    jersey_number_2?: string | null;
    academic_year_short?: string | null;
    academic_year_number?: number | string | null;
    custom1?: string | null;
    custom2?: string | null;
    custom3?: string | null;
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
        'right handed pitcher': 'RHP',
        'left handed pitcher': 'LHP',
        'right-handed pitcher': 'RHP',
        'left-handed pitcher': 'LHP',
        'catcher': 'C',
        'infielder': 'IF',
        'outfielder': 'OF',
        'designated hitter': 'DH',
        'utility': 'UTL',
        'first base': '1B',
        'first baseman': '1B',
        'second base': '2B',
        'second baseman': '2B',
        'third base': '3B',
        'third baseman': '3B',
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

    // Find the roster table - look for table with jersey number column
    const tables = $('table');
    let rosterTable: CheerioSelection | null = null;

    tables.each((_, table) => {
        const candidateTable = $(table);
        const headerRow = candidateTable.find('tr').first();
        const headers: string[] = [];
        headerRow.find('th, td').each((__, el) => {
            headers.push($(el).text().trim().toLowerCase());
        });

        // Check if this table has roster-like headers
        const hasJerseyCol = headers.some((h: string) => h === '#' || h === 'no.' || h === 'no' || h === 'num' || h === 'number' || h.startsWith('#') || h.includes('jersey'));
        const hasNameCol = headers.some((h: string) => h.includes('name') || h.includes('player'));

        if (hasJerseyCol && hasNameCol) {
            rosterTable = candidateTable;
            return false; // break
        }
    });
    const tablePlayers = rosterTable ? extractRosterFromTable($, rosterTable) : [];
    if (tablePlayers.length > 0) {
        return sortRosterPlayers(tablePlayers);
    }

    const embeddedPlayers = extractRosterFromEmbeddedSidearmJson(html);
    if (embeddedPlayers.length > 0) {
        return sortRosterPlayers(embeddedPlayers);
    }

    const cardPlayers = extractRosterFromRenderedCards($);
    if (cardPlayers.length > 0) {
        return sortRosterPlayers(cardPlayers);
    }

    throw new Error('Could not find roster data on page');
}

function extractRosterFromTable($: cheerio.CheerioAPI, rosterTable: CheerioSelection): RosterPlayer[] {
    const players: RosterPlayer[] = [];

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

    const jerseyIdx = getIndex(['#', 'no.', 'no', 'num', 'number']);
    const nameIdx = getIndex(['name', 'full name', 'player'], jerseyIdx);
    const posIdx = getIndex(['pos', 'position']);
    const htIdx = getIndex(['ht', 'height', 'hgt']);
    const wtIdx = getIndex(['wt', 'weight', 'wgt']);
    const yearIdx = getIndex(['year', 'academic', 'yr', 'cl.', 'cl', 'class', 'elig']);
    const hometownIdx = getIndex(['hometown', 'high school']);
    const btIdx = getIndex(['b/t', 'bats', 'throws', 'custom field 1']);

    const rows = rosterTable.find('tr').slice(1);

    rows.each((_, row) => {
        const cells = $(row).find('td, th');
        if (cells.length < 3) return;

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

        const btRaw = getText(btIdx);
        let bats = '';
        let throws_ = '';
        if (btRaw && btRaw.includes('/')) {
            const [b, t] = btRaw.split('/');
            bats = b.trim();
            throws_ = t.trim();
        }

        if (!fullName) return;

        const nameParts = splitName(fullName);
        const locationParts = parseHometown(hometownFull);
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
            age: '',
        });
    });

    return players;
}

function extractRosterFromEmbeddedSidearmJson(html: string): RosterPlayer[] {
    const players = findEmbeddedSidearmPlayers(html);
    if (!players) {
        return [];
    }

    return players
        .map(mapEmbeddedSidearmPlayer)
        .filter((player): player is RosterPlayer => player !== null);
}

function extractRosterFromRenderedCards($: cheerio.CheerioAPI): RosterPlayer[] {
    const oldSidearmPlayers = extractRosterFromOldSidearmCards($);
    if (oldSidearmPlayers.length > 0) {
        return oldSidearmPlayers;
    }

    return extractRosterFromModernCards($);
}

function extractRosterFromOldSidearmCards($: cheerio.CheerioAPI): RosterPlayer[] {
    const players: RosterPlayer[] = [];

    $('li.sidearm-roster-player').each((_, card) => {
        const cardEl = $(card);
        const fullName = cleanText(
            cardEl.find('.sidearm-roster-player-name a').first().text()
            || cardEl.find('.sidearm-roster-player-name').first().text()
        );

        if (!fullName) {
            return;
        }

        const number = cleanText(cardEl.find('.sidearm-roster-player-jersey-number').first().text());
        const metaTexts = cardEl.find('.sidearm-roster-player-position span')
            .map((__, el) => cleanText($(el).text()))
            .get()
            .filter(Boolean);

        const position = metaTexts.find(value => isPositionLike(value)) || '';
        const year = metaTexts.find(value => yearToNumber(value) !== '') || '';
        const height = metaTexts.find(value => /'|\d+-\d+/.test(value)) || '';
        const weight = metaTexts.find(value => /\d/.test(value) && /lb/i.test(value) || /^\d+$/.test(value)) || '';
        const btRaw = metaTexts.find(value => isBtLike(value)) || '';
        const [bats = '', throws_ = ''] = btRaw.split('/').map(value => value.trim());
        const hometown = cleanText(cardEl.find('.sidearm-roster-player-hometown').first().text());
        const highSchool = cleanText(cardEl.find('.sidearm-roster-player-highschool').first().text())
            || cleanText(cardEl.find('.sidearm-roster-player-previous-school').first().text());

        const player = buildRosterPlayer({
            fullName,
            number,
            position: normalizePositionValue(position),
            bats,
            throws: throws_,
            hometown,
            highSchool,
            height,
            weight: normalizeWeight(weight),
            year,
        });

        if (player) {
            players.push(player);
        }
    });

    return players;
}

function extractRosterFromModernCards($: cheerio.CheerioAPI): RosterPlayer[] {
    const players: RosterPlayer[] = [];

    $('[data-test-id="s-person-card-list__root"], .s-person-card--list').each((_, card) => {
        const cardEl = $(card);
        const fullName = cleanText(cardEl.find('h3').first().text());

        if (!fullName) {
            return;
        }

        const number = stripFieldLabel(
            cleanText(cardEl.find('.s-stamp__text').first().text()),
            ['Jersey Number']
        );
        const position = stripFieldLabel(
            cleanText(cardEl.find('[data-test-id="s-person-details__bio-stats-person-position-short"]').first().text()),
            ['Position']
        );
        const year = stripFieldLabel(
            cleanText(cardEl.find('[data-test-id="s-person-details__bio-stats-person-title"]').first().text()),
            ['Academic Year', 'Class', 'Year']
        );
        const height = stripFieldLabel(
            cleanText(cardEl.find('[data-test-id="s-person-details__bio-stats-person-season"]').first().text()),
            ['Height', 'Season']
        );
        const weight = stripFieldLabel(
            cleanText(cardEl.find('[data-test-id="s-person-details__bio-stats-person-weight"]').first().text()),
            ['Weight']
        ).replace(/\s*lbs?\.?$/i, '');
        const btRaw = cardEl.find('.s-person-details__bio-stats-item')
            .map((__, el) => stripFieldLabel(cleanText($(el).text()), ['B/T', 'Throws', 'Bats']))
            .get()
            .find(value => isBtLike(value)) || '';
        const [bats = '', throws_ = ''] = btRaw.split('/').map(value => value.trim());
        const hometown = stripFieldLabel(
            cleanText(cardEl.find('[data-test-id="s-person-card-list__content-location-person-hometown"]').first().text()),
            ['Hometown']
        );
        const highSchool = stripFieldLabel(
            cleanText(cardEl.find('[data-test-id="s-person-card-list__content-location-person-high-school"]').first().text()),
            ['High School', 'Previous School']
        );

        if (!number && !position && !year) {
            return;
        }

        const player = buildRosterPlayer({
            fullName,
            number,
            position: normalizePositionValue(position),
            bats,
            throws: throws_,
            hometown,
            highSchool,
            height,
            weight: normalizeWeight(weight),
            year,
        });

        if (player) {
            players.push(player);
        }
    });

    return players;
}

function findEmbeddedSidearmPlayers(html: string): SidearmEmbeddedPlayer[] | null {
    const key = '"players":[';
    let startIndex = html.indexOf(key);

    while (startIndex >= 0) {
        const arrayStart = html.indexOf('[', startIndex);
        if (arrayStart < 0) {
            return null;
        }

        const arrayEnd = findMatchingBracketIndex(html, arrayStart);
        if (arrayEnd < 0) {
            return null;
        }

        const rawArray = html.slice(arrayStart, arrayEnd + 1);

        try {
            const parsed = JSON.parse(rawArray);
            if (
                Array.isArray(parsed)
                && parsed.some((player) =>
                    player
                    && typeof player === 'object'
                    && ('first_name' in player || 'last_name' in player)
                )
            ) {
                return parsed as SidearmEmbeddedPlayer[];
            }
        } catch {
            // Keep searching for the next possible players payload.
        }

        startIndex = html.indexOf(key, startIndex + key.length);
    }

    return null;
}

function findMatchingBracketIndex(text: string, startIndex: number): number {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < text.length; i += 1) {
        const char = text[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (inString) {
            continue;
        }

        if (char === '[') {
            depth += 1;
        } else if (char === ']') {
            depth -= 1;
            if (depth === 0) {
                return i;
            }
        }
    }

    return -1;
}

function mapEmbeddedSidearmPlayer(player: SidearmEmbeddedPlayer): RosterPlayer | null {
    const fullName = [player.first_name?.trim(), player.last_name?.trim()]
        .filter(Boolean)
        .join(' ')
        .trim();

    if (!fullName) {
        return null;
    }

    const nameParts = splitName(fullName);
    const number = player.jersey_number_2?.trim() || player.jersey_number?.trim() || '';
    const btRaw = [player.custom1, player.custom2, player.custom3]
        .map(value => value?.trim() || '')
        .find(value => /^[a-z]\/[a-z]$/i.test(value)) || '';
    const [bats = '', throws_ = ''] = btRaw.split('/').map(value => value.trim());
    const hometownFull = [player.hometown?.trim(), player.highschool?.trim()]
        .filter(Boolean)
        .join(' / ');
    const locationParts = parseHometown(hometownFull);
    const hometownDisplay = locationParts.state
        ? `${locationParts.city}, ${locationParts.state}`
        : locationParts.city;

    return {
        number,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        position: abbreviatePosition(player.position_short?.trim() || player.position_long?.trim() || ''),
        bats,
        throws: throws_,
        hometown: hometownDisplay,
        state: locationParts.state,
        height: formatEmbeddedHeight(player.height_feet, player.height_inches),
        weight: player.weight != null ? String(player.weight).trim() : '',
        year: yearToNumber(player.academic_year_short?.trim() || String(player.academic_year_number ?? '').trim()),
        age: '',
    };
}

function buildRosterPlayer(input: {
    fullName: string;
    number: string;
    position: string;
    bats: string;
    throws: string;
    hometown: string;
    highSchool: string;
    height: string;
    weight: string;
    year: string;
}): RosterPlayer | null {
    if (!input.fullName) {
        return null;
    }

    const nameParts = splitName(input.fullName);
    const hometownFull = [input.hometown, input.highSchool].filter(Boolean).join(' / ');
    const locationParts = parseHometown(hometownFull);
    const hometownDisplay = locationParts.state
        ? `${locationParts.city}, ${locationParts.state}`
        : locationParts.city;

    return {
        number: input.number,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        position: abbreviatePosition(input.position),
        bats: input.bats,
        throws: input.throws,
        hometown: hometownDisplay,
        state: locationParts.state,
        height: formatHeight(input.height),
        weight: input.weight,
        year: yearToNumber(input.year),
        age: '',
    };
}

function cleanText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function stripFieldLabel(value: string, labels: string[]): string {
    let cleaned = value.trim();

    for (const label of labels) {
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cleaned = cleaned.replace(new RegExp(`^${escaped}\\s*:?\\s*`, 'i'), '').trim();
    }

    return cleaned;
}

function normalizeWeight(value: string): string {
    return value.replace(/\s*lbs?\.?$/i, '').trim();
}

function normalizePositionValue(value: string): string {
    const cleaned = value.trim();
    if (!cleaned) {
        return '';
    }

    const trailingShortCode = cleaned.match(/([A-Z]{1,4}(?:\/[A-Z]{1,4})*)$/);
    if (trailingShortCode) {
        return trailingShortCode[1];
    }

    return cleaned;
}

function isBtLike(value: string): boolean {
    return /^[a-z]\/[a-z]$/i.test(value.trim());
}

function isPositionLike(value: string): boolean {
    const normalized = value.trim();
    if (!normalized) return false;
    if (isBtLike(normalized)) return false;
    if (/\d/.test(normalized)) return false;
    return /^[a-z/ -]+$/i.test(normalized);
}

function formatEmbeddedHeight(feet: string | number | null | undefined, inches: string | number | null | undefined): string {
    if (feet == null || feet === '') {
        return '';
    }

    const feetStr = String(feet).trim();
    const inchesStr = inches == null ? '0' : String(inches).trim();
    return `${feetStr}'${inchesStr}"`;
}

function sortRosterPlayers(players: RosterPlayer[]): RosterPlayer[] {
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
