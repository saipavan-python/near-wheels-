"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

interface PageMotionProps {
  children: React.ReactNode;
}

export default function PageMotion({ children }: PageMotionProps) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  if (pathname === "/") {
    return <>{children}</>;
  }

  return (
    <motion.div
      key={pathname}
      className="nw-motion-page"
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
