"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * O PASSO DA VALIDADE NUM CARTÃO DE «A AGUARDAR CLIENTE» — d62, 18-11-2026.
 *
 * «orçamento enviado 17/11 · lembrete 1 a 18/11 · último aviso a 20/11 · fecha
 * a 21/11 às 18h» (ou «fecharia», com o interruptor desligado), e o botão
 * «Lembrar agora»: o próximo lembrete sai já, fora das horas da rotina, uma vez.
 * A linha vem escrita do servidor (`validadeNaMesa`).
 */
export type ValidadeNaMesa = {
  pedidoId: number;
  linha: string;
  lembrar: string | null;
  parado: boolean;
  falha: string | null;
};

export default function PassoDaValidade({
  estado,
  onFeito,
  onErro,
}: {
  estado: ValidadeNaMesa | undefined;
  onFeito: (texto: string) => void;
  onErro: (texto: string) => void;
}) {
  const { token } = useAdminAuth();
  const [aEnviar, setAEnviar] = useState(false);
  if (!estado) return null;

  async function lembrar() {
    if (!token || !estado) return;
    if (!window.confirm(`Enviar já ao cliente do #${estado.pedidoId} o próximo lembrete do orçamento, pelo WhatsApp da CLYON?`)) return;
    setAEnviar(true);
    try {
      const r = await fetch("/api/admin/validade-dos-orcamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId: estado.pedidoId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) onErro(d.error ?? "Não foi possível enviar o lembrete.");
      else onFeito(d.feito ?? `#${estado.pedidoId}: lembrete enviado.`);
    } catch {
      onErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-laranja-texto">
      <span>{estado.linha}</span>
      {estado.falha && <span className="text-red-300">— da última vez: {estado.falha}</span>}
      {estado.lembrar && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void lembrar();
          }}
          disabled={aEnviar}
          className="flex items-center gap-1 rounded-md border border-laranja/50 px-2 py-0.5 text-[11px] font-semibold text-laranja-texto hover:bg-laranja/14 disabled:opacity-50"
        >
          {aEnviar && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
          {estado.lembrar}
        </button>
      )}
    </div>
  );
}
