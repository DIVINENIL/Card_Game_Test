import test from "node:test";
import assert from "node:assert/strict";
import { filterEventsForSeat } from "./protocol.js";
import { createGame, applyAction, snapshotForSeat } from "./game-engine.js";

test("private events are delivered only to their owner", () => {
  const events = [
    { k: "txt", t: "public" },
    { k: "txt", only: 0, t: "seat zero secret" },
    { k: "txt", only: 1, t: "seat one secret" },
    { k: "chg", s: 0, i: 0 },
    { k: "def", s: 1, i: 2, d: "guard" },
  ];
  assert.deepEqual(filterEventsForSeat(events, 0), [events[0], events[1], events[3]]);
  assert.deepEqual(filterEventsForSeat(events, 1), [events[0], events[2], events[4]]);
});

test("invalid event collections and seats fail closed", () => {
  assert.deepEqual(filterEventsForSeat(null, 0), []);
  assert.deepEqual(filterEventsForSeat([{ k: "txt" }], 2), []);
  assert.deepEqual(filterEventsForSeat([{ k: "txt" }, null], 0), [{ k: "txt" }]);
});

test("game engine refuses to run until authoritative rules are ported", () => {
  assert.throws(() => createGame(), /not yet been ported/);
  assert.deepEqual(applyAction({}, 0, { t: "end" }), {
    accepted: false,
    reason: "SERVER_ENGINE_NOT_READY",
  });
  assert.throws(() => snapshotForSeat({ secret: true }, 0), /redaction must be implemented/);
});
