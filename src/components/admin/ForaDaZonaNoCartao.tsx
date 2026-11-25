"use client";

import { useState } from "react";
import { linhaDoForaDaZona, PARADO_FORA_DA_ZONA, type ForaDaZona } from "@/lib/fora-da-zona";

/**
 * «FORA DA ZONA» NO CARTÃO — d128 (25-11-2026, dono).
 *
 * O pedido cuja morada (ou, numa mudança, a origem) fica acima do limite da
 * zona salta à vista: a borda do cartão toda em âmbar (`BORDA_FORA_DA_ZONA`) e,
 * no topo, o ⚠ com a distância e o que fica parado. Dois botões:
 *
 * - «Morada certa, corrigida» abre o Editar pedido; dentro do limite, a marca
 *   sai sozinha e o pedido segue o caminho normal.
 * - «Cancelar e avisar o cliente», com a confirmação antes: cancela pelo
 *   caminho de sempre e envia uma mensagem ao cliente.
 *
 * A borda leva o «!» do Tailwind: ganha à cor da secção que o cartão já tem.
 * O backoffice é escuro: âmbar-400 na borda e âmbar-200/100 no texto sobre um
 * fundo âmbar translúcido. São classes da escala do Tailwind (sem hexadecimais),
 * por isso o tema escuro do painel, que troca as escalas, também as lê bem.
 */
export const BORDA_FORA_DA_ZONA = "border-amber-400! bg-slate-900! ring-2 ring-amber-400/40";

export function ForaDaZonaNoCartao({
  pedidoId,
  estado,
  token,
  onCorrigir,
  onCancelado,
  onErro,
}: {
  pedidoId: number;
  estado: ForaDaZona;
  token: string | null;
  /** Abre o Editar pedido (a morada). */
  onCorrigir?: () => void;
  /** Cancelado e avisado — quem o mostra volta a ler a lista. */
  onCancelado?: (texto: string) => void;
  onErro?: (texto: string) => void;
}) {
  const [aConfirmar, setAConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function cancelar() {
    if (!token || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const res = await fetch(`/api/admin/pedidos/${pedidoId}/fora-da-zona`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accao: "cancelar_e_avisar" }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; canal?: string | null; saiu?: boolean };
      if (!res.ok) {
        const texto = d.error ?? "Não foi possível cancelar.";
        setErro(texto);
        onErro?.(texto);
        return;
      }
      setAConfirmar(false);
      const comoSaiu =
        d.canal == null
          ? "sem telemóvel nem email: avise o cliente à mão"
          : d.saiu
            ? `mensagem enviada por ${d.canal === "whatsapp" ? "WhatsApp" : "email"}`
            : `a mensagem por ${d.canal === "whatsapp" ? "WhatsApp" : "email"} não saiu: avise o cliente à mão`;
      onCancelado?.(`Pedido #${pedidoId} cancelado (fora da zona) — ${comoSaiu}.`);
    } catch {
      setErro("Erro de rede.");
      onErro?.("Erro de rede.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div
      role="alert"
      className="mb-2 rounded-lg border border-amber-400/60 bg-amber-500/15 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="flex items-start gap-2 text-sm font-semibold text-amber-200">
        <span aria-hidden="true" className="text-base leading-none">
          ⚠
        </span>
        <span>{linhaDoForaDaZona(estado)}</span>
      </p>
      <p className="mt-1 text-xs text-amber-100/80">{PARADO_FORA_DA_ZONA}</p>
      {aConfirmar ? (
        <div className="mt-2 rounded-md border border-amber-400/50 bg-slate-950/60 p-2">
          <p className="text-xs font-semibold text-amber-100">Isto cancela o pedido e envia a mensagem ao cliente.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void cancelar()}
              disabled={ocupado || !token}
              className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
            >
              {ocupado ? "A cancelar…" : "Sim, cancelar e avisar"}
            </button>
            <button
              type="button"
              onClick={() => setAConfirmar(false)}
              disabled={ocupado}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60"
            >
              Não
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {onCorrigir && (
            <button
              type="button"
              onClick={onCorrigir}
              className="rounded-lg border border-amber-400/70 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/20"
            >
              Morada certa, corrigida
            </button>
          )}
          <button
            type="button"
            onClick={() => setAConfirmar(true)}
            disabled={!token}
            className="rounded-lg border border-amber-400/70 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
          >
            Cancelar e avisar o cliente
          </button>
        </div>
      )}
      {erro && <p className="mt-2 text-xs text-red-300">{erro}</p>}
    </div>
  );
}
