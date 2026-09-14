/**
 * Scroll Reveal Component
 * Animates children when they enter the viewport
 */

"use client";

import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { scrollRevealVariants } from "@/lib/motion/animations";

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  threshold?: number;
}

export function ScrollReveal({
  children,
  delay = 0,
  className = "",
  threshold = 0.1,
}: ScrollRevealProps) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: threshold,
        rootMargin: "0px 0px -50px 0px",
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold]);

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      variants={scrollRevealVariants}
      custom={delay}
      className={className}
    >
      {children}
    </motion.div>
  );
}
