"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Orbitron, Space_Grotesk } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Activity, Gauge, Layers3, Settings2, Trophy, UserCircle2 } from "lucide-react";

import { mockLevels } from "@/lib/game/mockLevels";
import type { GetLeaderboardResponse, LeaderboardEntry } from "@/types/api";
import { HeroActionPanel, type HeroStatusChip } from "@/components/home/HeroActionPanel";
import { QuickAccessCard } from "@/components/home/QuickAccessCard";
import styles from "@/components/home/HomePage.module.css";

const HomeAnimatedBackground = dynamic(
  () => import("@/components/background/AnimatedBackground"),
  { ssr: false }
);

const displayFont = Orbitron({
  subsets: ["latin"],
  weight: ["700", "800"],
});

const bodyFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type AudioInputState = "checking" | "ready" | "missing" | "unsupported";

interface ProfileScore {
  levelId?: string;
  score?: number;
  accuracy?: number;
  createdAt?: string;
}

interface ProfilePayload {
  user?: {
    username?: string;
    avatarColor?: string;
    avatarUrl?: string | null;
    currentStreak?: number;
  };
  scores?: ProfileScore[];
}

interface LastRunSummary {
  levelId: string;
  score: number;
  accuracy: number;
  createdAt: string;
}

function parseStoredLastRun(value: string | null): LastRunSummary | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<LastRunSummary>;
    if (
      typeof parsed.levelId !== "string" ||
      typeof parsed.score !== "number" ||
      typeof parsed.accuracy !== "number"
    ) {
      return null;
    }

    return {
      levelId: parsed.levelId,
      score: parsed.score,
      accuracy: parsed.accuracy,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function readStoredCalibrationFlag(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const storedCalibration =
      localStorage.getItem("guitarverse_calibration_ready") ??
      localStorage.getItem("guitarverse-calibration-ready");
    return storedCalibration === "true";
  } catch {
    return false;
  }
}

function getInitialAudioInputState(): AudioInputState {
  if (typeof navigator === "undefined") return "unsupported";
  return navigator.mediaDevices?.enumerateDevices ? "checking" : "unsupported";
}

