"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { diaEmLisboa } from "@/lib/hora-de-lisboa";
import { FIM_DO_PRIMEIRO_PERIODO, INICIO_DAS_COMISSOES, diaEscrito } from "@/lib/periodos-de-comissao";
import {
  ROTULO_DO_ESTADO_NO_RELATORIO,
  relatorioDasComissoes,
  relatorioEmCsv,
  type Relatorio,
} from "@/lib/relatorio-das-comissoes";

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
  /** Quem operou o pedido do lado da CLYON — a assistente, ou o administrador. */
  operador?: string;
  atribuidoEm: string | null;
  actualizadoEm: string | null;
  concluidoEm?: string | null;
  /** A data é a da última mexida no pedido (fechado à mão antes de 08/10). */
  dataAproximada?: boolean;
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

/** O resumo entre duas datas à escolha — ver `resumoEntreDatas` (14-10-2026). */
type Resumo = {
  inicio: string;
  fim: string;
  rotulo: string;
  trabalhos: number;
  valorTrabalhos: number;
  lucro: number;
  comissaoAssistente: number;
  comissaoPercent: number;
  pendentes: Pendente[];
  emPeriodosPagos: number;
  comDataAproximada: number;
  porOperador: Array<{ operador: string; trabalhos: number; lucro: number }>;
  detalhe: Trabalho[];
};

/** Acordado e ainda não concluído, com a razão — ver `porqueAindaNaoConta` (15-10-2026). */
type AindaNaoConta = {
  pedidoId: number;
  cliente: string | null;
  servico: string | null;
  cidade: string | null;
  profissional: string | null;
  operador: string;
  motivo: "por_fazer" | "falta_confirmar" | "confirmado_sem_concluir" | "cancelado" | "arquivado" | "conta_de_teste";
  porque: string;
};

/** Uma quinzena por vir (ou a actual), com o que se espera — ver `previsaoPorPeriodo` (17-10-2026). */
type Previsao = {
  inicio: string;
  fim: string;
  rotulo: string;
  trabalhos: number;
  lucro: number;
  comissaoAssistente: number;
  comissaoPercent: number;
  semValor: number[];
  detalhe: Array<{
    pedidoId: number;
    cliente: string | null;
    servico: string | null;
    operador: string;
    dia: string;
    diaMarcado: boolean;
    motivo: AindaNaoConta["motivo"];
    lucro: number;
    fonteDoValor: FonteDoValor;
  }>;
};

type Resposta = {
  nome: string;
  comissaoSobre?: "todos" | "seus";
  comissaoPercent?: number;
  periodos: Periodo[];
  resumo?: Resumo;
  aindaNaoContam?: AindaNaoConta[];
  previsao?: Previsao[];
};

/** A cor da razão: o que vai contar, o que precisa de alguém, e o que nunca conta. */
const COR_DO_MOTIVO: Record<AindaNaoConta["motivo"], string> = {
  por_fazer: "text-slate-300",
  falta_confirmar: "text-amber-300",
  confirmado_sem_concluir: "text-red-300",
  cancelado: "text-slate-500",
  arquivado: "text-slate-500",
  conta_de_teste: "text-slate-500",
};

