// lib/auth.ts

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import type { Session } from "next-auth";

export async function getAuthSession(): Promise<Session | null> {
  console.log("[AUTH] getAuthSession() called");
  const session = await getServerSession(authOptions);
  if (session?.user) {
    console.log("[AUTH] ✅ Server session found for:", session.user.name);
  } else {
    console.log("[AUTH] 🔒 No server session");
  }
  return session;
}

// Get detailed info about the current user (returns the session user, or null).
export async function getCurrentUser() {
  const session = await getAuthSession();
  return session?.user ?? null;
}

// Check whether a user is currently authenticated.
export async function isAuthenticated(): Promise<boolean> {
  const session = await getAuthSession();
  return !!session?.user;
}

// Re-export authOptions so anything that previously imported from here still works
export { authOptions };