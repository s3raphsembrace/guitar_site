import { ObjectId } from "mongodb";
import type { AssetDocument, LevelChart, LevelImportJobDocument } from "@/types/level-import";
import { getImportCollections } from "@/lib/level-import/db";
import {
  markImportJobComplete,
  markImportJobFailed,
  updateImportJobProgress,
} from "@/lib/level-import/jobs";
import { buildLevelId, sortEvents } from "@/lib/level-import/utils";
import { getAssetStorage } from "@/lib/storage/assetStorage";
import { runMidiImportWorker } from "@/lib/level-import/workers/midiImportWorker";
import { runAudioPreprocessWorker } from "@/lib/level-import/workers/audioPreprocessWorker";
import { getTranscriber } from "@/lib/level-import/transcriber/basicPitch";
import { runCleanupPipeline } from "@/lib/level-import/processing/cleanup";
import { runBeatTracking } from "@/lib/level-import/processing/beatTracking";
import { runQuantization } from "@/lib/level-import/processing/quantization";
import { getStemSeparator } from "@/lib/level-import/stems/demucs";

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected processing error";
}

function mapStageWarnings(stage: string, warnings: string[]) {
  return warnings.map((warning) => `[${stage}] ${warning}`);
}

function mapEventIds(chart: LevelChart): LevelChart {
  return {
    ...chart,
    events: sortEvents(chart.events).map((event, index) => ({
      ...event,
      id: `${index + 1}`,
    })),
  };
}

async function loadAsset(ownerUserId: string, id: ObjectId): Promise<AssetDocument> {
  const { assets } = await getImportCollections();
  const asset = await assets.findOne({ _id: id, ownerUserId });
  if (!asset) {
    throw new Error("One of the uploaded assets is missing.");
  }
  return asset;
}

async function saveDraftVersion(input: {
  ownerUserId: string;
  levelId: string;
  title: string;
  sourceType: LevelImportJobDocument["sourceType"];
  chart: LevelChart;
  sourceJobId: ObjectId;
}) {
  const { levelVersions, userLevels } = await getImportCollections();
  const now = new Date();

  const existing = await userLevels.findOne({
    id: input.levelId,
    ownerUserId: input.ownerUserId,
  });
  if (!existing) {
    await userLevels.insertOne({
      id: input.levelId,
      ownerUserId: input.ownerUserId,
      title: input.title,
      sourceType: input.sourceType,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      latestImportJobId: input.sourceJobId,
    });
  } else {
    await userLevels.updateOne(
      { _id: existing._id },
      {
        $set: {
          title: input.title,
          sourceType: input.sourceType,
          updatedAt: now,
          latestImportJobId: input.sourceJobId,
        },
      },
    );
  }

  const latestVersion = await levelVersions.find({ levelId: input.levelId }).sort({ versionNumber: -1 }).limit(1).next();
  const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;

  const levelVersionResult = await levelVersions.insertOne({
    levelId: input.levelId,
    ownerUserId: input.ownerUserId,
    versionNumber,
    status: "draft",
    chart: mapEventIds({
      ...input.chart,
      id: input.levelId,
      title: input.title,
    }),
    sourceJobId: input.sourceJobId,
    createdAt: now,
    updatedAt: now,
  });

  await userLevels.updateOne(
    { id: input.levelId, ownerUserId: input.ownerUserId },
    {
      $set: {
        currentDraftVersionId: levelVersionResult.insertedId,
        updatedAt: now,
      },
    },
  );

  return {
    levelVersionId: levelVersionResult.insertedId.toString(),
    versionNumber,
  };
}

async function processMidiJob(job: LevelImportJobDocument, sourceAsset: AssetDocument, audioAsset?: AssetDocument) {
  const storage = getAssetStorage();
  const levelId = job.levelId || buildLevelId(job.params.title);
  const midiAbsolutePath = storage.resolveAbsolutePath(sourceAsset.storagePath);

  await updateImportJobProgress(job._id as ObjectId, {
    status: "processing",
    stage: "chart_build",
    progressPercent: 45,
  });

  const imported = await runMidiImportWorker({
    levelId,
    title: job.params.title,
    midiAbsolutePath,
    audioUrl: audioAsset?.publicUrl ?? "",
    manualBpm: job.params.manualBpm,
  });

  const beatTracking = runBeatTracking({
    events: imported.chart.events,
    manualBpm: job.params.manualBpm,
  });
  const quantized = runQuantization({
    events: imported.chart.events,
    quantization: job.params.quantization,
    bpm: beatTracking.bpm,
  });

  return {
    levelId,
    chart: {
      ...imported.chart,
      bpmHint: beatTracking.bpm ?? imported.chart.bpmHint,
      events: quantized.events,
    },
    warnings: [
      ...mapStageWarnings("MIDI import", imported.warnings),
      ...mapStageWarnings("Beat tracking", beatTracking.warnings),
      ...mapStageWarnings("Quantization", quantized.warnings),
    ],
  };
}

