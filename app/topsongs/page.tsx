"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type RecentPlay = {
  userId: string;
  userName: string;
  userImage?: string | null;
  avatarColor?: string;
};

type SongPlayData = {
  _id: string;
  count: number;
  lastPlayed: string;
  recentPlays: RecentPlay[];
};

const SONGS: { id: string; title: string }[] = [
  { id: "g_scale", title: "G Scale" },
  { id: "c_major_scale", title: "C Scale" },
  { id: "apollo_brown_butter", title: "Butter — Apollo Brown" },
];

export default function TopSongsPage() {
  const [songData, setSongData] = useState<Record<string, SongPlayData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlayCounts = async () => {
      try {
        console.log("[TOPSONGS] Fetching play data from MongoDB...");
        const res = await fetch("/api/song-plays");

        if (!res.ok) {
          throw new Error(`Failed to fetch plays: ${res.status}`);
        }

        const data = await res.json();
        console.log("[TOPSONGS] Fetched data:", data);

        const dataMap: Record<string, SongPlayData> = {};

        // Initialize all songs with 0 plays
        SONGS.forEach((s) => {
          dataMap[s.id] = {
            _id: s.id,
            count: 0,
            lastPlayed: new Date().toISOString(),
            recentPlays: [],
          };
        });

        // Update with actual data from MongoDB
        if (data.plays && Array.isArray(data.plays)) {
          data.plays.forEach((play: SongPlayData) => {
            if (dataMap.hasOwnProperty(play._id)) {
              dataMap[play._id] = play;
            }
          });
        }

        setSongData(dataMap);
        setError(null);
        setLoading(false);
      } catch (error) {
        console.error("[TOPSONGS] Error fetching play data:", error);
        setError(String(error));

        // Initialize with empty state on error
        const dataMap: Record<string, SongPlayData> = {};
        SONGS.forEach((s) => {
          dataMap[s.id] = {
            _id: s.id,
            count: 0,
            lastPlayed: new Date().toISOString(),
            recentPlays: [],
          };
        });
        setSongData(dataMap);
        setLoading(false);
      }
    };

    fetchPlayCounts();

    // Refresh data every 10 seconds
    const interval = setInterval(fetchPlayCounts, 10000);
    return () => clearInterval(interval);
  }, []);

  const sorted = [...SONGS].sort(
    (a, b) => (songData[b.id]?.count || 0) - (songData[a.id]?.count || 0)
  );

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-white mb-4">🎵 Top Songs</h1>
        <p className="text-gray-300 mb-6">Loading song play data...</p>
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">🎵 Top Songs</h1>
        <p className="text-gray-400">
          Most frequently played songs. See who's been practicing!
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/50 text-red-200 rounded-lg border border-red-700">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {sorted.map((s, i) => {
          const data = songData[s.id];
          const recentPlayers = data?.recentPlays || [];

          return (
            <Link key={s.id} href={`/game/${s.id}`} className="block">
              <div className="bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border border-zinc-700 rounded-lg p-6 hover:border-emerald-500/50 transition-all hover:shadow-lg hover:shadow-emerald-500/10">
                <div className="flex items-center justify-between gap-6">
                  {/* Left: Rank & Title */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="text-3xl font-bold text-emerald-400 w-10 text-center">
                        #{i + 1}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white truncate">
                          {s.title}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {data?.count || 0} plays
                          {data?.lastPlayed && (
                            <span className="ml-2">
                              • Last played today
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right: Recent Players */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {recentPlayers.length > 0 ? (
                      <>
                        <div className="flex -space-x-3">
                          {recentPlayers.slice(0, 3).map((player, idx) => (
                            <div
                              key={`${s.id}-${idx}`}
                              className="relative w-10 h-10 rounded-full border-2 border-zinc-800 flex items-center justify-center hover:z-10 transition-transform hover:scale-110 flex-shrink-0 cursor-pointer"
                              style={{
                                backgroundColor: player.avatarColor || "#22c55e",
                              }}
                              title={player.userName}
                            >
                              {player.userImage ? (
                                <img
                                  src={player.userImage}
                                  alt={player.userName}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-white text-xs font-bold">
                                  {player.userName?.charAt(0).toUpperCase() ||
                                    "?"}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        {recentPlayers.length > 3 && (
                          <span className="text-xs text-gray-400 bg-zinc-800 px-2 py-1 rounded-full">
                            +{recentPlayers.length - 3}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-gray-500">No plays yet</span>
                    )}
                  </div>
                </div>

                {/* Recent players list on hover */}
                {recentPlayers.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-700">
                    <p className="text-xs text-gray-500 mb-2">Recent Players:</p>
                    <div className="flex flex-wrap gap-2">
                      {recentPlayers.map((player, idx) => (
                        <Link
                          key={`${s.id}-player-${idx}`}
                          href={`/profile/${player.userName}`}
                          className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 rounded-full px-3 py-1 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{
                              backgroundColor: player.avatarColor || "#22c55e",
                            }}
                          >
                            {player.userImage ? (
                              <img
                                src={player.userImage}
                                alt={player.userName}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              player.userName?.charAt(0).toUpperCase() || "?"
                            )}
                          </div>
                          <span className="text-xs text-gray-300 hover:text-white truncate">
                            {player.userName}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {sorted.every((s) => (songData[s.id]?.count || 0) === 0) && (
        <div className="mt-8 text-center py-12 bg-zinc-900/50 border border-zinc-700 rounded-lg">
          <p className="text-gray-400">
            No one has played yet. Be the first to play a song!
          </p>
        </div>
      )}
    </main>
  );
}

