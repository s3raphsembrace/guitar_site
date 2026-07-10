// app/page.tsx

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useState, useMemo, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { mockLevels } from "@/lib/game/mockLevels";
import type { Level } from "@/types/game";

interface FilteredLevel extends Level {
  difficulty: "easy" | "medium" | "hard";
  category: string;
  durationMs: number;
}

// ─── Navbar Auth Section ──────────────────────────────────────────────────────

function NavAuth() {
  const { data: session, status } = useSession();

  useEffect(() => {
    console.log("[NAV] Session status:", status, session?.user ?? "no user");
  }, [status, session]);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2">
        <div className="w-24 h-8 bg-zinc-800 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (status === "authenticated" && session?.user) {
    return (
      <div className="flex items-center gap-3">
        {/* Avatar circle */}
        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-black font-bold text-sm select-none">
          {(session.user.name ?? session.user.email ?? "?")[0].toUpperCase()}
        </div>

        {/* Username */}
        <span className="text-emerald-400 font-semibold text-sm hidden sm:block font-mono">
          {session.user.name ?? session.user.email}
        </span>

        {/* Log out */}
        <button
          onClick={() => {
            console.log("[NAV] 🔴 Logging out:", session.user.name);
            void signOut({ callbackUrl: "/" });
          }}
          className="text-xs font-semibold text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-800 px-3 py-1.5 rounded-lg transition-colors"
        >
          Log Out
        </button>
      </div>
    );
  }

  // Unauthenticated
  return (
    <div className="flex gap-2">
      <Link href="/login">
        <Button variant="ghost" size="sm">
          Login
        </Button>
      </Link>
      <Link href="/register">
        <Button size="sm">Sign Up</Button>
      </Link>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [selectedDuration, setSelectedDuration] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const genres = useMemo<string[]>(() => {
    const categories = Array.from(
      new Set(
        mockLevels
          .filter((level) => level.category)
          .map((level) => level.category as string)
      )
    );
    return categories.sort();
  }, []);

  const filteredLevels = useMemo<FilteredLevel[]>(() => {
    return mockLevels
      .filter((level): level is FilteredLevel => {
        return (
          level.difficulty !== undefined &&
          level.category !== undefined &&
          level.durationMs !== undefined
        );
      })
      .filter((level) => {
        if (selectedDifficulty !== "all" && level.difficulty !== selectedDifficulty) return false;
        if (selectedGenre !== "all" && level.category !== selectedGenre) return false;
        if (selectedDuration !== "all") {
          const durationMinutes = level.durationMs / 60000;
          if (selectedDuration === "short" && durationMinutes > 3) return false;
          if (selectedDuration === "medium" && (durationMinutes <= 2 || durationMinutes > 5)) return false;
          if (selectedDuration === "long" && durationMinutes <= 4) return false;
        }
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const titleMatch = level.title.toLowerCase().includes(query);
          const artistMatch = (level.artist ?? "").toLowerCase().includes(query);
          if (!titleMatch && !artistMatch) return false;
        }
        return true;
      });
  }, [selectedDifficulty, selectedGenre, selectedDuration, searchQuery]);

  const getDifficultyStars = (difficulty: "easy" | "medium" | "hard") => {
    return { easy: "⭐", medium: "⭐⭐", hard: "⭐⭐⭐" }[difficulty] ?? "";
  };

  const getDifficultyColor = (difficulty: "easy" | "medium" | "hard") => {
    return {
      easy: "from-green-500/10 to-green-600/5 border-green-500/30",
      medium: "from-yellow-500/10 to-yellow-600/5 border-yellow-500/30",
      hard: "from-red-500/10 to-red-600/5 border-red-500/30",
    }[difficulty] ?? "from-zinc-500/10 to-zinc-600/5 border-zinc-500/30";
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleResetFilters = () => {
    setSelectedDifficulty("all");
    setSelectedGenre("all");
    setSelectedDuration("all");
    setSearchQuery("");
  };

  const isFiltered = () =>
    selectedDifficulty !== "all" ||
    selectedGenre !== "all" ||
    selectedDuration !== "all" ||
    searchQuery.trim().length > 0;

  return (
    <main
      className="min-h-screen"
      style={{
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(8px)",
        fontFamily: "'Courier New', monospace",
        color: "#f0f0f0",
      }}
    >
      {/* ── Navigation Bar ── */}
      <nav className="border-b border-[#1f2937] bg-[#0d1117]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white font-mono">🎸 Guitarverse</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/leaderboard">
              <Button variant="ghost" size="sm">
                Leaderboard
              </Button>
            </Link>
            <NavAuth />
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-white mb-4 font-mono tracking-wide">
            Master Your Pitch Accuracy
          </h2>
          <p className="text-xl text-zinc-300 mb-8 max-w-2xl mx-auto">
            Select a song below, practice scales, chords, and techniques to improve your guitar skills.
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <input
            type="text"
            placeholder="Search songs or artists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0b1114] border border-[#1f2937] rounded-lg px-6 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-3">Difficulty</label>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Levels</option>
              <option value="easy">Easy (⭐)</option>
              <option value="medium">Medium (⭐⭐)</option>
              <option value="hard">Hard (⭐⭐⭐)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-3">Genre</label>
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Genres</option>
              {genres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre.charAt(0).toUpperCase() + genre.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-3">Duration</label>
            <select
              value={selectedDuration}
              onChange={(e) => setSelectedDuration(e.target.value)}
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Durations</option>
              <option value="short">Short (0–3 min)</option>
              <option value="medium">Medium (2–5 min)</option>
              <option value="long">Long (4+ min)</option>
            </select>
          </div>

          <div className="flex items-end">
            <div className="w-full bg-[#07110d] border border-[#113524] rounded-lg px-4 py-2">
              <p className="text-emerald-400 font-semibold text-center">
                {filteredLevels.length} Song{filteredLevels.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {isFiltered() && (
          <div className="mb-8">
            <button
              onClick={handleResetFilters}
              className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold underline"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Songs Grid */}
        {filteredLevels.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {filteredLevels.map((level) => (
              <Link key={level.id} href={`/game/${level.id}`}>
                <div
                  className={`bg-gradient-to-br ${getDifficultyColor(
                    level.difficulty
                  )} border rounded-xl overflow-hidden hover:shadow-lg hover:shadow-emerald-500/20 transition-all cursor-pointer transform hover:scale-105`}
                >
                  <div className="relative w-full h-40 bg-zinc-700 overflow-hidden">
                    {level.albumCover ? (
                      <img
                        src={level.albumCover}
                        alt={level.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🎸</div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1">
                      <span className="text-lg">{getDifficultyStars(level.difficulty)}</span>
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">{level.title}</h3>
                    <p className="text-sm text-zinc-400 mb-4">{level.artist || "Unknown Artist"}</p>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-black/30 rounded-lg p-2">
                        <p className="text-xs text-zinc-400">BPM</p>
                        <p className="text-sm font-semibold text-white">{level.bpm}</p>
                      </div>
                      <div className="bg-black/30 rounded-lg p-2">
                        <p className="text-xs text-zinc-400">Duration</p>
                        <p className="text-sm font-semibold text-white">{formatDuration(level.durationMs)}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <span className="inline-block bg-zinc-700/50 rounded-full px-3 py-1 text-xs text-zinc-300 capitalize">
                        {level.category}
                      </span>
                    </div>

                    <Button className="w-full" size="sm">Play Now →</Button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-zinc-700 rounded-xl p-12 text-center mb-16">
            <p className="text-zinc-400 text-lg mb-6">No songs match your filters. Try adjusting them!</p>
            <button
              onClick={handleResetFilters}
              className="text-emerald-400 hover:text-emerald-300 font-semibold underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </section>

      {/* Quick Access */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="bg-zinc-900/50 border border-zinc-700 rounded-xl p-8">
          <h3 className="text-2xl font-bold text-white mb-6">Quick Access</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link href="/game/g_scale">
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/30 hover:border-emerald-500/60 rounded-lg p-6 text-center transition-all cursor-pointer hover:shadow-lg hover:shadow-emerald-500/20">
                <div className="text-4xl mb-3">🎮</div>
                <p className="text-white font-semibold">Campaign</p>
                <p className="text-zinc-400 text-sm mt-2">Play single-player levels</p>
              </div>
            </Link>

            <Link href="/login">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 hover:border-blue-500/60 rounded-lg p-6 text-center transition-all cursor-pointer hover:shadow-lg hover:shadow-blue-500/20">
                <div className="text-4xl mb-3">👤</div>
                <p className="text-white font-semibold">Login</p>
                <p className="text-zinc-400 text-sm mt-2">Sign in to your account</p>
              </div>
            </Link>

            <Link href="/leaderboard">
              <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/30 hover:border-amber-500/60 rounded-lg p-6 text-center transition-all cursor-pointer hover:shadow-lg hover:shadow-amber-500/20">
                <div className="text-4xl mb-3">🏆</div>
                <p className="text-white font-semibold">Leaderboard</p>
                <p className="text-zinc-400 text-sm mt-2">Check global rankings</p>
              </div>
            </Link>

            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/30 rounded-lg p-6 text-center">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-white font-semibold">Statistics</p>
              <p className="text-zinc-400 text-sm mt-2">Coming soon</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-700 bg-zinc-950/50 py-8">
        <div className="mx-auto max-w-7xl px-6 text-center text-zinc-400">
          <p>&copy; 2026 GuitarGame. Master your pitch, compete with the world.</p>
        </div>
      </footer>
    </main>
  );
}