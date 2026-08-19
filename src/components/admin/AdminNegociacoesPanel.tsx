"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  Copy,
  Loader2,
  Mail,
  RefreshCw,
  Send,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

type Proposta = {
  por: "cliente" | "profissional";
  valor: number;
  em: string;
  estado: string;
};

type Negociacao = {
  id: number;
  providerId: number;
  profissionalNome: string;
  profissionalEmail: string | null;
  estado: string;
  valorAcordado: string | null;
  propostasJson: string | null;
  execucaoEnviadaEm: string | null;
  provaJson: string | null;
  confirmadoEm: string | null;
  pagoEm: string | null;
  criadaEm: string;
  actualizadaEm: string;
};

function propostasDe(json: string | null): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

function provaDe(json: string | null): { fotos: string[]; nota: string } | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json);
    return {
      fotos: Array.isArray(p?.fotos) ? p.fotos.filter((f: unknown) => typeof f === "string") : [],
      nota: typeof p?.nota === "string" ? p.nota : "",
    };
  } catch {
    return null;
  }
}

function quando(v: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-PT");
}

const ESTADO_DA_PROPOSTA: Record<string, string> = {
  pendente: "à espera de resposta",
  aceite: "aceite",
  recusada: "recusada",
  expirada: "expirou",
};

type Pedido = {
  id: number;
  serviceType: string | null;
  city: string | null;
  contactName: string | null;
  contactEmail: string | null;
  valorDesejadoCliente: string | null;
  createdAt: string;
  negociacoes: Negociacao[];
};

const ESTADO_CLS: Record<string, string> = {
  aberta: "bg-blue-500/15 text-blue-300",
  aguarda_contratacao: "bg-amber-500/15 text-amber-300",
  acordada: "bg-emerald-500/15 text-emerald-300",
  desistida: "bg-slate-700 text-slate-300",
  morta: "bg-slate-700 text-slate-400",
};

type PorPromover = {
  id: number;
  serviceType: string | null;
  city: string | null;
  contactName: string | null;
  contactEmail: string | null;
  estimateTotal: string | null;
  urgency: string | null;
  createdAt: string;
};

