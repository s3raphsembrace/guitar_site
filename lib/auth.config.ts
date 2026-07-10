// lib/auth.config.ts
// Single source of truth for NextAuth config — import authOptions from here everywhere.

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import clientPromise from "@/server/db/client";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("[AUTH] authorize() called for:", credentials?.email);

        if (!credentials?.email || !credentials?.password) {
          console.warn("[AUTH] ❌ Missing email or password");
          throw new Error("Email and password are required");
        }

        let client;
        try {
          client = await clientPromise;
          console.log("[AUTH] ✅ MongoDB connected");
        } catch (err) {
          console.error("[AUTH] ❌ MongoDB connection failed:", err);
          throw new Error("Database connection failed");
        }

        const db = client.db("guitar_academy");
        const user = await db.collection("users").findOne({
          email: credentials.email.toLowerCase().trim(),
        });

        if (!user) {
          console.warn("[AUTH] ❌ No user found for email:", credentials.email);
          throw new Error("No account found with that email");
        }

        console.log("[AUTH] Found user:", user.username, "| id:", user._id.toString());

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          console.warn("[AUTH] ❌ Password mismatch for:", credentials.email);
          throw new Error("Incorrect password");
        }

        console.log("[AUTH] ✅ Password valid — login successful for:", user.username);

        return {
          id: user._id.toString(),
          name: user.username,
          email: user.email,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        console.log("[AUTH] JWT callback — attaching user to token:", user.name);
        token.id = user.id;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name;
        console.log("[AUTH] Session callback — session built for:", session.user.name);
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      console.log("[AUTH] 🟢 signIn event — user logged in:", user.name, user.email);
    },
    async signOut({ token }) {
      console.log("[AUTH] 🔴 signOut event — user logged out:", token?.name);
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};