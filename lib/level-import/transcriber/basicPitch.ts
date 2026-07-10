import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { access, mkdir, readFile, readdir } from "node:fs/promises";
import { Midi } from "@tonejs/midi";
import type { ChartEvent, InstrumentPreset, TranscriptionTuning } from "@/types/level-import";
import { sortEvents } from "@/lib/level-import/utils";
import type { AudioTranscriber, TranscriberInput, TranscriberOutput } from "@/lib/level-import/transcriber/types";
import { getRuntimeDependencyStatus } from "@/lib/level-import/runtimeDependencies";

const CHORD_GROUP_WINDOW_MS = 12;
const ACTIVITY_WINDOW_MS = 40;
const MIN_ACTIVITY_RMS = 0.01;
const MERGE_GAP_TOLERANCE_MS = 20;
const DEFAULT_TRANSCRIPTION_TUNING: TranscriptionTuning = "balanced";
const PRESET_FREQUENCY_LIMITS: Record<InstrumentPreset, { minHz: number; maxHz: number }> = {
  guitar: { minHz: 70, maxHz: 1400 },
  bass: { minHz: 35, maxHz: 500 },
};
const PRESET_POST_FILTER_BASE: Record<
  InstrumentPreset,
  { minConfidence: number; minDurationMs: number; minPitchMidi: number; maxPitchMidi: number }
> = {
  guitar: { minConfidence: 0.5, minDurationMs: 70, minPitchMidi: 40, maxPitchMidi: 88 },
  bass: { minConfidence: 0.6, minDurationMs: 90, minPitchMidi: 28, maxPitchMidi: 67 },
};
const TUNING_ADJUSTMENTS: Record<
  TranscriptionTuning,
  { confidenceDelta: number; minDurationDeltaMs: number; introGateMarginMs: number }
> = {
  conservative: { confidenceDelta: 0.07, minDurationDeltaMs: 20, introGateMarginMs: 60 },
  balanced: { confidenceDelta: 0, minDurationDeltaMs: 0, introGateMarginMs: 120 },
  sensitive: { confidenceDelta: -0.1, minDurationDeltaMs: -25, introGateMarginMs: 180 },
};

interface NoteLikeEvent {
  timeMs: number;
  durationMs: number;
  pitchMidi: number;
  velocity: number;
  confidence: number;
}

interface ActivityDetectionResult {
  firstActivityMs: number;
}

interface PostFilterConfig {
  tuning: TranscriptionTuning;
  minConfidence: number;
  minDurationMs: number;
  minPitchMidi: number;
  maxPitchMidi: number;
  introGateMarginMs: number;
}

interface PostFilterStats {
  raw: number;
  droppedLowConfidence: number;
  droppedOutOfRange: number;
  droppedPreActivity: number;
  mergedOverlap: number;
  droppedShortDuration: number;
  final: number;
}

function runCommand(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `${command} exited with code ${code}`));
      }
    });
  });
}

function summarizeCommandError(rawMessage: string) {
  const lines = rawMessage
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(0, 3).join(" ");
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function toVelocityUnit(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (value <= 1) {
    return Math.min(1, value);
  }
  return Math.min(1, value / 127);
}

function resolvePythonCommandWithBasicPitch() {
  const candidates = process.platform === "win32"
    ? ["py", "python", "python3"]
    : ["python3", "python"];

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["-c", "import basic_pitch"], { stdio: "ignore" });
    if (!result.error && result.status === 0) {
      return candidate;
    }
  }

  return null;
}

function resolveBasicPitchInvocation() {
  const status = getRuntimeDependencyStatus({ forceRefresh: true });

  if (status.basicPitch === "missing") {
    throw new Error(
      "Audio transcription failed: Basic Pitch is not available on the server runtime.",
    );
  }

  if (status.basicPitch === "cli") {
    return {
      command: "basic-pitch",
      prefixArgs: [] as string[],
      warnings: [] as string[],
    };
  }

  const pythonCommand = resolvePythonCommandWithBasicPitch();
  if (!pythonCommand) {
    throw new Error(
      "Audio transcription failed: Basic Pitch Python module is installed, but no Python executable is available to run it.",
    );
  }

  return {
    command: pythonCommand,
    prefixArgs: ["-m", "basic_pitch.inference"],
    warnings: ["Basic Pitch CLI was unavailable, so the Python module entrypoint was used for transcription."],
  };
}

