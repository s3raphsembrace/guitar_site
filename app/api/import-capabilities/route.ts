import { NextResponse } from "next/server";
import type { ImportCapabilitiesResponse } from "@/types/level-import";
import { getAudioImportCapability } from "@/lib/level-import/capabilities";

export const runtime = "nodejs";

export async function GET() {
  try {
    const audioImport = getAudioImportCapability();
    return NextResponse.json<ImportCapabilitiesResponse>({
      ok: true,
      capabilities: {
        audioImport,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to determine import capabilities.";
    return NextResponse.json<ImportCapabilitiesResponse>(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}
