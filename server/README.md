# Anime Card Fight — Render backend

This branch adds the first backend foundation for server-authoritative multiplayer. It does not replace the live GitHub Pages game yet.

## Deploy the backend to Render

1. Open Render and choose **New → Blueprint**.
2. Connect the GitHub repository `DIVINENIL/Card_Game_Test`.
3. Select branch `server-authoritative-multiplayer`.
4. Render reads `server/render.yaml` and creates the Node.js WebSocket service.
5. Keep `ALLOWED_ORIGINS` set to `https://divinenil.github.io`.
6. After deployment, the health endpoint should return JSON with `ok: true`.
7. Save the service's `wss://...onrender.com` URL for the later browser-client integration.

Do not change the GitHub Pages site or merge this branch into `main` yet.

## What is implemented

- Node.js WebSocket service scaffold for Render.
- Room creation/joining with server-generated room IDs.
- Random per-seat reconnect tokens and a short reconnect window.
- Server-side action dispatch contract; clients cannot submit a replacement game snapshot.
- Per-seat event filtering: `only` events and Charge/Defense declarations are sent only to the owning seat.
- Safer room lifecycle checks and a production Origin allowlist.
- Health endpoint at `/health`.

## What is deliberately not enabled yet

The current game is still a browser-side engine using PeerJS. The full game rules in `index.html` have **not** been ported to `game-engine.js`, and the browser client has **not** been switched to this WebSocket service. The engine adapter therefore fails closed and rejects gameplay.

This is intentional. Making the current Host forward snapshots through Render would still let the Host inspect or forge the opponent's hidden state. A server relay is not an authoritative game server.

## Required work before playable authoritative multiplayer

1. Port the game reducer and all required card/effect data from the browser bundle into server-compatible modules.
2. Keep canonical game state exclusively on the server: turn, deck order, hands, Light, Charge/Defense, pending choices (including Bamboo-hatted Kim's Yield My Flesh), and AI state.
3. Validate every action against the authenticated seat, turn, resource costs, target legality, and current canonical state.
4. Implement separate redacted snapshots for each seat. Never send opponent hand/deck/private pending-effect fields.
5. Run the AI using only the information available to its seat; never pass it canonical hidden state.
6. Replace PeerJS in `index.html` with the WebSocket protocol only after server engine and privacy tests pass.
7. Add integration tests for illegal/out-of-turn actions, hidden-state isolation, reconnect, and delayed effects.

## Tests

Run from this directory:

```sh
npm install
npm test
```

The current tests verify private-event filtering and that gameplay remains blocked until the authoritative engine and snapshot redaction are implemented.
