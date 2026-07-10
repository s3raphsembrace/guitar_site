export type MappingPolicy = "beginner_open" | "smooth_motion" | "exact_authored";

export type InstrumentOverride = "auto" | "bass" | "guitar";

export type InstrumentType = "bass" | "guitar";

export type AuthoredTabPosition = {
  string: number;
  fret: number;
};

export type TabPosition = {
  midi: number;
  string: number;
  fret: number;
  unresolved?: boolean;
  reason?: string;
  candidateCount?: number;
  candidates?: Array<{ string: number; fret: number }>;
};

export type ComputedTabEvent = {
  timeMs: number;
  durationMs: number;
  notes: number[];
  velocity?: number;
  tab?: AuthoredTabPosition[];
  resolvedTab: TabPosition[];
  unresolvedCount: number;
  mappingPolicy: MappingPolicy;
};

export type InstrumentProfile = {
  type: InstrumentType;
  label: "BASS" | "GUITAR";
  source: string;
  tuning: number[]; // low -> high MIDI
  maxFret: number;
  displayStrings: string[]; // top -> bottom (high -> low)
};

export type ChartEventLike = {
  timeMs: number;
  durationMs: number;
  notes: number[];
  velocity?: number;
  tab?: AuthoredTabPosition[];
};

export type ChartLike = {
  analysisStem?: string;
  instrument?: {
    type?: string;
    tuning?: number[];
    maxFret?: number;
    strings?: number;
  };
  events: ChartEventLike[];
};

export type MappingState = {
  lastResolved: TabPosition | null;
  phraseFretCenter: number | null;
};

export type TabCandidate = {
  midi: number;
  string: number;
  fret: number;
  stringIndex: number; // 0 = lowest pitched string in tuning array
};
