"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

/**
 * A COMISSÃO POR PERÍODOS, COM OS TRABALHOS POR TRÁS DE CADA NÚMERO.
 *
 * *«Quero mais detalhes dos trabalhos feitos para saber quais trabalhos o
 * assistente fez, para justificar os valores.»* — 29-09-2026.
 *
 * *«Devemos ter uma gestão dos valores: do dia 23/09 ao 15/10, depois a
 * próxima contagem vai até ao final do mês…»* — 08-10-2026.
 *
 * *«Os 40 % da assistente passam a ser não dos 11 e sim dos lucros totais do
 * período.»* — 08-10-2026. Cada linha diz o valor do trabalho, o LUCRO da
 * CLYON nele (sem IVA) e de onde veio esse lucro; o período soma os lucros e
 * tira a parte dela do total.
 *
 * Um período por linha, do mais recente para o primeiro: em curso, por pagar
 * ou pago. «Marcar como pago» só aparece num período fechado e sem pendentes,
 * e congela-o: o valor gravado é o que o servidor calcula, nunca o que está no
 * ecrã.
 *
 * O CSV existe para a conversa do fim de cada período: manda-se o extracto à
 * pessoa, e ela confere trabalho a trabalho sem entrar no backoffice.
 */

type FonteDoValor =
  | "acordado"
  | "preco_ao_cliente"
  | "falta_preco_ao_cliente"
  | "lucro_manual"
  | "falta_lucro";

type Trabalho = {
  pedidoId: number;
  estado: string;
  conta: boolean;
  cliente: string | null;
  servico: string | null;
  cidade: string | null;
  profissional: string | null;
  atribuidoEm: string | null;
  actualizadoEm: string | null;
  concluidoEm?: string | null;
  valor: number;
  fonteDoValor: FonteDoValor;
  lucro: number;
  comissaoAssistente: number;
};

type Detalhe = {
  nome: string;
  comissaoPercent: number;
  trabalhos: Trabalho[];
  totais: { valorTrabalhos: number; lucro: number; comissaoAssistente: number };
};

type Pendente = { pedidoId: number; falta: "preco_ao_cliente" | "lucro" };

type Periodo = {
  inicio: string;
  fim: string;
  rotulo: string;
  estado: "em_curso" | "por_pagar" | "pago";
  trabalhos: number;
  valorTrabalhos: number;
  lucro: number;
  comissaoAssistente: number;
  comissaoPercent: number;
  pago: { pagoEm: string | null; pagoPor: string | null } | null;
  diferenca: number | null;
  pendentes: Pendente[];
  detalhe: Trabalho[];
};

type Resposta = {
  nome: string;
  periodos: Periodo[];
};

/** O que o painel do administrador pode pedir a partir daqui. */
export type AccaoDeGestao =
  | { pagarPeriodo: string }
  | { anularPagamento: string }
  | { lucroDoPedido: { pedidoId: number; lucro: string } };

/*
 * DE ONDE VEIO O LUCRO — dito, porque é a primeira coisa que se pergunta.
 * As que faltam vão a âmbar: contam zero até se escreverem.
 */
const FONTE: Record<FonteDoValor, string> = {
  acordado: "taxas da plataforma",
  preco_ao_cliente: "Trabalho CLYON",
  falta_preco_ao_cliente: "falta o preço ao cliente",
  lucro_manual: "escrito à mão",
  falta_lucro: "falta o lucro",
};

const FONTE_EM_FALTA: ReadonlySet<FonteDoValor> = new Set<FonteDoValor>(["falta_preco_ao_cliente", "falta_lucro"]);

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const percent = (v: number) =>
  `${Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",")} %`;
const dataCurta = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });
};
const diaEscrito = (dia: string) => dia.split("-").reverse().join("/");

