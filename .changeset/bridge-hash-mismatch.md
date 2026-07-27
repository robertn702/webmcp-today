---
"@robertn702/webmcp-cafe-schema": minor
---

Bridge protocol: add `hash-mismatch` to the install failure enum (the
extension recomputes `apiContentHash` over the served body and refuses the
install distinctly when it doesn't match) and allow `storage-unreadable` as
an uninstall failure reason.
