# ullebets-unibet

Separat datainsamling för Unibet-odds.

Projektet ska återanvända samma Mongo/Cosmos-anslutning som `C:/dev/frontend/ullebets-vecel`, men alltid skriva till databasen `ullebets_unibet`.

## Start

```bash
npm install
npm run healthcheck
npm run indexes
```

Skapa sedan `config/leagues_and_teams.json` från exemplet och fyll i Unibet discovery-URL per liga eller via env-template.

## Körning

```bash
npm run discover
npm run worker:odds
npm run coverage
```

## Collections

- `healthcheck`
- `matches`
- `raw_unibet_discovery`
- `odds_fetch_jobs`
- `raw_odds_snapshots`
- `coverage_reports`

## Snapshot-plan

När en match hittas skapas jobb för `FIRST_SEEN`, `T_MINUS_3D`, `T_MINUS_2D`, `T_MINUS_1D`, `T_MINUS_12H`, `T_MINUS_6H`, `T_MINUS_1H` och `T_MINUS_10M`.

Closing odds ska räknas senare som sista lyckade snapshot före matchstart.

Första målet är coverage audit: se vilka ligor, matcher och marknader som faktiskt finns, särskilt skott, skott på mål och hörnor.
