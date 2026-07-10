import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getToken } from "next-auth/jwt";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("guitar-game");
    const levels = await db.collection("levels").find({}).toArray();
    return NextResponse.json(levels);
  } catch (error) {
    console.error("Error fetching levels:", error);
    return NextResponse.json(
      { message: "Failed to fetch levels" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // Check authentication
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized - must be logged in to create levels" },
        { status: 401 }
      );
    }

    // Check if user is admin (for now, accept authenticated users)
    // TODO: implement proper admin role system
    const body = await req.json();
    const client = await clientPromise;
    const db = client.db("guitar-game");

    const levelData = {
      ...body,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("levels").insertOne(levelData);

    return NextResponse.json({ ok: true, id: result.insertedId }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/levels]", err);
    return NextResponse.json(
      { ok: false, message: "Failed to create level" },
      { status: 500 }
    );
  }
}