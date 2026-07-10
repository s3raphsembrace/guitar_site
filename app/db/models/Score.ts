import { ObjectId } from "mongodb";

export interface ScoreDocument {
  _id?: ObjectId;
  userId: string;
  levelId: string;
  roomCode?: string;
  score: number;
  hits: number;
  misses: number;
  accuracy: number;
  createdAt: Date;
  updatedAt: Date;
}
