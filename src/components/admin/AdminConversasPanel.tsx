"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, Search, Send } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  CORES_DA_ORIGEM,
  ROTULO_DA_ORIGEM,
  lerChave,
  porResponder,
  type ConversaDeSuporte,
  type OrigemDaConversa,
} from "@/lib/conversas-de-suporte";

/**
 * A CAIXA DE ENTRADA DO SUPORTE.
 *
 * "Hoje recebi uma mensagem vinda de uma cliente com dúvida no seu pedido, mas
 * ela ficou presa ao pedido e agora não sei qual era." — 13-09-2026.
 *
 * Antes disto, uma pergunta escrita dentro de um pedido não aparecia em lista
 * nenhuma: para a ler era preciso abrir o pedido certo, e para abrir o pedido
 * certo era preciso já saber qual era. Aqui aparecem todas, de todos os
 * canais, ordenadas por quem está à espera de nós.
 *
 * Desenhado como um WhatsApp e não como uma tabela de tickets, que foi o que
 * ele pediu — e por uma razão: numa tabela lê-se O ESTADO de um pedido; num
 * fio lê-se A CONVERSA. Quem atende precisa de ver o que foi dito, por que
 * ordem, e por quem.
 */

type Resposta = { conversas: ConversaDeSuporte[]; error?: string };

/**
 * O que se escreve, e POR ONDE VAI SAIR.
 *
 * Não é decoração: é a diferença entre escrever à vontade e escrever sem saber
 * se a pessoa recebe. No WhatsApp há mesmo uma janela de 24 horas que pode
 * estar fechada, e na app pode ainda não haver ecrã onde a resposta apareça —
 * quem atende tem de saber isso ANTES de escrever, não depois.
 */
const CAIXA_POR_ORIGEM: Record<OrigemDaConversa, { dica: string; saida: string }> = {
  pedido: {
    dica: "Responder — aparece no pedido dele",
    saida: "Vai para o histórico do pedido, onde ela escreveu.",
  },
  plataforma: {
    dica: "Responder — aparece na conta dele",
    saida: "Vai para a conta dela, na plataforma.",
  },
  app: {
    dica: "Responder — fica no pedido de suporte da app",
    saida:
      "Fica gravada no pedido de suporte. A app pode ainda não ter ecrã de respostas — confirme por email ou telefone.",
  },
};

/** A hora como se lê num telemóvel: hoje são horas, ontem é «ontem», o resto é data. */
function quando(iso: string): string {
  const d = new Date(String(iso).replace(" ", "T"));
  const t = d.getTime();
  if (!Number.isFinite(t)) return "";
  const agora = new Date();
  const mesmoDia = d.toDateString() === agora.toDateString();
  if (mesmoDia) return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}

function horaCompleta(iso: string): string {
  const d = new Date(String(iso).replace(" ", "T"));
  return Number.isFinite(d.getTime()) ? d.toLocaleString("pt-PT") : "";
}

function inicial(nome: string): string {
  const l = nome.trim().replace(/^\+?\d/, "#").charAt(0).toUpperCase();
  return l || "?";
}

