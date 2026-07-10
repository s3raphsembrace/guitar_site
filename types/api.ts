export interface ApiError {
  message: string;
  code?: string;
}

export interface CreateRoomRequest {
  levelId: string;
  playerName: string;
}

export interface CreateRoomResponse {
  roomCode: string;
}

export interface SubmitScoreRequest {
  roomCode?: string;
  userId: string;
  levelId: string;
  score: number;
  hits: number;
  misses: number;
  accuracy: number;
}

export interface SubmitScoreResponse {
  ok: boolean;
  message?: string;
}

export interface GetLevelResponse {
  id: string;
  title: string;
  artist?: string;
  bpm: number;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  durationMs?: number;
  albumCover?: string;
  notes: Array<{
    id: string;
    targetHz: number;
    startMs: number;
    durationMs: number;
  }>;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  playerName: string;
  avatarColor?: string;
  avatarUrl?: string | null;
  score: number;
  accuracy: number;
  hits: number;
  misses: number;
  levelId: string;
  createdAt: string;
}

export interface GetLeaderboardResponse {
  entries: LeaderboardEntry[];
  totalPlayers: number;
}

export interface GetLeaderboardRequest {
  levelId?: string;
  limit?: number;
}