// app/leaderboard/page.tsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Orbitron, Space_Grotesk } from "next/font/google";
import { Button } from "@/components/ui/Button";
import type { LeaderboardEntry, GetLeaderboardResponse } from "@/types/api";
import { Trophy, Users, Target, ArrowLeft, RefreshCw } from "lucide-react";

const displayFont = Orbitron({
  subsets: ["latin"],
  weight: ["700", "800"],
});

const bodyFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

function getGrade(accuracy: number): { letter: string; color: string } {
  if (accuracy === 100) return { letter: "S", color: "#facc15" };
  if (accuracy >= 90)   return { letter: "A", color: "#22c55e" };
  if (accuracy >= 75)   return { letter: "B", color: "#3b82f6" };
  if (accuracy >= 60)   return { letter: "C", color: "#f97316" };
  return                       { letter: "D", color: "#ef4444" };
}

function PlayerAvatar({
  name,
  color,
  avatarUrl,
  size = 36,
}: {
  name: string;
  color?: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const bg = color ?? "#5be6ff";
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-full flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: avatarUrl ? "transparent" : bg,
        boxShadow: `0 0 15px ${bg}40`,
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="font-black text-black" style={{ fontSize: size * 0.4 }}>
          {name[0].toUpperCase()}
        </span>
      )}
    </div>
  );
}

