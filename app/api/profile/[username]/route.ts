// app/api/profile/[username]/route.ts

import { NextResponse } from "next/server";
import clientPromise from "@/server/db/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const decoded = decodeURIComponent(username).trim();
  console.log("[PROFILE/username] GET called for:", decoded);

  try {
    const client = await clientPromise;
    const db = client.db("guitar_academy");

    // Exact match first, then case-insensitive fallback
    let user = await db.collection("users").findOne(
      { username: decoded },
      { projection: { password: 0, email: 0 } }
    );

    if (!user) {
      user = await db.collection("users").findOne(
        {
          username: {
            $regex: `^${decoded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            $options: "i",
          },
        },
        { projection: { password: 0, email: 0 } }
      );
    }

    if (!user) {
      console.warn("[PROFILE/username] ❌ User not found:", decoded);
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Only block if explicitly set to false — treat undefined/null as public
    if (user.isPublic === false) {
      console.warn("[PROFILE/username] 🔒 Profile is private:", decoded);
      return NextResponse.json(
        { message: "This profile is private" },
        { status: 403 }
      );
    }

    const scores = await db
      .collection("scores")
      .find({ userId: user._id.toString() })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    console.log(
      "[PROFILE/username] ✅ Public profile loaded:",
      user.username,
      "| scores:",
      scores.length
    );

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        username: user.username,
        bio: user.bio ?? "",
        avatarColor: user.avatarColor ?? "#22c55e",
        avatarUrl: user.avatarUrl ?? null,
        favoriteGenre: user.favoriteGenre ?? "",
        guitarType: user.guitarType ?? "",
        country: user.country ?? "",
        totalScore: user.totalScore ?? 0,
        totalLevels: user.totalLevels ?? 0,
        bestAccuracy: user.bestAccuracy ?? 0,
        totalHits: user.totalHits ?? 0,
        totalMisses: user.totalMisses ?? 0,
        currentStreak: user.currentStreak ?? 0,
        longestStreak: user.longestStreak ?? 0,
        lastPlayedAt: user.lastPlayedAt ?? null,
        createdAt: user.createdAt,
      },
      scores: scores.map((s) => ({
        id: s._id.toString(),
        levelId: s.levelId,
        score: s.score,
        accuracy: s.accuracy,
        hits: s.hits,
        misses: s.misses,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error("[PROFILE/username] ❌ Error:", error);
    return NextResponse.json(
      { message: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}