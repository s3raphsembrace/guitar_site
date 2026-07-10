import { ObjectId } from "mongodb";

export interface LevelDocument {
  _id?: ObjectId;
  id: string;
  title: string;
  artist?: string;
  bpm: number;
  difficulty: "easy" | "medium" | "hard";
  category: "scales" | "chords" | "arpeggios" | "techniques" | "songs";
  durationMs: number;
  albumCover?: string;
  notes: Array<{
    id: string;
    targetHz: number;
    startMs: number;
    durationMs: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
