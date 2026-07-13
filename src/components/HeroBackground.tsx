"use client";

import { useEffect, useRef } from "react";

export default function HeroBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let tx = 0, ty = 0; // target
    let cx = 0, cy = 0; // current (lerped)

    function onMove(e: MouseEvent | TouchEvent) {
      const rect = el!.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      tx = ((clientX - rect.left) / rect.width  - 0.5) * 2;   // -1 to 1
      ty = ((clientY - rect.top)  / rect.height - 0.5) * 2;
    }

    function tick() {
      cx += (tx - cx) * 0.04;
      cy += (ty - cy) * 0.04;
      if (el) {
        el.style.setProperty("--mx", cx.toFixed(4));
        el.style.setProperty("--my", cy.toFixed(4));
      }
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={
        {
          "--mx": "0",
          "--my": "0",
          background: "linear-gradient(135deg, #0c1e32 0%, #0e2a44 40%, #091826 100%)",
        } as React.CSSProperties
      }
    >
      {/* Noise grain */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,180,216,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,180,216,1) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          transform: "perspective(1000px) rotateX(calc(var(--my) * 4deg)) rotateY(calc(var(--mx) * -4deg))",
          transformOrigin: "center center",
          transition: "none",
        }}
      />

      {/* Orb 1 — cyan large */}
      <div
        className="absolute rounded-full"
        style={{
          width: 600,
          height: 600,
          top: "-10%",
          left: "-8%",
          background: "radial-gradient(circle, rgba(0,180,216,0.22) 0%, transparent 65%)",
          transform: "translate(calc(var(--mx) * 30px), calc(var(--my) * 20px))",
          willChange: "transform",
        }}
      />

      {/* Orb 2 — blue mid */}
      <div
        className="absolute rounded-full"
        style={{
          width: 400,
          height: 400,
          bottom: "-5%",
          right: "10%",
          background: "radial-gradient(circle, rgba(56,134,255,0.18) 0%, transparent 65%)",
          transform: "translate(calc(var(--mx) * -20px), calc(var(--my) * -25px))",
          willChange: "transform",
        }}
      />

      {/* Orb 3 — teal accent small */}
      <div
        className="absolute rounded-full"
        style={{
          width: 260,
          height: 260,
          top: "30%",
          right: "5%",
          background: "radial-gradient(circle, rgba(20,220,185,0.14) 0%, transparent 65%)",
          transform: "translate(calc(var(--mx) * 40px), calc(var(--my) * -15px))",
          willChange: "transform",
        }}
      />

      {/* Orb 4 — deep purple counter-accent */}
      <div
        className="absolute rounded-full"
        style={{
          width: 340,
          height: 340,
          bottom: "15%",
          left: "25%",
          background: "radial-gradient(circle, rgba(100,60,200,0.12) 0%, transparent 65%)",
          transform: "translate(calc(var(--mx) * 15px), calc(var(--my) * 35px))",
          willChange: "transform",
        }}
      />

      {/* Floating particles */}
      {[
        { cx: "15%", cy: "20%", r: 2.5, delay: "0s",   dur: "7s"  },
        { cx: "82%", cy: "15%", r: 1.5, delay: "1.4s", dur: "9s"  },
        { cx: "60%", cy: "72%", r: 2,   delay: "0.8s", dur: "8s"  },
        { cx: "38%", cy: "55%", r: 1,   delay: "2.2s", dur: "6s"  },
        { cx: "70%", cy: "38%", r: 1.5, delay: "3.1s", dur: "10s" },
        { cx: "22%", cy: "80%", r: 1,   delay: "1.8s", dur: "7s"  },
      ].map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-cyan-300/60"
          style={{
            width:  p.r * 2,
            height: p.r * 2,
            left:   p.cx,
            top:    p.cy,
            animation: `heroFloat ${p.dur} ease-in-out ${p.delay} infinite alternate`,
          }}
        />
      ))}

      <style>{`
        @keyframes heroFloat {
          from { transform: translateY(0px) translateX(0px); opacity: 0.4; }
          to   { transform: translateY(-18px) translateX(8px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
