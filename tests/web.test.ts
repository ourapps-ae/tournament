import assert from "node:assert/strict";
import test from "node:test";
import { checkSettings, createTournament, type TournamentSettings, type TournamentState } from "../implementation/server/tournament.ts";
import { exportAll, importAll } from "../implementation/server/migrate.ts";
import { headingKey, resultRows } from "../implementation/web/results.ts";
import { ledger, schedule, seating, type FakeSeat, LEVEL_MS } from "./fakes.ts";
import { play } from "../examples/consumer.ts";

const people = (...ids: string[]): FakeSeat[] => ids.map((id, seat) => ({ id, computer: false, seat }));
const make = (settings: Partial<TournamentSettings> = {}) => createTournament({ startingStack: 100, rebuyStack: 100, ...settings }, { ledger, schedule, seating });
type T = ReturnType<typeof make>;

// A round in which these players lose everything to the first of them listed as winner.
function round(t: T, s: TournamentState, seats: FakeSeat[], losers: string[], winner: string, actionMs = 0, level = 1) {
  s = t.roundStarted(s);
  let l = t.ledger(s);
  let pot = 0;
  for (const id of losers) { pot += ledger.balance(l, id); l = ledger.set(l, id, 0); }
  l = ledger.set(l, winner, ledger.balance(l, winner) + pot);
  return t.roundSettled(t.withLedger(s, l), { level, actionMs, seats, computerDelayMs: 4000 });
}

test("start enters everyone with the starting stack and tells the ledger where each player sits", () => {
  const t = make();
  const rows: FakeSeat[] = [{ id: "a", computer: false, seat: 2 }, { id: "b", computer: false, seat: 0 }];
  const s = t.start(rows);
  assert.equal(t.balance(s, "a"), 100);
  assert.equal(t.balance(s, "nobody"), 0);
  assert.equal(t.chipsIssued(s), 200);
  assert.deepEqual((t.ledger(s) as { seats: unknown }).seats, [{ id: "a", seat: 2 }, { id: "b", seat: 0 }]);
  assert.equal(t.levelAt(LEVEL_MS * 2.5), 3);
  assert.deepEqual(t.clockInfo(LEVEL_MS / 2), { level: 1, nextLevelInMs: LEVEL_MS / 2, levelDurationMs: LEVEL_MS });
});

test("the level clock stands still exactly while rebuy offers are open", () => {
  const seats = people("a", "b");
  const t = make();
  const quiet = t.start(seats);
  assert.equal(t.levelClockRuns(quiet), true);
  const offered = round(t, quiet, seats, ["b"], "a", 0);
  assert.equal(t.hasOffers(offered), true);
  assert.equal(t.levelClockRuns(offered), false);
  const answered = t.resolve(offered, "b", false);
  assert.ok(answered.ok);
  assert.equal(t.levelClockRuns(answered.state), true);
});

test("settings are checked", () => {
  assert.deepEqual(checkSettings({}), { startingStack: 5000, rebuysPerPlayer: 1, rebuyStack: 5000, lastRebuyLevel: 3, rebuyDecisionSeconds: 30, tiebreak: "stackAtDeal" });
  assert.throws(() => checkSettings({ startingStack: 0 }));
  assert.throws(() => checkSettings({ rebuysPerPlayer: -1 }));
  assert.throws(() => checkSettings({ rebuyDecisionSeconds: 0 }));
  assert.throws(() => checkSettings({ tiebreak: "coin" as "shared" }));
});

test("entries start with the starting stack and the level comes from the schedule", () => {
  const t = make();
  const s = t.start(people("a", "b", "c"));
  assert.deepEqual(t.activeIds(s), ["a", "b", "c"]);
  assert.equal(t.balance(s, "b"), 100);
  assert.equal(t.chipsIssued(s), 300);
  assert.equal(t.levelAt(0), 1);
  assert.equal(t.levelAt(LEVEL_MS * 2.5), 3);
  assert.deepEqual(t.clockInfo(LEVEL_MS / 2), { level: 1, nextLevelInMs: LEVEL_MS / 2, levelDurationMs: LEVEL_MS });
});

