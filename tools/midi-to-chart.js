// tools/midi-to-chart.js
import fs from "fs";
import path from "path";
import pkg from "@tonejs/midi";
const { Midi } = pkg;

function pickBestTrack(midi) {
  // heuristic: pick the track with the most notes
  return midi.tracks.reduce(
    (best, t) => (t.notes.length > best.notes.length ? t : best),
    midi.tracks[0]
  );
}

function main() {
  const inPath = process.argv[2];
  const outPath = process.argv[3];

  if (!inPath) {
    console.error("Usage: node tools/midi-to-chart.js input.mid output.json");
    process.exit(1);
  }

  const data = fs.readFileSync(inPath);
  const midi = new Midi(data);

  const track = pickBestTrack(midi);
  const events = track.notes
    .map((n) => ({
      timeMs: Math.round(n.time * 1000),
      durationMs: Math.round(n.duration * 1000),
      notes: [n.midi],
      velocity: n.velocity,
    }))
    .sort((a, b) => a.timeMs - b.timeMs);

  const id = path.basename(inPath, path.extname(inPath));
  const chart = {
    id,
    title: id,
    audioUrl: "/audio/REPLACE_ME.ogg",
    offsetMs: 0,
    bpmHint: midi.header.tempos?.[0]?.bpm ?? null,
    events,
  };

  const dest = outPath || `public/charts/${chart.id}.json`;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(chart, null, 2));
  console.log(`Wrote ${events.length} events -> ${dest}`);
}

main();