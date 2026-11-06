"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Fade sections in as they enter view. Content stays visible until that moment. */
export function RevealRoot({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const nodes = root.querySelectorAll<HTMLElement>(".clp-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            element.classList.add("is-in");
            observer.unobserve(element);
          } else if (!element.classList.contains("is-in")) {
            element.dataset.pending = "true";
          }
        }
      },
      { threshold: 0.1 },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
