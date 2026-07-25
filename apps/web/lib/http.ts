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
 * The terms a submission was accepted under. API publishers never see the
 * `/submit` page, so every accepted submission points back at them: a `terms`
 * field for agents that read the body, a `Link` header for the ones that don't.
 * Derived from the request so previews and localhost link to themselves.
 */
export function acceptedSubmission(
  request: Request,
  body: Record<string, string | number>,
): NextResponse {
  const terms = new URL("/terms", request.url).toString();
  return NextResponse.json(
    { ...body, terms },
    { status: 201, headers: { Link: `<${terms}>; rel="terms-of-service"` } },
  );
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && err.message.includes("duplicate key value");
}
