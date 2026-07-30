import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Parse a JSON body against a zod schema; returns a response on failure. */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: jsonError(400, "Invalid JSON body") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * The terms a submission was accepted under, plus a `Location` header pointing
 * at the created resource. API publishers never see the `/submit` page, so
 * every accepted submission points back at the terms: a `terms` field for
 * agents that read the body, a `Link` header for the ones that don't. Both are
 * derived from the request so previews and localhost link to themselves.
 */
export function acceptedSubmission(
  request: Request,
  body: Record<string, string | number>,
  location: string,
): NextResponse {
  const terms = new URL("/terms", request.url).toString();
  return NextResponse.json(
    { ...body, terms },
    {
      status: 201,
      headers: {
        Link: `<${terms}>; rel="terms-of-service"`,
        Location: new URL(location, request.url).toString(),
      },
    },
  );
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && err.message.includes("duplicate key value");
}

/**
 * The declared `version` didn't match what publish requires (1 on create,
 * `max(version)+1` on a new version) — either the author based their change
 * on a stale snapshot or two publishes raced. Thrown by the mutation layer,
 * mapped to a 409 by the route handlers; `expectedVersion` tells the caller
 * what to declare on retry.
 */
export class VersionConflictError extends Error {
  constructor(public readonly expectedVersion: number) {
    super(`Declared version does not match; expected version ${expectedVersion}`);
    this.name = "VersionConflictError";
  }
}

/** 409 body for a VersionConflictError — carries the expected number so the caller can retry. */
export function versionConflict(err: VersionConflictError): NextResponse {
  return NextResponse.json(
    { error: err.message, expectedVersion: err.expectedVersion },
    { status: 409 },
  );
}
