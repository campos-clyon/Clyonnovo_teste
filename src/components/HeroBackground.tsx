"use client";

import { useEffect, useRef } from "react";

interface Bubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  opacity: number;
  drift: number;
  driftSpeed: number;
  driftPhase: number;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  opacityDir: number;
}

export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let W = 0, H = 0;

    function resize() {
      const el = canvas!.parentElement;
      W = canvas!.width  = el ? el.offsetWidth  : window.innerWidth;
      H = canvas!.height = el ? el.offsetHeight : window.innerHeight;
    }

    // ── bubbles (limpeza / bolhas de água) ──────────────────────
    const NUM_BUBBLES = 28;
    const bubbles: Bubble[] = [];

    function makeBubble(startAtBottom = false): Bubble {
      return {
        x: Math.random() * (W || 1400),
        y: startAtBottom ? (H || 600) + Math.random() * 200 : Math.random() * (H || 600),
        r: 3 + Math.random() * 14,
        speed: 0.3 + Math.random() * 0.7,
        opacity: 0.06 + Math.random() * 0.14,
        drift: 0,
        driftSpeed: 0.004 + Math.random() * 0.008,
        driftPhase: Math.random() * Math.PI * 2,
      };
    }

    for (let i = 0; i < NUM_BUBBLES; i++) bubbles.push(makeBubble(false));

    // ── sparkle particles ────────────────────────────────────────
    const NUM_SPARKS = 40;
    const sparks: Particle[] = [];

    function makeSpark(): Particle {
      return {
        x: Math.random() * (W || 1400),
        y: Math.random() * (H || 600),
        size: 1 + Math.random() * 2,
        speed: 0.15 + Math.random() * 0.35,
        opacity: Math.random() * 0.5,
        opacityDir: (Math.random() > 0.5 ? 1 : -1) * (0.003 + Math.random() * 0.006),
      };
    }

    for (let i = 0; i < NUM_SPARKS; i++) sparks.push(makeSpark());

    // ── orb positions (static but slowly drifting) ───────────────
    let t = 0;

    function draw() {
      t += 0.004;
      ctx!.clearRect(0, 0, W, H);

      // base gradient — slightly lighter navy, clean feel
      const bg = ctx!.createLinearGradient(0, 0, W * 0.6, H);
      bg.addColorStop(0, "#0e2d47");
      bg.addColorStop(0.5, "#112e48");
      bg.addColorStop(1, "#0b2036");
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, W, H);

      // slow-moving orbs (cleaning/water feel — cyan + aquamarine)
      const orbs = [
        { cx: 0.15 + 0.08 * Math.sin(t * 0.7),  cy: 0.25 + 0.07 * Math.cos(t * 0.5),  r: 0.38, color: "rgba(0,188,220,0.13)" },
        { cx: 0.82 + 0.06 * Math.cos(t * 0.6),  cy: 0.65 + 0.09 * Math.sin(t * 0.4),  r: 0.30, color: "rgba(20,210,175,0.10)" },
        { cx: 0.50 + 0.10 * Math.sin(t * 0.45), cy: 0.15 + 0.06 * Math.cos(t * 0.8),  r: 0.22, color: "rgba(100,200,255,0.09)" },
        { cx: 0.72 + 0.07 * Math.cos(t * 0.55), cy: 0.12 + 0.05 * Math.sin(t * 0.65), r: 0.18, color: "rgba(0,220,200,0.08)" },
      ];

      for (const o of orbs) {
        const grd = ctx!.createRadialGradient(o.cx * W, o.cy * H, 0, o.cx * W, o.cy * H, o.r * W);
        grd.addColorStop(0, o.color);
        grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx!.fillStyle = grd;
        ctx!.fillRect(0, 0, W, H);
      }

      // subtle horizontal shimmer line (water surface)
      const shimmerY = H * (0.55 + 0.04 * Math.sin(t * 0.3));
      const shimmer = ctx!.createLinearGradient(0, shimmerY - 1, 0, shimmerY + 1);
      shimmer.addColorStop(0, "rgba(0,200,220,0)");
      shimmer.addColorStop(0.5, `rgba(0,200,220,${0.06 + 0.04 * Math.sin(t * 0.8)})`);
      shimmer.addColorStop(1, "rgba(0,200,220,0)");
      ctx!.fillStyle = shimmer;
      ctx!.fillRect(0, shimmerY - 1, W, 2);

      // bubbles
      for (const b of bubbles) {
        b.driftPhase += b.driftSpeed;
        b.x += Math.sin(b.driftPhase) * 0.4;
        b.y -= b.speed;

        if (b.y < -b.r * 2) {
          b.x = Math.random() * W;
          b.y = H + b.r;
          b.r = 3 + Math.random() * 14;
          b.speed = 0.3 + Math.random() * 0.7;
          b.opacity = 0.06 + Math.random() * 0.14;
        }

        ctx!.beginPath();
        ctx!.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(160,230,255,${b.opacity})`;
        ctx!.lineWidth = 0.8;
        ctx!.stroke();

        // inner highlight
        ctx!.beginPath();
        ctx!.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(220,245,255,${b.opacity * 0.6})`;
        ctx!.fill();
      }

      // sparkles / dust
      for (const s of sparks) {
        s.y -= s.speed;
        s.opacity += s.opacityDir;
        if (s.opacity <= 0 || s.opacity >= 0.55) s.opacityDir *= -1;
        if (s.y < 0) { s.y = H; s.x = Math.random() * W; }

        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(180,240,255,${s.opacity})`;
        ctx!.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
