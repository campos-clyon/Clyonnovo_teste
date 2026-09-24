"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, Lock } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { nomeDoRecebimento } from "@/lib/dinheiro-do-trabalho";

/**
 * O QUE ENTROU PELO euPAGO.
 *
 * O número grande deste painel não é o total recebido — é o dos AVISOS POR
 * APLICAR. Cada um é dinheiro que se moveu do lado deles e não se moveu do
 * nosso: um pagamento em duplicado por devolver, um valor que não bate certo.
 * Nenhum deles dá erro em lado nenhum, e é por isso que precisam de um sítio
 * onde se vejam.
 *
 * O resto do ecrã é conferência. Enquanto a porta estiver fechada, diz-se
 * porquê, em vez de mostrar zeros que parecem uma avaria.
 */

type Ligacao = {
  configurado: boolean;
  falta?: string;
  ambiente?: "sandbox" | "producao";
  temSegredoDoWebhook?: boolean;
  aberta?: boolean;
  plataformaCobra: boolean;
  testadores?: number;
};

type Pagamento = {
  id: number;
  metodo: string;
  estado: string;
  valor: number;
  valorPago: number | null;
  comissaoEupago: number | null;
  referencia: string | null;
  entidade: string | null;
  pedidoId: number;
  criadoEm: string;
};

type Aviso = {
  id: number;
  trid: string;
  estado: string;
  pagamentoId: number | null;
  valor: number | null;
  nota: string | null;
  recebidoEm: string;
};

type Estado = {
  ligacao: Ligacao;
  resumo: {
    pendentes: number;
    pagos: number;
    falhados: number;
    avisosPorAplicar: number;
    totalPago: number;
    comissaoDoEupago: number;
  };
  ultimos: Pagamento[];
  avisos: Aviso[];
  webhook?: EstadoDoWebhook;
  trabalhos?: Trabalho[];
};

/**
 * UM TRABALHO, AS DUAS PONTAS DO DINHEIRO.
 *
 * *«Estamos com problema para gerir os pagamentos (…) para podermos gerir quem
 * pagou, como pagou, e se já pagámos os profissionais.»* — 24-09-2026.
 *
 * São três perguntas sobre a MESMA coisa, e viviam em quatro ecrãs: as
 * Carteiras respondem por profissional, os Levantamentos por pedido de
 * levantamento, o Livro por movimento, e este por pagamento do euPago.
 * Nenhum respondia por TRABALHO — que é como a pergunta é feita quando se
 * tem o extracto do banco aberto ao lado.
 */
type Trabalho = {
  negociacaoId: number;
  pedidoId: number;
  cliente: string | null;
  telefoneDoCliente: string | null;
  cidade: string | null;
  profissional: string;
  clientePaga: number;
  profissionalRecebe: number;
  formaDePagamento: string | null;
  comoEntrou: string | null;
  clientePagouEm: string | null;
  confirmadoEm: string | null;
  pagoEm: string | null;
  fase: string;
};

/**
 * O QUE ANDA A ACONTECER À PORTA DOS AVISOS.
 *
 * *«Me ajude com passo a passo para corrigir isso.»* — 22-09-2026, sobre um
 * pagamento de 42 € que entrou no euPago e nunca chegou aqui.
 *
 * Duas histórias apareciam como o mesmo silêncio: **o euPago não está a
 * chamar** (endereço errado, ou configurado no canal errado) e **está a chamar
 * e nós é que recusamos** (segredo em falta, ou um que já não é o dele). A
 * primeira resolve-se no backoffice deles, a segunda no nosso — e quem procura
 * sem saber qual é passa a tarde a mexer no sítio errado.
 */
type EstadoDoWebhook = {
  ultimoAceite: string | null;
  aceites: number;
  ultimaRecusa: { quando: string; porque: string } | null;
  recusas24h: number;
};

