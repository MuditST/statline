# Statline

Statline is a Next.js app for fetching college roster data, pulling stats from Sidearm PDFs, WMT endpoints, or hybrid paste flows, and formatting the results for quick viewing and spreadsheet export.

## How It Works

Statline supports these source types:

| Platform | Description |
| --- | --- |
| `sidearm` | Roster HTML + cumulative stats PDF |
| `wmt` | Roster HTML + WMT stats/API flow |
| `hybrid` | Roster HTML + pasted stats text from a stats page/PDF |

Basic request flow:

1. Fetch roster data from the selected school's roster page
2. Fetch or parse stats data from the configured source
3. Merge roster + stats by jersey/name matching
4. Render sport-specific output and allow copy/export

## Configuration Sources

School configuration is resolved with this precedence:

```text
custom browser override > Google Sheets > preset config
```

### 1. Custom browser overrides

User-entered custom schools and custom URL edits are stored in `localStorage`.

### 2. Google Sheets config

Admin-managed school metadata can be added in Google Sheets without a code deploy.

Expected columns:

- `enabled`
- `school_id`
- `school_name`
- `sport`
- `platform`
- `roster_url`
- `sidearm_url`
- `wmt_url`
- `hybrid_url`

The server fetches the sheet, validates rows, merges them over preset config, and exposes the resolved list through:

```text
/api/config/schools?sport=<sport>
```

Required environment variables:

```bash
GOOGLE_SHEETS_CONFIG_URL=https://docs.google.com/spreadsheets/d/<id>/edit?usp=sharing
GOOGLE_SHEETS_CONFIG_SHEET_NAME=Config
GOOGLE_SHEETS_CONFIG_REVALIDATE_SECONDS=300
```

### 3. Preset config

Preset fallback schools still live in:

```text
config/schools.ts
```

## Sports

Currently supported:

- Baseball
- Softball
- Men's Basketball
- Women's Basketball
- Men's Soccer
- Women's Soccer
- Football
- Women's Volleyball

## Features

- Smart roster/stats matching with jersey-first and name fallback logic
- Sport-specific stat formatting
- Hybrid pasted-stats support
- Custom school URL entry
- Google Sheets-backed config overrides
- CSV export / copy workflows

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- Cheerio
- pdf-parse

## Development

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
```

## Project Notes

- Roster parsing uses layered fallbacks:
  - table parsing first
  - embedded roster JSON fallback
  - roster card/list fallback
- Hybrid stats parsing is column/header-shape based so it can handle more real-world paste formats
- Some schools may still need manual config updates if their athletics site changes structure or certificates
