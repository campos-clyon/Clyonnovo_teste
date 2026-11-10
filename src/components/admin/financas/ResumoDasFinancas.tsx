"use client";

import { useMemo, useState } from "react";
import {
  balancoDosUltimosMeses,
  contasDoMes,
  parteDaSociaNoMes,
  previsaoAnual,
  CANAIS,
  type Canal,
  type ContasDoMes,
  type DadosDasContas,
  type PeriodoDaSocia,
} from "@/lib/financas-do-mes";
import { totalMensalDosRecorrentes } from "@/lib/financas-gastos";
import { emEuros, mesCurto, mesDoDia, nomeDoMes, somarMeses } from "@/lib/financas";

/**
 * O RESUMO DO MÊS DAS FINANÇAS — 07-11-2026 (d21, dono).
 *
 * *«Quero que ela mostre os lucros e os valores bruto, líquidos, quanto
 * entrou, por onde […] os valores pagos aos assistentes, o balanço do mês e a
 * previsão anual.»*
 *
 * Os cartões do mês (cada um abre o detalhe por baixo), quanto entrou e por
 * onde, o balanço ao lado do mês anterior e a previsão do ano, com o real e o
 * previsto sempre separados. As contas estão em `financas-do-mes.ts`; aqui só
 * se desenham. As contas de teste nunca chegam cá.
 */

type Detalhe = "bruto" | "iva" | "profissionais" | "receita" | "gastos" | "assistentes" | "lucro" | "socia";

const NOME_DO_CANAL: Record<Canal, string> = {
  mbway: "MB WAY",
  multibanco: "Multibanco (euPago)",
  transferencia: "Transferência",
  numerario: "Numerário recebido pela CLYON",
  outro: "Outro método",
};

const NOME_DO_METODO: Record<string, string> = {
  mbway: "MB WAY",
  multibanco: "Multibanco",
  transferencia: "Transferência",
  numerario: "Numerário",
  pro_mbway: "MB WAY (do profissional)",
  pro_transferencia: "Transferência (do profissional)",
  pro_numerario: "Numerário (do profissional)",
  ao_profissional: "Pago em mão ao profissional",
  abatimento: "Abatido no saldo",
  quitacao: "Quitado no acerto",
};

/** «2026-11-07» → «7/11». */
const diaCurto = (dia: string) => `${Number(dia.slice(8, 10))}/${dia.slice(5, 7)}`;

export type DadosDoResumo = DadosDasContas & {
  socia: PeriodoDaSocia[] | null;
  eAdmin: boolean;
  /** Não se conseguiu ler os pagamentos: os números da plataforma ficam a zero, e diz-se. */
  semEntradas: boolean;
};

