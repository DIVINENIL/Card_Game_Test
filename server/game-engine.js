/*
 * Authoritative game rules adapter.
 *
 * SECURITY: this module intentionally fails closed until the pure game rules
 * are ported from the browser bundle. Do not accept client-supplied snapshots,
 * events, HP, Light, hands, or turn ownership as authoritative input.
 *
 * Required contract:
 *   createGame(decks) -> canonical server-only state
 *   applyAction(state, seat, action) -> { accepted, state, events }
 *   snapshotForSeat(state, seat) -> strictly redacted player view
 *
 * Keep opponent hands, deck order, private pending choices, and hidden
 * resources server-side. AI must receive snapshotForSeat(botSeat), never the
 * canonical state.
 */
export function createGame() {
  throw new Error("Game rules have not yet been ported to the server. Multiplayer is not enabled.");
}
export function applyAction() {
  return { accepted: false, reason: "SERVER_ENGINE_NOT_READY" };
}
export function snapshotForSeat(state, seat) {
  if (!state || !Number.isInteger(seat) || seat < 0 || seat > 1) return null;
  throw new Error("Per-seat state redaction must be implemented before gameplay is enabled.");
}