const rankBadge: Record<number, { emoji: string; color: string }> = {
  1: { emoji: "🥇", color: "#facc15" },
  2: { emoji: "🥈", color: "#94a3b8" },
  3: { emoji: "🥉", color: "#b45309" },
};

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  useEffect(() => {
    void fetchLeaderboard();
  }, [levelFilter]);

  async function fetchLeaderboard() {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (levelFilter) params.append("levelId", levelFilter);
      params.append("limit", "100");

      const res = await fetch(`/api/scores?${params}`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");

      const data = await res.json() as GetLeaderboardResponse;
      setLeaderboard(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const topScore = leaderboard[0]?.score ?? 0;
  const avgAccuracy = leaderboard.length > 0
    ? (leaderboard.reduce((s, e) => s + e.accuracy, 0) / leaderboard.length).toFixed(1)
    : "—";

  return (
    <main className={`min-h-screen bg-[#0a0a0a] ${bodyFont.className}`}>
      {/* Background Layers */}
      <div className="fixed inset-0 bg-gradient-to-br from-zinc-900 via-black to-zinc-900" />
      <div className="fixed inset-0 opacity-20" style={{
        backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'radial-gradient(circle at 50% 50%, transparent 0%, rgba(0,0,0,0.8) 100%)',
      }} />

      {/* Content */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
            <Link href="/" className="group flex items-center gap-2">
              <span className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#5be6ff] via-[#c45eff] to-[#ff9e5b] ${displayFont.className}`}>
                Guitarverse
              </span>
            </Link>
            <div className="flex gap-3">
              <Link href="/">
                <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/5">
                  <ArrowLeft size={16} className="mr-2" />
                  Home
                </Button>
              </Link>
              <Link href="/game/g_scale">
                <Button className="bg-gradient-to-r from-[#5be6ff] to-[#c45eff] text-black font-bold hover:opacity-90 transition-opacity">
                  Play Now
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        <div className="mx-auto max-w-7xl px-6 py-12">
          {/* Header */}
          <div className="mb-12 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Trophy className="w-8 h-8 text-[#5be6ff]" />
              <h2 className={`text-5xl font-black text-white ${displayFont.className}`}>
                Global Leaderboard
              </h2>
            </div>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              The fastest fingers, the tightest timing. Who will claim the top spot?
            </p>
          </div>

          {/* Filter Bar */}
          <div className="mb-10 flex flex-wrap gap-4 items-end justify-between">
            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="block text-sm font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
                  Filter by Level
                </label>
                <input
                  type="text"
                  placeholder="Level ID (leave empty for all)"
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-[#5be6ff] transition-colors w-64"
                />
              </div>
              <Button
                onClick={() => void fetchLeaderboard()}
                variant="outline"
                className="border-white/10 text-white hover:bg-white/5 self-end"
              >
                <RefreshCw size={16} className="mr-2" />
                Refresh
              </Button>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="text-zinc-400">Total Players</div>
                <div className="text-2xl font-bold text-white">{leaderboard.length}</div>
              </div>
              <div className="text-center">
                <div className="text-zinc-400">Top Score</div>
                <div className="text-2xl font-bold text-[#5be6ff]">{topScore.toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-zinc-400">Avg Accuracy</div>
                <div className="text-2xl font-bold text-[#c45eff]">{avgAccuracy}%</div>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-16 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#5be6ff]" />
              <p className="text-zinc-400 mt-4">Loading leaderboard...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mb-8">
              <p className="text-red-300 font-semibold">Error: {error}</p>
            </div>
          )}

          {/* Podium Section */}
          {!loading && leaderboard.length >= 3 && (
            <div className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              {[leaderboard[1], leaderboard[0], leaderboard[2]].map((entry, idx) => {
                if (!entry) return null;
                const isFirst = entry.rank === 1;
                const badge = rankBadge[entry.rank];
                const grade = getGrade(entry.accuracy);
                
                // Reorder for visual podium (2nd, 1st, 3rd)
                const order = idx === 0 ? "md:order-1" : idx === 1 ? "md:order-2" : "md:order-3";
                const height = idx === 0 ? "h-64" : idx === 1 ? "h-72" : "h-56";

                return (
                  <Link
                    key={entry.userId}
                    href={`/profile/${entry.playerName}`}
                    className={`group ${order}`}
                  >
                    <div className={`bg-gradient-to-b from-white/5 to-white/0 border border-white/10 rounded-2xl p-6 ${height} flex flex-col items-center justify-end transition-all duration-300 hover:border-[${badge.color}]/50 hover:scale-105`}>
                      <div className="text-4xl mb-3">{badge.emoji}</div>
                      <PlayerAvatar
                        name={entry.playerName}
                        color={entry.avatarColor}
                        avatarUrl={entry.avatarUrl}
                        size={isFirst ? 64 : 48}
                      />
                      <div className="mt-4 text-center">
                        <div className="font-bold text-white mb-1">{entry.playerName}</div>
                        <div className="text-2xl font-black" style={{ color: badge.color }}>
                          {entry.score.toLocaleString()}
                        </div>
                        <div className="text-sm mt-2" style={{ color: grade.color }}>
                          {entry.accuracy.toFixed(1)}% accuracy
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Full Leaderboard Table */}
          {!loading && leaderboard.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-white/5 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/10">
                <div className="col-span-1">Rank</div>
                <div className="col-span-4">Player</div>
                <div className="col-span-2">Score</div>
                <div className="col-span-2">Accuracy</div>
                <div className="col-span-1 text-right">Hits</div>
                <div className="col-span-1 text-right">Miss</div>
                <div className="col-span-1">Date</div>
              </div>

              {/* Table Rows */}
              {leaderboard.map((entry, index) => {
                const grade = getGrade(entry.accuracy);
                const badge = rankBadge[entry.rank];

                return (
                  <Link
                    key={`${entry.userId}-${entry.levelId}`}
                    href={`/profile/${entry.playerName}`}
                    className="block group"
                    onMouseEnter={() => setHoveredRow(index)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <div className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-all duration-200 ${
                      hoveredRow === index 
                        ? 'bg-gradient-to-r from-[#5be6ff]/10 via-transparent to-transparent border-l-2 border-[#5be6ff]' 
                        : index % 2 === 0 ? 'bg-white/5' : 'bg-transparent'
                    }`}>
                      {/* Rank */}
                      <div className="col-span-1">
                        {entry.rank <= 3 ? (
                          <span className="text-2xl">{badge?.emoji}</span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-sm font-bold text-zinc-300">
                            {entry.rank}
                          </span>
                        )}
                      </div>

                      {/* Player */}
                      <div className="col-span-4 flex items-center gap-3">
                        <PlayerAvatar
                          name={entry.playerName}
                          color={entry.avatarColor}
                          avatarUrl={entry.avatarUrl}
                          size={40}
                        />
                        <div>
                          <div className={`font-bold text-white group-hover:text-[#5be6ff] transition-colors`}>
                            {entry.playerName}
                          </div>
                          {hoveredRow === index && (
                            <div className="text-xs text-zinc-500">View Profile →</div>
                          )}
                        </div>
                      </div>

                      {/* Score */}
                      <div className="col-span-2 font-bold text-white">
                        {entry.score.toLocaleString()}
                      </div>

                      {/* Accuracy with progress bar */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${entry.accuracy}%`,
                                background: `linear-gradient(90deg, ${grade.color}80, ${grade.color})`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold min-w-[45px]" style={{ color: grade.color }}>
                            {entry.accuracy.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="col-span-1 text-right text-[#22c55e] font-medium">{entry.hits}</div>
                      <div className="col-span-1 text-right text-[#ef4444] font-medium">{entry.misses}</div>
                      <div className="col-span-1 text-xs text-zinc-500">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!loading && leaderboard.length === 0 && !error && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-16 text-center">
              <Users className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-300 text-lg mb-6">
                No scores yet — be the first to claim the top spot!
              </p>
              <Link href="/game/g_scale">
                <Button className="bg-gradient-to-r from-[#5be6ff] to-[#c45eff] text-black font-bold hover:opacity-90 transition-opacity">
                  Start Playing
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}