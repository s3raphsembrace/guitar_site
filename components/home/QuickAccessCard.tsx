"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import styles from "@/components/home/HomePage.module.css";

export type QuickCardAccent = "cyan" | "lime" | "magenta" | "amber";

interface QuickAccessCardProps {
  label: string;
  title: string;
  meta: string;
  actionLabel: string;
  href: string;
  accent?: QuickCardAccent;
  icon?: ReactNode;
}

const accentClassByValue: Record<QuickCardAccent, string> = {
  cyan: styles.quickCardCyan,
  lime: styles.quickCardLime,
  magenta: styles.quickCardMagenta,
  amber: styles.quickCardAmber,
};

export function QuickAccessCard({
  label,
  title,
  meta,
  actionLabel,
  href,
  accent = "cyan",
  icon,
}: QuickAccessCardProps) {
  return (
    <article className={`${styles.quickCard} ${accentClassByValue[accent]}`}>
      <div className={styles.quickTopRow}>
        <div>
          <p className={styles.quickLabel}>{label}</p>
          <h3 className={styles.quickCardTitle}>{title}</h3>
          <p className={styles.quickCardMeta}>{meta}</p>
        </div>
        {icon ? <div className={styles.quickIconWrap}>{icon}</div> : null}
      </div>
      <Link href={href} className={styles.quickAction}>
        {actionLabel}
        <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </article>
  );
}
