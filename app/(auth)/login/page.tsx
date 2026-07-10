// app/(auth)/login/page.tsx

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shakeForm, setShakeForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const triggerShake = (msg: string) => {
    setErrorMessage(msg);
    setShakeForm(true);
    setTimeout(() => setShakeForm(false), 300);
  };

  const handleLogin = async () => {
    setErrorMessage("");

    if (!email.trim() || !password) {
      triggerShake("Please enter email and password");
      return;
    }

    console.log("[LOGIN] Attempting login for:", email.trim().toLowerCase());

    try {
      setLoading(true);
      const res = await signIn("credentials", {
        redirect: false,
        email: email.trim().toLowerCase(),
        password,
      });

      console.log("[LOGIN] signIn response:", res);

      if (res?.error) {
        console.warn("[LOGIN] ❌ Login failed:", res.error);
        triggerShake(res.error);
      } else if (res?.ok) {
        console.log("[LOGIN] ✅ Login successful! Redirecting to:", callbackUrl);
        router.push(callbackUrl);
        router.refresh();
      } else {
        console.warn("[LOGIN] ⚠️ Unexpected response:", res);
        triggerShake("Something went wrong. Please try again.");
      }
    } catch (err) {
      console.error("[LOGIN] ❌ Exception during login:", err);
      triggerShake("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleLogin();
  };

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(8px)",
        fontFamily: "'Courier New', monospace",
        color: "#f0f0f0",
      }}
    >
      <h1 className="text-6xl font-bold select-none mb-8 text-center font-mono tracking-wide">
        Welcome Back
      </h1>

      <p className="text-zinc-300 mb-8 text-center">
        Log in to continue your guitar learning journey
      </p>

      <div
        className={`flex flex-col items-center justify-center space-y-4 ${
          shakeForm ? "animate-shake" : ""
        }`}
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="w-72 px-4 py-2 rounded-lg border border-[#1f2937] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white bg-[#061014] disabled:opacity-50"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="w-72 px-4 py-2 rounded-lg border border-[#1f2937] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white bg-[#061014] disabled:opacity-50"
        />

        {errorMessage && (
          <p className="text-sm text-amber-400 font-semibold text-center max-w-72">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col items-center gap-4">
        <button
          onClick={() => void handleLogin()}
          disabled={loading}
          className="bg-red-600 text-white px-8 py-3 rounded-lg hover:scale-95 transform transition duration-200 disabled:opacity-50 disabled:hover:scale-100 font-semibold"
        >
          {loading ? "Logging in..." : "Log In"}
        </button>

        <p className="text-zinc-300 text-sm">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-amber-400 hover:text-amber-300 font-semibold"
          >
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}