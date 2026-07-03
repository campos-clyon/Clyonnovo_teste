"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CookieConsent = dynamic(() => import("@/components/CookieConsent"), {
  ssr: false,
});

export default function DeferredCookieConsent() {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const enable = () => setShouldRender(true);

    const idleId =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(enable, { timeout: 1800 })
        : window.setTimeout(enable, 1200);

    return () => {
      if (typeof idleId === "number") {
        window.clearTimeout(idleId);
        return;
      }

      window.cancelIdleCallback?.(idleId);
    };
  }, []);

  return shouldRender ? <CookieConsent /> : null;
}
