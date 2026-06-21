# ullebets-unibet

Separat databas/sync för Unibet-data.

Projektet återanvänder samma Mongo/Cosmos-anslutning som `C:/dev/frontend/ullebets-vecel`, men skriver alltid till `ullebets_unibet`.

## Datakälla

- `SOURCE_MONGODB_DB=app`
- `app.teamstats` -> `ullebets_unibet.matches`
- `app.analysis-snapshots` -> `ullebets_unibet.raw_source_snapshots`
- shortlist från snapshots -> `ullebets_unibet.source_shortlist_items`

## Odds-hämtning

Raw odds hämtas med samma Kambi/Unibet-sätt som gamla appen:

- league listView från `data/unibetLeagueUrls.json`
- matchning på home/away/league/start
- event odds från `betoffer/event/{eventId}.json`
- hela odds-payloaden sparas raw i `raw_odds_snapshots`
- listView-payloaden sparas raw i `raw_unibet_discovery`

Snapshot-schema:

- `FIRST_SEEN`
- `T_MINUS_3D`
- `T_MINUS_2D`
- `T_MINUS_1D`
- `MATCH_DAY`

## Index och duplicate cleanup

`matches` ska ha exakt en rad per `source + source_event_id`. Det är rätt princip eftersom en match ska kunna ha många odds-snapshots utan att matchen själv dupliceras.

`npm run indexes` rensar därför först befintliga dubletter i `matches`, behåller den senaste/bästa matchraden, loggar vilka `_id` som togs bort och skapar sedan unique-indexet.

Manuell kontroll:

```bash
npm run cleanup:matches:dry
npm run cleanup:matches
npm run indexes
```

`raw_unibet_discovery` använder inte längre unique-index på bara `payload_hash`, eftersom samma listView-payload kan hämtas legitimt vid olika jobb/tider.

## Start

```bash
npm install
npm run healthcheck
npm run sync
```

## Kommandon

```bash
npm run source:scan          # lista collections i app
npm run cleanup:matches:dry # visa match-dubletter utan att ta bort
npm run cleanup:matches     # rensa match-dubletter i ullebets_unibet
npm run indexes             # skapa index, inklusive säker duplicate-cleanup för matches
npm run import:matches      # importera kommande matcher från app.teamstats och skapa oddsjobb
npm run import:snapshots    # importera befintliga analysis-snapshots
npm run odds:raw            # kör due oddsjobb och sparar ALL raw odds-payload
npm run sync                # kör allt ovan i rätt ordning
npm run coverage            # rapport på importerad data
```

## GitHub Actions

Workflowen `Unibet Data Sync` kör en gång per dag och gör app-sync + raw odds-fetch för due snapshots.
