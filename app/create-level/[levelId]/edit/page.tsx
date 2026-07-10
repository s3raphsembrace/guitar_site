"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import type { LevelChart, LevelQuantization, SaveDraftResponse, UserLevelDraftResponse } from "@/types/level-import";

type EditableLevel = NonNullable<UserLevelDraftResponse["level"]>;
type PlaybackSource = "full_mix" | "analysis";

function applyQuantization(chart: LevelChart, setting: LevelQuantization): LevelChart {
  if (setting === "off" || !chart.bpmHint || chart.bpmHint <= 0) {
    return chart;
  }

  const division = setting === "1/8" ? 2 : 4;
  const stepMs = 60000 / chart.bpmHint / division;

  return {
    ...chart,
    events: chart.events.map((event) => ({
      ...event,
      timeMs: Math.max(0, Math.round(Math.round(event.timeMs / stepMs) * stepMs)),
      durationMs: Math.max(1, Math.round(Math.round(event.durationMs / stepMs) * stepMs)),
    })),
  };
}

function resolvePlaybackUrls(chart: LevelChart) {
  const fullMixAudioUrl = chart.fullMixAudioUrl ?? chart.audioUrl;
  const analysisAudioUrl = chart.analysisAudioUrl ?? chart.stemAudioUrl ?? chart.audioUrl;
  return {
    fullMixAudioUrl: fullMixAudioUrl || "",
    analysisAudioUrl: analysisAudioUrl || "",
  };
}

function toAnalysisTimelineMs(playbackMs: number, source: PlaybackSource, chart: LevelChart) {
  const offset = chart.analysisToPlaybackOffsetMs ?? 0;
  if (source === "full_mix") {
    return playbackMs + offset;
  }
  return playbackMs;
}

function fromAnalysisTimelineMs(analysisMs: number, source: PlaybackSource, chart: LevelChart) {
  const offset = chart.analysisToPlaybackOffsetMs ?? 0;
  if (source === "full_mix") {
    return analysisMs - offset;
  }
  return analysisMs;
}

