"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * A «Reserva do valor único» está ligada? — d101 (dono, 24-11-2026).
 *
 * Para a Mesa só falar da reserva com ela ligada. Desligada por omissão e na
 * dúvida (sem sessão, sem acesso, a rede a falhar). Uma leitura por página.
 */
let pedido: Promise<boolean> | null = null;

export function useReservaDoValorUnico(): boolean {
  const { token } = useAdminAuth();
  const [ligada, setLigada] = useState(false);
  useEffect(() => {
    if (!token) return;
    let vivo = true;
    pedido ??= fetch("/api/admin/reserva-do-valor-unico/interruptor", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(async (r) => (r.ok ? ((await r.json()) as { ligado?: unknown }).ligado === true : false))
      .catch(() => false);
    void pedido.then((v) => {
      if (vivo) setLigada(v);
    });
    return () => {
      vivo = false;
    };
  }, [token]);
  return ligada;
}

/** Depois de mudar o interruptor, a próxima leitura vai à base. */
export function esquecerAReservaLida(): void {
  pedido = null;
}
