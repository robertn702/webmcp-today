import { z } from "zod";
import type { ToolDescriptor } from "./tool.js";
import { unknownPlaceholders } from "./templates.js";
import { hostCoversHostname, parseUrlPattern } from "./url-matching.js";

// Tier-1 API execution model — a package declares a site's HTTP surface as data
// and the executor derives the request. See docs/api-execution-model.md.
// This block is package-level (next to tools[]); tools bind to an endpoint by
// name via the tool's `endpoint` field. Reference integrity + same-origin
// baseUrl + {{param}} placeholder checks live in collectApiIssues (run from the
// package-level superRefine, because they need the sibling tools[]/urlPatterns).

const NAME_MAX = 64;
const PATH_MAX = 500;
/** Captured GraphQL queries run hundreds of lines; keep the ceiling generous. */
const DOCUMENT_MAX = 100_000;

const endpointName = z.string().min(1).max(NAME_MAX);

/** A named credential-acquisition flow, e.g. Reddit's modhash dance: fetch an
 * endpoint, extract a token from its JSON, resend it as a header. */
export const apiAuthSourceSchema = z.object({
  source: z.object({
    // Endpoint (by name) to fetch the token from.
    endpoint: endpointName,
    // Dot path into the JSON response, e.g. "data.modhash".
    extract: z.string().min(1).max(PATH_MAX),
  }),
  sendAs: z.object({
    header: z.string().min(1).max(200),
  }),
});

/** A GraphQL operation. `document` is opaque — either an inline query or a
 * "@documents/name" reference into the package-level `documents` block. It is
 * NEVER template-scanned; only `variables` bind {{param}} from tool input. */
export const apiGraphqlSchema = z.object({
  document: z.string().min(1).max(DOCUMENT_MAX),
  variables: z.record(z.string(), z.unknown()).optional(),
});

export const apiEndpointSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().min(1).max(2048),
  query: z.record(z.string(), z.string()).optional(),
  // Opaque body template; string leaves may carry {{param}} placeholders.
  body: z.unknown().optional(),
  form: z.record(z.string(), z.string()).optional(),
  // Response projection toward the tool-output budget. Validated as a non-empty
  // string ONLY — the projection grammar is owned by the executor, not the
  // schema (see docs open question "Output projection language").
  returns: z.string().min(1).max(PATH_MAX).optional(),
  // Dot path to an error payload in a 200 body (GraphQL `errors`, Reddit
  // `json.errors`); a non-empty value there = tool failure.
  errorPath: z.string().min(1).max(PATH_MAX).optional(),
  persistedQuery: z.boolean().optional(),
  graphql: apiGraphqlSchema.optional(),
  // Names of auth token sources to attach to this call.
  auth: z.array(endpointName).max(10).optional(),
});

export const apiBlockSchema = z.object({
  baseUrl: z
    .string()
    .min(1)
    .max(2048)
    .refine((v) => {
      try {
        return new URL(v).protocol === "https:";
      } catch {
        return false;
      }
    }, "baseUrl must be a valid https:// URL"),
  auth: z.record(z.string(), apiAuthSourceSchema).optional(),
  endpoints: z.record(z.string(), apiEndpointSchema),
  // Opaque named static GraphQL documents, referenced as "@documents/name".
  // NEVER template-scanned.
  documents: z.record(z.string(), z.string().min(1).max(DOCUMENT_MAX)).optional(),
});

export type ApiAuthSource = z.infer<typeof apiAuthSourceSchema>;
export type ApiEndpoint = z.infer<typeof apiEndpointSchema>;
export type ApiBlock = z.infer<typeof apiBlockSchema>;

const DOCUMENT_REF_RE = /^@documents\/(.+)$/;

export interface ApiValidationIssue {
  message: string;
  path: (string | number)[];
}

/** What collectApiIssues needs from a package: the api block plus the sibling
 * fields its references are checked against. Structurally satisfied by both the
 * full create-package shape and the publish-version subset. */
export interface ApiValidationTarget {
  urlPatterns: string[];
  tools: ToolDescriptor[];
  api?: ApiBlock;
}

/** Scan every string leaf of an arbitrary template value (body / graphql
 * variables) for {{param}} placeholders not present in `props`. */
