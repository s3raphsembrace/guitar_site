export type PreviewTick = {
  pct: number;
  strong: boolean;
  timeMs: number;
};

export type PreviewWindow = {
  bpm: number | null;
  beatMs: number | null;
  measureMs: number | null;
  measureStartIndex: number | null;
  startMs: number;
  endMs: number;
  windowMs: number;
  nowPct: number;
  ticks: PreviewTick[];
};

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function computePreviewWindow({
  bpmHint,
  songTimeMs,
  beatsPerMeasure = 4,
  windowMeasures = 2,
}: {
  bpmHint?: number | null;
  songTimeMs: number;
  beatsPerMeasure?: number;
  windowMeasures?: number;
}): PreviewWindow {
  const bpm = bpmHint ?? null;
  if (!bpm || bpm <= 0) {
    const startMs = Math.max(0, songTimeMs - 1000);
    const windowMs = 4000;
    const endMs = startMs + windowMs;
    const nowPct = clampNumber(((songTimeMs - startMs) / windowMs) * 100, 0, 100);

    const ticks: PreviewTick[] = [];
    for (let t = startMs; t <= endMs; t += 500) {
      ticks.push({
        timeMs: t,
        pct: ((t - startMs) / windowMs) * 100,
        strong: (t - startMs) % 2000 === 0,
      });
    }

    return {
      bpm,
      beatMs: null,
      measureMs: null,
      measureStartIndex: null,
      startMs,
      endMs,
      windowMs,
      nowPct,
      ticks,
    };
  }

  const beatMs = 60000 / bpm;
  const measureMs = beatsPerMeasure * beatMs;
  const startMs = Math.floor(songTimeMs / measureMs) * measureMs;
  const windowMs = windowMeasures * measureMs;
  const endMs = startMs + windowMs;
  const nowPct = clampNumber(((songTimeMs - startMs) / windowMs) * 100, 0, 100);

  const ticks: PreviewTick[] = [];
  const totalBeats = Math.ceil(windowMs / beatMs);
  for (let i = 0; i <= totalBeats; i++) {
    const t = startMs + i * beatMs;
    ticks.push({
      timeMs: t,
      pct: ((t - startMs) / windowMs) * 100,
      strong: i % beatsPerMeasure === 0,
    });
  }

  return {
    bpm,
    beatMs,
    measureMs,
    measureStartIndex: Math.floor(startMs / measureMs),
    startMs,
    endMs,
    windowMs,
    nowPct,
    ticks,
  };
}
