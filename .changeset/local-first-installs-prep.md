---
"@robertn702/webmcp-cafe-schema": minor
---

Add the page↔extension install bridge protocol (`bridge.ts`:
`BRIDGE_PROTOCOL_VERSION`, `bridgeRequestSchema`, and the per-message
request/response schemas + types) and `domainsResponseSchema` /
`DomainsResponse` for `GET /api/domains`. Add `latest` to
`revocationsResponseSchema` so a client can detect its stored cursor is ahead
of the server (e.g. after a DB wipe) and reset. `installCount` is now marked
`@deprecated` in a comment; it stays optional and unchanged on the wire.
