// app/api/profile/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import clientPromise from "@/server/db/client";
import { ObjectId } from "mongodb";

export async function GET() {
  console.log("[PROFILE] GET /api/profile called");
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    console.warn("[PROFILE] ❌ Unauthenticated");
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("guitar_academy");

    const user = await db.collection("users").findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { password: 0 } }
    );

    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const scores = await db
      .collection("scores")
      .find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    console.log("[PROFILE] ✅ Own profile fetched:", user.username, "| scores:", scores.length);

    return NextResponse.json({
      user: serializeUser(user),
      scores: scores.map(serializeScore),
    });
  } catch (error) {
    console.error("[PROFILE] ❌ Error:", error);
    return NextResponse.json({ message: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  console.log("[PROFILE] PATCH /api/profile called");
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const allowed = ["bio", "avatarColor", "avatarUrl", "favoriteGenre", "guitarType", "country", "isPublic"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: "No valid fields to update" }, { status: 400 });
    }

    updates.updatedAt = new Date();
    const client = await clientPromise;
    const db = client.db("guitar_academy");
    await db.collection("users").updateOne(
      { _id: new ObjectId(session.user.id) },
      { $set: updates }
    );

    console.log("[PROFILE] ✅ Profile updated for:", session.user.name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PROFILE] ❌ Error updating profile:", error);
    return NextResponse.json({ message: "Failed to update profile" }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function serializeUser(u: Record<string, unknown>) {
  return {
    id: (u._id as { toString(): string }).toString(),
    username: u.username,
    email: u.email,
    bio: u.bio ?? "",
    avatarColor: u.avatarColor ?? "#22c55e",
    avatarUrl: u.avatarUrl ?? null,
    favoriteGenre: u.favoriteGenre ?? "",
    guitarType: u.guitarType ?? "",
    country: u.country ?? "",
    isPublic: u.isPublic ?? true,
    totalScore: u.totalScore ?? 0,
    totalLevels: u.totalLevels ?? 0,
    bestAccuracy: u.bestAccuracy ?? 0,
    totalHits: u.totalHits ?? 0,
    totalMisses: u.totalMisses ?? 0,
    currentStreak: u.currentStreak ?? 0,
    longestStreak: u.longestStreak ?? 0,
    lastPlayedAt: u.lastPlayedAt ?? null,
    createdAt: u.createdAt,
  };
}

function serializeScore(s: Record<string, unknown>) {
  return {
    id: (s._id as { toString(): string }).toString(),
    levelId: s.levelId,
    score: s.score,
    accuracy: s.accuracy,
    hits: s.hits,
    misses: s.misses,
    createdAt: s.createdAt,
  };
}