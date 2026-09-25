"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { AlertTriangle, CheckCircle2, CreditCard, ChevronDown, Loader2, Lock, Pencil } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  ladoDoCliente,
  ladoDoProfissional,
  nomeDoRecebimento,
  pagouAoProfissional,
  prontoAPagar,
} from "@/lib/dinheiro-do-trabalho";
import { contaDoCliente, quantoOProfissionalRecebe, type Taxas } from "@/lib/taxas-plataforma";

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
  valorAcordado: number;
  taxas: Taxas;
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
 * O GESTOR: um trabalho por linha, e uma pergunta de cada vez.
 *
 * *«Temos que separar os pagamentos entre os já recebidos, por receber, pagos
 * ao pro e por pagar aos pros.»* — 25-09-2026.
 *
 * Eram quatro montes por FASE, e a fase junta as duas pontas numa resposta
 * só: um trabalho «por receber» também está por pagar ao profissional, e não
 * aparecia nessa lista. Agora são quatro separadores, dois de cada ponta, e
 * cada trabalho aparece num de cada lado — é assim que se confere com o
 * extracto do banco aberto ao lado: primeiro o que entrou, depois o que saiu.
 *
 * Abre em «Por receber»: é o único que representa dinheiro que se pode perder.
 */
type Separador = "por_receber" | "recebidos" | "por_pagar" | "pagos";

const SEPARADORES: Array<{
  id: Separador;
  rotulo: string;
  cor: string;
  vazio: string;
}> = [
  {
    id: "por_receber",
    rotulo: "Por receber",
    cor: "text-amber-300",
    vazio: "Nenhum cliente por pagar.",
  },
  {
    id: "recebidos",
    rotulo: "Recebidos",
    cor: "text-emerald-300",
    vazio: "Ainda não entrou nenhum pagamento.",
  },
  {
    id: "por_pagar",
    rotulo: "Por pagar aos pros",
    cor: "text-cyan-300",
    vazio: "Não se deve nada a nenhum profissional.",
  },
  {
    id: "pagos",
    rotulo: "Pagos aos pros",
    cor: "text-emerald-300",
    vazio: "Ainda não se pagou a nenhum profissional.",
  },
];

function pertence(t: Trabalho, s: Separador): boolean {
  switch (s) {
    case "por_receber":
      return ladoDoCliente(t) === "por_receber";
    case "recebidos":
      return ladoDoCliente(t) === "recebido";
    case "por_pagar":
      return ladoDoProfissional(t) === "por_pagar";
    case "pagos":
      return ladoDoProfissional(t) === "pago";
  }
}

/**
 * A SOMA É DO DINHEIRO QUE PASSA PELA CLYON.
 *
 * Do lado do cliente conta o que ele paga; do lado do profissional, o que ele
 * recebe. O dinheiro em mão fica de fora das duas: está na lista, para se
 * saber que existe, mas não entrou nem saiu da conta — e uma soma que não bate
 * com o extracto é uma soma em que se deixa de confiar.
 */
function somaDe(linhas: Trabalho[], s: Separador): number {
  const doCliente = s === "por_receber" || s === "recebidos";
  const soma = linhas
    .filter((t) => !pagouAoProfissional(t))
    .reduce((n, t) => n + (doCliente ? t.clientePaga : t.profissionalRecebe), 0);
  return Math.round(soma * 100) / 100;
}

/** Os feitos, do mais recente para trás; o dinheiro em mão, que não tem data, no fim. */
function porData(s: Separador) {
  const quando = (t: Trabalho) =>
    (s === "recebidos" ? t.clientePagouEm : s === "pagos" ? t.pagoEm : null) ?? "";
  return (a: Trabalho, b: Trabalho) => quando(b).localeCompare(quando(a));
}

