"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { euros } from "@/components/portal/Portal";
import Nota from "@/components/Nota";
import { quantoOProfissionalRecebe, type Taxas } from "@/lib/taxas-plataforma";
import { ERROS_DO_ESCOLHIDO } from "@/lib/escolhidos-sem-resposta";
import { FICHA_DO_AVISO, porGravidade } from "@/lib/avisos-antes-de-cotar";
import type { AvisoAntesDeCotar } from "@/lib/profissional-elegivel";
import type { MudancaEscolhida } from "@/lib/mudanca-escolhida-pelo-cliente";

/**
 * «CONFIRMO: FAÇO POR X/H + IVA» — 11-11-2026 (d6).
 *
 * Numa mudança em que o cliente o escolheu, a primeira resposta é um toque: a
 * hora dele, que ficou guardada no pedido, vai como proposta num só pedido à
 * rota da negociação (o valor lê-o o servidor). Ao lado, «Propor um valor mais
 * baixo»; por baixo, a saída de sempre. Sem a linha das propostas por usar nem
 * os atalhos de percentagem: isso é da negociação, a partir da segunda.
 *
 * Os textos vêm todos da rota (`mudancaEscolhida.primeiraResposta`), os
 * mesmos que a app Pro lê. Depois do prazo os botões continuam activos.
 */
export function ConfirmarAHora({
  negociacaoId,
  textos,
  hora,
  taxas,
  onMudou,
}: {
  negociacaoId: number;
  textos: NonNullable<MudancaEscolhida["primeiraResposta"]>;
  /** A hora congelada, sem IVA (euros): o tecto do valor mais baixo. */
  hora: number;
  taxas?: Taxas;
  onMudou: () => void;
}) {
  const [maisBaixo, setMaisBaixo] = useState(false);
  const [valor, setValor] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const [semBotoes, setSemBotoes] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);
  /** O que ele ia fazer, à espera de ler os avisos do servidor e confirmar. */
  const [porConfirmar, setPorConfirmar] = useState<{ accao: string; valor?: string; avisos: AvisoAntesDeCotar[] } | null>(null);

  async function agir(accao: string, valorProposto?: string, avisosAceites = false) {
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch("/api/profissionais/negociacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accao, negociacaoId, valor: valorProposto, avisosAceites }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && Array.isArray(dados.avisos) && dados.avisos.length > 0) {
          setPorConfirmar({ accao, valor: valorProposto, avisos: dados.avisos });
          return;
        }
        setErro(dados.error ?? ERROS_DO_ESCOLHIDO.rede);
        if (dados.semBotoes === true || dados.jaDecidido === true) setSemBotoes(true);
        return;
      }
      setPorConfirmar(null);
      if (typeof dados.texto === "string") setFeito(dados.texto);
      onMudou();
    } catch {
      setErro(ERROS_DO_ESCOLHIDO.rede);
    } finally {
      setAEnviar(false);
    }
  }

  if (feito) {
    return (
      <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5" role="status">
        <p className="flex items-start gap-2 text-sm font-semibold leading-relaxed text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          {feito}
        </p>
      </section>
    );
  }

  const numero = Number(valor.replace(",", "."));
  const valorServe = valor.trim() !== "" && Number.isFinite(numero) && numero > 0;

  return (
    <section className="mt-4 rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm">
      {erro && (
        <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-700">
          {erro}
        </p>
      )}

      {porConfirmar && !semBotoes && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <ul className="list-none space-y-2 p-0">
            {porGravidade(porConfirmar.avisos).map((a) => (
              <li key={a}>
                <span className="block font-bold">{FICHA_DO_AVISO[a]?.titulo ?? a}</span>
                <span className="block leading-relaxed">{FICHA_DO_AVISO[a]?.corpo}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void agir(porConfirmar.accao, porConfirmar.valor, true)}
              disabled={aEnviar}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {FICHA_DO_AVISO[porGravidade(porConfirmar.avisos)[0]]?.botao ?? "Li e avanço"}
            </button>
            <button
              type="button"
              onClick={() => setPorConfirmar(null)}
              disabled={aEnviar}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-50"
            >
              Não avançar
            </button>
          </div>
        </div>
      )}

      {!semBotoes && !porConfirmar && !maisBaixo && (
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => void agir(textos.accao)}
            disabled={aEnviar}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-acao px-4 text-base font-bold text-white transition active:bg-acao-hover disabled:opacity-50"
          >
            {aEnviar && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {textos.confirmar}
          </button>
          <button
            type="button"
            onClick={() => {
              setErro("");
              setMaisBaixo(true);
            }}
            disabled={aEnviar}
            className="min-h-[48px] w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {textos.proporMaisBaixo}
          </button>
          <button
            type="button"
            onClick={() => void agir("desistir")}
            disabled={aEnviar}
            className="w-full rounded-xl border border-slate-200 py-2.5 text-sm text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-50"
          >
            {textos.naoEstouInteressado}
          </button>
        </div>
      )}

      {!semBotoes && !porConfirmar && maisBaixo && (
        <div>
          <label className="block text-sm font-medium text-slate-900" htmlFor={`valor-mais-baixo-${negociacaoId}`}>
            {textos.rotuloDoValor}
          </label>
          <input
            id={`valor-mais-baixo-${negociacaoId}`}
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="mt-1.5 w-full rounded-xl border-2 border-slate-300 bg-white p-3 text-base text-slate-900 outline-none transition focus:border-cyan-500"
          />
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{textos.regraDoValorMaisBaixo}</p>
          {valorServe && numero <= hora && (
            <p className="mt-1 text-sm font-semibold text-emerald-700">
              Recebe {euros(quantoOProfissionalRecebe(numero, taxas))}/h, já com a taxa.
            </p>
          )}
          <button
            type="button"
            onClick={() => void agir("propor", valor)}
            disabled={aEnviar || !valorServe}
            className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-acao px-4 text-base font-bold text-white transition active:bg-acao-hover disabled:opacity-40"
          >
            {aEnviar && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {textos.enviarProposta}
          </button>
          <button
            type="button"
            onClick={() => {
              setErro("");
              setMaisBaixo(false);
            }}
            disabled={aEnviar}
            className="mt-2 w-full py-2 text-sm text-slate-600 underline underline-offset-4 disabled:opacity-50"
          >
            {textos.voltar}
          </button>
        </div>
      )}

      <Nota titulo="Porque é que não há mensagens" className="mt-4">
        A negociação é só de valores. Sem conversa não há combinação por fora — e
        é isso que mantém o acordo por escrito, dos dois lados. Tem cinco
        propostas, e a sua fica de pé até o cliente lhe responder.
      </Nota>
    </section>
  );
}
