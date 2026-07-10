const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

export function hzToNoteName(hz: number): string {
  if (hz <= 0) return "—";
  const semitones = 12 * Math.log2(hz / 440) + 69;
  const midi = Math.round(semitones);
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return `${name}${octave}`;
}
