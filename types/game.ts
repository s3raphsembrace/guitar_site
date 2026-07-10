export interface Note {
  id: string;
  targetHz: number;
  startMs: number;
  durationMs: number;
}

export interface Level {
  id: string;
  title: string;
  artist?: string;
  bpm: number;
  notes: Note[];
  difficulty?: "easy" | "medium" | "hard";
  category?: string;
  durationMs?: number;
  albumCover?: string;
}

export type GameMode = "easy" | "medium" | "hard";

export interface Room {
  code: string;
  levelId: string;
  players: Player[];
  status: "waiting" | "playing" | "finished";
}

export interface Player {
  id: string;
  name: string;
  score: number;
}

export interface GameSession {
  roomCode: string;
  level: Level;
  players: Player[];
  startedAt: number;
}
