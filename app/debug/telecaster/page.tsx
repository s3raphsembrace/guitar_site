import Link from "next/link";
import TelecasterModelDebug from "@/components/background/TelecasterModelDebug";

export default function TelecasterDebugPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#05070d",
        color: "#d1d5db",
        padding: "16px",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Telecaster GLB Debug</h1>
          <Link
            href="/"
            style={{
              color: "#93c5fd",
              textDecoration: "none",
              border: "1px solid #1f2937",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 13,
            }}
          >
            Home
          </Link>
        </div>
        <p style={{ marginTop: 0, marginBottom: 14, color: "#94a3b8", fontSize: 13 }}>
          Raw model test route for <code>/models/telecaster/telecaster_web.glb</code> with basic
          lights and orbit controls.
        </p>
        <div
          style={{
            height: "80vh",
            border: "1px solid #1f2937",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <TelecasterModelDebug />
        </div>
      </div>
    </main>
  );
}