async function resolveCsvOutputPath(outputDir: string, inputWavAbsolutePath: string) {
  const expected = path.join(outputDir, `${path.parse(inputWavAbsolutePath).name}_basic_pitch.csv`);
  try {
    await access(expected);
    return expected;
  } catch {
    const files = await readdir(outputDir);
    const csvFilename = files.find((name) => name.toLowerCase().endsWith(".csv"));
    if (!csvFilename) {
      return null;
    }
    return path.join(outputDir, csvFilename);
  }
}

async function resolveMidiOutputPath(outputDir: string, inputWavAbsolutePath: string) {
  const expected = path.join(outputDir, `${path.parse(inputWavAbsolutePath).name}_basic_pitch.mid`);
  try {
    await access(expected);
    return expected;
  } catch {
    const files = await readdir(outputDir);
    const midiFilename = files.find((name) => name.toLowerCase().endsWith(".mid") || name.toLowerCase().endsWith(".midi"));
    if (!midiFilename) {
      throw new Error("Basic Pitch did not emit a MIDI output file.");
    }
    return path.join(outputDir, midiFilename);
  }
}

function normalizeNote(note: NoteLikeEvent): NoteLikeEvent {
  return {
    timeMs: Math.max(0, Math.round(note.timeMs)),
    durationMs: Math.max(1, Math.round(note.durationMs)),
    pitchMidi: Math.min(127, Math.max(0, Math.round(note.pitchMidi))),
    velocity: Math.min(1, Math.max(0, note.velocity)),
    confidence: Math.min(1, Math.max(0, note.confidence)),
  };
}

function mergeOverlappingNotesByPitch(notes: NoteLikeEvent[]) {
  const sorted = [...notes]
    .map(normalizeNote)
    .sort((a, b) => a.pitchMidi - b.pitchMidi || a.timeMs - b.timeMs || a.durationMs - b.durationMs);
  const merged: NoteLikeEvent[] = [];

  for (const note of sorted) {
    const previous = merged.at(-1);
    if (!previous || previous.pitchMidi !== note.pitchMidi) {
      merged.push({ ...note });
      continue;
    }

    const previousEnd = previous.timeMs + previous.durationMs;
    const noteEnd = note.timeMs + note.durationMs;
    if (note.timeMs > previousEnd + MERGE_GAP_TOLERANCE_MS) {
      merged.push({ ...note });
      continue;
    }

    previous.durationMs = Math.max(previousEnd, noteEnd) - previous.timeMs;
    previous.velocity = Math.max(previous.velocity, note.velocity);
    previous.confidence = Math.max(previous.confidence, note.confidence);
  }

  return merged.sort((a, b) => a.timeMs - b.timeMs || a.pitchMidi - b.pitchMidi);
}

function resolvePostFilterConfig(preset: InstrumentPreset, tuning: TranscriptionTuning): PostFilterConfig {
  const base = PRESET_POST_FILTER_BASE[preset];
  const adjustment = TUNING_ADJUSTMENTS[tuning];
  return {
    tuning,
    minConfidence: Math.max(0, Math.min(1, base.minConfidence + adjustment.confidenceDelta)),
    minDurationMs: Math.max(20, Math.round(base.minDurationMs + adjustment.minDurationDeltaMs)),
    minPitchMidi: base.minPitchMidi,
    maxPitchMidi: base.maxPitchMidi,
    introGateMarginMs: Math.max(0, Math.round(adjustment.introGateMarginMs)),
  };
}

