import type {
  ChartEventLike,
  ChartLike,
  ComputedTabEvent,
  InstrumentOverride,
  InstrumentProfile,
  MappingPolicy,
  MappingState,
  TabCandidate,
  TabPosition,
} from "./types";

const DEFAULT_MAX_FRET = 24;

const GUITAR_STANDARD_TUNING = [40, 45, 50, 55, 59, 64];
const BASS_STANDARD_TUNING = [28, 33, 38, 43];
const BASS_FIVE_STANDARD_TUNING = [23, 28, 33, 38, 43];

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeTuning(raw: unknown, fallback: number[]) {
  if (!Array.isArray(raw)) return [...fallback];
  const normalized = raw
    .map((value) => Math.round(Number(value)))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 127)
    .sort((a, b) => a - b);

  return normalized.length >= 4 ? normalized : [...fallback];
}

function getNoteClassName(midi: number) {
  return NOTE_NAMES[((Math.round(midi) % 12) + 12) % 12];
}

function getDisplayStrings(type: InstrumentProfile["type"], tuning: number[]) {
  if (type === "bass" && tuning.length === 4) {
    return ["G", "D", "A", "E"];
  }
  if (type === "bass" && tuning.length === 5 && tuning[0] <= 24) {
    return ["G", "D", "A", "E", "B"];
  }
  if (type === "guitar" && tuning.length === 6) {
    return ["e", "B", "G", "D", "A", "E"];
  }

  // Generic fallback: derive top->bottom string labels from open-string pitch classes.
  return [...tuning]
    .sort((a, b) => b - a)
    .map((midi) => getNoteClassName(midi));
}

function instrumentTypeFromText(value: unknown): InstrumentProfile["type"] | null {
  const text = `${value ?? ""}`.toLowerCase();
  if (text.includes("bass")) return "bass";
  if (text.includes("guitar")) return "guitar";
  return null;
}

function inferTypeFromRange(chart: ChartLike): InstrumentProfile["type"] | null {
  const allNotes = chart.events.flatMap((event) => event.notes).map((note) => Math.round(note));
  if (!allNotes.length) return null;
  const minMidi = Math.min(...allNotes);

  // Conservative fallback: notes below E2 strongly imply a bass chart.
  if (minMidi < 40) return "bass";
  return null;
}

function buildProfile(type: InstrumentProfile["type"], chart: ChartLike, source: string): InstrumentProfile {
  const requestedStrings =
    typeof chart.instrument?.strings === "number" ? Math.round(chart.instrument.strings) : null;

  const defaultTuning =
    type === "bass" && requestedStrings === 5
      ? BASS_FIVE_STANDARD_TUNING
      : type === "bass"
        ? BASS_STANDARD_TUNING
        : GUITAR_STANDARD_TUNING;

  const tuning = normalizeTuning(chart.instrument?.tuning, defaultTuning);
  const maxFretRaw = Number(chart.instrument?.maxFret);
  const maxFret = Number.isFinite(maxFretRaw)
    ? clampNumber(Math.round(maxFretRaw), 12, 36)
    : DEFAULT_MAX_FRET;

  return {
    type,
    label: type === "bass" ? "BASS" : "GUITAR",
    source,
    tuning,
    maxFret,
    displayStrings: getDisplayStrings(type, tuning),
  };
}

export function mappingPolicyLabel(policy: MappingPolicy) {
  if (policy === "beginner_open") return "Beginner/Open";
  if (policy === "smooth_motion") return "Smooth Motion";
  return "Exact Authored";
}

export function resolveInstrumentProfile(
  chart: ChartLike,
  override: InstrumentOverride = "auto",
): InstrumentProfile {
  if (override === "bass" || override === "guitar") {
    return buildProfile(override, chart, "user override");
  }

  const fromInstrument = instrumentTypeFromText(chart.instrument?.type);
  if (fromInstrument) {
    return buildProfile(fromInstrument, chart, "chart.instrument.type");
  }

  if (`${chart.analysisStem ?? ""}`.toLowerCase().includes("bass")) {
    return buildProfile("bass", chart, "analysis stem");
  }

  const fromRange = inferTypeFromRange(chart);
  if (fromRange) {
    return buildProfile(fromRange, chart, "pitch-range heuristic");
  }

  return buildProfile("guitar", chart, "default");
}