export default function AdminNegociacoesPanel() {
  const { token, ready } = useAdminAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [linksEmClaro, setLinksEmClaro] = useState<Record<string, string>>({});
  // Qual das negociações está aberta. Uma de cada vez: abrir todas dava uma
  // parede de valores onde não se distingue a que interessa.
  const [aberta, setAberta] = useState<number | null>(null);
  const [porPromover, setPorPromover] = useState<PorPromover[]>([]);
  const [valorDe, setValorDe] = useState<Record<number, string>>({});

  const carregar = useCallback(async () => {
    if (!token) return;
    setACarregar(true);
    try {
      const res = await fetch("/api/admin/negociacoes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar.");
        return;
      }
      setPedidos(dados.pedidos ?? []);
      setErro("");

      // Os do simulador que ainda não são da plataforma. Falha em silêncio: é
      // uma lista de conveniência, não pode derrubar o painel todo.
      try {
        const r2 = await fetch("/api/admin/negociacoes/promover", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r2.ok) setPorPromover((await r2.json()).pedidos ?? []);
      } catch {
        /* sem lista, o resto continua a servir */
      }
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    if (ready && token) carregar();
  }, [ready, token, carregar]);

  async function reenviar(chave: string, corpo: Record<string, unknown>) {
    if (!token) return;
    setOcupado(chave);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/reenviar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível reenviar.");
        return;
      }
      // Quando o email não sai, o token vem na resposta — é a única forma de
      // lá chegar, porque na base só existe o hash.
      if (dados.token) {
        setLinksEmClaro((l) => ({ ...l, [chave]: dados.token }));
      } else {
        setLinksEmClaro((l) => {
          const c = { ...l };
          delete c[chave];
          return c;
        });
      }
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  async function promover(pedidoId: number) {
    if (!token) return;
    setOcupado(`p${pedidoId}`);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/promover", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId, valor: valorDe[pedidoId] }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível promover.");
        return;
      }
      if (dados.avisados === 0) {
        const motivos = Object.entries(dados.motivos ?? {})
          .filter(([, n]) => Number(n) > 0)
          .map(([m, n]) => `${m.replace(/_/g, " ")}: ${n}`)
          .join(", ");
        setErro(
          `Promovido, mas não chegou a nenhum de ${dados.candidatos} profissionais activos.` +
            (motivos ? ` Motivos — ${motivos}.` : ""),
        );
      }
      if (dados.link) {
        setLinksEmClaro((l) => ({ ...l, [`c${pedidoId}`]: dados.link.split("/pedido/")[1] }));
      }
      await carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  async function redistribuir(pedidoId: number) {
    if (!token) return;
    setOcupado(`r${pedidoId}`);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/redistribuir", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível redistribuir.");
        return;
      }
      if (dados.avisados === 0) {
        // Sem isto, carregar no botão e não acontecer nada parecia avaria.
        // Os motivos vêm da mesma regra que decidiu, portanto são exactos.
        const motivos = Object.entries(dados.motivos ?? {})
          .filter(([, n]) => Number(n) > 0)
          .map(([m, n]) => `${m.replace(/_/g, " ")}: ${n}`)
          .join(", ");
        setErro(
          `Continua sem chegar a ninguém de ${dados.candidatos} profissionais activos.` +
            (motivos ? ` Motivos — ${motivos}.` : ""),
        );
      }
      await carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  if (!ready || aCarregar) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <p className="text-sm text-slate-400">
          {pedidos.length} pedidos com valores.
        </p>
        <button
          onClick={carregar}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800/60"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Actualizar
        </button>
      </header>

      {erro && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/* ── Do simulador, ainda fora da plataforma ─────────────────────────
          Estes entraram pelo formulário de orçamento do site: têm estimativa,
          não têm valor pedido pelo cliente, e nunca foram distribuídos. Um
          profissional não os vê.

          Promover é decidido pedido a pedido, e não por omissão: quem
          preencheu o simulador pediu um orçamento à CLYON, não pediu para
          entrar num mercado — a partir daqui passa a receber propostas de
          terceiros. */}
      {porPromover.length > 0 && (
        <section className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            <Send className="h-4 w-4" aria-hidden="true" />
            Pedidos do simulador, fora da plataforma
          </h3>
          <p className="mt-1 text-xs text-amber-200/70">
            Enviar aos profissionais fixa o valor de partida, envia o link ao cliente e
            distribui. Sem valor indicado, usa a estimativa.
          </p>

          <div className="mt-3 space-y-2">
            {porPromover.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-white">
                    #{p.id} · {p.serviceType ?? "—"}
                  </span>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {p.contactName} · {p.city ?? "—"}
                    {p.estimateTotal
                      ? ` · estimativa ${Number(p.estimateTotal).toFixed(2)} €`
                      : " · sem estimativa"}
                    {" · "}
                    {new Date(p.createdAt).toLocaleDateString("pt-PT")}
                  </p>
                </div>

                <input
                  value={valorDe[p.id] ?? ""}
                  onChange={(e) => setValorDe((v) => ({ ...v, [p.id]: e.target.value }))}
                  placeholder={
                    p.estimateTotal ? Number(p.estimateTotal).toFixed(0) : "valor"
                  }
                  inputMode="decimal"
                  className="w-24 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                />

                <button
                  onClick={() => promover(p.id)}
                  disabled={ocupado === `p${p.id}`}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  {ocupado === `p${p.id}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Enviar aos profissionais
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {pedidos.length === 0 && (
        <p className="rounded-xl border border-slate-800 bg-slate-800/60 px-4 py-8 text-center text-sm text-slate-500">
          Ainda não há pedidos criados pelo formulário novo.
        </p>
      )}

      <div className="space-y-3">
        {pedidos.map((p) => {
          const chaveCliente = `c${p.id}`;
          return (
            <article key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">
                    #{p.id} · {p.serviceType ?? "—"}
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {p.contactName} · {p.contactEmail} · {p.city ?? "—"}
                    {p.valorDesejadoCliente && ` · quer pagar ${p.valorDesejadoCliente} €`}
                  </p>
                </div>
                <button
                  onClick={() => reenviar(chaveCliente, { pedidoId: p.id, para: "cliente" })}
                  disabled={ocupado === chaveCliente}
                  className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {ocupado === chaveCliente ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Reenviar ao cliente
                </button>
              </div>

              {linksEmClaro[chaveCliente] && (
                <LinkEmClaro
                  caminho={`/pedido/${linksEmClaro[chaveCliente]}`}
                  aviso="O email não saiu. Use este link."
                />
              )}

              <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                {p.negociacoes.length === 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="text-xs font-semibold text-amber-200">
                      Nenhum profissional foi notificado.
                    </p>
                    <p className="mt-0.5 text-xs text-amber-300">
                      O histórico do pedido diz o motivo — categoria, distância, fatura ou
                      guia. Depois de corrigir, redistribua.
                    </p>
                    <button
                      onClick={() => redistribuir(p.id)}
                      disabled={ocupado === `r${p.id}`}
                      className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                    >
                      {ocupado === `r${p.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Redistribuir
                    </button>
                  </div>
                )}
                {p.negociacoes.map((n) => {
                  const chave = `n${n.id}`;
                  return (
                    <div key={n.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {/* A linha inteira abre a troca — o alvo do rato é a
                            linha, não um triângulo de doze píxeis. */}
                        <button
                          onClick={() => setAberta((a) => (a === n.id ? null : n.id))}
                          aria-expanded={aberta === n.id}
                          className="flex flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-slate-800/60"
                        >
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                              aberta === n.id ? "rotate-180" : ""
                            }`}
                            aria-hidden="true"
                          />
                          <span className="text-sm font-medium text-slate-100">
                            {n.profissionalNome}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              ESTADO_CLS[n.estado] ?? "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {n.estado}
                          </span>
                          {n.valorAcordado && (
                            <span className="text-xs text-slate-500">{n.valorAcordado} €</span>
                          )}
                          <span className="text-xs text-slate-600">
                            {propostasDe(n.propostasJson).length} proposta
                            {propostasDe(n.propostasJson).length === 1 ? "" : "s"}
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            reenviar(chave, { pedidoId: p.id, negociacaoId: n.id })
                          }
                          disabled={ocupado === chave}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-400 hover:bg-slate-800/60 disabled:opacity-50"
                        >
                          {ocupado === chave ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          ) : (
                            <Mail className="h-3 w-3" aria-hidden="true" />
                          )}
                          Reenviar
                        </button>
                      </div>
                      {linksEmClaro[chave] && (
                        <LinkEmClaro
                          caminho={`/profissionais/pedidos/${linksEmClaro[chave]}`}
                          aviso="O email não saiu. Use este link."
                        />
                      )}

                      {aberta === n.id && <TrocaDePropostas negociacao={n} />}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A troca de propostas de uma negociação, e o que veio depois.
 *
 * O painel mostrava o desfecho — "acordada, 300 €" — e escondia como se lá
 * chegou. É precisamente o caminho que interessa quando alguém liga a
 * reclamar: quem propôs o quê, quando, e onde é que uma das partes desistiu.
 *
 * Os valores são os brutos, os que os dois viram. A taxa não entra aqui: não
 * fazia parte da conversa deles.
 */
function TrocaDePropostas({ negociacao }: { negociacao: Negociacao }) {
  const propostas = propostasDe(negociacao.propostasJson);
  const prova = provaDe(negociacao.provaJson);

  return (
    <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      {propostas.length === 0 ? (
        <p className="text-xs text-slate-500">
          Ainda não houve propostas — o profissional foi avisado a{" "}
          {quando(negociacao.criadaEm)} e não respondeu.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {propostas.map((p, i) => (
            <li key={i} className="flex items-center gap-3 text-xs">
              <span
                className={`w-24 shrink-0 font-semibold ${
                  p.por === "cliente" ? "text-cyan-300" : "text-amber-300"
                }`}
              >
                {p.por === "cliente" ? "Cliente" : "Profissional"}
              </span>
              <span
                className={`w-20 shrink-0 font-bold ${
                  p.estado === "pendente" ? "text-white" : "text-slate-500 line-through"
                }`}
              >
                {Number(p.valor).toFixed(2).replace(".", ",")} €
              </span>
              <span className="w-40 shrink-0 text-slate-500">
                {ESTADO_DA_PROPOSTA[p.estado] ?? p.estado}
              </span>
              <span className="text-slate-600">{quando(p.em)}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Depois do acordo: a prova e a confirmação. */}
      {(negociacao.execucaoEnviadaEm || negociacao.confirmadoEm) && (
        <div className="mt-3 border-t border-slate-800 pt-3">
          {negociacao.execucaoEnviadaEm && (
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <Camera className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              Prova enviada a {quando(negociacao.execucaoEnviadaEm)}
              {prova?.nota ? ` — "${prova.nota}"` : ""}
            </p>
          )}
          {prova && prova.fotos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {prova.fotos.map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Prova ${i + 1}`}
                    className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-700"
                  />
                </a>
              ))}
            </div>
          )}
          {negociacao.confirmadoEm && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Cliente confirmou a {quando(negociacao.confirmadoEm)}
              {negociacao.pagoEm ? ` · pago a ${quando(negociacao.pagoEm)}` : " · saldo disponível"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LinkEmClaro({ caminho, aviso }: { caminho: string; aviso: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}${caminho}` : caminho;

  return (
    <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
      <p className="text-xs font-semibold text-amber-200">{aviso}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-slate-950 px-2 py-1 font-mono text-[11px] text-slate-300">
          {url}
        </code>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(url);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1500);
          }}
          className="flex items-center gap-1 rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white"
        >
          <Copy className="h-3 w-3" aria-hidden="true" />
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
