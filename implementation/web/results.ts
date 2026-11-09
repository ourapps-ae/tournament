// Rows of the final standings. Text stays with the application's language files; this decides
// the order and which figure each row shows.

export type ResultPlayer = { id: string; name: string; place: number | null; isBot: boolean; rebuysUsed: number; stack: number };
export type ResultRow = { id: string; name: string; place: number | null; isYou: boolean; isComputer: boolean; rebought: boolean; showStack: boolean; stack: number };

// Placed players by place (ties keep their listed order), then those still without a place with their stack.
export function resultRows(players: readonly ResultPlayer[], you: string): ResultRow[] {
  const ranked = players.filter((p) => p.place !== null).sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
  const unranked = players.filter((p) => p.place === null);
  return [...ranked, ...unranked].map((p) => ({
    id: p.id,
    name: p.name,
    place: p.place,
    isYou: p.id === you,
    isComputer: p.isBot,
    rebought: p.place !== null && p.rebuysUsed > 0,
    showStack: p.place === null,
    stack: p.stack,
  }));
}

export function headingKey(status: string): "cancelled_title" | "standings" {
  return status === "cancelled" ? "cancelled_title" : "standings";
}
