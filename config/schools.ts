import type { SportType } from '@/types';

/**
 * Simplified school configuration - just store domains
 * URLs are generated dynamically based on sport and year
 */
export interface SchoolConfig {
    id: string;
    name: string;
    /** Base domain for roster pages (e.g., "georgiastatesports.com") */
    domain: string;
    /** Sidearm S3 domain for stats PDFs - often different from base domain */
    sidearmDomain: string;
    /** Which sports are available for this school */
    sports: SportType[];
    /** S3 region - most use us-east-2, but some use us-east-1 */
    s3Region?: 'us-east-1' | 'us-east-2';
    /** Non-Sidearm platform identifier — triggers special handling */
    platform?: 'gtech' | 'wmt';
    /** Direct roster URL overrides per sport (bypasses Sidearm auto-generation) */
    rosterUrls?: Partial<Record<SportType, string>>;
    /** Direct stats PDF URL overrides per sport (bypasses Sidearm auto-generation) */
    statsUrls?: Partial<Record<SportType, string>>;
    /** WMT API team ID per sport (for api.wmt.games stats fetching) */
    wmtTeamId?: Partial<Record<SportType, string>>;
}

/**
 * Sport configurations
 */
const BASE_SPORTS: SportType[] = ['baseball', 'softball', 'mens-basketball', 'womens-basketball'];
const WITH_SOCCER: SportType[] = [...BASE_SPORTS, 'mens-soccer', 'womens-soccer'];
const WITH_WSOC_ONLY: SportType[] = [...BASE_SPORTS, 'womens-soccer']; // Schools with only women's soccer
const WITH_VOLLEYBALL: SportType[] = [...BASE_SPORTS, 'womens-volleyball'];
const WITH_SOCCER_AND_VB: SportType[] = [...WITH_SOCCER, 'womens-volleyball'];
const ALL_SPORTS: SportType[] = [...WITH_SOCCER_AND_VB, 'football'];
const WITH_WSOC_VB_FB: SportType[] = [...WITH_WSOC_ONLY, 'womens-volleyball', 'football'];
const BASEBALL_BASKETBALL: SportType[] = ['baseball', 'mens-basketball', 'womens-basketball'];

/**
 * Pre-configured schools - all use Sidearm Sports platform
 * URLs are generated automatically based on domain and sport
 * 
 * IMPORTANT: sidearmDomain is often DIFFERENT from the main domain!
 * Check the actual stats PDF URL to get the correct sidearmDomain.
 */
