"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, CheckCircle2, Clock, EyeOff, Paperclip, Pencil, Search, Zap } from "lucide-react";
import {
  diaPorExtenso,
  diasDoMes,
  emEuros,
  mesDoDia,
  ondeSeMexe,
  resumoDoMes,
  type Categoria,
  type Conta,
  type Movimento,
  type TipoDeMovimento,
} from "@/lib/financas";
import { BolaDaCategoria, CLASSES_DA_COR } from "./aparencia";

export type FiltroDoTipo = "todas" | TipoDeMovimento;

/** «Terça-feira, 13 de outubro» — só a primeira letra; o `capitalize` do CSS punha «De Outubro». */
const comMaiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const FILTROS: Array<{ id: FiltroDoTipo; rotulo: string }> = [
  { id: "todas", rotulo: "Todas" },
  { id: "despesa", rotulo: "Despesas" },
  { id: "receita", rotulo: "Receitas" },
  { id: "transferencia", rotulo: "Transferências" },
];

/**
 * AS TRANSAÇÕES DO MÊS — a lista do Mobills: por dia, do mais recente para o
 * mais antigo, cada dia com o saldo com que acabou.
 *
 * Os movimentos da plataforma aparecem com um raio e não se editam aqui: têm
 * dono, nos Pagamentos ou nos Levantamentos, e é lá que se corrigem.
 */