const POR_PAGINA = 40;

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
  const [separador, setSeparador] = useState<Separador>("por_receber");
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [quantos, setQuantos] = useState(POR_PAGINA);

  const q = busca.trim().toLowerCase();
  const filtrados = q
    ? trabalhos.filter((t) =>
        [t.cliente, t.telefoneDoCliente, t.profissional, t.cidade, `#${t.pedidoId}`]
          .filter(Boolean)
          .some((c) => String(c).toLowerCase().includes(q)),
      )
    : trabalhos;

  const contas = SEPARADORES.map((s) => {
    const linhas = filtrados.filter((t) => pertence(t, s.id));
    return { ...s, linhas, soma: somaDe(linhas, s.id) };
  });
  const actual = contas.find((c) => c.id === separador) ?? contas[0];

  /*
   * POR PAGAR: primeiro o que se pode pagar JÁ.
   *
   * Um trabalho por pagar nem sempre está pronto — pagar antes de o cliente
   * pagar é adiantar dinheiro da CLYON. Por isso a lista parte-se em duas, e
   * a de cima é a que tem botão.
   */
  const grupos =
    separador === "por_pagar"
      ? [
          { titulo: "Prontos a pagar", linhas: actual.linhas.filter(prontoAPagar) },
          {
            titulo: "À espera do cliente — pagar ou confirmar",
            linhas: actual.linhas.filter((t) => !prontoAPagar(t)),
          },
        ]
      : [
          {
            titulo: "",
            linhas:
              separador === "recebidos" || separador === "pagos"
                ? [...actual.linhas].sort(porData(separador))
                : actual.linhas,
          },
        ];

  function escolher(s: Separador) {
    setSeparador(s);
    setAberto(null);
    setErro("");
    setQuantos(POR_PAGINA);
  }

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
      setAberto(null);
      onMudou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  let mostradas = 0;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Trabalho a trabalho
        </p>
        <input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setQuantos(POR_PAGINA);
          }}
          placeholder="cliente, telemóvel, profissional ou #pedido"
          className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
        />
      </div>

      {/*
        OS QUATRO SEPARADORES, as duas pontas lado a lado: o cliente à
        esquerda, o profissional à direita. O número e o total estão no próprio
        separador — é a pergunta que se faz antes de abrir qualquer um.
      */}
      <div role="tablist" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {contas.map((c) => {
          const activo = c.id === separador;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={activo}
              onClick={() => escolher(c.id)}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                activo
                  ? "border-cyan-500/60 bg-cyan-500/10"
                  : "border-slate-800 bg-slate-900/60 hover:border-slate-600"
              }`}
            >
              <span className={`block text-[11px] font-semibold uppercase tracking-wide ${c.cor}`}>
                {c.rotulo} · {c.linhas.length}
              </span>
              <span className="mt-0.5 block text-sm font-bold tabular-nums text-white">
                {euros(c.soma)}
              </span>
            </button>
          );
        })}
      </div>

      {erro && !aberto && <p className="mt-2 text-xs text-red-300">{erro}</p>}

      {actual.linhas.length === 0 && (
        <p className="mt-3 text-xs text-slate-500">{q ? "Nada encontrado." : actual.vazio}</p>
      )}

      {grupos.map((g) => {
        if (g.linhas.length === 0) return null;
        const resto = Math.max(0, quantos - mostradas);
        const aMostrar = g.linhas.slice(0, resto);
        mostradas += aMostrar.length;
        return (
          <div key={g.titulo || "todos"} className="mt-4">
            {g.titulo && (
              <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span>
                  {g.titulo} · {g.linhas.length}
                </span>
                <span className="tabular-nums">{euros(somaDe(g.linhas, separador))}</span>
              </p>
            )}
            <div className="mt-2 space-y-2">
              {aMostrar.map((t) => (
                <Linha
                  key={t.negociacaoId}
                  t={t}
                  ocupado={ocupado === t.negociacaoId}
                  aberto={aberto === t.negociacaoId}
                  erro={aberto === t.negociacaoId ? erro : ""}
                  onAbrir={() => {
                    setErro("");
                    setAberto((a) => (a === t.negociacaoId ? null : t.negociacaoId));
                  }}
                  onEntrou={(metodo) => void agir(t, "/api/admin/pagamentos/recebido", { metodo })}
                  onPaguei={() =>
                    void agir(t, "/api/admin/pagamentos/pago-ao-profissional", {})
                  }
                  onCorrigir={(valor, motivo) =>
                    void agir(t, "/api/admin/negociacoes/valor", {
                      valor,
                      motivo: motivo || undefined,
                    })
                  }
                />
              ))}
            </div>
          </div>
        );
      })}

      {actual.linhas.length > quantos && (
        <button
          onClick={() => setQuantos((n) => n + POR_PAGINA)}
          className="mt-3 w-full rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500"
        >
          Mostrar mais ({actual.linhas.length - quantos})
        </button>
      )}
    </div>
  );
}

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
  aberto,
  erro,
  onAbrir,
  onEntrou,
  onPaguei,
  onCorrigir,
}: {
  t: Trabalho;
  ocupado: boolean;
  aberto: boolean;
  erro: string;
  onAbrir: () => void;
  onEntrou: (metodo: string) => void;
  onPaguei: () => void;
  onCorrigir: (valor: number, motivo: string) => void;
}) {
  const emMao = pagouAoProfissional(t);
  const [comoEntrou, setComoEntrou] = useState(false);

  return (
    <div
      className={`rounded-lg border bg-slate-900/60 p-3 ${
        aberto ? "border-cyan-600/50" : "border-slate-800"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
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
          <span className="text-xs text-slate-500">· trabalho {euros(t.valorAcordado)}</span>
        </div>
        <button
          onClick={() => {
            setComoEntrou(false);
            onAbrir();
          }}
          aria-expanded={aberto}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-cyan-500 hover:text-cyan-200"
        >
          {aberto ? "Fechar" : "Abrir"}
          <ChevronDown
            className={`h-3 w-3 transition ${aberto ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
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
        ) : prontoAPagar(t) ? (
          <span className="text-cyan-300">a receber {euros(t.profissionalRecebe)}</span>
        ) : !t.clientePagouEm ? (
          <span className="text-slate-500">
            {euros(t.profissionalRecebe)} — à espera que o cliente pague
          </span>
        ) : (
          <span className="text-slate-500">
            {euros(t.profissionalRecebe)} — à espera da confirmação do cliente
          </span>
        )}
      </p>

      {/*
        O TRABALHO ABERTO: cada ponta anota-se por si — 25-09-2026.

        *«Tem trabalhos que já recebemos mas ainda não pagámos os pros, e tem
        pedidos que ainda não pagaram mas já pagámos os pros.»* As duas pontas
        não andam por ordem, e o ecrã não as obriga a andar: o cliente anota-se
        sem olhar ao profissional, e o profissional sem esperar pelo cliente.
      */}
      {aberto && (
        <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
          {erro && <p className="text-[11px] text-red-300">{erro}</p>}

          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              O cliente pagou-nos?
            </p>
            {emMao ? (
              <p className="mt-1 text-[11px] text-slate-400">
                Pago em mão ao profissional — não passa pela CLYON.
              </p>
            ) : t.clientePagouEm ? (
              <p className="mt-1 text-[11px] text-emerald-300">
                Sim — {euros(t.clientePaga)} por {nomeDoRecebimento(t.comoEntrou)}
                {DIA(t.clientePagouEm) ? `, a ${DIA(t.clientePagouEm)}` : ""}.
              </p>
            ) : !comoEntrou ? (
              /*
                ⚠️ Isto DESBLOQUEIA DINHEIRO: um registo aqui move o trabalho de
                «por cobrar» para «disponível» na carteira do profissional. Por
                isso é um segundo clique, e cada opção diz o que quer dizer.
              */
              <button
                onClick={() => setComoEntrou(true)}
                disabled={ocupado}
                className="mt-1 rounded-lg border border-amber-600/60 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
              >
                Já recebemos {euros(t.clientePaga)}
              </button>
            ) : (
              <div className="mt-1 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5">
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
          </section>

          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Já pagámos a {t.profissional}?
            </p>
            {emMao ? (
              <p className="mt-1 text-[11px] text-slate-400">
                Recebeu do cliente, em mão — não há nada a transferir.
              </p>
            ) : t.pagoEm ? (
              <p className="mt-1 text-[11px] text-emerald-300">
                Sim — {euros(t.profissionalRecebe)} a {DIA(t.pagoEm)}.
              </p>
            ) : (
              <>
                {!prontoAPagar(t) && (
                  <p className="mt-1 text-[11px] text-amber-300">
                    {t.clientePagouEm
                      ? "O cliente ainda não confirmou o trabalho."
                      : "O cliente ainda não pagou."}{" "}
                    Marque só se a transferência já saiu — fica no histórico como adiantado.
                  </p>
                )}
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Marcar como pago a ${t.profissional}?\n\n` +
                          `${euros(t.profissionalRecebe)} pelo pedido #${t.pedidoId}.\n\n` +
                          "Faça a transferência PRIMEIRO no banco. Isto só regista que ela saiu.",
                      )
                    )
                      onPaguei();
                  }}
                  disabled={ocupado}
                  className="mt-1 flex items-center gap-1.5 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {ocupado && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                  Já pagámos {euros(t.profissionalRecebe)}
                </button>
              </>
            )}
          </section>

          <section>
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <Pencil className="h-3 w-3" aria-hidden="true" />
              Corrigir o valor
            </p>
            <CorrigirValor t={t} ocupado={ocupado} onGravar={onCorrigir} />
          </section>
        </div>
      )}
    </div>
  );
}

