# StatLine

A web application for extracting, formatting, and displaying/exporting college sports statistics. StatLine fetches roster data from school websites and stats from PDF stat sheets or API endpoints, then merges them into a spreadsheet-ready format.

## How It Works

StatLine supports three platforms:

| Platform | Description |
|----------|-------------|
| **Sidearm Sports** | The majority of college athletics sites — roster HTML + cumulative stats PDF on S3 |
| **WMT Games** | Stats fetched via JSON API (`api.wmt.games`), roster parsed from HTML |
| **Georgia Tech** | Custom PDF parser for GT's non-standard stat sheet format |

### Workflow
1. **Roster** — Fetched from the school's roster HTML page, parsed with Cheerio
2. **Stats** — Fetched from the school's cumulative stats PDF (Sidearm), JSON API (WMT), or custom parser (GT)
3. **Merge** — Roster and stats are matched by jersey number + player name and formatted according to sport-specific rules

### Output
- **Formatted view** — Roster and stats tabs with clean formatting for quick reference
- **Raw CSV export** — Full stats data for spreadsheet use (includes all columns from the PDF/API)
- **Copy to clipboard** — Quick paste into spreadsheets

## Sports

| Sport | Stats |
|-------|-------|
| **Baseball** | Full batting + pitching lines |
| **Softball** | Full batting + pitching lines |
| **Men's Basketball** | PTS, FG, 3PT%, FT%, REB, AST, BLK, STL, MIN |
| **Women's Basketball** | Same as Men's |
| **Men's Soccer** | Goals, assists, shots, saves, GAA (priority-based) |
| **Women's Soccer** | Same as Men's |
| **Football** | Passing, rushing, receiving, defensive, kicking, punting (priority-based) |
| **Women's Volleyball** | Attack, serve, reception, blocking, digs (priority-based) |

### Priority-Based Stat Formatting (CAT Stats)

Soccer, volleyball, and football use a **priority system** to pick the most meaningful stats per player, since players have different roles. The other sports (baseball, softball, basketball) use fixed stat columns for everyone.

**Soccer** — Picks the top 3 non-zero stats per player in priority order:
- Field players: `Goals → Assists → Pts → SOG → Shots`
- Goalies: Fixed — `Saves, GA, Shutouts`

**Volleyball** — Picks the top 3 non-zero stats in priority order:
- `PTS → Kills → Assists → Digs → Blocks → Service Aces`

**Football** — Determines the player's primary **category** based on their stats, then shows 4 stats for that category:
1. **Passing** (if pass att > 10 or more passes than rushes): PCT, YDS, TD, INT
2. **Rushing** (if rush att ≥ receptions): CAR, YDS, AVG, TD
3. **Receiving** (if receptions > 0): REC, YDS, AVG, TD
4. **Defense** (if tackles > 0): TKLS, TFL, SACKS, PBU, INT
5. **Punting**: PUNTS, AVG, LONG, I20
6. **Kicking**: FG, PCT, LONG, PTS

## Features

- **Smart Player Matching** — Two-phase matching handles jersey number changes:
  - Primary: Jersey number + first OR last name match
  - Fallback: Exact first AND last name match (handles jersey changes)
- **1–99 Row Mapping** — Players ordered by jersey slot for direct spreadsheet paste for required sports
- **Gap Row Collapsing** — Empty jersey ranges collapsed with indicators
- **Custom Schools** — Enter custom roster/stats URLs for any school, saved to localStorage (only saved if both roster and stats load successfully)
- **50+ Pre-Configured Schools** — Schools from all types of conferences for easy access
- **Export** — Copy to clipboard or download as CSV (roster and stats)

## Tech Stack

| Dependency | Purpose |
|-----------|---------|
| **Next.js 16** | App Router, API routes |
| **React 19** | UI framework |
| **TypeScript** | Type safety |
| **Tailwind CSS 4** | Styling |
| **shadcn/ui** | UI components (Radix primitives) |
| **pdf-parse** | PDF text extraction |
| **cheerio** | Server-side HTML parsing |

## Project Structure