test("a bust-out gets one rebuy offer with a deadline; computers get an automatic acceptance time", () => {
  const seats: FakeSeat[] = [{ id: "a", computer: false, seat: 0 }, { id: "b", computer: false, seat: 1 }, { id: "c", computer: true, seat: 2 }];
  const t = make({ rebuyDecisionSeconds: 30 });
  let s = round(t, t.start(seats), seats, ["b", "c"], "a", 1000);
  assert.deepEqual(s.offers, [{ playerId: "b", deadline: 31_000, autoAt: null }, { playerId: "c", deadline: 31_000, autoAt: 5000 }]);
  assert.equal(t.dueOffer(s, 4999, seats), null);
  assert.deepEqual(t.dueOffer(s, 5000, seats), { playerId: "c", accept: true });
  assert.equal(t.nextOfferDue(s, seats), 5000);
  const r = t.resolve(s, "c", true);
  assert.ok(r.ok);
  s = r.state;
  assert.equal(t.balance(s, "c"), 100);
  assert.equal(t.rebuysUsed(s, "c"), 1);
  assert.deepEqual(t.dueOffer(s, 30_999, seats), null);
  assert.deepEqual(t.dueOffer(s, 31_000, seats), { playerId: "b", accept: false });
  assert.equal(t.nextOfferDue(s, seats), 31_000);
});

test("no offer after the last rebuy level or with no rebuys left; only an offered player may answer", () => {
  const seats = people("a", "b");
  const t = make({ lastRebuyLevel: 2 });
  const late = round(t, t.start(seats), seats, ["b"], "a", 0, 3);
  assert.equal(t.hasOffers(late), false);
  assert.deepEqual(t.resolve(late, "b", true), { ok: false, code: "notAllowed" });
  const none = make({ rebuysPerPlayer: 0 });
  assert.equal(none.hasOffers(round(none, none.start(seats), seats, ["b"], "a")), false);
  const ok = round(t, t.start(seats), seats, ["b"], "a", 0, 2);
  assert.equal(t.hasOffers(ok), true);
  assert.deepEqual(t.resolve(ok, "a", true), { ok: false, code: "notAllowed" });
});

test("a taken rebuy is not an elimination; declining is", () => {
  const seats = people("a", "b", "c");
  const t = make();
  let s = round(t, t.start(seats), seats, ["b"], "a");
  s = (t.resolve(s, "b", true) as { state: TournamentState }).state;
  let c = t.conclude(s, seats);
  assert.equal(c.outcome, "continue");
  assert.deepEqual(t.activeIds(c.state), ["a", "b", "c"]);
  s = round(t, c.state, seats, ["b"], "a");
  assert.equal(t.hasOffers(s), false, "the only rebuy is used");
  c = t.conclude(s, seats);
  assert.equal(c.outcome, "continue");
  assert.equal(t.place(c.state, "b"), 3);
  assert.equal(t.isActive(c.state, "b"), false);
  assert.equal(t.rebuysUsed(c.state, "b"), 1);
});

test("same-round bust-outs place by stack at the deal and equal stacks share a place", () => {
  const seats = people("a", "b", "c", "d");
  const t = make({ rebuysPerPlayer: 0 });
  let s = t.start(seats);
  s = t.withLedger(s, ledger.set(ledger.set(ledger.set(ledger.set(t.ledger(s), "a", 1000), "b", 100), "c", 300), "d", 300));
  s = t.roundStarted(s);
  s = t.withLedger(s, ledger.set(ledger.set(ledger.set(t.ledger(s), "b", 0), "c", 0), "d", 0));
  s = t.roundSettled(s, { level: 1, actionMs: 0, seats, computerDelayMs: 0 });
  const c = t.conclude(s, seats);
  assert.equal(c.outcome, "completed");
  assert.equal(c.winnerId, "a");
  assert.deepEqual(t.standings(c.state).map((r) => [r.id, r.place]), [["a", 1], ["c", 2], ["d", 2], ["b", 4]]);
});

test("the shared tiebreak gives one place to everyone out in the same round", () => {
  const seats = people("a", "b", "c", "d");
  const t = make({ rebuysPerPlayer: 0, tiebreak: "shared" });
  let s = t.start(seats);
  s = t.withLedger(s, ledger.set(t.ledger(s), "b", 50));
  s = round(t, s, seats, ["b", "c", "d"], "a");
  const c = t.conclude(s, seats);
  assert.deepEqual(t.standings(c.state).map((r) => [r.id, r.place]), [["a", 1], ["b", 2], ["c", 2], ["d", 2]]);
});

test("places run from the last entry up through successive rounds", () => {
  const seats = people("a", "b", "c");
  const t = make({ rebuysPerPlayer: 0 });
  let s = round(t, t.start(seats), seats, ["c"], "a");
  s = t.conclude(s, seats).state;
  assert.equal(t.place(s, "c"), 3);
  s = round(t, s, seats, ["b"], "a");
  const c = t.conclude(s, seats);
  assert.equal(c.outcome, "completed");
  assert.equal(t.place(c.state, "b"), 2);
  assert.equal(t.place(c.state, "a"), 1);
  assert.equal(c.state.finished, true);
  assert.equal(t.winner(c.state), "a");
});

