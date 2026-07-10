import { signOut } from "next-auth/react";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // NextAuth handles signout through the session cookie
    // This endpoint just needs to validate the request
    return NextResponse.json({ ok: true, message: "Sign out successful" });
  } catch (error) {
    console.error("Sign out error:", error);
    return NextResponse.json(
      { ok: false, message: "Failed to sign out" },
      { status: 500 }
    );
  }
}