/**
 * CORRIGIR O VALOR FINAL, sem sair deste ecrã — 25-09-2026.
 *
 * Escreve-se o valor do TRABALHO, sem taxas, e a conta refaz-se à frente de
 * quem escreve: o que o cliente paga e o que o profissional recebe. É a mesma
 * rota das Carteiras e da Agenda, e é ela que decide — o que aqui se mostra é
 * só a pré-visualização, com as taxas desta negociação.
 *
 * Um trabalho já pago ao profissional pede motivo: depois da transferência o
 * número é um facto contabilístico, e muda-se, mas não em silêncio.
 */
function CorrigirValor({
  t,
  ocupado,
  onGravar,
}: {
  t: Trabalho;
  ocupado: boolean;
  onGravar: (valor: number, motivo: string) => void;
}) {
  const [texto, setTexto] = useState(t.valorAcordado.toFixed(2).replace(".", ","));
  const [motivo, setMotivo] = useState("");

  const valor = Number(texto.replace(/\s/g, "").replace(",", "."));
  const valido = Number.isFinite(valor) && valor > 0;
  const igual = valido && Math.abs(valor - t.valorAcordado) < 0.005;
  const faltaMotivo = Boolean(t.pagoEm) && !motivo.trim();
  const emMao = pagouAoProfissional(t);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valido && !igual && !faltaMotivo) onGravar(Math.round(valor * 100) / 100, motivo.trim());
      }}
      className="mt-2 space-y-2 rounded-lg border border-slate-700 bg-slate-950/60 p-2.5"
    >
      <label className="block text-[11px] text-slate-400">
        Valor do trabalho, sem taxas (era {euros(t.valorAcordado)})
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          inputMode="decimal"
          className="mt-1 block w-36 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm tabular-nums text-white"
        />
      </label>

      {valido && (
        <p className="text-[11px] text-slate-300">
          O cliente passa a pagar{" "}
          <strong className="text-white">{euros(contaDoCliente(valor, t.taxas).total)}</strong>{" "}
          (era {euros(t.clientePaga)}) · {t.profissional} passa a receber{" "}
          <strong className="text-white">{euros(quantoOProfissionalRecebe(valor, t.taxas))}</strong>{" "}
          (era {euros(t.profissionalRecebe)})
        </p>
      )}

      {!emMao && t.clientePagouEm && (
        <p className="text-[11px] text-amber-300">
          O cliente já pagou {euros(t.clientePaga)}. Isto não mexe no que entrou — uma diferença
          acerta-se com ele à parte.
        </p>
      )}

      <label className="block text-[11px] text-slate-400">
        Motivo {t.pagoEm ? "(obrigatório — o profissional já foi pago)" : "(opcional, fica no histórico)"}
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={300}
          placeholder="ex.: orçamento fechado no local"
          className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white placeholder:text-slate-600"
        />
      </label>

      <button
        type="submit"
        disabled={ocupado || !valido || igual || faltaMotivo}
        className="flex items-center gap-1.5 rounded-lg bg-cyan-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-40"
      >
        {ocupado && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
        Gravar {valido ? euros(Math.round(valor * 100) / 100) : ""}
      </button>
    </form>
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
