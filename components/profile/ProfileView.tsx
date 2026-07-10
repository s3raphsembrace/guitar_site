// components/profile/ProfileView.tsx

"use client";

import { useRef, useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProfileScore {
  id: string;
  levelId: string;
  score: number;
  accuracy: number;
  hits: number;
  misses: number;
  createdAt: string;
}

export interface ProfileUser {
  id: string;
  username: string;
  email?: string;
  bio: string;
  avatarUrl: string | null;
  avatarColor: string;
  favoriteGenre: string;
  guitarType: string;
  country: string;
  isPublic?: boolean;
  totalScore: number;
  totalLevels: number;
  bestAccuracy: number;
  totalHits: number;
  totalMisses: number;
  currentStreak: number;
  longestStreak: number;
  lastPlayedAt: string | null;
  createdAt: string;
}

interface ProfileViewProps {
  user: ProfileUser;
  scores: ProfileScore[];
  isOwner: boolean;
  onSave?: (updates: Partial<ProfileUser>) => Promise<void>;
  onAvatarChange?: (newUrl: string | null) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGrade(accuracy: number): { letter: string; color: string } {
  if (accuracy === 100) return { letter: "S", color: "#facc15" };
  if (accuracy >= 90)   return { letter: "A", color: "#22c55e" };
  if (accuracy >= 75)   return { letter: "B", color: "#60a5fa" };
  if (accuracy >= 60)   return { letter: "C", color: "#f97316" };
  return                       { letter: "D", color: "#ef4444" };
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(d: string | null): string {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)   return `${days}d ago`;
  if (days < 30)  return `${Math.floor(days / 7)}w ago`;
  return formatDate(d);
}

const GUITAR_TYPES = ["", "Acoustic", "Electric", "Classical", "Bass", "12-String"];
const GENRES       = ["", "Scales", "Chords", "Arpeggios", "Techniques", "Songs"];
const COLORS       = ["#22c55e","#3b82f6","#f59e0b","#ef4444","#a78bfa","#ec4899","#14b8a6","#f97316"];

const card: React.CSSProperties = {
  background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: "24px 28px",
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, color: "#6b7280", letterSpacing: 3, marginBottom: 6, display: "block",
};
const selectStyle: React.CSSProperties = {
  width: "100%", background: "#061014", border: "1px solid #1f2937",
  color: "#f0f0f0", borderRadius: 8, padding: "8px 12px",
  fontFamily: "inherit", fontSize: 13,
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProfileView({ user, scores, isOwner, onSave, onAvatarChange }: ProfileViewProps) {
  const [editing,    setEditing   ] = useState(false);
  const [saving,     setSaving    ] = useState(false);
  const [uploading,  setUploading ] = useState(false);
  const [saveMsg,    setSaveMsg   ] = useState("");
  const [uploadMsg,  setUploadMsg ] = useState("");
  const [draft,      setDraft     ] = useState<Partial<ProfileUser>>({});
  const [localUser,  setLocalUser ] = useState<ProfileUser>(user);

  // Single shared ref for the file input — used by both the avatar click and the button
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayed = { ...localUser, ...draft };

  const hitRate = localUser.totalHits + localUser.totalMisses > 0
    ? ((localUser.totalHits / (localUser.totalHits + localUser.totalMisses)) * 100).toFixed(1)
    : "—";
  const avgScore  = localUser.totalLevels > 0
    ? Math.round(localUser.totalScore / localUser.totalLevels).toLocaleString()
    : "—";
  const bestScore = scores.length > 0 ? Math.max(...scores.map((s) => s.score)) : 0;
  const topLevels = [...scores].sort((a, b) => b.score - a.score).slice(0, 3);

  const set = (key: keyof ProfileUser, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const triggerFilePicker = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so same file can be re-selected
    if (!file) return;

    console.log("[AVATAR] Uploading:", file.name, "| type:", file.type, "| size:", file.size);
    setUploading(true);
    setUploadMsg("");

    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res  = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const data = await res.json() as { ok?: boolean; avatarUrl?: string; message?: string };
      if (!res.ok) throw new Error(data.message ?? "Upload failed");

      setLocalUser((u) => ({ ...u, avatarUrl: data.avatarUrl ?? null }));
      onAvatarChange?.(data.avatarUrl ?? null);
      setUploadMsg("✅ Photo updated!");
      console.log("[AVATAR] ✅ Upload success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadMsg(`❌ ${msg}`);
      console.error("[AVATAR] ❌", err);
    } finally {
      setUploading(false);
      setTimeout(() => setUploadMsg(""), 5000);
    }
  };

  const handleAvatarRemove = async () => {
    setUploading(true);
    try {
      await fetch("/api/profile/avatar", { method: "DELETE" });
      setLocalUser((u) => ({ ...u, avatarUrl: null }));
      onAvatarChange?.(null);
      console.log("[AVATAR] ✅ Removed");
    } catch (err) {
      console.error("[AVATAR] ❌ Remove failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!onSave || Object.keys(draft).length === 0) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(draft);
      setLocalUser((u) => ({ ...u, ...draft }));
      setDraft({});
      setEditing(false);
      setSaveMsg("✅ Saved!");
    } catch {
      setSaveMsg("❌ Failed to save");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(""), 3000);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px", fontFamily: "'Courier New', monospace", color: "#f0f0f0" }}>

      {/* Hidden file input — one single input, referenced by both click targets */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* ── Header Card ── */}
      <div style={{ ...card, marginBottom: 20, position: "relative", overflow: "hidden" }}>
        {/* Top accent line */}
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 240, height: 2,
          background: `linear-gradient(90deg, transparent, ${displayed.avatarColor}, transparent)`,
        }} />

        <div style={{ display: "flex", alignItems: "flex-start", gap: 28, flexWrap: "wrap" }}>

          {/* ── Avatar column ── */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {/* Avatar circle */}
            <div
              style={{
                width: 96, height: 96, borderRadius: "50%",
                background: displayed.avatarUrl ? "transparent" : displayed.avatarColor,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 40, fontWeight: 900, color: "#000",
                boxShadow: `0 0 40px ${displayed.avatarColor}50`,
                overflow: "hidden", position: "relative", flexShrink: 0,
                cursor: editing ? "pointer" : "default",
                border: editing ? "2px dashed #374151" : "2px solid transparent",
                transition: "border-color 0.2s",
              }}
              onClick={() => editing && triggerFilePicker()}
              title={editing ? "Click to change photo" : undefined}
            >
              {displayed.avatarUrl ? (
                <img src={displayed.avatarUrl} alt={localUser.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                localUser.username[0].toUpperCase()
              )}

              {/* Hover overlay (edit mode only) */}
              {editing && (
                <div className="avatar-overlay" style={{
                  position: "absolute", inset: 0,
                  background: "rgba(0,0,0,0.55)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: "#fff", gap: 3,
                  opacity: 0, transition: "opacity 0.15s",
                }}>
                  <span style={{ fontSize: 22 }}>{uploading ? "⏳" : "📷"}</span>
                  <span>{uploading ? "Uploading..." : "Change"}</span>
                </div>
              )}
            </div>

            {/* Upload / Remove buttons (edit mode) */}
            {editing && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <button
                  onClick={triggerFilePicker}
                  disabled={uploading}
                  style={{
                    background: "#1f2937", border: "1px solid #374151",
                    color: "#d1d5db", borderRadius: 6, padding: "5px 12px",
                    fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                    opacity: uploading ? 0.5 : 1,
                  }}
                >
                  {uploading ? "Uploading..." : "📷 Upload photo"}
                </button>

                {displayed.avatarUrl && (
                  <button
                    onClick={handleAvatarRemove}
                    disabled={uploading}
                    style={{
                      background: "transparent", border: "none",
                      color: "#6b7280", fontSize: 11, cursor: "pointer",
                      fontFamily: "inherit", textDecoration: "underline",
                      opacity: uploading ? 0.5 : 1,
                    }}
                  >
                    Remove photo
                  </button>
                )}

                {uploadMsg && (
                  <div style={{
                    fontSize: 11, textAlign: "center", maxWidth: 120,
                    color: uploadMsg.startsWith("✅") ? "#22c55e" : "#ef4444",
                  }}>
                    {uploadMsg}
                  </div>
                )}
              </div>
            )}

            {/* Color swatches (only when no custom photo) */}
            {editing && !displayed.avatarUrl && (
              <div>
                <div style={{ fontSize: 9, color: "#4b5563", letterSpacing: 2, marginBottom: 4, textAlign: "center" }}>
                  OR PICK COLOR
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", width: 104 }}>
                  {COLORS.map((c) => (
                    <div
                      key={c}
                      onClick={() => set("avatarColor", c)}
                      style={{
                        width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer",
                        outline: displayed.avatarColor === c ? "2px solid #fff" : "none", outlineOffset: 1,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Info column ── */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: 3, marginBottom: 4 }}>
              {isOwner ? "YOUR PROFILE" : "PLAYER"}
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>{localUser.username}</div>

            {editing ? (
              <textarea
                value={(displayed.bio as string) ?? ""}
                onChange={(e) => set("bio", e.target.value)}
                placeholder="Write a short bio..."
                maxLength={160}
                rows={2}
                style={{
                  width: "100%", maxWidth: 420,
                  background: "#061014", border: "1px solid #1f2937",
                  borderRadius: 8, padding: "8px 12px",
                  color: "#f0f0f0", fontFamily: "inherit", fontSize: 13, resize: "none",
                }}
              />
            ) : (
              <div style={{ fontSize: 14, color: localUser.bio ? "#9ca3af" : "#374151", marginBottom: 8 }}>
                {localUser.bio || (isOwner ? "No bio yet — click Edit to add one" : "No bio")}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {displayed.guitarType && (
                <span style={{ background: "#1f2937", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#9ca3af" }}>
                  🎸 {displayed.guitarType}
                </span>
              )}
              {displayed.favoriteGenre && (
                <span style={{ background: "#1f2937", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#9ca3af" }}>
                  🎵 {displayed.favoriteGenre}
                </span>
              )}
              {displayed.country && (
                <span style={{ background: "#1f2937", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#9ca3af" }}>
                  📍 {displayed.country}
                </span>
              )}
              <span style={{ background: "#1f2937", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#4b5563" }}>
                Joined {formatDate(localUser.createdAt)}
              </span>
            </div>
          </div>

          {/* ── Edit / Save buttons ── */}
          {isOwner && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  style={{
                    background: "transparent", border: "1px solid #374151",
                    color: "#9ca3af", borderRadius: 8, padding: "8px 18px",
                    cursor: "pointer", fontFamily: "inherit", fontSize: 13,
                  }}
                >
                  ✏️ Edit Profile
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => { setEditing(false); setDraft({}); }}
                    style={{
                      background: "transparent", border: "1px solid #374151",
                      color: "#6b7280", borderRadius: 8, padding: "8px 14px",
                      cursor: "pointer", fontFamily: "inherit", fontSize: 13,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      background: "#22c55e", border: "none", color: "#000",
                      borderRadius: 8, padding: "8px 18px",
                      cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    }}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
              {saveMsg && <div style={{ fontSize: 12, color: "#22c55e" }}>{saveMsg}</div>}
            </div>
          )}
        </div>

        {/* ── Edit fields ── */}
        {editing && (
          <div style={{
            marginTop: 24, paddingTop: 24, borderTop: "1px solid #1f2937",
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16,
          }}>
            <div>
              <label style={labelStyle}>GUITAR TYPE</label>
              <select value={(displayed.guitarType as string) ?? ""} onChange={(e) => set("guitarType", e.target.value)} style={selectStyle}>
                {GUITAR_TYPES.map((g) => <option key={g} value={g}>{g || "Not specified"}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>FAVORITE GENRE</label>
              <select value={(displayed.favoriteGenre as string) ?? ""} onChange={(e) => set("favoriteGenre", e.target.value)} style={selectStyle}>
                {GENRES.map((g) => <option key={g} value={g}>{g || "Not specified"}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>COUNTRY</label>
              <input
                type="text"
                value={(displayed.country as string) ?? ""}
                onChange={(e) => set("country", e.target.value)}
                placeholder="e.g. United States"
                maxLength={60}
                style={{ ...selectStyle, boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <label style={labelStyle}>PROFILE VISIBILITY</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  onClick={() => set("isPublic", !displayed.isPublic)}
                  style={{
                    width: 44, height: 24, borderRadius: 12,
                    background: displayed.isPublic !== false ? "#22c55e" : "#374151",
                    position: "relative", cursor: "pointer", transition: "background 0.2s",
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3,
                    left: displayed.isPublic !== false ? 23 : 3,
                    width: 18, height: 18, borderRadius: "50%", background: "#fff",
                    transition: "left 0.2s",
                  }} />
                </div>
                <span style={{ fontSize: 13, color: "#9ca3af" }}>
                  {displayed.isPublic !== false ? "Public" : "Private"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Stats Row 1 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
        {[
          { label: "TOTAL SCORE",   value: localUser.totalScore.toLocaleString(), color: "#facc15" },
          { label: "LEVELS PLAYED", value: localUser.totalLevels,                  color: "#60a5fa" },
          { label: "BEST SCORE",    value: bestScore.toLocaleString(),              color: "#22c55e" },
          { label: "AVG SCORE",     value: avgScore,                               color: "#a78bfa" },
        ].map(({ label: l, value, color }) => (
          <div key={l} style={card}>
            <div style={labelStyle}>{l}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Stats Row 2 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "BEST ACCURACY",    value: `${localUser.bestAccuracy.toFixed(1)}%`,       color: "#22c55e" },
          { label: "OVERALL HIT RATE", value: hitRate !== "—" ? `${hitRate}%` : "—",          color: "#60a5fa" },
          { label: "CURRENT STREAK",   value: `${localUser.currentStreak}d 🔥`,               color: "#f97316" },
          { label: "LONGEST STREAK",   value: `${localUser.longestStreak}d`,                  color: "#9ca3af" },
        ].map(({ label: l, value, color }) => (
          <div key={l} style={card}>
            <div style={labelStyle}>{l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Hit/Miss Bar ── */}
      {localUser.totalHits + localUser.totalMisses > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={labelStyle}>HIT / MISS BREAKDOWN</span>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              {localUser.totalHits.toLocaleString()} hits · {localUser.totalMisses.toLocaleString()} misses
            </span>
          </div>
          <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden" }}>
            <div style={{ width: `${hitRate}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)" }} />
            <div style={{ flex: 1, background: "#7f1d1d" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11 }}>
            <span style={{ color: "#22c55e" }}>{hitRate}% hits</span>
            <span style={{ color: "#ef4444" }}>{(100 - Number(hitRate)).toFixed(1)}% misses</span>
          </div>
        </div>
      )}

      {/* ── Top Performances ── */}
      {topLevels.length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ ...labelStyle, marginBottom: 16 }}>TOP PERFORMANCES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topLevels.map((s, i) => {
              const grade = getGrade(s.accuracy);
              return (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: 16,
                  background: "#111827", borderRadius: 8, padding: "12px 16px",
                }}>
                  <span style={{ fontSize: 22, width: 32, textAlign: "center" }}>{["🥇","🥈","🥉"][i]}</span>
                  <Link href={`/game/${s.levelId}`} style={{ flex: 1, color: "#f0f0f0", textDecoration: "none", fontWeight: 600 }}>
                    {s.levelId}
                  </Link>
                  <span style={{ color: grade.color, fontWeight: 900, fontSize: 20 }}>{grade.letter}</span>
                  <span style={{ color: "#facc15", fontWeight: 700, minWidth: 80, textAlign: "right" }}>
                    {s.score.toLocaleString()}
                  </span>
                  <span style={{ color: grade.color, fontSize: 13, minWidth: 60, textAlign: "right" }}>
                    {s.accuracy.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20, fontSize: 12, color: "#4b5563", textAlign: "right" }}>
        Last active: {timeAgo(localUser.lastPlayedAt)}
      </div>

      {/* ── Score History ── */}
      <div style={{ ...card, overflow: "hidden", padding: 0 }}>
        <div style={{
          padding: "20px 28px", borderBottom: "1px solid #1f2937",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: 3 }}>HISTORY</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>Recent Scores</div>
          </div>
          <div style={{ fontSize: 12, color: "#4b5563" }}>{scores.length} runs</div>
        </div>

        {scores.length === 0 ? (
          <div style={{ padding: "48px 28px", textAlign: "center", color: "#4b5563" }}>
            No scores yet{isOwner ? " — go play a song!" : "."}
          </div>
        ) : (
          <>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 110px 70px 100px 100px 100px",
              padding: "10px 28px", background: "#111827",
              fontSize: 10, color: "#6b7280", letterSpacing: 2,
            }}>
              <span>LEVEL</span><span>SCORE</span><span>GRADE</span>
              <span>ACCURACY</span><span>HITS / MISS</span><span>DATE</span>
            </div>
            {scores.map((s, i) => {
              const grade = getGrade(s.accuracy);
              return (
                <div key={s.id} style={{
                  display: "grid", gridTemplateColumns: "1fr 110px 70px 100px 100px 100px",
                  padding: "13px 28px", borderTop: "1px solid #1f2937",
                  background: i % 2 === 0 ? "transparent" : "#ffffff03", alignItems: "center",
                }}>
                  <Link href={`/game/${s.levelId}`} style={{ color: "#f0f0f0", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
                    {s.levelId}<span style={{ color: "#374151", fontSize: 11, marginLeft: 6 }}>↗</span>
                  </Link>
                  <span style={{ color: "#facc15", fontWeight: 700 }}>{s.score.toLocaleString()}</span>
                  <span style={{ color: grade.color, fontWeight: 900, fontSize: 20, textShadow: `0 0 10px ${grade.color}50` }}>
                    {grade.letter}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, color: grade.color, fontWeight: 600 }}>{s.accuracy.toFixed(1)}%</div>
                    <div style={{ height: 3, background: "#1f2937", borderRadius: 2, marginTop: 3 }}>
                      <div style={{ height: "100%", width: `${s.accuracy}%`, background: grade.color, borderRadius: 2 }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13 }}>
                    <span style={{ color: "#22c55e" }}>{s.hits}</span>
                    <span style={{ color: "#374151" }}> / </span>
                    <span style={{ color: "#ef4444" }}>{s.misses}</span>
                  </span>
                  <span style={{ color: "#4b5563", fontSize: 12 }}>{formatDate(s.createdAt)}</span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Hover overlay style */}
      <style>{`
        div[title="Click to change photo"]:hover .avatar-overlay { opacity: 1 !important; }
      `}</style>
    </div>
  );
}