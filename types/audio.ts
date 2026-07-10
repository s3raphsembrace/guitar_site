export interface PitchResult {
  hz: number;
  corr: number;
}

export interface AudioReadout {
  sampleRate: number;
  rms: number;
  db: number;
  peak: number;
  clipping: boolean;
  pitchHz: number;
  pitchConf: number;
}
