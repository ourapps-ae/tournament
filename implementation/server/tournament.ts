// A tournament of rounds: entries, rebuy offers, eliminations, finishing places and the winner.
// Pure: every operation takes a state and returns a new one. Chips live in an injected ledger,
// the schedule of levels in an injected level schedule, the people and computers in a seating.
// Times given to it (actionMs) are milliseconds on the table's action clock.

export type Entry = { id: string; status: "in" | "out"; place: number | null; rebuysUsed: number; startStack: number };
export type Offer = { playerId: string; deadline: number; autoAt: number | null };
export type TournamentState = {
  entries: Entry[];
  ledger: unknown;
  offers: Offer[];
  pendingBust: string[];
  winnerId: string | null;
  finished: boolean;
};
export type Tiebreak = "stackAtDeal" | "shared";
export type TournamentSettings = {
  startingStack: number;
  rebuysPerPlayer: number;
  rebuyStack: number;
  lastRebuyLevel: number;
  rebuyDecisionSeconds: number;
  tiebreak: Tiebreak;
};
export type Standing = { id: string; place: number | null; stack: number; rebuysUsed: number; out: boolean };
export type Concluded = { state: TournamentState; outcome: "continue" | "completed"; winnerId: string | null };

// What the tournament needs from the chip-ledger, level-schedule and seating components. The tournament calls the chip
// ledger as create/issue/balance/issued/setSeats and the level schedule as levelAt/describe.
export type Ledger = {
  create(): unknown;
  issue(ledger: unknown, id: string, amount: number): unknown;
  balance(ledger: unknown, id: string): number;
  issued(ledger: unknown): number;
  // Tell the ledger each player's seat number, so the odd chip goes by seat.
  setSeats(ledger: unknown, seats: { id: string; seat: number }[]): unknown;
};
export type Schedule = {
  levelAt(elapsedMs: number): number;
  describe(elapsedMs: number): unknown;
};
export type SeatView = { id: string; computer: boolean; seat: number };
export type Seats = { list(state: any): SeatView[]; find(state: any, id: string): SeatView | undefined; people(state: any): SeatView[] };

export const DEFAULT_SETTINGS: TournamentSettings = {
  startingStack: 5000,
  rebuysPerPlayer: 1,
  rebuyStack: 5000,
  lastRebuyLevel: 3,
  rebuyDecisionSeconds: 30,
  tiebreak: "stackAtDeal",
};

export function checkSettings(input: Partial<TournamentSettings> = {}): TournamentSettings {
  const s = { ...DEFAULT_SETTINGS, ...input };
  const count = (n: unknown, min: number) => Number.isInteger(n) && (n as number) >= min;
  if (!count(s.startingStack, 1) || !count(s.rebuyStack, 1)) throw new Error("tournament: startingStack and rebuyStack must be whole numbers above zero");
  if (!count(s.rebuysPerPlayer, 0) || !count(s.lastRebuyLevel, 0) || !count(s.rebuyDecisionSeconds, 1)) throw new Error("tournament: rebuysPerPlayer, lastRebuyLevel (0 or more) and rebuyDecisionSeconds (1 or more) must be whole numbers");
  if (s.tiebreak !== "stackAtDeal" && s.tiebreak !== "shared") throw new Error("tournament: tiebreak must be stackAtDeal or shared");
  return s;
}

