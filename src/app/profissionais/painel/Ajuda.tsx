"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, MessageSquarePlus, Phone } from "lucide-react";
import { CabecalhoDeEcra } from "@/components/portal/Portal";
import Nota from "@/components/Nota";
import {
  PERGUNTAS_DO_PROFISSIONAL,
  ASSUNTOS_DE_AJUDA,
  MINIMO_DA_MENSAGEM,
  rotuloDoAssunto,
} from "@/lib/ajuda-plataforma";
import { BUSINESS_PHONE } from "@/lib/seo-data";

/**
 * Ajuda.
 *
 * Primeiro as perguntas com resposta, depois a forma de perguntar. A ordem não
 * é cortesia: cada dúvida que ele resolve sozinho é um dia que não passa à
 * espera de nós. Um botão de "contactar" sozinho, sem nada por cima, garante
 * que todas as perguntas passam por uma pessoa — incluindo as seis que se
 * repetem sempre.
 *
 * As respostas dizem números concretos, e vêm das constantes que os produzem —
 * a comissão, o prazo, o mínimo de levantamento. Escritas à mão, ficavam
 * desactualizadas no dia em que qualquer uma mudasse, e a página passaria a
 * mentir com confiança.
 */

const CAIXA =
  "w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-cyan-600";

type PedidoDeAjuda = {
  id: number;
  assunto: string;
  mensagem: string;
  estado: string;
  respostas: Array<{ texto: string; em: string; por: string }>;
  createdAt: string;
};

const ESTADO: Record<string, { texto: string; cls: string }> = {
  open: { texto: "à espera de resposta", cls: "bg-amber-100 text-amber-800" },
  in_progress: { texto: "a ser tratado", cls: "bg-blue-100 text-blue-800" },
  waiting_customer: { texto: "à espera de si", cls: "bg-cyan-100 text-cyan-800" },
  closed: { texto: "resolvido", cls: "bg-emerald-100 text-emerald-800" },
};

export default function Ajuda({ onVoltar }: { onVoltar: () => void }) {
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [meus, setMeus] = useState<PedidoDeAjuda[]>([]);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/profissionais/ajuda");
      if (!res.ok) return;
      const dados = await res.json();
      setMeus(dados.pedidos ?? []);
    } catch {
      /* a lista do que já escreveu é útil, não é essencial */
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function enviar() {
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch("/api/profissionais/ajuda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assunto, mensagem }),
      });
      const r = await res.json();
      if (!res.ok) {
        setErro(r.error ?? "Não foi possível enviar.");
        return;
      }
      setEnviado(true);
      setAssunto("");
      setMensagem("");
      await carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  const podeEnviar = assunto && mensagem.trim().length >= MINIMO_DA_MENSAGEM;

  return (
    <>
      <CabecalhoDeEcra titulo="Ajuda" onVoltar={onVoltar} />

      {/* ── As que se repetem ──────────────────────────────────────────── */}
      <section className="mb-5">
        <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-400">
          Perguntas frequentes
        </h2>
        <div className="space-y-2">
          {PERGUNTAS_DO_PROFISSIONAL.map((p) => (
            <Nota key={p.pergunta} titulo={p.pergunta}>
              {p.resposta}
            </Nota>
          ))}
        </div>
      </section>

      {/* ── O que já perguntou ─────────────────────────────────────────── */}
      {meus.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-400">
            O que já perguntou
          </h2>
          <div className="space-y-2">
            {meus.map((p) => (
              <article
                key={p.id}
                className="rounded-2xl border border-[#E2EEF3] bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[#0B1929]">
                    {rotuloDoAssunto(p.assunto)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      (ESTADO[p.estado] ?? ESTADO.open).cls
                    }`}
                  >
                    {(ESTADO[p.estado] ?? ESTADO.open).texto}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(p.createdAt).toLocaleDateString("pt-PT")}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">{p.mensagem}</p>

                {p.respostas.map((r, i) => (
                  <div key={i} className="mt-2 rounded-xl bg-cyan-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                      {r.por || "CLYON"}
                      <span className="ml-1.5 font-normal normal-case tracking-normal text-cyan-600">
                        {new Date(r.em).toLocaleDateString("pt-PT")}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-cyan-900">{r.texto}</p>
                  </div>
                ))}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── Perguntar ──────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#0B1929]">
          <MessageSquarePlus className="h-5 w-5 text-cyan-600" aria-hidden="true" />
          Não encontrou a resposta?
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Escreva-nos. Fica registado na sua conta e a resposta aparece aqui.
        </p>

        {enviado ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-emerald-900">Recebemos o seu pedido</p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-800">
              Respondemos por aqui e por email. Se for urgente, ligue-nos.
            </p>
            <button
              onClick={() => setEnviado(false)}
              className="mt-3 text-sm font-semibold text-emerald-700 underline"
            >
              Escrever outra vez
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Assunto</span>
              <select
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                className={`mt-1.5 ${CAIXA}`}
              >
                <option value="">Escolha…</option>
                {ASSUNTOS_DE_AJUDA.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">O que se passa</span>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={5}
                placeholder="Descreva com algum detalhe. Se for sobre um pedido, diga o número."
                className={`mt-1.5 ${CAIXA}`}
              />
            </label>

            {erro && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </p>
            )}

            <button
              onClick={enviar}
              disabled={!podeEnviar || aEnviar}
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-base font-bold text-white transition active:bg-cyan-700 disabled:opacity-40"
            >
              {aEnviar && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
              Enviar
            </button>
          </div>
        )}

        <a
          href={`tel:${BUSINESS_PHONE.replace(/[^\d+]/g, "")}`}
          className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-700 transition active:bg-slate-50"
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
          Ligar à CLYON — {BUSINESS_PHONE}
        </a>
      </section>
    </>
  );
}
