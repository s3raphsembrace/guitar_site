"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

export function useAuth() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const login = useCallback(
    async (email: string, password: string) => {
      console.log("\n========== CLIENT LOGIN START ==========");
      console.log("🔓 Login attempt:", { email, passwordLength: password.length });

      setIsLoading(true);
      try {
        console.log("1️⃣ Calling signIn with credentials...");
        const result = await signIn("credentials", {
          redirect: false,
          email,
          password,
        });

        console.log("2️⃣ SignIn result:", {
          error: result?.error,
          ok: result?.ok,
          status: result?.status,
        });

        if (result?.error) {
          console.log("❌ Login failed:", result.error);
          console.log("========== CLIENT LOGIN END ==========\n");
          return { ok: false, error: result.error };
        }

        if (result?.ok) {
          console.log("✅ Login successful, redirecting...");
          console.log("========== CLIENT LOGIN END ==========\n");
          router.push("/");
          return { ok: true };
        }

        console.log("⚠️ Unknown result state");
        console.log("========== CLIENT LOGIN END ==========\n");
        return { ok: false, error: "Unknown error occurred" };
      } catch (error) {
        console.log("❌ CLIENT LOGIN ERROR");
        console.log("Error:", error instanceof Error ? error.message : String(error));
        console.log("========== CLIENT LOGIN END (ERROR) ==========\n");
        const errorMessage = error instanceof Error ? error.message : "Login failed";
        return { ok: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await signOut({ redirect: true, callbackUrl: "/login" });
      return { ok: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Logout failed";
      return { ok: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(
    async (username: string, email: string, password: string) => {
      console.log("\n========== CLIENT SIGNUP START ==========");
      console.log("📝 Signup data:", { username, email, passwordLength: password.length });

      setIsLoading(true);
      try {
        console.log("1️⃣ Sending signup request to /api/signup");
        const response = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, password }),
        });

        console.log("2️⃣ Response received");
        console.log("   Status:", response.status);
        console.log("   OK:", response.ok);

        const data = await response.json();
        console.log("   Response data:", data);

        if (!response.ok) {
          console.log("❌ Signup failed:", data.error || data.details);
          console.log("========== CLIENT SIGNUP END ==========\n");
          return { ok: false, error: data.error || data.details || "Signup failed" };
        }

        console.log("✅ SIGNUP COMPLETE - Success!");
        console.log("   User ID:", data.userId);
        console.log("========== CLIENT SIGNUP END ==========\n");
        return { ok: true, message: data.message };
      } catch (error) {
        console.log("\n❌ CLIENT SIGNUP ERROR");
        console.log("Error:", error instanceof Error ? error.message : String(error));
        console.log("========== CLIENT SIGNUP END (ERROR) ==========\n");
        const errorMessage = error instanceof Error ? error.message : "Signup failed";
        return { ok: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    session,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading" || isLoading,
    user: session?.user,
    login,
    logout,
    signup,
  };
}

export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  if (!isLoading && !isAuthenticated) {
    router.push("/login");
  }

  return { isAuthenticated, isLoading };
}
