"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * A CHEGADA POR CONFIRMAR, NO CARTÃO DO TRABALHO — 31-10-2026 (d3).
 *
 * O parceiro disse «Cheguei» na app Pro e o cliente ainda não confirmou: sem
 * isso o «Está feito» não aparece. Se o cliente o disse ao telefone, a equipa
 * grava-o aqui (`confirmar_chegada` em /api/admin/negociacoes/agir, com o nome
 * de quem o fez no histórico). O cliente do WhatsApp pode confirmá-la sozinho
 * com um «SIM» à Vitória.
 */

export const BOTAO_CONFIRMAR_A_CHEGADA = "Confirmar a chegada (o cliente confirmou por telefone)";

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit" });

export default function ConfirmarChegadaNaMesa({
  pedidoId,
  negociacaoId,
  profissionalNome,
  chegouEm,
  onMudou,
}: {
  pedidoId: number;
  negociacaoId: number;
  profissionalNome: string;
  chegouEm: string;
  onMudou: () => void;
}) {
  const { token } = useAdminAuth();
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const nome = profissionalNome.trim().split(/\s+/)[0] || "O profissional";

  async function confirmar() {
    if (!token) return;
    if (!window.confirm(`O cliente confirmou-lhe por telefone que ${nome} chegou? Fica no histórico com o seu nome.`)) return;
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/agir", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId, negociacaoId, accao: "confirmar_chegada" }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível confirmar.");
        return;
      }
      onMudou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <div className="mt-2.5 rounded-xl border border-amber-500/50 bg-amber-950/30 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
        <MapPin className="h-4 w-4" aria-hidden="true" />
        {nome} diz que chegou às {hora(chegouEm)} — falta o cliente confirmar
      </p>
      <p className="mt-1 text-xs text-amber-100/80">
        Sem a confirmação, o trabalho não se pode dar por feito. Pelo WhatsApp, o cliente confirma com um «SIM».
      </p>
      <button
        type="button"
        disabled={aEnviar}
        onClick={() => void confirmar()}
        className="mt-2 min-h-[40px] rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {BOTAO_CONFIRMAR_A_CHEGADA}
      </button>
      {erro && <p className="mt-2 text-xs text-rose-300">{erro}</p>}
    </div>
  );
}
