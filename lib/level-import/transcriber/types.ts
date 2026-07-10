import type { ChartEvent, InstrumentPreset, TranscriptionTuning } from "@/types/level-import";

export interface TranscriberInput {
  wavAbsolutePath: string;
  preset: InstrumentPreset;
  tuning: TranscriptionTuning;
}

export interface TranscriberOutput {
  events: ChartEvent[];
  warnings: string[];
  analysisFirstActivityMs?: number;
}

export interface AudioTranscriber {
  name: string;
  transcribe(input: TranscriberInput): Promise<TranscriberOutput>;
}
