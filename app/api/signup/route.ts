// app/api/signup/route.ts

import { NextResponse } from "next/server";
import clientPromise from "@/server/db/client";
import bcrypt from "bcryptjs";

const AVATAR_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444",
  "#a78bfa", "#ec4899", "#14b8a6", "#f97316",
];

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.(com|org|net)$/i;
  return emailRegex.test(email);
};

export async function POST(req: Request) {
  console.log("[SIGNUP] POST request received");

  try {
    const { username, email, password } = await req.json();
    console.log("[SIGNUP] Fields received — username:", username, "| email:", email);

    if (!username || !email || !password) {
      console.warn("[SIGNUP] ❌ Missing required fields");
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (username.trim().length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
    }
    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Email must end with .com, .org, or .net" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    let client;
    try {
      client = await clientPromise;
      console.log("[SIGNUP] ✅ MongoDB connected");
    } catch (err) {
      console.error("[SIGNUP] ❌ MongoDB connection failed:", err);
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }

    const db = client.db("guitar_academy");
    const users = db.collection("users");

    const existing = await users.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { username: username.trim() },
      ],
    });

    if (existing) {
      console.warn("[SIGNUP] ❌ Duplicate email or username");
      return NextResponse.json({ error: "Email or username already exists" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const result = await users.insertOne({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,

      // public profile
      bio: "",
      avatarColor,
      favoriteGenre: "",
      guitarType: "",
      country: "",
      isPublic: true,

      // stats
      totalScore: 0,
      totalLevels: 0,
      bestAccuracy: 0,
      totalHits: 0,
      totalMisses: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastPlayedAt: null,

      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("[SIGNUP] ✅ User created — id:", result.insertedId.toString(), "| username:", username.trim());
    return NextResponse.json({ message: "Account created successfully" }, { status: 201 });
  } catch (error) {
    console.error("[SIGNUP] ❌ Unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}