export function paraCsv(d: Detalhe): string {
  const aspas = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const num = (n: number) => n.toFixed(2).replace(".", ",");
  const cabecalho = [
    "Pedido",
    "Estado",
    "Conta",
    "Cliente",
    "Serviço",
    "Localidade",
    "Profissional",
    "Concluído em",
    "Valor sem IVA",
    "Lucro CLYON",
    "Origem do lucro",
    `${d.nome} (${d.comissaoPercent} %)`,
  ];
  const linhas = d.trabalhos.map((t) => [
    `#${t.pedidoId}`,
    t.estado,
    t.conta ? "sim" : "não",
    t.cliente,
    t.servico,
    t.cidade,
    t.profissional,
    dataCurta(t.concluidoEm),
    num(t.valor),
    t.conta ? num(t.lucro) : "",
    FONTE[t.fonteDoValor],
    t.conta ? num(t.comissaoAssistente) : "",
  ]);
  const total = [
    "TOTAL", "", "", "", "", "", "", "",
    num(d.totais.valorTrabalhos),
    num(d.totais.lucro),
    "",
    num(d.totais.comissaoAssistente),
  ];
  // `;` e BOM: é assim que o Excel português abre acentos e vírgulas decimais.
  return "﻿" + [cabecalho, ...linhas, total].map((l) => l.map(aspas).join(";")).join("\r\n");
}

/** O período no formato do extracto: os números dele, a percentagem dele. */
function detalheDoPeriodo(nome: string, p: Periodo): Detalhe {
  return {
    nome,
    comissaoPercent: p.comissaoPercent,
    trabalhos: p.detalhe,
    totais: { valorTrabalhos: p.valorTrabalhos, lucro: p.lucro, comissaoAssistente: p.comissaoAssistente },
  };
}

const ESTILO_DO_ESTADO: Record<Periodo["estado"], string> = {
  em_curso: "bg-cyan-500/15 text-cyan-200",
  por_pagar: "bg-amber-500/15 text-amber-200",
  pago: "bg-emerald-500/15 text-emerald-200",
};

function rotuloDoEstado(p: Periodo): string {
  if (p.estado === "em_curso") return `em curso · fecha a ${diaEscrito(p.fim)}`;
  if (p.estado === "por_pagar") return "por pagar";
  const quando = dataCurta(p.pago?.pagoEm);
  return `pago${quando ? ` a ${quando}` : ""}${p.pago?.pagoPor ? ` por ${p.pago.pagoPor}` : ""}`;
}