function createUnresolvedPosition(
  midi: number,
  reason: string,
  candidates?: TabCandidate[],
): TabPosition {
  return {
    midi,
    string: 1,
    fret: 0,
    unresolved: true,
    reason,
    candidateCount: candidates?.length ?? 0,
    candidates: candidates?.map((candidate) => ({ string: candidate.string, fret: candidate.fret })),
  };
}

function toTabPosition(candidate: TabCandidate): TabPosition {
  return {
    midi: candidate.midi,
    string: candidate.string,
    fret: candidate.fret,
    candidateCount: 1,
  };
}

function distanceToPrevious(candidate: TabCandidate, prev: TabPosition | null) {
  if (!prev || prev.unresolved) return 0;
  const stringJump = Math.abs(candidate.string - prev.string);
  const fretJump = Math.abs(candidate.fret - prev.fret);
  return { fretJump, stringJump };
}

function scoreBeginnerOpen(candidate: TabCandidate, prev: TabPosition | null) {
  const continuity = distanceToPrevious(candidate, prev);
  let score = 0;

  // Strong low-fret preference for beginner readability.
  score += candidate.fret <= 5 ? candidate.fret * 0.45 : 2.25 + (candidate.fret - 5) * 3.6;
  if (candidate.fret === 0) score -= 2.1;
  score += Math.max(0, candidate.fret - 12) * 1.15;

  if (continuity) {
    score += continuity.fretJump * 0.35;
    score += continuity.stringJump * 0.3;
  }

  return score;
}

function scoreSmoothMotion(
  candidate: TabCandidate,
  prev: TabPosition | null,
  state: MappingState,
) {
  const continuity = distanceToPrevious(candidate, prev);
  let score = candidate.fret * 0.12;

  if (continuity) {
    score += continuity.fretJump * 1.55;
    score += continuity.stringJump * 1.15;
  }

  if (state.phraseFretCenter !== null) {
    score += Math.abs(candidate.fret - state.phraseFretCenter) * 0.72;
  }

  score += Math.max(0, candidate.fret - 12) * 0.95;
  if (candidate.fret === 0) score -= 0.15;

  return score;
}

function sortCandidatesWithScore(
  candidates: TabCandidate[],
  scoreFn: (candidate: TabCandidate) => number,
) {
  return [...candidates].sort((a, b) => {
    const sa = scoreFn(a);
    const sb = scoreFn(b);
    if (sa !== sb) return sa - sb;
    if (a.fret !== b.fret) return a.fret - b.fret;
    return a.string - b.string;
  });
}

export function getTabCandidatesForMidi(midi: number, profile: InstrumentProfile): TabCandidate[] {
  const roundedMidi = Math.round(midi);
  if (!Number.isFinite(roundedMidi) || roundedMidi < 0 || roundedMidi > 127) {
    return [];
  }

  const candidates: TabCandidate[] = [];
  for (let i = 0; i < profile.tuning.length; i++) {
    const fret = roundedMidi - profile.tuning[i];
    if (fret < 0 || fret > profile.maxFret) continue;

    candidates.push({
      midi: roundedMidi,
      fret,
      stringIndex: i,
      string: profile.tuning.length - i,
    });
  }

  return candidates.sort((a, b) => {
    if (a.fret !== b.fret) return a.fret - b.fret;
    return a.string - b.string;
  });
}

export function pickCandidateBeginnerOpen(candidates: TabCandidate[], prev: TabPosition | null) {
  if (!candidates.length) return null;

  const sorted = sortCandidatesWithScore(candidates, (candidate) => scoreBeginnerOpen(candidate, prev));
  return sorted[0];
}

