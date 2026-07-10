import { ObjectId } from "mongodb";
import { ensureLevelImportIndexes, getImportCollections } from "@/lib/level-import/db";
import { processImportJob } from "@/lib/level-import/workers/processImportJob";
import type { LevelImportJobDocument } from "@/types/level-import";

const WORKER_ID = `level-import-worker-${process.pid}`;
const POLL_INTERVAL_MS = 2000;
const STALE_LOCK_MS = 5 * 60 * 1000;

let queueStarted = false;
let intervalHandle: NodeJS.Timeout | null = null;
let processing = false;

async function claimNextJob(): Promise<LevelImportJobDocument | null> {
  const { importJobs } = await getImportCollections();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);

  const claimed = await importJobs.findOneAndUpdate(
    {
      $or: [
        { status: "queued" },
        {
          status: "processing",
          lockedAt: { $lt: staleBefore },
        },
      ],
    },
    {
      $set: {
        status: "processing",
        stage: "validating_assets",
        lockedBy: WORKER_ID,
        lockedAt: now,
        startedAt: now,
        updatedAt: now,
      },
      $inc: { attempts: 1 },
    },
    {
      sort: { createdAt: 1 },
      returnDocument: "after",
    },
  );

  return claimed ?? null;
}

async function tickQueue() {
  if (processing) {
    return;
  }
  processing = true;
  try {
    const job = await claimNextJob();
    if (!job || !(job._id instanceof ObjectId)) {
      return;
    }
    await processImportJob(job);
  } catch (error) {
    console.error("[level-import/queue] tick error", error);
  } finally {
    processing = false;
  }
}

export async function kickImportQueue() {
  await tickQueue();
}

export async function ensureImportQueueRunning() {
  if (queueStarted) {
    return;
  }

  await ensureLevelImportIndexes();
  queueStarted = true;
  intervalHandle = setInterval(() => {
    void tickQueue();
  }, POLL_INTERVAL_MS);
  void tickQueue();
}

export function stopImportQueue() {
  if (!intervalHandle) {
    return;
  }
  clearInterval(intervalHandle);
  intervalHandle = null;
  queueStarted = false;
}
