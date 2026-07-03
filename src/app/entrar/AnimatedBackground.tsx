"use client";

import { useEffect, useRef } from "react";

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Dimensionar canvas
    function resizeCanvas() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Animação de linhas em movimento (transporte)
    const lines: Array<{
      x: number;
      y: number;
      length: number;
      width: number;
      speed: number;
      angle: number;
      color: string;
    }> = [];

    // Gerar linhas iniciais
    for (let i = 0; i < 6; i++) {
      lines.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        length: 150 + Math.random() * 150,
        width: 2 + Math.random() * 1.5,
        speed: 0.5 + Math.random() * 1,
        angle: (Math.PI / 4) * (0.5 + Math.random()),
        color: i % 2 === 0 ? "rgba(34, 211, 238, 0.3)" : "rgba(248, 113, 113, 0.3)",
      });
    }

    function animate() {
      if (!ctx || !canvas) return;

      // Limpar com gradiente sutil
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "rgba(15, 23, 42, 1)");
      gradient.addColorStop(1, "rgba(20, 30, 50, 1)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Desenhar linhas animadas
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

        // Mover linhas
        line.x += Math.cos(line.angle) * line.speed;
        line.y += Math.sin(line.angle) * line.speed;

        // Rebote nas bordas
        if (line.x < -200 || line.x > canvas.width + 200) {
          line.x = Math.random() * canvas.width;
          line.y = Math.random() * canvas.height;
        }
        if (line.y < -200 || line.y > canvas.height + 200) {
          line.y = Math.random() * canvas.height;
          line.x = Math.random() * canvas.width;
        }
      });

      // Adicionar alguns círculos leves (nós de conexão)
      ctx.fillStyle = "rgba(34, 211, 238, 0.15)";
      lines.forEach((line) => {
        ctx.beginPath();
        ctx.arc(line.x, line.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(animate);
    }

    animate();

    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10"
      aria-hidden="true"
    />
  );
}
