// server/api/signup/route.ts
// NOTE: The canonical signup is app/api/signup/route.ts — this file is kept for
// reference but is NOT registered as a Next.js API route (it lives under server/, 
// not app/). If you ever call this directly, make sure it still points to guitar_academy.

import clientPromise from "@/server/db/client";
import bcrypt from "bcryptjs";

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.(com|org|net)$/i;
  return emailRegex.test(email);
};

export async function POST(req: Request) {
  const { username, email, password } = await req.json();

  if (!username || !email || !password) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      { status: 400 }
    );
  }

  if (username.trim().length < 3) {
    return new Response(
      JSON.stringify({ error: "Username must be at least 3 characters" }),
      { status: 400 }
    );
  }

  if (!validateEmail(email)) {
    return new Response(
      JSON.stringify({ error: "Email must end with .com, .org, or .net" }),
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return new Response(
      JSON.stringify({ error: "Password must be at least 6 characters" }),
      { status: 400 }
    );
  }

  const client = await clientPromise;
  // ✅ Fixed: was pointing to "mydatabase" — must be "guitar_academy"
  const db = client.db("guitar_academy");
  const users = db.collection("users");

  const existing = await users.findOne({
    $or: [{ email: email.toLowerCase().trim() }, { username: username.trim() }],
  });
  if (existing) {
    return new Response(
      JSON.stringify({ error: "Email or username already exists" }),
      { status: 400 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await users.insertOne({
    username: username.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    bio: "",
    avatarColor: "#22c55e",
    avatarUrl: null,
    favoriteGenre: "",
    guitarType: "",
    country: "",
    isPublic: true,
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

  return new Response(JSON.stringify({ message: "User created successfully" }), {
    status: 201,
  });
}