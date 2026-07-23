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

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && err.message.includes("duplicate key value");
}
