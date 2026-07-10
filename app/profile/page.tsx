// app/profile/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import ProfileView, { type ProfileUser, type ProfileScore } from "@/components/profile/ProfileView";

export default function OwnProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [user,    setUser   ] = useState<ProfileUser | null>(null);
  const [scores,  setScores ] = useState<ProfileScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError  ] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      console.log("[PROFILE] 🔒 Not logged in — redirecting");
      router.push("/login?callbackUrl=/profile");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    console.log("[PROFILE] Fetching own profile for:", session?.user?.name);

    fetch("/api/profile")
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(({ user, scores }: { user: ProfileUser; scores: ProfileScore[] }) => {
        console.log("[PROFILE] ✅ Loaded:", user.username, "| scores:", scores.length);
        setUser(user);
        setScores(scores);
      })
      .catch((err: Error) => {
        console.error("[PROFILE] ❌ Failed:", err);
        setError("Failed to load profile.");
      })
      .finally(() => setLoading(false));
  }, [status, session]);

  const handleSave = async (updates: Partial<ProfileUser>) => {
    console.log("[PROFILE] Saving updates:", updates);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Save failed");
    setUser((u) => u ? { ...u, ...updates } : u);
    console.log("[PROFILE] ✅ Saved");
  };

  if (status === "loading" || loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;
  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.92)" }}>
      <Navbar username={user.username} />
      <ProfileView user={user} scores={scores} isOwner={true} onSave={handleSave} />
    </div>
  );
}

function Navbar({ username }: { username: string }) {
  return (
    <nav style={{
      borderBottom: "1px solid #1f2937", background: "#0d1117cc",
      backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 50,
    }}>
      <div style={{
        maxWidth: 960, margin: "0 auto", padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontFamily: "'Courier New', monospace",
      }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>🎸 Guitarverse</span>
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/leaderboard"><Button variant="ghost" size="sm">Leaderboard</Button></Link>
          <span style={{ color: "#22c55e", fontSize: 13, fontFamily: "inherit" }}>{username}</span>
          <button
            onClick={() => void signOut({ callbackUrl: "/" })}
            style={{
              background: "transparent", border: "1px solid #374151",
              borderRadius: 8, color: "#9ca3af", padding: "6px 14px",
              fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Log Out
          </button>
        </div>
      </div>
    </nav>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100vh", background: "rgba(0,0,0,0.92)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Courier New', monospace",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 40, height: 40, border: "3px solid #1f2937",
          borderTop: "3px solid #22c55e", borderRadius: "50%",
          animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
        }} />
        <p style={{ color: "#6b7280", letterSpacing: 2, fontSize: 12 }}>LOADING...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div style={{
      minHeight: "100vh", background: "rgba(0,0,0,0.92)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Courier New', monospace",
    }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#ef4444", marginBottom: 16 }}>{message}</p>
        <Link href="/"><Button variant="ghost">← Home</Button></Link>
      </div>
    </div>
  );
}