import { NextResponse } from "next/server";
import type { SaveDraftRequest, SaveDraftResponse } from "@/types/level-import";
import { STEM_TARGETS } from "@/types/level-import";
import { requireUserSession } from "@/lib/level-import/auth";
import { getImportCollections } from "@/lib/level-import/db";
import { sortEvents } from "@/lib/level-import/utils";

export const runtime = "nodejs";

function isValidChartInput(payload: SaveDraftRequest["chart"]) {
  return (
    payload &&
    typeof payload.id === "string" &&
    typeof payload.title === "string" &&
    typeof payload.audioUrl === "string" &&
    (payload.fullMixAudioUrl === undefined || typeof payload.fullMixAudioUrl === "string") &&
    (payload.analysisAudioUrl === undefined || typeof payload.analysisAudioUrl === "string") &&
    (payload.stemAudioUrl === undefined || typeof payload.stemAudioUrl === "string") &&
    (payload.analysisStem === undefined || STEM_TARGETS.includes(payload.analysisStem)) &&
    (payload.analysisToPlaybackOffsetMs === undefined || typeof payload.analysisToPlaybackOffsetMs === "number") &&
    (payload.analysisFirstActivityMs === undefined || typeof payload.analysisFirstActivityMs === "number") &&
    typeof payload.offsetMs === "number" &&
    (typeof payload.bpmHint === "number" || payload.bpmHint === null) &&
    Array.isArray(payload.events)
  );
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ levelId: string }> },
) {
  try {
    const { levelId } = await context.params;
    const { userId } = await requireUserSession();
    const body = (await request.json()) as SaveDraftRequest;

    if (!body?.title?.trim()) {
      return NextResponse.json<SaveDraftResponse>(
        { ok: false, message: "Level title is required." },
        { status: 400 },
      );
    }
    if (!isValidChartInput(body.chart)) {
      return NextResponse.json<SaveDraftResponse>(
        { ok: false, message: "Invalid chart payload." },
        { status: 400 },
      );
    }

    const { levelVersions, userLevels } = await getImportCollections();
    const level = await userLevels.findOne({ id: levelId, ownerUserId: userId });
    if (!level) {
      return NextResponse.json<SaveDraftResponse>(
        { ok: false, message: "Level not found." },
        { status: 404 },
      );
    }

    const latestVersion = await levelVersions.find({ levelId, ownerUserId: userId }).sort({ versionNumber: -1 }).limit(1).next();
    const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;
    const now = new Date();

    const chart = {
      ...body.chart,
      id: levelId,
      title: body.title.trim(),
      events: sortEvents(body.chart.events).map((event, index) => ({
        id: `${index + 1}`,
        timeMs: Math.max(0, Math.round(event.timeMs)),
        durationMs: Math.max(1, Math.round(event.durationMs)),
        notes: [...new Set(event.notes.map((note) => Math.round(note)).filter((note) => note >= 0 && note <= 127))],
        tab: Array.isArray(event.tab)
          ? event.tab
              .map((position) => ({
                string: Math.round(Number(position?.string)),
                fret: Math.round(Number(position?.fret)),
              }))
              .filter(
                (position) =>
                  Number.isFinite(position.string) &&
                  Number.isFinite(position.fret) &&
                  position.string >= 1 &&
                  position.fret >= 0,
              )
          : undefined,
        velocity: event.velocity,
        confidence: event.confidence,
      })),
    };

    const insert = await levelVersions.insertOne({
      levelId,
      ownerUserId: userId,
      versionNumber,
      status: "draft",
      chart,
      createdAt: now,
      updatedAt: now,
    });

    await userLevels.updateOne(
      { _id: level._id },
      {
        $set: {
          title: body.title.trim(),
          currentDraftVersionId: insert.insertedId,
          status: "draft",
          updatedAt: now,
        },
      },
    );

    return NextResponse.json<SaveDraftResponse>({
      ok: true,
      versionId: insert.insertedId.toString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save draft.";
    const status = message.includes("logged in") ? 401 : 500;
    return NextResponse.json<SaveDraftResponse>({ ok: false, message }, { status });
  }
}