function PortaDosAvisos({ w }: { w: EstadoDoWebhook }) {
  const quando = (iso: string) => new Date(iso).toLocaleString("pt-PT");

  /*
   * A recusa manda sobre tudo. Se chegam avisos e são recusados, isso é o que
   * está a acontecer AGORA — e é nosso, e tem conserto imediato.
   */
  if (w.recusas24h > 0) {
    return (
      <p className="text-amber-300">
        O euPago <strong>está a chamar</strong> e nós estamos a recusar: {w.recusas24h} nas
        últimas 24 h
        {w.ultimaRecusa ? ` · a última às ${quando(w.ultimaRecusa.quando)} — ${w.ultimaRecusa.porque}` : ""}
        . O endereço está certo; o que não bate é o segredo.
      </p>
    );
  }

  if (w.aceites > 0) {
    return (
      <p className="text-emerald-300">
        Avisos recebidos: {w.aceites}
        {w.ultimoAceite ? ` · o último a ${quando(w.ultimoAceite)}` : ""}.
      </p>
    );
  }

  return (
    <p className="text-amber-300">
      <strong>Nunca chegou nenhum aviso</strong>, e nenhum foi recusado — o euPago não está a
      chamar esta morada. Confirme os Webhooks 2.0 no canal de produção.
    </p>
  );
}

const euros = (n: number | null) => (n == null ? "—" : `${n.toFixed(2).replace(".", ",")} €`);

const DIA = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }) : "";

/**
 * O GESTOR: um trabalho por linha, e a atenção por ordem de urgência.
 *
 * Os montes não estão por ordem cronológica — estão por ordem da atenção que
 * merecem. Primeiro o que pode ser PERDIDO (dinheiro que devíamos ter e não
 * temos), depois o que DEVEMOS, depois o que só precisa de tempo, e por fim o
 * que já não precisa de ninguém.
 *
 * «Fechado» começa fechado: é a maior das quatro listas e é a única que não
 * tem nada a fazer. Estar aberta empurrava as outras três para fora do ecrã.
 */
