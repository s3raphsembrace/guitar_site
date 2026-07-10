import type { ChartEvent } from "@/types/level-import";

export interface BeatTrackingInput {
  events: ChartEvent[];
  manualBpm?: number;
}

export interface BeatTrackingOutput {
  bpm: number | null;
  confidence: number;
  source: "detected" | "manual_fallback" | "none";
  warnings: string[];
}

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
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

function detectBpmFromEvents(events: ChartEvent[]) {
  if (events.length < 4) {
    return { bpm: null, confidence: 0 };
  }

  const deltas: number[] = [];
  for (let i = 1; i < events.length; i += 1) {
    const delta = events[i].timeMs - events[i - 1].timeMs;
    if (delta >= 120 && delta <= 2000) {
      deltas.push(delta);
    }
  }

  if (deltas.length < 3) {
    return { bpm: null, confidence: 0 };
  }

  const beatMs = median(deltas);
  if (!beatMs) {
    return { bpm: null, confidence: 0 };
  }

  const bpm = 60000 / beatMs;
  const normalizedBpm = bpm < 70 ? bpm * 2 : bpm > 190 ? bpm / 2 : bpm;
  const confidence = Math.min(1, deltas.length / 64);

  return {
    bpm: Number(normalizedBpm.toFixed(2)),
    confidence,
  };
}

export function runBeatTracking(input: BeatTrackingInput): BeatTrackingOutput {
  const warnings: string[] = [];
  const detected = detectBpmFromEvents(input.events);

  if (detected.bpm && detected.confidence >= 0.45) {
    return {
      bpm: detected.bpm,
      confidence: detected.confidence,
      source: "detected",
      warnings,
    };
  }

  if (input.manualBpm && input.manualBpm > 0) {
    warnings.push(
      `Automatic beat tracking confidence was ${formatConfidence(detected.confidence)}. Manual BPM (${input.manualBpm}) was applied.`,
    );
    return {
      bpm: input.manualBpm,
      confidence: detected.confidence,
      source: "manual_fallback",
      warnings,
    };
  }

  warnings.push(
    `Beat tracking confidence was ${formatConfidence(detected.confidence)} and no manual BPM was provided.`,
  );
  return {
    bpm: detected.bpm,
    confidence: detected.confidence,
    source: detected.bpm ? "detected" : "none",
    warnings,
  };
}
