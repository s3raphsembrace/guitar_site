"use client";

import type { Level } from "@/types/game";
import Image from "next/image";
import { Star, Music } from "lucide-react";
import { useRouter } from "next/navigation";

interface GameCardProps {
  level: Level;
}

export default function GameCard({ level }: GameCardProps) {
  const router = useRouter();

  const difficultyMap = {
    easy: 1,
    medium: 2,
    hard: 3,
  };

  const stars = difficultyMap[level.difficulty || "easy"];
  const durationMinutes = level.durationMs ? Math.floor(level.durationMs / 60000) : 0;
  const durationSeconds = level.durationMs ? Math.floor((level.durationMs % 60000) / 1000) : 0;
  const durationString = `${durationMinutes}:${durationSeconds.toString().padStart(2, "0")}`;

  const handlePlayClick = () => {
    router.push(`/game/${level.id}`);
  };

  return (
    <div className="group relative bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 h-full flex flex-col">
      {/* Album Cover Background */}
      <div className="relative w-full h-48 bg-gradient-to-b from-gray-700 to-gray-900 overflow-hidden">
        {level.albumCover ? (
          <Image
            src={level.albumCover}
            alt={level.title}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-700 to-gray-900 group-hover:from-gray-600 group-hover:to-gray-800 transition-all">
            <Music className="w-16 h-16 text-white/30" />
          </div>
        )}
        {/* Difficulty Badge */}
        <div className="absolute top-3 right-3 bg-black/70 px-3 py-1 rounded-full flex gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Star
              key={i}
              size={14}
              className={i < stars ? "fill-yellow-400 text-yellow-400" : "text-gray-500"}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        {/* Title and Artist */}
        <h3 className="text-lg font-bold text-white truncate group-hover:text-gray-300 transition-colors">
          {level.title}
        </h3>
        {level.artist && (
          <p className="text-sm text-gray-400 truncate mb-2">{level.artist}</p>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-gray-400 mb-3 mt-auto">
          <div className="flex gap-3">
            <span>♪ {level.bpm} BPM</span>
            <span>⏱ {durationString}</span>
          </div>
        </div>

        {/* Category Badge */}
        {level.category && (
          <div className="mb-3">
            <span className="inline-block bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-full border border-gray-700">
              {level.category}
            </span>
          </div>
        )}

        {/* Play Button */}
        <button
          onClick={handlePlayClick}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 rounded-lg transition-all duration-200 group-hover:shadow-lg"
        >
          Play Now
        </button>
      </div>
    </div>
  );
}