test("with no person left the computers finish by stack and a tie has no winner", () => {
  const seats: FakeSeat[] = [{ id: "p", computer: false, seat: 0 }, { id: "x", computer: true, seat: 1 }, { id: "y", computer: true, seat: 2 }, { id: "z", computer: true, seat: 3 }];
  const t = make({ rebuysPerPlayer: 0 });
  let s = round(t, t.start(seats), seats, ["p"], "x");
  s = t.withLedger(s, ledger.set(ledger.set(ledger.set(t.ledger(s), "x", 200), "y", 100), "z", 100));
  let c = t.conclude(s, seats);
  assert.equal(c.outcome, "completed");
  assert.equal(c.winnerId, "x");
  assert.deepEqual(t.standings(c.state).map((r) => [r.id, r.place]), [["x", 1], ["y", 2], ["z", 2], ["p", 4]]);
  s = round(t, t.start(seats), seats, ["p"], "x");
  s = t.withLedger(s, ledger.set(ledger.set(ledger.set(t.ledger(s), "x", 150), "y", 150), "z", 100));
  c = t.conclude(s, seats);
  assert.equal(c.winnerId, null);
  assert.equal(t.place(c.state, "x"), 1);
  assert.equal(t.place(c.state, "y"), 1);
  assert.equal(t.place(c.state, "z"), 3);
});

test("cancelling clears offers and the winner but keeps places already made", () => {
  const seats = people("a", "b", "c");
  const t = make({ rebuysPerPlayer: 0 });
  let s = round(t, t.start(seats), seats, ["c"], "a");
  s = t.conclude(s, seats).state;
  s = round(t, s, seats, ["b"], "a");
  const cancelled = t.cancel(s);
  assert.equal(cancelled.finished, true);
  assert.equal(cancelled.winnerId, null);
  assert.deepEqual(cancelled.pendingBust, []);
  assert.equal(t.place(cancelled, "c"), 3);
});

test("chips are conserved across rebuys", () => {
  const seats = people("a", "b");
  const t = make();
  let s = round(t, t.start(seats), seats, ["b"], "a");
  s = (t.resolve(s, "b", true) as { state: TournamentState }).state;
  const total = ["a", "b"].reduce((n, id) => n + t.balance(s, id), 0);
  assert.equal(total, t.chipsIssued(s));
  assert.equal(total, 300);
});

test("result rows follow the standings screens", () => {
  const players = [
    { id: "d", name: "Di", place: null, isBot: false, rebuysUsed: 0, stack: 800 },
    { id: "b", name: "Bea", place: 2, isBot: true, rebuysUsed: 1, stack: 0 },
    { id: "a", name: "Ada", place: 1, isBot: false, rebuysUsed: 0, stack: 9000 },
    { id: "c", name: "Cy", place: 2, isBot: false, rebuysUsed: 0, stack: 0 },
  ];
  const rows = resultRows(players, "a");
  assert.deepEqual(rows.map((r) => r.id), ["a", "b", "c", "d"]);
  assert.deepEqual(rows.map((r) => r.rebought), [false, true, false, false]);
  assert.deepEqual(rows.map((r) => r.showStack), [false, false, false, true]);
  assert.equal(rows[0].isYou, true);
  assert.equal(headingKey("cancelled"), "cancelled_title");
  assert.equal(headingKey("completed"), "standings");
});

test("the example tournament runs without a game", () => {
  const r = play();
  assert.equal(r.offered, true);
  assert.equal(r.winner, "a");
  assert.deepEqual(r.standings.map((s) => [s.id, s.place]), [["a", 1], ["b", 2], ["c", 3]]);
});

test("export and import round-trip and refuse tampering", () => {
  const seats = people("a", "b", "c");
  const t = make();
  let s = round(t, t.start(seats), seats, ["b"], "a", 500);
  s = (t.resolve(round(t, t.start(seats), seats, ["c"], "a", 500), "c", false) as { state: TournamentState }).state;
  const text = exportAll(s);
  assert.deepEqual(importAll(text), s);
  const withOffer = round(t, t.start(seats), seats, ["b"], "a", 500);
  assert.deepEqual(importAll(exportAll(withOffer)), withOffer);
  assert.throws(() => importAll(text.replace('"in"', '"out"')), /checksum/);
  assert.throws(() => importAll(text.split("\n").slice(0, 3).join("\n")), /missing/);
});
