"use client";

import { useEffect, useState } from "react";
import { concelhoPorId, type IdDoConcelho } from "@/lib/concelhos-da-cobertura";

/**
 * «HÁ N PEDIDOS NA SUA ZONA ESTE MÊS» — 04-11-2026 (d16, recrutamento por zona).
 *
 * Quem chega por um anúncio de uma zona (`/quero-ser-parceiro?zona=sintra`) lê
 * quantos pedidos chegaram dali este mês. Os números vêm da página (lidos da
 * base de hora a hora, como o da semana) e só trazem os concelhos com pelo
 * menos `MINIMO_PARA_MOSTRAR`: abaixo disso, ou sem zona, não se diz nada.
 *
 * Lê a zona no browser para a página continuar a mesma para toda a gente (e
 * guardada de hora a hora), em vez de uma por endereço.
 */
export default function ProcuraNaZona({ porConcelho }: { porConcelho: Partial<Record<IdDoConcelho, number>> }) {
  const [zona, setZona] = useState<{ nome: string; n: number } | null>(null);

  useEffect(() => {
    const c = concelhoPorId(new URLSearchParams(window.location.search).get("zona"));
    const n = c ? porConcelho[c.id] : undefined;
    setZona(c && n != null ? { nome: c.nome, n } : null);
  }, [porConcelho]);

  if (!zona) return null;
  return (
    <p className="mx-auto mt-3 max-w-xl text-base text-slate-700">
      Há <strong className="font-bold text-[#0B1929]">{zona.n} pedidos</strong> na sua zona ({zona.nome}) este mês.
    </p>
  );
}
