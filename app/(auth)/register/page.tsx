// app/(auth)/register/page.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [shakeForm, setShakeForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (emailInput: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.(com|org|net)$/i;
    return emailRegex.test(emailInput);
  };

  const triggerShake = (msg: string) => {
    setErrorMessage(msg);
    setShakeForm(true);
    setTimeout(() => setShakeForm(false), 300);
  };

  const handleRegister = async () => {
    setErrorMessage("");

    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      triggerShake("Please fill in all fields");
      return;
    }
    if (username.trim().length < 3) {
      triggerShake("Username must be at least 3 characters");
      return;
    }
    if (!validateEmail(email)) {
      triggerShake("Email must end with .com, .org, or .net");
      return;
    }
    if (password.length < 6) {
      triggerShake("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      triggerShake("Passwords do not match");
      return;
    }

    console.log("[REGISTER] Submitting registration for:", email.trim().toLowerCase());

    try {
      setLoading(true);
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();
      console.log("[REGISTER] Server response:", res.status, data);

      if (!res.ok) {
        console.warn("[REGISTER] ❌ Registration failed:", data.error);
        triggerShake(data.error || "Registration failed");
        return;
      }

      console.log("[REGISTER] ✅ Account created successfully for:", username.trim());
      router.push("/login?registered=1");
    } catch (err) {
      console.error("[REGISTER] ❌ Exception during registration:", err);
      triggerShake("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleRegister();
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
      <h1
        style={{ fontFamily: "'Courier New', monospace" }}
        className="text-6xl font-bold select-none mb-8 text-center"
      >
        Create Your Account
      </h1>

      <p className="text-zinc-300 mb-8 text-center">
        Join us and start your guitar learning journey
      </p>

      <div
        className={`flex flex-col items-center justify-center space-y-4 ${
          shakeForm ? "animate-shake" : ""
        }`}
      >
        <input
          type="text"
          placeholder="Username (min. 3 characters)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="w-72 px-4 py-2 rounded-lg border border-[#1f2937] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white bg-[#061014] disabled:opacity-50"
        />

        <input
          type="email"
          placeholder="Email (.com, .org, or .net)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="w-72 px-4 py-2 rounded-lg border border-[#1f2937] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white bg-[#061014] disabled:opacity-50"
        />

        <input
          type="password"
          placeholder="Password (min. 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="w-72 px-4 py-2 rounded-lg border border-[#1f2937] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white bg-[#061014] disabled:opacity-50"
        />

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
          onClick={() => void handleRegister()}
          disabled={loading}
          className="bg-emerald-500 text-black px-8 py-3 rounded-lg hover:scale-95 transform transition duration-200 disabled:opacity-50 disabled:hover:scale-100 font-semibold"
        >
          {loading ? "Creating account..." : "Register"}
        </button>

        <p className="text-zinc-300 text-sm">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-amber-400 hover:text-amber-300 font-semibold"
          >
            Log In
          </Link>
        </p>
      </div>
    </main>
  );
}