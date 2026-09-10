"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import {
  MOTIVOS_DE_CANCELAMENTO,
  avisoDoCancelamento,
  oQueSeDesfaz,
  type NegociacaoParaCancelar,
} from "@/lib/cancelamento";

/**
 * A CAIXA DE CANCELAR — uma só, para os dois ecrãs que cancelam.
 *
 * Era um `window.prompt` com o motivo à mão, e só existia na mesa das
 * negociações. Na Agenda, que é precisamente onde se dá pela desistência —
 * liga-se ao cliente para confirmar o dia e ouve-se «já não preciso» — não
 * havia por onde cancelar: era sair da agenda, procurar o pedido noutro ecrã
 * e perder o sítio.
 *
 * Os motivos são botões e não texto (ver `MOTIVOS_DE_CANCELAMENTO`). O aviso
 * do que se está a desfazer continua a aparecer ANTES, com o nome do
 * profissional e o valor: o direito de cancelar é absoluto, e absoluto não
 * quer dizer silencioso.
 */
export default function CancelarPedido({
  pedidoId,
  nomeDoCliente,
  negociacoes,
  token,
  onFechar,
  onCancelado,
}: {
  pedidoId: number;
  nomeDoCliente: string | null;
  /** O que há para desfazer. Na agenda é uma só: a que está contratada. */
  negociacoes: NegociacaoParaCancelar[];
  token: string;
  onFechar: () => void;
  onCancelado: () => void;
}) {
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [outro, setOutro] = useState("");
  const [aCancelar, setACancelar] = useState(false);
  const [erro, setErro] = useState("");

  const desfaz = oQueSeDesfaz(negociacoes);
  const aviso = avisoDoCancelamento(desfaz);
  const ehOutro = escolhido === "Outro motivo";
  const motivo = ehOutro ? outro.trim() : (escolhido ?? "");
  // Com um compromisso a desfazer o motivo é obrigatório; sem ele é só
  // arrumação, e um cancelamento sem motivo continua a poder passar.
  const podeCancelar = desfaz.motivoObrigatorio ? motivo.length > 0 : true;

  async function cancelar() {
    setACancelar(true);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/cancelar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId, motivo }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível cancelar.");
        return;
      }
      onCancelado();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACancelar(false);
    }
  }

  return (
    /*
     * Não fecha com um clique ao lado, como a ficha da agenda: há uma escolha
     * por fazer aqui dentro, e a margem escura é grande de propósito.
     */
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-white">
            Cancelar o pedido #{pedidoId}
            {nomeDoCliente ? ` de ${nomeDoCliente}` : ""}?
          </h3>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {aviso && (
          <p className="mt-3 flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{aviso}</span>
          </p>
        )}

        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          As negociações abertas terminam e o pedido sai da mesa. Não é apagado: fica o
          histórico e o registo.
        </p>

        <p className="mt-4 text-xs font-semibold text-slate-300">
          Porquê?{" "}
          {desfaz.motivoObrigatorio ? (
            <span className="text-amber-300">
              (obrigatório — é o que {desfaz.profissional} vai ler)
            </span>
          ) : (
            <span className="text-slate-500">(fica escrito)</span>
          )}
        </p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {[...MOTIVOS_DE_CANCELAMENTO, "Outro motivo"].map((m) => (
            <button
              key={m}
              onClick={() => {
                setEscolhido(m);
                setErro("");
              }}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                escolhido === m
                  ? "border-amber-500 bg-amber-500/15 text-amber-200"
                  : "border-slate-600 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {ehOutro && (
          <input
            value={outro}
            onChange={(e) => setOutro(e.target.value)}
            autoFocus
            placeholder="Escreva o motivo…"
            className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          />
        )}

        {erro && <p className="mt-3 text-xs text-red-300">{erro}</p>}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            onClick={onFechar}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            Voltar atrás
          </button>
          <button
            onClick={() => void cancelar()}
            disabled={aCancelar || !podeCancelar}
            className="flex items-center gap-2 rounded-lg bg-red-500/90 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-40"
          >
            {aCancelar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Cancelar o pedido
          </button>
        </div>
      </div>
    </div>
  );
}
