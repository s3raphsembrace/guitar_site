import { NextResponse } from "next/server";
import { requireUserSession } from "@/lib/level-import/auth";
import { getImportCollections } from "@/lib/level-import/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { userId } = await requireUserSession();
    const { userLevels } = await getImportCollections();
    const levels = await userLevels.find({ ownerUserId: userId }).sort({ updatedAt: -1 }).limit(50).toArray();

    return NextResponse.json({
      ok: true,
      levels: levels.map((level) => ({
        id: level.id,
        title: level.title,
        status: level.status,
        sourceType: level.sourceType,
        updatedAt: level.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch levels.";
    const status = message.includes("logged in") ? 401 : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
