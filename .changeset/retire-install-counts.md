---
"@robertn702/webmcp-cafe-schema": minor
---

Breaking: `statsResponseSchema.totalInstalls` is now `totalDomains` — the registry
stopped counting installs as a trust signal (trust is derived from readable data
and explicit consent instead; see `installCount`'s existing `@deprecated` note).
The registry no longer populates `installCount` on served packages either,
though the field stays on the wire, optional and deprecated, for existing
consumers.