export default function ListaDeTransacoes({
  contas,
  categorias,
  movimentos,
  mes,
  filtro,
  onFiltro,
  onEditar,
}: {
  contas: Conta[];
  categorias: Categoria[];
  movimentos: Movimento[];
  mes: string;
  filtro: FiltroDoTipo;
  onFiltro: (f: FiltroDoTipo) => void;
  onEditar: (m: Movimento) => void;
}) {
  const [contaId, setContaId] = useState<number | null>(null);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [procura, setProcura] = useState("");

  const porConta = useMemo(() => new Map(contas.map((c) => [c.id, c])), [contas]);
  const porCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  const procurado = procura.trim().toLowerCase();
  const vistos = movimentos.filter((m) => {
    if (mesDoDia(m.dia) !== mes) return false;
    if (filtro !== "todas" && m.tipo !== filtro) return false;
    if (contaId != null && m.contaId !== contaId && m.contaDestinoId !== contaId) return false;
    if (categoriaId != null && m.categoriaId !== categoriaId) return false;
    if (procurado) {
      const onde = [m.descricao, m.notas, porCategoria.get(m.categoriaId ?? -1)?.nome].join(" ").toLowerCase();
      if (!onde.includes(procurado)) return false;
    }
    return true;
  });
  const dias = diasDoMes(contas, movimentos, vistos, mes, contaId);
  const resumo = resumoDoMes(vistos, mes);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Que transações" className="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filtro === f.id}
              onClick={() => onFiltro(f.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filtro === f.id ? "bg-cyan-500/15 text-cyan-200" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
        <select
          value={contaId ?? ""}
          onChange={(e) => setContaId(e.target.value ? Number(e.target.value) : null)}
          aria-label="Conta"
          className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 text-xs text-slate-200"
        >
          <option value="">Todas as contas</option>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <select
          value={categoriaId ?? ""}
          onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : null)}
          aria-label="Categoria"
          className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 text-xs text-slate-200"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.tipo === "despesa" ? "−" : "+"} {c.nome}
            </option>
          ))}
        </select>
        <label className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2">
          <Search className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          <input
            value={procura}
            onChange={(e) => setProcura(e.target.value)}
            placeholder="Procurar descrição ou nota"
            className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-500"
          />
        </label>
      </div>

      <p className="text-xs text-slate-400">
        Neste mês, com estes filtros: <span className="text-esmeralda-texto">{emEuros(resumo.receitas)} de receitas</span>
        {" · "}
        <span className="text-coral-texto">{emEuros(resumo.despesas)} de despesas</span>
        {resumo.receitasPrevistas + resumo.despesasPrevistas > 0 && (
          <span className="text-slate-500">
            {" · "}por acontecer: {emEuros(resumo.receitasPrevistas)} a receber e {emEuros(resumo.despesasPrevistas)} a pagar
          </span>
        )}
      </p>

      {dias.length === 0 ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-10 text-center text-sm text-slate-400">
          Nada neste mês{filtro !== "todas" || contaId != null || categoriaId != null || procurado ? " com estes filtros" : ""}.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
          {dias.map((d) => (
            <section key={d.dia} className="border-b border-slate-800 last:border-b-0">
              <h3 className="bg-slate-950/40 px-4 py-2 text-xs font-semibold text-slate-400">{comMaiuscula(diaPorExtenso(d.dia))}</h3>
              <ul className="divide-y divide-slate-800/70">
                {d.movimentos.map((m) => (
                  <Linha
                    key={m.id}
                    m={m}
                    conta={porConta.get(m.contaId) ?? null}
                    destino={m.contaDestinoId != null ? (porConta.get(m.contaDestinoId) ?? null) : null}
                    categoria={m.categoriaId != null ? (porCategoria.get(m.categoriaId) ?? null) : null}
                    onEditar={() => onEditar(m)}
                  />
                ))}
              </ul>
              <p className="flex justify-center px-4 pb-3 pt-1">
                <span className="rounded-full bg-slate-800/80 px-3 py-1 text-[11px] text-slate-300">
                  Saldo do fim do dia{contaId != null ? ` (${porConta.get(contaId)?.nome ?? "conta"})` : ""}{" "}
                  <strong className="tabular-nums text-white">{emEuros(d.saldoNoFimDoDia)}</strong>
                </span>
              </p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Linha({
  m,
  conta,
  destino,
  categoria,
  onEditar,
}: {
  m: Movimento;
  conta: Conta | null;
  destino: Conta | null;
  categoria: Categoria | null;
  onEditar: () => void;
}) {
  const automatico = m.automatico != null;
  const sinal = m.tipo === "despesa" ? "−" : m.tipo === "receita" ? "+" : "";
  const corDoValor = m.ignorado
    ? "text-slate-500 line-through"
    : m.tipo === "despesa"
      ? "text-coral-texto"
      : m.tipo === "receita"
        ? "text-esmeralda-texto"
        : "text-slate-200";
  const titulo =
    m.descricao ||
    (m.tipo === "transferencia" ? `Transferência para ${destino?.nome ?? "outra conta"}` : (categoria?.nome ?? "Sem descrição"));

  const nomeDaConta =
    m.tipo === "transferencia" ? `${conta?.nome ?? "?"} → ${destino?.nome ?? "?"}` : (conta?.nome ?? "?");
  const daCategoria =
    m.tipo === "transferencia" ? (
      <>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-300" aria-hidden="true">
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </span>
        <span className="truncate text-xs text-slate-300">Transferência</span>
      </>
    ) : categoria ? (
      <>
        <BolaDaCategoria cor={categoria.cor} icone={categoria.icone} />
        <span className="truncate text-xs text-slate-300">{categoria.nome}</span>
      </>
    ) : (
      <span className="text-xs text-slate-500">Sem categoria</span>
    );

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        title={m.ignorado ? "Ignorada — não conta" : m.efectivado ? (m.tipo === "despesa" ? "Paga" : m.tipo === "receita" ? "Recebida" : "Feita") : "Por acontecer"}
        className="shrink-0"
      >
        {m.ignorado ? (
          <EyeOff className="h-5 w-5 text-slate-500" aria-label="Ignorada" />
        ) : m.efectivado ? (
          <CheckCircle2 className="h-5 w-5 text-esmeralda" aria-label="Feita" />
        ) : (
          <Clock className="h-5 w-5 text-ambar" aria-label="Por acontecer" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <span className="truncate text-sm text-slate-100">{titulo}</span>
          {m.anexo && (
            <a href={m.anexo.url} target="_blank" rel="noopener noreferrer" title={m.anexo.nome} className="shrink-0 text-slate-400 hover:text-slate-200">
              <Paperclip className="h-3.5 w-3.5" aria-label={`Anexo: ${m.anexo.nome}`} />
            </a>
          )}
        </p>
        {(m.notas || automatico) && (
          <p className="truncate text-[11px] text-slate-500">
            {automatico ? (
              <span className="inline-flex items-center gap-1 text-cyan-300/80">
                <Zap className="h-3 w-3" aria-hidden="true" />
                Da plataforma · muda-se em {ondeSeMexe(m.automatico!)}
              </span>
            ) : (
              m.notas
            )}
          </p>
        )}
        {/*
          No telemóvel a categoria e a conta vêm por baixo, em texto e com um
          ponto da cor — a bolinha com o ícone comia metade da linha e deixava
          «Salá…» e «Ba…». Num ecrã largo têm coluna.
        */}
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-400 md:hidden">
          <span
            aria-hidden="true"
            className={`h-2 w-2 shrink-0 rounded-full ${categoria ? CLASSES_DA_COR[categoria.cor].ponto : "bg-slate-600"}`}
          />
          <span className="truncate">
            {m.tipo === "transferencia" ? "Transferência" : (categoria?.nome ?? "Sem categoria")} · {nomeDaConta}
          </span>
        </p>
      </div>

      <div className="hidden w-48 min-w-0 items-center gap-2 md:flex">{daCategoria}</div>
      <div className="hidden w-32 truncate text-xs text-slate-400 md:block">{nomeDaConta}</div>

      <span className={`shrink-0 text-right text-sm font-semibold tabular-nums md:w-28 ${corDoValor}`}>
        {sinal}
        {emEuros(m.valor)}
      </span>

      <span className="flex w-8 shrink-0 justify-end">
        {!automatico && (
          <button
            type="button"
            onClick={onEditar}
            aria-label={`Editar ${titulo}`}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </span>
    </li>
  );
}