function scanTemplateValue(
  value: unknown,
  props: string[],
  path: (string | number)[],
  issues: ApiValidationIssue[],
): void {
  if (typeof value === "string") {
    for (const name of unknownPlaceholders(value, props)) {
      issues.push({
        message: `Template variable "{{${name}}}" has no matching inputSchema property. Available: ${props.join(", ") || "(none)"}`,
        path,
      });
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => scanTemplateValue(item, props, [...path, i], issues));
  } else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      scanTemplateValue(item, props, [...path, key], issues);
    }
  }
}

/** Cross-validate an `api` block against the package's tools and urlPatterns.
 * Pure: returns issues instead of pushing to a zod ctx, so package.ts can wire
 * it into a superRefine without ctx-typing gymnastics. */
export function collectApiIssues(target: ApiValidationTarget): ApiValidationIssue[] {
  const issues: ApiValidationIssue[] = [];
  const { api, tools, urlPatterns } = target;

  // 1. Tool endpoint bindings resolve; 2. their placeholders resolve.
  for (const [i, tool] of tools.entries()) {
    const endpointName = tool.execution?.mode === "api" ? tool.execution.endpoint : undefined;
    if (endpointName === undefined) continue;
    const endpoint = api?.endpoints[endpointName];
    if (!endpoint) {
      issues.push({
        message: `Tool "${tool.name}" binds to endpoint "${endpointName}", which is not defined in api.endpoints.`,
        path: ["tools", i, "execution", "endpoint"],
      });
      continue;
    }
    const props = Object.keys(tool.inputSchema.properties);
    const base = ["api", "endpoints", endpointName];
    scanTemplateValue(endpoint.path, props, [...base, "path"], issues);
    if (endpoint.query) scanTemplateValue(endpoint.query, props, [...base, "query"], issues);
    if (endpoint.form) scanTemplateValue(endpoint.form, props, [...base, "form"], issues);
    if (endpoint.body !== undefined) {
      scanTemplateValue(endpoint.body, props, [...base, "body"], issues);
    }
    // graphql.document is opaque; only variables are template-scanned.
    if (endpoint.graphql?.variables) {
      scanTemplateValue(
        endpoint.graphql.variables,
        props,
        [...base, "graphql", "variables"],
        issues,
      );
    }
  }

  if (!api) return issues;

  const authNames = new Set(Object.keys(api.auth ?? {}));
  const endpointNames = new Set(Object.keys(api.endpoints));
  const documentNames = new Set(Object.keys(api.documents ?? {}));

  // 3. Endpoint auth refs exist in api.auth; 4. @documents refs exist.
  for (const [name, endpoint] of Object.entries(api.endpoints)) {
    (endpoint.auth ?? []).forEach((ref, ai) => {
      if (!authNames.has(ref)) {
        issues.push({
          message: `Endpoint "${name}" references auth source "${ref}", which is not defined in api.auth.`,
          path: ["api", "endpoints", name, "auth", ai],
        });
      }
    });
    const doc = endpoint.graphql?.document;
    const docMatch = doc === undefined ? null : DOCUMENT_REF_RE.exec(doc);
    if (docMatch && !documentNames.has(docMatch[1] ?? "")) {
      issues.push({
        message: `Endpoint "${name}" references document "${doc}", which is not defined in api.documents.`,
        path: ["api", "endpoints", name, "graphql", "document"],
      });
    }
  }

  // 5. Auth sources fetch from a defined endpoint (reference integrity).
  for (const [name, src] of Object.entries(api.auth ?? {})) {
    if (!endpointNames.has(src.source.endpoint)) {
      issues.push({
        message: `Auth source "${name}" fetches from endpoint "${src.source.endpoint}", which is not defined in api.endpoints.`,
        path: ["api", "auth", name, "source", "endpoint"],
      });
    }
  }

  // 6. Same-origin: baseUrl host must be covered by a urlPatterns host. Host
  // coverage only (not path/scheme) — the invariant is origin, per the design.
  let baseHost: string | null = null;
  try {
    baseHost = new URL(api.baseUrl).hostname.toLowerCase();
  } catch {
    baseHost = null; // invalid URL already flagged by the baseUrl field refine.
  }
  if (baseHost !== null) {
    const covered = urlPatterns.some((pattern) => {
      const parsed = parseUrlPattern(pattern);
      return parsed !== null && hostCoversHostname(parsed.host, baseHost);
    });
    if (!covered) {
      issues.push({
        message: `api.baseUrl host "${baseHost}" is not covered by any urlPatterns host (same-origin enforcement).`,
        path: ["api", "baseUrl"],
      });
    }
  }

  return issues;
}