function applyPostFilters(
  notes: NoteLikeEvent[],
  preset: InstrumentPreset,
  tuning: TranscriptionTuning,
  firstActivityMs?: number,
) {
  const config = resolvePostFilterConfig(preset, tuning);
  const warnings: string[] = [];
  let filtered = notes.map(normalizeNote);
  const stats: PostFilterStats = {
    raw: filtered.length,
    droppedLowConfidence: 0,
    droppedOutOfRange: 0,
    droppedPreActivity: 0,
    mergedOverlap: 0,
    droppedShortDuration: 0,
    final: 0,
  };

  const confidenceBefore = filtered.length;
  filtered = filtered.filter((note) => note.confidence >= config.minConfidence);
  const confidenceDropped = confidenceBefore - filtered.length;
  stats.droppedLowConfidence = confidenceDropped;
  if (confidenceDropped > 0) {
    warnings.push(
      `Dropped ${confidenceDropped} low-confidence notes (threshold ${config.minConfidence.toFixed(2)}).`,
    );
  }

  const rangeBefore = filtered.length;
  filtered = filtered.filter((note) => note.pitchMidi >= config.minPitchMidi && note.pitchMidi <= config.maxPitchMidi);
  const rangeDropped = rangeBefore - filtered.length;
  stats.droppedOutOfRange = rangeDropped;
  if (rangeDropped > 0) {
    warnings.push(
      `Dropped ${rangeDropped} notes outside ${preset} pitch range (${config.minPitchMidi}-${config.maxPitchMidi}).`,
    );
  }

  const leadingGateMs = firstActivityMs !== undefined
    ? Math.max(0, firstActivityMs - config.introGateMarginMs)
    : undefined;
  if (leadingGateMs !== undefined) {
    const gateBefore = filtered.length;
    filtered = filtered.filter((note) => note.timeMs >= leadingGateMs);
    const gateDropped = gateBefore - filtered.length;
    stats.droppedPreActivity = gateDropped;
    if (gateDropped > 0) {
      warnings.push(
        `Dropped ${gateDropped} pre-activity notes before ${leadingGateMs}ms (first activity ${firstActivityMs}ms).`,
      );
    }
  }

  const mergeBefore = filtered.length;
  filtered = mergeOverlappingNotesByPitch(filtered);
  const mergeReduced = mergeBefore - filtered.length;
  stats.mergedOverlap = mergeReduced;
  if (mergeReduced > 0) {
    warnings.push(`Merged ${mergeReduced} overlapping same-pitch note events.`);
  }

  const durationBefore = filtered.length;
  filtered = filtered.filter((note) => note.durationMs >= config.minDurationMs);
  const durationDropped = durationBefore - filtered.length;
  stats.droppedShortDuration = durationDropped;
  if (durationDropped > 0) {
    warnings.push(
      `Dropped ${durationDropped} short notes below ${config.minDurationMs}ms.`,
    );
  }

  stats.final = filtered.length;
  warnings.push(
    `Post-filter stats (preset=${preset}, tuning=${config.tuning}): raw=${stats.raw}, drop_confidence=${stats.droppedLowConfidence}, drop_range=${stats.droppedOutOfRange}, drop_intro=${stats.droppedPreActivity}, merged_overlap=${stats.mergedOverlap}, drop_short=${stats.droppedShortDuration}, final=${stats.final}.`,
  );
  warnings.push(
    `Post-filter thresholds: confidence>=${config.minConfidence.toFixed(2)}, minDuration>=${config.minDurationMs}ms, introGateMargin=${config.introGateMarginMs}ms, pitchRange=${config.minPitchMidi}-${config.maxPitchMidi}.`,
  );

  return { notes: filtered, warnings, config, stats };
}

function buildEventsFromNotes(notes: NoteLikeEvent[]): ChartEvent[] {
  const sortedNotes = notes
    .map(normalizeNote)
    .sort((a, b) => a.timeMs - b.timeMs || a.durationMs - b.durationMs || a.pitchMidi - b.pitchMidi);

  if (sortedNotes.length === 0) {
    return [];
  }

  const groups: Array<{
    timeMs: number;
    durationMs: number;
    notes: number[];
    velocitySum: number;
    confidenceSum: number;
    count: number;
  }> = [];

  for (const note of sortedNotes) {
    const last = groups.at(-1);

    if (last && Math.abs(last.timeMs - note.timeMs) <= CHORD_GROUP_WINDOW_MS) {
      if (!last.notes.includes(note.pitchMidi)) {
        last.notes.push(note.pitchMidi);
      }
      last.durationMs = Math.max(last.durationMs, note.durationMs);
      last.velocitySum += note.velocity;
      last.confidenceSum += note.confidence;
      last.count += 1;
      continue;
    }

    groups.push({
      timeMs: note.timeMs,
      durationMs: note.durationMs,
      notes: [note.pitchMidi],
      velocitySum: note.velocity,
      confidenceSum: note.confidence,
      count: 1,
    });
  }

  return sortEvents(
    groups.map((group, index) => {
      const avgVelocity = Number((group.velocitySum / Math.max(1, group.count)).toFixed(3));
      const avgConfidence = Number((group.confidenceSum / Math.max(1, group.count)).toFixed(3));
      return {
        id: `${index + 1}`,
        timeMs: group.timeMs,
        durationMs: group.durationMs,
        notes: group.notes.sort((a, b) => a - b),
        velocity: avgVelocity,
        confidence: avgConfidence,
      };
    }),
  );
}