export const SCHOOLS: SchoolConfig[] = [
    // A
    { id: 'alabama-state', name: 'Alabama State', domain: 'bamastatesports.com', sidearmDomain: 'bamastatesports.com', sports: BASE_SPORTS },
    { id: 'alcorn-state', name: 'Alcorn State', domain: 'alcornsports.com', sidearmDomain: 'alcorn.sidearmsports.com', sports: BASE_SPORTS },
    // Sun Belt - WSOC only (no MSOC team) + Football
    { id: 'appalachian-state', name: 'Appalachian State', domain: 'appstatesports.com', sidearmDomain: 'appstate.sidearmsports.com', sports: WITH_WSOC_VB_FB },
    // Arkansas State - no softball, WSOC only (no MSOC team)
    { id: 'arkansas-state', name: 'Arkansas State', domain: 'astateredwolves.com', sidearmDomain: 'astateredwolves.com', sports: ['baseball', 'mens-basketball', 'womens-basketball', 'womens-soccer', 'womens-volleyball', 'football'] },
    // Austin Peay
    { id: 'austin-peay', name: 'Austin Peay', domain: 'letsgopeay.com', sidearmDomain: 'apsugovernors.com', sports: BASE_SPORTS },
    // B
    { id: 'bellarmine', name: 'Bellarmine', domain: 'athletics.bellarmine.edu', sidearmDomain: 'athletics.bellarmine.edu', sports: BASE_SPORTS },
    { id: 'belmont', name: 'Belmont', domain: 'belmontbruins.com', sidearmDomain: 'belmontbruins.com', sports: BASE_SPORTS },
    { id: 'bucknell', name: 'Bucknell', domain: 'bucknellbison.com', sidearmDomain: 'bucknellbison.com', sports: BASE_SPORTS },
    // C
    { id: 'charleston-southern', name: 'Charleston Southern', domain: 'www.csusports.com', sidearmDomain: 'csusports.com', sports: BASE_SPORTS },
    // Chattanooga - no baseball team
    { id: 'chattanooga', name: 'Chattanooga', domain: 'gomocs.com', sidearmDomain: 'utc.sidearmsports.com', sports: ['softball', 'mens-basketball', 'womens-basketball'] },
    // Sun Belt - tested MSOC + WSOC + Football
    { id: 'coastal-carolina', name: 'Coastal Carolina', domain: 'goccusports.com', sidearmDomain: 'goccusports.com', sports: ALL_SPORTS },
    { id: 'college-of-charleston', name: 'College of Charleston', domain: 'cofcsports.com', sidearmDomain: 'cofcharleston.sidearmsports.com', sports: BASE_SPORTS },
    // D
    // Drexel - no baseball team
    { id: 'drexel', name: 'Drexel', domain: 'drexeldragons.com', sidearmDomain: 'drexeldragons.com', sports: ['softball', 'mens-basketball', 'womens-basketball'] },
    // E
    { id: 'etsu', name: 'ETSU', domain: 'etsubucs.com', sidearmDomain: 'etsu.sidearmsports.com', sports: BASE_SPORTS, s3Region: 'us-east-1' },
    // G
    { id: 'georgia', name: 'Georgia', domain: 'georgiadogs.com', sidearmDomain: 'georgiadogs.com', sports: BASE_SPORTS },
    // Georgia Tech - non-Sidearm (custom GT platform), hardcoded URLs
    {
        id: 'georgia-tech',
        name: 'Georgia Tech',
        domain: 'ramblinwreck.com',
        sidearmDomain: '',  // not used — GT doesn't use Sidearm
        sports: ['baseball'],
        platform: 'gtech',
        rosterUrls: {
            'baseball': 'https://ramblinwreck.com/sports/m-basebl/roster/',
        },
        statsUrls: {
            'baseball': 'https://ramblinwreck.com/wp-content/uploads/2026/02/GT-Baseball-Season-Stats-2026-2.pdf',
        },
    },
    // Sun Belt - tested MSOC + WSOC + WVBALL + Football
    { id: 'georgia-southern', name: 'Georgia Southern', domain: 'gseagles.com', sidearmDomain: 'georgiasouthern.sidearmsports.com', sports: ALL_SPORTS },
    { id: 'georgia-state', name: 'Georgia State', domain: 'georgiastatesports.com', sidearmDomain: 'georgiastatesports.com', sports: ALL_SPORTS },
    // J
    { id: 'jacksonville-state', name: 'Jacksonville State', domain: 'jaxstatesports.com', sidearmDomain: 'jsugamecocksports.com', sports: WITH_WSOC_VB_FB },
    // Sun Belt - tested MSOC + WSOC + Football
    { id: 'james-madison', name: 'James Madison', domain: 'jmusports.com', sidearmDomain: 'jmusports.com', sports: ALL_SPORTS },
    // K
    { id: 'kennesaw-state', name: 'Kennesaw State', domain: 'ksuowls.com', sidearmDomain: 'ksuowls.com', sports: WITH_WSOC_VB_FB },
    // L
    { id: 'la-tech', name: 'Louisiana Tech', domain: 'latechsports.com', sidearmDomain: 'latechsports.com', sports: WITH_WSOC_VB_FB },
    { id: 'lincoln-memorial', name: 'Lincoln Memorial', domain: 'lionsports.net', sidearmDomain: 'lionsports.net', sports: BASE_SPORTS },
    // Sun Belt - Louisiana (Ragin Cajuns) + Football
    { id: 'louisiana', name: 'Louisiana', domain: 'ragincajuns.com', sidearmDomain: 'ragincajuns.com', sports: WITH_WSOC_VB_FB },
    // M
    // Sun Belt - tested MSOC + WSOC + Football
    { id: 'marshall', name: 'Marshall', domain: 'herdzone.com', sidearmDomain: 'herdzone.com', sports: ALL_SPORTS },
    { id: 'memphis', name: 'Memphis', domain: 'gotigersgo.com', sidearmDomain: 'gotigersgo.com', sports: WITH_WSOC_VB_FB },
    { id: 'mercer', name: 'Mercer', domain: 'mercerbears.com', sidearmDomain: 'mercer.sidearmsports.com', sports: WITH_SOCCER },
    { id: 'murray-state', name: 'Murray State', domain: 'goracers.com', sidearmDomain: 'murraystate.sidearmsports.com', sports: WITH_WSOC_VB_FB },
    // N
    { id: 'nc-at', name: 'NC A&T', domain: 'ncataggies.com', sidearmDomain: 'ncataggies.com', sports: WITH_WSOC_VB_FB },
    { id: 'new-orleans', name: 'New Orleans', domain: 'unoprivateers.com', sidearmDomain: 'unoprivateers.com', sports: BASEBALL_BASKETBALL },
    { id: 'nicholls', name: 'Nicholls', domain: 'geauxcolonels.com', sidearmDomain: 'nicholls.sidearmsports.com', sports: BASE_SPORTS },
    // MAC Conference - Northern Illinois + Football
    { id: 'northern-illinois', name: 'Northern Illinois', domain: 'niuhuskies.com', sidearmDomain: 'niuhuskies.com', sports: WITH_WSOC_VB_FB },
    { id: 'northwestern-state', name: 'Northwestern State', domain: 'nsudemons.com', sidearmDomain: 'nsudemons.com', sports: BASE_SPORTS },
    // O
    { id: 'ole-miss', name: 'Ole Miss', domain: 'olemisssports.com', sidearmDomain: 'olemisssports.com', sports: WITH_WSOC_VB_FB },
    // Old Dominion - WMT platform (not Sidearm), stats via api.wmt.games JSON API
    {
        id: 'old-dominion',
        name: 'Old Dominion',
        domain: 'odusports.com',
        sidearmDomain: '',
        sports: ['baseball', 'mens-basketball', 'womens-basketball'],
        platform: 'wmt',
        rosterUrls: {
            'baseball': 'https://odusports.com/sports/baseball/roster?view=table',
            'mens-basketball': 'https://odusports.com/sports/mens-basketball/roster?view=table',
            'womens-basketball': 'https://odusports.com/sports/womens-basketball/roster?view=table',
        },
        wmtTeamId: {
            'baseball': '614703',
            'mens-basketball': '609810',
            'womens-basketball': '609776',
        },
    },
    // S
    { id: 'sam-houston', name: 'Sam Houston', domain: 'gobearkats.com', sidearmDomain: 'gobearkats.com', sports: WITH_WSOC_VB_FB },
    // Sun Belt - WSOC only (no MSOC team) + Football
    { id: 'south-alabama', name: 'South Alabama', domain: 'usajaguars.com', sidearmDomain: 'usajaguars.com', sports: WITH_WSOC_VB_FB },
    { id: 'southern-miss', name: 'Southern Miss', domain: 'southernmiss.com', sidearmDomain: 'southernmiss.com', sports: WITH_WSOC_VB_FB },
    // T
    { id: 'texas-state', name: 'Texas State', domain: 'txst.com', sidearmDomain: 'txstate.sidearmsports.com', sports: WITH_WSOC_VB_FB },
    { id: 'troy', name: 'Troy', domain: 'troytrojans.com', sidearmDomain: 'troytrojans.com', sports: WITH_WSOC_VB_FB },
    // U
    // UCF - WMT platform, stats via api.wmt.games JSON API
    {
        id: 'ucf',
        name: 'UCF',
        domain: 'ucfknights.com',
        sidearmDomain: '',
        sports: ['womens-volleyball'],
        platform: 'wmt',
        rosterUrls: {
            'womens-volleyball': 'https://ucfknights.com/sports/volleyball/roster?view=table',
        },
        wmtTeamId: {
            'womens-volleyball': '604787',
        },
    },
    { id: 'ulm', name: 'ULM', domain: 'ulmwarhawks.com', sidearmDomain: 'ulm.sidearmsports.com', sports: ALL_SPORTS },
    // W
    { id: 'west-georgia', name: 'West Georgia', domain: 'uwgathletics.com', sidearmDomain: 'uwgsports.com', sports: BASE_SPORTS },
    { id: 'western-carolina', name: 'Western Carolina', domain: 'catamountsports.com', sidearmDomain: 'catamountsports.com', sports: BASE_SPORTS },
    { id: 'winthrop', name: 'Winthrop', domain: 'winthropeagles.com', sidearmDomain: 'winthropeagles.com', sports: BASE_SPORTS },
    { id: 'wofford', name: 'Wofford', domain: 'admin.woffordterriers.com', sidearmDomain: 'athletics.wofford.edu', sports: BASE_SPORTS },
    // Y
    { id: 'yale', name: 'Yale', domain: 'yalebulldogs.com', sidearmDomain: 'yalebulldogs.com', sports: BASE_SPORTS },
];

/**
 * Get school by ID
 */
export function getSchoolById(id: string): SchoolConfig | undefined {
    return SCHOOLS.find((school) => school.id === id);
}

/**
 * Get all schools sorted by name
 */
export function getAllSchools(): SchoolConfig[] {
    return [...SCHOOLS].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get schools that support a specific sport
 */
export function getSchoolsBySport(sport: SportType): SchoolConfig[] {
    return SCHOOLS.filter(school => school.sports.includes(sport))
        .sort((a, b) => a.name.localeCompare(b.name));
}
