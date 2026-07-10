import type { GameMode } from "@/types/game";

export const GAME_MODES: Record<GameMode, { label: string; description: string }> = {
  easy: {
    label: "Easy",
    description: "Slower tempo, fewer notes",
  },
  medium: {
    label: "Medium",
    description: "Moderate tempo, standard difficulty",
  },
  hard: {
    label: "Hard",
    description: "Fast tempo, complex patterns",
  },
};

export const GAME_MODE_OPTIONS = Object.entries(GAME_MODES).map(([mode, config]) => ({
  value: mode,
  label: `${config.label} - ${config.description}`,
}));

export const CATEGORIES = {
  scales: "Scales",
  chords: "Chords",
  arpeggios: "Arpeggios",
  techniques: "Techniques",
  songs: "Songs",
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORIES).map(([key, label]) => ({
  value: key,
  label,
}));
