// Portable export and import of a tournament state as newline-delimited JSON, one record per
// line with a sha256 of its content. The ledger is carried as one opaque record in whatever form
// the chip-ledger component keeps it.
import { createHash } from "node:crypto";
import type { TournamentState } from "./tournament.ts";

type Body =
  | { kind: "entry"; id: string; status: "in" | "out"; place: number | null; rebuysUsed: number; startStack: number }
  | { kind: "offer"; playerId: string; deadline: number; autoAt: number | null }
  | { kind: "pending"; id: string }
  | { kind: "summary"; winnerId: string | null; finished: boolean }
  | { kind: "ledger"; value: unknown };

const hash = (body: Body) => createHash("sha256").update(JSON.stringify(body)).digest("hex");

export function exportAll(state: TournamentState): string {
  const bodies: Body[] = [
    ...state.entries.map((e): Body => ({ kind: "entry", ...e })),
    ...state.offers.map((o): Body => ({ kind: "offer", ...o })),
    ...state.pendingBust.map((id): Body => ({ kind: "pending", id })),
    { kind: "summary", winnerId: state.winnerId, finished: state.finished },
    { kind: "ledger", value: state.ledger },
  ];
  return bodies.map((b) => JSON.stringify({ ...b, sha256: hash(b) })).join("\n") + "\n";
}

export function importAll(text: string): TournamentState {
  const state: TournamentState = { entries: [], ledger: null, offers: [], pendingBust: [], winnerId: null, finished: false };
  let summary = false;
  let ledger = false;
  for (const line of text.split("\n").filter((l) => l.trim() !== "")) {
    const { sha256, ...body } = JSON.parse(line) as Body & { sha256: string };
    if (sha256 !== hash(body as Body)) throw new Error("tournament import: checksum mismatch");
    switch (body.kind) {
      case "entry": {
        const { kind: _, ...entry } = body;
        if (typeof entry.id !== "string" || (entry.status !== "in" && entry.status !== "out") || !Number.isInteger(entry.rebuysUsed) || !Number.isInteger(entry.startStack)) throw new Error("tournament import: bad entry");
        if (state.entries.some((e) => e.id === entry.id)) throw new Error("tournament import: duplicate entry");
        state.entries.push(entry);
        break;
      }
      case "offer": {
        const { kind: _, ...offer } = body;
        state.offers.push(offer);
        break;
      }
      case "pending":
        state.pendingBust.push(body.id);
        break;
      case "summary":
        state.winnerId = body.winnerId;
        state.finished = body.finished;
        summary = true;
        break;
      case "ledger":
        state.ledger = body.value;
        ledger = true;
        break;
      default:
        throw new Error("tournament import: unknown record");
    }
  }
  if (!summary || !ledger) throw new Error("tournament import: summary or ledger record missing");
  for (const o of state.offers) if (!state.entries.some((e) => e.id === o.playerId)) throw new Error("tournament import: offer without entry");
  return state;
}
