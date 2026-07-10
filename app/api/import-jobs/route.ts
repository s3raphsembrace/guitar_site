import { NextResponse } from "next/server";
import {
  LEVEL_IMPORT_SOURCE_TYPES,
  TRANSCRIPTION_TUNINGS,
  type CreateImportJobRequest,
  type CreateImportJobResponse,
} from "@/types/level-import";
import { requireUserSession } from "@/lib/level-import/auth";
import { createImportJob, serializeImportJob } from "@/lib/level-import/jobs";
import { ensureImportQueueRunning, kickImportQueue } from "@/lib/level-import/queue";
import { getImportCollections } from "@/lib/level-import/db";
import { AudioImportUnavailableError } from "@/lib/level-import/capabilities";

export const runtime = "nodejs";

function isSourceType(value: string): value is (typeof LEVEL_IMPORT_SOURCE_TYPES)[number] {
  return LEVEL_IMPORT_SOURCE_TYPES.includes(value as (typeof LEVEL_IMPORT_SOURCE_TYPES)[number]);
}

function isTranscriptionTuning(value: string): value is (typeof TRANSCRIPTION_TUNINGS)[number] {
  return TRANSCRIPTION_TUNINGS.includes(value as (typeof TRANSCRIPTION_TUNINGS)[number]);
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireUserSession();
    const body = (await request.json()) as CreateImportJobRequest;

    if (body.sourceType && !isSourceType(body.sourceType)) {
      return NextResponse.json<CreateImportJobResponse>(
        { ok: false, message: "Invalid source type." },
        { status: 400 },
      );
    }
    if (body.transcriptionTuning && !isTranscriptionTuning(body.transcriptionTuning)) {
      return NextResponse.json<CreateImportJobResponse>(
        { ok: false, message: "Invalid transcription tuning option." },
        { status: 400 },
      );
    }

    if (!body.title || body.title.trim().length < 2) {
      return NextResponse.json<CreateImportJobResponse>(
        { ok: false, message: "Please provide a title for your level." },
        { status: 400 },
      );
    }

    if (!body.sourceAssetId) {
      return NextResponse.json<CreateImportJobResponse>(
        { ok: false, message: "Missing source asset." },
        { status: 400 },
      );
    }

    const jobId = await createImportJob(userId, body);
    await ensureImportQueueRunning();
    void kickImportQueue();

    return NextResponse.json<CreateImportJobResponse>({
      ok: true,
      jobId,
    });
  } catch (error) {
    if (error instanceof AudioImportUnavailableError) {
      return NextResponse.json<CreateImportJobResponse>(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "Failed to start import.";
    const status = message.includes("logged in") ? 401 : 500;
    return NextResponse.json<CreateImportJobResponse>({ ok: false, message }, { status });
  }
}

export async function GET() {
  try {
    const { userId } = await requireUserSession();
    const { importJobs } = await getImportCollections();
    const jobs = await importJobs.find({ ownerUserId: userId }).sort({ createdAt: -1 }).limit(20).toArray();

    return NextResponse.json({
      ok: true,
      jobs: jobs.map(serializeImportJob),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch import jobs.";
    const status = message.includes("logged in") ? 401 : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
