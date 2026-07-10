import type { ObjectId } from "mongodb";

export const LEVEL_IMPORT_SOURCE_TYPES = ["midi", "isolated_audio", "full_mix_audio"] as const;
export type LevelImportSourceType = (typeof LEVEL_IMPORT_SOURCE_TYPES)[number];

export const LEVEL_IMPORT_JOB_STATUSES = [
  "queued",
  "processing",
  "awaiting_review",
  "completed",
  "failed",
  "cancelled",
] as const;
export type LevelImportJobStatus = (typeof LEVEL_IMPORT_JOB_STATUSES)[number];

export const LEVEL_IMPORT_STAGES = [
  "queued",
  "validating_assets",
  "preprocessing_audio",
  "stem_separation",
  "transcribing",
  "cleanup",
  "beat_tracking",
  "quantization",
  "chart_build",
  "draft_saved",
  "complete",
  "failed",
] as const;
export type LevelImportStage = (typeof LEVEL_IMPORT_STAGES)[number];

export const LEVEL_QUANTIZATION_VALUES = ["off", "1/8", "1/16"] as const;
export type LevelQuantization = (typeof LEVEL_QUANTIZATION_VALUES)[number];

export const INSTRUMENT_PRESETS = ["guitar", "bass"] as const;
export type InstrumentPreset = (typeof INSTRUMENT_PRESETS)[number];

export const TRANSCRIPTION_TUNINGS = ["conservative", "balanced", "sensitive"] as const;
export type TranscriptionTuning = (typeof TRANSCRIPTION_TUNINGS)[number];

export const STEM_TARGETS = ["guitar", "bass", "vocals", "drums", "other"] as const;
export type StemTarget = (typeof STEM_TARGETS)[number];
export type DetectedSourceKind = "midi" | "audio" | "unknown";

export interface ChartEvent {
  id?: string;
  timeMs: number;
  durationMs: number;
  notes: number[];
  tab?: { string: number; fret: number }[];
  velocity?: number;
  confidence?: number;
}

export interface LevelChart {
  id: string;
  title: string;
  audioUrl: string;
  fullMixAudioUrl?: string;
  analysisAudioUrl?: string;
  stemAudioUrl?: string;
  analysisStem?: StemTarget;
  analysisToPlaybackOffsetMs?: number;
  analysisFirstActivityMs?: number;
  offsetMs: number;
  bpmHint: number | null;
  events: ChartEvent[];
}

export interface AssetMetadata {
  durationSec?: number;
  sampleRateHz?: number;
  channels?: number;
  sourceStem?: StemTarget;
  [key: string]: unknown;
}

export const LEVEL_ASSET_KINDS = [
  "midi_source",
  "audio_source",
  "audio_stem",
  "audio_preview",
] as const;
export type LevelAssetKind = (typeof LEVEL_ASSET_KINDS)[number];

export interface AssetDocument {
  _id?: ObjectId;
  ownerUserId: string;
  kind: LevelAssetKind;
  storageProvider: "local" | "s3" | "r2";
  storagePath: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string;
  metadata?: AssetMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserLevelDocument {
  _id?: ObjectId;
  id: string;
  ownerUserId: string;
  title: string;
  sourceType: LevelImportSourceType;
  status: "draft" | "published" | "archived";
  currentDraftVersionId?: ObjectId;
  publishedVersionId?: ObjectId;
  latestImportJobId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface LevelVersionDocument {
  _id?: ObjectId;
  levelId: string;
  ownerUserId: string;
  versionNumber: number;
  status: "draft" | "published";
  chart: LevelChart;
  sourceJobId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface LevelImportJobParams {
  title: string;
  manualBpm?: number;
  quantization: LevelQuantization;
  instrumentPreset: InstrumentPreset;
  transcriptionTuning: TranscriptionTuning;
  selectedStem: StemTarget;
  sourceType: LevelImportSourceType;
  audioAssetId?: string;
  sourceAssetId: string;
}

export interface LevelImportJobResult {
  levelId?: string;
  levelVersionId?: string;
  chart?: LevelChart;
  warnings: string[];
}

export interface LevelImportJobError {
  code: string;
  message: string;
  details?: string;
}

export interface LevelImportJobDocument {
  _id?: ObjectId;
  ownerUserId: string;
  levelId?: string;
  sourceType: LevelImportSourceType;
  sourceAssetId: ObjectId;
  audioAssetId?: ObjectId;
  status: LevelImportJobStatus;
  stage: LevelImportStage;
  progressPercent: number;
  params: LevelImportJobParams;
  result?: LevelImportJobResult;
  error?: LevelImportJobError;
  attempts: number;
  maxAttempts: number;
  lockedBy?: string;
  lockedAt?: Date;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt: Date;
}

export interface CreateAssetResponse {
  ok: boolean;
  asset?: {
    id: string;
    kind: LevelAssetKind;
    detectedSourceKind: DetectedSourceKind;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    publicUrl: string;
  };
  message?: string;
}

export interface CreateImportJobRequest {
  sourceType?: LevelImportSourceType;
  sourceAssetId: string;
  audioAssetId?: string;
  title: string;
  manualBpm?: number;
  quantization?: LevelQuantization;
  instrumentPreset?: InstrumentPreset;
  transcriptionTuning?: TranscriptionTuning;
  selectedStem?: StemTarget;
}

export interface CreateImportJobResponse {
  ok: boolean;
  jobId?: string;
  message?: string;
}

export interface ImportJobStatusResponse {
  ok: boolean;
  job?: {
    id: string;
    status: LevelImportJobStatus;
    stage: LevelImportStage;
    progressPercent: number;
    sourceType: LevelImportSourceType;
    levelId?: string;
    result?: LevelImportJobResult;
    error?: LevelImportJobError;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
  };
  message?: string;
}

export interface UserLevelDraftResponse {
  ok: boolean;
  level?: {
    id: string;
    title: string;
    status: "draft" | "published" | "archived";
    sourceType: LevelImportSourceType;
    chart: LevelChart;
    versionNumber: number;
    canPublish: boolean;
  };
  message?: string;
}

export interface SaveDraftRequest {
  title: string;
  chart: LevelChart;
}

export interface SaveDraftResponse {
  ok: boolean;
  versionId?: string;
  message?: string;
}

export interface PublishLevelResponse {
  ok: boolean;
  levelId?: string;
  versionId?: string;
  message?: string;
}

export interface ImportCapabilitiesResponse {
  ok: boolean;
  capabilities?: {
    audioImport: {
      available: boolean;
      environment: "development" | "production";
      message: string;
      missingCommands: string[];
    };
  };
  message?: string;
}