```
statline/
├── app/
│   ├── page.tsx                  # Main page — school/sport selection, data fetching, rendering
│   ├── layout.tsx                # Root layout with metadata
│   ├── globals.css               # Tailwind config + design tokens
│   └── api/
│       ├── roster/route.ts       # Fetches & parses roster HTML via Cheerio
│       └── pdf/route.ts          # Fetches & parses stat PDFs / WMT API / GT parser
│
├── components/
│   ├── sports/                   # Sport-specific stats views (one per sport)
│   │   ├── baseball-stats-view.tsx
│   │   ├── softball-stats-view.tsx   # Thin wrapper over baseball (same format)
│   │   ├── basketball-stats-view.tsx
│   │   ├── soccer-stats-view.tsx
│   │   ├── volleyball-stats-view.tsx
│   │   └── football-stats-view.tsx
│   ├── roster-table.tsx          # Shared roster table (used by baseball/softball)
│   ├── stats-table.tsx           # Shared stats table (used by baseball/softball)
│   ├── stats-table-skeleton.tsx  # Loading skeleton for all stats tables
│   ├── school-combobox.tsx       # School search/select dropdown
│   ├── school-info-popover.tsx   # School config details popover
│   ├── sport-selector.tsx        # Sport selection buttons
│   ├── custom-url-form.tsx       # Custom URL input form (with WMT toggle)
│   └── ui/                      # shadcn/ui primitives
│
├── config/
│   └── schools.ts                # 51 pre-configured schools with domains & sport lists
│
├── lib/
│   ├── parsers/                  # Sport-specific PDF/API parsers
│   │   ├── baseball.ts           # Parses baseball/softball PDF + merges with roster
│   │   ├── basketball.ts         # Parses basketball cumulative stats PDF
│   │   ├── soccer.ts             # Parses soccer cumulative stats PDF
│   │   ├── volleyball.ts         # Parses volleyball cumulative stats PDF
│   │   ├── football.ts           # Parses football cumulative stats PDF
│   │   └── wmt-api.ts            # Parses WMT Games API response (all sports)
│   ├── basketball/
│   │   └── ordering.ts           # Maps basketball players to jersey slots 1-99
│   ├── soccer/
│   │   ├── ordering.ts           # Maps soccer players to jersey slots 1-99
│   │   └── cat-stats.ts          # Priority-based stat formatting (field vs goalie)
│   ├── volleyball/
│   │   ├── ordering.ts           # Maps volleyball players to jersey slots 1-99
│   │   └── cat-stats.ts          # Priority-based stat formatting
│   ├── football/
│   │   ├── ordering.ts           # Maps football players to jersey slots 1-99
│   │   └── cat-stats.ts          # Category-based stat formatting (passing/rushing/etc.)
│   ├── roster/
│   │   └── extractor.ts          # Cheerio-based roster HTML parser
│   ├── pdf/                      # PDF fetching + GT-specific parser
│   │   ├── parser.ts             # Generic PDF fetch and text extraction
│   │   └── gtech-parser.ts       # Georgia Tech custom PDF format parser
│   ├── url/
│   │   └── generator.ts          # URL generation helpers (Sidearm patterns)
│   ├── sports/                   # Sport registry + per-sport config
│   │   ├── index.ts              # Registry mapping SportType → SportConfig
│   │   ├── types.ts              # SportConfig, RosterColumn, StatsViewProps
│   │   ├── baseball.config.ts    # Baseball sport config
│   │   ├── softball.config.ts    # Softball sport config
│   │   ├── basketball.config.ts  # Basketball sport config
│   │   ├── soccer.config.ts      # Soccer sport config
│   │   ├── volleyball.config.ts  # Volleyball sport config
│   │   └── football.config.ts    # Football sport config
│   ├── storage/
│   │   └── schools.ts            # localStorage: save/load custom school configs
│   ├── hooks/
│   │   └── use-copy-feedback.ts  # Copy-to-clipboard with toast feedback
│   ├── utils/
│   │   ├── player-matching.ts    # Shared name/jersey matching logic (all sports)
│   │   ├── display-rows.ts       # Gap row collapsing (consecutive empty slots → indicator)
│   │   ├── export.ts             # CSV download helper
│   │   └── roster.ts             # Roster utility functions
│   └── utils.ts                  # cn() — Tailwind class merge utility
│
└── types/
    ├── index.ts                  # Shared TypeScript types (SportType, SPORT_CODES)
    └── pdf-parse.d.ts            # Type declarations for pdf-parse
```

## School Configuration

Schools are configured in `config/schools.ts` using composable sport presets:

```typescript
BASE_SPORTS      = [baseball, softball, mens-bball, womens-bball]
WITH_SOCCER      = BASE_SPORTS + [mens-soccer, womens-soccer]
WITH_WSOC_ONLY   = BASE_SPORTS + [womens-soccer]
WITH_SOCCER_AND_VB = WITH_SOCCER + [womens-volleyball]
ALL_SPORTS       = WITH_SOCCER_AND_VB + [football]
WITH_WSOC_VB_FB  = WITH_WSOC_ONLY + [womens-volleyball, football]
```

Each school specifies a `domain` (roster pages) and `sidearmDomain` (stats PDFs). Non-Sidearm schools set `platform: 'wmt'` or `platform: 'gtech'` with corresponding URL or team ID overrides.

## Development

```bash
pnpm install    # Install dependencies
pnpm dev        # Start dev server
pnpm build      # Build for production
pnpm lint       # Lint
```

## Adding a New School

1. Find the school's Sidearm roster page URL (domain)
2. Find the school's cumulative stats PDF URL (sidearmDomain — often different from domain)
3. Add an entry to `SCHOOLS` in `config/schools.ts`:

```typescript
{
    id: 'school-name',
    name: 'School Name',
    domain: 'schoolsports.com',
    sidearmDomain: 'school.sidearmsports.com',
    sports: BASE_SPORTS,  // or WITH_SOCCER, ALL_SPORTS, etc.
}
```

For WMT schools, add `platform: 'wmt'` and `wmtTeamId` per sport.