async function processAudioJob(job: LevelImportJobDocument, sourceAsset: AssetDocument) {
  const storage = getAssetStorage();
  const warnings: string[] = [];
  const levelId = job.levelId || buildLevelId(job.params.title);
  const sourceAbsolutePath = storage.resolveAbsolutePath(sourceAsset.storagePath);

  const fullMixAudioUrl = sourceAsset.publicUrl;
  let analysisAudioPath = sourceAbsolutePath;
  let analysisAudioUrl = sourceAsset.publicUrl;
  let stemAudioUrl: string | undefined;
  let analysisStem: LevelChart["analysisStem"] | undefined =
    job.sourceType === "full_mix_audio" ? job.params.selectedStem : undefined;

  if (job.sourceType === "full_mix_audio") {
    await updateImportJobProgress(job._id as ObjectId, {
      stage: "stem_separation",
      progressPercent: 20,
      status: "processing",
    });
    const separator = getStemSeparator();
    const separated = await separator.separate({
      sourceAudioAbsolutePath: sourceAbsolutePath,
      selectedStem: job.params.selectedStem,
    });
    analysisAudioPath = separated.stemAbsolutePath;
    analysisAudioUrl = separated.stemPublicUrl;
    if (separated.stemPublicUrl !== sourceAsset.publicUrl) {
      stemAudioUrl = separated.stemPublicUrl;
      analysisStem = job.params.selectedStem;
    }
    warnings.push(...mapStageWarnings("Stem separation", separated.warnings));
  }

  await updateImportJobProgress(job._id as ObjectId, {
    stage: "preprocessing_audio",
    progressPercent: 35,
    status: "processing",
  });
  const preprocessed = await runAudioPreprocessWorker({
    inputAbsolutePath: analysisAudioPath,
  });
  warnings.push(...mapStageWarnings("Audio preprocessing", preprocessed.warnings));

  await updateImportJobProgress(job._id as ObjectId, {
    stage: "transcribing",
    progressPercent: 50,
    status: "processing",
  });
  const transcriber = getTranscriber();
  const transcription = await transcriber.transcribe({
    wavAbsolutePath: preprocessed.wavAbsolutePath,
    preset: job.params.instrumentPreset,
    tuning: job.params.transcriptionTuning ?? "balanced",
  });
  warnings.push(...mapStageWarnings("Transcription", transcription.warnings));

  await updateImportJobProgress(job._id as ObjectId, {
    stage: "cleanup",
    progressPercent: 65,
    status: "processing",
  });
  const cleaned = runCleanupPipeline({
    events: transcription.events,
    preset: job.params.instrumentPreset,
    simplifyMonophonic: true,
  });
  warnings.push(...mapStageWarnings("Cleanup", cleaned.warnings));

  await updateImportJobProgress(job._id as ObjectId, {
    stage: "beat_tracking",
    progressPercent: 75,
    status: "processing",
  });
  const beatTracking = runBeatTracking({
    events: cleaned.events,
    manualBpm: job.params.manualBpm,
  });
  warnings.push(...mapStageWarnings("Beat tracking", beatTracking.warnings));

  await updateImportJobProgress(job._id as ObjectId, {
    stage: "quantization",
    progressPercent: 85,
    status: "processing",
  });
  const quantized = runQuantization({
    events: cleaned.events,
    quantization: job.params.quantization,
    bpm: beatTracking.bpm,
  });
  warnings.push(...mapStageWarnings("Quantization", quantized.warnings));

  const chart: LevelChart = {
    id: levelId,
    title: job.params.title,
    audioUrl: fullMixAudioUrl,
    fullMixAudioUrl,
    analysisAudioUrl,
    stemAudioUrl,
    analysisStem,
    analysisToPlaybackOffsetMs: 0,
    analysisFirstActivityMs: transcription.analysisFirstActivityMs,
    offsetMs: 0,
    bpmHint: beatTracking.bpm,
    events: quantized.events,
  };

  return {
    levelId,
    chart,
    warnings,
  };
}

export async function processImportJob(job: LevelImportJobDocument) {
  const jobId = job._id as ObjectId;

  try {
    await updateImportJobProgress(jobId, {
      status: "processing",
      stage: "validating_assets",
      progressPercent: 10,
    });

    const sourceAsset = await loadAsset(job.ownerUserId, job.sourceAssetId);
    const audioAsset = job.audioAssetId ? await loadAsset(job.ownerUserId, job.audioAssetId) : undefined;

    const result =
      job.sourceType === "midi"
        ? await processMidiJob(job, sourceAsset, audioAsset)
        : await processAudioJob(job, sourceAsset);

    await updateImportJobProgress(jobId, {
      status: "processing",
      stage: "draft_saved",
      progressPercent: 95,
    });

    const draft = await saveDraftVersion({
      ownerUserId: job.ownerUserId,
      levelId: result.levelId,
      title: job.params.title,
      sourceType: job.sourceType,
      chart: result.chart,
      sourceJobId: jobId,
    });

    await markImportJobComplete(jobId, {
      levelId: result.levelId,
      levelVersionId: draft.levelVersionId,
      result: {
        levelId: result.levelId,
        levelVersionId: draft.levelVersionId,
        chart: result.chart,
        warnings: result.warnings,
      },
      status: "awaiting_review",
    });
  } catch (error) {
    const message = toErrorMessage(error);
    await markImportJobFailed(jobId, "Import failed while processing your level.", message);
  }
}
