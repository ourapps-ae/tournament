# Tournament instructions

## For the agent
Select `ourapps-ae/tournament` once per recipe. Map the chips, rebuys and decision-time questions to `startingStack`, `rebuysPerPlayer`/`rebuyStack`/`lastRebuyLevel` and `rebuyDecisionSeconds`. Connect `chip-ledger`, `level-schedule` and `seating` to those components, then connect the provided `tournament` to turn-engine. If the recipe has no rebuys, set `rebuysPerPlayer` to 0. Set `startingStack` and `rebuyStack` here only: the tournament issues every stack through the chip ledger, so chip-ledger's own `startingStack` must not also be set to a different number.

- Select package `ourapps-ae/tournament` version `0.4.1`.
- Settings to configure:
  - `startingStack` (integer; optional; default `5000`)
  - `rebuysPerPlayer` (integer; optional; default `1`)
  - `rebuyStack` (integer; optional; default `5000`)
  - `lastRebuyLevel` (integer; optional; default `3`)
  - `rebuyDecisionSeconds` (integer; optional; default `30`)
  - `tiebreak` (string, identifier; optional; default `stackAtDeal`)
- Connect the provided `tournament` (ae/tournament 1.0.0) to the consumer that needs it.
- Supply `chip-ledger` (ae/chip-ledger 1.0.0) from the component that provides it.
- Supply `level-schedule` (ae/level-schedule 1.0.0) from the component that provides it.
- Supply `seating` (ae/seating 1.0.0) from the component that provides it.
- No accounts or keys are needed.

## For the developer
Nothing to supply: no accounts or keys. The starting stack must equal the chips the game expects to deal with; keep `startingStack` and `rebuyStack` in one place (the house-rules file) and read both into the settings. Use `resultRows` in your end screen and keep the text, icons and cards in your own files. To check it works, run the commands below. Pass chip-ledger's `createLedgerApi(settings)` and level-schedule's `createScheduleApi(schedule)`. Give the level schedule the level clock: `tournament.levelAt(clock.elapsed(clock, 'level'))`.

## How to check
From the component directory:

- `node --test tests/web.test.ts` (web, required-local; tools: node 26.5)
- `python3 tests/native.py apple` (apple, platform; tools: python3 3.12, swiftc 6.4)
- `python3 tests/native.py android` (android, platform; tools: python3 3.12, kotlinc 2.2, java 26.0)
- `python3 -m aepm review <digest> --store STORE --policy POLICY --trusted --allow-network` checks an archive fetched with `python3 -m aepm fetch ourapps-ae/tournament@VERSION --store STORE --from https://ourapps.app` and runs its suites.
