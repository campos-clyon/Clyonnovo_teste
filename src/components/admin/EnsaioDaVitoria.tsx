"use client";

import { useCallback, useEffect, useState } from "react";
import { Equal, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * O ENSAIO DA VITÓRIA — d85, fase 0 (22-11-2026).
 *
 * Com o interruptor «Vitória agente — ensaio» ligado (Configs), cada mensagem
 * de um cliente ganha aqui uma linha: o que ele escreveu (sem dados de
 * pessoas), o que a Vitória de hoje respondeu e o que o agente teria
 * respondido e feito, com o custo. A equipa diz se a do agente estava melhor
 * ou pior — é com isto que se decide ligá-lo a sério. Só leitura: nada daqui
 * chega ao cliente.
 *
 * d92 (23-11-2026): cada linha diz numa frase o que o agente TERIA FEITO
 * («teria proposto o fecho do #… por … (à espera do SIM)», «teria perguntado
 * ao parceiro se consegue: …», «teria passado à equipa: …»), com o filtro «só
 * as que agiriam». Com a «conversa livre» ligada, as linhas «saiu a sério»
 * são respostas que o cliente recebeu.
 *
 * d99 (23-11-2026), fase 1: a RECOLHA EM ENSAIO (quem ainda não tem pedido)
 * entra aqui também — as linhas «recolha», o «Igual» na avaliação, e os cinco
 * critérios para a fase 2 (campos do resumo iguais, fugas, avaliadas
 * melhor/igual, custo por pedido, prazo).
 */
type Ensaio = {
  id: number;
  em: string;
  telefone: string;
  pedidoId: number | null;
  mensagemDoCliente: string | null;
  respostaReal: string | null;
  respostaDoAgente: string | null;
  teriaFeito: string[];
  oQueTeriaFeito?: string;
  agiria?: boolean;
  aSerio?: boolean;
  estado: string;
  motivo: string | null;
  custoUsd: number;
  tokensCacheLidos: number;
  avaliacao: "melhor" | "igual" | "pior" | null;
  avaliadoPor: string | null;
};
type Criterio = { valor: number | null; meta: string; cumpre: boolean | null; base: number };
type Recolha = {
  ligado: boolean;
  tectoUsd: number;
  gastoHojeUsd: number;
  metricas: {
    ensaios: number;
    camposIguais: Criterio;
    fugasNoModelo: Criterio;
    fugasEvitadas: number;
    avaliadasMelhorOuIgual: Criterio;
    custoPorPedidoUsd: Criterio;
    passaramOPrazo: Criterio;
    prontaParaAFase2: boolean | null;
  };
};
type Resposta = {
  ensaios: Ensaio[];
  melhor: number;
  igual?: number;
  pior: number;
  avaliados: number;
  porAvaliar: number;
  ligado: boolean;
  recolha?: Recolha | null;
};
type Accao = { em: string; ferramenta: string; entrada: string | null; resultado: string | null; texto: string | null; custoUsd: number; erro: string | null };

const ROTA = "/api/admin/whatsapp/ensaio-da-vitoria";

const ESTADO: Record<string, string> = {
  ok: "respondeu",
  vitoria: "deixado à Vitória",
  equipa: "passaria à equipa",
  bloqueado: "bloqueada pela revisão",
  tecto: "tecto do dia",
  erro: "erro",
  recusou: "recusou",
  inactivo: "sem chave",
  a_correr: "a correr",
  codigo: "o código leu a resposta",
  vivo_ok: "saiu a sério",
  vivo_equipa: "saiu a sério — passou à equipa",
  vivo_codigo: "saiu a sério — o código agiu",
  vivo_regras: "responderam as regras",
  vivo_a_correr: "a correr (a sério)",
  vivo_parceiro: "a sério — o parceiro respondeu (ou não, a tempo)",
  recolha_ok: "recolha — respondeu",
  recolha_equipa: "recolha — passaria à equipa",
  recolha_bloqueado: "recolha — bloqueada pela revisão",
  recolha_erro: "recolha — erro",
  recolha_recusou: "recolha — recusou",
  recolha_tecto: "recolha — tecto do dia",
  recolha_inactivo: "recolha — sem chave",
  recolha_a_correr: "recolha — a correr",
  recolha_codigo: "recolha — o código leu o SIM",
  recolha_fuga: "recolha — dado pessoal travado",
};

const emPct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 1000) / 10} %`);
const LINHAS_DOS_CRITERIOS: Array<{ chave: "camposIguais" | "fugasNoModelo" | "avaliadasMelhorOuIgual" | "custoPorPedidoUsd" | "passaramOPrazo"; nome: string; valor: (c: Criterio) => string }> = [
  { chave: "camposIguais", nome: "Campos do resumo iguais aos da Vitória", valor: (c) => emPct(c.valor) },
  { chave: "fugasNoModelo", nome: "Nomes ou moradas no que foi ao modelo", valor: (c) => (c.valor == null ? "—" : String(c.valor)) },
  { chave: "avaliadasMelhorOuIgual", nome: "Avaliadas melhor ou igual", valor: (c) => emPct(c.valor) },
  { chave: "custoPorPedidoUsd", nome: "Custo por pedido (por número)", valor: (c) => (c.valor == null ? "—" : `${c.valor.toFixed(4)} USD`) },
  { chave: "passaramOPrazo", nome: "Passaram o prazo", valor: (c) => emPct(c.valor) },
];

const quando = (iso: string) =>
  iso ? new Date(iso).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" }) : "";

export default function EnsaioDaVitoria() {
  const { token, ready } = useAdminAuth();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [accoes, setAccoes] = useState<Accao[] | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [soAsQueAgiriam, setSoAsQueAgiriam] = useState(false);

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(ROTA, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (r.ok) setDados((await r.json()) as Resposta);
    } catch {
      /* fica o que se tinha */
    }
  }, [token]);

  useEffect(() => {
    if (ready) void ler();
  }, [ready, ler]);

  async function abrir(id: number) {
    if (aberto === id) {
      setAberto(null);
      return;
    }
    setAberto(id);
    setAccoes(null);
    if (!token) return;
    try {
      const r = await fetch(`${ROTA}?ensaio=${id}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (r.ok) setAccoes(((await r.json()) as { accoes: Accao[] }).accoes);
    } catch {
      setAccoes([]);
    }
  }

  async function avaliar(id: number, avaliacao: "melhor" | "igual" | "pior" | null) {
    if (!token) return;
    setOcupado(id);
    try {
      const r = await fetch(ROTA, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id, avaliacao }),
      });
      if (r.ok) await ler();
    } finally {
      setOcupado(null);
    }
  }

  if (!dados) return null;
  const visiveis = soAsQueAgiriam ? dados.ensaios.filter((e) => e.agiria) : dados.ensaios;

  return (
    <div className="mt-8 border-t border-slate-800 pt-5">
      <h3 className="text-base font-semibold text-slate-100">Ensaio da Vitória</h3>
      <p className="mt-1 text-sm leading-6 text-slate-400">
        {dados.ligado
          ? "O agente corre ao lado da Vitória e grava o que teria respondido. Nada daqui chegou ao cliente."
          : "O ensaio está desligado (Configs › «Vitória agente — ensaio»)."}{" "}
        Avaliados: {dados.avaliados} · Melhor: {dados.melhor} · Igual: {dados.igual ?? 0} · Pior: {dados.pior} · Por avaliar: {dados.porAvaliar}
      </p>
      {dados.recolha && (
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm">
          <p className="font-semibold text-slate-100">Recolha em ensaio (quem ainda não tem pedido)</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {dados.recolha.ligado
              ? "Ligada: o agente conduz a recolha ao lado da Vitória e grava no rascunho-sombra. Nada sai, o rascunho real não se toca."
              : "Desligada (Configs › «Vitória agente — recolha (ensaio)»)."}{" "}
            Tecto {dados.recolha.tectoUsd.toFixed(2)} USD/dia · hoje {dados.recolha.gastoHojeUsd.toFixed(4)} USD · {dados.recolha.metricas.ensaios} ensaio(s) nos
            últimos 30 dias · {dados.recolha.metricas.fugasEvitadas} travado(s) por um dado pessoal
          </p>
          <table className="mt-2 w-full max-w-xl text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="py-1 font-medium">Critério</th>
                <th className="py-1 font-medium">Agora</th>
                <th className="py-1 font-medium">Meta</th>
                <th className="py-1 font-medium" />
              </tr>
            </thead>
            <tbody>
              {LINHAS_DOS_CRITERIOS.map((l) => {
                const c = dados.recolha!.metricas[l.chave];
                return (
                  <tr key={l.chave} className="border-t border-slate-800">
                    <td className="py-1 text-slate-300">{l.nome}</td>
                    <td className="py-1 text-slate-100">{l.valor(c)}</td>
                    <td className="py-1 text-slate-400">{c.meta}</td>
                    <td className={`py-1 font-semibold ${c.cumpre == null ? "text-slate-500" : c.cumpre ? "text-emerald-300" : "text-red-300"}`}>
                      {c.cumpre == null ? "sem dados" : c.cumpre ? "cumpre" : "não cumpre"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-400">
            {dados.recolha.metricas.prontaParaAFase2 == null
              ? "Ainda sem dados para todos os critérios."
              : dados.recolha.metricas.prontaParaAFase2
                ? "Todos os critérios cumpridos — a fase 2 precisa do sim do dono."
                : "Ainda não cumpre todos os critérios."}
          </p>
        </div>
      )}
      <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={soAsQueAgiriam} onChange={(ev) => setSoAsQueAgiriam(ev.target.checked)} />
        Só as que agiriam (fechar, cancelar, perguntar ao parceiro, passar à equipa, gravar)
      </label>
      {visiveis.length > 0 && (
        <ul className="mt-4 space-y-3">
          {visiveis.map((e) => (
            <li key={e.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm">
              <p className="text-xs text-slate-400">
                {quando(e.em)} · {e.telefone}
                {e.pedidoId ? ` · pedido #${e.pedidoId}` : ""} · {ESTADO[e.estado] ?? e.estado}
                {e.motivo ? ` (${e.motivo})` : ""} · {e.custoUsd.toFixed(4)} USD · cache {new Intl.NumberFormat("pt-PT").format(e.tokensCacheLidos)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-slate-200">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cliente </span>
                {e.mensagemDoCliente}
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg bg-slate-900/70 p-2">
                  <p className="text-xs font-semibold text-slate-400">{e.aSerio ? "As regras" : "A Vitória de hoje"}</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-200">{e.respostaReal || (e.aSerio ? "(não responderam: respondeu o agente)" : "(não respondeu)")}</p>
                </div>
                <div className="rounded-lg bg-slate-900/70 p-2">
                  <p className="text-xs font-semibold text-slate-400">{e.aSerio ? "O agente disse (saiu)" : "O agente teria dito"}</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-200">{e.respostaDoAgente || "(nada)"}</p>
                </div>
                <div className="rounded-lg bg-slate-900/70 p-2 md:col-span-2">
                  <p className="text-xs font-semibold text-slate-400">{e.aSerio ? "O que fez" : "O que teria feito"}</p>
                  <p className="mt-1 text-slate-200">{e.oQueTeriaFeito || (e.teriaFeito.length > 0 ? e.teriaFeito.join(" · ") : "—")}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={ocupado === e.id}
                  onClick={() => void avaliar(e.id, e.avaliacao === "melhor" ? null : "melhor")}
                  className={`flex min-h-[32px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-40 ${
                    e.avaliacao === "melhor" ? "bg-emerald-500/20 text-emerald-200" : "border border-slate-700 text-slate-200"
                  }`}
                >
                  <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                  Esta estava melhor
                </button>
                <button
                  type="button"
                  disabled={ocupado === e.id}
                  onClick={() => void avaliar(e.id, e.avaliacao === "igual" ? null : "igual")}
                  className={`flex min-h-[32px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-40 ${
                    e.avaliacao === "igual" ? "bg-sky-500/20 text-sky-200" : "border border-slate-700 text-slate-200"
                  }`}
                >
                  <Equal className="h-3.5 w-3.5" aria-hidden="true" />
                  Igual
                </button>
                <button
                  type="button"
                  disabled={ocupado === e.id}
                  onClick={() => void avaliar(e.id, e.avaliacao === "pior" ? null : "pior")}
                  className={`flex min-h-[32px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-40 ${
                    e.avaliacao === "pior" ? "bg-red-500/20 text-red-200" : "border border-slate-700 text-slate-200"
                  }`}
                >
                  <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                  Esta estava pior
                </button>
                <button type="button" onClick={() => void abrir(e.id)} className="text-xs text-slate-400 underline">
                  {aberto === e.id ? "Fechar os passos" : "Ver os passos"}
                </button>
                {ocupado === e.id && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />}
                {e.avaliadoPor && <span className="text-xs text-slate-500">avaliado por {e.avaliadoPor}</span>}
              </div>
              {aberto === e.id && (
                <ol className="mt-2 space-y-1 text-xs text-slate-400">
                  {accoes == null ? (
                    <li>A ler…</li>
                  ) : (
                    accoes.map((a, i) => (
                      <li key={i} className="break-words">
                        <span className="font-semibold text-slate-300">{a.ferramenta}</span>
                        {a.entrada ? ` ${a.entrada}` : ""}
                        {a.texto ? ` — ${a.texto}` : ""}
                        {a.custoUsd ? ` · ${a.custoUsd.toFixed(4)} USD` : ""}
                        {a.erro ? <span className="text-red-300"> · {a.erro}</span> : null}
                      </li>
                    ))
                  )}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
