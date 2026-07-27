---
"@robertn702/webmcp-cafe-schema": minor
---

Add the revocation feed wire schemas: `revocationEntrySchema` (with a `packageId` field)
and `revocationsResponseSchema` (plus the `RevocationEntry` / `RevocationsResponse`
types), describing `GET /api/revocations?since=<cursor>`. Additive — nothing existing
changes. They live here because the registry and the extension are the two consumers and
this is the only module both reach.
