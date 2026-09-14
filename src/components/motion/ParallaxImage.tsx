/**
 * Parallax Image Component
 * Creates subtle parallax effect on mouse move and scroll
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface ParallaxImageProps {
  src: string;
  alt: string;
  className?: string;
  strength?: number;
}

export function ParallaxImage({
  src,
  alt,
  className = "",
  strength = 0.3,
}: ParallaxImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect mobile
    setIsMobile(window.innerWidth < 768);

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Mouse parallax (desktop only)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile || !ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const x = (e.clientX - rect.left - centerX) * strength * 0.02;
    const y = (e.clientY - rect.top - centerY) * strength * 0.02;

    setOffset({ x, y });
  };

  const handleMouseLeave = () => {
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`overflow-hidden ${className}`}
    >
      <motion.img
        src={src}
        alt={alt}
        initial={{ scale: 1.05 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        whileHover={!isMobile ? { scale: 1.02 } : {}}
        style={{
          x: offset.x,
          y: offset.y,
        }}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
