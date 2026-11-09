// Not packaged. The tournament over the REAL chip-ledger and level-schedule components (siblings
// in components/), through createLedgerApi and createScheduleApi. Skips a provider that is not there.
// Run: node --test authoring/integration.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { createTournament } from "../implementation/server/tournament.ts";

const ledgerFile = new URL("../../chip-ledger/implementation/server/ledger.ts", import.meta.url);
const levelsFile = new URL("../../level-schedule/implementation/server/levels.ts", import.meta.url);
const seatsOf = (...ids: string[]) => ids.map((id, seat) => ({ id, computer: false, seat }));
const seating = { list: (s: { id: string; computer: boolean; seat: number }[]) => s, find: (s: { id: string; computer: boolean; seat: number }[], id: string) => s.find((x) => x.id === id), people: (s: { id: string; computer: boolean; seat: number }[]) => s.filter((x) => !x.computer) };

test("the real chip-ledger carries the tournament's entries and rebuys", { skip: existsSync(ledgerFile) ? false : "chip-ledger is not present" }, async () => {
  const module = await import(ledgerFile.href);
  const ledger = module.createLedgerApi({ startingStack: 500 });
  const l = ledger.issue(ledger.issue(ledger.create(), "a", 500), "b", 500);
  assert.equal(ledger.balance(l, "a"), 500);
  assert.equal(ledger.balance(l, "nobody"), 0);
  assert.equal(ledger.issued(l), 1000);
  assert.ok(module.audit(l).balanced, "the ledger's own audit agrees");
  assert.equal(ledger.balance(ledger.issue(l, "a", 250), "a"), 750);
  assert.equal(ledger.issued(ledger.issue(l, "a", 250)), 1250);
});

test("the real level-schedule gives the tournament its level and clock facts", { skip: existsSync(levelsFile) ? false : "level-schedule is not present" }, async () => {
  const module = await import(levelsFile);
  const levels = [{ label: "1", values: { sb: 25, bb: 50 } }, { label: "2", values: { sb: 50, bb: 100 } }];
  const schedule = module.createSchedule(levels, { levelSeconds: 600 });
  const bound = module.createScheduleApi(schedule);
  const t = createTournament({ startingStack: 500, rebuyStack: 500 }, { ledger: { create: () => ({ b: {}, i: 0 }), issue: (l: any) => l, balance: () => 0, issued: () => 0, setSeats: (l: any) => l }, schedule: bound, seating });
  assert.equal(t.levelAt(0), 1);
  assert.equal(t.levelAt(600_000), 2);
  const info = t.clockInfo(100_000) as { level: number; values: Record<string, number>; msUntilNext: number };
  assert.equal(info.level, 1);
  assert.deepEqual(info.values, { sb: 25, bb: 50 });
  assert.equal(info.msUntilNext, 500_000);
});

test("a whole tournament over both real providers: entry, a bust, a rebuy, chips conserved", { skip: existsSync(ledgerFile) && existsSync(levelsFile) ? false : "chip-ledger or level-schedule is not present" }, async () => {
  const chips = await import(ledgerFile.href);
  const levels = await import(levelsFile.href);
  const schedule = levels.createScheduleApi(levels.createSchedule([{ label: "1", values: { sb: 25, bb: 50 } }], { levelSeconds: 600 }));
  const t = createTournament({ startingStack: 500, rebuyStack: 500, rebuysPerPlayer: 1, lastRebuyLevel: 1 }, { ledger: chips.createLedgerApi({ startingStack: 500 }), schedule, seating });
  const seats = seatsOf("a", "b", "c");
  let s = t.start(seats);
  assert.equal(t.chipsIssued(s), 1500);
  s = t.roundStarted(s);
  // b loses everything to a through the ledger's own operations.
  let l = t.ledger(s);
  const taken = chips.commit(l, "b", 500);
  l = taken.ledger;
  l = chips.settle(l, [{ amount: 500, eligible: ["a", "b"], winners: [{ id: "a", amount: 500 }] }]);
  s = t.roundSettled(t.withLedger(s, l), { level: 1, actionMs: 0, seats, computerDelayMs: 0 });
  assert.equal(t.balance(s, "a"), 1000);
  assert.equal(t.balance(s, "b"), 0);
  assert.deepEqual(t.offers(s).map((o) => o.playerId), ["b"]);
  const answered = t.resolve(s, "b", true);
  assert.ok(answered.ok);
  assert.equal(t.balance(answered.state, "b"), 500);
  assert.equal(t.chipsIssued(answered.state), 2000);
  const total = t.activeIds(answered.state).reduce((n, id) => n + t.balance(answered.state, id), 0);
  assert.equal(total, t.chipsIssued(answered.state), "chips are conserved");
});
