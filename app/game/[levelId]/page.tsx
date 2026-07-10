// app/game/[levelId]/page.tsx
"use client";

import React, { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { computePreviewWindow } from "./preview/window";
import {
  computeTabAssignments,
  mappingPolicyLabel,
  resolveInstrumentProfile,
} from "./preview/tabMapping";
import type {
  ComputedTabEvent,
  InstrumentOverride,
  InstrumentProfile,
  MappingPolicy,
} from "./preview/types";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ChartEvent = {
  timeMs: number;
  durationMs: number;
  notes: number[];
  velocity?: number;
  tab?: { string: number; fret: number }[];
  _scored?: boolean;
};

type Chart = {
  id: string;
  title: string;
  audioUrl: string;
  fullMixAudioUrl?: string;
  analysisAudioUrl?: string;
  stemAudioUrl?: string;
  analysisStem?: string;
  analysisToPlaybackOffsetMs?: number;
  analysisFirstActivityMs?: number;
  offsetMs: number;
  bpmHint?: number | null;
  instrument?: {
    type?: string;
    tuning?: number[];
    maxFret?: number;
    strings?: number;
  };
  events: ChartEvent[];
};

type PlaybackSource = "full_mix" | "analysis";

type NoteResult = "HIT" | "MISS";
type PreviewMode = "tab" | "staff" | "grid" | "off";

type ScoredNote = {
  event: ChartEvent;
  result: NoteResult;
  detectedHz?: number;
};

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const HIT_WINDOW_MS        = 150;
const SUSTAIN_EXTEND_MS    = 0;
const PITCH_TOLERANCE_CENTS = 50;
const MIN_RMS              = 0.012;
const PITCH_HISTORY_SIZE   = 7;
const PITCH_POLL_MS        = 33;
const UI_POLL_MS           = 50;

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function midiToHz(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function midiToName(m: number) {
  const names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  return `${names[m % 12]}${Math.floor(m / 12) - 1}`;
}

function centsDistance(hzA: number, hzB: number) {
  const cents = 1200 * Math.log2(hzA / hzB);
  const wrapped = ((cents + 600) % 1200) - 600;
  return Math.abs(wrapped);
}

function pitchMatchesRobust(hzDetected: number, hzExpected: number, tolCents: number) {
  const candidates = [
    hzDetected,
    hzDetected / 2,
    hzDetected / 3,
    hzDetected / 4,
    hzDetected * 2,
  ];
  const best = Math.min(...candidates.map((h) => centsDistance(h, hzExpected)));
  return best <= tolCents;
}

function getRms(buf: Float32Array<ArrayBuffer>) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function autoCorrelate(buf: Float32Array<ArrayBuffer>, sampleRate: number): number | null {
  if (getRms(buf) < MIN_RMS) return null;

  let mean = 0;
  for (let i = 0; i < buf.length; i++) mean += buf[i];
  mean /= buf.length;

  const SIZE = buf.length;
  const maxLag = Math.floor(sampleRate / 35);
  const minLag = Math.floor(sampleRate / 1200);

  let bestLag = -1, bestCorr = 0;
  for (let lag = minLag; lag <= Math.min(maxLag, SIZE - 1); lag++) {
    let corr = 0, n1 = 0, n2 = 0;
    for (let i = 0; i < SIZE - lag; i++) {
      const a = buf[i] - mean;
      const b = buf[i + lag] - mean;
      corr += a * b;
      n1 += a * a;
      n2 += b * b;
    }
    corr /= Math.sqrt(n1 * n2) + 1e-12;
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }

  if (bestLag === -1 || bestCorr < 0.45) return null;
  return sampleRate / bestLag;
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg, border: "none", borderRadius: 8,
    padding: "10px 20px", color: "#fff", fontWeight: 700,
    fontSize: 14, cursor: "pointer", fontFamily: "inherit", letterSpacing: 1,
  };
}

function getGrade(accuracy: number): { letter: string; color: string; glow: string } {
  if (accuracy === 100) return { letter: "S", color: "#facc15", glow: "#facc15" };
  if (accuracy >= 90)  return { letter: "A", color: "#22c55e", glow: "#22c55e" };
  if (accuracy >= 75)  return { letter: "B", color: "#60a5fa", glow: "#60a5fa" };
  if (accuracy >= 60)  return { letter: "C", color: "#f97316", glow: "#f97316" };
  return { letter: "D", color: "#ef4444", glow: "#ef4444" };
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function resolvePlaybackUrls(chart: Chart) {
  const fullMixAudioUrl = chart.fullMixAudioUrl ?? chart.audioUrl;
  const analysisAudioUrl = chart.analysisAudioUrl ?? chart.stemAudioUrl ?? chart.audioUrl;
  return {
    fullMixAudioUrl: fullMixAudioUrl || "",
    analysisAudioUrl: analysisAudioUrl || "",
  };
}

function toAnalysisTimelineMs(playbackMs: number, source: PlaybackSource, chart: Chart) {
  const alignment = chart.analysisToPlaybackOffsetMs ?? 0;
  if (source === "full_mix") {
    return playbackMs + alignment;
  }
  return playbackMs;
}

function fromAnalysisTimelineMs(analysisMs: number, source: PlaybackSource, chart: Chart) {
  const alignment = chart.analysisToPlaybackOffsetMs ?? 0;
  if (source === "full_mix") {
    return analysisMs - alignment;
  }
  return analysisMs;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lowerBoundEventIndex(events: ChartEvent[], targetMs: number) {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].timeMs < targetMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function getVisibleEventsInWindow<T extends ChartEvent>(
  events: T[],
  startMs: number,
  endMs: number,
  cap = 96,
) {
  const startIdx = lowerBoundEventIndex(events, startMs);
  const out: T[] = [];
  for (let i = startIdx; i < events.length; i++) {
    const ev = events[i];
    if (ev.timeMs > endMs) break;
    out.push(ev);
    if (out.length >= cap) break;
  }
  return out;
}

// â”€â”€â”€ Results Screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ResultsScreen({
  chart,
  score,
  maxCombo,
  hits,
  misses,
  accuracy,
  scoredNotes,
  onRestart,
}: {
  chart: Chart;
  score: number;
  maxCombo: number;
  hits: number;
  misses: number;
  accuracy: number;
  scoredNotes: ScoredNote[];
  onRestart: () => void;
}) {
  const grade = getGrade(accuracy);
  const total = hits + misses;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.92)",
      backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200,
      fontFamily: "'Courier New', monospace",
      animation: "fadeIn 0.2s ease-out",
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes gradeAppear { 0% { transform: scale(0.3) rotate(-15deg); opacity: 0; } 70% { transform: scale(1.15) rotate(3deg); } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
        @keyframes shimmer { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>

      <div style={{
        background: "#0d1117",
        border: "1px solid #1f2937",
        borderRadius: 16,
        padding: "48px 56px",
        minWidth: 520,
        maxWidth: 640,
        width: "90vw",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Glow accent top */}
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 200, height: 2, background: `linear-gradient(90deg, transparent, ${grade.glow}, transparent)`,
          borderRadius: 2,
        }} />

        {/* Song name */}
        <div style={{ fontSize: 11, color: "#4b5563", letterSpacing: 3, marginBottom: 6, textTransform: "uppercase" }}>
          RESULTS
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0", marginBottom: 32, letterSpacing: 1 }}>
          {chart.title}
        </div>

        {/* Grade + Score row */}
        <div style={{ display: "flex", alignItems: "center", gap: 32, marginBottom: 36 }}>
          <div style={{
            fontSize: 96, fontWeight: 900, lineHeight: 1,
            color: grade.color,
            textShadow: `0 0 60px ${grade.glow}80, 0 0 20px ${grade.glow}60`,
            animation: "gradeAppear 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both",
          }}>
            {grade.letter}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#6b7280", letterSpacing: 2, marginBottom: 4 }}>FINAL SCORE</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: "#facc15", letterSpacing: 1 }}>
              {score.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>
              MAX COMBO <span style={{ color: "#60a5fa" }}>Ã—{maxCombo}</span>
            </div>
          </div>
        </div>

        {/* Accuracy bar */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#6b7280", letterSpacing: 2 }}>ACCURACY</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: grade.color }}>{accuracy}%</span>
          </div>
          <div style={{ height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${accuracy}%`,
              background: `linear-gradient(90deg, ${grade.color}80, ${grade.color})`,
              borderRadius: 3,
              transition: "width 1s ease-out",
            }} />
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
          {[
            { label: "HITS",       value: hits,              color: "#22c55e", bg: "#14532d", border: "#166534" },
            { label: "MISSES",     value: misses,            color: "#ef4444", bg: "#7f1d1d", border: "#991b1b" },
            { label: "TOTAL NOTES", value: total,            color: "#f0f0f0", bg: "#111827", border: "#1f2937" },
            { label: "HIT RATE",   value: `${accuracy}%`,   color: grade.color, bg: "#111827", border: "#1f2937" },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} style={{
              background: bg, border: `1px solid ${border}`, borderRadius: 8,
              padding: "12px 16px",
            }}>
              <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 2, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Note breakdown (last 16) */}
        {scoredNotes.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: 2, marginBottom: 8 }}>NOTE BREAKDOWN</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {scoredNotes.map((n, i) => (
                <div key={i} title={midiToName(n.event.notes[0])} style={{
                  width: 28, height: 28, borderRadius: 4,
                  background: n.result === "HIT" ? "#14532d" : "#7f1d1d",
                  border: `1px solid ${n.result === "HIT" ? "#166534" : "#991b1b"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700,
                  color: n.result === "HIT" ? "#22c55e" : "#ef4444",
                }}>
                  {midiToName(n.event.notes[0]).replace(/[0-9]/g, "")}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onRestart}
            style={{
              ...btnStyle("#22c55e"),
              flex: 1, fontSize: 16, padding: "14px 0",
              letterSpacing: 2,
            }}
          >
            â†º PLAY AGAIN
          </button>
          <Link href="/" style={{
            ...btnStyle("#374151"),
            flex: 1, fontSize: 14, padding: "14px 0",
            letterSpacing: 2, textDecoration: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            â† SONG SELECT
          </Link>
        </div>
      </div>
    </div>
  );
}
function MeasurePreview({
  chart,
  songTimeMs,
  windowMeasures = 2,
  beatsPerMeasure = 4,
}: {
  chart: Chart;
  songTimeMs: number;
  windowMeasures?: number;
  beatsPerMeasure?: number;
}) {
  const { bpm, startMs, endMs, windowMs, measureStartIndex, nowPct, ticks } = useMemo(
    () =>
      computePreviewWindow({
        bpmHint: chart.bpmHint,
        songTimeMs,
        beatsPerMeasure,
        windowMeasures,
      }),
    [chart.bpmHint, songTimeMs, beatsPerMeasure, windowMeasures],
  );

  // Grab events that fall inside the preview window
  const visibleEvents = useMemo(() => {
    return getVisibleEventsInWindow(chart.events, startMs, endMs, 96);
  }, [chart.events, startMs, endMs]);

  return (
    <div
      style={{
        background: "#111827",
        border: "1px solid #1f2937",
        borderRadius: 8,
        padding: "14px 16px",
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 2 }}>
          {bpm ? "UPCOMING MEASURES" : "UPCOMING NOTES"}
        </div>
        <div style={{ fontSize: 11, color: "#4b5563" }}>
          {bpm
            ? `Measure ${((measureStartIndex ?? 0) + 1)} â†’ ${((measureStartIndex ?? 0) + windowMeasures)} Â· ${Math.round(bpm)} BPM`
            : "BPM unknown Â· showing 4s window"}
        </div>
      </div>

      <div
        style={{
          position: "relative",
          height: 78,
          borderRadius: 8,
          background: "#0a0a0f",
          border: "1px solid #374151",
          overflow: "hidden",
        }}
      >
        {/* Beat/measure ticks */}
        {ticks.map((t, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${t.pct}%`,
              top: 0,
              bottom: 0,
              width: t.strong ? 2 : 1,
              background: t.strong ? "#374151" : "#1f2937",
              opacity: t.strong ? 0.8 : 0.7,
            }}
          />
        ))}

        {/* Notes (events) */}
        {visibleEvents.map((ev, i) => {
          const pct = ((ev.timeMs - startMs) / windowMs) * 100;
          const isLabeled = i < 10; // label only first few to avoid clutter
          const noteName = midiToName(ev.notes[0]);
          const sustainPct =
            ev.durationMs > 0 ? Math.min(100 - pct, (ev.durationMs / windowMs) * 100) : 0;

          return (
            <div key={`${ev.timeMs}-${i}`} style={{ position: "absolute", left: `${pct}%`, top: 0, bottom: 0 }}>
              {/* sustain bar */}
              {sustainPct > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 42,
                    height: 6,
                    width: `${sustainPct}%`,
                    background: "#60a5fa33",
                    border: "1px solid #60a5fa55",
                    borderRadius: 999,
                  }}
                />
              )}

              {/* note marker */}
              <div
                title={`${noteName} @ ${Math.round(ev.timeMs)}ms`}
                style={{
                  position: "absolute",
                  left: -1,
                  top: 14,
                  width: 2,
                  height: 46,
                  background: "#60a5fa",
                  boxShadow: "0 0 10px #60a5fa66",
                  borderRadius: 2,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: -4,
                  top: 10,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#60a5fa",
                  boxShadow: "0 0 12px #60a5fa66",
                }}
              />

              {/* label */}
              {isLabeled && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 8,
                    fontSize: 10,
                    color: "#9ca3af",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                  }}
                >
                  {noteName}
                </div>
              )}
            </div>
          );
        })}

        {/* NOW playhead */}
        <div
          style={{
            position: "absolute",
            left: `${nowPct}%`,
            top: 0,
            bottom: 0,
            width: 2,
            background: "#facc15",
            boxShadow: "0 0 18px #facc1580, 0 0 40px #facc1540",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${nowPct}%`,
            top: 0,
            transform: "translateX(-50%)",
            padding: "2px 6px",
            fontSize: 10,
            color: "#111827",
            background: "#facc15",
            borderRadius: 6,
            fontWeight: 800,
            letterSpacing: 1,
          }}
        >
          NOW
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#4b5563", marginTop: 8 }}>
        Tip: if the grid feels &quot;off&quot;, make sure your chart JSON has a reasonable <code>bpmHint</code>.
      </div>
    </div>
  );
}


function TabPreview({
  events,
  bpmHint,
  songTimeMs,
  instrumentProfile,
  mappingPolicy,
  unresolvedVisibleCount,
  windowMeasures = 2,
  beatsPerMeasure = 4,
}: {
  events: ComputedTabEvent[];
  bpmHint?: number | null;
  songTimeMs: number;
  instrumentProfile: InstrumentProfile;
  mappingPolicy: MappingPolicy;
  unresolvedVisibleCount: number;
  windowMeasures?: number;
  beatsPerMeasure?: number;
}) {
  const { bpm, startMs, endMs, windowMs, measureStartIndex, nowPct, ticks } = useMemo(
    () =>
      computePreviewWindow({
        bpmHint,
        songTimeMs,
        beatsPerMeasure,
        windowMeasures,
      }),
    [bpmHint, songTimeMs, beatsPerMeasure, windowMeasures],
  );

  const visibleEvents = useMemo(
    () => getVisibleEventsInWindow(events, startMs, endMs, 96),
    [events, startMs, endMs],
  );
  const policyLabel = mappingPolicyLabel(mappingPolicy);
  const tuningLabel = instrumentProfile.displayStrings.join("");

  const stringCount = instrumentProfile.tuning.length;
  const rowGap = stringCount <= 4 ? 28 : 22;
  const lineTop = 42;
  const lineBottom = lineTop + (stringCount - 1) * rowGap;
  const plotTop = 16;
  const plotBottom = lineBottom + 18;
  const svgWidth = 1040;
  const svgHeight = plotBottom + 26;
  const leftPad = 68;
  const rightPad = 22;
  const plotWidth = svgWidth - leftPad - rightPad;
  const nowX = leftPad + (nowPct / 100) * plotWidth;

  const stringYs = useMemo(
    () => Array.from({ length: stringCount }, (_, idx) => lineTop + idx * rowGap),
    [lineTop, rowGap, stringCount],
  );

  const noteLayers = useMemo(() => {
    const sustains: React.ReactNode[] = [];
    const chips: React.ReactNode[] = [];

    visibleEvents.forEach((event, eventIndex) => {
      const onsetPct = clampNumber((event.timeMs - startMs) / windowMs, 0, 1);
      const x = leftPad + onsetPct * plotWidth;
      const sustainWidth =
        event.durationMs > 0
          ? clampNumber((event.durationMs / windowMs) * plotWidth, 0, plotWidth - (x - leftPad))
          : 0;
      const resolved =
        event.resolvedTab && event.resolvedTab.length > 0
          ? event.resolvedTab
          : event.notes.map((midi) => ({ midi, string: 1, fret: 0, unresolved: true }));

      resolved.forEach((tabNote, noteIndex) => {
        const unresolved =
          !!tabNote.unresolved ||
          tabNote.string < 1 ||
          tabNote.string > stringCount ||
          tabNote.fret < 0 ||
          tabNote.fret > instrumentProfile.maxFret;

        const y = unresolved
          ? lineTop - 16 - (noteIndex % 3) * 14
          : stringYs[tabNote.string - 1];
        const label = unresolved ? "?" : `${tabNote.fret}`;
        const chipW = clampNumber(14 + label.length * 7, 16, 36);
        const chipH = 16;
        const chipX = x - chipW / 2 + ((noteIndex % 2 === 0) ? -1.5 : 1.5);
        const chipY = y - chipH / 2;
        const candidateLabel = tabNote.candidates
          ? tabNote.candidates.map((candidate) => `S${candidate.string}F${candidate.fret}`).join(", ")
          : "n/a";
        const noteTitle = `${unresolved ? "Unresolved" : `S${tabNote.string} F${tabNote.fret}`} (${midiToName(tabNote.midi)}) · reason=${tabNote.reason ?? "mapped"} · candidates=${candidateLabel}`;

        if (sustainWidth > 3) {
          sustains.push(
            <line
              key={`sus-${event.timeMs}-${eventIndex}-${noteIndex}`}
              x1={x + chipW * 0.45}
              x2={x + sustainWidth}
              y1={y}
              y2={y}
              stroke={unresolved ? "#991b1b" : "#2563eb"}
              strokeOpacity={unresolved ? 0.7 : 0.78}
              strokeWidth={3}
              strokeLinecap="round"
            />,
          );
        }

        chips.push(
          <g key={`chip-${event.timeMs}-${eventIndex}-${noteIndex}`}>
            <title>{`${noteTitle} @ ${Math.round(event.timeMs)}ms`}</title>
            <rect
              x={chipX}
              y={chipY}
              width={chipW}
              height={chipH}
              rx={4}
              ry={4}
              fill={unresolved ? "#7f1d1d" : "#1d4ed8"}
              stroke={unresolved ? "#ef4444" : "#93c5fd"}
              strokeWidth={1}
            />
            <text
              x={x}
              y={chipY + chipH / 2 + 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill={unresolved ? "#fecaca" : "#dbeafe"}
            >
              {label}
            </text>
          </g>,
        );
      });
    });

    return { sustains, chips };
  }, [
    visibleEvents,
    startMs,
    windowMs,
    leftPad,
    plotWidth,
    lineTop,
    instrumentProfile.maxFret,
    stringCount,
    stringYs,
  ]);

  return (
    <div
      style={{
        background: "#111827",
        border: "1px solid #1f2937",
        borderRadius: 8,
        padding: "12px 12px 10px",
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5, gap: 12 }}>
        <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 2 }}>
          UPCOMING TAB ({instrumentProfile.label})
        </div>
        <div style={{ fontSize: 11, color: "#4b5563" }}>
          {bpm
            ? `Measure ${((measureStartIndex ?? 0) + 1)} -> ${((measureStartIndex ?? 0) + windowMeasures)} · ${Math.round(bpm)} BPM`
            : "BPM unknown Â· showing 4s window"}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: "#64748b" }}>
          Tuning {tuningLabel} · Policy {policyLabel}
        </div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: 1.4,
            borderRadius: 999,
            padding: "2px 8px",
            border: `1px solid ${unresolvedVisibleCount === 0 ? "#166534" : "#991b1b"}`,
            color: unresolvedVisibleCount === 0 ? "#22c55e" : "#fca5a5",
            background: unresolvedVisibleCount === 0 ? "#14532d" : "#7f1d1d",
          }}
        >
          {unresolvedVisibleCount === 0 ? "OK" : `${unresolvedVisibleCount} unresolved`}
        </div>
      </div>

      <div
        style={{
          position: "relative",
          borderRadius: 8,
          border: "1px solid #374151",
          background: "linear-gradient(180deg, #0b1020 0%, #080b14 100%)",
          overflow: "hidden",
        }}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width="100%"
          height={svgHeight}
          role="img"
          aria-label="Tablature preview"
        >
          <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="transparent" />

          {ticks.map((tick, idx) => {
            const x = leftPad + (tick.pct / 100) * plotWidth;
            return (
              <line
                key={`tick-${idx}`}
                x1={x}
                x2={x}
                y1={plotTop}
                y2={plotBottom}
                stroke={tick.strong ? "#334155" : "#1f2937"}
                strokeWidth={tick.strong ? 2 : 1}
                opacity={tick.strong ? 0.9 : 0.8}
              />
            );
          })}

          {stringYs.map((y, idx) => {
            const stringNumber = idx + 1;
            const tuningMidi = instrumentProfile.tuning[stringCount - stringNumber];
            const laneLabel = instrumentProfile.displayStrings[idx] ?? `S${stringNumber}`;
            return (
              <g key={`string-${stringNumber}`}>
                <text x={10} y={y + 4} fontSize={11} fill="#94a3b8">
                  {laneLabel}
                </text>
                <line x1={leftPad} x2={leftPad + plotWidth} y1={y} y2={y} stroke="#64748b" strokeWidth={1.2} />
                <text x={leftPad + plotWidth + 6} y={y + 4} fontSize={10} fill="#475569">
                  {midiToName(tuningMidi)}
                </text>
              </g>
            );
          })}

          {noteLayers.sustains}
          {noteLayers.chips}

          <line
            x1={nowX}
            x2={nowX}
            y1={plotTop}
            y2={plotBottom}
            stroke="#facc15"
            strokeWidth={2}
            opacity={0.95}
          />
          <rect x={nowX - 18} y={2} width={36} height={14} rx={5} ry={5} fill="#facc15" />
          <text x={nowX} y={12} textAnchor="middle" fontSize={9} fontWeight={800} fill="#111827">
            NOW
          </text>
        </svg>
      </div>

      <div style={{ fontSize: 11, color: "#4b5563", marginTop: 8 }}>
        Tab preview is generated from chart MIDI + tuning ({tuningLabel}) using {policyLabel} mapping.
      </div>
    </div>
  );
}