export default function ResumoDasFinancas({
  dados,
  mes,
  hoje,
  onVerGastos,
}: {
  dados: DadosDoResumo;
  mes: string;
  hoje: string;
  onVerGastos: () => void;
}) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const c = useMemo(() => contasDoMes(dados, mes), [dados, mes]);
  const anterior = useMemo(() => contasDoMes(dados, somarMeses(mes, -1)), [dados, mes]);
  const socia = parteDaSociaNoMes(dados.eAdmin ? dados.socia : null, mes);
  const mesDeHoje = mesDoDia(hoje);

  const cartoes: Array<{ id: Detalhe; rotulo: string; valor: number | null; nota: string; cor?: string }> = [
    { id: "bruto", rotulo: "Bruto", valor: c.bruto, nota: "o que entrou na CLYON, com IVA" },
    { id: "iva", rotulo: "IVA", valor: c.iva, nota: "vai para a empresa parceira que fatura" },
    { id: "profissionais", rotulo: "Pago aos profissionais", valor: c.pagoAosProfissionais, nota: "o que saiu para eles neste mês" },
    { id: "receita", rotulo: "Receita da CLYON", valor: c.receita.total, nota: "taxas da plataforma, sem IVA" },
    { id: "gastos", rotulo: "Gastos", valor: c.gastos.total, nota: "fixos, ocasionais e os lançados à mão" },
    {
      id: "assistentes",
      rotulo: "Pago aos assistentes",
      valor: c.assistentes,
      nota: dados.eAdmin ? "períodos marcados como pagos" : "só o administrador vê",
    },
    {
      id: "lucro",
      rotulo: "Lucro líquido",
      valor: c.lucro,
      nota: dados.eAdmin ? "receita − gastos − assistentes" : "receita − gastos (sem os assistentes)",
      cor: c.lucro < 0 ? "text-coral-texto" : "text-esmeralda-texto",
    },
    {
      id: "socia",
      rotulo: "A parte da sócia",
      valor: socia.ha ? socia.comissao : null,
      nota: socia.ha ? `${socia.percentagem} % do lucro dos períodos que fecham no mês` : porqueSemSocia(socia.porque),
    },
  ];

  return (
    <div className="space-y-6">
      {dados.semEntradas && (
        <p className="rounded-lg border border-ambar/40 bg-ambar/10 px-3 py-2 text-sm text-ambar-texto">
          Não foi possível ler os pagamentos da plataforma agora: o bruto, o IVA e a receita estão a zero. Actualize daqui a pouco.
        </p>
      )}

      <section aria-label="Resumo do mês">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cartoes.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setDetalhe(detalhe === k.id ? null : k.id)}
              aria-expanded={detalhe === k.id}
              className={`rounded-2xl border p-4 text-left transition ${
                detalhe === k.id ? "border-cyan-500/60 bg-slate-900" : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
              }`}
            >
              <span className="block text-sm text-slate-400">{k.rotulo}</span>
              <span className={`mt-1 block text-xl font-bold tabular-nums ${k.cor ?? "text-white"}`}>
                {k.valor == null ? "—" : emEuros(k.valor)}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{k.nota}</span>
            </button>
          ))}
        </div>
        {detalhe && (
          <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <DetalheDoCartao qual={detalhe} c={c} socia={socia} eAdmin={dados.eAdmin} onVerGastos={onVerGastos} />
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <PorOnde c={c} />
        <Balanco c={c} anterior={anterior} dados={dados} mes={mes} eAdmin={dados.eAdmin} />
      </div>

      <Previsao dados={dados} ano={Number(mes.slice(0, 4))} mesDeHoje={mesDeHoje} recorrentes={totalMensalDosRecorrentes(dados.gastos, mesDeHoje)} />
    </div>
  );
}

function porqueSemSocia(p: "sem_acesso" | "sem_socia" | "sem_periodo"): string {
  if (p === "sem_acesso") return "só o administrador vê";
  if (p === "sem_socia") return "nenhuma conta de assistente ganha sobre todos os trabalhos";
  return "nenhum período fecha neste mês";
}

const linha = "flex items-baseline justify-between gap-3 py-1.5 text-sm";
const rotulo = "text-slate-300";
const numero = "tabular-nums font-semibold text-white";

function Linha({ r, v, forte = false, cor }: { r: string; v: number; forte?: boolean; cor?: string }) {
  return (
    <div className={`${linha} ${forte ? "border-t border-slate-800 pt-2" : ""}`}>
      <span className={forte ? "font-semibold text-slate-100" : rotulo}>{r}</span>
      <span className={`${numero} ${cor ?? ""}`}>{emEuros(v)}</span>
    </div>
  );
}

