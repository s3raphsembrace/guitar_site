import { ObjectId } from "mongodb";

export interface UserDocument {
  _id?: ObjectId;
  id: string;
  name: string;
  email: string;
  password?: string;
  totalScore: number;
  totalLevels: number;
  bestAccuracy: number;
  createdAt: Date;
  updatedAt: Date;
}
