"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import type {
  CreateAssetResponse,
  ImportCapabilitiesResponse,
  CreateImportJobResponse,
  ImportJobStatusResponse,
  InstrumentPreset,
  LevelImportSourceType,
  LevelQuantization,
  StemTarget,
  TranscriptionTuning,
} from "@/types/level-import";

type UploadedAsset = NonNullable<CreateAssetResponse["asset"]>;
type JobStatus = NonNullable<ImportJobStatusResponse["job"]>;
type LocalSourceKind = "midi" | "audio" | "unknown";

const SOURCE_OPTIONS: Array<{ value: LevelImportSourceType; label: string; hint: string }> = [
  {
    value: "midi",
    label: "MIDI",
    hint: "Phase 1: full end-to-end support",
  },
  {
    value: "isolated_audio",
    label: "Isolated Audio",
    hint: "Basic Pitch transcription pipeline",
  },
  {
    value: "full_mix_audio",
    label: "Full Mix Audio",
    hint: "Demucs stem separation + Basic Pitch",
  },
];

const QUANTIZATION_OPTIONS: LevelQuantization[] = ["off", "1/8", "1/16"];
const INSTRUMENT_PRESETS: InstrumentPreset[] = ["guitar", "bass"];
const STEM_OPTIONS: StemTarget[] = ["guitar", "bass", "vocals", "drums", "other"];
const TRANSCRIPTION_TUNING_OPTIONS: Array<{
  value: TranscriptionTuning;
  label: string;
  hint: string;
}> = [
  { value: "balanced", label: "Balanced", hint: "Recommended default: moderate filtering and intro gate." },
  { value: "conservative", label: "Conservative", hint: "Stricter filtering for cleaner but sparser note output." },
  { value: "sensitive", label: "Sensitive", hint: "Captures more subtle notes; may include extra noise." },
];
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".webm"];

function isMidiFile(file: File) {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  return name.endsWith(".mid") || name.endsWith(".midi") || mime.includes("midi");
}