export function pickCandidateSmoothMotion(
  candidates: TabCandidate[],
  prev: TabPosition | null,
  state: MappingState,
) {
  if (!candidates.length) return null;

  const sorted = sortCandidatesWithScore(candidates, (candidate) => scoreSmoothMotion(candidate, prev, state));
  return sorted[0];
}

function pickSingleNote(
  midi: number,
  profile: InstrumentProfile,
  policy: MappingPolicy,
  state: MappingState,
) {
  const candidates = getTabCandidatesForMidi(midi, profile);
  if (candidates.length === 0) {
    return createUnresolvedPosition(midi, "out_of_range");
  }

  const picked =
    policy === "smooth_motion"
      ? pickCandidateSmoothMotion(candidates, state.lastResolved, state)
      : pickCandidateBeginnerOpen(candidates, state.lastResolved);

  if (!picked) {
    return createUnresolvedPosition(midi, "no_candidate_after_policy", candidates);
  }

  return {
    ...toTabPosition(picked),
    candidateCount: candidates.length,
    candidates: candidates.map((candidate) => ({ string: candidate.string, fret: candidate.fret })),
  };
}

function scoreByPolicy(
  candidate: TabCandidate,
  policy: MappingPolicy,
  prev: TabPosition | null,
  state: MappingState,
) {
  if (policy === "smooth_motion") {
    return scoreSmoothMotion(candidate, prev, state);
  }
  return scoreBeginnerOpen(candidate, prev);
}

function pickChordWithBacktracking(
  notes: number[],
  profile: InstrumentProfile,
  policy: MappingPolicy,
  state: MappingState,
) {
  const inputs = notes.map((midi, noteIndex) => ({
    noteIndex,
    midi,
    candidates: getTabCandidatesForMidi(midi, profile),
  }));

  const ordered = [...inputs].sort((a, b) => {
    if (a.candidates.length !== b.candidates.length) return a.candidates.length - b.candidates.length;
    return a.midi - b.midi;
  });

  let best:
    | {
        assigned: Map<number, TabCandidate>;
        unresolved: number;
        score: number;
      }
    | null = null;

  const MAX_NODES = 5000;
  let visited = 0;

  const search = (
    index: number,
    usedStrings: Set<number>,
    assigned: Map<number, TabCandidate>,
    unresolved: number,
    score: number,
  ) => {
    if (visited++ > MAX_NODES) return;

    if (best && unresolved > best.unresolved) return;

    if (index >= ordered.length) {
      if (
        !best ||
        unresolved < best.unresolved ||
        (unresolved === best.unresolved && score < best.score)
      ) {
        best = {
          assigned: new Map(assigned),
          unresolved,
          score,
        };
      }
      return;
    }

    const current = ordered[index];
    const chordPrev = assigned.size
      ? toTabPosition([...assigned.values()][assigned.size - 1])
      : state.lastResolved;

    const available = current.candidates
      .filter((candidate) => !usedStrings.has(candidate.string))
      .sort((a, b) => {
        const sa = scoreByPolicy(a, policy, chordPrev, state);
        const sb = scoreByPolicy(b, policy, chordPrev, state);
        if (sa !== sb) return sa - sb;
        if (a.fret !== b.fret) return a.fret - b.fret;
        return a.string - b.string;
      });

    for (const candidate of available) {
      usedStrings.add(candidate.string);
      assigned.set(current.noteIndex, candidate);
      const candidateScore = scoreByPolicy(candidate, policy, chordPrev, state);
      search(index + 1, usedStrings, assigned, unresolved, score + candidateScore);
      assigned.delete(current.noteIndex);
      usedStrings.delete(candidate.string);
    }

    // Best-effort fallback for impossible chord shapes.
    search(index + 1, usedStrings, assigned, unresolved + 1, score + 60);
  };

  search(0, new Set<number>(), new Map<number, TabCandidate>(), 0, 0);

  const bestAssigned = best?.assigned ?? new Map<number, TabCandidate>();

  return notes.map((midi, noteIndex) => {
    const chosen = bestAssigned.get(noteIndex);
    const candidates = inputs[noteIndex].candidates;

    if (!chosen) {
      return createUnresolvedPosition(
        midi,
        candidates.length === 0 ? "out_of_range" : "chord_constraint",
        candidates,
      );
    }

    return {
      ...toTabPosition(chosen),
      candidateCount: candidates.length,
      candidates: candidates.map((candidate) => ({ string: candidate.string, fret: candidate.fret })),
    };
  });
}

