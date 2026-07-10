import type { ChartEvent, LevelQuantization } from "@/types/level-import";
import { sortEvents } from "@/lib/level-import/utils";

function quantizationDivision(value: LevelQuantization) {
  if (value === "1/8") return 2;
  if (value === "1/16") return 4;
  return 0;
}

function quantizeValue(value: number, stepMs: number) {
  return Math.max(0, Math.round(value / stepMs) * stepMs);
}

export interface QuantizationInput {
  events: ChartEvent[];
  quantization: LevelQuantization;
  bpm: number | null;
}

export interface QuantizationOutput {
  events: ChartEvent[];
  warnings: string[];
}

export function runQuantization(input: QuantizationInput): QuantizationOutput {
  if (input.quantization === "off") {
    return { events: sortEvents(input.events), warnings: [] };
  }

  if (!input.bpm || input.bpm <= 0) {
    return {
      events: sortEvents(input.events),
      warnings: ["Quantization skipped because BPM is unavailable."],
    };
  }

  const division = quantizationDivision(input.quantization);
  if (!division) {
    return { events: sortEvents(input.events), warnings: [] };
  }

  const stepMs = 60000 / input.bpm / division;
  const quantized = input.events.map((event) => {
    const timeMs = quantizeValue(event.timeMs, stepMs);
    const durationMs = Math.max(stepMs, quantizeValue(event.durationMs, stepMs));
    return {
      ...event,
      timeMs: Math.round(timeMs),
      durationMs: Math.round(durationMs),
    };
  });

  return {
    events: sortEvents(quantized),
    warnings: [],
  };
}