async function parseNoteEventsFromCsv(csvPath: string): Promise<NoteLikeEvent[]> {
  const rawCsv = await readFile(csvPath, "utf8");
  const lines = rawCsv
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  const noteEvents: NoteLikeEvent[] = [];
  for (const line of lines.slice(1)) {
    const columns = line.split(",");
    if (columns.length < 4) {
      continue;
    }

    const startSeconds = Number(columns[0]);
    const endSeconds = Number(columns[1]);
    const pitchMidi = Number(columns[2]);
    const velocityRaw = Number(columns[3]);
    if (
      !Number.isFinite(startSeconds) ||
      !Number.isFinite(endSeconds) ||
      !Number.isFinite(pitchMidi) ||
      !Number.isFinite(velocityRaw)
    ) {
      continue;
    }

    const velocity = toVelocityUnit(velocityRaw);
    noteEvents.push({
      timeMs: startSeconds * 1000,
      durationMs: (endSeconds - startSeconds) * 1000,
      pitchMidi,
      velocity,
      confidence: velocity,
    });
  }

  return noteEvents;
}

function parseNoteEventsFromMidi(midi: Midi): NoteLikeEvent[] {
  return midi.tracks
    .flatMap((track) => track.notes)
    .map((note) => {
      const velocity = typeof note.velocity === "number" ? note.velocity : 0.75;
      return {
        timeMs: note.time * 1000,
        durationMs: note.duration * 1000,
        pitchMidi: note.midi,
        velocity,
        confidence: velocity,
      };
    });
}

function decodeMonoSamplesFromWav(buffer: Buffer) {
  if (buffer.length < 44) {
    return null;
  }
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    return null;
  }

  let audioFormat = 0;
  let channelCount = 0;
  let sampleRate = 0;
  let blockAlign = 0;
  let bitsPerSample = 0;
  let dataChunk: Buffer | null = null;

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = Math.min(chunkStart + chunkSize, buffer.length);

    if (chunkId === "fmt " && chunkSize >= 16 && chunkEnd <= buffer.length) {
      audioFormat = buffer.readUInt16LE(chunkStart);
      channelCount = buffer.readUInt16LE(chunkStart + 2);
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      blockAlign = buffer.readUInt16LE(chunkStart + 12);
      bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
    } else if (chunkId === "data") {
      dataChunk = buffer.subarray(chunkStart, chunkEnd);
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  if (!dataChunk || !sampleRate || !blockAlign || !channelCount || !bitsPerSample) {
    return null;
  }
  if (!(audioFormat === 1 || audioFormat === 3)) {
    return null;
  }

  const sampleCount = Math.floor(dataChunk.length / blockAlign);
  const samples = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    const frameStart = index * blockAlign;
    let value = 0;

    if (audioFormat === 1) {
      if (bitsPerSample === 16) {
        value = dataChunk.readInt16LE(frameStart) / 32768;
      } else if (bitsPerSample === 24) {
        const raw =
          dataChunk[frameStart] |
          (dataChunk[frameStart + 1] << 8) |
          (dataChunk[frameStart + 2] << 16);
        const signed = (raw & 0x800000) !== 0 ? raw | ~0xffffff : raw;
        value = signed / 8388608;
      } else if (bitsPerSample === 32) {
        value = dataChunk.readInt32LE(frameStart) / 2147483648;
      } else {
        return null;
      }
    } else if (audioFormat === 3 && bitsPerSample === 32) {
      value = dataChunk.readFloatLE(frameStart);
    } else {
      return null;
    }

    samples[index] = Math.max(-1, Math.min(1, value));
  }

  return {
    sampleRate,
    samples,
  };
}

function detectFirstActivityFromSamples(samples: Float32Array, sampleRate: number): ActivityDetectionResult | null {
  const windowSamples = Math.max(256, Math.floor(sampleRate * (ACTIVITY_WINDOW_MS / 1000)));
  if (samples.length < windowSamples * 2) {
    return null;
  }

  const rmsValues: number[] = [];
  for (let start = 0; start + windowSamples <= samples.length; start += windowSamples) {
    let energy = 0;
    for (let idx = start; idx < start + windowSamples; idx += 1) {
      const sample = samples[idx];
      energy += sample * sample;
    }
    rmsValues.push(Math.sqrt(energy / windowSamples));
  }

  if (rmsValues.length < 3) {
    return null;
  }

  const noiseWindowCount = Math.min(
    rmsValues.length,
    Math.max(4, Math.floor(1000 / ACTIVITY_WINDOW_MS)),
  );
  const noiseFloor = median(rmsValues.slice(0, noiseWindowCount));
  const threshold = Math.max(MIN_ACTIVITY_RMS, noiseFloor * 3.5);

  for (let index = 0; index < rmsValues.length; index += 1) {
    const current = rmsValues[index];
    const next = rmsValues[index + 1] ?? 0;
    if (current >= threshold && (next >= threshold * 0.8 || current >= threshold * 1.5)) {
      return {
        firstActivityMs: Math.round(index * ACTIVITY_WINDOW_MS),
      };
    }
  }

  return null;
}