function GestorDoDinheiro({
  trabalhos,
  token,
  onMudou,
}: {
  trabalhos: Trabalho[];
  token: string | null;
  onMudou: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [aRegistar, setARegistar] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [verFechados, setVerFechados] = useState(false);

  const q = busca.trim().toLowerCase();
  const filtrados = q
    ? trabalhos.filter((t) =>
        [t.cliente, t.telefoneDoCliente, t.profissional, t.cidade, `#${t.pedidoId}`]
          .filter(Boolean)
          .some((c) => String(c).toLowerCase().includes(q)),
      )
    : trabalhos;

  const montes = FASES.map((f) => ({
    fase: f,
    linhas: filtrados.filter((t) => t.fase === f.id),
  })).filter((m) => m.linhas.length > 0);

  async function agir(t: Trabalho, url: string, corpo: Record<string, unknown>) {
    if (!token) return;
    setOcupado(t.negociacaoId);
    setErro("");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ negociacaoId: t.negociacaoId, ...corpo }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro([d.error, d.detalhe].filter(Boolean).join(" — ") || "Não foi possível.");
        return;
      }
      setARegistar(null);
      onMudou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Trabalho a trabalho
        </p>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="cliente, telemóvel, profissional ou #pedido"
          className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
        />
      </div>

      {erro && <p className="mt-2 text-xs text-red-300">{erro}</p>}

      {montes.length === 0 && (
        <p className="mt-3 text-xs text-slate-500">
          {q ? "Nada encontrado." : "Ainda não há trabalhos fechados."}
        </p>
      )}

      {montes.map(({ fase, linhas }) => {
        const escondido = fase.id === "fechado" && !verFechados && !q;
        const soma = linhas.reduce(
          (s, t) => s + (fase.id === "a_pagar" ? t.profissionalRecebe : t.clientePaga),
          0,
        );
        return (
          <div key={fase.id} className="mt-4">
            <button
              onClick={() => fase.id === "fechado" && setVerFechados((v) => !v)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className={`text-xs font-semibold uppercase tracking-wide ${fase.cor}`}>
                {fase.rotulo} · {linhas.length}
              </span>
              <span className="text-xs tabular-nums text-slate-400">
                {euros(Math.round(soma * 100) / 100)}
                {escondido ? " · mostrar" : ""}
              </span>
            </button>
            {!escondido && (
              <div className="mt-2 space-y-2">
                {linhas.map((t) => (
                  <Linha
                    key={t.negociacaoId}
                    t={t}
                    ocupado={ocupado === t.negociacaoId}
                    aRegistar={aRegistar === t.negociacaoId}
                    onRegistar={() =>
                      setARegistar((a) => (a === t.negociacaoId ? null : t.negociacaoId))
                    }
                    onEntrou={(metodo) => void agir(t, "/api/admin/pagamentos/recebido", { metodo })}
                    onPaguei={() => void agir(t, "/api/admin/carteiras", {})}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const FASES: Array<{ id: string; rotulo: string; cor: string }> = [
  { id: "a_receber", rotulo: "Por receber do cliente", cor: "text-amber-300" },
  { id: "a_pagar", rotulo: "Por pagar ao profissional", cor: "text-cyan-300" },
  { id: "a_decorrer", rotulo: "A decorrer", cor: "text-slate-400" },
  { id: "fechado", rotulo: "Fechado", cor: "text-emerald-300" },
];

/** As três formas de dizer o que aconteceu quando não foi pelo euPago. */
const A_MAO: Array<{ id: string; rotulo: string; ajuda: string }> = [
  { id: "transferencia", rotulo: "Transferência", ajuda: "Entrou na conta da CLYON" },
  { id: "numerario", rotulo: "Numerário", ajuda: "Entregue à CLYON em dinheiro" },
  {
    id: "ao_profissional",
    rotulo: "Pagou ao profissional",
    ajuda: "Em mão, no local. Não passou pela CLYON",
  },
];

function Linha({
  t,
  ocupado,
  aRegistar,
  onRegistar,
  onEntrou,
  onPaguei,
}: {
  t: Trabalho;
  ocupado: boolean;
  aRegistar: boolean;
  onRegistar: () => void;
  onEntrou: (metodo: string) => void;
  onPaguei: () => void;
}) {
  const emMao = t.formaDePagamento === "dinheiro" || t.comoEntrou === "ao_profissional";

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-semibold text-white">#{t.pedidoId}</span>
        <span className="text-sm text-slate-200">{t.cliente ?? "—"}</span>
        {t.telefoneDoCliente && (
          <a
            href={`tel:${t.telefoneDoCliente.replace(/\s/g, "")}`}
            className="font-mono text-xs tabular-nums text-cyan-400 hover:underline"
          >
            {t.telefoneDoCliente}
          </a>
        )}
        {t.cidade && <span className="text-xs text-slate-500">{t.cidade}</span>}
      </div>

      {/*
        AS DUAS PONTAS, uma por linha e sempre na mesma ordem: primeiro o que
        entrou, depois o que saiu. É a ordem em que o dinheiro anda, e é a
        ordem em que a pergunta se faz.
      */}
      <p className="mt-1.5 text-xs text-slate-300">
        <span className="text-slate-500">Cliente:</span>{" "}
        {emMao ? (
          <span className="text-slate-300">
            pagou {euros(t.clientePaga)} ao profissional, em mão
          </span>
        ) : t.clientePagouEm ? (
          <span className="text-emerald-300">
            pagou {euros(t.clientePaga)} · {nomeDoRecebimento(t.comoEntrou)}
            {DIA(t.clientePagouEm) ? ` · ${DIA(t.clientePagouEm)}` : ""}
          </span>
        ) : (
          <span className="text-amber-300">por receber {euros(t.clientePaga)}</span>
        )}
      </p>

      <p className="mt-0.5 text-xs text-slate-300">
        <span className="text-slate-500">{t.profissional}:</span>{" "}
        {emMao ? (
          <span className="text-slate-400">recebeu em mão — não há nada a transferir</span>
        ) : t.pagoEm ? (
          <span className="text-emerald-300">
            pago {euros(t.profissionalRecebe)} · {DIA(t.pagoEm)}
          </span>
        ) : t.confirmadoEm ? (
          <span className="text-cyan-300">a receber {euros(t.profissionalRecebe)}</span>
        ) : (
          <span className="text-slate-500">
            {euros(t.profissionalRecebe)} — à espera da confirmação do cliente
          </span>
        )}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/*
          REGISTAR O QUE ENTROU FORA DO euPAGO.

          ⚠️ Isto DESBLOQUEIA DINHEIRO: um registo aqui move o trabalho de «por
          cobrar» para «disponível» na carteira do profissional. Por isso é um
          segundo clique, e cada opção diz o que quer dizer.
        */}
        {!emMao && !t.clientePagouEm && (
          <button
            onClick={onRegistar}
            disabled={ocupado}
            className="rounded-lg border border-amber-600/60 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {aRegistar ? "Como entrou?" : "Já recebemos"}
          </button>
        )}

        {!emMao && t.clientePagouEm && t.confirmadoEm && !t.pagoEm && (
          <button
            onClick={onPaguei}
            disabled={ocupado}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {ocupado && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            Já paguei {euros(t.profissionalRecebe)}
          </button>
        )}
      </div>

      {aRegistar && (
        <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5">
          <p className="text-[11px] leading-relaxed text-amber-200/90">
            Como é que entraram os {euros(t.clientePaga)}? Isto desbloqueia o dinheiro do
            profissional — só se regista o que já aconteceu.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {A_MAO.map((m) => (
              <button
                key={m.id}
                onClick={() => onEntrou(m.id)}
                disabled={ocupado}
                title={m.ajuda}
                className="rounded border border-slate-600 px-2 py-1 text-[11px] font-medium text-slate-200 hover:border-amber-500 hover:text-amber-200 disabled:opacity-50"
              >
                {m.rotulo}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const CORES: Record<string, string> = {
  pago: "text-emerald-300",
  pendente: "text-amber-300",
  falhado: "text-red-300",
  expirado: "text-slate-400",
  cancelado: "text-slate-400",
  substituido: "text-slate-400",
  reembolsado: "text-cyan-300",
};

type Prova = {
  ok: boolean;
  temSegredoDoWebhook?: boolean;
  ambiente?: string;
  base?: string;
  entidade?: string | null;
  referencia?: string | null;
  codigo?: string | null;
  porque?: string;
  pista?: string | null;
};

export default function AdminPagamentosPanel() {
  const { token, ready } = useAdminAuth();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [aCarregar, setACarregar] = useState(false);
  const [prova, setProva] = useState<Prova | null>(null);
  const [aProvar, setAProvar] = useState(false);

  // O ciclo partilhado não pode acender o estado de carregamento: o ecrã
  // piscava de vinte em vinte segundos enquanto alguém lê uma linha.
  const carregar = useCallback(
    async (silencioso = false) => {
      if (!token) return;
      if (!silencioso) setACarregar(true);
      try {
        const r = await fetch("/api/admin/pagamentos", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json();
        if (!r.ok) {
          // O detalhe vem junto, e é ele que diz por onde começar. Ver a nota
          // na rota: isto é backoffice, não um ecrã de cliente.
          setErro([d.error, d.detalhe].filter(Boolean).join(" — ") || "Não foi possível ler.");
          return;
        }
        setEstado(d);
        setErro("");
      } catch {
        if (!silencioso) setErro("Erro de rede.");
      } finally {
        setACarregar(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);

  useAutoRefresh(() => carregar(true), { enabled: ready && Boolean(token) });

  /**
   * A prova de ligação: pede uma referência de 1 € que ninguém paga.
   *
   * Não cobra a ninguém e não escreve nada — serve só para responder à única
   * pergunta que não se consegue responder olhando: **a chave serve?**
   */
  async function provar() {
    setAProvar(true);
    setProva(null);
    try {
      const r = await fetch("/api/admin/pagamentos/testar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setProva((await r.json()) as Prova);
    } catch {
      setProva({ ok: false, porque: "Erro de rede." });
    } finally {
      setAProvar(false);
    }
  }

  if (!estado && (aCarregar || !erro)) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A ler os pagamentos…
      </p>
    );
  }
  if (erro && !estado) return <p className="text-sm text-red-300">{erro}</p>;
  if (!estado) return null;

  const { ligacao, resumo } = estado;
  const alarme = resumo.avisosPorAplicar > 0;

  return (
    <div className="space-y-4">
      {/* ── A resposta primeiro: há alguma coisa por resolver? ───────────── */}
      {alarme ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/[0.08] p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-white">
            <AlertTriangle className="h-4 w-4 text-red-400" aria-hidden="true" />
            {resumo.avisosPorAplicar} aviso(s) do euPago por aplicar
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            Cada um é dinheiro que se moveu do lado deles e não se moveu do nosso. Não se resolvem
            sozinhos. O contrato dá dois dias úteis para comunicar uma operação não autorizada.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-white">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            Tudo o que o euPago disse está aplicado
          </p>
        </div>
      )}

      {/* ── Onde está a ligação ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
          Ligação ao euPago
        </p>
        {!ligacao.configurado ? (
          <p className="mt-2 text-sm text-amber-300">{ligacao.falta}</p>
        ) : (
          <div className="mt-2 space-y-1 text-xs text-slate-300">
            <p>
              Ambiente:{" "}
              <strong className={ligacao.ambiente === "producao" ? "text-red-300" : "text-cyan-300"}>
                {ligacao.ambiente === "producao" ? "PRODUÇÃO — dinheiro a sério" : "sandbox"}
              </strong>
            </p>
            <p>
              Segredo do webhook:{" "}
              {ligacao.temSegredoDoWebhook ? (
                <strong className="text-emerald-300">configurado</strong>
              ) : (
                <strong className="text-red-300">
                  EM FALTA — sem ele o webhook recusa todos os avisos
                </strong>
              )}
            </p>
            {estado.webhook && <PortaDosAvisos w={estado.webhook} />}
            {!ligacao.aberta && (
              <p className="flex items-start gap-1.5 text-amber-300">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  A cobrança está fechada: em produção, o cliente só é cobrado com
                  A_PLATAFORMA_COBRA ligado. Os ecrãs dizem-lhe hoje que paga ao profissional no
                  fim.
                </span>
              </p>
            )}
            {/*
              O portão de testador é uma excepção nomeada, e uma excepção que
              se esquece aberta deixa de ser excepção. Por isso aparece sempre
              que existe — e some sozinha quando a variável for apagada.
            */}
            {!ligacao.aberta && (ligacao.testadores ?? 0) > 0 && (
              <p className="text-cyan-300">
                Portão de testador ABERTO para {ligacao.testadores} email(s) — esses pagam a sério,
                até {5} € por pagamento. Apague a EUPAGO_EMAILS_DE_TESTE quando acabar de testar.
              </p>
            )}
          </div>
        )}

        {/*
          A ÚNICA PERGUNTA QUE NÃO SE RESPONDE A OLHAR: a chave serve?
          O erro mais provável é `EUPAGO_AMBIENTE=sandbox` com a chave de
          produção — as duas casas do euPago têm contas separadas.
        */}
        {ligacao.configurado && (
          <div className="mt-3 border-t border-slate-700/60 pt-3">
            <button
              type="button"
              onClick={() => void provar()}
              disabled={aProvar}
              className="rounded-[14px] border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-40"
            >
              {aProvar ? "A perguntar ao euPago…" : "Provar a ligação"}
            </button>
            <span className="ml-2 text-[11px] text-slate-500">
              pede uma referência de 1 € que ninguém paga — não cobra nem grava nada
            </span>

            {prova?.ok && (
              <p className="mt-2 text-xs text-emerald-300">
                A chave serve. Referência de teste {prova.entidade} / {prova.referencia} criada em{" "}
                {prova.base}.
                {prova.temSegredoDoWebhook === false &&
                  " Falta o segredo do webhook — sem ele nenhum pagamento chega a ser dado por pago."}
              </p>
            )}
            {prova && !prova.ok && (
              <div className="mt-2 text-xs text-red-300">
                <p>{prova.porque}</p>
                {prova.pista && <p className="mt-1 text-amber-300">{prova.pista}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <GestorDoDinheiro
        trabalhos={estado.trabalhos ?? []}
        token={token}
        onMudou={() => void carregar(true)}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { n: resumo.pagos, t: "pagos" },
          { n: resumo.pendentes, t: "por pagar" },
          { n: resumo.falhados, t: "falhados" },
          { n: null, t: "recebido", v: euros(resumo.totalPago) },
        ].map((c) => (
          <div key={c.t} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <p className="text-2xl font-bold text-white">{c.v ?? c.n}</p>
            <p className="mt-1 text-xs text-slate-400">{c.t}</p>
          </div>
        ))}
      </div>

      {resumo.comissaoDoEupago > 0 && (
        <p className="text-xs text-slate-500">
          O euPago levou {euros(resumo.comissaoDoEupago)} — sai da parte da CLYON, não da do
          profissional.
        </p>
      )}

      {estado.avisos.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-slate-950/40 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-300">
            Por aplicar
          </p>
          <div className="space-y-1 text-xs text-slate-300">
            {estado.avisos.map((a) => (
              <p key={a.id}>
                <strong className="text-white">{a.estado}</strong> · trid {a.trid} ·{" "}
                {euros(a.valor)}
                {a.pagamentoId ? ` · pagamento #${a.pagamentoId}` : ""}
                {a.nota ? ` — ${a.nota}` : ""}
              </p>
            ))}
          </div>
        </div>
      )}

      {estado.ultimos.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Últimos pagamentos
          </p>
          <div className="space-y-1 text-xs text-slate-300">
            {estado.ultimos.map((p) => (
              <p key={p.id}>
                <span className={CORES[p.estado] ?? "text-slate-400"}>{p.estado}</span> · pedido #
                {p.pedidoId} · {p.metodo === "mbway" ? "MB WAY" : "Multibanco"} ·{" "}
                {euros(p.valorPago ?? p.valor)}
                {p.entidade && p.referencia ? ` · ${p.entidade} / ${p.referencia}` : ""}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
