"use client";
import { useState } from "react";
import type { GameSession } from "@/types/game";

export function useGameSession() {
  const [session, setSession] = useState<GameSession | null>(null);
  // TODO: implement game state machine
  return { session, setSession };
}