async function detectFirstActivityMs(wavAbsolutePath: string): Promise<ActivityDetectionResult | null> {
  try {
    const buffer = await readFile(wavAbsolutePath);
    const decoded = decodeMonoSamplesFromWav(buffer as Buffer);
    if (!decoded) {
      return null;
    }
    return detectFirstActivityFromSamples(decoded.samples, decoded.sampleRate);
  } catch {
    return null;
  }
}

class BasicPitchTranscriber implements AudioTranscriber {
  name = "basic-pitch-transcriber";

  async transcribe(input: TranscriberInput): Promise<TranscriberOutput> {
    const warnings: string[] = [];
    const invocation = resolveBasicPitchInvocation();
    warnings.push(...invocation.warnings);
    const resolvedTuning = input.tuning ?? DEFAULT_TRANSCRIPTION_TUNING;
    const postFilterConfig = resolvePostFilterConfig(input.preset, resolvedTuning);
    warnings.push(
      `Transcription tuning: ${resolvedTuning} (confidence>=${postFilterConfig.minConfidence.toFixed(2)}, minDuration>=${postFilterConfig.minDurationMs}ms, introGateMargin=${postFilterConfig.introGateMarginMs}ms).`,
    );

    const outputDir = path.join(path.dirname(input.wavAbsolutePath), "transcription", randomUUID().slice(0, 8));
    await mkdir(outputDir, { recursive: true });

    const limits = PRESET_FREQUENCY_LIMITS[input.preset];
    const args = [
      ...invocation.prefixArgs,
      "--save-midi",
      "--save-note-events",
      "--minimum-note-length",
      `${postFilterConfig.minDurationMs}`,
      "--minimum-frequency",
      `${limits.minHz}`,
      "--maximum-frequency",
      `${limits.maxHz}`,
      outputDir,
      input.wavAbsolutePath,
    ];

    try {
      await runCommand(invocation.command, args);
    } catch (error) {
      const message = error instanceof Error ? summarizeCommandError(error.message) : "Unknown Basic Pitch error";
      throw new Error(`Audio transcription failed while running Basic Pitch. ${message}`);
    }

    let noteEvents: NoteLikeEvent[] = [];
    const csvPath = await resolveCsvOutputPath(outputDir, input.wavAbsolutePath);
    if (csvPath) {
      try {
        noteEvents = await parseNoteEventsFromCsv(csvPath);
      } catch {
        warnings.push("Failed to parse Basic Pitch note-events CSV. Falling back to MIDI output.");
      }
    } else {
      warnings.push("Basic Pitch note-events CSV was not found. Falling back to MIDI output.");
    }

    if (noteEvents.length === 0) {
      const midiPath = await resolveMidiOutputPath(outputDir, input.wavAbsolutePath);
      const midi = new Midi(await readFile(midiPath));
      noteEvents = parseNoteEventsFromMidi(midi);
    }

    const activity = await detectFirstActivityMs(input.wavAbsolutePath);
    const firstActivityMs = activity?.firstActivityMs;
    if (firstActivityMs !== undefined) {
      warnings.push(`Detected first analysis activity at ${firstActivityMs}ms.`);
    }

    const postFiltered = applyPostFilters(noteEvents, input.preset, resolvedTuning, firstActivityMs);
    warnings.push(...postFiltered.warnings);
    const events = buildEventsFromNotes(postFiltered.notes);

    if (events.length === 0) {
      warnings.push("Basic Pitch completed but no notes were detected in this audio segment.");
    }

    return {
      events,
      warnings,
      analysisFirstActivityMs: firstActivityMs,
    };
  }
}

let singleton: AudioTranscriber | null = null;

export function getTranscriber(): AudioTranscriber {
  if (singleton) {
    return singleton;
  }
  singleton = new BasicPitchTranscriber();
  return singleton;
}
