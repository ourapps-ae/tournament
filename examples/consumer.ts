// A three-entry tournament without any game: one entry loses everything, takes the rebuy, loses
// again and goes out; the last loses and the other wins. Chips are moved by hand as a game would.
import { createTournament } from "../implementation/server/tournament.ts";
import { ledger, schedule, seating, type FakeSeat } from "../tests/fakes.ts";

export function play() {
  const seats: FakeSeat[] = [{ id: "a", computer: false, seat: 0 }, { id: "b", computer: false, seat: 1 }, { id: "c", computer: true, seat: 2 }];
  const t = createTournament({ startingStack: 100, rebuyStack: 100, rebuysPerPlayer: 1, lastRebuyLevel: 2 }, { ledger, schedule, seating });
  let s = t.start(seats);
  const lose = (id: string, to: string) => {
    s = t.roundStarted(s);
    const amount = t.balance(s, id);
    s = t.withLedger(s, ledger.set(ledger.set(t.ledger(s), id, 0), to, t.balance(s, to) + amount));
    s = t.roundSettled(s, { level: 1, actionMs: 0, seats, computerDelayMs: 4000 });
  };
  lose("c", "a");
  const offered = t.hasOffers(s);
  const accepted = t.resolve(s, "c", true);
  if (!accepted.ok) throw new Error(accepted.code);
  s = accepted.state;
  s = t.conclude(s, seats).state;
  lose("c", "b");
  const second = t.resolve(s, "c", false);
  if (second.ok) throw new Error("no second offer expected");
  s = t.conclude(s, seats).state;
  lose("b", "a");
  s = t.conclude(s, seats).state;
  return { offered, winner: t.winner(s), standings: t.standings(s) };
}