function authoredTabToPositions(
  event: ChartEventLike,
  profile: InstrumentProfile,
) {
  const notes = event.notes.map((note) => Math.round(note));

  if (!Array.isArray(event.tab) || event.tab.length !== notes.length) {
    return notes.map((midi) => createUnresolvedPosition(midi, "missing_authored_tab"));
  }

  return notes.map((midi, idx) => {
    const authored = event.tab?.[idx];
    const string = Math.round(Number(authored?.string));
    const fret = Math.round(Number(authored?.fret));

    if (!Number.isFinite(string) || !Number.isFinite(fret)) {
      return createUnresolvedPosition(midi, "invalid_authored_tab");
    }

    if (string < 1 || string > profile.tuning.length || fret < 0 || fret > profile.maxFret) {
      return createUnresolvedPosition(midi, "authored_out_of_range");
    }
    const tuningIndex = profile.tuning.length - string;
    const expectedMidi = profile.tuning[tuningIndex] + fret;

    return {
      midi,
      string,
      fret,
      reason: expectedMidi === midi ? "exact_authored" : `authored_pitch_mismatch(expected=${expectedMidi})`,
      candidateCount: 1,
      candidates: [{ string, fret }],
    };
  });
}

export function resolveEventToTab(
  event: ChartEventLike,
  profile: InstrumentProfile,
  policy: MappingPolicy,
  prevState: MappingState,
): { computed: ComputedTabEvent; nextState: MappingState } {
  // IMPORTANT: TAB mapping always uses raw chart MIDI notes directly.
  // Staff preview may transpose for notation readability; TAB must not.
  const normalizedNotes = event.notes
    .map((note) => Math.round(note))
    .filter((note) => Number.isFinite(note) && note >= 0 && note <= 127);

  let resolvedTab: TabPosition[] = [];
  if (policy === "exact_authored") {
    resolvedTab = authoredTabToPositions({ ...event, notes: normalizedNotes }, profile);
  } else if (normalizedNotes.length <= 1) {
    resolvedTab = normalizedNotes.map((midi) => pickSingleNote(midi, profile, policy, prevState));
  } else {
    resolvedTab = pickChordWithBacktracking(normalizedNotes, profile, policy, prevState);
  }

  const unresolvedCount = resolvedTab.filter((position) => position.unresolved).length;
  const resolved = resolvedTab.filter((position) => !position.unresolved);

  let nextState = prevState;
  if (resolved.length > 0) {
    const avgFret = resolved.reduce((sum, position) => sum + position.fret, 0) / resolved.length;
    nextState = {
      lastResolved: resolved[resolved.length - 1],
      phraseFretCenter:
        prevState.phraseFretCenter === null
          ? avgFret
          : prevState.phraseFretCenter * 0.7 + avgFret * 0.3,
    };
  }

  return {
    computed: {
      timeMs: event.timeMs,
      durationMs: event.durationMs,
      notes: normalizedNotes,
      velocity: event.velocity,
      tab: event.tab,
      resolvedTab,
      unresolvedCount,
      mappingPolicy: policy,
    },
    nextState,
  };
}

export function computeTabAssignments(
  chart: ChartLike,
  profile: InstrumentProfile,
  policy: MappingPolicy,
): ComputedTabEvent[] {
  const events = [...chart.events].sort((a, b) => a.timeMs - b.timeMs);
  let state: MappingState = {
    lastResolved: null,
    phraseFretCenter: null,
  };

  return events.map((event) => {
    const { computed, nextState } = resolveEventToTab(event, profile, policy, state);
    state = nextState;
    return computed;
  });
}
