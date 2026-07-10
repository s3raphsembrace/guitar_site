import { ObjectId } from "mongodb";
import {
  LEVEL_IMPORT_JOB_STATUSES,
  LEVEL_IMPORT_STAGES,
  TRANSCRIPTION_TUNINGS,
  type CreateImportJobRequest,
  type LevelImportJobDocument,
  type LevelImportJobResult,
} from "@/types/level-import";
import { ensureLevelImportIndexes, getImportCollections, toObjectId } from "@/lib/level-import/db";
import { detectSourceKindFromAsset, resolveImportSourceType } from "@/lib/level-import/fileType";
import { AudioImportUnavailableError, getAudioImportCapability } from "@/lib/level-import/capabilities";

export interface SerializedImportJob {
  id: string;
  status: LevelImportJobDocument["status"];
  stage: LevelImportJobDocument["stage"];
  progressPercent: number;
  sourceType: LevelImportJobDocument["sourceType"];
  levelId?: string;
  result?: LevelImportJobResult;
  error?: LevelImportJobDocument["error"];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

function assertEnumValue<T extends readonly string[]>(values: T, value: string, fieldName: string): value is T[number] {
  if (!values.includes(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return true;
}

export async function createImportJob(ownerUserId: string, request: CreateImportJobRequest) {
  await ensureLevelImportIndexes();
  const { assets, importJobs } = await getImportCollections();

  assertEnumValue(LEVEL_IMPORT_JOB_STATUSES, "queued", "status");
  assertEnumValue(LEVEL_IMPORT_STAGES, "queued", "stage");

  const sourceAssetId = toObjectId(request.sourceAssetId, "sourceAssetId");
  const audioAssetId = request.audioAssetId ? toObjectId(request.audioAssetId, "audioAssetId") : undefined;
  const transcriptionTuning = request.transcriptionTuning ?? "balanced";
  assertEnumValue(TRANSCRIPTION_TUNINGS, transcriptionTuning, "transcriptionTuning");

  const sourceAsset = await assets.findOne({ _id: sourceAssetId, ownerUserId });
  if (!sourceAsset) {
    throw new Error("Source asset not found.");
  }
  if (sourceAsset.kind !== "midi_source" && sourceAsset.kind !== "audio_source") {
    throw new Error("Source asset must be uploaded as a level source file.");
  }

  const detectedSourceKind = detectSourceKindFromAsset(sourceAsset);
  if (detectedSourceKind === "unknown") {
    throw new Error("Unable to detect source file type. Please upload a MIDI or audio file.");
  }

  const resolvedSourceType = resolveImportSourceType({
    detectedSourceKind,
    preferredSourceType: request.sourceType,
  });

  if (detectedSourceKind === "audio") {
    const capability = getAudioImportCapability();
    if (!capability.available) {
      throw new AudioImportUnavailableError(capability);
    }
  }

  if (audioAssetId) {
    const audioAsset = await assets.findOne({ _id: audioAssetId, ownerUserId });
    if (!audioAsset) {
      throw new Error("Audio asset not found.");
    }
    if (audioAsset.kind !== "audio_preview" && audioAsset.kind !== "audio_source") {
      throw new Error("Invalid audio preview asset.");
    }
    if (detectSourceKindFromAsset(audioAsset) !== "audio") {
      throw new Error("Audio preview must be a supported audio file (mp3/wav/ogg/etc), not MIDI.");
    }
  }

  const now = new Date();
  const doc: LevelImportJobDocument = {
    ownerUserId,
    sourceType: resolvedSourceType,
    sourceAssetId,
    audioAssetId,
    status: "queued",
    stage: "queued",
    progressPercent: 0,
    params: {
      title: request.title.trim(),
      manualBpm: request.manualBpm,
      quantization: request.quantization ?? "off",
      instrumentPreset: request.instrumentPreset ?? "guitar",
      transcriptionTuning,
      selectedStem: request.selectedStem ?? "guitar",
      sourceType: resolvedSourceType,
      sourceAssetId: request.sourceAssetId,
      audioAssetId: request.audioAssetId,
    },
    attempts: 0,
    maxAttempts: 1,
    createdAt: now,
    updatedAt: now,
  };

  const result = await importJobs.insertOne(doc);
  return result.insertedId.toString();
}

export function serializeImportJob(job: LevelImportJobDocument): SerializedImportJob {
  return {
    id: (job._id as ObjectId).toString(),
    status: job.status,
    stage: job.stage,
    progressPercent: job.progressPercent,
    sourceType: job.sourceType,
    levelId: job.levelId,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt?.toISOString(),
  };
}

export async function getImportJobForUser(ownerUserId: string, jobId: string) {
  const { importJobs } = await getImportCollections();
  return importJobs.findOne({
    _id: toObjectId(jobId, "jobId"),
    ownerUserId,
  });
}

export async function updateImportJobProgress(
  jobId: ObjectId,
  input: {
    stage: LevelImportJobDocument["stage"];
    progressPercent: number;
    status?: LevelImportJobDocument["status"];
  },
) {
  const { importJobs } = await getImportCollections();
  const update: Partial<LevelImportJobDocument> = {
    stage: input.stage,
    progressPercent: input.progressPercent,
    updatedAt: new Date(),
  };
  if (input.status) {
    update.status = input.status;
  }
  await importJobs.updateOne({ _id: jobId }, { $set: update });
}

export async function markImportJobFailed(jobId: ObjectId, message: string, details?: string) {
  const { importJobs } = await getImportCollections();
  await importJobs.updateOne(
    { _id: jobId },
    {
      $set: {
        status: "failed",
        stage: "failed",
        progressPercent: 100,
        error: {
          code: "IMPORT_FAILED",
          message,
          details,
        },
        completedAt: new Date(),
        updatedAt: new Date(),
      },
      $unset: {
        lockedAt: "",
        lockedBy: "",
      },
    },
  );
}

export async function markImportJobComplete(
  jobId: ObjectId,
  input: {
    levelId: string;
    levelVersionId: string;
    result: LevelImportJobResult;
    status?: LevelImportJobDocument["status"];
  },
) {
  const { importJobs } = await getImportCollections();
  await importJobs.updateOne(
    { _id: jobId },
    {
      $set: {
        status: input.status ?? "awaiting_review",
        stage: "complete",
        progressPercent: 100,
        levelId: input.levelId,
        result: {
          ...input.result,
          levelId: input.levelId,
          levelVersionId: input.levelVersionId,
        },
        completedAt: new Date(),
        updatedAt: new Date(),
      },
      $unset: {
        lockedAt: "",
        lockedBy: "",
      },
    },
  );
}
