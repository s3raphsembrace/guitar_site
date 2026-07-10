import { ObjectId } from "mongodb";

export interface RoomDocument {
  _id?: ObjectId;
  code: string;
  levelId: string;
  creatorId: string;
  players: Array<{
    id: string;
    name: string;
    score: number;
  }>;
  status: "waiting" | "playing" | "finished";
  createdAt: Date;
  expiresAt: Date;
}
