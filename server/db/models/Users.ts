// server/db/models/User.ts

import { ObjectId } from "mongodb";

export interface UserDocument {
  _id?: ObjectId;

  // ── Identity ──
  username: string;
  email: string;
  password?: string;            // hashed, never returned to client

  // ── Public profile ──
  bio?: string;                 // short text about themselves
  avatarUrl?: string;           // uploaded profile picture (base64 data URL or CDN URL)
  avatarColor?: string;         // hex fallback color when no avatarUrl set
  favoriteGenre?: string;       // "scales" | "chords" | "arpeggios" | "techniques" | "songs"
  guitarType?: string;          // "acoustic" | "electric" | "classical" | "bass"
  country?: string;             // free text
  isPublic: boolean;            // whether their profile is visible to others (default true)

  // ── Aggregate stats (updated on every score POST) ──
  totalScore: number;
  totalLevels: number;
  bestAccuracy: number;         // 0–100
  totalHits: number;
  totalMisses: number;
  currentStreak: number;        // consecutive days played
  longestStreak: number;
  lastPlayedAt?: Date;

  // ── Timestamps ──
  createdAt: Date;
  updatedAt: Date;
}