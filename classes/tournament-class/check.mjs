import { assert, load } from './runtime.mjs';
const server = await load('server/index.ts');
assert.throws(() => server.checkSettings({ startingStack: 0 }));
assert.throws(() => server.checkSettings({ rebuysPerPlayer: -1 }));
assert.equal(server.checkSettings({ startingStack: 100 }).startingStack, 100);
const web = await load('web/index.ts');
const players = [{ id: 'b', name: 'Bob', place: 2, isBot: false, rebuysUsed: 1, stack: 0 }, { id: 'a', name: 'Ada', place: 1, isBot: false, rebuysUsed: 0, stack: 200 }];
const rows = web.resultRows(players, 'a');
assert.deepEqual(rows.map(row => row.id), ['a', 'b']);
assert.equal(rows[0].isYou, true);
assert.equal(rows[1].rebought, true);
assert.equal(web.headingKey('cancelled'), 'cancelled_title');
assert.equal(web.headingKey('completed'), 'standings');
const ledger = {
  create: () => ({ balances: {}, issued: 0, seats: [] }),
  issue: (book, id, amount) => ({ ...book, balances: { ...book.balances, [id]: (book.balances[id] ?? 0) + amount }, issued: book.issued + amount }),
  balance: (book, id) => book.balances[id] ?? 0,
  issued: book => book.issued,
  setSeats: (book, seats) => ({ ...book, seats: structuredClone(seats) }),
};
const seating = { list: seats => seats, find: (seats, id) => seats.find(row => row.id === id), people: seats => seats.filter(row => !row.computer) };
const schedule = { levelAt: elapsed => 1 + Math.floor(elapsed / 10000), describe: elapsed => ({ level: 1 + Math.floor(elapsed / 10000) }) };
const tournament = server.createTournament({ startingStack: 100, rebuyStack: 100, rebuyDecisionSeconds: 5 }, { ledger, seating, schedule });
const seats = [{ id: 'a', seat: 0, computer: false }, { id: 'b', seat: 1, computer: false }];
const initial = tournament.start(seats);
assert.equal(tournament.chipsIssued(initial), 200);
assert.equal(tournament.balance(initial, 'b'), 100);
const busted = tournament.withLedger(tournament.roundStarted(initial), { ...tournament.ledger(initial), balances: { a: 200, b: 0 } });
const offered = tournament.roundSettled(busted, { level: 1, actionMs: 500, seats, computerDelayMs: 200 });
assert.equal(tournament.levelClockRuns(offered), false);
assert.equal(tournament.dueOffer(offered, 5499, seats), null);
assert.deepEqual(tournament.dueOffer(offered, 5500, seats), { playerId: 'b', accept: false });
const accepted = tournament.resolve(offered, 'b', true);
assert.equal(accepted.ok, true);
assert.equal(tournament.balance(accepted.state, 'b'), 100);
assert.equal(tournament.chipsIssued(accepted.state), 300);
assert.equal(tournament.rebuysUsed(accepted.state, 'b'), 1);
assert.equal(tournament.levelClockRuns(accepted.state), true);
assert.equal(tournament.balance(offered, 'b'), 0);
const second = tournament.withLedger(tournament.roundStarted(accepted.state), { ...tournament.ledger(accepted.state), balances: { a: 300, b: 0 } });
const settled = tournament.roundSettled(second, { level: 1, actionMs: 6000, seats, computerDelayMs: 200 });
assert.equal(tournament.hasOffers(settled), false);
const end = tournament.conclude(settled, seats);
assert.equal(end.outcome, 'completed');
assert.equal(end.winnerId, 'a');
assert.equal(tournament.place(end.state, 'b'), 2);
assert.deepEqual(server.importAll(server.exportAll(end.state)), end.state);
