import type { ChartEvent, InstrumentPreset } from "@/types/level-import";
import { clamp, sortEvents } from "@/lib/level-import/utils";

const PITCH_RANGES: Record<InstrumentPreset, { min: number; max: number }> = {
  guitar: { min: 40, max: 88 },
  bass: { min: 28, max: 67 },
};

function normalizeEvent(event: ChartEvent): ChartEvent {
  return {
    ...event,
    timeMs: Math.max(0, Math.round(event.timeMs)),
    durationMs: Math.max(1, Math.round(event.durationMs)),
    notes: [...new Set(event.notes.map((n) => Math.round(n)).filter((n) => n >= 0 && n <= 127))].sort(
      (a, b) => a - b,
    ),
  };
}

function filterByConfidence(events: ChartEvent[], minConfidence: number) {
  return events.filter((event) => (event.confidence ?? 1) >= minConfidence);
}

function filterByPitchRange(events: ChartEvent[], preset: InstrumentPreset) {
  const range = PITCH_RANGES[preset];
  return events
    .map((event) => ({
      ...event,
      notes: event.notes.filter((note) => note >= range.min && note <= range.max),
    }))
    .filter((event) => event.notes.length > 0);
}

function mergeDuplicateNotes(events: ChartEvent[]) {
  const merged: ChartEvent[] = [];
  const toleranceMs = 10;

  for (const event of sortEvents(events)) {
    const previous = merged.at(-1);
    if (
      previous &&
      Math.abs(previous.timeMs - event.timeMs) <= toleranceMs &&
      previous.notes.join(",") === event.notes.join(",")
    ) {
      previous.durationMs = Math.max(previous.durationMs, event.durationMs);
      previous.velocity = Math.max(previous.velocity ?? 0, event.velocity ?? 0);
      previous.confidence = Math.max(previous.confidence ?? 0, event.confidence ?? 0);
      continue;
    }
    merged.push({ ...event });
  }

  return merged;
}

function clampMinDuration(events: ChartEvent[], minDurationMs: number) {
  return events.map((event) => ({
    ...event,
    durationMs: clamp(event.durationMs, minDurationMs, 60_000),
  }));
}

function simplifyMonophonic(events: ChartEvent[]) {
  return events.map((event) => {
    if (event.notes.length <= 1) {
      return event;
    }
    const topNote = [...event.notes].sort((a, b) => b - a)[0];
    return {
      ...event,
      notes: [topNote],
    };
  });
}

export interface CleanupPipelineInput {
  events: ChartEvent[];
  preset: InstrumentPreset;
  minConfidence?: number;
  minDurationMs?: number;
  simplifyMonophonic?: boolean;
}

export interface CleanupPipelineOutput {
  events: ChartEvent[];
  warnings: string[];
}

export function runCleanupPipeline(input: CleanupPipelineInput): CleanupPipelineOutput {
  const warnings: string[] = [];
  const initialCount = input.events.length;
  const minConfidence = input.minConfidence ?? 0.2;
  const minDurationMs = input.minDurationMs ?? 60;
  const simplify = input.simplifyMonophonic ?? true;

  let events = input.events.map(normalizeEvent).filter((event) => event.notes.length > 0);
  events = filterByConfidence(events, minConfidence);
  events = filterByPitchRange(events, input.preset);
  events = mergeDuplicateNotes(events);
  events = clampMinDuration(events, minDurationMs);
  if (simplify) {
    events = simplifyMonophonic(events);
  }
  events = sortEvents(events);

  if (events.length === 0 && initialCount > 0) {
    warnings.push("Cleanup removed all detected notes. Try lowering filters in a future iteration.");
  }

  return { events, warnings };
}
