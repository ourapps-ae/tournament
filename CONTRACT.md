# Tournament component

## Purpose and facilities
`tournament` keeps who is in, who is out and in what order. Everyone seated enters with the starting stack (issued through the chip-ledger); when a round ends, a player with no chips is offered a rebuy if they have one left and the round was dealt at or below the last rebuy level; offers have a deadline (a person who does not answer is out) and computer players accept after a delay; once every offer is answered the players still without chips are eliminated and placed (same-round bust-outs by stack at the deal, equal stacks sharing a place), and either a winner is found or the next round starts. It also finishes a game early when only computer players are left, supports cancellation, and gives result rows for the standings screens.

Facilities: `entries` (Every seated player enters with a starting stack issued through the chip ledger); `rebuys` (Rebuy offers with limits, level cut-off, deadlines and automatic computer acceptance); `eliminations` (Bust-outs placed by stack at the deal, shared places for ties); `results` (Finishing order, winner, cancellation, and result rows for web, Apple and Android clients).

## User inputs
Settings (all optional): `startingStack` (5000), `rebuysPerPlayer` (1), `rebuyStack` (5000), `lastRebuyLevel` (3; 0 means no rebuy at any level), `rebuyDecisionSeconds` (30) and `tiebreak` (`stackAtDeal`: same-round bust-outs rank by the stack they had at the deal, equal stacks tie; `shared`: all share one place). They map to the house-rules entries `chips.starting_stack`, `rebuy.maximum_per_player`, `rebuy.stack_awarded`, `rebuy.eligibility.maximum_level`, `rebuy.decision_seconds` and `results.same_hand_bustouts`. `startingStack` is the only starting-stack number the tournament uses: every entry is issued it through the ledger, so chip-ledger's own `startingStack` must not add a second stack.

- `startingStack` (integer; optional; default `5000`)
- `rebuysPerPlayer` (integer; optional; default `1`)
- `rebuyStack` (integer; optional; default `5000`)
- `lastRebuyLevel` (integer; optional; default `3`)
- `rebuyDecisionSeconds` (integer; optional; default `30`)
- `tiebreak` (string, identifier; optional; default `stackAtDeal`)

## Artefacts and dependencies
`component.json` maps every `implementation/` source into `components/tournament/`:

- `implementation/android/src/main/java/ae/tournament/ResultRows.kt` -> `components/tournament/android/src/main/java/ae/tournament/ResultRows.kt`
- `implementation/apple/Sources/ResultRows.swift` -> `components/tournament/apple/Sources/ResultRows.swift`
- `implementation/server/migrate.ts` -> `components/tournament/server/migrate.ts`
- `implementation/server/tournament.ts` -> `components/tournament/server/tournament.ts`
- `implementation/web/results.ts` -> `components/tournament/web/results.ts`

Dependencies: none.
`tools.lock.json` pins verification tools: node 26.5.0, python3 3.12.8, swiftc 6.4.2, kotlinc 2.2.0, java 26.0.1. Licence wording remains deferred.

## Provided interfaces
- `interfaces/tournament.json` defines `tournament` (ae/tournament) version 1.0.0.

## Required interfaces
- `chip-ledger` (ae/chip-ledger) version 1.0.0, supplied by the recipe or application.
- `level-schedule` (ae/level-schedule) version 1.0.0, supplied by the recipe or application.
- `seating` (ae/seating) version 1.0.0, supplied by the recipe or application.

## Integration
Build it once with `createTournament(settings, {ledger, schedule, seating})` from `implementation/server/tournament.ts`, passing the chip-ledger, level-schedule and seating components. The state holds the chip ledger; the game moves chips through `ledger(t)` and the turn engine puts the new ledger back with `withLedger`. The turn engine calls `start`, `roundStarted`, `roundSettled`, `dueOffer`, `nextOfferDue`, `resolve`, `conclude`, `cancel`, `levelAt` and the readers. Clients use `resultRows` (web `implementation/web/results.ts`, Apple `ResultRows.swift`, Android `ResultRows.kt`); end screens, icons and text stay with the recipe. The ledger offers `create/issue/balance/issued/setSeats` (`start` tells it each player's seat number) and the schedule `levelAt/describe`; `createLedgerApi(settings)` of chip-ledger and `createScheduleApi(schedule)` of level-schedule are such objects. `levelAt` and `clockInfo` take the level clock of game-clock (`elapsed(clock, 'level')`). `levelClockRuns(t)` is false exactly while rebuy offers are open; the turn engine passes it as `runs.level` so the blind level does not advance during a rebuy decision.

## Visual definition and connected examples
`visual/definition.json` maps its ports to the provided and required interfaces. `visual/examples/connected.json` connects the component to an illustrative application consumer. Both image formats and a text description are retained under `visual/output/`.

## Infrastructure
No service is deployed. The tournament state is part of the game state the room stores. No accounts or keys.

## Verification
`node --test tests/web.test.ts` checks settings, entries, offers with deadlines and computer acceptance, the level cut-off and rebuy limits, taken and declined rebuys, same-round and shared placing, successive places, computers-only completion, cancellation, chip conservation, result rows, the runnable consumer and export/import with checksums. `python3 tests/native.py apple` compiles and runs the Swift result-row checks. `python3 tests/native.py android` is written for Kotlin 2.2.0 but was not run on the extraction machine (no kotlinc). `authoring/integration.test.ts` (not packaged) runs the tournament over the real chip-ledger and level-schedule siblings. The tests use small stand-ins for the three required components (`tests/fakes.ts`).

- `node --test tests/web.test.ts` (web, required-local; tools: node 26.5.0)
- `python3 tests/native.py apple` (apple, platform; tools: python3 3.12.8, swiftc 6.4.2)
- `python3 tests/native.py android` (android, platform; tools: python3 3.12.8, kotlinc 2.2.0, java 26.0.1)

## Scenarios and presentation
Three players start with 5000. One loses everything in a level 1 round, is offered the one rebuy and takes it; later loses again, has no rebuy left and is eliminated third. Two players bust in the same round with 300 and 100 at the deal: the 300 stack places higher. A person who does not answer a rebuy offer within the deadline is eliminated.

## Updates and removal
Patch updates replace files; the state shape is `interfaces/tournament-state.schema.json` version 1.0.0 and `migration.json` describes export and import as newline-delimited JSON with a checksum per record. Removal deletes the owned sources and the application's imports; stored results stay in the room's own storage.
