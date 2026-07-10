import { NextResponse } from "next/server";
import type { PublishLevelResponse } from "@/types/level-import";
import { requireUserSession } from "@/lib/level-import/auth";
import { getImportCollections } from "@/lib/level-import/db";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ levelId: string }> },
) {
  try {
    const { levelId } = await context.params;
    const { userId } = await requireUserSession();
    const { levelVersions, userLevels } = await getImportCollections();

    const level = await userLevels.findOne({ id: levelId, ownerUserId: userId });
    if (!level) {
      return NextResponse.json<PublishLevelResponse>(
        { ok: false, message: "Level not found." },
        { status: 404 },
      );
    }

    const draftVersionId = level.currentDraftVersionId;
    if (!draftVersionId) {
      return NextResponse.json<PublishLevelResponse>(
        { ok: false, message: "No draft exists to publish." },
        { status: 400 },
      );
    }

    const draftVersion = await levelVersions.findOne({ _id: draftVersionId, ownerUserId: userId });
    if (!draftVersion) {
      return NextResponse.json<PublishLevelResponse>(
        { ok: false, message: "Draft version not found." },
        { status: 404 },
      );
    }

    if (!draftVersion.chart.audioUrl && !draftVersion.chart.fullMixAudioUrl && !draftVersion.chart.analysisAudioUrl) {
      return NextResponse.json<PublishLevelResponse>(
        { ok: false, message: "Publish requires an audio track URL." },
        { status: 400 },
      );
    }

    const now = new Date();
    await levelVersions.updateMany(
      { levelId, ownerUserId: userId, status: "published" },
      { $set: { status: "draft", updatedAt: now } },
    );
    await levelVersions.updateOne(
      { _id: draftVersionId },
      { $set: { status: "published", updatedAt: now } },
    );
    await userLevels.updateOne(
      { _id: level._id },
      {
        $set: {
          status: "published",
          publishedVersionId: draftVersionId,
          publishedAt: now,
          updatedAt: now,
        },
      },
    );

    return NextResponse.json<PublishLevelResponse>({
      ok: true,
      levelId,
      versionId: draftVersionId.toString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to publish level.";
    const status = message.includes("logged in") ? 401 : 500;
    return NextResponse.json<PublishLevelResponse>({ ok: false, message }, { status });
  }
}
