/**
 * Seat-scoped event filtering.
 *
 * "only" marks a private event addressed to one seat. Charge and Defense
 * declarations are private to the player who made them. Keep this filtering
 * on the server: clients must never receive the other seat's private events.
 */
export function filterEventsForSeat(events, seat) {
  if (!Array.isArray(events) || (seat !== 0 && seat !== 1)) return [];
  return events.filter(event => {
    if (!event || typeof event !== "object" || Array.isArray(event)) return false;
    if (event.only !== undefined && event.only !== seat) return false;
    if ((event.k === "chg" || event.k === "def") && event.s !== seat) return false;
    return true;
  });
}
