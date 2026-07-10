export const SOCKET_EVENTS = {
  JOIN_ROOM:    "room:join",
  LEAVE_ROOM:   "room:leave",
  ROOM_UPDATED: "room:updated",
  GAME_START:   "room:start",
  PITCH_UPDATE: "game:pitch",
  SCORE_UPDATE: "game:score",
  GAME_OVER:    "game:over",
} as const;
