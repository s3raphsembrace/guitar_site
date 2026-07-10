import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getToken } from "next-auth/jwt";
import { ObjectId } from "mongodb";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db("guitar-game");

    let query: any = { id: params.id };
    // Also try to find by MongoDB _id if the id looks like an ObjectId
    if (ObjectId.isValid(params.id)) {
      query = { $or: [{ id: params.id }, { _id: new ObjectId(params.id) }] };
    }

    const level = await db.collection("levels").findOne(query);

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
    // Check authentication
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db("guitar-game");
    const body = await req.json();

    let query: any = { id: params.id };
    if (ObjectId.isValid(params.id)) {
      query = { $or: [{ id: params.id }, { _id: new ObjectId(params.id) }] };
    }

    const updateData = {
      ...body,
      updatedAt: new Date(),
    };

    const result = await db.collection("levels").findOneAndUpdate(
      query,
      { $set: updateData },
      { returnDocument: "after" }
    );

    if (!result.value) {
      return NextResponse.json(
        { ok: false, message: "Level not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: result.value });
  } catch (err) {
    console.error("[PATCH /api/levels/:id]", err);
    return NextResponse.json(
      { ok: false, message: "Failed to update level" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db("guitar-game");

    let query: any = { id: params.id };
    if (ObjectId.isValid(params.id)) {
      query = { $or: [{ id: params.id }, { _id: new ObjectId(params.id) }] };
    }

    const result = await db.collection("levels").findOneAndDelete(query);

    if (!result.value) {
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