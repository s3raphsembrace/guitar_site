import { NextResponse } from "next/server";
import clientPromise from "@/server/db/client";
import { ObjectId } from "mongodb";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db("guitar_academy");
    const level = await db.collection("levels").findOne({ id: params.id });
    
    if (!level) {
      return NextResponse.json(
        { message: "Level not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(level);
  } catch (error) {
    console.error("Error fetching level:", error);
    return NextResponse.json(
      { message: "Failed to fetch level" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db("guitar_academy");
    const levelsCollection = db.collection("levels");

    const { id } = params;

    // Validate if id is a valid ObjectId
    let query: any = { id };
    try {
      if (ObjectId.isValid(id)) {
        query = { _id: new ObjectId(id) };
      }
    } catch {
      // If not a valid ObjectId, use id string as fallback
    }

    const body = await req.json();

    // TODO: add admin auth check here
    const updated = await levelsCollection.findOneAndUpdate(
      query,
      { $set: body },
      { returnDocument: "after" }
    );

    if (!updated || !updated.value) {
      return NextResponse.json(
        { ok: false, message: "Level not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: updated.value });
  } catch (err: unknown) {
    console.error("[PATCH /api/levels/:id]", err);

    if (err instanceof Error) {
      return NextResponse.json(
        { ok: false, message: err.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: false, message: "Failed to update level" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db("guitar_academy");
    const levelsCollection = db.collection("levels");

    const { id } = params;

    // Validate if id is a valid ObjectId
    let query: any = { id };
    try {
      if (ObjectId.isValid(id)) {
        query = { _id: new ObjectId(id) };
      }
    } catch {
      // If not a valid ObjectId, use id string as fallback
    }

    // TODO: add admin auth check here
    const deleted = await levelsCollection.findOneAndDelete(query);

    if (!deleted || !deleted.value) {
      return NextResponse.json(
        { ok: false, message: "Level not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, message: "Level deleted" });
  } catch (err) {
    console.error("[DELETE /api/levels/:id]", err);
    return NextResponse.json(
      { ok: false, message: "Failed to delete level" },
      { status: 500 }
    );
  }
}