import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getToken } from "next-auth/jwt";

export async function GET(
  _req: Request,
  { params }: { params: { code: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db("guitar-game");
    const room = await db.collection("rooms").findOne({ code: params.code });

    if (!room) {
      return NextResponse.json(
        { message: "Room not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(room);
  } catch (error) {
    console.error("Error fetching room:", error);
    return NextResponse.json(
      { message: "Failed to fetch room" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { code: string } }
) {
  try {
    // Check authentication
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const client = await clientPromise;
    const db = client.db("guitar-game");

    // If adding a player, add to players array
    if (body.playerAction === "join" && body.playerName) {
      const result = await db.collection("rooms").findOneAndUpdate(
        { code: params.code },
        {
          $push: {
            players: {
              id: token.id as string,
              name: token.name as string,
              score: 0,
            },
          },
          $set: {
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" }
      );

      if (!result.value) {
        return NextResponse.json(
          { message: "Room not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ ok: true, room: result.value });
    }

    // Generic update for status changes, etc.
    const result = await db.collection("rooms").findOneAndUpdate(
      { code: params.code },
      {
        $set: {
          ...body,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!result.value) {
      return NextResponse.json(
        { message: "Room not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, room: result.value });
  } catch (error) {
    console.error("Error updating room:", error);
    return NextResponse.json(
      { message: "Failed to update room" },
      { status: 500 }
    );
  }
}