export default function Home() {
  const { data: session, status } = useSession();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState("#5be6ff");
  const [audioInputState, setAudioInputState] = useState<AudioInputState>(getInitialAudioInputState);
  const [calibrationReady, setCalibrationReady] = useState(readStoredCalibrationFlag);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [lastRun, setLastRun] = useState<LastRunSummary | null>(() => {
    if (typeof window === "undefined") return null;
    return parseStoredLastRun(localStorage.getItem("guitarverse_last_run"));
  });
  const [leaderboardPreview, setLeaderboardPreview] = useState<LeaderboardEntry[]>([]);
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  const heroPanelRef = useRef<HTMLDivElement | null>(null);

  const levelById = useMemo(() => {
    return new Map(mockLevels.map((level) => [level.id, level]));
  }, []);

  const defaultPlayLevelId = useMemo(() => {
    return mockLevels.find((level) => level.id === "g_scale")?.id ?? mockLevels[0]?.id ?? "g_scale";
  }, []);

  const challengeLevel = useMemo(() => {
    if (mockLevels.length === 0) return null;
    const dateKey = new Date().toISOString().slice(0, 10);
    const hash = Array.from(dateKey).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return mockLevels[hash % mockLevels.length];
  }, []);

  const featuredLevel = useMemo(() => {
    return mockLevels.find((level) => level.category === "songs") ?? mockLevels[0] ?? null;
  }, []);

  const displayName = session?.user?.name ?? session?.user?.email ?? "Guest";
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const lastRunTitle = lastRun ? levelById.get(lastRun.levelId)?.title ?? lastRun.levelId : null;
  const playNowHref = `/game/${lastRun?.levelId ?? defaultPlayLevelId}`;
  const continueHref = lastRun ? `/game/${lastRun.levelId}` : undefined;
  const shownAvatarUrl = status === "authenticated" ? avatarUrl : null;
  const shownAvatarColor = status === "authenticated" ? avatarColor : "#5be6ff";
  const shownStreak = status === "authenticated" ? currentStreak : 0;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    motionQuery.addEventListener("change", onMotionChange);
    return () => motionQuery.removeEventListener("change", onMotionChange);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    const fetchProfile = async () => {
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as ProfilePayload;
        if (cancelled) return;

        if (typeof data.user?.avatarColor === "string") {
          setAvatarColor(data.user.avatarColor);
        }

        if (typeof data.user?.avatarUrl === "string" || data.user?.avatarUrl === null) {
          setAvatarUrl(data.user.avatarUrl ?? null);
        }

        if (typeof data.user?.currentStreak === "number") {
          setCurrentStreak(data.user.currentStreak);
        }

        const latestScore = data.scores?.find((score) => typeof score.levelId === "string");
        if (
          latestScore &&
          typeof latestScore.levelId === "string" &&
          typeof latestScore.score === "number" &&
          typeof latestScore.accuracy === "number"
        ) {
          setLastRun({
            levelId: latestScore.levelId,
            score: latestScore.score,
            accuracy: latestScore.accuracy,
            createdAt:
              typeof latestScore.createdAt === "string"
                ? latestScore.createdAt
                : new Date().toISOString(),
          });
          setCalibrationReady(true);
        }
      } catch {
        // Ignore profile failures and keep a usable guest-like home screen.
      }
    };

    void fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;

    const mediaDevices = navigator.mediaDevices;
    let active = true;

    const refreshInputState = async () => {
      try {
        const devices = await mediaDevices.enumerateDevices();
        if (!active) return;
        const hasInput = devices.some((device) => device.kind === "audioinput");
        setAudioInputState(hasInput ? "ready" : "missing");
      } catch {
        if (active) setAudioInputState("missing");
      }
    };

    void refreshInputState();

    const onDeviceChange = () => {
      void refreshInputState();
    };

    mediaDevices.addEventListener("devicechange", onDeviceChange);

    return () => {
      active = false;
      mediaDevices.removeEventListener("devicechange", onDeviceChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchLeaderboardPreview = async () => {
      try {
        const response = await fetch("/api/scores?limit=3", { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as GetLeaderboardResponse;
        if (!cancelled && Array.isArray(payload.entries)) {
          setLeaderboardPreview(payload.entries.slice(0, 3));
        }
      } catch {
        // Keep this section empty when leaderboard data is unavailable.
      }
    };

    void fetchLeaderboardPreview();

    return () => {
      cancelled = true;
    };
  }, []);

  const statusChips = useMemo<HeroStatusChip[]>(() => {
    const inputChip: HeroStatusChip = (() => {
      switch (audioInputState) {
        case "ready":
          return { label: "Input", value: "Connected", tone: "good" };
        case "missing":
          return { label: "Input", value: "Not Detected", tone: "warn" };
        case "unsupported":
          return { label: "Input", value: "Browser Limited", tone: "warn" };
        default:
          return { label: "Input", value: "Scanning", tone: "neutral" };
      }
    })();

    const calibrationChip: HeroStatusChip = calibrationReady
      ? { label: "Calibration", value: "Ready", tone: "good" }
      : { label: "Calibration", value: "Needs Setup", tone: "warn" };

    const progressChip: HeroStatusChip = lastRun
      ? {
          label: "Last Score",
          value: `${lastRun.score.toLocaleString()} pts`,
          tone: "good",
        }
      : status === "authenticated"
      ? {
          label: "Streak",
          value: `${shownStreak} day${shownStreak === 1 ? "" : "s"}`,
          tone: shownStreak > 0 ? "good" : "neutral",
        }
      : { label: "Mode", value: "Guest Session", tone: "neutral" };

    return [inputChip, calibrationChip, progressChip];
  }, [audioInputState, calibrationReady, lastRun, shownStreak, status]);

  const handleHeroPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || event.pointerType === "touch") return;

    const panel = heroPanelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    const offsetX = (event.clientX - rect.left) / rect.width - 0.5;
    const offsetY = (event.clientY - rect.top) / rect.height - 0.5;

    panel.style.setProperty("--hero-tilt-x", `${(-offsetY * 4).toFixed(2)}deg`);
    panel.style.setProperty("--hero-tilt-y", `${(offsetX * 6).toFixed(2)}deg`);
  };

  const handleHeroPointerLeave = () => {
    const panel = heroPanelRef.current;
    if (!panel) return;
    panel.style.setProperty("--hero-tilt-x", "0deg");
    panel.style.setProperty("--hero-tilt-y", "0deg");
  };

  return (
    <main className={`${styles.homePage} ${bodyFont.className}`}>
      <div className={styles.backgroundBase} />
      <HomeAnimatedBackground className={styles.particlesLayer} mode={0} intensity={1} />
      <div className={styles.noiseLayer} />
      <div className={styles.vignetteLayer} />

      <div className={styles.contentLayer}>
        <header className={styles.topNavShell}>
          <nav className={styles.topNav} aria-label="Main navigation">
            <Link href="/" className={`${styles.brandLink} ${displayFont.className}`}>
              <span className={styles.brandGlyph} aria-hidden="true" />
              Guitarverse
            </Link>

            <div className={styles.navLinks}>
              <Link href="/create-level" className={styles.navLink}>
                Create Level
              </Link>
              <Link href="/leaderboard" className={styles.navLink}>
                Leaderboard
              </Link>
              <Link href="/topsongs" className={styles.navLink}>
                Library
              </Link>
            </div>

            <div className={styles.navRight}>
              <Link
                href={status === "authenticated" ? "/profile" : "/login"}
                className={styles.navIconButton}
                aria-label="Open settings"
              >
                <Settings2 size={15} aria-hidden="true" />
              </Link>

              {status === "loading" ? (
                <div className={styles.loadingPill} aria-hidden="true" />
              ) : status === "authenticated" ? (
                <>
                  <Link href="/profile" className={styles.profileLink}>
                    <span
                      className={styles.avatarBubble}
                      style={{ background: shownAvatarUrl ? "transparent" : shownAvatarColor }}
                    >
                      {shownAvatarUrl ? <img src={shownAvatarUrl} alt={avatarInitial} /> : avatarInitial}
                    </span>
                    <span className={styles.profileName}>{displayName}</span>
                  </Link>
                  <button
                    type="button"
                    className={`${styles.authButton} ${styles.authButtonGhost} ${styles.authButtonDanger}`}
                    onClick={() => {
                      void signOut({ callbackUrl: "/" });
                    }}
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className={`${styles.authButton} ${styles.authButtonGhost}`}>
                    Login
                  </Link>
                  <Link href="/register" className={styles.authButton}>
                    Join
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>

        <HeroActionPanel
          title="Plug In. Lock In. Play."
          subtitle="Guitarverse is a rhythm game playground where you can chase timing, sharpen technique, and build your own levels."
          displayClassName={displayFont.className}
          playHref={playNowHref}
          practiceHref="/campaign"
          createHref="/create-level"
          continueHref={continueHref}
          continueText={lastRunTitle ? `Continue ${lastRunTitle}` : "Continue Last Session"}
          statusChips={statusChips}
          panelRef={heroPanelRef}
          onPanelPointerMove={handleHeroPointerMove}
          onPanelPointerLeave={handleHeroPointerLeave}
        />

        <section className={styles.quickSection} aria-labelledby="quick-access-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Quick Access</p>
            <h2 id="quick-access-title" className={`${styles.sectionTitle} ${displayFont.className}`}>
              Choose Your Next Run
            </h2>
            <p className={styles.sectionSubtext}>
              Home now opens as an action hub, with fast routes into play, practice, and creation instead of
              a full catalog grid.
            </p>
          </div>

          <div className={styles.quickGrid}>
            <QuickAccessCard
              label={lastRun ? "Continue Last Run" : "Start Run"}
              title={lastRunTitle ? `Continue ${lastRunTitle}` : "Launch a Fresh Session"}
              meta={
                lastRun
                  ? `${lastRun.score.toLocaleString()} pts • ${Math.round(lastRun.accuracy)}% accuracy`
                  : "Jump in immediately and set a baseline score."
              }
              actionLabel={lastRun ? "Resume Session" : "Play Now"}
              href={playNowHref}
              accent="cyan"
              icon={<Activity size={17} aria-hidden="true" />}
            />

            <QuickAccessCard
              label="Daily Challenge"
              title={challengeLevel ? challengeLevel.title : "Signal Warmup"}
              meta={
                challengeLevel
                  ? `${challengeLevel.bpm} BPM • ${challengeLevel.difficulty ?? "mixed"}`
                  : "A rotating challenge level refreshed each day."
              }
              actionLabel="Open Challenge"
              href={challengeLevel ? `/game/${challengeLevel.id}` : playNowHref}
              accent="lime"
              icon={<Gauge size={17} aria-hidden="true" />}
            />

            <QuickAccessCard
              label="Browse Levels"
              title={featuredLevel ? `Featured: ${featuredLevel.title}` : "Community Spotlight"}
              meta={
                featuredLevel
                  ? `${featuredLevel.artist ?? "Community"} • ${featuredLevel.category ?? "mixed"}`
                  : "Explore what the community is playing this week."
              }
              actionLabel="Open Library"
              href="/topsongs"
              accent="magenta"
              icon={<Layers3 size={17} aria-hidden="true" />}
            />
          </div>
        </section>

        <section className={styles.stripSection} aria-label="Community pulse">
          <div className={styles.stripGrid}>
            <article className={styles.stripPanel}>
              <p className={styles.stripLabel}>Leaderboard Preview</p>
              <h3 className={styles.stripTitle}>Top Players Right Now</h3>

              {leaderboardPreview.length > 0 ? (
                <ol className={styles.leaderList}>
                  {leaderboardPreview.map((entry) => (
                    <li key={`${entry.userId}-${entry.rank}`} className={styles.leaderItem}>
                      <div className={styles.leaderIdentity}>
                        <span className={styles.leaderRank}>{entry.rank}</span>
                        <span className={styles.leaderName}>{entry.playerName}</span>
                      </div>
                      <span className={styles.leaderMeta}>{entry.score.toLocaleString()} pts</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.emptyHint}>No posted runs yet. Set the first high score.</p>
              )}

              <Link href="/leaderboard" className={styles.stripAction}>
                Open Leaderboard
                <Trophy size={14} aria-hidden="true" />
              </Link>
            </article>

            <article className={styles.stripPanel}>
              <p className={styles.stripLabel}>Core Loop</p>
              <h3 className={styles.stripTitle}>Play. Track. Create.</h3>

              <div className={styles.loopSteps}>
                <div className={styles.loopStep}>
                  <span className={styles.loopStepLabel}>Play Runs</span>
                  <span className={styles.loopStepHint}>Hit notes, chase timing.</span>
                </div>
                <div className={styles.loopStep}>
                  <span className={styles.loopStepLabel}>Practice Mode</span>
                  <span className={styles.loopStepHint}>Dial in consistency.</span>
                </div>
                <div className={styles.loopStep}>
                  <span className={styles.loopStepLabel}>Create Levels</span>
                  <span className={styles.loopStepHint}>Publish your own charts.</span>
                </div>
              </div>

              <Link href="/create-level" className={styles.stripAction}>
                Build New Level
                <UserCircle2 size={14} aria-hidden="true" />
              </Link>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
