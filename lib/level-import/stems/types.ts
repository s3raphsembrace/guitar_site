import type { StemTarget } from "@/types/level-import";

export interface StemSeparationInput {
  sourceAudioAbsolutePath: string;
  selectedStem: StemTarget;
}

export interface StemSeparationOutput {
  stemAbsolutePath: string;
  stemPublicUrl: string;
  warnings: string[];
}

export interface StemSeparator {
  name: string;
  separate(input: StemSeparationInput): Promise<StemSeparationOutput>;
}
