# ullebets-unibet

Separat databas/sync för data som redan finns i `ullebets-vecel`.

Projektet återanvänder samma Mongo/Cosmos-anslutning som `C:/dev/frontend/ullebets-vecel`, men skriver alltid till `ullebets_unibet`.

## Datakälla

Primär källa nu är gamla app-databasen:

- `SOURCE_MONGODB_DB=app`
- `app.teamstats` -> `ullebets_unibet.matches`
- `app.analysis-snapshots` -> `ullebets_unibet.raw_source_snapshots`
- shortlist från snapshots -> `ullebets_unibet.source_shortlist_items`

Ingen ny Unibet-URL krävs i standardflödet.

## Start

```bash
npm install
npm run healthcheck
npm run sync
```

## Kommandon

```bash
npm run source:scan       # lista collections i app
npm run import:matches    # importera kommande matcher från app.teamstats
npm run import:snapshots  # importera befintliga analysis-snapshots
npm run sync              # kör allt ovan i rätt ordning
npm run coverage          # rapport på importerad data
```

## GitHub Actions

Workflowen `Unibet Data Sync` kör en gång per dag och gör samma app-sync.

## Viktigt

Det här repot ska inte uppfinna nya endpoints först. Det ska först kopiera och strukturera det som redan finns i `ullebets-vecel`. När vi har bevisat exakt vilka collections/fält som innehåller odds, CLV och marknader kan nästa steg vara att flytta över själva hämtlogiken.
