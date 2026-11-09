# Source mapping

Reference revision: `19905b75dbea89fbfd424d67fe26c81aaed0e018`. Extraction source: `OurPoker/recipe/` (read-only).

- `implementation/server/tournament.ts` <- `server/src/engine.ts` and `server/src/rules.ts`:
  - Starting stacks: `start` 377-389 (`STARTING_STACK`, rules.ts 6): `start`, now issued through the injected chip ledger.
  - Rebuy offers: `RebuyOffer` 109, `BOT_REBUY_MS` 28, `finishHand` 925-941 (offered when `rebuysUsed < REBUY_MAX` and hand level `<= REBUY_LAST_LEVEL`; rules.ts 10-12): `roundSettled`; offer deadlines `REBUY_MS` (rules.ts 9) as `rebuyDecisionSeconds`; computer acceptance delay is passed in (`computerDelayMs`, from computer-players).
  - Due offers: `dueStep` 535-539 and `nextWake` 605: `dueOffer`, `nextOfferDue`.
  - Answering: `rebuy` 943-949 and `resolveOffer` 951-963 (accept gives `REBUY_STACK`, uses a rebuy): `resolve`.
  - Bust-outs: `afterOffers` 965-977, `eliminate` 979-993 (same-round bust-outs by stack at the deal, equal stacks share a place; `startStack` set at the deal, 664), `complete` 995-1002, `completeBotsOnly` 1004-1016: `conclude`, `roundStarted`, internal `eliminate` and `placeByStack`; `tiebreak: shared` (new) gives one place to all same-round bust-outs.
  - Cancellation: `doCancel` 1046-1068 (the tournament part: offers cleared, no winner, status): `cancel`. Voiding the round and returning chips stays with the game and turn-engine.
  - `chipsIssued` 1075-1078: `chipsIssued`, from the ledger.
  - Level: `levelFor` (rules.ts 26-28) and `clockView` (view.ts 143-156): asked of the injected level-schedule (`levelAt`, `clockInfo`).
  - `levelClockRuns` (new, `generated-platform`): the recipe's `engine.ts` `tick` passed `level: running && no offers` inline; the rule now lives beside the offers.
  - Left behind: hands, betting, pots and blinds (holdem-rules, chip-ledger), pauses and the two clocks (game-clock, presence), seat records (seating), the house-rules JSON itself (rules-settings; its `rebuy` and `results` sections are read into the settings by the recipe).
- `implementation/server/migrate.ts` <- new (`generated-platform`): ndjson export and import with a sha256 per record.
- `implementation/web/results.ts` <- `web/src/screens.ts` 195-225 (`endScreen`: ranked by place then unplaced with stack, "rebought" mark, cancelled heading): `resultRows`, `headingKey`. Screen building, cards, icons and text left in the recipe.
- `implementation/apple/Sources/ResultRows.swift` <- `ios/OurPoker/Sources/EndScreen.swift` 10-11 and 32-46 (same rows; stable ordering made explicit).
- `implementation/android/src/main/java/ae/tournament/ResultRows.kt` <- `android/.../ui/EndScreen.kt` 38-39 and 54-66. Not compiled here (no kotlinc).
- `interfaces/tournament-state.schema.json`, `migration.json`, `examples/consumer.ts`, `tests/fakes.ts` and tests: new.