/** Escrever o lucro de um trabalho fechado à mão — só no painel do administrador. */
function EscreverLucro({
  t,
  gerir,
}: {
  t: Trabalho;
  gerir: (corpo: AccaoDeGestao) => Promise<boolean>;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [aGravar, setAGravar] = useState(false);
  if (!aberto) {
    return (
      <button
        onClick={() => {
          setTexto(t.fonteDoValor === "lucro_manual" ? t.lucro.toFixed(2).replace(".", ",") : "");
          setAberto(true);
        }}
        className="mt-0.5 text-[10px] text-cyan-300 underline decoration-cyan-700 underline-offset-2 hover:text-cyan-200"
      >
        {t.fonteDoValor === "falta_lucro" ? "escrever o lucro" : "mudar"}
      </button>
    );
  }
  return (
    <span className="mt-1 flex items-center justify-end gap-1">
      <input
        inputMode="decimal"
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="0,00"
        aria-label={`Lucro da CLYON no #${t.pedidoId}, sem IVA`}
        className="w-20 rounded border border-slate-600 bg-slate-950 px-1.5 py-0.5 text-right text-xs text-white outline-none focus:border-cyan-500"
      />
      <button
        onClick={async () => {
          setAGravar(true);
          try {
            if (await gerir({ lucroDoPedido: { pedidoId: t.pedidoId, lucro: texto } })) setAberto(false);
          } finally {
            setAGravar(false);
          }
        }}
        disabled={aGravar || texto.trim() === ""}
        className="rounded bg-acao px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
      >
        OK
      </button>
    </span>
  );
}

function TabelaDeTrabalhos({
  nome,
  p,
  gerir,
}: {
  nome: string;
  p: Periodo;
  gerir?: (corpo: AccaoDeGestao) => Promise<boolean>;
}) {
  if (p.detalhe.length === 0) {
    return <p className="text-xs text-slate-500">Nenhum trabalho concluído neste período — a comissão é 0 €.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-1 pr-2">Pedido</th>
            <th className="py-1 pr-2">Cliente</th>
            <th className="py-1 pr-2">Profissional</th>
            <th className="py-1 pr-2 text-right">Valor s/ IVA</th>
            <th className="py-1 pr-2 text-right">Lucro CLYON</th>
            <th className="py-1 text-right">
              {nome} ({percent(p.comissaoPercent)})
            </th>
          </tr>
        </thead>
        <tbody className="text-slate-300">
          {p.detalhe.map((t) => (
            <tr key={t.pedidoId} className="border-t border-slate-800">
              <td className="py-1.5 pr-2 font-semibold text-white">#{t.pedidoId}</td>
              <td className="py-1.5 pr-2">
                {t.cliente ?? "—"}
                <span className="block text-[10px] text-slate-500">
                  {[t.servico, t.cidade, t.concluidoEm ? `concluído a ${dataCurta(t.concluidoEm)}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </td>
              <td className="py-1.5 pr-2">{t.profissional ?? "—"}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{euros(t.valor)}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {euros(t.lucro)}
                <span
                  className={`block text-[10px] ${
                    FONTE_EM_FALTA.has(t.fonteDoValor) ? "text-amber-300" : "text-slate-500"
                  }`}
                >
                  {FONTE[t.fonteDoValor]}
                </span>
                {gerir && p.estado !== "pago" && (t.fonteDoValor === "falta_lucro" || t.fonteDoValor === "lucro_manual") && (
                  <EscreverLucro t={t} gerir={gerir} />
                )}
              </td>
              <td className="py-1.5 text-right font-semibold tabular-nums text-emerald-300">
                {euros(t.comissaoAssistente)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-600 font-semibold text-white">
            <td className="py-1.5 pr-2" colSpan={3}>
              Total
            </td>
            <td className="py-1.5 pr-2 text-right tabular-nums">{euros(p.valorTrabalhos)}</td>
            <td className="py-1.5 pr-2 text-right tabular-nums">{euros(p.lucro)}</td>
            <td className="py-1.5 text-right tabular-nums text-emerald-300">{euros(p.comissaoAssistente)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-1 text-[10px] text-slate-500">
        A parte de {nome} é {percent(p.comissaoPercent)} do lucro total do período — e por isso pode
        diferir um cêntimo da soma das linhas arredondadas.
      </p>
    </div>
  );
}

/**
 * NÃO SABE ENDEREÇO NENHUM — quem o usa diz de onde ler e, se for o caso, como
 * gerir. Entra também no painel da assistente (`MinhaComissao`), e o ecrã dela
 * não pode trazer escritas as rotas só do administrador: é o que o teste das
 * secções (`seccoes-do-assistente.test.ts`) verifica.
 */
export default function TrabalhosDoAssistente({
  token,
  fonte,
  gerir,
}: {
  token: string | null;
  /** O GET dos períodos: o de uma conta, no administrador; o de si própria, na assistente. */
  fonte: string;
  /**
   * Pagar, anular e escrever um lucro — só no painel do administrador. Sem
   * isto, os botões não aparecem: ela vê e descarrega, não mexe. Devolve se
   * correu bem.
   */
  gerir?: (corpo: AccaoDeGestao) => Promise<boolean>;
}) {
  const endereco = fonte;
  const podeGerir = gerir != null;
  const [d, setD] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Pedido à parte e só quando se abre: pode ter centenas de linhas, e o ecrã
  // das contas recarrega-se sozinho de vinte em vinte segundos.
  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(endereco, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok) setErro(j.error ?? "Não foi possível ler os trabalhos.");
      else {
        setErro("");
        setD(j);
      }
    } catch {
      setErro("Erro de rede.");
    }
  }, [endereco, token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /** Uma acção de gestão, e a lista relida a seguir. O erro mostra-o quem gere. */
  const gerirERecarregar = gerir
    ? async (corpo: AccaoDeGestao) => {
        const ok = await gerir(corpo);
        if (ok) await carregar();
        return ok;
      }
    : undefined;

  async function agir(corpo: AccaoDeGestao, chave: string) {
    if (!gerirERecarregar) return;
    setOcupado(chave);
    try {
      await gerirERecarregar(corpo);
    } finally {
      setOcupado(null);
    }
  }

  function pagar(p: Periodo) {
    if (
      !window.confirm(
        `Marcar ${p.rotulo} como pago a ${d?.nome}: ${euros(p.comissaoAssistente)} — ${percent(p.comissaoPercent)} de ${euros(p.lucro)} de lucro (${p.trabalhos} trabalho${p.trabalhos === 1 ? "" : "s"})?\n\nO valor fica congelado.`,
      )
    ) {
      return;
    }
    agir({ pagarPeriodo: p.inicio }, p.inicio);
  }

  function anular(p: Periodo) {
    if (
      !window.confirm(
        `Anular o pagamento de ${p.rotulo} (${euros(p.comissaoAssistente)})?\n\nO período volta a «por pagar», com os números e a percentagem de hoje.`,
      )
    ) {
      return;
    }
    agir({ anularPagamento: p.inicio }, p.inicio);
  }

  function descarregar(p: Periodo) {
    if (!d) return;
    const url = URL.createObjectURL(
      new Blob([paraCsv(detalheDoPeriodo(d.nome, p))], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `comissao-${d.nome.toLowerCase()}-${p.inicio}-a-${p.fim}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (!d) {
    return erro ? (
      <p className="text-xs text-red-300">{erro}</p>
    ) : (
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> A ler os períodos…
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Períodos · desde 23/09/2026
      </p>
      {erro && <p className="mb-2 text-xs text-red-300">{erro}</p>}

      {d.periodos.length === 0 ? (
        <p className="text-xs text-slate-500">A contagem começa a 23/09/2026.</p>
      ) : (
        <ul className="space-y-2">
          {d.periodos.map((p) => {
            const estaAberto = aberto === p.inicio;
            const semPreco = p.pendentes.filter((x) => x.falta === "preco_ao_cliente").map((x) => `#${x.pedidoId}`);
            const semLucro = p.pendentes.filter((x) => x.falta === "lucro").map((x) => `#${x.pedidoId}`);
            return (
              <li key={p.inicio} className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">{p.rotulo}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTILO_DO_ESTADO[p.estado]}`}>
                    {rotuloDoEstado(p)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {p.trabalhos} trabalho{p.trabalhos === 1 ? "" : "s"} · lucro {euros(p.lucro)}
                  </span>
                  <span className="ml-auto text-sm font-bold tabular-nums text-emerald-300">
                    {euros(p.comissaoAssistente)}
                  </span>
                </div>

                {(semPreco.length > 0 || semLucro.length > 0) && (
                  <p className="mt-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                    Contam zero até se escrever{" "}
                    {[
                      semPreco.length > 0 ? `o preço ao cliente de ${semPreco.join(", ")} (em «Trabalhos CLYON»)` : "",
                      semLucro.length > 0 ? `o lucro de ${semLucro.join(", ")} (na lista deste período)` : "",
                    ]
                      .filter(Boolean)
                      .join(" e ")}
                    {podeGerir ? " — e o período só se paga depois disso." : "."}
                  </p>
                )}

                {podeGerir && p.diferenca != null && (
                  <p className="mt-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                    Hoje a conta deste período dá {euros(p.comissaoAssistente + p.diferenca)} (
                    {p.diferenca > 0 ? "+" : ""}
                    {euros(p.diferenca)}) — um trabalho mudou de valor, ou entrou outro, depois de
                    pago. Acerte à mão, ou anule e volte a marcar.
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setAberto(estaAberto ? null : p.inicio)}
                    className="flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                    aria-expanded={estaAberto}
                  >
                    {estaAberto ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
                    {estaAberto ? "Esconder" : "Ver"} trabalhos
                  </button>
                  <button
                    onClick={() => descarregar(p)}
                    className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    CSV
                  </button>
                  {podeGerir && p.estado === "por_pagar" && (
                    <button
                      onClick={() => pagar(p)}
                      disabled={ocupado === p.inicio || p.pendentes.length > 0}
                      title={p.pendentes.length > 0 ? "Falta escrever um preço ao cliente ou um lucro" : undefined}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
                    >
                      {ocupado === p.inicio && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                      Marcar como pago
                    </button>
                  )}
                  {podeGerir && p.estado === "pago" && (
                    <button
                      onClick={() => anular(p)}
                      disabled={ocupado === p.inicio}
                      className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40"
                    >
                      Anular pagamento
                    </button>
                  )}
                </div>

                {estaAberto && (
                  <div className="mt-2">
                    <TabelaDeTrabalhos nome={d.nome} p={p} gerir={gerirERecarregar} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
