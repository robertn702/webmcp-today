import { NextResponse } from "next/server";
import { getLatestExtensionRelease } from "@/lib/extension-release";

export const revalidate = 3600;

/** Public, inert metadata for the one official extension's self-hosted stable release. */
export async function GET(): Promise<NextResponse> {
  try {
    const release = await getLatestExtensionRelease();
    if (release === undefined) {
      return NextResponse.json(
        { error: "No valid extension release is available." },
        { status: 404 },
      );
    }
    return NextResponse.json(release, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return NextResponse.json(
      { error: "Extension release metadata is unavailable." },
      { status: 503 },
    );
  }
}
