import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getToken } from "next-auth/jwt";
import type { CreateRoomRequest } from "@/types/api";

export async function POST(req: Request) {
  try {
    // Check authentication
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json(
        { message: "Unauthorized - must be logged in" },
        { status: 401 }
      );
    }

    const body: CreateRoomRequest = await req.json();

    // Validate required fields
    if (!body.levelId) {
      return NextResponse.json(
        { message: "Missing levelId" },
        { status: 400 }
      );
    }

    const roomCode = Math.random().toString(36).slice(2, 7).toUpperCase();

    const client = await clientPromise;
    const db = client.db("guitar-game");

    // Create room document with authenticated user
    const roomDoc = {
      code: roomCode,
      levelId: body.levelId,
      creatorId: token.id as string,
      players: [
        {
          id: token.id as string,
          name: token.name as string,
          score: 0,
        },
      ],
      status: "waiting",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
    };

    await db.collection("rooms").insertOne(roomDoc);

    return NextResponse.json({ roomCode });
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json(
      { message: "Failed to create room" },
      { status: 500 }
    );
  }
}
