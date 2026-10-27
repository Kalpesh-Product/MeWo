"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./motion.module.css";

function LoadOverlay() {
  const [phase, setPhase] = useState<"loading" | "fading" | "done">("loading");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let frame: number;
    const loaded = () => {
      frame = requestAnimationFrame(() => {
        setPhase("fading");
        timer = setTimeout(
          () => setPhase("done"),
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 0
            : 1000,
        );
      });
    };
    if (document.readyState === "complete") loaded();
    else window.addEventListener("load", loaded, { once: true });
    return () => {
      window.removeEventListener("load", loaded);
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);
  if (phase === "done") return null;
  return (
    <div
      aria-hidden="true"
      className={styles.loader}
      data-fading={phase === "fading"}
    >
      <div className={styles.loaderInner}>
        <div className={styles.circle} />
      </div>
    </div>
  );
}

export function PageLoader() {
  const pathname = usePathname();
  return <LoadOverlay key={pathname} />;
}
