"use client";

import { useState } from "react";
import { Loader2, UserMinus } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { confirmacaoDeTirar, ROTULO_DE_TIRAR, type OndeEsta } from "@/lib/tirar-a-empresa";

/**
 * «TIRAR A EMPRESA E PEDIR PROPOSTAS DE NOVO» — d137 (26-11-2026; o #595).
 *
 * Num Trabalho CLYON atribuído (ou num contratado da Mesa) ainda por fazer e
 * sem dinheiro em jogo. Abre por baixo a frase do que acontece e a caixa do
 * motivo (opcional); só grava com o segundo clique. O servidor recusa, com o
 * porquê, o que tiver dinheiro, fatura ou o trabalho dado por feito. Ver
 * `tirar-a-empresa.ts`.
 */
export default function TirarAEmpresa({
  pedidoId,
  empresa,
  onde,
  onFeito,
}: {
  pedidoId: number;
  empresa: string;
  onde: OndeEsta;
  onFeito: (r: { feito: string; diaPassou: boolean }) => void;
}) {
  const { token } = useAdminAuth();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");

  const tirar = async () => {
    if (!token) return;
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/tirar-empresa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId, motivo: motivo.trim() || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(String(d.error ?? "Não foi possível tirar a empresa."));
        return;
      }
      setAberto(false);
      setMotivo("");
      onFeito({ feito: String(d.feito ?? `#${pedidoId}: a empresa saiu do trabalho.`), diaPassou: d.diaPassou === true });
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  };

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/10"
      >
        <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
        {ROTULO_DE_TIRAR[onde]}
      </button>
    );
  }
  return (
    <div className="mt-2 rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-xs text-rose-100">
      <p className="font-semibold">{confirmacaoDeTirar(empresa, onde)}</p>
      <label className="mt-2 block text-[11px] text-rose-200/80">
        Porquê (opcional — fica no histórico)
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={300}
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
          placeholder="Ex.: não apareceu no dia combinado"
        />
      </label>
      {erro && <p className="mt-1.5 text-rose-300">{erro}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void tirar()}
          disabled={aEnviar}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 font-bold text-white hover:bg-rose-500 disabled:opacity-50"
        >
          {aEnviar && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Tirar e avisar
        </button>
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setErro("");
          }}
          disabled={aEnviar}
          className="rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-slate-300 hover:bg-slate-800"
        >
          Não
        </button>
      </div>
    </div>
  );
}
