// app/api/profile/avatar/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import clientPromise from "@/server/db/client";
import { ObjectId } from "mongodb";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
  console.log("[AVATAR] POST /api/profile/avatar called");
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: "Invalid file type. Use JPEG, PNG, WebP, or GIF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { message: "File too large. Maximum size is 2 MB." },
        { status: 400 }
      );
    }

    // Convert to base64 data URL and store directly in MongoDB.
    // For production you'd upload to S3/Cloudinary instead.
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const avatarUrl = `data:${file.type};base64,${base64}`;

    const client = await clientPromise;
    const db = client.db("guitar_academy");

    await db.collection("users").updateOne(
      { _id: new ObjectId(session.user.id) },
      { $set: { avatarUrl, updatedAt: new Date() } }
    );

    console.log("[AVATAR] ✅ Avatar saved for user:", session.user.name);
    return NextResponse.json({ ok: true, avatarUrl });
  } catch (error) {
    console.error("[AVATAR] ❌ Error:", error);
    return NextResponse.json({ message: "Failed to upload avatar" }, { status: 500 });
  }
}

export async function DELETE(_req: Request) {
  console.log("[AVATAR] DELETE /api/profile/avatar called");
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("guitar_academy");

    await db.collection("users").updateOne(
      { _id: new ObjectId(session.user.id) },
      { $unset: { avatarUrl: "" }, $set: { updatedAt: new Date() } }
    );

    console.log("[AVATAR] ✅ Avatar removed for user:", session.user.name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[AVATAR] ❌ Error:", error);
    return NextResponse.json({ message: "Failed to remove avatar" }, { status: 500 });
  }
}