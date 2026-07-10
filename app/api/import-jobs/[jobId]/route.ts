import { NextResponse } from "next/server";
import type { ImportJobStatusResponse } from "@/types/level-import";
import { requireUserSession } from "@/lib/level-import/auth";
import { getImportJobForUser, serializeImportJob } from "@/lib/level-import/jobs";
import { ensureImportQueueRunning, kickImportQueue } from "@/lib/level-import/queue";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await context.params;
    const { userId } = await requireUserSession();
    await ensureImportQueueRunning();
    void kickImportQueue();

    const job = await getImportJobForUser(userId, jobId);
    if (!job) {
      return NextResponse.json<ImportJobStatusResponse>(
        { ok: false, message: "Import job not found." },
        { status: 404 },
      );
    }

    return NextResponse.json<ImportJobStatusResponse>({
      ok: true,
      job: serializeImportJob(job),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch job status.";
    const status = message.includes("logged in") ? 401 : 500;
    return NextResponse.json<ImportJobStatusResponse>(
      { ok: false, message },
      { status },
    );
  }
}