export default function AdminConversasPanel() {
  const { token, ready } = useAdminAuth();
  const [conversas, setConversas] = useState<ConversaDeSuporte[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const [procura, setProcura] = useState("");
  const [texto, setTexto] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const fimDoFio = useRef<HTMLDivElement | null>(null);

  const carregar = useCallback(async () => {
    if (!token) return;
    setACarregar(true);
    try {
      const res = await fetch("/api/admin/suporte/conversas", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados: Resposta = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar as conversas.");
        return;
      }
      setConversas(dados.conversas ?? []);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    if (ready) carregar();
  }, [ready, carregar]);

  const lista = useMemo(() => {
    const q = procura.trim().toLowerCase();
    if (!q) return conversas;
    return conversas.filter(
      (c) =>
        c.quem.toLowerCase().includes(q) ||
        (c.contacto ?? "").toLowerCase().includes(q) ||
        (c.assunto ?? "").toLowerCase().includes(q) ||
        String(c.pedidoId ?? "").includes(q) ||
        // Procurar DENTRO das mensagens, e não só nos cabeçalhos: quem perdeu
        // uma conversa lembra-se do que lá foi dito, não de quem a escreveu.
        c.mensagens.some((m) => m.texto.toLowerCase().includes(q)),
    );
  }, [conversas, procura]);

  const fio = useMemo(
    () => conversas.find((c) => c.chave === aberta) ?? null,
    [conversas, aberta],
  );

  // Ao abrir uma conversa vai-se ao fim dela, que é onde está o que interessa.
  useEffect(() => {
    if (fio) fimDoFio.current?.scrollIntoView({ block: "end" });
  }, [fio]);

  async function enviar() {
    if (!fio || !texto.trim() || aEnviar) return;
    setAEnviar(true);
    setErro("");
    try {
      /*
       * A resposta a um ticket da app sai pela rota que já existe, e não por
       * esta. Essa rota já sabe passar o ticket a «em curso» e já grava o nome
       * de quem responde; uma segunda cópia dessa gravação acabava por deixar
       * de fazer o mesmo que a primeira.
       */
      const paraApp = fio.origem === "app";
      const idDoTicket = lerChave(fio.chave)?.id ?? "";
      const res = await fetch(
        paraApp
          ? `/api/admin/suporte/${encodeURIComponent(idDoTicket)}/mensagens`
          : "/api/admin/suporte/conversas",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(
            paraApp ? { body: texto.trim() } : { chave: fio.chave, texto: texto.trim() },
          ),
        },
      );
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível enviar.");
        return;
      }
      setTexto("");
      await carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  if (!ready || (aCarregar && conversas.length === 0)) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  const aEsperar = conversas.filter(porResponder).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {aEsperar === 0
            ? "Ninguém à espera de resposta."
            : `${aEsperar} à espera de resposta`}
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <input
              value={procura}
              onChange={(e) => setProcura(e.target.value)}
              placeholder="Procurar nome, pedido ou texto"
              className="h-9 w-56 rounded-lg border border-slate-600 bg-slate-950 pl-8 pr-3 text-xs text-white outline-none focus:border-cyan-500"
            />
          </div>
          <button
            onClick={carregar}
            className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${aCarregar ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Actualizar
          </button>
        </div>
      </div>

      {erro && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      {conversas.length === 0 ? (
        <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
          Ainda ninguém escreveu. Quando alguém responder dentro de um pedido, pelo WhatsApp ou
          pela plataforma, a conversa aparece aqui.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          {/* ── A lista ──────────────────────────────────────────────────── */}
          <div
            className={`max-h-[34rem] overflow-y-auto rounded-2xl border border-slate-700/60 bg-slate-950/40 ${
              // No telemóvel é um ecrã de cada vez, como num telemóvel.
              fio ? "hidden md:block" : ""
            }`}
          >
            {lista.length === 0 && (
              <p className="p-4 text-center text-xs text-slate-500">Nada com «{procura}».</p>
            )}
            {lista.map((c) => {
              const ultima = c.mensagens[c.mensagens.length - 1];
              const espera = porResponder(c);
              return (
                <button
                  key={c.chave}
                  onClick={() => {
                    setAberta(c.chave);
                    setTexto("");
                  }}
                  className={`flex w-full items-start gap-3 border-b border-slate-800/80 p-3 text-left transition hover:bg-white/[0.03] ${
                    c.chave === aberta ? "bg-white/[0.06]" : ""
                  }`}
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-slate-200">
                    {inicial(c.quem)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white">{c.quem}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-slate-500">
                        {ultima ? quando(ultima.quando) : ""}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium ${
                          CORES_DA_ORIGEM[c.origem]
                        }`}
                      >
                        {ROTULO_DA_ORIGEM[c.origem]}
                      </span>
                      {c.pedidoId !== null && (
                        <span className="shrink-0 text-[10px] text-slate-500">#{c.pedidoId}</span>
                      )}
                      {espera && (
                        <span
                          className="ml-auto h-2 w-2 shrink-0 rounded-full bg-emerald-400"
                          title="À espera de resposta"
                          aria-label="À espera de resposta"
                        />
                      )}
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-400">
                      {ultima ? (ultima.de === "clyon" ? "Você: " : "") + ultima.texto : "—"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── O fio ────────────────────────────────────────────────────── */}
          <div
            className={`flex max-h-[34rem] flex-col rounded-2xl border border-slate-700/60 bg-slate-950/40 ${
              fio ? "" : "hidden md:flex"
            }`}
          >
            {!fio ? (
              <p className="m-auto p-6 text-center text-sm text-slate-500">
                Escolha uma conversa à esquerda.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-slate-800 p-3">
                  <button
                    onClick={() => setAberta(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-white/5 md:hidden"
                    aria-label="Voltar à lista"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{fio.quem}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {ROTULO_DA_ORIGEM[fio.origem]}
                      {fio.assunto ? ` · ${fio.assunto}` : ""}
                      {fio.contacto ? ` · ${fio.contacto}` : ""}
                    </p>
                  </div>
                  {fio.pedidoId !== null && (
                    /*
                     * O pedido, tal como o cliente o vê — e sem gerar link
                     * novo. Quem lê «não percebi a morada» precisa de ter a
                     * morada à frente para responder.
                     */
                    <a
                      href={`/admin/pedido/${fio.pedidoId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      Pedido #{fio.pedidoId}
                    </a>
                  )}
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto p-3">
                  {fio.mensagens.map((m, i) => (
                    <div
                      key={i}
                      className={`flex ${m.de === "clyon" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                          m.de === "clyon"
                            ? "rounded-br-sm bg-emerald-600/20 text-emerald-50"
                            : "rounded-bl-sm bg-slate-800 text-slate-100"
                        }`}
                      >
                        <p className="whitespace-pre-line break-words text-sm">{m.texto}</p>
                        <p
                          className={`mt-1 text-[10px] ${
                            m.de === "clyon" ? "text-emerald-300/70" : "text-slate-500"
                          }`}
                          title={horaCompleta(m.quando)}
                        >
                          {m.autor ? `${m.autor} · ` : ""}
                          {quando(m.quando)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={fimDoFio} />
                </div>

                <div className="border-t border-slate-800 p-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      onKeyDown={(e) => {
                        // Enter envia, Shift+Enter muda de linha — como no WhatsApp.
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          enviar();
                        }
                      }}
                      rows={2}
                      placeholder={CAIXA_POR_ORIGEM[fio.origem].dica}
                      className="min-h-[2.5rem] flex-1 resize-none rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={enviar}
                      disabled={aEnviar || !texto.trim()}
                      className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
                    >
                      {aEnviar ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Enviar
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {CAIXA_POR_ORIGEM[fio.origem].saida}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
