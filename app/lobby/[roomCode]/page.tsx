"use client";

import Link from "next/link";

export default function LobbyPage() {
  return (
    <main
      className="flex min-h-screen items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)", fontFamily: "'Courier New', monospace", color: "#f0f0f0" }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Courier New', monospace" }} className="text-4xl font-bold mb-4">Lobby</h1>
        <p className="text-zinc-300 mb-6">Create or join a room to play multiplayer.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="bg-[#374151] text-white px-4 py-2 rounded-lg">Home</Link>
          <Link href="/game/1" className="bg-emerald-500 text-black px-4 py-2 rounded-lg">Play</Link>
        </div>
      </div>
    </main>
  );
}
