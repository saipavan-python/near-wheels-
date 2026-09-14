"use client";

import { useState } from "react";
import { IMGS } from "@/lib/imagery";

/**
 * Landing hero visual — prefers a yellow car per brand direction,
 * falling back through alternates if a photo fails to load.
 */
const CHAIN = [IMGS.heroYellowA, IMGS.heroYellowB, IMGS.hero];

export default function HeroImage() {
  const [idx, setIdx] = useState(0);

  return (
    <img
      src={CHAIN[idx]}
      alt="A yellow sports car"
      fetchPriority="high"
      onError={() => setIdx((i) => Math.min(i + 1, CHAIN.length - 1))}
      className="hero-img absolute inset-0 h-full w-full object-cover"
    />
  );
}
