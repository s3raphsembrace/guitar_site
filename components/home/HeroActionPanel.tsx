"use client";

import Link from "next/link";
import type { PointerEventHandler, RefObject } from "react";
import { Play, Rocket, ScanLine, StepForward } from "lucide-react";
import styles from "@/components/home/HomePage.module.css";

export type HeroStatusTone = "good" | "warn" | "neutral";

export interface HeroStatusChip {
  label: string;
  value: string;
  tone: HeroStatusTone;
}

interface HeroActionPanelProps {
  title: string;
  subtitle: string;
  displayClassName?: string;
  playHref: string;
  practiceHref: string;
  createHref: string;
  continueHref?: string;
  continueText?: string;
  statusChips: HeroStatusChip[];
  panelRef?: RefObject<HTMLDivElement | null>;
  onPanelPointerMove?: PointerEventHandler<HTMLDivElement>;
  onPanelPointerLeave?: PointerEventHandler<HTMLDivElement>;
}

const toneClassByValue: Record<HeroStatusTone, string> = {
  good: styles.statusGood,
  warn: styles.statusWarn,
  neutral: styles.statusNeutral,
};

export function HeroActionPanel({
  title,
  subtitle,
  displayClassName,
  playHref,
  practiceHref,
  createHref,
  continueHref,
  continueText,
  statusChips,
  panelRef,
  onPanelPointerMove,
  onPanelPointerLeave,
}: HeroActionPanelProps) {
  return (
    <section className={styles.heroSection} aria-labelledby="home-hero-title">
      <div
        ref={panelRef}
        className={styles.heroPanel}
        data-home-hero-panel="true"
        onPointerMove={onPanelPointerMove}
        onPointerLeave={onPanelPointerLeave}
      >
        <p className={styles.heroEyebrow}>Action Hub</p>
        <h1 id="home-hero-title" className={`${styles.heroTitle} ${displayClassName ?? ""}`}>
          {title}
        </h1>
        <p className={styles.heroSubtitle}>{subtitle}</p>

        <div className={styles.heroActions}>
          <Link href={playHref} className={`${styles.actionButton} ${styles.actionPrimary}`}>
            <Play size={16} aria-hidden="true" />
            Play Now
          </Link>
          <Link href={practiceHref} className={`${styles.actionButton} ${styles.actionSecondary}`}>
            <ScanLine size={16} aria-hidden="true" />
            Practice Mode
          </Link>
          <Link href={createHref} className={`${styles.actionButton} ${styles.actionTertiary}`}>
            <Rocket size={16} aria-hidden="true" />
            Create Level
          </Link>
        </div>

        {continueHref && (
          <Link href={continueHref} className={styles.continueButton}>
            <StepForward size={14} aria-hidden="true" />
            {continueText ?? "Continue Last Session"}
          </Link>
        )}

        <div className={styles.statusRow} aria-label="Quick status">
          {statusChips.map((chip) => (
            <div key={chip.label} className={`${styles.statusChip} ${toneClassByValue[chip.tone]}`}>
              <span className={styles.statusLabel}>{chip.label}</span>
              <span className={styles.statusValue}>{chip.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
