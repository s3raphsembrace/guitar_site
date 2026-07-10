"use client";

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-zinc-200 p-4">{children}</div>;
}
