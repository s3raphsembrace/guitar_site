import { randomUUID } from "node:crypto";
import type { ChartEvent } from "@/types/level-import";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function buildLevelId(title: string) {
  const base = slugify(title) || "untitled-level";
  return `${base}-${randomUUID().slice(0, 8)}`;
}

export function toNumeric(value: unknown, fallback: number | null = null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function sortEvents(events: ChartEvent[]) {
  return [...events].sort((a, b) => a.timeMs - b.timeMs || a.durationMs - b.durationMs);
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