/** O que o painel do administrador pode pedir a partir daqui. */
export type AccaoDeGestao =
  | { pagarPeriodo: string }
  | { anularPagamento: string }
  | { lucroDoPedido: { pedidoId: number; lucro: string } }
  | { precoDoPedido: { pedidoId: number; preco: string } }
  | { dataDoPedido: { pedidoId: number; dia: string } };

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
/** O resumo de um intervalo no formato de um período, para a mesma tabela e o mesmo CSV. */
function periodoDoResumo(r: Resumo): Periodo {
  return {
    inicio: r.inicio,
    fim: r.fim,
    rotulo: r.rotulo,
    // Não é um período a pagar: é uma consulta, e por isso nunca «pago».
    estado: "em_curso",
    trabalhos: r.trabalhos,
    valorTrabalhos: r.valorTrabalhos,
    lucro: r.lucro,
    comissaoAssistente: r.comissaoAssistente,
    comissaoPercent: r.comissaoPercent,
    pago: null,
    diferenca: null,
    pendentes: r.pendentes,
    detalhe: r.detalhe,
  };
}

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
    "Operador",
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
    t.operador ?? "",
    `${dataCurta(t.concluidoEm)}${t.dataAproximada ? " (aproximada)" : ""}`,
    num(t.valor),
    t.conta ? num(t.lucro) : "",
    FONTE[t.fonteDoValor],
    t.conta ? num(t.comissaoAssistente) : "",
  ]);
  const total = [
    "TOTAL", "", "", "", "", "", "", "", "",
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

/**
 * ESCREVER O PREÇO AO CLIENTE de um Trabalho CLYON, no próprio período —
 * 17-10-2026, «escrever o preço ali». O 23/09–15/10 ficou preso porque o #422
 * não o tinha, e para o escrever era preciso ir a «Trabalhos CLYON» e voltar.
 */
function EscreverPreco({
  pedidoId,
  gerir,
}: {
  pedidoId: number;
  gerir: (corpo: AccaoDeGestao) => Promise<boolean>;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [aGravar, setAGravar] = useState(false);
  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded border border-amber-400/40 px-1.5 py-0.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/20"
      >
        Escrever o preço do #{pedidoId}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[11px] text-amber-100">#{pedidoId}:</span>
      <input
        inputMode="decimal"
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="0,00"
        aria-label={`Preço ao cliente do #${pedidoId}, sem IVA`}
        className="w-24 rounded border border-slate-600 bg-slate-950 px-1.5 py-0.5 text-right text-xs text-white outline-none focus:border-cyan-500"
      />
      <span className="text-[11px] text-amber-100">€ sem IVA</span>
      <button
        onClick={async () => {
          setAGravar(true);
          try {
            if (await gerir({ precoDoPedido: { pedidoId, preco: texto } })) setAberto(false);
          } finally {
            setAGravar(false);
          }
        }}
        disabled={aGravar || texto.trim() === ""}
        className="rounded bg-acao px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
      >
        Gravar
      </button>
      <button onClick={() => setAberto(false)} className="text-[10px] text-slate-400 hover:text-slate-200">
        cancelar
      </button>
    </span>
  );
}

/** Os trabalhos que se esperam numa quinzena — a previsão, linha a linha. */
function TabelaDaPrevisao({ p }: { p: Previsao }) {
  if (p.detalhe.length === 0) {
    return <p className="text-[11px] text-slate-500">Ainda não há trabalhos marcados para esta quinzena.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-slate-500">
            <th className="py-1 pr-3 font-semibold">Pedido</th>
            <th className="py-1 pr-3 font-semibold">Cliente</th>
            <th className="py-1 pr-3 font-semibold">Dia</th>
            <th className="py-1 pr-3 font-semibold">Operador</th>
            <th className="py-1 text-right font-semibold">Lucro previsto</th>
          </tr>
        </thead>
        <tbody>
          {p.detalhe.map((t) => (
            <tr key={t.pedidoId} className="border-t border-slate-800/80">
              <td className="py-1.5 pr-3 font-semibold text-white">#{t.pedidoId}</td>
              <td className="py-1.5 pr-3 text-slate-200">
                {t.cliente ?? "—"}
                {t.servico && <span className="block text-[10px] text-slate-500">{t.servico}</span>}
              </td>
              <td className="py-1.5 pr-3 text-slate-300">
                {diaEscrito(t.dia)}
                <span className="block text-[10px] text-slate-500">
                  {t.diaMarcado ? "marcado" : t.motivo === "por_fazer" ? "atrasado ou sem dia — conta-se hoje" : "à espera de confirmar"}
                </span>
              </td>
              <td className="py-1.5 pr-3 text-slate-300">{t.operador}</td>
              <td className="py-1.5 text-right tabular-nums">
                {FONTE_EM_FALTA.has(t.fonteDoValor) ? (
                  <span className="text-amber-300">0,00 € · {FONTE[t.fonteDoValor]}</span>
                ) : (
                  <span className="text-slate-200">{euros(t.lucro)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * O RELATÓRIO GERAL — 17-10-2026. Todas as quinzenas com os totais, por mês,
 * por operador, e o CSV. As contas são as de `relatorioDasComissoes`.
 */
function RelatorioGeral({ nome, percentagem, r }: { nome: string; percentagem: number; r: Relatorio }) {
  function descarregarRelatorio() {
    const url = URL.createObjectURL(
      new Blob([relatorioEmCsv(nome, percentagem, r)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-comissoes-${nome.toLowerCase()}-${diaEmLisboa(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  const cartoes: Array<[string, number, string]> = [
    ["Ganho até hoje", r.totais.ganho, "text-white"],
    ["Pago", r.totais.pago, "text-emerald-300"],
    ["Por pagar", r.totais.porPagar, "text-amber-300"],
    ["Em curso", r.totais.emCurso, "text-cyan-300"],
    ["Previsto", r.totais.previsto, "text-slate-300"],
  ];
  return (
    <div className="mt-2 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {cartoes.map(([rotulo, valor, cor]) => (
          <div key={rotulo} className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{rotulo}</p>
            <p className={`text-sm font-bold tabular-nums ${cor}`}>{euros(valor)}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-500">
        «Ganho até hoje» soma o pago, o por pagar e o em curso. O previsto são os trabalhos acordados e ainda não
        concluídos, pela data marcada — só conta quando ficarem concluídos.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-500">
              <th className="py-1 pr-3 font-semibold">Quinzena</th>
              <th className="py-1 pr-3 font-semibold">Estado</th>
              <th className="py-1 pr-3 text-right font-semibold">Trabalhos</th>
              <th className="py-1 pr-3 text-right font-semibold">Lucro CLYON</th>
              <th className="py-1 pr-3 text-right font-semibold">Comissão</th>
              <th className="py-1 pr-3 text-right font-semibold">Previsto</th>
              <th className="py-1 font-semibold">Pago em</th>
            </tr>
          </thead>
          <tbody>
            {r.linhas.map((l) => (
              <tr key={l.inicio} className="border-t border-slate-800/80">
                <td className="py-1.5 pr-3 font-semibold text-white">{l.rotulo}</td>
                <td className="py-1.5 pr-3 text-slate-300">{ROTULO_DO_ESTADO_NO_RELATORIO[l.estado]}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-slate-300">{l.estado === "previsto" ? "—" : l.trabalhos}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-slate-300">{l.estado === "previsto" ? "—" : euros(l.lucro)}</td>
                <td className="py-1.5 pr-3 text-right font-semibold tabular-nums text-emerald-300">
                  {l.estado === "previsto" ? "—" : euros(l.comissao)}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-slate-400">
                  {l.previstoTrabalhos > 0 ? `${euros(l.previstoComissao)} (${l.previstoTrabalhos})` : "—"}
                </td>
                <td className="py-1.5 text-slate-400">{l.pagoEm ? dataCurta(l.pagoEm) : ""}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-600 font-semibold">
              <td className="py-1.5 pr-3 text-white">Total</td>
              <td />
              <td className="py-1.5 pr-3 text-right tabular-nums text-slate-200">{r.totais.trabalhos}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-slate-200">{euros(r.totais.lucro)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-emerald-300">{euros(r.totais.ganho)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-slate-300">{euros(r.totais.previsto)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Por mês</p>
          <table className="w-full text-left text-xs">
            <tbody>
              {r.porMes.map((m) => (
                <tr key={m.mes} className="border-t border-slate-800/80">
                  <td className="py-1.5 pr-3 text-slate-200">{m.rotulo}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-400">
                    {m.trabalhos} trab. · lucro {euros(m.lucro)}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-semibold tabular-nums text-emerald-300">{euros(m.comissao)}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-400">
                    {m.previsto > 0 ? `+ ${euros(m.previsto)} previsto` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-slate-500">Cada período conta no mês em que fecha — o primeiro ({diaEscrito(INICIO_DAS_COMISSOES)} a{" "}
            {diaEscrito(FIM_DO_PRIMEIRO_PERIODO)}) conta no mês em que acaba.</p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Por operador</p>
          {r.porOperador.length === 0 ? (
            <p className="text-[11px] text-slate-500">Ainda sem trabalhos que contem.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <tbody>
                {r.porOperador.map((o) => (
                  <tr key={o.operador} className="border-t border-slate-800/80">
                    <td className="py-1.5 pr-3 text-slate-200">{o.operador}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-slate-400">
                      {o.trabalhos} trab. · lucro {euros(o.lucro)}
                    </td>
                    <td className="py-1.5 text-right font-semibold tabular-nums text-emerald-300">{euros(o.comissao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-1 text-[10px] text-slate-500">
            Os trabalhos que já contam, por quem operou o pedido. A comissão é a parte de {nome} desse lucro.
          </p>
        </div>
      </div>

      <button
        onClick={descarregarRelatorio}
        className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
      >
        Descarregar relatório (CSV)
      </button>
    </div>
  );
}

/**
 * Corrigir o dia em que um trabalho ficou concluído — só no painel do
 * administrador, e só onde a data é uma estimativa (ou já foi corrigida).
 */
function CorrigirData({
  t,
  gerir,
}: {
  t: Trabalho;
  gerir: (corpo: AccaoDeGestao) => Promise<boolean>;
}) {
  const [aberto, setAberto] = useState(false);
  const [dia, setDia] = useState("");
  const [aGravar, setAGravar] = useState(false);
  if (!aberto) {
    return (
      <button
        onClick={() => {
          const d = t.concluidoEm ? new Date(t.concluidoEm) : null;
          setDia(d && !Number.isNaN(d.getTime()) ? diaEmLisboa(d) : "");
          setAberto(true);
        }}
        className="ml-1 text-[10px] text-cyan-300 underline decoration-cyan-700 underline-offset-2 hover:text-cyan-200"
      >
        corrigir data
      </button>
    );
  }
  return (
    <span className="mt-1 flex items-center gap-1">
      <input
        type="date"
        value={dia}
        max={diaEmLisboa(new Date())}
        onChange={(e) => setDia(e.target.value)}
        aria-label={`Dia em que o #${t.pedidoId} ficou concluído`}
        className="rounded border border-slate-600 bg-slate-950 px-1.5 py-0.5 text-xs text-white outline-none focus:border-cyan-500"
      />
      <button
        onClick={async () => {
          setAGravar(true);
          try {
            if (await gerir({ dataDoPedido: { pedidoId: t.pedidoId, dia } })) setAberto(false);
          } finally {
            setAGravar(false);
          }
        }}
        disabled={aGravar || !dia}
        className="rounded bg-acao px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
      >
        OK
      </button>
      <button onClick={() => setAberto(false)} className="text-[10px] text-slate-400 hover:text-slate-200">
        cancelar
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
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-1 pr-2">Pedido</th>
            <th className="py-1 pr-2">Cliente</th>
            <th className="py-1 pr-2">Profissional</th>
            <th className="py-1 pr-2">Operador</th>
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
                  {t.dataAproximada && (
                    <span
                      className="ml-1 text-amber-300"
                      title="Fechado à mão antes de 08/10: a data é a da última alteração ao pedido, e pode não ser o dia em que o trabalho se fez."
                    >
                      (data aproximada)
                    </span>
                  )}
                  {/* E nos fechados à mão também depois de corrigida: pode ter-se escolhido mal o dia. */}
                  {gerir &&
                    p.estado !== "pago" &&
                    (t.dataAproximada || t.fonteDoValor === "lucro_manual" || t.fonteDoValor === "falta_lucro") && (
                      <CorrigirData t={t} gerir={gerir} />
                    )}
                </span>
              </td>
              <td className="py-1.5 pr-2">{t.profissional ?? "—"}</td>
              <td className="py-1.5 pr-2">{t.operador ?? "—"}</td>
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
            <td className="py-1.5 pr-2" colSpan={4}>
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
  const podeGerir = gerir != null;
  const [d, setD] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [relatorioAberto, setRelatorioAberto] = useState(false);

  /*
   * O INTERVALO À ESCOLHA — 14-10-2026, «Gostaria de poder manipular as datas
   * em que quero o resumo.» Os campos mudam à vontade; só o «Ver resumo»
   * passa o intervalo ao pedido, e a partir daí cada recarga (pagar, escrever
   * um lucro, corrigir uma data) já o traz.
   */
  const [de, setDe] = useState(INICIO_DAS_COMISSOES);
  const [ate, setAte] = useState(() => diaEmLisboa(new Date()));
  const [intervalo, setIntervalo] = useState<{ de: string; ate: string } | null>(null);
  const endereco = intervalo
    ? `${fonte}${fonte.includes("?") ? "&" : "?"}de=${intervalo.de}&ate=${intervalo.ate}`
    : fonte;

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

  const resumo = d.resumo ?? null;
  const doResumo = resumo ? periodoDoResumo(resumo) : null;

  // As quinzenas por vir, e o que se espera na actual (17-10-2026).
  const previsao = d.previsao ?? [];
  const actual = d.periodos.find((p) => p.estado === "em_curso") ?? null;
  const futuras = previsao.filter((p) => !actual || p.inicio > actual.inicio);
  const previsaoDe = (inicio: string) => previsao.find((p) => p.inicio === inicio) ?? null;
  const relatorio = relatorioDasComissoes(d.periodos, previsao);
  const percentagem = d.comissaoPercent ?? d.periodos[0]?.comissaoPercent ?? 0;

  return (
    <div>
      {podeGerir && (
        <div className="mb-3 rounded-lg border border-slate-700/60 bg-slate-950/40 p-2.5">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Resumo entre datas</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[11px] text-slate-400">
              De
              <input
                type="date"
                value={de}
                max={ate}
                onChange={(e) => setDe(e.target.value)}
                className="mt-0.5 block rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white outline-none focus:border-cyan-500"
              />
            </label>
            <label className="text-[11px] text-slate-400">
              Até
              <input
                type="date"
                value={ate}
                min={de}
                onChange={(e) => setAte(e.target.value)}
                className="mt-0.5 block rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white outline-none focus:border-cyan-500"
              />
            </label>
            <button
              onClick={() => {
                setAberto(null);
                setIntervalo({ de, ate });
              }}
              disabled={!de || !ate || de > ate}
              className="rounded-lg bg-acao px-3 py-1.5 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
            >
              Ver resumo
            </button>
            {intervalo && (
              <button
                onClick={() => setIntervalo(null)}
                className="rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Fechar resumo
              </button>
            )}
          </div>

          {resumo && doResumo && (
            <div className="mt-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">{resumo.rotulo}</span>
                <span className="text-xs text-slate-400">
                  {resumo.trabalhos} trabalho{resumo.trabalhos === 1 ? "" : "s"} · valor {euros(resumo.valorTrabalhos)} ·
                  lucro {euros(resumo.lucro)}
                </span>
                <span className="ml-auto text-sm font-bold tabular-nums text-emerald-300">
                  {euros(resumo.comissaoAssistente)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {d.comissaoSobre === "todos" ? "Todos os trabalhos concluídos" : `Só os trabalhos de ${d.nome}`} neste
                intervalo, a {percent(resumo.comissaoPercent)} do lucro, com os valores de hoje. É uma consulta: os
                períodos pagos ficam como foram pagos.
                {resumo.emPeriodosPagos > 0 &&
                  ` ${resumo.emPeriodosPagos} destes trabalho${resumo.emPeriodosPagos === 1 ? " já está" : "s já estão"} num período pago.`}
              </p>
              {resumo.porOperador.length > 0 && (
                <p className="mt-1 text-[11px] text-slate-300">
                  Por operador:{" "}
                  {resumo.porOperador
                    .map((o) => `${o.operador} ${o.trabalhos} trabalho${o.trabalhos === 1 ? "" : "s"} (lucro ${euros(o.lucro)})`)
                    .join(" · ")}
                </p>
              )}
              {resumo.comDataAproximada > 0 && (
                <p className="mt-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                  {resumo.comDataAproximada} trabalho{resumo.comDataAproximada === 1 ? " tem" : "s têm"} a data
                  aproximada — fechados à mão antes de 08/10, ficaram com o dia da última alteração ao pedido. Confira-os
                  na lista e corrija o dia se não for esse.
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setAberto(aberto === "resumo" ? null : "resumo")}
                  className="flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  aria-expanded={aberto === "resumo"}
                >
                  {aberto === "resumo" ? (
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {aberto === "resumo" ? "Esconder" : "Ver"} trabalhos
                </button>
                <button
                  onClick={() => descarregar(doResumo)}
                  className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  CSV
                </button>
              </div>
              {aberto === "resumo" && (
                <div className="mt-2">
                  <TabelaDeTrabalhos nome={d.nome} p={doResumo} gerir={gerirERecarregar} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/*
        AS QUINZENAS POR VIR — 17-10-2026, «não só passados mas futuros». Cada
        uma com os trabalhos acordados que lá devem ficar concluídos. É uma
        previsão: não se paga, e muda com o que acontecer.
      */}
      {futuras.length > 0 && (
        <div className="mb-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Próximas quinzenas · previsão
          </p>
          <ul className="space-y-2">
            {futuras.map((p) => {
              const chave = `previsao-${p.inicio}`;
              return (
                <li key={chave} className="rounded-lg border border-dashed border-slate-600/70 bg-slate-950/20 p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200">{p.rotulo}</span>
                    <span className="rounded-full bg-slate-700/40 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                      previsão · fecha a {diaEscrito(p.fim)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {p.trabalhos} trabalho{p.trabalhos === 1 ? "" : "s"} marcado{p.trabalhos === 1 ? "" : "s"} · lucro previsto{" "}
                      {euros(p.lucro)}
                    </span>
                    <span className="ml-auto text-sm font-bold tabular-nums text-slate-300">≈ {euros(p.comissaoAssistente)}</span>
                  </div>
                  {p.semValor.length > 0 && (
                    <p className="mt-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                      Contam zero na previsão até ter o valor: {p.semValor.map((id) => `#${id}`).join(", ")}.
                    </p>
                  )}
                  {p.detalhe.length > 0 && (
                    <button
                      onClick={() => setAberto(aberto === chave ? null : chave)}
                      className="mt-2 flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                      aria-expanded={aberto === chave}
                    >
                      {aberto === chave ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
                      {aberto === chave ? "Esconder" : "Ver"} trabalhos
                    </button>
                  )}
                  {aberto === chave && (
                    <div className="mt-2">
                      <TabelaDaPrevisao p={p} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Períodos · desde {diaEscrito(INICIO_DAS_COMISSOES)}
      </p>
      {erro && <p className="mb-2 text-xs text-red-300">{erro}</p>}

      {d.periodos.length === 0 ? (
        <p className="text-xs text-slate-500">A contagem começa a {diaEscrito(INICIO_DAS_COMISSOES)}.</p>
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

                {/* O que se espera até ao fecho desta quinzena (17-10-2026). */}
                {p.estado === "em_curso" && (previsaoDe(p.inicio)?.trabalhos ?? 0) > 0 && (() => {
                  const prev = previsaoDe(p.inicio)!;
                  const chave = `previsao-${p.inicio}`;
                  return (
                    <div className="mt-1.5">
                      <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                        <span>
                          + previsto até {diaEscrito(p.fim)}: {prev.trabalhos} trabalho{prev.trabalhos === 1 ? "" : "s"} acordado
                          {prev.trabalhos === 1 ? "" : "s"} · lucro {euros(prev.lucro)} ·{" "}
                          <strong className="text-slate-300">≈ {euros(prev.comissaoAssistente)}</strong>
                        </span>
                        <button
                          onClick={() => setAberto(aberto === chave ? null : chave)}
                          className="text-cyan-300 underline decoration-cyan-700 underline-offset-2 hover:text-cyan-200"
                          aria-expanded={aberto === chave}
                        >
                          {aberto === chave ? "esconder" : "ver quais"}
                        </button>
                      </p>
                      {aberto === chave && (
                        <div className="mt-2">
                          <TabelaDaPrevisao p={prev} />
                        </div>
                      )}
                    </div>
                  );
                })()}

                {(semPreco.length > 0 || semLucro.length > 0) && (
                  <p className="mt-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                    Contam zero até se escrever{" "}
                    {[
                      semPreco.length > 0
                        ? `o preço ao cliente de ${semPreco.join(", ")} (${podeGerir ? "aqui em baixo, ou " : ""}em «Trabalhos CLYON»)`
                        : "",
                      semLucro.length > 0 ? `o lucro de ${semLucro.join(", ")} (na lista deste período)` : "",
                    ]
                      .filter(Boolean)
                      .join(" e ")}
                    {podeGerir ? " — e o período só se paga depois disso." : "."}
                  </p>
                )}
                {podeGerir && gerirERecarregar && semPreco.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {p.pendentes
                      .filter((x) => x.falta === "preco_ao_cliente")
                      .map((x) => (
                        <EscreverPreco key={x.pedidoId} pedidoId={x.pedidoId} gerir={gerirERecarregar} />
                      ))}
                  </div>
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

      {/*
        OS QUE AINDA NÃO CONTAM — 15-10-2026. *«Nem todos os pedidos estão
        aparecendo, como o da Clementina, pedido 422, e não sei porquê.»* Os
        períodos só têm pedidos concluídos, que é o que se paga. Estes têm
        profissional acordado e ainda não estão — cada um com a razão.
      */}
      {(d.aindaNaoContam?.length ?? 0) > 0 && (
        <div className="mt-3 rounded-lg border border-slate-700/60 bg-slate-950/40 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">Ainda não contam</span>
            <span className="text-xs text-slate-400">
              {d.aindaNaoContam!.length} pedido{d.aindaNaoContam!.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Têm profissional acordado, mas o pedido ainda não está concluído. Cada um entra no
            período do dia em que ficar concluído. Os cancelados, os arquivados e os de
            profissionais de teste não contam.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="py-1 pr-3 font-semibold">Pedido</th>
                  <th className="py-1 pr-3 font-semibold">Cliente</th>
                  <th className="py-1 pr-3 font-semibold">Profissional</th>
                  <th className="py-1 pr-3 font-semibold">Operador</th>
                  <th className="py-1 font-semibold">Porquê</th>
                </tr>
              </thead>
              <tbody>
                {d.aindaNaoContam!.map((t) => (
                  <tr key={t.pedidoId} className="border-t border-slate-800/80">
                    <td className="py-1.5 pr-3 font-semibold text-white">#{t.pedidoId}</td>
                    <td className="py-1.5 pr-3 text-slate-200">
                      {t.cliente ?? "—"}
                      <span className="block text-[10px] text-slate-500">
                        {[t.servico, t.cidade].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-slate-300">{t.profissional ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-slate-300">{t.operador}</td>
                    <td className={`py-1.5 ${COR_DO_MOTIVO[t.motivo]}`}>{t.porque}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* O RELATÓRIO GERAL — 17-10-2026. Ver `relatorio-das-comissoes.ts`. */}
      <div className="mt-3 rounded-lg border border-slate-700/60 bg-slate-950/40 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-white">Relatório geral</span>
          <span className="text-xs text-slate-400">
            ganho {euros(relatorio.totais.ganho)} · pago {euros(relatorio.totais.pago)} · por pagar{" "}
            {euros(relatorio.totais.porPagar)} · previsto {euros(relatorio.totais.previsto)}
          </span>
          <button
            onClick={() => setRelatorioAberto((v) => !v)}
            className="ml-auto flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
            aria-expanded={relatorioAberto}
          >
            {relatorioAberto ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
            {relatorioAberto ? "Esconder" : "Ver"} relatório
          </button>
        </div>
        {relatorioAberto && <RelatorioGeral nome={d.nome} percentagem={percentagem} r={relatorio} />}
      </div>
    </div>
  );
}
