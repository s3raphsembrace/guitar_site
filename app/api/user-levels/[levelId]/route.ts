import { NextResponse } from "next/server";
import type { UserLevelDraftResponse } from "@/types/level-import";
import { requireUserSession } from "@/lib/level-import/auth";
import { getImportCollections } from "@/lib/level-import/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ levelId: string }> },
) {
  try {
    const { levelId } = await context.params;
    const { userId } = await requireUserSession();
    const { levelVersions, userLevels } = await getImportCollections();

    const level = await userLevels.findOne({ id: levelId, ownerUserId: userId });
    if (!level) {
      return NextResponse.json<UserLevelDraftResponse>(
        { ok: false, message: "Level not found." },
        { status: 404 },
      );
    }

    const versionId = level.currentDraftVersionId ?? level.publishedVersionId;
    if (!versionId) {
      return NextResponse.json<UserLevelDraftResponse>(
        { ok: false, message: "No chart version exists for this level." },
        { status: 404 },
      );
    }

    const version = await levelVersions.findOne({ _id: versionId, ownerUserId: userId });
    if (!version) {
      return NextResponse.json<UserLevelDraftResponse>(
        { ok: false, message: "Level version not found." },
        { status: 404 },
      );
    }

    return NextResponse.json<UserLevelDraftResponse>({
      ok: true,
      level: {
        id: level.id,
        title: level.title,
        status: level.status,
        sourceType: level.sourceType,
        chart: version.chart,
        versionNumber: version.versionNumber,
        canPublish: !!(version.chart.audioUrl || version.chart.fullMixAudioUrl || version.chart.analysisAudioUrl),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch level draft.";
    const status = message.includes("logged in") ? 401 : 500;
    return NextResponse.json<UserLevelDraftResponse>({ ok: false, message }, { status });
  }
}