export function createTournament(input: Partial<TournamentSettings>, parts: { ledger: Ledger; schedule: Schedule; seating: Seats }) {
  const settings = checkSettings(input);
  const { ledger: chips, schedule, seating } = parts;
  const copy = (t: TournamentState): TournamentState => structuredClone(t);
  const entryOf = (t: TournamentState, id: string) => t.entries.find((e) => e.id === id);
  const isComputer = (seats: unknown, id: string) => seating.find(seats, id)?.computer === true;

  const api = {
    settings,
    create(): TournamentState {
      return { entries: [], ledger: chips.create(), offers: [], pendingBust: [], winnerId: null, finished: false };
    },
    // Everyone sitting enters with the starting stack.
    start(seats: unknown): TournamentState {
      const t = api.create();
      for (const s of seating.list(seats)) {
        t.entries.push({ id: s.id, status: "in", place: null, rebuysUsed: 0, startStack: settings.startingStack });
        t.ledger = chips.issue(t.ledger, s.id, settings.startingStack);
      }
      t.ledger = chips.setSeats(t.ledger, seating.list(seats).map((s) => ({ id: s.id, seat: s.seat })));
      return t;
    },
    entry(t: TournamentState, id: string): Entry | undefined {
      return entryOf(t, id);
    },
    activeIds(t: TournamentState): string[] {
      return t.entries.filter((e) => e.status === "in").map((e) => e.id);
    },
    isActive(t: TournamentState, id: string): boolean {
      return entryOf(t, id)?.status === "in";
    },
    balance(t: TournamentState, id: string): number {
      return chips.balance(t.ledger, id);
    },
    rebuysUsed(t: TournamentState, id: string): number {
      return entryOf(t, id)?.rebuysUsed ?? 0;
    },
    place(t: TournamentState, id: string): number | null {
      return entryOf(t, id)?.place ?? null;
    },
    ledger(t: TournamentState): unknown {
      return t.ledger;
    },
    withLedger(t: TournamentState, ledger: unknown): TournamentState {
      const g = copy(t);
      g.ledger = ledger;
      return g;
    },
    chipsIssued(t: TournamentState): number {
      return chips.issued(t.ledger);
    },
    levelAt(levelClockMs: number): number {
      return schedule.levelAt(levelClockMs);
    },
    clockInfo(levelClockMs: number): unknown {
      return schedule.describe(levelClockMs);
    },
    // A round is about to be dealt: remember each active entry's stack for ranking bust-outs.
    roundStarted(t: TournamentState): TournamentState {
      const g = copy(t);
      for (const e of g.entries) if (e.status === "in") e.startStack = chips.balance(g.ledger, e.id);
      return g;
    },
    // A round has ended. Active entries without chips are out unless a rebuy is on offer.
    roundSettled(t: TournamentState, input: { level: number; actionMs: number; seats: unknown; computerDelayMs: number }): TournamentState {
      const g = copy(t);
      const busted = g.entries.filter((e) => e.status === "in" && chips.balance(g.ledger, e.id) === 0);
      g.pendingBust = busted.map((e) => e.id);
      for (const e of busted) {
        if (e.rebuysUsed < settings.rebuysPerPlayer && input.level <= settings.lastRebuyLevel) {
          g.offers.push({
            playerId: e.id,
            deadline: input.actionMs + settings.rebuyDecisionSeconds * 1000,
            autoAt: isComputer(input.seats, e.id) ? input.actionMs + input.computerDelayMs : null,
          });
        }
      }
      return g;
    },
    offers(t: TournamentState): Offer[] {
      return t.offers;
    },
    isFinished(t: TournamentState): boolean {
      return t.finished;
    },
    startingStack(): number {
      return settings.startingStack;
    },
    rebuyStack(): number {
      return settings.rebuyStack;
    },
    hasOffers(t: TournamentState): boolean {
      return t.offers.length > 0;
    },
    // The level clock stands still while rebuy offers are open, so nobody loses blind time to a
    // decision. The engine passes this as `runs.level` to the game clock.
    levelClockRuns(t: TournamentState): boolean {
      return t.offers.length === 0;
    },
    offerFor(t: TournamentState, id: string): Offer | undefined {
      return t.offers.find((o) => o.playerId === id);
    },
    // The first offer that is due: a computer accepts at its time, a person who has not answered
    // by the deadline declines.
    dueOffer(t: TournamentState, actionMs: number, seats: unknown): { playerId: string; accept: boolean } | null {
      for (const o of t.offers) {
        if (isComputer(seats, o.playerId)) {
          if (o.autoAt !== null && actionMs >= o.autoAt) return { playerId: o.playerId, accept: true };
        } else if (actionMs >= o.deadline) return { playerId: o.playerId, accept: false };
      }
      return null;
    },
    // The action-clock time of the next offer that will fall due, or null.
    nextOfferDue(t: TournamentState, seats: unknown): number | null {
      const times = t.offers.map((o) => (isComputer(seats, o.playerId) ? o.autoAt ?? o.deadline : o.deadline));
      return times.length ? Math.min(...times) : null;
    },
    // Answer an offer. Accepting gives the rebuy stack and uses a rebuy.
    resolve(t: TournamentState, id: string, accept: boolean): { ok: true; state: TournamentState } | { ok: false; code: "notAllowed" } {
      if (!api.offerFor(t, id)) return { ok: false, code: "notAllowed" };
      const g = copy(t);
      g.offers = g.offers.filter((o) => o.playerId !== id);
      if (accept) {
        g.ledger = chips.issue(g.ledger, id, settings.rebuyStack);
        entryOf(g, id)!.rebuysUsed += 1;
        g.pendingBust = g.pendingBust.filter((x) => x !== id);
      }
      return { ok: true, state: g };
    },
    // All offers are answered: those still without chips go out, then the winner or the next round.
    conclude(t: TournamentState, seats: unknown): Concluded {
      const g = copy(t);
      const busted = g.pendingBust.map((id) => entryOf(g, id)!).filter((e) => e.status === "in" && chips.balance(g.ledger, e.id) === 0);
      if (busted.length) eliminate(g, busted);
      g.pendingBust = [];
      const active = g.entries.filter((e) => e.status === "in");
      if (active.length === 1) {
        active[0].place = 1;
        g.winnerId = active[0].id;
        g.finished = true;
        g.offers = [];
        return { state: g, outcome: "completed", winnerId: g.winnerId };
      }
      if (!active.some((e) => seating.people(seats).some((p) => p.id === e.id))) {
        placeByStack(g, active);
        g.finished = true;
        g.offers = [];
        return { state: g, outcome: "completed", winnerId: g.winnerId };
      }
      return { state: g, outcome: "continue", winnerId: null };
    },
    // The tournament is ended with no winner; round results already recorded stand.
    cancel(t: TournamentState): TournamentState {
      const g = copy(t);
      g.offers = [];
      g.pendingBust = [];
      g.winnerId = null;
      g.finished = true;
      return g;
    },
    // Finishing order: placed entries by place (stable), then the rest with their stacks.
    standings(t: TournamentState): Standing[] {
      const rows = t.entries.map((e): Standing => ({ id: e.id, place: e.place, stack: chips.balance(t.ledger, e.id), rebuysUsed: e.rebuysUsed, out: e.status === "out" }));
      const ranked = rows.filter((r) => r.place !== null).sort((a, b) => a.place! - b.place!);
      return [...ranked, ...rows.filter((r) => r.place === null)];
    },
    winner(t: TournamentState): string | null {
      return t.winnerId;
    },
  };

  // Entries out in the same round place by their stack at the deal (or share one place); the
  // last place goes to the first out. `slots` counts entries still in before the round's bust-outs.
  function eliminate(g: TournamentState, busted: Entry[]): void {
    let slots = g.entries.filter((e) => e.status === "in").length;
    const groups = new Map<number, Entry[]>();
    for (const e of busted) {
      const key = settings.tiebreak === "shared" ? 0 : e.startStack;
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    for (const key of [...groups.keys()].sort((a, b) => a - b)) {
      const group = groups.get(key)!;
      const place = slots - group.length + 1;
      for (const e of group) {
        e.place = place;
        e.status = "out";
      }
      slots -= group.length;
    }
  }

  // No person left: finish now with the computers placed by stack; a clear leader wins.
  function placeByStack(g: TournamentState, active: Entry[]): void {
    const sorted = [...active].sort((a, b) => chips.balance(g.ledger, b.id) - chips.balance(g.ledger, a.id));
    let place = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && chips.balance(g.ledger, sorted[i].id) < chips.balance(g.ledger, sorted[i - 1].id)) place = i + 1;
      sorted[i].place = place;
    }
    const top = sorted.length && (sorted.length === 1 || chips.balance(g.ledger, sorted[0].id) > chips.balance(g.ledger, sorted[1].id));
    g.winnerId = top ? sorted[0].id : null;
  }

  return api;
}

export type Tournament = ReturnType<typeof createTournament>;
