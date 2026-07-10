import { readFile } from "node:fs/promises";
import { Midi } from "@tonejs/midi";
import type { ChartEvent, LevelChart } from "@/types/level-import";
import { sortEvents } from "@/lib/level-import/utils";

const CHORD_GROUP_WINDOW_MS = 12;

function pickBestTrack(midi: Midi) {
  return midi.tracks.reduce((best, track) => {
    if (!best || track.notes.length > best.notes.length) {
      return track;
    }
    return best;
  }, midi.tracks[0]);
}

function buildEventsFromMidi(midi: Midi): ChartEvent[] {
  const track = pickBestTrack(midi);
  if (!track || track.notes.length === 0) {
    return [];
  }

  const sortedNotes = [...track.notes].sort((a, b) => a.time - b.time);
  const groups: Array<{
    timeMs: number;
    durationMs: number;
    notes: number[];
    velocitySum: number;
    count: number;
  }> = [];

  for (const note of sortedNotes) {
    const timeMs = Math.max(0, Math.round(note.time * 1000));
    const durationMs = Math.max(1, Math.round(note.duration * 1000));
    const last = groups.at(-1);

    if (last && Math.abs(last.timeMs - timeMs) <= CHORD_GROUP_WINDOW_MS) {
      if (!last.notes.includes(note.midi)) {
        last.notes.push(note.midi);
      }
      last.durationMs = Math.max(last.durationMs, durationMs);
      last.velocitySum += note.velocity ?? 0.8;
      last.count += 1;
      continue;
    }

    groups.push({
      timeMs,
      durationMs,
      notes: [note.midi],
      velocitySum: note.velocity ?? 0.8,
      count: 1,
    });
  }

  return sortEvents(
    groups.map((group, index) => ({
      id: `${index + 1}`,
      timeMs: group.timeMs,
      durationMs: group.durationMs,
      notes: group.notes.sort((a, b) => a - b),
      velocity: Number((group.velocitySum / Math.max(1, group.count)).toFixed(3)),
      confidence: 1,
    })),
  );
}

export interface MidiImportWorkerInput {
  levelId: string;
  title: string;
  midiAbsolutePath: string;
  audioUrl: string;
  manualBpm?: number;
}

export async function runMidiImportWorker(input: MidiImportWorkerInput): Promise<{
  chart: LevelChart;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const data = await readFile(input.midiAbsolutePath);
  const midi = new Midi(data);

  const events = buildEventsFromMidi(midi);
  if (events.length === 0) {
    warnings.push("No MIDI notes were detected in the selected file.");
  }

  const bpmFromMidi = midi.header.tempos?.[0]?.bpm ?? null;
  const bpmHint = input.manualBpm ?? bpmFromMidi;
  if (!bpmHint) {
    warnings.push("No BPM was detected in MIDI metadata. You can set BPM manually in the editor.");
  }

  const chart: LevelChart = {
    id: input.levelId,
    title: input.title,
    audioUrl: input.audioUrl,
    fullMixAudioUrl: input.audioUrl || undefined,
    offsetMs: 0,
    bpmHint,
    events,
  };

  return { chart, warnings };
}