function DetalheDoCartao({
  qual,
  c,
  socia,
  eAdmin,
  onVerGastos,
}: {
  qual: Detalhe;
  c: ContasDoMes;
  socia: ReturnType<typeof parteDaSociaNoMes>;
  eAdmin: boolean;
  onVerGastos: () => void;
}) {
  const entradas = c.entradas.filter((e) => e.entraNaClyon).sort((a, b) => b.pedidoId - a.pedidoId);
  const titulo = (t: string) => <h3 className="mb-2 text-sm font-semibold text-slate-100">{t}</h3>;

  if (qual === "bruto" || qual === "iva" || qual === "receita") {
    const coluna = qual === "bruto" ? "valor" : qual === "iva" ? "iva" : "receita";
    return (
      <div>
        {titulo(qual === "bruto" ? "Bruto — o que entrou na CLYON" : qual === "iva" ? "IVA — para a empresa parceira" : "Receita da CLYON")}
        {qual === "bruto" && (
          <>
            <Linha r="IVA" v={c.iva} />
            <Linha r="Taxas da plataforma (sem IVA)" v={c.receita.taxas} />
            <Linha r="Parte dos profissionais (a CLYON paga-lha depois)" v={c.parteDosProfissionais} />
            {c.semConta.n > 0 && <Linha r={`Por separar (${c.semConta.n} sem a conta do trabalho)`} v={c.semConta.valor} />}
            <Linha r="Bruto" v={c.bruto} forte />
            {c.pagoPelosProfissionais.n > 0 && (
              <p className="mt-2 text-xs text-slate-400">
                Do bruto, {emEuros(c.pagoPelosProfissionais.valor)} foram pagos pelos profissionais: a parte da CLYON de{" "}
                {c.pagoPelosProfissionais.n} trabalho(s) que o cliente lhes pagou em mão.
              </p>
            )}
          </>
        )}
        {qual === "iva" && (
          <p className="mb-2 text-xs text-slate-400">
            O IVA que os clientes pagaram não fica na CLYON: vai para a empresa parceira que emite a fatura.
          </p>
        )}
        {qual === "receita" && (
          <>
            <Linha r="Taxas da plataforma (sem IVA)" v={c.receita.taxas} />
            <Linha r="Receitas lançadas à mão nas Transações" v={c.receita.lancadas} />
            <Linha r="Receita da CLYON" v={c.receita.total} forte />
          </>
        )}
        {c.semConta.n > 0 && qual !== "bruto" && (
          <p className="mt-2 text-xs text-ambar-texto">
            {c.semConta.n} pagamento(s), {emEuros(c.semConta.valor)}, sem a conta do trabalho: entram no bruto, e não se separam aqui.
          </p>
        )}
        <ListaDeEntradas entradas={entradas} coluna={coluna} />
      </div>
    );
  }

  if (qual === "profissionais") {
    return (
      <div>
        {titulo("Pago aos profissionais")}
        <p className="mb-2 text-xs text-slate-400">
          As transferências e os levantamentos pagos neste mês. Os trabalhos pagos em mão ao profissional não contam: o dinheiro
          não passou pela CLYON.
        </p>
        <Linha r="Saiu para os profissionais" v={c.pagoAosProfissionais} forte />
        <Linha r="Parte deles que entrou com os pagamentos do mês" v={c.parteDosProfissionais} />
      </div>
    );
  }

  if (qual === "gastos") {
    return (
      <div>
        {titulo("Gastos do mês")}
        <Linha r="Recorrentes" v={c.gastos.recorrentes} />
        <Linha r="Ocasionais" v={c.gastos.ocasionais} />
        <Linha r="Despesas lançadas à mão nas Transações" v={c.gastos.lancadas} />
        <Linha r="Comissões do euPago" v={c.gastos.eupago} />
        <Linha r="Gastos" v={c.gastos.total} forte />
        {c.gastos.linhas.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-800 text-sm">
            {c.gastos.linhas.map((g) => (
              <li key={g.id} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="text-slate-300">
                  {g.nome} <span className="text-[11px] text-slate-500">{g.tipo === "recorrente" ? "recorrente" : "ocasional"}</span>
                </span>
                <span className={numero}>{emEuros(g.valor)}</span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={onVerGastos} className="mt-3 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
          Ver e mudar os gastos
        </button>
      </div>
    );
  }

  if (qual === "assistentes") {
    if (!eAdmin) return <p className="text-sm text-slate-400">O que se paga aos assistentes só o administrador vê.</p>;
    return (
      <div>
        {titulo("Pago aos assistentes")}
        {c.pagamentosAosAssistentes.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum período de assistente foi marcado como pago neste mês.</p>
        ) : (
          <ul className="divide-y divide-slate-800 text-sm">
            {c.pagamentosAosAssistentes.map((a, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="text-slate-300">
                  {a.nome} <span className="text-[11px] text-slate-500">período {a.periodo}, pago a {diaCurto(a.dia)}</span>
                </span>
                <span className={numero}>{emEuros(a.valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (qual === "lucro") {
    return (
      <div>
        {titulo("Lucro líquido")}
        <Linha r="Receita da CLYON" v={c.receita.total} />
        <Linha r="− Gastos" v={c.gastos.total} />
        {eAdmin && <Linha r="− Pago aos assistentes" v={c.assistentes ?? 0} />}
        <Linha r="Lucro líquido" v={c.lucro} forte cor={c.lucro < 0 ? "text-coral-texto" : "text-esmeralda-texto"} />
        {!eAdmin && <p className="mt-2 text-xs text-slate-400">Sem o que se paga aos assistentes, que só o administrador vê.</p>}
      </div>
    );
  }

  // A sócia.
  if (!socia.ha) {
    const porque =
      socia.porque === "sem_acesso"
        ? "As contas dos assistentes só o administrador as vê."
        : socia.porque === "sem_socia"
          ? "Nenhuma conta de assistente está a ganhar sobre todos os trabalhos (Assistentes › Gerir › «Todos os trabalhos»)."
          : "Nenhum período da sócia fecha neste mês: cada período conta no mês em que acaba, como no relatório dos Assistentes.";
    return (
      <div>
        {titulo("A parte da sócia")}
        <p className="text-sm text-slate-400">{porque}</p>
      </div>
    );
  }
  return (
    <div>
      {titulo(`A parte da sócia — ${socia.nome}`)}
      <p className="mb-2 text-xs text-slate-400">
        Como os Assistentes a calculam: a parte dela ({socia.percentagem} %) do lucro dos trabalhos concluídos — o que a CLYON
        ficou, sem IVA e sem descontar gastos —, nos períodos que acabam neste mês. Quando se paga, entra em «Pago aos assistentes».
      </p>
      <Linha r="Lucro dos períodos" v={socia.lucro} />
      <Linha r="Já paga" v={socia.pago} />
      <Linha r="Por pagar" v={socia.porPagar} />
      <Linha r="Em curso" v={socia.emCurso} />
      <Linha r="A parte da sócia" v={socia.comissao} forte />
      {socia.pendentes > 0 && (
        <p className="mt-2 text-xs text-ambar-texto">
          {socia.pendentes} trabalho(s) sem o preço ao cliente ou sem o lucro escrito: contam zero até se escrever nos Assistentes.
        </p>
      )}
      <ul className="mt-3 divide-y divide-slate-800 text-sm">
        {socia.periodos.map((p) => (
          <li key={p.inicio} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="text-slate-300">
              {p.rotulo}{" "}
              <span className="text-[11px] text-slate-500">{p.estado === "pago" ? "pago" : p.estado === "por_pagar" ? "por pagar" : "em curso"}</span>
            </span>
            <span className={numero}>{emEuros(p.comissao)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListaDeEntradas({
  entradas,
  coluna,
}: {
  entradas: ContasDoMes["entradas"];
  coluna: "valor" | "iva" | "receita";
}) {
  if (entradas.length === 0) return <p className="mt-3 text-sm text-slate-400">Nenhum pagamento entrou na CLYON neste mês.</p>;
  return (
    <div className="mt-3 max-h-80 overflow-y-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
            <th className="py-1 font-semibold">Pedido</th>
            <th className="py-1 font-semibold">Dia</th>
            <th className="py-1 font-semibold">Como</th>
            <th className="py-1 text-right font-semibold">{coluna === "valor" ? "Valor" : coluna === "iva" ? "IVA" : "Taxas"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {entradas.map((e) => (
            <tr key={e.id}>
              <td className="py-1.5 text-slate-200">#{e.pedidoId}</td>
              <td className="py-1.5 text-slate-400">{diaCurto(e.dia)}</td>
              <td className="py-1.5 text-slate-400">
                {NOME_DO_METODO[e.metodo] ?? e.metodo}
                {e.semConta && <span className="ml-1 text-[11px] text-ambar-texto">sem conta</span>}
              </td>
              <td className="py-1.5 text-right tabular-nums text-white">{emEuros(e[coluna])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PorOnde({ c }: { c: ContasDoMes }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-sm font-semibold text-slate-200">Quanto entrou e por onde</h3>
      <div className="mt-2 divide-y divide-slate-800">
        {CANAIS.filter((k) => k !== "outro" || c.porOnde.outro.n > 0).map((k) => (
          <div key={k} className={linha}>
            <span className={rotulo}>
              {NOME_DO_CANAL[k]} <span className="text-[11px] text-slate-500">{c.porOnde[k].n}</span>
            </span>
            <span className={numero}>{emEuros(c.porOnde[k].valor)}</span>
          </div>
        ))}
        <Linha r="Entrou na CLYON" v={c.bruto} forte />
      </div>
      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Não entrou na CLYON</h4>
      <div className="mt-1 divide-y divide-slate-800">
        <div className={linha}>
          <span className={rotulo}>
            Pagos em mão ao profissional <span className="text-[11px] text-slate-500">{c.naoEntrou.emMao.n}</span>
          </span>
          <span className="tabular-nums text-slate-400">{emEuros(c.naoEntrou.emMao.valor)}</span>
        </div>
        {c.naoEntrou.acertos.n > 0 && (
          <div className={linha}>
            <span className={rotulo}>
              Acertos no saldo do profissional (sem dinheiro) <span className="text-[11px] text-slate-500">{c.naoEntrou.acertos.n}</span>
            </span>
            <span className="tabular-nums text-slate-400">{emEuros(c.naoEntrou.acertos.valor)}</span>
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Os combinados em dinheiro não têm linha nos Pagamentos: aparecem aqui só quando o profissional paga a parte da CLYON.
      </p>
    </section>
  );
}

function Balanco({
  c,
  anterior,
  dados,
  mes,
  eAdmin,
}: {
  c: ContasDoMes;
  anterior: ContasDoMes;
  dados: DadosDasContas;
  mes: string;
  eAdmin: boolean;
}) {
  const meses = balancoDosUltimosMeses(dados, mes, 6);
  const maior = Math.max(1, ...meses.flatMap((m) => [m.entradas, m.gastos + m.assistentes]));
  const linhas: Array<{ r: string; a: number; b: number }> = [
    { r: "Entradas da CLYON (receita)", a: c.receita.total, b: anterior.receita.total },
    { r: "Gastos", a: c.gastos.total, b: anterior.gastos.total },
    ...(eAdmin ? [{ r: "Pago aos assistentes", a: c.assistentes ?? 0, b: anterior.assistentes ?? 0 }] : []),
  ];
  const bal = (x: ContasDoMes) => x.lucro;
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-sm font-semibold text-slate-200">Balanço do mês</h3>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-slate-500">
            <th className="py-1 text-left font-semibold" />
            <th className="py-1 text-right font-semibold">{mesCurto(somarMeses(mes, -1))}</th>
            <th className="py-1 text-right font-semibold text-slate-300">{mesCurto(mes)}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {linhas.map((l) => (
            <tr key={l.r}>
              <td className="py-1.5 text-slate-300">{l.r}</td>
              <td className="py-1.5 text-right tabular-nums text-slate-400">{emEuros(l.b)}</td>
              <td className="py-1.5 text-right tabular-nums text-white">{emEuros(l.a)}</td>
            </tr>
          ))}
          <tr>
            <td className="py-2 font-semibold text-slate-100">Balanço</td>
            <td className={`py-2 text-right font-semibold tabular-nums ${bal(anterior) < 0 ? "text-coral-texto" : "text-slate-300"}`}>
              {emEuros(bal(anterior))}
            </td>
            <td className={`py-2 text-right font-bold tabular-nums ${bal(c) < 0 ? "text-coral-texto" : "text-esmeralda-texto"}`}>
              {emEuros(bal(c))}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="mt-4 flex h-28 items-end gap-3" role="img" aria-label="Entradas e saídas dos últimos seis meses">
        {meses.map((m) => (
          <div key={m.mes} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="flex h-full w-full items-end justify-center gap-1">
              <span
                title={`Entradas: ${emEuros(m.entradas)}`}
                className="w-1/3 max-w-4 rounded-t bg-esmeralda"
                style={{ height: `${(m.entradas / maior) * 100}%`, minHeight: m.entradas > 0 ? 3 : 0 }}
              />
              <span
                title={`Saídas: ${emEuros(m.gastos + m.assistentes)}`}
                className="w-1/3 max-w-4 rounded-t bg-coral"
                style={{ height: `${((m.gastos + m.assistentes) / maior) * 100}%`, minHeight: m.gastos + m.assistentes > 0 ? 3 : 0 }}
              />
            </div>
            <span className={`text-[11px] ${m.mes === mes ? "font-semibold text-slate-200" : "text-slate-500"}`}>{mesCurto(m.mes)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 flex gap-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-esmeralda" aria-hidden="true" /> Entradas
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-coral" aria-hidden="true" /> Saídas (gastos{eAdmin ? " e assistentes" : ""})
        </span>
      </p>
    </section>
  );
}

function Previsao({
  dados,
  ano,
  mesDeHoje,
  recorrentes,
}: {
  dados: DadosDasContas;
  ano: number;
  mesDeHoje: string;
  recorrentes: number;
}) {
  const p = previsaoAnual(dados, ano, mesDeHoje);
  const ESTADO = { real: "Real", em_curso: "Em curso", previsto: "Previsão" } as const;
  const temPrevisao = p.meses.some((m) => m.estado === "previsto");
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-sm font-semibold text-slate-200">Previsão de {ano}</h3>
      <p className="mt-1 text-xs text-slate-400">
        Os meses que já passaram com os valores reais; o mês de hoje, real até hoje.
        {temPrevisao &&
          ` Os que faltam são previsão: a receita média dos últimos três meses (${emEuros(p.receitaMedia)}), os gastos recorrentes activos (hoje ${emEuros(recorrentes)} por mês) e os ocasionais com data marcada${dados.assistentes ? `, e a média do que se pagou aos assistentes (${emEuros(p.assistentesMedia)})` : ""}.`}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-slate-500">
              <th className="py-1 text-left font-semibold">Mês</th>
              <th className="py-1 text-left font-semibold" />
              <th className="py-1 text-right font-semibold">Receita</th>
              <th className="py-1 text-right font-semibold">Gastos</th>
              {dados.assistentes && <th className="py-1 text-right font-semibold">Assistentes</th>}
              <th className="py-1 text-right font-semibold">Lucro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {p.meses.map((m) => {
              const previsto = m.estado === "previsto";
              const cor = previsto ? "text-slate-400 italic" : "text-white";
              return (
                <tr key={m.mes}>
                  <td className="py-1.5 text-slate-300">{nomeDoMes(m.mes).split(" de ")[0]}</td>
                  <td className="py-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        previsto ? "bg-slate-800 text-slate-400" : m.estado === "em_curso" ? "bg-ambar/15 text-ambar-texto" : "bg-esmeralda/15 text-esmeralda-texto"
                      }`}
                    >
                      {ESTADO[m.estado]}
                    </span>
                  </td>
                  <td className={`py-1.5 text-right tabular-nums ${cor}`}>{emEuros(m.receita)}</td>
                  <td className={`py-1.5 text-right tabular-nums ${cor}`}>{emEuros(m.gastos)}</td>
                  {dados.assistentes && <td className={`py-1.5 text-right tabular-nums ${cor}`}>{emEuros(m.assistentes)}</td>}
                  <td className={`py-1.5 text-right font-semibold tabular-nums ${m.lucro < 0 ? "text-coral-texto" : previsto ? "text-slate-300" : "text-esmeralda-texto"}`}>
                    {emEuros(m.lucro)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-slate-700 text-sm">
            {[
              { r: "Real até agora", t: p.real },
              ...(temPrevisao ? [{ r: "Previsão do resto do ano", t: p.previsto }] : []),
              { r: temPrevisao ? `${ano}, real + previsão` : `${ano}`, t: p.total },
            ].map((x) => (
              <tr key={x.r}>
                <td className="py-1.5 font-semibold text-slate-200" colSpan={2}>
                  {x.r}
                </td>
                <td className="py-1.5 text-right tabular-nums text-white">{emEuros(x.t.receita)}</td>
                <td className="py-1.5 text-right tabular-nums text-white">{emEuros(x.t.gastos)}</td>
                {dados.assistentes && <td className="py-1.5 text-right tabular-nums text-white">{emEuros(x.t.assistentes)}</td>}
                <td className={`py-1.5 text-right font-bold tabular-nums ${x.t.lucro < 0 ? "text-coral-texto" : "text-esmeralda-texto"}`}>
                  {emEuros(x.t.lucro)}
                </td>
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </section>
  );
}