export default function LevelDraftEditorPage({
  params,
}: {
  params: Promise<{ levelId: string }>;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [resolvedLevelId, setResolvedLevelId] = useState<string | null>(null);
  const [level, setLevel] = useState<EditableLevel | null>(null);
  const [title, setTitle] = useState("");
  const [chart, setChart] = useState<LevelChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [audioCurrentMs, setAudioCurrentMs] = useState(0);
  const [playbackSource, setPlaybackSource] = useState<PlaybackSource>("full_mix");
  const [quantization, setQuantization] = useState<LevelQuantization>("off");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const pendingSeekMsRef = useRef<number | null>(null);
  const pendingResumeRef = useRef(false);

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

      pendingResumeRef.current = false;
      if (updateState) {
        setIsPlaying(false);
      }
      if (resetTime) {
        setAudioCurrentMs(0);
      }
      if (clearSource) {
        setAudioDurationMs(0);
      }
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      const value = await params;
      setResolvedLevelId(value.levelId);
    })();
  }, [params]);

  useEffect(() => {
    if (!resolvedLevelId) return;

    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(`/api/user-levels/${resolvedLevelId}`, { cache: "no-store" });
        const body = (await response.json()) as UserLevelDraftResponse;
        if (!response.ok || !body.ok || !body.level) {
          throw new Error(body.message ?? "Failed to load draft level.");
        }
        setLevel(body.level);
        setTitle(body.level.title);
        setChart(body.level.chart);
      } catch (loadError) {
        const messageValue = loadError instanceof Error ? loadError.message : "Could not load editor.";
        setError(messageValue);
      } finally {
        setLoading(false);
      }
    })();
  }, [resolvedLevelId]);

  useEffect(() => {
    if (!chart) {
      return;
    }
    const urls = resolvePlaybackUrls(chart);
    if (urls.fullMixAudioUrl) {
      setPlaybackSource("full_mix");
    } else if (urls.analysisAudioUrl) {
      setPlaybackSource("analysis");
    }
  }, [chart]);

  useEffect(() => {
    const handlePageHide = () => {
      stopPlayback({ resetTime: true, updateState: true });
    };
    const handlePopState = () => {
      stopPlayback({ resetTime: true, updateState: true });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopPlayback({ resetTime: false, updateState: true });
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
  }, [stopPlayback]);

  const playbackUrls = useMemo(() => {
    if (!chart) {
      return { fullMixAudioUrl: "", analysisAudioUrl: "", activePlaybackUrl: "" };
    }

    const urls = resolvePlaybackUrls(chart);
    const activePlaybackUrl = playbackSource === "analysis"
      ? (urls.analysisAudioUrl || urls.fullMixAudioUrl)
      : (urls.fullMixAudioUrl || urls.analysisAudioUrl);

    return {
      ...urls,
      activePlaybackUrl,
    };
  }, [chart, playbackSource]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playbackUrls.activePlaybackUrl) return;

    const onLoaded = () => {
      setAudioDurationMs(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0);
      const pendingSeekMs = pendingSeekMsRef.current;
      if (pendingSeekMs !== null) {
        const seekSec = Math.max(0, pendingSeekMs) / 1000;
        audio.currentTime = Number.isFinite(audio.duration)
          ? Math.min(seekSec, Math.max(0, audio.duration))
          : seekSec;
        setAudioCurrentMs(Math.round(audio.currentTime * 1000));
        pendingSeekMsRef.current = null;
      }
      if (pendingResumeRef.current) {
        pendingResumeRef.current = false;
        void audio.play().catch(() => {});
      }
    };
    const onTime = () => setAudioCurrentMs(Math.round(audio.currentTime * 1000));
    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("ended", onPause);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("ended", onPause);
    };
  }, [playbackUrls.activePlaybackUrl]);

  useEffect(() => {
    return () => {
      stopPlayback({ resetTime: true, clearSource: true, updateState: false });
    };
  }, [stopPlayback]);

  const selectedEvent = useMemo(() => {
    if (!chart || selectedIndex === null) return null;
    return chart.events[selectedIndex] ?? null;
  }, [chart, selectedIndex]);

  const playbackStatusWarnings = useMemo(() => {
    if (!chart) {
      return [];
    }
    const warnings: string[] = [];
    const urls = resolvePlaybackUrls(chart);
    if (!urls.fullMixAudioUrl && urls.analysisAudioUrl) {
      warnings.push("Full mix playback is unavailable. Analysis audio is being used for playback.");
    }
    if (
      chart.analysisStem &&
      chart.analysisAudioUrl &&
      urls.fullMixAudioUrl &&
      chart.analysisAudioUrl === urls.fullMixAudioUrl
    ) {
      warnings.push(`"${chart.analysisStem}" stem was unavailable, so analysis fell back to full mix audio.`);
    }
    if ((chart.analysisToPlaybackOffsetMs ?? 0) !== 0) {
      warnings.push(`Playback alignment offset: ${chart.analysisToPlaybackOffsetMs}ms (analysis vs full mix).`);
    }
    if (chart.analysisFirstActivityMs !== undefined) {
      warnings.push(`Analysis first activity detected at ${chart.analysisFirstActivityMs}ms.`);
    }
    return warnings;
  }, [chart]);

  function updateEvent(index: number, updater: (current: LevelChart["events"][number]) => LevelChart["events"][number]) {
    setChart((current) => {
      if (!current || !current.events[index]) return current;
      const nextEvents = [...current.events];
      nextEvents[index] = updater(nextEvents[index]);
      nextEvents.sort((a, b) => a.timeMs - b.timeMs || a.durationMs - b.durationMs);
      return { ...current, events: nextEvents };
    });
  }

  function deleteEvent(index: number) {
    setChart((current) => {
      if (!current) return current;
      return {
        ...current,
        events: current.events.filter((_, eventIndex) => eventIndex !== index),
      };
    });
    setSelectedIndex((current) => (current === index ? null : current));
  }

  async function handleSaveDraft() {
    if (!chart || !resolvedLevelId) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/user-levels/${resolvedLevelId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          chart: {
            ...chart,
            id: resolvedLevelId,
            title: title.trim(),
          },
        }),
      });
      const body = (await response.json()) as SaveDraftResponse;
      if (!response.ok || !body.ok) {
        throw new Error(body.message ?? "Failed to save draft.");
      }
      setMessage("Draft saved.");
    } catch (saveError) {
      const messageValue = saveError instanceof Error ? saveError.message : "Draft save failed.";
      setError(messageValue);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!resolvedLevelId) return;
    setPublishing(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/user-levels/${resolvedLevelId}/publish`, {
        method: "POST",
      });
      const body = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !body.ok) {
        throw new Error(body.message ?? "Publish failed.");
      }
      setMessage("Level published.");
    } catch (publishError) {
      const messageValue = publishError instanceof Error ? publishError.message : "Publish failed.";
      setError(messageValue);
    } finally {
      setPublishing(false);
    }
  }

  async function toggleAudioPlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }

  function switchPlaybackSource(nextSource: PlaybackSource) {
    if (!chart || nextSource === playbackSource) {
      return;
    }

    const nextSourceUrl = nextSource === "analysis"
      ? playbackUrls.analysisAudioUrl
      : playbackUrls.fullMixAudioUrl;
    if (!nextSourceUrl) {
      return;
    }

    const audio = audioRef.current;
    const wasPlaying = Boolean(audio && !audio.paused);
    const currentPlaybackMs = audio ? Math.round(audio.currentTime * 1000) : audioCurrentMs;
    const analysisTimelineMs = toAnalysisTimelineMs(currentPlaybackMs, playbackSource, chart);
    const nextPlaybackMs = Math.max(0, Math.round(fromAnalysisTimelineMs(analysisTimelineMs, nextSource, chart)));

    if (audio) {
      audio.pause();
    }
    pendingSeekMsRef.current = nextPlaybackMs;
    pendingResumeRef.current = wasPlaying;
    setAudioCurrentMs(nextPlaybackMs);
    setPlaybackSource(nextSource);
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <p>Loading editor...</p>
      </main>
    );
  }

  if (!chart || !level || !resolvedLevelId) {
    return (
      <main className={styles.page}>
        <p>{error ?? "Editor unavailable."}</p>
        <Link href="/create-level">Back to import</Link>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.headerRow}>
          <h1>Draft Editor</h1>
          <div className={styles.quickLinks}>
            <Link href="/create-level">Import</Link>
            <Link href={`/game/${resolvedLevelId}`}>Play</Link>
          </div>
        </div>

        <div className={styles.grid2}>
          <div className={styles.formRow}>
            <label htmlFor="title">Title</label>
            <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="bpm">bpmHint</label>
            <input
              id="bpm"
              type="number"
              min={20}
              max={320}
              value={chart.bpmHint ?? ""}
              onChange={(event) => {
                const next = event.target.value ? Number(event.target.value) : null;
                setChart((current) => (current ? { ...current, bpmHint: next } : current));
              }}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <label htmlFor="offset">offsetMs: {chart.offsetMs}</label>
          <input
            id="offset"
            type="range"
            min={-1000}
            max={1000}
            step={5}
            value={chart.offsetMs}
            onChange={(event) => {
              const next = Number(event.target.value);
              setChart((current) => (current ? { ...current, offsetMs: next } : current));
            }}
          />
        </div>

        <div className={styles.formRow}>
          <label htmlFor="quantization">Quantization</label>
          <div className={styles.inlineActions}>
            <select
              id="quantization"
              value={quantization}
              onChange={(event) => setQuantization(event.target.value as LevelQuantization)}
            >
              <option value="off">off</option>
              <option value="1/8">1/8</option>
              <option value="1/16">1/16</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setChart((current) => (current ? applyQuantization(current, quantization) : current));
              }}
            >
              Apply
            </button>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={() => void handleSaveDraft()} disabled={saving}>
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button type="button" onClick={() => void handlePublish()} disabled={publishing}>
            {publishing ? "Publishing..." : "Publish"}
          </button>
        </div>

        {message && <p className={styles.info}>{message}</p>}
        {error && <p className={styles.error}>{error}</p>}
      </section>

      <section className={styles.panel}>
        <h2>Audio Preview</h2>
        {playbackUrls.activePlaybackUrl ? (
          <>
            <div className={styles.inlineActions}>
              <span>Playback source:</span>
              <button
                type="button"
                onClick={() => switchPlaybackSource("full_mix")}
                disabled={!playbackUrls.fullMixAudioUrl}
                className={playbackSource === "full_mix" ? styles.sourceToggleActive : styles.sourceToggle}
              >
                Full Mix
              </button>
              <button
                type="button"
                onClick={() => switchPlaybackSource("analysis")}
                disabled={!playbackUrls.analysisAudioUrl}
                className={playbackSource === "analysis" ? styles.sourceToggleActive : styles.sourceToggle}
              >
                Isolated Stem {chart.analysisStem ? `(${chart.analysisStem})` : ""}
              </button>
            </div>
            {playbackStatusWarnings.length > 0 && (
              <ul className={styles.warningList}>
                {playbackStatusWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            <audio ref={audioRef} src={playbackUrls.activePlaybackUrl} preload="metadata" />
            <div className={styles.inlineActions}>
              <button type="button" onClick={() => void toggleAudioPlayback()}>
                {isPlaying ? "Pause" : "Play"}
              </button>
              <span>
                {Math.round(audioCurrentMs / 1000)}s / {Math.round(audioDurationMs / 1000)}s
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={audioDurationMs || 0}
              value={audioCurrentMs}
              onChange={(event) => {
                const nextMs = Number(event.target.value);
                setAudioCurrentMs(nextMs);
                if (audioRef.current) {
                  audioRef.current.currentTime = nextMs / 1000;
                }
              }}
            />
          </>
        ) : (
          <p className={styles.warning}>No audio URL assigned. Upload or set audio before publishing.</p>
        )}
      </section>

      <section className={styles.panel}>
        <h2>Timeline Events ({chart.events.length})</h2>
        <div className={styles.timeline}>
          {chart.events.map((event, index) => (
            <article
              key={`${event.id ?? "ev"}-${index}-${event.timeMs}`}
              className={selectedIndex === index ? styles.eventCardActive : styles.eventCard}
            >
              <button type="button" className={styles.selectBtn} onClick={() => setSelectedIndex(index)}>
                t={event.timeMs}ms · d={event.durationMs}ms · [{event.notes.join(", ")}]
              </button>
              <div className={styles.inlineActions}>
                <button type="button" onClick={() => updateEvent(index, (current) => ({ ...current, timeMs: Math.max(0, current.timeMs - 10) }))}>
                  -10ms
                </button>
                <button type="button" onClick={() => updateEvent(index, (current) => ({ ...current, timeMs: current.timeMs + 10 }))}>
                  +10ms
                </button>
                <button type="button" onClick={() => updateEvent(index, (current) => ({ ...current, durationMs: Math.max(1, current.durationMs - 10) }))}>
                  shorter
                </button>
                <button type="button" onClick={() => updateEvent(index, (current) => ({ ...current, durationMs: current.durationMs + 10 }))}>
                  longer
                </button>
                <button type="button" onClick={() => deleteEvent(index)}>
                  delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {selectedEvent && (
        <section className={styles.panel}>
          <h2>Selected Event</h2>
          <div className={styles.grid2}>
            <div className={styles.formRow}>
              <label htmlFor="selected-time">timeMs</label>
              <input
                id="selected-time"
                type="number"
                value={selectedEvent.timeMs}
                onChange={(event) =>
                  updateEvent(selectedIndex as number, (current) => ({
                    ...current,
                    timeMs: Math.max(0, Number(event.target.value)),
                  }))
                }
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="selected-duration">durationMs</label>
              <input
                id="selected-duration"
                type="number"
                value={selectedEvent.durationMs}
                onChange={(event) =>
                  updateEvent(selectedIndex as number, (current) => ({
                    ...current,
                    durationMs: Math.max(1, Number(event.target.value)),
                  }))
                }
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <label htmlFor="selected-notes">notes (comma separated MIDI numbers)</label>
            <input
              id="selected-notes"
              value={selectedEvent.notes.join(",")}
              onChange={(event) => {
                const notes = event.target.value
                  .split(",")
                  .map((token) => Number(token.trim()))
                  .filter((note) => Number.isFinite(note) && note >= 0 && note <= 127)
                  .map((note) => Math.round(note));
                updateEvent(selectedIndex as number, (current) => ({
                  ...current,
                  notes: notes.length ? [...new Set(notes)] : current.notes,
                }));
              }}
            />
          </div>
        </section>
      )}
    </main>
  );
}
