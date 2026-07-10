// app/api/scores/route.ts

import { NextResponse } from "next/server";
import clientPromise from "@/server/db/client";
import { ObjectId } from "mongodb";
import type { SubmitScoreRequest } from "@/types/api";

function toSafeIso(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  return new Date().toISOString();
}

export async function GET(req: Request) {
  console.log("[SCORES] GET leaderboard called");

  try {
    const { searchParams } = new URL(req.url);
    const levelId = searchParams.get("levelId");

    const rawLimit = parseInt(searchParams.get("limit") || "100", 10);
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 1000);

    const client = await clientPromise;
    const db = client.db("guitar_academy");

    // DEBUG: confirms DB connectivity/auth
    await db.command({ ping: 1 });
    console.log("[SCORES] ✅ DB ping ok");

    const query: Record<string, unknown> = {};
    if (levelId) query.levelId = levelId;

    const scores = await db
      .collection("scores")
      .aggregate([
        { $match: query },
        {
          $group: {
            _id: "$userId",
            bestScore: { $max: "$score" },
            bestAccuracy: { $max: "$accuracy" },
            hits: { $first: "$hits" },
            misses: { $first: "$misses" },
            levelId: { $first: "$levelId" },
            createdAt: { $max: "$createdAt" },
          },
        },
        { $sort: { bestScore: -1, bestAccuracy: -1 } },
        { $limit: limit },
      ])
      .toArray();

    console.log("[SCORES] Found", scores.length, "score entries");

    // Build ObjectId array for users — skip any that aren't valid ObjectIds
    const userIds = scores
      .map((s) => {
        try {
          return new ObjectId(s._id as string);
        } catch {
          console.warn("[SCORES] Invalid userId (not ObjectId):", s._id);
          return null;
        }
      })
      .filter(Boolean) as ObjectId[];

    // Fetch users — project username, avatarColor, AND avatarUrl
    const users = await db
      .collection("users")
      .find({ _id: { $in: userIds } })
      .project({ username: 1, avatarColor: 1, avatarUrl: 1 })
      .toArray();

    console.log("[SCORES] Found", users.length, "matching users");

    const userMap = new Map(
      users.map((u) => [
        u._id.toString(),
        {
          username: u.username as string,
          avatarColor: u.avatarColor as string | undefined,
          avatarUrl: u.avatarUrl as string | null | undefined,
        },
      ])
    );

    const entries = scores.map((score, index) => {
      const userId = score._id as string;
      const userInfo = userMap.get(userId);

      if (!userInfo) {
        console.warn("[SCORES] ⚠️ No user found for userId:", userId);
      }

      return {
        rank: index + 1,
        userId,
        playerName: userInfo?.username ?? "Unknown Player",
        avatarColor: userInfo?.avatarColor ?? "#374151",
        avatarUrl: userInfo?.avatarUrl ?? null,
        score: score.bestScore as number,
        accuracy: score.bestAccuracy as number,
        hits: score.hits as number,
        misses: score.misses as number,
        levelId: score.levelId as string,
        createdAt: toSafeIso(score.createdAt),
      };
    });

    console.log("[SCORES] ✅ Returning", entries.length, "entries");
    return NextResponse.json({ entries, totalPlayers: entries.length });
  } catch (error) {
    console.error("[SCORES] ❌ Error full:", error);
    if (error instanceof Error) {
      console.error("[SCORES] ❌ Message:", error.message);
      console.error("[SCORES] ❌ Stack:", error.stack);
    }

    return NextResponse.json(
      {
        message: "Failed to fetch leaderboard",
        error: error instanceof Error ? error.message : String(error), // TEMP DEBUG
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  console.log("[SCORES] POST score submission called");

  try {
    const body: SubmitScoreRequest = await req.json();
    console.log("[SCORES] Incoming score:", body);

    if (!body.userId || !body.levelId || body.score === undefined) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("guitar_academy");

    // DEBUG: confirms DB connectivity/auth
    await db.command({ ping: 1 });
    console.log("[SCORES] ✅ DB ping ok (POST)");

    // Save the score
    const result = await db.collection("scores").insertOne({
      userId: body.userId,
      levelId: body.levelId,
      roomCode: body.roomCode,
      score: body.score,
      hits: body.hits ?? 0,
      misses: body.misses ?? 0,
      accuracy: body.accuracy ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("[SCORES] ✅ Score saved:", result.insertedId.toString());

    // Calculate streak
    const userId = new ObjectId(body.userId);
    const user = await db.collection("users").findOne({ _id: userId });

    let currentStreak = user?.currentStreak ?? 0;
    let longestStreak = user?.longestStreak ?? 0;
    const lastPlayed: Date | null = user?.lastPlayedAt ?? null;
    const now = new Date();

    if (lastPlayed) {
      const daysSinceLast = Math.floor(
        (now.getTime() - lastPlayed.getTime()) / 86400000
      );
      if (daysSinceLast === 0) {
        // Same day — streak unchanged
      } else if (daysSinceLast === 1) {
        currentStreak += 1;
      } else {
        currentStreak = 1;
      }
    } else {
      currentStreak = 1;
    }

    longestStreak = Math.max(longestStreak, currentStreak);

    // Update user aggregate stats
    await db.collection("users").updateOne(
      { _id: userId },
      {
        $inc: {
          totalScore: body.score,
          totalLevels: 1,
          totalHits: body.hits ?? 0,
          totalMisses: body.misses ?? 0,
        },
        $max: { bestAccuracy: body.accuracy ?? 0 },
        $set: {
          currentStreak,
          longestStreak,
          lastPlayedAt: now,
          updatedAt: now,
        },
      }
    );

    console.log(
      "[SCORES] ✅ User stats updated — streak:",
      currentStreak,
      "| longest:",
      longestStreak
    );

    return NextResponse.json({ ok: true, message: "Score saved successfully" });
  } catch (error) {
    console.error("[SCORES] ❌ Error full:", error);
    if (error instanceof Error) {
      console.error("[SCORES] ❌ Message:", error.message);
      console.error("[SCORES] ❌ Stack:", error.stack);
    }

    return NextResponse.json(
      {
        message: "Failed to save score",
        error: error instanceof Error ? error.message : String(error), // TEMP DEBUG
      },
      { status: 500 }
    );
  }
}