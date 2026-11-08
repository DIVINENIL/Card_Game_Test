# Anime Card Fight — Render backend

This service is the first infrastructure step for server-authoritative multiplayer.

## Deploy to Render

1. In Render, choose **New → Blueprint** and connect this repository.
2. Select branch `server-authoritative-multiplayer`.
3. Render reads `server/render.yaml` and creates the Node.js WebSocket service.
4. Set `ALLOWED_ORIGINS` to `https://divinenil.github.io` (already supplied in the blueprint).
5. Copy the resulting `wss://...onrender.com` address for the browser client integration.

The `/health` endpoint should return JSON with `ok: true`.

## Important status

The room transport, seat tokens, reconnect window, origin check, and server-only action dispatch are scaffolded. The existing game is still a browser-side engine and currently uses PeerJS. The actual rules in the large HTML bundle have **not** yet been ported into `game-engine.js`, and the browser client has **not** been switched to this WebSocket service.

The engine adapter deliberately rejects/blocks gameplay until that port and per-seat snapshot redaction are implemented. This is intentional: a relay or host-submitted state would not solve the hidden-information vulnerability. Do not advertise this deployment as playable authoritative multiplayer yet.

## Security requirements for the remaining integration

- Port the deterministic game reducer and required data tables to server code.
- Server owns turn, deck order, hands, Light, Charge/Defense, delayed effects (including Yield My Flesh), and AI decisions.
- Validate every action against the authenticated seat and current turn.
- Send a different redacted snapshot to each seat; never send hidden fields and rely on client-side hiding.
- Add tests proving the opponent cannot obtain hand/deck/private pending-effect data and that illegal/out-of-turn actions are rejected.
- Replace PeerJS networking in `index.html` with the WebSocket protocol only after those tests pass.
