/**
 * Motion Card Component
 * Provides smooth hover and reveal animations
 */

"use client";

import { motion } from "framer-motion";
import { cardHoverVariants, scrollRevealVariants } from "@/lib/motion/animations";
import { useRef, useEffect, useState } from "react";

interface MotionCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function MotionCard({
  children,
  className = "",
  delay = 0,
}: MotionCardProps) {
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
        threshold: 0.1,
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
  }, []);

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      variants={scrollRevealVariants}
      custom={delay}
      className={className}
    >
      <motion.div
        variants={cardHoverVariants}
        className="h-full"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
