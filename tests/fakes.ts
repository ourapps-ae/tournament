// Minimal stand-ins for the chip-ledger, level-schedule and seating components, for tests only.
export type FakeLedger = { balances: Record<string, number>; issued: number; seats?: { id: string; seat: number }[] };

export const ledger = {
  create: (): FakeLedger => ({ balances: {}, issued: 0 }),
  issue(l: unknown, id: string, amount: number): FakeLedger {
    const g = structuredClone(l as FakeLedger);
    g.balances[id] = (g.balances[id] ?? 0) + amount;
    g.issued += amount;
    return g;
  },
  setSeats: (l: unknown, seats: { id: string; seat: number }[]): FakeLedger => ({ ...(l as FakeLedger), seats }),
  balance: (l: unknown, id: string) => (l as FakeLedger).balances[id] ?? 0,
  issued: (l: unknown) => (l as FakeLedger).issued,
  // Test helper, not part of the interface: set a balance as a round would.
  set(l: unknown, id: string, amount: number): FakeLedger {
    const g = structuredClone(l as FakeLedger);
    g.balances[id] = amount;
    return g;
  },
};

export const LEVEL_MS = 600_000;
export const schedule = {
  levelAt: (ms: number) => Math.floor(ms / LEVEL_MS) + 1,
  describe: (ms: number) => ({ level: Math.floor(ms / LEVEL_MS) + 1, nextLevelInMs: LEVEL_MS - (ms % LEVEL_MS), levelDurationMs: LEVEL_MS }),
};

export type FakeSeat = { id: string; computer: boolean; seat: number };
export const seating = {
  list: (s: FakeSeat[]) => s,
  find: (s: FakeSeat[], id: string) => s.find((x) => x.id === id),
  people: (s: FakeSeat[]) => s.filter((x) => !x.computer),
};
