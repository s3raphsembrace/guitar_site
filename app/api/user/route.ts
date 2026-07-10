import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";

export async function GET(req: Request) {
  try {
    const session = await getAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db("guitar-game");
    const users = db.collection("users");

    const user = await users.findOne({ id: session.user.id });

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        totalScore: user.totalScore,
        totalLevels: user.totalLevels,
        bestAccuracy: user.bestAccuracy,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { ok: false, message: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const client = await clientPromise;
    const db = client.db("guitar-game");
    const users = db.collection("users");

    // Only allow updating specific fields
    const allowedUpdates = ["name"];
    const updateData: any = { updatedAt: new Date() };

    for (const field of allowedUpdates) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    const result = await users.findOneAndUpdate(
      { id: session.user.id },
      { $set: updateData },
      { returnDocument: "after" }
    );

    if (!result.value) {
      return NextResponse.json(
        { ok: false, message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: result.value.id,
        name: result.value.name,
        email: result.value.email,
        totalScore: result.value.totalScore,
        totalLevels: result.value.totalLevels,
        bestAccuracy: result.value.bestAccuracy,
      },
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { ok: false, message: "Failed to update user" },
      { status: 500 }
    );
  }
}
