"use client";

import { useEffect, useRef, useState } from "react";
import type { Level, Note } from "@/types/game";

interface FallingNote extends Note {
  displayId: string;
  y: number;
  clicked: boolean;
}

interface GameStats {
  hits: number;
  misses: number;
  score: number;
  accuracy: number;
}

interface FallingNotesProps {
  level: Level;
  onGameEnd?: (stats: GameStats) => void;
}

export default function FallingNotes({ level, onGameEnd }: FallingNotesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameActive, setGameActive] = useState(true);
  const [stats, setStats] = useState<GameStats>({
    hits: 0,
    misses: 0,
    score: 0,
    accuracy: 0,
  });

  const gameStateRef = useRef({
    fallingNotes: [] as FallingNote[],
    gameTime: 0,
    nextNoteIndex: 0,
    hits: 0,
    misses: 0,
    score: 0,
  });

  const LANE_WIDTH = 150;
  const LANES = 4;
  const NOTE_RADIUS = 25;
  const FALL_SPEED = 2; // pixels per frame
  const HIT_ZONE_Y = 80; // Bottom area where you can click notes

  // Convert frequency to lane number
  function hzToLane(hz: number): number {
    const minHz = 100;
    const maxHz = 800;
    const normalized = (hz - minHz) / (maxHz - minHz);
    return Math.floor(Math.max(0, Math.min(LANES - 1, normalized * LANES)));
  }

  // Get lane center X position
  function getLaneX(lane: number): number {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const laneWidth = canvas.width / LANES;
    return (lane + 0.5) * laneWidth;
  }

  // Handle canvas clicks
  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const state = gameStateRef.current;

    // Check if click hits any note in the hit zone
    for (const note of state.fallingNotes) {
      if (note.clicked) continue;

      const laneX = getLaneX(hzToLane(note.targetHz));
      const distance = Math.hypot(x - laneX, y - note.y);

      if (distance < NOTE_RADIUS && note.y > canvas.height - HIT_ZONE_Y - NOTE_RADIUS * 2) {
        note.clicked = true;
        state.hits++;
        state.score += Math.max(0, 100 - Math.abs(y - (canvas.height - HIT_ZONE_Y)));

        setStats((prev) => ({
          ...prev,
          hits: state.hits,
          score: state.score,
          accuracy: state.hits + state.misses > 0 ? (state.hits / (state.hits + state.misses)) * 100 : 0,
        }));
        break;
      }
    }
  }

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const state = gameStateRef.current;

    const gameLoop = () => {
      state.gameTime += 1;

      // Add new notes
      while (state.nextNoteIndex < level.notes.length) {
        const nextNote = level.notes[state.nextNoteIndex];
        if (nextNote.startMs <= state.gameTime) {
          state.fallingNotes.push({
            ...nextNote,
            displayId: `${nextNote.id}-${state.gameTime}`,
            y: -NOTE_RADIUS,
            clicked: false,
          });
          state.nextNoteIndex++;
        } else {
          break;
        }
      }

      // Update falling notes
      for (let i = state.fallingNotes.length - 1; i >= 0; i--) {
        const note = state.fallingNotes[i];
        note.y += FALL_SPEED;

        // Check if note passed the hit zone without being clicked
        if (note.y > canvas.height && !note.clicked) {
          state.misses++;
          setStats((prev) => ({
            ...prev,
            misses: state.misses,
            accuracy: state.hits + state.misses > 0 ? (state.hits / (state.hits + state.misses)) * 100 : 0,
          }));
          state.fallingNotes.splice(i, 1);
        }
      }

      // Clear canvas
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw lane separators
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      const laneWidth = canvas.width / LANES;
      for (let i = 1; i < LANES; i++) {
        ctx.beginPath();
        ctx.moveTo(i * laneWidth, 0);
        ctx.lineTo(i * laneWidth, canvas.height);
        ctx.stroke();
      }

      // Draw hit zone
      ctx.fillStyle = "rgba(34, 197, 94, 0.1)";
      ctx.fillRect(0, canvas.height - HIT_ZONE_Y, canvas.width, HIT_ZONE_Y);

      ctx.strokeStyle = "rgba(34, 197, 94, 0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height - HIT_ZONE_Y);
      ctx.lineTo(canvas.width, canvas.height - HIT_ZONE_Y);
      ctx.stroke();

      // Draw falling notes
      for (const note of state.fallingNotes) {
        const laneX = getLaneX(hzToLane(note.targetHz));

        // Note circle
        ctx.fillStyle = note.clicked ? "rgba(100, 100, 100, 0.5)" : "#888888";
        ctx.beginPath();
        ctx.arc(laneX, note.y, NOTE_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Glow effect
        ctx.strokeStyle = note.clicked ? "rgba(100, 100, 100, 0.8)" : "rgba(150, 150, 150, 0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Note label
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(note.targetHz.toFixed(0), laneX, note.y);
      }

      // Check if game is over
      if (state.nextNoteIndex >= level.notes.length && state.fallingNotes.length === 0) {
        setGameActive(false);
        onGameEnd?.(stats);
      } else if (gameActive) {
        animationId = requestAnimationFrame(gameLoop);
      }
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => cancelAnimationFrame(animationId);
  }, [gameActive, level, onGameEnd, stats]);

  return (
    <div className="flex flex-col items-center justify-center">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onClick={handleCanvasClick}
        className="w-full max-w-4xl border-2 border-gray-700 rounded-lg cursor-crosshair bg-slate-950"
      />

      {/* Stats Display */}
      <div className="mt-6 grid grid-cols-4 gap-4 w-full max-w-4xl">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
          <div className="text-gray-400 text-sm">Hits</div>
          <div className="text-3xl font-bold text-gray-200">{stats.hits}</div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
          <div className="text-gray-400 text-sm">Misses</div>
          <div className="text-3xl font-bold text-gray-200">{stats.misses}</div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
          <div className="text-gray-400 text-sm">Accuracy</div>
          <div className="text-3xl font-bold text-gray-200">{stats.accuracy.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
          <div className="text-gray-400 text-sm">Score</div>
          <div className="text-3xl font-bold text-gray-200">{stats.score}</div>
        </div>
      </div>

      {!gameActive && (
        <div className="mt-6 bg-gray-900 border border-gray-700 rounded-lg p-6 text-center">
          <h2 className="text-2xl font-bold text-white">Game Over!</h2>
          <p className="text-gray-400 mt-2">Final Score: {stats.score}</p>
          <p className="text-gray-400">Accuracy: {stats.accuracy.toFixed(1)}%</p>
        </div>
      )}
    </div>
  );
}
