"use client";

import Image from "next/image";
import { useState } from "react";
import { User } from "lucide-react";

interface UserAvatarProps {
  /** URL da imagem (avatarUrl da DB ou imagem do Google). Pode ser null/undefined. */
  src?: string | null;
  /** Nome do utilizador — usado para extrair a inicial do fallback. */
  name?: string | null;
  /** Tamanho do círculo em píxeis (aplica-se a width, height e font-size). */
  size?: number;
  /** Classes CSS adicionais a aplicar ao elemento raiz. */
  className?: string;
}

/**
 * Avatar do utilizador com fallback automático.
 *
 * Hierarquia de fallback:
 *   1. Imagem da prop `src` (avatarUrl da DB ou imagem do Google)
 *   2. Se a imagem falhar (onError) ou `src` for nulo: gradiente #00B4D8 → #0077B6
 *      com a inicial do nome a branco e em bold
 *   3. Se não houver nome: ícone User (Lucide) a branco
 */
export default function UserAvatar({
  src,
  name,
  size = 40,
  className = "",
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const showImage = !!src && !imgError;
  const inicial = name ? name.trim().charAt(0).toUpperCase() : null;

  // Escala proporcional: ícone ≈ 45% do tamanho, fonte ≈ 42%
  const iconSize = Math.round(size * 0.45);
  const fontSize = Math.round(size * 0.42);

  if (showImage) {
    return (
      <Image
        src={src}
        alt={name ?? "Avatar"}
        width={size}
        height={size}
        onError={() => setImgError(true)}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name ?? "Utilizador"}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none ${className}`}
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #00B4D8 0%, #0077B6 100%)",
        fontSize,
      }}
    >
      {inicial ? (
        inicial
      ) : (
        <User style={{ width: iconSize, height: iconSize }} strokeWidth={2.2} />
      )}
    </span>
  );
}
