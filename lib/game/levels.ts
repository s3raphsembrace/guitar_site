import type { Level } from "@/types/game";

export function getLevelDifficulty(level: Level): "easy" | "medium" | "hard" {
  if (level.bpm < 80) return "easy";
  if (level.bpm < 120) return "medium";
  return "hard";
}