function midiToVexKey(m: number) {
  const names = ["c","c#","d","d#","e","f","f#","g","g#","a","a#","b"];
  const name = names[m % 12];
  const octave = Math.floor(m / 12) - 1;
  return `${name}/${octave}`;
}

function accidentalForKey(key: string): "#" | "b" | null {
  if (key.includes("#")) return "#";
  // (If you later generate flats, handle "b" here.)
  return null;
}

export function StaffPreview({
  chart,
  songTimeMs,
  measuresToShow = 2,
  beatsPerMeasure = 4,
  beatValue = 4,
  subdivisionPerBeat = 4, // 4 => 16th notes in 4/4
}: {
  chart: Chart;
  songTimeMs: number;
  measuresToShow?: number;
  beatsPerMeasure?: number;
  beatValue?: number;
  subdivisionPerBeat?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // We render the score only when the *current measure* changes.
  const bpm = chart.bpmHint ?? null;

  const beatMs = useMemo(() => (bpm ? 60000 / bpm : null), [bpm]);
  const measureMs = useMemo(
    () => (beatMs ? beatsPerMeasure * beatMs : null),
    [beatMs, beatsPerMeasure]
  );

  const slotMs = useMemo(() => {
    if (!beatMs) return null;
    return beatMs / subdivisionPerBeat;
  }, [beatMs, subdivisionPerBeat]);

  const currentMeasureIndex = useMemo(() => {
    if (!measureMs) return 0;
    return Math.floor(songTimeMs / measureMs);
  }, [songTimeMs, measureMs]);

  const startMeasureIndex = currentMeasureIndex;

  // Playhead positioning: we'll compute slot X positions from the rendered notes (first measure only).
  const slotXsRef = useRef<number[] | null>(null);
  const [playheadX, setPlayheadX] = useState<number | null>(null);

  // Update playhead without re-rendering the whole stave
  useEffect(() => {
    if (!measureMs || !slotMs) return;
    const xs = slotXsRef.current;
    if (!xs || xs.length < 2) return;

    const measureStartMs = startMeasureIndex * measureMs;
    const pos = (songTimeMs - measureStartMs) / slotMs; // slot units
    const i0 = Math.max(0, Math.min(xs.length - 1, Math.floor(pos)));
    const i1 = Math.max(0, Math.min(xs.length - 1, i0 + 1));
    const frac = Math.max(0, Math.min(1, pos - i0));

    const x = xs[i0] + (xs[i1] - xs[i0]) * frac;
    setPlayheadX(x);
  }, [songTimeMs, measureMs, slotMs, startMeasureIndex]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.innerHTML = "";

    if (!bpm || !beatMs || !measureMs || !slotMs) {
      el.innerHTML = `<div style="color:#9ca3af;font-family:monospace;font-size:12px;">
        Need <code>bpmHint</code> to render staff notation (so we can quantize).
      </div>`;
      return;
    }

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import("vexflow");
      const VF = mod.VexFlow ?? mod.default ?? mod;

      const { Renderer, Stave, Voice, Formatter, StaveNote, Accidental, GhostNote } = VF;

      // Layout
      const padding = 12;
      const measureW = 360;
      const height = 160;
      const width = measuresToShow * measureW + padding * 2;

      const renderer = new Renderer(el, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const ctx = renderer.getContext();

      // Choose clef based on rough range (optional but helps readability)
      // Bass track: force bass clef + display an octave up (written notation)
      const clef = "bass";
      const NOTATION_TRANSPOSE = 12;

      // Build measures as 16th-note slots (or whatever subdivisionPerBeat is)
      const slotsPerMeasure = beatsPerMeasure * subdivisionPerBeat;

      type VFTickable = { getAbsoluteX?: () => number }; // enough for playhead X capture

      const buildMeasureNotes = (measureIndex: number): { notes: VFTickable[] } => {
        const startMs = measureIndex * measureMs;
        const endMs = startMs + measureMs;

        const slots: number[][] = Array.from({ length: slotsPerMeasure }, () => []);

        for (const ev of chart.events) {
          if (ev.timeMs < startMs || ev.timeMs >= endMs) continue;
          const rel = ev.timeMs - startMs;

          // Quantize to grid (slightly bias earlier so it "feels" better)
          const slot = Math.floor((rel + slotMs * 0.25) / slotMs);
          const clamped = Math.max(0, Math.min(slotsPerMeasure - 1, slot));

          slots[clamped].push(ev.notes[0]);
        }

        const notes: VFTickable[] = slots.map((midiList) => {
          if (midiList.length === 0) {
            return new GhostNote({ duration: "16" }); // spacing, no visible rest
          }

          const keys = midiList
            .slice(0, 4)
            .sort((a, b) => a - b)
            .map((m) => midiToVexKey(m + NOTATION_TRANSPOSE));

          const n = new StaveNote({
            clef,
            keys,
            duration: "16", // internal spacing grid only (not visual duration)
          });

          // Color the notehead so it reads as a guide/onset marker
          n.setStyle?.({ fillStyle: "#93c5fd", strokeStyle: "#93c5fd" });

          // Hide rhythmic semantics (stem + flag) so users don't think it's true duration notation
          n.setStemStyle?.({ fillStyle: "transparent", strokeStyle: "transparent" });
          n.setFlagStyle?.({ fillStyle: "transparent", strokeStyle: "transparent" });

          keys.forEach((k, i) => {
            const acc = accidentalForKey(k);
            if (acc) {
              n.addModifier(new Accidental(acc), i);
            }
          });

          return n;
        });

        return { notes }; // âœ… MUST be inside the function
      };

      // Draw each measure as its own stave (barlines + ledger lines happen automatically)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const voices: any[] = [];
      for (let i = 0; i < measuresToShow; i++) {
        const measureIndex = startMeasureIndex + i;
        const x = padding + i * measureW;
        const y = 36;

        const stave = new Stave(x, y, measureW);

        if (i === 0) {
          stave.addClef(clef).addTimeSignature(`${beatsPerMeasure}/${beatValue}`);
        }
        stave.setContext(ctx).draw();

        const { notes } = buildMeasureNotes(measureIndex);

        const voice = new Voice({ num_beats: beatsPerMeasure, beat_value: beatValue });
        voice.addTickables(notes);

        new Formatter().joinVoices([voice]).formatToStave([voice], stave);
        voice.draw(ctx, stave);

        voices.push({ voice, stave, notes, isFirst: i === 0 });
      }

      // Capture X positions for each slot in the FIRST measure (for accurate playhead)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const first = voices.find((v: any) => v.isFirst);
      if (first) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const xs = first.notes.map((n: any) => n.getAbsoluteX()).filter((x: any) => typeof x === "number");
        slotXsRef.current = xs.length ? xs : null;
      } else {
        slotXsRef.current = null;
      }
    })();
  }, [
    bpm,
    beatMs,
    measureMs,
    slotMs,
    chart,
    measuresToShow,
    beatsPerMeasure,
    beatValue,
    subdivisionPerBeat,
    startMeasureIndex,
  ]);

  return (
    <div className={styles.staffPreview}>
      <div className={styles.staffHeader}>UPCOMING MEASURES (STAFF)</div>

      <div className={styles.relativeContainer}>
        {/* VexFlow renders into this div */}
        <div ref={containerRef} />

        {/* Playhead overlay */}
        {playheadX !== null && (
          <div
            className={styles.playhead}
            style={{ left: playheadX }}
          />
        )}
      </div>

      <div style={{ fontSize: 11, color: "#4b5563", marginTop: 8 }}>
        Readability requires quantization. If this looks &quot;off-beat&quot;, your <code>bpmHint</code> (or chart timings) don&apos;t match the audio.
      </div>
    </div>
  );
}
// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function GamePage({ params }: { params: Promise<{ levelId: string }> }) {
  const { levelId } = use(params);
  const { data: session } = useSession();

  
  const [chart,        setChart       ] = useState<Chart | null>(null);
  const [isPlaying,    setIsPlaying   ] = useState(false);
  const [micReady,     setMicReady    ] = useState(false);
  const [songTimeMs,   setSongTimeMs  ] = useState(0);
  const [songDurationMs, setSongDurationMs] = useState(0);
  const [score,        setScore       ] = useState(0);
  const [combo,        setCombo       ] = useState(0);
  const [maxCombo,     setMaxCombo    ] = useState(0);
  const [scoredNotes,  setScoredNotes ] = useState<ScoredNote[]>([]);
  const [detectedHz,   setDetectedHz  ] = useState<number | null>(null);
  const [feedback,     setFeedback    ] = useState<"HIT" | "MISS" | null>(null);
  const [audioInputs,  setAudioInputs ] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [inputLatencyMs, setInputLatencyMs] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [pitchHistoryCount, setPitchHistoryCount] = useState(0);
  const [gameOver,     setGameOver    ] = useState(false);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [playbackSource, setPlaybackSource] = useState<PlaybackSource>("full_mix");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("tab");
  const [instrumentOverride, setInstrumentOverride] = useState<InstrumentOverride>("auto");
  const [tabMappingPolicy, setTabMappingPolicy] = useState<MappingPolicy>("beginner_open");
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  // â”€â”€ NEW: volume state â”€â”€
  const [volume,       setVolume      ] = useState(1);
  const [isMuted,      setIsMuted     ] = useState(false);
  const prevVolumeRef = useRef(1); // remember volume before mute

  const audioRef         = useRef<HTMLAudioElement | null>(null);
  const rafRef           = useRef<number | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const micCtxRef    = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micFilterRef = useRef<BiquadFilterNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micBufRef    = useRef<Float32Array<ArrayBuffer>>(
    new Float32Array(4096) as Float32Array<ArrayBuffer>
  );

  const pitchHistoryRef = useRef<number[]>([]);
  const lastPitchPollRef = useRef(0);
  const lastUiUpdateRef  = useRef(0);

  const scoreRef    = useRef(0);
  const comboRef    = useRef(0);
  const maxComboRef = useRef(0);
  const scoredRef   = useRef<ScoredNote[]>([]);
  const nextIdxRef  = useRef(0);
  const playbackSourceRef = useRef<PlaybackSource>("full_mix");

  const inputLatencyMsRef = useRef(inputLatencyMs);
  useEffect(() => { inputLatencyMsRef.current = inputLatencyMs; }, [inputLatencyMs]);
  useEffect(() => { playbackSourceRef.current = playbackSource; }, [playbackSource]);

  // â”€â”€ Sync volume to audio element â”€â”€
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // â”€â”€ Load chart â”€â”€
  useEffect(() => {
    (async () => {
      let res = await fetch(`/api/charts/${levelId}`, { cache: "no-store" });
      if (!res.ok) {
        res = await fetch(`/charts/${levelId}.json`, { cache: "no-store" });
      }
      if (!res.ok) throw new Error(`Failed to load chart: ${res.status}`);
      const data: Chart = await res.json();
      if (!data.audioUrl || data.audioUrl.includes("REPLACE_ME")) {
        data.audioUrl = `/audio/${levelId}.mp3`;
      }
      if (!data.fullMixAudioUrl) {
        data.fullMixAudioUrl = data.audioUrl;
      }
      if (!data.analysisAudioUrl) {
        data.analysisAudioUrl = data.stemAudioUrl ?? data.audioUrl;
      }

      const playbackUrls = resolvePlaybackUrls(data);
      let defaultPlaybackSource: PlaybackSource = "full_mix";
      const notices: string[] = [];
      if (!playbackUrls.fullMixAudioUrl && playbackUrls.analysisAudioUrl) {
        defaultPlaybackSource = "analysis";
        notices.push("Full mix playback was unavailable, so analysis audio is active.");
      }
      if (
        data.analysisStem &&
        data.analysisAudioUrl &&
        playbackUrls.fullMixAudioUrl &&
        data.analysisAudioUrl === playbackUrls.fullMixAudioUrl
      ) {
        notices.push(`"${data.analysisStem}" stem was unavailable, so analysis fell back to full mix audio.`);
      }
      setPlaybackSource(defaultPlaybackSource);
      playbackSourceRef.current = defaultPlaybackSource;
      setPlaybackNotice(notices.length > 0 ? notices.join(" ") : null);
      data.events.forEach((e) => { e._scored = false; });
      setChart(data);
    })().catch(console.error);
  }, [levelId]);

  const playbackUrls = useMemo(() => {
    if (!chart) {
      return { fullMixAudioUrl: "", analysisAudioUrl: "" };
    }
    return resolvePlaybackUrls(chart);
  }, [chart]);

  const activePlaybackUrl = useMemo(() => {
    if (playbackSource === "analysis") {
      return playbackUrls.analysisAudioUrl || playbackUrls.fullMixAudioUrl;
    }
    return playbackUrls.fullMixAudioUrl || playbackUrls.analysisAudioUrl;
  }, [playbackSource, playbackUrls]);

  const instrumentProfile = useMemo(() => {
    if (!chart) return null;
    return resolveInstrumentProfile(chart, instrumentOverride);
  }, [chart, instrumentOverride]);

  const hasAuthoredTabData = useMemo(
    () => !!chart?.events.some((event) => Array.isArray(event.tab) && event.tab.length > 0),
    [chart],
  );

  const effectiveTabMappingPolicy = useMemo<MappingPolicy>(
    () =>
      !hasAuthoredTabData && tabMappingPolicy === "exact_authored"
        ? "beginner_open"
        : tabMappingPolicy,
    [hasAuthoredTabData, tabMappingPolicy],
  );

  const computedTabEvents = useMemo<ComputedTabEvent[] | null>(() => {
    if (!chart || !instrumentProfile) return null;
    return computeTabAssignments(chart, instrumentProfile, effectiveTabMappingPolicy);
  }, [chart, instrumentProfile, effectiveTabMappingPolicy]);

  const tabStatusWindow = useMemo(
    () =>
      computePreviewWindow({
        bpmHint: chart?.bpmHint,
        songTimeMs,
        beatsPerMeasure: 4,
        windowMeasures: 2,
      }),
    [chart?.bpmHint, songTimeMs],
  );

  const visibleComputedTabEvents = useMemo(
    () =>
      computedTabEvents
        ? getVisibleEventsInWindow(computedTabEvents, tabStatusWindow.startMs, tabStatusWindow.endMs, 96)
        : [],
    [computedTabEvents, tabStatusWindow.startMs, tabStatusWindow.endMs],
  );

  const unresolvedVisibleCount = useMemo(
    () => visibleComputedTabEvents.reduce((sum, event) => sum + event.unresolvedCount, 0),
    [visibleComputedTabEvents],
  );

  // â”€â”€ Enumerate audio inputs â”€â”€
  const refreshAudioInputs = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    const inputs = all.filter((d) => d.kind === "audioinput");
    setAudioInputs(inputs);
    setSelectedDeviceId((prev) => prev || inputs[0]?.deviceId || "");
  }, []);

  useEffect(() => {
    void (async () => { await refreshAudioInputs(); })();
    const handler = () => void (async () => { await refreshAudioInputs(); })();
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => { navigator.mediaDevices?.removeEventListener?.("devicechange", handler); };
  }, [refreshAudioInputs]);

  // â”€â”€ Clean up mic â”€â”€
  const stopPlayback = useCallback(
    (options?: { resetTime?: boolean; clearSource?: boolean; updateState?: boolean }) => {
      const audio = audioRef.current;
      const resetTime = options?.resetTime ?? true;
      const clearSource = options?.clearSource ?? false;
      const updateState = options?.updateState ?? true;

      if (audio) {
        audio.pause();
        if (resetTime) {
          audio.currentTime = 0;
        }
        if (clearSource) {
          audio.removeAttribute("src");
          audio.load();
        }
      }

      if (updateState) {
        setIsPlaying(false);
        if (resetTime) {
          setSongTimeMs(0);
        }
        if (clearSource) {
          setSongDurationMs(0);
        }
      }
    },
    [],
  );

  const stopMic = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    try {
      micSourceRef.current?.disconnect();
    } catch {
      // no-op
    }
    try {
      micFilterRef.current?.disconnect();
    } catch {
      // no-op
    }
    try {
      analyserRef.current?.disconnect();
    } catch {
      // no-op
    }
    micSourceRef.current = null;
    micFilterRef.current = null;
    analyserRef.current  = null;
    const ctx = micCtxRef.current;
    micCtxRef.current = null;
    if (ctx) ctx.close().catch(() => {});
    setMicReady(false);
  }, []);

  useEffect(() => {
    return () => {
      stopPlayback({ resetTime: true, clearSource: true, updateState: false });
      stopMic();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [stopMic, stopPlayback]);

  useEffect(() => {
    const handlePageHide = () => {
      stopPlayback({ resetTime: true, updateState: true });
      stopMic();
    };
    const handlePopState = () => {
      stopPlayback({ resetTime: true, updateState: true });
      stopMic();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopPlayback({ resetTime: false, updateState: true });
        stopMic();
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [stopMic, stopPlayback]);

  // â”€â”€ Init mic â”€â”€
  const initMic = useCallback(async () => {
    try {
      if (audioInputs.length === 0) await refreshAudioInputs();
      stopMic();

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const ctx    = new AudioContext({ latencyHint: "interactive" });
      const source = ctx.createMediaStreamSource(stream);

      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 20;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;

      source.connect(hp);
      hp.connect(analyser);

      micStreamRef.current = stream;
      micCtxRef.current    = ctx;
      micSourceRef.current = source;
      micFilterRef.current = hp;
      analyserRef.current  = analyser;
      pitchHistoryRef.current = [];
      micBufRef.current = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>;

      setMicReady(true);
      await refreshAudioInputs();
    } catch (e) {
      console.error("Mic init failed", e);
      alert(
        "Could not access the selected audio input.\n\n" +
        "Tips:\nâ€¢ Open http://localhost:3000\nâ€¢ Allow mic permission\nâ€¢ Pick your USB interface"
      );
    }
  }, [audioInputs.length, refreshAudioInputs, selectedDeviceId, stopMic]);

  // â”€â”€ Feedback flash â”€â”€
  const showFeedback = useCallback((type: "HIT" | "MISS") => {
    setFeedback(type);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 400);
  }, []);

  // â”€â”€ Main game loop â”€â”€
  useEffect(() => {
    if (!chart) return;

    const tick = (now: number) => {
      const audio    = audioRef.current;
      const analyser = analyserRef.current;
      const micCtx   = micCtxRef.current;

      if (audio) {
        const playbackMs = audio.currentTime * 1000;
        const analysisTimelineMs = toAnalysisTimelineMs(playbackMs, playbackSourceRef.current, chart);
        const tRawMs  = analysisTimelineMs - (chart.offsetMs ?? 0) - inputLatencyMsRef.current;
        const tGameMs = Math.max(0, tRawMs);

        if (now - lastUiUpdateRef.current >= UI_POLL_MS) {
          lastUiUpdateRef.current = now;
          setSongTimeMs(tGameMs);
          // Update duration if not yet set
          if (audio.duration && isFinite(audio.duration)) {
            setSongDurationMs(audio.duration * 1000);
          }
        }

        let hz: number | null = null;
        if (analyser && micCtx && now - lastPitchPollRef.current >= PITCH_POLL_MS) {
          lastPitchPollRef.current = now;
          analyser.getFloatTimeDomainData(micBufRef.current);
          const raw = autoCorrelate(micBufRef.current, micCtx.sampleRate);

          if (raw !== null) {
            pitchHistoryRef.current.push(raw);
            if (pitchHistoryRef.current.length > PITCH_HISTORY_SIZE) {
              pitchHistoryRef.current.shift();
            }
            setPitchHistoryCount(pitchHistoryRef.current.length);
          }

          hz = pitchHistoryRef.current.length >= 3
            ? median(pitchHistoryRef.current)
            : raw;

          setDetectedHz(hz);
        }

        while (nextIdxRef.current < chart.events.length) {
          const ev = chart.events[nextIdxRef.current];

          if (ev._scored) { nextIdxRef.current++; continue; }

          const diff = tGameMs - ev.timeMs;
          if (diff < -HIT_WINDOW_MS) break;

          const hitEnd = HIT_WINDOW_MS + (ev.durationMs ?? 0) + SUSTAIN_EXTEND_MS;

          if (diff <= hitEnd) {
            if (hz !== null) {
              const expectedHz = midiToHz(ev.notes[0]);
              if (pitchMatchesRobust(hz, expectedHz, PITCH_TOLERANCE_CENTS)) {
                ev._scored = true;
                const pts = 100 * (comboRef.current + 1);
                scoreRef.current  += pts;
                comboRef.current  += 1;
                if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;
                const sn: ScoredNote = { event: ev, result: "HIT", detectedHz: hz };
                scoredRef.current = [...scoredRef.current, sn];
                setScoredNotes(scoredRef.current);
                setScore(scoreRef.current);
                setCombo(comboRef.current);
                setMaxCombo(maxComboRef.current);
                showFeedback("HIT");
                nextIdxRef.current++;
                continue;
              }
            }
            break;
          }

          ev._scored = true;
          comboRef.current = 0;
          const sn: ScoredNote = { event: ev, result: "MISS" };
          scoredRef.current = [...scoredRef.current, sn];
          setScoredNotes(scoredRef.current);
          setCombo(0);
          showFeedback("MISS");
          nextIdxRef.current++;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [chart, showFeedback]);

  // â”€â”€ Song ended handler â”€â”€
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsPlaying(false);
      // Mark any remaining unscored notes as MISS
      if (chart) {
        chart.events.forEach((ev) => {
          if (!ev._scored) {
            ev._scored = true;
            comboRef.current = 0;
            const sn: ScoredNote = { event: ev, result: "MISS" };
            scoredRef.current = [...scoredRef.current, sn];
          }
        });
        setScoredNotes([...scoredRef.current]);
        setCombo(0);
      }
      // Small delay so the last feedback flash can finish
      setTimeout(() => setGameOver(true), 100);
    };

    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [chart]);

  // â”€â”€ Submit score when game ends â”€â”€
  useEffect(() => {
    if (gameOver && !scoreSubmitted && session?.user?.id && chart) {
      const hits = scoredNotes.filter((n) => n.result === "HIT").length;
      const misses = scoredNotes.filter((n) => n.result === "MISS").length;
      const accuracy = scoredNotes.length > 0 ? Math.round((hits / scoredNotes.length) * 100) : 0;

      const submitScore = async () => {
        try {
          const res = await fetch("/api/scores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: session.user.id,
              levelId: levelId,
              score: score,
              hits: hits,
              misses: misses,
              accuracy: accuracy,
            }),
          });

          if (res.ok) {
            setScoreSubmitted(true);
          } else {
            console.error("Failed to submit score:", await res.text());
          }
        } catch (error) {
          console.error("Error submitting score:", error);
        }
      };

      submitScore();
    }
  }, [gameOver, scoreSubmitted, session, chart, score, scoredNotes, levelId]);

  // â”€â”€ Play / Pause â”€â”€
  const toggle = async () => {
    if (!chart || !activePlaybackUrl) return;
    let a = audioRef.current;
    if (!a) {
      a = new Audio(activePlaybackUrl);
      a.preload = "auto";
      a.volume = isMuted ? 0 : volume;
      audioRef.current = a;

      // Capture duration once metadata is loaded
      a.addEventListener("loadedmetadata", () => {
        if (isFinite(a!.duration)) setSongDurationMs(a!.duration * 1000);
      });

      // Attach ended listener on first creation
      const handleEnded = () => {
        setIsPlaying(false);
        if (chart) {
          chart.events.forEach((ev) => {
            if (!ev._scored) {
              ev._scored = true;
              comboRef.current = 0;
              const sn: ScoredNote = { event: ev, result: "MISS" };
              scoredRef.current = [...scoredRef.current, sn];
            }
          });
          setScoredNotes([...scoredRef.current]);
          setCombo(0);
        }
        setTimeout(() => setGameOver(true), 100);
      };
      a.addEventListener("ended", handleEnded);
    }
    if (!isPlaying) { await a.play().catch(console.error); setIsPlaying(true); }
    else { a.pause(); setIsPlaying(false); }
  };

  // â”€â”€ Seek (progress bar click) â”€â”€
  const switchPlaybackSource = (nextSource: PlaybackSource) => {
    const currentSource = playbackSourceRef.current;
    if (!chart || nextSource === currentSource) {
      return;
    }

    const nextSourceUrl = nextSource === "analysis"
      ? playbackUrls.analysisAudioUrl
      : playbackUrls.fullMixAudioUrl;
    if (!nextSourceUrl) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      setPlaybackSource(nextSource);
      playbackSourceRef.current = nextSource;
      return;
    }

    const wasPlaying = !audio.paused;
    const currentPlaybackMs = audio.currentTime * 1000;
    const analysisTimelineMs = toAnalysisTimelineMs(currentPlaybackMs, currentSource, chart);
    const nextPlaybackMs = Math.max(0, fromAnalysisTimelineMs(analysisTimelineMs, nextSource, chart));
    setPlaybackSource(nextSource);
    playbackSourceRef.current = nextSource;

    const applySwitchPosition = () => {
      const targetSec = nextPlaybackMs / 1000;
      audio.currentTime = Number.isFinite(audio.duration)
        ? Math.min(targetSec, Math.max(0, audio.duration))
        : targetSec;

      const currentChartMs = Math.max(
        0,
        toAnalysisTimelineMs(audio.currentTime * 1000, nextSource, chart) - (chart.offsetMs ?? 0) - inputLatencyMsRef.current,
      );
      setSongTimeMs(currentChartMs);
      if (Number.isFinite(audio.duration)) {
        setSongDurationMs(audio.duration * 1000);
      }
      if (wasPlaying) {
        void audio.play().catch(console.error);
        setIsPlaying(true);
      }
    };

    audio.pause();
    audio.src = nextSourceUrl;
    audio.load();
    if (audio.readyState >= 1) {
      applySwitchPosition();
    } else {
      audio.addEventListener("loadedmetadata", applySwitchPosition, { once: true });
    }
  };
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !songDurationMs || !chart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newPlaybackMs = pct * songDurationMs;
    const newTimeS = newPlaybackMs / 1000;
    a.currentTime = newTimeS;
    const newChartMs = Math.max(
      0,
      toAnalysisTimelineMs(newPlaybackMs, playbackSourceRef.current, chart) - (chart.offsetMs ?? 0) - inputLatencyMsRef.current,
    );
    setSongTimeMs(newChartMs);
    // Reset scoring window so notes near the seek point are re-evaluated
    nextIdxRef.current = chart.events.findIndex((ev) => !ev._scored && ev.timeMs >= newChartMs - HIT_WINDOW_MS);
    if (nextIdxRef.current < 0) nextIdxRef.current = chart.events.length;
  };

  // â”€â”€ Toggle mute â”€â”€
  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(prevVolumeRef.current || 0.5);
    } else {
      prevVolumeRef.current = volume;
      setIsMuted(true);
    }
  };

  // â”€â”€ Volume icon helper â”€â”€
  const volumeIcon = () => {
    if (isMuted || volume === 0) return "ðŸ”‡";
    if (volume < 0.4) return "ðŸ”ˆ";
    if (volume < 0.75) return "ðŸ”‰";
    return "ðŸ”Š";
  };

  // â”€â”€ Restart â”€â”€
  const restart = () => {
    const a = audioRef.current;
    if (a) { a.currentTime = 0; a.play().catch(console.error); }
    chart?.events.forEach((e) => { e._scored = false; });
    nextIdxRef.current     = 0;
    scoreRef.current       = 0;
    comboRef.current       = 0;
    maxComboRef.current    = 0;
    scoredRef.current      = [];
    pitchHistoryRef.current = [];
    setScore(0); setCombo(0); setMaxCombo(0); setScoredNotes([]); setSongTimeMs(0);
    setGameOver(false);
    setScoreSubmitted(false);
    setIsPlaying(true);
  };

  // â”€â”€ Derived stats â”€â”€
  const hits     = useMemo(() => scoredNotes.filter((n) => n.result === "HIT").length,  [scoredNotes]);
  const misses   = useMemo(() => scoredNotes.filter((n) => n.result === "MISS").length, [scoredNotes]);
  const accuracy = scoredNotes.length > 0 ? Math.round((hits / scoredNotes.length) * 100) : 100;

  const nextEvent = useMemo(() => {
    if (!chart) return null;
    return chart.events.find((e) => !e._scored && e.timeMs >= songTimeMs) ?? null;
  }, [chart, songTimeMs]);

  const progressPct = songDurationMs > 0 ? Math.min(100, (songTimeMs / songDurationMs) * 100) : 0;

  if (!chart) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0a0a0f", color:"#fff", fontFamily:"monospace" }}>
      Loading chartâ€¦
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0f", color:"#f0f0f0", fontFamily:"'Courier New', monospace", padding:"24px" }}>

      {/* Game Over Results Overlay */}
      {gameOver && (
        <ResultsScreen
          chart={chart}
          score={score}
          maxCombo={maxCombo}
          hits={hits}
          misses={misses}
          accuracy={accuracy}
          scoredNotes={scoredNotes}
          onRestart={restart}
        />
      )}

      {feedback && (
        <div style={{
          position:"fixed", top:"30%", left:"50%", transform:"translateX(-50%)",
          fontSize:72, fontWeight:900, pointerEvents:"none", zIndex:100, letterSpacing:4,
          color: feedback === "HIT" ? "#22c55e" : "#ef4444",
          textShadow:`0 0 40px ${feedback === "HIT" ? "#22c55e" : "#ef4444"}`,
          animation:"pop 0.4s ease-out forwards",
        }}>{feedback}</div>
      )}

      <style>{`@keyframes pop{0%{opacity:1;transform:translateX(-50%) scale(1.2)}100%{opacity:0;transform:translateX(-50%) scale(0.9)}}`}</style>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"baseline", gap:16, marginBottom:24 }}>
        <h1 style={{ fontSize:28, fontWeight:700, margin:0, letterSpacing:2, textTransform:"uppercase" }}>{chart.title}</h1>
        {chart.bpmHint && <span style={{ fontSize:13, color:"#666", letterSpacing:1 }}>{Math.round(chart.bpmHint)} BPM</span>}
      </div>

      {/* â”€â”€ Song progress bar â”€â”€ */}
      <div style={{ marginBottom: 20 }}>
        <div
          onClick={handleSeek}
          title="Click to seek"
          style={{
            position: "relative",
            height: 10,
            background: "#1f2937",
            borderRadius: 99,
            cursor: "pointer",
            overflow: "hidden",
          }}
        >
          {/* filled portion */}
          <div style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0,
            width: `${progressPct}%`,
            background: "linear-gradient(90deg, #3b82f6, #60a5fa)",
            borderRadius: 99,
            transition: "width 0.1s linear",
          }} />
          {/* glowing head */}
          <div style={{
            position: "absolute",
            top: "50%",
            left: `${progressPct}%`,
            transform: "translate(-50%, -50%)",
            width: 14,
            height: 14,
            background: "#fff",
            borderRadius: "50%",
            boxShadow: "0 0 8px #60a5fa, 0 0 20px #3b82f680",
            transition: "left 0.1s linear",
          }} />
        </div>
        {/* time labels */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "#4b5563" }}>
          <span>{formatTime(songTimeMs)}</span>
          <span>{songDurationMs > 0 ? formatTime(songDurationMs) : "--:--"}</span>
        </div>
      </div>

      {/* Score cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12, marginBottom:24 }}>
        {[
          { label:"SCORE",     value:score.toLocaleString(), color:"#facc15" },
          { label:"COMBO",     value:`Ã—${combo}`,            color:combo > 4 ? "#22c55e" : "#f0f0f0" },
          { label:"ACCURACY",  value:`${accuracy}%`,         color:accuracy >= 80 ? "#22c55e" : accuracy >= 50 ? "#facc15" : "#ef4444" },
          { label:"MAX COMBO", value:`Ã—${maxCombo}`,         color:"#60a5fa" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:8, padding:"12px 16px" }}>
            <div style={{ fontSize:10, color:"#6b7280", letterSpacing:2, marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:24, fontWeight:700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Hit / Miss */}
      <div style={{ display:"flex", gap:12, marginBottom:24 }}>
        <div style={{ background:"#14532d", border:"1px solid #166534", borderRadius:8, padding:"8px 20px", fontSize:14, color:"#22c55e" }}>
          âœ“ {hits} HIT{hits !== 1 ? "S" : ""}
        </div>
        <div style={{ background:"#7f1d1d", border:"1px solid #991b1b", borderRadius:8, padding:"8px 20px", fontSize:14, color:"#ef4444" }}>
          âœ— {misses} MISS{misses !== 1 ? "ES" : ""}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <button onClick={toggle} style={btnStyle(isPlaying ? "#f59e0b" : "#22c55e")}>{isPlaying ? "Pause" : "Play"}</button>
        <button onClick={restart} style={btnStyle("#6b7280")}>Restart</button>
        <button onClick={() => setShowSettings((prev) => !prev)} style={btnStyle(showSettings ? "#1d4ed8" : "#374151")}>
          {showSettings ? "Hide Settings" : "Settings"}
        </button>

        <div style={{ display:"flex", alignItems:"center", gap:8, background:"#111827", border:"1px solid #1f2937", borderRadius:8, padding:"8px 14px", fontSize:13 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:micReady ? "#22c55e" : "#374151", boxShadow:micReady ? "0 0 8px #22c55e" : "none" }} />
          <span style={{ color:"#9ca3af" }}>{micReady ? "Input active" : "Input off"}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 2 }}>PREVIEW MODE</div>
        {(["tab", "staff", "grid", "off"] as PreviewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setPreviewMode(mode)}
            style={{
              ...btnStyle(previewMode === mode ? "#1d4ed8" : "#374151"),
              padding: "6px 10px",
              fontSize: 11,
            }}
          >
            {mode.toUpperCase()}
          </button>
        ))}
        {instrumentProfile && (
          <div style={{ fontSize: 11, color: "#4b5563" }}>
            {instrumentProfile.label} · {instrumentProfile.tuning.length} strings · max fret {instrumentProfile.maxFret} · source {instrumentProfile.source}
          </div>
        )}
      </div>
      {previewMode === "tab" && instrumentProfile && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 2 }}>INSTRUMENT</div>
          {(["auto", "bass", "guitar"] as InstrumentOverride[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setInstrumentOverride(mode)}
              style={{
                ...btnStyle(instrumentOverride === mode ? "#0e7490" : "#374151"),
                padding: "6px 10px",
                fontSize: 11,
              }}
            >
              {mode.toUpperCase()}
            </button>
          ))}

          <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 2, marginLeft: 8 }}>MAPPING</div>
          {(["beginner_open", "smooth_motion", "exact_authored"] as MappingPolicy[]).map((policy) => {
            const isExact = policy === "exact_authored";
            const disabled = isExact && !hasAuthoredTabData;
            return (
              <button
                key={policy}
                onClick={() => setTabMappingPolicy(policy)}
                disabled={disabled}
                style={{
                  ...btnStyle(effectiveTabMappingPolicy === policy ? "#1d4ed8" : "#374151"),
                  padding: "6px 10px",
                  fontSize: 11,
                  opacity: disabled ? 0.5 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
                title={disabled ? "No authored tab data available in this chart." : undefined}
              >
                {mappingPolicyLabel(policy).toUpperCase()}
              </button>
            );
          })}

          <div
            style={{
              marginLeft: 8,
              fontSize: 10,
              letterSpacing: 1.4,
              borderRadius: 999,
              padding: "2px 8px",
              border: `1px solid ${unresolvedVisibleCount === 0 ? "#166534" : "#991b1b"}`,
              color: unresolvedVisibleCount === 0 ? "#22c55e" : "#fca5a5",
              background: unresolvedVisibleCount === 0 ? "#14532d" : "#7f1d1d",
            }}
          >
            {unresolvedVisibleCount === 0 ? "OK" : `${unresolvedVisibleCount} UNRESOLVED`}
          </div>
        </div>
      )}

      {(playbackNotice || (chart.analysisToPlaybackOffsetMs ?? 0) !== 0) && (
        <div className={styles.playbackNotice}>
          {playbackNotice && <div>{playbackNotice}</div>}
          {(chart.analysisToPlaybackOffsetMs ?? 0) !== 0 && (
            <div>Analysis/playback alignment offset: {chart.analysisToPlaybackOffsetMs}ms.</div>
          )}
        </div>
      )}

      {showSettings && (
        <div className={styles.settingsPanel}>
          <div className={styles.settingsSection}>
            <div className={styles.settingsLabel}>INPUT DEVICE</div>
            <div className={styles.inputRow}>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className={styles.inputSelect}
              >
                {audioInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Audio Input (${d.deviceId.slice(0, 6)}...)`}
                  </option>
                ))}
              </select>
              <button onClick={() => void refreshAudioInputs()} style={{ ...btnStyle("#374151"), padding:"6px 10px", fontSize:11 }}>Refresh</button>
              {!micReady && <button onClick={() => void initMic()} style={{ ...btnStyle("#3b82f6"), padding:"6px 10px", fontSize:11 }}>Enable Input</button>}
              {micReady && <button onClick={stopMic} style={{ ...btnStyle("#ef4444"), padding:"6px 10px", fontSize:11 }}>Stop Input</button>}
              {micReady && <button onClick={() => void initMic()} style={{ ...btnStyle("#2563eb"), padding:"6px 10px", fontSize:11 }}>Apply Selection</button>}
            </div>
          </div>

          <div className={styles.settingsSection}>
            <div className={styles.settingsLabel}>PLAYBACK SOURCE</div>
            <div className={styles.inputRow}>
              <button
                onClick={() => switchPlaybackSource("full_mix")}
                disabled={!playbackUrls.fullMixAudioUrl}
                style={{ ...btnStyle(playbackSource === "full_mix" ? "#0e7490" : "#374151"), padding:"6px 10px", fontSize:11 }}
              >
                Full Mix
              </button>
              <button
                onClick={() => switchPlaybackSource("analysis")}
                disabled={!playbackUrls.analysisAudioUrl}
                style={{ ...btnStyle(playbackSource === "analysis" ? "#0e7490" : "#374151"), padding:"6px 10px", fontSize:11 }}
              >
                Isolated Stem {chart.analysisStem ? `(${chart.analysisStem})` : ""}
              </button>
            </div>
            <div className={styles.latencyHint}>
              Current source: {playbackSource === "analysis" ? "analysis/stem audio" : "full mix audio"}
            </div>
            {chart.analysisFirstActivityMs !== undefined && (
              <div className={styles.latencyHint}>
                Analysis first activity: {chart.analysisFirstActivityMs}ms.
              </div>
            )}
          </div>

          <div className={styles.settingsSection}>
            <div className={styles.settingsLabel}>VOLUME</div>
            <div className={styles.volumeControl}>
              <button
                onClick={toggleMute}
                title={isMuted ? "Unmute" : "Mute"}
                className={styles.volumeButton}
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {volumeIcon()}
              </button>
              <label htmlFor="volume-slider" className={styles.volumeLabelHidden}>Volume</label>
              <input
                id="volume-slider"
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  setIsMuted(v === 0);
                  if (v > 0) prevVolumeRef.current = v;
                  const a = audioRef.current;
                  if (a) a.volume = v;
                }}
                className={styles.volumeSlider}
                aria-label="Volume control"
                title="Adjust volume"
              />
              <span className={styles.volumeLabel}>
                {isMuted ? "0%" : `${Math.round(volume * 100)}%`}
              </span>
            </div>
          </div>

          <div className={styles.settingsSection}>
            <div className={styles.settingsLabel}>INPUT LATENCY</div>
            <div className={styles.latencyRow}>
              <input
                type="range" min={-200} max={200} step={5}
                value={inputLatencyMs}
                onChange={(e) => setInputLatencyMs(Number(e.target.value))}
                className={styles.latencySlider}
              />
              <div className={styles.latencyValue}>
                {inputLatencyMs > 0 ? "+" : ""}{inputLatencyMs} ms
              </div>
              <button onClick={() => setInputLatencyMs(0)} style={{ ...btnStyle("#374151"), padding:"4px 10px", fontSize:11 }}>Reset</button>
            </div>
            <div className={styles.latencyHint}>
              If notes feel late, drag left. If early, drag right.
            </div>
          </div>
        </div>
      )}

      {/* Pitch monitor */}
      <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:8, padding:"16px", marginBottom:24, display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div>
          <div style={{ fontSize:10, color:"#6b7280", letterSpacing:2, marginBottom:6 }}>YOU&apos;RE PLAYING</div>
          <div style={{ fontSize:22, fontWeight:700, color:detectedHz ? "#60a5fa" : "#374151" }}>
            {detectedHz ? `${detectedHz.toFixed(1)} Hz` : "â€”"}
          </div>
          {detectedHz && (
            <div style={{ fontSize:11, color:"#4b5563", marginTop:2 }}>
              median of {Math.min(pitchHistoryCount, PITCH_HISTORY_SIZE)} samples
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize:10, color:"#6b7280", letterSpacing:2, marginBottom:6 }}>NEXT NOTE</div>
          <div style={{ fontSize:22, fontWeight:700, color:"#f0f0f0" }}>
            {nextEvent ? `${midiToName(nextEvent.notes[0])} (${midiToHz(nextEvent.notes[0]).toFixed(1)} Hz)` : "â€”"}
          </div>
          {nextEvent && (
            <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>
              in {Math.max(0, Math.round(nextEvent.timeMs - songTimeMs))} ms
              {nextEvent.durationMs > 0 && ` Â· hold ${nextEvent.durationMs} ms`}
            </div>
          )}
        </div>
      </div>
      {previewMode === "tab" && computedTabEvents && instrumentProfile && (
        <TabPreview
          events={computedTabEvents}
          bpmHint={chart.bpmHint}
          songTimeMs={songTimeMs}
          instrumentProfile={instrumentProfile}
          mappingPolicy={effectiveTabMappingPolicy}
          unresolvedVisibleCount={unresolvedVisibleCount}
        />
      )}
      {previewMode === "staff" && (
        <StaffPreview chart={chart} songTimeMs={songTimeMs} />
      )}
      {previewMode === "grid" && (
        <MeasurePreview chart={chart} songTimeMs={songTimeMs} />
      )}
      {/* Recent notes */}
      
      {scoredNotes.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:10, color:"#6b7280", letterSpacing:2, marginBottom:8 }}>RECENT NOTES</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {[...scoredNotes].reverse().slice(0, 12).map((n, i) => (
              <div key={i} style={{
                background: n.result === "HIT" ? "#14532d" : "#7f1d1d",
                border:`1px solid ${n.result === "HIT" ? "#166534" : "#991b1b"}`,
                borderRadius:6, padding:"4px 10px", fontSize:12,
                color: n.result === "HIT" ? "#22c55e" : "#ef4444",
              }}>
                {midiToName(n.event.notes[0])}
                {n.detectedHz && <span style={{ color:"#6b7280", marginLeft:4 }}>{n.detectedHz.toFixed(0)}Hz</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize:12, color:"#374151" }}>{Math.max(0, Math.round(songTimeMs))} ms</div>
    </div>
  );
}



