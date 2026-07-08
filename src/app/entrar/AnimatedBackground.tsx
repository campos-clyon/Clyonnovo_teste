"use client";

import { useEffect, useRef } from "react";

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resizeCanvas() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Linhas suaves em movimento — só tons da marca (ciano/turquesa), sem vermelho.
    const lines: Array<{
      x: number;
      y: number;
      length: number;
      width: number;
      speed: number;
      angle: number;
      color: string;
    }> = [];

    for (let i = 0; i < 7; i++) {
      lines.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        length: 140 + Math.random() * 160,
        width: 1.5 + Math.random() * 1.5,
        speed: 0.4 + Math.random() * 0.8,
        angle: (Math.PI / 4) * (0.4 + Math.random()),
        color: i % 2 === 0 ? "rgba(6, 182, 212, 0.18)" : "rgba(45, 212, 191, 0.14)",
      });
    }

    let raf = 0;

    function animate() {
      if (!ctx || !canvas) return;

      // Fundo claro com leve gradiente
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "rgba(248, 250, 252, 1)");
      gradient.addColorStop(0.5, "rgba(240, 249, 255, 1)");
      gradient.addColorStop(1, "rgba(236, 254, 255, 1)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      lines.forEach((line) => {
        ctx.strokeStyle = line.color;
        ctx.lineWidth = line.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(line.x, line.y);
        ctx.lineTo(
          line.x + Math.cos(line.angle) * line.length,
          line.y + Math.sin(line.angle) * line.length
        );
        ctx.stroke();

        line.x += Math.cos(line.angle) * line.speed;
        line.y += Math.sin(line.angle) * line.speed;

        if (line.x < -200 || line.x > canvas.width + 200) {
          line.x = Math.random() * canvas.width;
          line.y = Math.random() * canvas.height;
        }
        if (line.y < -200 || line.y > canvas.height + 200) {
          line.y = Math.random() * canvas.height;
          line.x = Math.random() * canvas.width;
        }
      });

      // Nós de ligação
      ctx.fillStyle = "rgba(6, 182, 212, 0.12)";
      lines.forEach((line) => {
        ctx.beginPath();
        ctx.arc(line.x, line.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10"
      aria-hidden="true"
    />
  );
}
