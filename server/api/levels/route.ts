import { NextResponse } from "next/server";
import clientPromise from "@/server/db/client";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("guitar_academy");
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
    const client = await clientPromise;
    const db = client.db("guitar_academy");
    const levelsCollection = db.collection("levels");

    const body = await req.json();

    // Validate required fields
    if (!body.title || !body.artist) {
      return NextResponse.json(
        { ok: false, message: "Title and artist are required" },
        { status: 400 }
      );
    }

    // TODO: add admin auth check here before allowing level creation
    const result = await levelsCollection.insertOne({
      ...body,
      createdAt: new Date(),
    });

    return NextResponse.json(
      { ok: true, data: { _id: result.insertedId, ...body } },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("[POST /api/levels]", err);

    if (err instanceof Error) {
      return NextResponse.json(
        { ok: false, message: err.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: false, message: "Failed to create level" },
      { status: 500 }
    );
  }
}