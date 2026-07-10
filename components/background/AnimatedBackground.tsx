"use client";

import dynamic from "next/dynamic";

interface AnimatedBackgroundProps {
  className?: string;
  mode?: 0 | 1;
  intensity?: number;
}

const Scene = dynamic(() => import("./Scene"), { ssr: false });

export default function AnimatedBackground({
  className,
  mode = 0,
  intensity = 1,
}: AnimatedBackgroundProps) {
  return (
    <div className={className} aria-hidden="true">
      <Scene mode={mode} intensity={intensity} />
    </div>
  );
}
