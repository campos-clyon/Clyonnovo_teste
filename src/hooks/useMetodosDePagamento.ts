"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * OS MÉTODOS DE PAGAMENTO DAS CONFIGS, para a mensagem de adjudicação —
 * 27-10-2026. Lê-se uma vez por página (todos os cartões partilham a mesma
 * leitura); guardar nas Configs avisa (`metodosDePagamentoMudaram`) e os
 * cartões abertos passam a usar o texto novo.
 *
 * `metodos` é `null` sem texto nas Configs; `lido` diz se a leitura acabou
 * (para o aviso de «preencha nas Configs» não piscar ao abrir).
 */

type Estado = { metodos: string | null; lido: boolean };

let leitura: Promise<string | null> | null = null;
let ultimo: Estado = { metodos: null, lido: false };
const quemOuve = new Set<(e: Estado) => void>();

function avisar(e: Estado) {
  ultimo = e;
  for (const f of quemOuve) f(e);
}

/** Depois de guardar nas Configs: o texto novo para todos os cartões abertos. */
export function metodosDePagamentoMudaram(metodos: string | null) {
  leitura = Promise.resolve(metodos);
  avisar({ metodos, lido: true });
}

export function useMetodosDePagamento(): Estado {
  const { token } = useAdminAuth();
  const [estado, setEstado] = useState<Estado>(ultimo);

  useEffect(() => {
    quemOuve.add(setEstado);
    return () => {
      quemOuve.delete(setEstado);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    if (!leitura) {
      leitura = fetch("/api/admin/metodos-de-pagamento", { headers: { Authorization: `Bearer ${token}` } })
        .then(async (r) => {
          if (!r.ok) return null;
          const j = (await r.json()) as { metodos?: string | null };
          return typeof j.metodos === "string" && j.metodos.trim() ? j.metodos : null;
        })
        .catch(() => null);
      void leitura.then((metodos) => avisar({ metodos, lido: true }));
    } else if (ultimo.lido) {
      setEstado(ultimo);
    }
  }, [token]);

  return estado;
}