function isAudioFile(file: File) {
  if (isMidiFile(file)) {
    return false;
  }
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  return mime.startsWith("audio/") || AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function detectLocalSourceKind(file: File | null): LocalSourceKind {
  if (!file) {
    return "unknown";
  }
  if (isMidiFile(file)) {
    return "midi";
  }
  if (isAudioFile(file)) {
    return "audio";
  }
  return "unknown";
}

async function uploadAsset(file: File, kind?: string): Promise<UploadedAsset> {
  const form = new FormData();
  form.set("file", file);
  if (kind) {
    form.set("kind", kind);
  }

  const response = await fetch("/api/creator/assets", {
    method: "POST",
    body: form,
  });
  const body = (await response.json()) as CreateAssetResponse;
  if (!response.ok || !body.ok || !body.asset) {
    throw new Error(body.message ?? "Asset upload failed.");
  }
  return body.asset;
}

export default function CreateLevelPage() {
  const [sourceType, setSourceType] = useState<LevelImportSourceType>("midi");
  const [title, setTitle] = useState("");
  const [manualBpm, setManualBpm] = useState<string>("");
  const [quantization, setQuantization] = useState<LevelQuantization>("off");
  const [instrumentPreset, setInstrumentPreset] = useState<InstrumentPreset>("guitar");
  const [transcriptionTuning, setTranscriptionTuning] = useState<TranscriptionTuning>("balanced");
  const [selectedStem, setSelectedStem] = useState<StemTarget>("guitar");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [sourceAsset, setSourceAsset] = useState<UploadedAsset | null>(null);
  const [audioAsset, setAudioAsset] = useState<UploadedAsset | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [uploading, setUploading] = useState(false);
  const [startingJob, setStartingJob] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [levels, setLevels] = useState<Array<{ id: string; title: string; status: string; sourceType: string }>>([]);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [inputResetKey, setInputResetKey] = useState(0);
  const [audioImportCapability, setAudioImportCapability] = useState<{
    available: boolean;
    environment: "development" | "production";
    message: string;
    missingCommands: string[];
  } | null>(null);

  const sourceAccept = ".mid,.midi,audio/*";
  const selectedSourceKind = useMemo(() => detectLocalSourceKind(sourceFile), [sourceFile]);

  const requiresOptionalAudioUpload = sourceType === "midi";
  const audioImportBlockedByCapability =
    selectedSourceKind === "audio" && audioImportCapability !== null && !audioImportCapability.available;
  const showAudioCapabilityWarning =
    audioImportCapability !== null &&
    !audioImportCapability.available &&
    (selectedSourceKind === "audio" || sourceType !== "midi");
  const canStartImport =
    Boolean(title.trim()) &&
    Boolean(sourceAsset || sourceFile) &&
    !startingJob &&
    !uploading &&
    !audioImportBlockedByCapability;

  async function refreshLevels() {
    setLoadingLevels(true);
    try {
      const response = await fetch("/api/user-levels", { cache: "no-store" });
      const body = (await response.json()) as {
        ok: boolean;
        levels?: Array<{ id: string; title: string; status: string; sourceType: string }>;
      };
      if (response.ok && body.ok && body.levels) {
        setLevels(body.levels);
      }
    } catch {
      // no-op
    } finally {
      setLoadingLevels(false);
    }
  }

  async function refreshCapabilities() {
    try {
      const response = await fetch("/api/import-capabilities", { cache: "no-store" });
      const body = (await response.json()) as ImportCapabilitiesResponse;
      if (response.ok && body.ok && body.capabilities?.audioImport) {
        setAudioImportCapability(body.capabilities.audioImport);
      }
    } catch {
      // no-op
    }
  }

  useEffect(() => {
    void refreshLevels();
    void refreshCapabilities();
  }, []);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const response = await fetch(`/api/import-jobs/${jobId}`, { cache: "no-store" });
        const body = (await response.json()) as ImportJobStatusResponse;
        if (cancelled || !body.job) {
          return;
        }
        setJobStatus(body.job);
        if (body.job.status === "failed") {
          setInfo(null);
          const message = body.job.error?.message ?? "Import failed.";
          const details = body.job.error?.details?.trim();
          setError(details ? `${message} ${details}` : message);
          return;
        }
        if (body.job.status === "awaiting_review" || body.job.status === "completed") {
          setInfo("Import complete. Open the editor to review and publish.");
          void refreshLevels();
          return;
        }
        timer = setTimeout(() => {
          void poll();
        }, 2000);
      } catch {
        if (!cancelled) {
          timer = setTimeout(() => {
            void poll();
          }, 3000);
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [jobId]);

  useEffect(() => {
    setSourceAsset(null);
    setAudioAsset(null);
    setJobId(null);
    setJobStatus(null);
    setError(null);
    setInfo(null);
    setSourceFile(null);
    setAudioFile(null);
    setInputResetKey((current) => current + 1);
  }, [sourceType]);

  async function ensureAssetsReady() {
    let nextSourceAsset = sourceAsset;
    let nextAudioAsset = audioAsset;

    if (!nextSourceAsset) {
      if (!sourceFile) {
        throw new Error("Choose a source file first.");
      }
      nextSourceAsset = await uploadAsset(sourceFile);
      setSourceAsset(nextSourceAsset);
    }

    if (requiresOptionalAudioUpload) {
      if (audioFile && !nextAudioAsset) {
        if (!isAudioFile(audioFile)) {
          throw new Error("Optional backing audio must be an audio file.");
        }
        nextAudioAsset = await uploadAsset(audioFile, "audio_preview");
        setAudioAsset(nextAudioAsset);
      }
    } else {
      nextAudioAsset = null;
      setAudioAsset(null);
    }

    return {
      source: nextSourceAsset,
      audio: nextAudioAsset,
    };
  }

  async function handleUploadAssets() {
    setUploading(true);
    setError(null);
    setInfo(null);
    try {
      await ensureAssetsReady();
      setInfo("Assets uploaded. Start import to generate your draft chart.");
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Asset upload failed.";
      setError(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleStartImport() {
    setStartingJob(true);
    setError(null);
    setInfo(null);

    try {
      if (!title.trim()) {
        throw new Error("Please add a level title.");
      }
      if (selectedSourceKind === "unknown") {
        throw new Error("Unsupported source file type. Upload a MIDI file or supported audio file.");
      }
      if (audioImportBlockedByCapability && audioImportCapability) {
        throw new Error(audioImportCapability.message);
      }
      const assets = await ensureAssetsReady();

      const response = await fetch("/api/import-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          sourceAssetId: assets.source.id,
          audioAssetId: assets.audio?.id,
          title: title.trim(),
          manualBpm: manualBpm ? Number(manualBpm) : undefined,
          quantization,
          instrumentPreset,
          transcriptionTuning,
          selectedStem,
        }),
      });
      const body = (await response.json()) as CreateImportJobResponse;
      if (!response.ok || !body.ok || !body.jobId) {
        throw new Error(body.message ?? "Failed to create import job.");
      }

      setJobId(body.jobId);
      setInfo("Import started. Processing runs asynchronously.");
    } catch (jobError) {
      const message = jobError instanceof Error ? jobError.message : "Could not start import.";
      setError(message);
    } finally {
      setStartingJob(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <h1>Create Your Own Level</h1>
        <p>Upload a source file, then backend workers handle import and status updates.</p>
      </section>

      <section className={styles.panel}>
        <h2>Import Source</h2>
        <p className={styles.helperText}>
          Source file type is auto-detected on the server. Audio mode below is only a preference for audio files.
        </p>
        {showAudioCapabilityWarning && (
          <p className={styles.warningBanner}>{audioImportCapability.message}</p>
        )}
        <div className={styles.grid3}>
          {SOURCE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => setSourceType(option.value)}
              className={option.value === sourceType ? styles.sourceCardActive : styles.sourceCard}
            >
              <strong>{option.label}</strong>
              <span>{option.hint}</span>
            </button>
          ))}
        </div>

        <div className={styles.formRow}>
          <label htmlFor="level-title">Level title</label>
          <input
            id="level-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="My custom chart"
            maxLength={100}
          />
        </div>

        <div className={styles.grid2}>
          <div className={styles.formRow}>
            <label htmlFor="source-file">
              Source file (auto-detected)
            </label>
            <input
              key={`source-file-${sourceType}-${inputResetKey}`}
              id="source-file"
              type="file"
              accept={sourceAccept}
              onChange={(event) => {
                setSourceFile(event.target.files?.[0] ?? null);
                setSourceAsset(null);
                setAudioAsset(null);
              }}
            />
            {sourceFile && (
              <p className={styles.helperText}>
                Detected file type: {selectedSourceKind}.
                {selectedSourceKind === "audio" && sourceType === "midi"
                  ? " Audio mode preference defaults to isolated audio unless you choose Full Mix Audio."
                  : ""}
              </p>
            )}
          </div>

          {requiresOptionalAudioUpload && (
            <div className={styles.formRow}>
              <label htmlFor="audio-file">Optional backing audio</label>
              <input
                key={`audio-file-${sourceType}-${inputResetKey}`}
                id="audio-file"
                type="file"
                accept="audio/*"
                onChange={(event) => {
                  setAudioFile(event.target.files?.[0] ?? null);
                  setAudioAsset(null);
                }}
              />
            </div>
          )}
        </div>

        <div className={styles.grid3}>
          <div className={styles.formRow}>
            <label htmlFor="manual-bpm">Manual BPM fallback</label>
            <input
              id="manual-bpm"
              type="number"
              min={20}
              max={320}
              value={manualBpm}
              onChange={(event) => setManualBpm(event.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className={styles.formRow}>
            <label htmlFor="quantization">Import quantization</label>
            <select
              id="quantization"
              value={quantization}
              onChange={(event) => setQuantization(event.target.value as LevelQuantization)}
            >
              {QUANTIZATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formRow}>
            <label htmlFor="preset">Instrument preset</label>
            <select
              id="preset"
              value={instrumentPreset}
              onChange={(event) => setInstrumentPreset(event.target.value as InstrumentPreset)}
            >
              {INSTRUMENT_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.formRow}>
          <label htmlFor="transcription-tuning">Transcription tuning</label>
          <select
            id="transcription-tuning"
            value={transcriptionTuning}
            onChange={(event) => setTranscriptionTuning(event.target.value as TranscriptionTuning)}
          >
            {TRANSCRIPTION_TUNING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className={styles.helperText}>
            {TRANSCRIPTION_TUNING_OPTIONS.find((option) => option.value === transcriptionTuning)?.hint}
          </p>
        </div>

        {sourceType === "full_mix_audio" && (
          <div className={styles.formRow}>
            <label htmlFor="stem">Preferred stem (Phase 3)</label>
            <select
              id="stem"
              value={selectedStem}
              onChange={(event) => setSelectedStem(event.target.value as StemTarget)}
            >
              {STEM_OPTIONS.map((stem) => (
                <option key={stem} value={stem}>
                  {stem}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" onClick={() => void handleUploadAssets()} disabled={uploading}>
            {uploading ? "Uploading..." : "Upload Assets"}
          </button>
          <button
            type="button"
            onClick={() => void handleStartImport()}
            disabled={!canStartImport}
            className={styles.primary}
          >
            {startingJob ? "Starting..." : "Start Import Job"}
          </button>
        </div>

        <div className={styles.assetSummary}>
          <span>
            Source asset:{" "}
            {sourceAsset
              ? `${sourceAsset.originalFilename} (${sourceAsset.detectedSourceKind})`
              : "not uploaded"}
          </span>
          <span>Audio asset: {audioAsset ? audioAsset.originalFilename : "none"}</span>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {info && <p className={styles.info}>{info}</p>}
      </section>

      <section className={styles.panel}>
        <h2>Import Job Status</h2>
        {!jobId && <p>No active import job yet.</p>}
        {jobStatus && (
          <>
            <div className={styles.statusRow}>
              <span>Status: {jobStatus.status}</span>
              <span>Stage: {jobStatus.stage}</span>
              <span>Progress: {jobStatus.progressPercent}%</span>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressBar} style={{ width: `${jobStatus.progressPercent}%` }} />
            </div>
            {jobStatus.result?.warnings?.length ? (
              <ul className={styles.warningList}>
                {jobStatus.result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            {jobStatus.levelId && (
              <div className={styles.actions}>
                <Link href={`/create-level/${jobStatus.levelId}/edit`} className={styles.linkButton}>
                  Open Draft Editor
                </Link>
                <Link href={`/game/${jobStatus.levelId}`} className={styles.linkButtonMuted}>
                  Test in Game
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      <section className={styles.panel}>
        <h2>Your Levels</h2>
        {loadingLevels && <p>Loading levels...</p>}
        {!loadingLevels && levels.length === 0 && <p>No imported levels yet.</p>}
        <div className={styles.levelList}>
          {levels.map((level) => (
            <article key={level.id} className={styles.levelCard}>
              <div>
                <h3>{level.title}</h3>
                <p>
                  {level.status} · {level.sourceType}
                </p>
              </div>
              <div className={styles.levelActions}>
                <Link href={`/create-level/${level.id}/edit`}>Edit</Link>
                <Link href={`/game/${level.id}`}>Play</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
