// app/profile/[username]/page.tsx

"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import ProfileView, { type ProfileUser, type ProfileScore } from "@/components/profile/ProfileView";

export default function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);

  const [user,    setUser   ] = useState<ProfileUser | null>(null);
  const [scores,  setScores ] = useState<ProfileScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError  ] = useState<string | null>(null);

  useEffect(() => {
    console.log("[PUBLIC PROFILE] Fetching profile for username:", username);

    fetch(`/api/profile/${username}`)
      .then((res) => {
        console.log("[PUBLIC PROFILE] Response status:", res.status);
        if (res.status === 403) throw new Error("private");
        if (res.status === 404) throw new Error("notfound");
        if (!res.ok) throw new Error("error");
        return res.json();
      })
      .then(({ user, scores }: { user: ProfileUser; scores: ProfileScore[] }) => {
        console.log("[PUBLIC PROFILE] ✅ Loaded:", user.username, "| scores:", scores.length);
        setUser(user);
        setScores(scores);
      })
      .catch((err: Error) => {
        console.warn("[PUBLIC PROFILE] ❌", err.message);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) return <LoadingScreen />;

  if (error === "private") return (
    <CenteredMessage
      emoji="🔒"
      title="Private Profile"
      body="This player has set their profile to private."
    />
  );

  if (error === "notfound") return (
    <CenteredMessage
      emoji="🎸"
      title="Player Not Found"
      body={`No player with the username "${username}" exists.`}
    />
  );

  if (error || !user) return (
    <CenteredMessage
      emoji="⚠️"
      title="Something went wrong"
      body="Failed to load this profile. Try again later."
    />
  );

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.92)" }}>
      <PublicNav />
      <ProfileView user={user} scores={scores} isOwner={false} />
    </div>
  );
}

function PublicNav() {
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
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/leaderboard"><Button variant="ghost" size="sm">Leaderboard</Button></Link>
          <Link href="/login"><Button size="sm">Login</Button></Link>
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
        <p style={{ color: "#6b7280", letterSpacing: 2, fontSize: 12 }}>LOADING PROFILE...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function CenteredMessage({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div style={{
      minHeight: "100vh", background: "rgba(0,0,0,0.92)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Courier New', monospace", color: "#f0f0f0",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{emoji}</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{title}</h2>
        <p style={{ color: "#6b7280", marginBottom: 24 }}>{body}</p>
        <Link href="/"><Button variant="ghost">← Home</Button></Link>
      </div>
    </div>
  );
}