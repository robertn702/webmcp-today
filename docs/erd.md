# WebMCP Cafe — ERD

Source of truth: `packages/db/src/*.ts` (Drizzle). Regenerate this diagram when the
schema changes.

## Registry tables (app-owned)

Package-install model: trust is install count, not per-tool verification. There is no
snapshot table — `definition_versions` rows are themselves the served truth.

These tables are in `public`; `users` below is the cross-schema `auth.users` (see the
next section). Mermaid entity names can't carry the qualifier, so the FK notes do.

```mermaid
erDiagram
    users ||--o{ webmcp_definitions : "contributes (contributor_id)"
    users ||--o{ installs : installs
    webmcp_definitions ||--o{ definition_versions : "publishes (append-only, cascade)"
    webmcp_definitions ||--o{ installs : "has (cascade)"
    definition_versions ||--o{ installs : "pinned to (version_id)"
    webmcp_definitions ||--o{ revocations : "revoked by (cascade)"
    definition_versions ||--o{ revocations : "revoked at (version_id, nullable)"
    users ||--o{ revocations : "revokes (revoked_by)"

    webmcp_definitions {
        uuid id PK
        text domain "site key: registrable domain or specific host, idx"
        text page_type
        text title
        text description
        text contributor_id FK "-> auth.users.id"
        timestamptz created_at
        timestamptz updated_at
    }

    definition_versions {
        uuid id PK
        uuid definition_id FK "-> webmcp_definitions.id, idx"
        int version "uq: definition_id+version"
        jsonb url_patterns "string[] — Chrome @match style, e.g. *://*.wikipedia.org/wiki/*"
        jsonb tools "ToolDescriptor[] — matches zod schema"
        jsonb api "ApiBlock, nullable — tier-1 API execution surface (docs/api-execution-model.md)"
        int min_engine "capability floor this version's content requires"
        text changelog "optional, shown to installed users deciding whether to update"
        timestamptz created_at "immutable: no updated_at"
    }

    installs {
        text user_id PK,FK "-> auth.users.id"
        uuid definition_id PK,FK "-> webmcp_definitions.id"
        uuid version_id FK "-> definition_versions.id, version the user is pinned to"
        timestamptz created_at
        timestamptz updated_at
    }

    revocations {
        bigserial id PK "monotonic — doubles as the client's poll cursor"
        uuid definition_id FK "-> webmcp_definitions.id (cascade)"
        uuid version_id FK "-> definition_versions.id, NULL = the whole package"
        text reason "short, shown to the user"
        timestamptz revoked_at
        text revoked_by FK "-> auth.users.id"
    }
```

## Auth tables (better-auth-owned — treat the shapes as fixed)

These live in the **`auth` Postgres schema**, not `public` — the tables below are all
`auth.users`, `auth.sessions`, … The split keeps the credential-bearing columns
(`accounts.access_token`/`refresh_token`, `api_keys.key`) behind one schema-level grant
and leaves `public` app-owned.

Column shapes come from better-auth's generated schema and must match the plugin's
expectations. The _table names_ are ours: better-auth resolves models against the
drizzle export names (`user`, `session`, …, `apikey` — kept singular in
`packages/db/src/auth-schema.ts`), never against the SQL name.

```mermaid
erDiagram
    users ||--o{ sessions : has
    users ||--o{ accounts : has
    users ||--o{ api_keys : "authenticates (reference_id)"

    users {
        text id PK
        text name
        text email "unique"
        bool email_verified
        text image
        timestamp created_at
        timestamp updated_at
    }

    sessions {
        text id PK
        text token "unique"
        timestamp expires_at
        text ip_address
        text user_agent
        text user_id FK "-> users.id"
    }

    accounts {
        text id PK
        text account_id
        text provider_id
        text user_id FK "-> users.id"
        text access_token
        text refresh_token
        text id_token
        timestamp access_token_expires_at
        timestamp refresh_token_expires_at
        text scope
        text password
    }

    verifications {
        text id PK
        text identifier
        text value
        timestamp expires_at
    }

    api_keys {
        text id PK
        text config_id "default 'default'"
        text name
        text start
        text reference_id FK "-> users.id"
        text prefix
        text key
        int refill_interval
        int refill_amount
        timestamp last_refill_at
        bool enabled
        bool rate_limit_enabled
        int rate_limit_time_window
        int rate_limit_max
        int request_count
        int remaining
        timestamp last_request
        timestamp expires_at
        text permissions
        text metadata
    }
```

## Reading notes

- **Served truth:** `definition_versions` rows directly — no separate snapshot table.
  Browse/fresh lookup serves `max(version)` per definition. Installed users stay pinned
  to `installs.version_id` until they explicitly call the update endpoint (npm-style, no
  auto-update); rollback is just setting `version_id` back to an older version.
- **Append-only versions:** publishing a new version never mutates or deletes an old one.
  `webmcp_definitions` (title/description/domain) is the one mutable row per
  package and is edited independently of publishing a version. `minEngine` lives on
  `definition_versions`, not the definition, since it's a property of a version's
  content.
- **No `(domain, url_pattern)` uniqueness — by design.** Packages are opinions, not
  registrations: rival packages may target the same site. Install counts + pattern
  specificity rank them at lookup time (`rankConfigsByUrl` in `@robertn702/webmcp-cafe-schema`);
  an abandoned package never blocks a fresh replacement.
- **Derived trust:** install count is `COUNT(*) ... GROUP BY definition_id` on `installs`,
  computed at query time — no denormalized counter in v1.
- **`installs` does double duty:** `WHERE user_id = ?` drives what the extension should
  fetch for a signed-in user (with `version_id` saying which version); `GROUP BY
definition_id` drives the trust signal.
- **`revocations` is append-only and read-only over HTTP.** Served by
  `GET /api/revocations?since=<cursor>` (public, `WHERE id > cursor ORDER BY id`); writes
  are hand-run SQL in v1 — there is no admin role and no write endpoint. `id` is a
  `bigserial` rather than a random uuid precisely because it is that cursor. It exists
  for the local-install model (`docs/local-first-installs.md` §5): once config bodies
  live on the client's disk, this feed is the only lever the registry keeps after
  install.
