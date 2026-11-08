import http from "node:http";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { createGame, applyAction, snapshotForSeat } from "./game-engine.js";
import { filterEventsForSeat } from "./protocol.js";

const PORT = Number(process.env.PORT || 10000);
const ORIGINS = new Set((process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:5500").split(",").map(x => x.trim()).filter(Boolean));
const rooms = new Map();
const sockets = new Map();
const now = () => Date.now();
const token = () => randomBytes(32).toString("base64url");
const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); };
const safeEqual = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
function publicRoom(room) { return { roomId: room.id, status: room.seats[1] ? "playing" : "waiting" }; }
function sendSeat(room, seat, type, extra = {}) {
  const player = room.seats[seat];
  if (!player?.ws) return;
  const view = snapshotForSeat(room.state, seat);
  send(player.ws, { type, room: publicRoom(room), seat, state: view, ...extra });
}
function broadcastViews(room, events = []) {
  // Events can contain private choices. Never broadcast the host copy verbatim.
  for (let seat = 0; seat < 2; seat++) sendSeat(room, seat, "state", { events: filterEventsForSeat(events, seat) });
}
function detach(ws) {
  const link = sockets.get(ws);
  if (!link) return;
  sockets.delete(ws);
  const room = rooms.get(link.roomId);
  if (!room) return;
  const seat = room.seats[link.seat];
  if (seat?.ws === ws) { seat.ws = null; seat.disconnectedAt = now(); }
  for (let i = 0; i < 2; i++) sendSeat(room, i, "peer-status", { connected: Boolean(room.seats[1-i]?.ws) });
  // Keep the seat/token for a short reconnect window; never transfer it to another player.
  room.lastActivity = now();
}
const server = http.createServer((req, res) => {
  if (req.url === "/health") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ ok: true, rooms: rooms.size })); }
  res.writeHead(404); res.end("Not found");
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
server.on("upgrade", (req, socket, head) => {
  const origin = req.headers.origin;
  if ((process.env.NODE_ENV === "production" && !origin) || (origin && ORIGINS.size && !ORIGINS.has(origin))) { socket.write("HTTP/1.1 403 Forbidden\r\n\r\n"); return socket.destroy(); }
  wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
});
wss.on("connection", ws => {
  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return send(ws, { type: "error", code: "BAD_JSON" }); }
    if (!msg || typeof msg.type !== "string") return send(ws, { type: "error", code: "BAD_MESSAGE" });
    if (msg.type === "create-room") {
      if (sockets.has(ws)) return send(ws, { type: "error", code: "ALREADY_IN_ROOM" });
      let id;
      do { id = randomBytes(4).toString("hex").toUpperCase(); } while (rooms.has(id));
      const seatToken = token();
      const room = { id, createdAt: now(), lastActivity: now(), seats: [{ token: seatToken, ws, disconnectedAt: null }, null], state: null, status: "waiting" };
      rooms.set(id, room); sockets.set(ws, { roomId: id, seat: 0 });
      send(ws, { type: "room-created", room: publicRoom(room), seat: 0, seatToken });
      return;
    }
    if (msg.type === "join-room") {
      if (sockets.has(ws)) return send(ws, { type: "error", code: "ALREADY_IN_ROOM" });
      const id = String(msg.roomId || "").toUpperCase();
      const room = rooms.get(id);
      if (!room) return send(ws, { type: "error", code: "ROOM_NOT_FOUND" });
      if (room.seats[1]) return send(ws, { type: "error", code: "ROOM_FULL" });
      const seatToken = token();
      room.seats[1] = { token: seatToken, ws, disconnectedAt: null };
      room.lastActivity = now(); sockets.set(ws, { roomId: id, seat: 1 });
      send(ws, { type: "room-joined", room: publicRoom(room), seat: 1, seatToken });
      sendSeat(room, 0, "peer-status", { connected: true });
      return;
    }
    if (msg.type === "reconnect") {
      if (sockets.has(ws)) return send(ws, { type: "error", code: "ALREADY_IN_ROOM" });
      const room = rooms.get(String(msg.roomId || "").toUpperCase());
      const seat = Number(msg.seat);
      if (seat !== 0 && seat !== 1) return send(ws, { type: "error", code: "RECONNECT_DENIED" });
      const player = room?.seats?.[seat];
      if (!player || !safeEqual(player.token, msg.seatToken) || (player.disconnectedAt && now() - player.disconnectedAt > 120000)) return send(ws, { type: "error", code: "RECONNECT_DENIED" });
      if (player.ws && player.ws !== ws) player.ws.close(4001, "Session replaced");
      player.ws = ws; player.disconnectedAt = null; sockets.set(ws, { roomId: room.id, seat }); room.lastActivity = now();
      send(ws, { type: "reconnected", room: publicRoom(room), seat, state: room.state ? snapshotForSeat(room.state, seat) : null });
      return;
    }
    const link = sockets.get(ws);
    if (!link) return send(ws, { type: "error", code: "NOT_IN_ROOM" });
    const room = rooms.get(link.roomId);
    if (!room) return send(ws, { type: "error", code: "ROOM_GONE" });
    room.lastActivity = now();
    if (msg.type === "start-game") {
      if (link.seat !== 0 || room.status !== "waiting" || !room.seats[1]) return send(ws, { type: "error", code: "CANNOT_START" });
      try { room.state = createGame(msg.decks); room.status = "playing"; broadcastViews(room); }
      catch (e) { send(ws, { type: "error", code: "ENGINE_NOT_READY", message: e.message }); }
      return;
    }
    if (msg.type === "action") {
      if (room.status !== "playing" || !room.state) return send(ws, { type: "error", code: "GAME_NOT_STARTED" });
      try {
        const result = applyAction(room.state, link.seat, msg.action);
        if (!result?.accepted) return send(ws, { type: "action-rejected", reason: result?.reason || "INVALID_ACTION" });
        room.state = result.state;
        broadcastViews(room, result.events || []);
      } catch (e) { console.error("Action processing failed:", e); send(ws, { type: "error", code: "ENGINE_ERROR" }); }
      return;
    }
    if (msg.type === "leave-room") { detach(ws); ws.close(1000, "Left room"); return; }
    send(ws, { type: "error", code: "UNKNOWN_MESSAGE" });
  });
  ws.on("close", () => detach(ws));
  ws.on("error", () => detach(ws));
});
setInterval(() => {
  const cutoff = now() - 30 * 60 * 1000;
  for (const [id, room] of rooms) {
    if (room.lastActivity < cutoff || room.seats.some(p => p?.disconnectedAt && now() - p.disconnectedAt > 120000)) rooms.delete(id);
  }
}, 30000).unref();
server.listen(PORT, "0.0.0.0", () => console.log(`Anime Card Fight backend listening on ${PORT}`));
