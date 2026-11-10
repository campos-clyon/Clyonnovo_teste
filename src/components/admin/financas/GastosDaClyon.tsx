"use client";

import { useState } from "react";
import { Loader2, Pause, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { emEuros, lerEuros, mesDoDia, nomeDoMes, somarMeses, type Categoria } from "@/lib/financas";
import {
  contaNoMes,
  estaSuspenso,
  pausaAberta,
  totalMensalDosRecorrentes,
  type Gasto,
  type TipoDeGasto,
} from "@/lib/financas-gastos";
import { BolaDaCategoria } from "./aparencia";

/**
 * OS GASTOS DA CLYON — 07-11-2026 (d21, dono).
 *
 * *«Todos devem poder ser editados, e até suspensos ou eliminados, e criar
 * novos. […] Na hora de criar, esses valores devem ter a opção de escolher se
 * são recorrentes ou ocasionais.»*
 *
 * A lista começa vazia: os valores são do negócio e metem-se aqui, no ecrã.
 * Criar, mudar, suspender e reactivar é de quem tem a secção; eliminar é do
 * administrador, e pede confirmação. As regras estão em `financas-gastos.ts`.
 */

type Formulario = {
  id?: number;
  nome: string;
  valor: string;
  tipo: TipoDeGasto | null;
  inicio: string;
  dia: string;
  categoriaId: string;
  notas: string;
};

/** «2026-11-07» → «7 de novembro de 2026», sem passar pelo relógio do navegador. */
function diaPorExtensoCurto(dia: string): string {
  return `${Number(dia.slice(8, 10))} de ${nomeDoMes(dia.slice(0, 7)).replace(/^./, (l) => l.toLowerCase())}`;
}
const mesEmMinusculas = (mes: string) => nomeDoMes(mes).replace(/^./, (l) => l.toLowerCase());

export default function GastosDaClyon({
  gastos,
  categorias,
  mes,
  hoje,
  token,
  podeEliminar,
  onMudou,
}: {
  gastos: Gasto[];
  categorias: Categoria[];
  /** O mês escolhido em cima: diz quanto conta nesse mês. */
  mes: string;
  hoje: string;
  token: string | null;
  podeEliminar: boolean;
  onMudou: () => void;
}) {
  const mesDeHoje = mesDoDia(hoje);
  const [form, setForm] = useState<Formulario | null>(null);
  const [pausa, setPausa] = useState<{ gasto: Gasto; accao: "suspender" | "reactivar"; desde: string } | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState("");
  const despesas = categorias.filter((c) => c.tipo === "despesa" && !c.sistema);
  const porId = new Map(categorias.map((c) => [c.id, c]));

  const recorrentes = gastos.filter((g) => g.tipo === "recorrente");
  const ocasionais = gastos.filter((g) => g.tipo === "ocasional").sort((a, b) => (b.dia ?? "").localeCompare(a.dia ?? ""));
  const totalRecorrentes = totalMensalDosRecorrentes(gastos, mesDeHoje);
  const noMes = gastos.filter((g) => contaNoMes(g, mes)).reduce((s, g) => s + g.valor, 0);

  async function pedir(metodo: "POST" | "PATCH" | "DELETE", corpo: Record<string, unknown> | null, query = ""): Promise<boolean> {
    setAGravar(true);
    setErro("");
    try {
      const res = await fetch(`/api/admin/financas/gastos${query}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(d.error ?? "Não foi possível gravar.");
        return false;
      }
      onMudou();
      return true;
    } catch {
      setErro("Erro de rede.");
      return false;
    } finally {
      setAGravar(false);
    }
  }

  async function gravar() {
    if (!form) return;
    if (!form.tipo) {
      setErro("Escolha se é recorrente (todos os meses) ou ocasional (uma vez).");
      return;
    }
    const corpo = {
      id: form.id,
      nome: form.nome,
      valor: form.valor,
      tipo: form.tipo,
      inicio: form.tipo === "recorrente" ? form.inicio : null,
      dia: form.tipo === "ocasional" ? form.dia : null,
      categoriaId: form.categoriaId || null,
      notas: form.notas,
    };
    if (await pedir(form.id ? "PATCH" : "POST", corpo)) setForm(null);
  }

  async function eliminar(g: Gasto) {
    if (!window.confirm(`Eliminar o gasto «${g.nome}» de ${emEuros(g.valor)}? Sai de todos os meses, e não se desfaz.`)) return;
    await pedir("DELETE", null, `?id=${g.id}`);
  }

  const novo = () =>
    setForm({ nome: "", valor: "", tipo: null, inicio: mesDeHoje, dia: hoje, categoriaId: "", notas: "" });
  const editar = (g: Gasto) =>
    setForm({
      id: g.id,
      nome: g.nome,
      valor: g.valor.toFixed(2).replace(".", ","),
      tipo: g.tipo,
      inicio: g.inicio ?? mesDeHoje,
      dia: g.dia ?? hoje,
      categoriaId: g.categoriaId != null ? String(g.categoriaId) : "",
      notas: g.notas ?? "",
    });

  const campo = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";
  const rotulo = "block text-xs font-semibold uppercase tracking-wider text-slate-400";

  const linhaDoGasto = (g: Gasto) => {
    const cat = g.categoriaId != null ? porId.get(g.categoriaId) : undefined;
    const suspenso = estaSuspenso(g, mesDeHoje);
    const aberta = pausaAberta(g);
    return (
      <li key={g.id} className={`flex flex-wrap items-center gap-3 py-3 ${suspenso ? "opacity-60" : ""}`}>
        {cat ? <BolaDaCategoria cor={cat.cor} icone={cat.icone} /> : <span className="h-7 w-7 rounded-full bg-slate-800" aria-hidden="true" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-100">{g.nome}</span>
          <span className="block text-[11px] text-slate-500">
            {cat?.nome ?? "Sem categoria"} ·{" "}
            {g.tipo === "recorrente"
              ? `todos os meses desde ${mesEmMinusculas(g.inicio ?? mesDeHoje)}`
              : `uma vez, a ${diaPorExtensoCurto(g.dia ?? hoje)}`}
            {aberta &&
              (g.tipo === "recorrente"
                ? ` · suspenso desde ${mesEmMinusculas(aberta.de)}`
                : " · suspenso: não conta")}
          </span>
        </span>
        <span className="text-sm font-bold tabular-nums text-white">
          {emEuros(g.valor)}
          {g.tipo === "recorrente" && <span className="text-[11px] font-normal text-slate-500"> /mês</span>}
        </span>
        <span className="flex gap-1">
          <button type="button" onClick={() => editar(g)} aria-label={`Editar ${g.nome}`} title="Editar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <Pencil className="h-4 w-4" />
          </button>
          {aberta ? (
            <button
              type="button"
              onClick={() => setPausa({ gasto: g, accao: "reactivar", desde: mesDeHoje })}
              aria-label={`Reactivar ${g.nome}`}
              title="Reactivar"
              className="rounded-lg p-1.5 text-esmeralda-texto hover:bg-slate-800"
            >
              <Play className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPausa({ gasto: g, accao: "suspender", desde: somarMeses(mesDeHoje, 1) })}
              aria-label={`Suspender ${g.nome}`}
              title="Suspender"
              className="rounded-lg p-1.5 text-ambar-texto hover:bg-slate-800"
            >
              <Pause className="h-4 w-4" />
            </button>
          )}
          {podeEliminar && (
            <button type="button" onClick={() => void eliminar(g)} aria-label={`Eliminar ${g.nome}`} title="Eliminar" className="rounded-lg p-1.5 text-red-300 hover:bg-red-500/10">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </span>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Gastos da CLYON</h3>
            <p className="mt-1 text-xs text-slate-400">
              Recorrentes activos: <strong className="tabular-nums text-white">{emEuros(totalRecorrentes)}</strong> por mês
              {" · "}em {mesEmMinusculas(mes)} contam <strong className="tabular-nums text-white">{emEuros(noMes)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={novo}
            className="flex items-center gap-1.5 rounded-xl bg-acao px-3 py-2 text-sm font-bold text-white hover:bg-acao-hover"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo gasto
          </button>
        </div>
        {erro && !form && !pausa && <p className="mt-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{erro}</p>}

        {gastos.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Ainda não há gastos. Carregue em «Novo gasto» e escolha se é recorrente (todos os meses) ou ocasional (uma vez).
          </p>
        ) : (
          <>
            <h4 className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Recorrentes — todos os meses</h4>
            {recorrentes.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">Nenhum.</p>
            ) : (
              <ul className="divide-y divide-slate-800">{recorrentes.map(linhaDoGasto)}</ul>
            )}
            <h4 className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Ocasionais — uma vez</h4>
            {ocasionais.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">Nenhum.</p>
            ) : (
              <ul className="divide-y divide-slate-800">{ocasionais.map(linhaDoGasto)}</ul>
            )}
          </>
        )}
      </section>

      {pausa && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center">
          <div role="dialog" aria-modal="true" aria-label={pausa.accao === "suspender" ? "Suspender gasto" : "Reactivar gasto"} className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="font-[Poppins] text-lg font-bold text-white">
              {pausa.accao === "suspender" ? "Suspender" : "Reactivar"} «{pausa.gasto.nome}»
            </h3>
            {pausa.gasto.tipo === "recorrente" ? (
              <label className="mt-4 block">
                <span className={rotulo}>{pausa.accao === "suspender" ? "Deixa de contar a partir de" : "Volta a contar a partir de"}</span>
                <select value={pausa.desde} onChange={(e) => setPausa({ ...pausa, desde: e.target.value })} className={`mt-1 ${campo}`}>
                  {[0, 1, 2].map((i) => {
                    const m = somarMeses(mesDeHoje, i);
                    return (
                      <option key={m} value={m}>
                        {nomeDoMes(m)}
                        {i === 0 ? " (este mês)" : i === 1 ? " (o próximo)" : ""}
                      </option>
                    );
                  })}
                </select>
                <span className="mt-1 block text-[11px] text-slate-500">
                  {pausa.accao === "suspender"
                    ? "Os meses de antes ficam como estão."
                    : "Os meses em que esteve suspenso continuam sem contar."}
                </span>
              </label>
            ) : (
              <p className="mt-3 text-sm text-slate-300">
                {pausa.accao === "suspender" ? "Deixa de contar no mês dele." : "Volta a contar no mês dele."}
              </p>
            )}
            {erro && <p className="mt-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{erro}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { setPausa(null); setErro(""); }} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white">
                Cancelar
              </button>
              <button
                type="button"
                disabled={aGravar}
                onClick={async () => {
                  if (await pedir("PATCH", { id: pausa.gasto.id, accao: pausa.accao, desde: pausa.desde })) setPausa(null);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-acao px-4 py-2 text-sm font-bold text-white hover:bg-acao-hover disabled:opacity-40"
              >
                {aGravar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {pausa.accao === "suspender" ? "Suspender" : "Reactivar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center">
          <div role="dialog" aria-modal="true" aria-label={form.id ? "Editar gasto" : "Novo gasto"} className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-[Poppins] text-lg font-bold text-white">{form.id ? "Editar gasto" : "Novo gasto"}</h3>
              <button type="button" onClick={() => { setForm(null); setErro(""); }} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4">
              <span className={rotulo}>É um gasto…</span>
              <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-1" role="radiogroup" aria-label="Recorrente ou ocasional">
                {(
                  [
                    { t: "recorrente", r: "Recorrente", s: "todos os meses" },
                    { t: "ocasional", r: "Ocasional", s: "uma vez" },
                  ] as const
                ).map((x) => (
                  <button
                    key={x.t}
                    type="button"
                    role="radio"
                    aria-checked={form.tipo === x.t}
                    onClick={() => setForm({ ...form, tipo: x.t })}
                    className={`rounded-lg px-2 py-2 text-sm font-semibold transition ${
                      form.tipo === x.t ? "bg-slate-800 text-cyan-200" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {x.r}
                    <span className="block text-[11px] font-normal">{x.s}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-4 block">
              <span className={rotulo}>Nome</span>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={80} placeholder="Ex.: alojamento do site, seguro da carrinha" className={`mt-1 ${campo}`} />
            </label>

            <label className="mt-4 block">
              <span className={rotulo}>{form.tipo === "recorrente" ? "Valor por mês (€)" : "Valor (€)"}</span>
              <input inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" className={`mt-1 ${campo} tabular-nums`} />
            </label>

            {form.tipo === "recorrente" && (
              <label className="mt-4 block">
                <span className={rotulo}>Conta a partir de</span>
                <input type="month" value={form.inicio} onChange={(e) => e.target.value && setForm({ ...form, inicio: e.target.value })} className={`mt-1 ${campo}`} />
                {form.id && (
                  <span className="mt-1 block text-[11px] text-slate-500">
                    Mudar o valor muda todos os meses. Para um preço novo a partir de um mês, suspenda este e crie outro.
                  </span>
                )}
              </label>
            )}
            {form.tipo === "ocasional" && (
              <label className="mt-4 block">
                <span className={rotulo}>Dia</span>
                <input type="date" value={form.dia} onChange={(e) => e.target.value && setForm({ ...form, dia: e.target.value })} className={`mt-1 ${campo}`} />
              </label>
            )}

            <label className="mt-4 block">
              <span className={rotulo}>Categoria</span>
              <select value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })} className={`mt-1 ${campo}`}>
                <option value="">Sem categoria</option>
                {despesas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className={rotulo}>Notas</span>
              <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} maxLength={300} className={`mt-1 ${campo}`} />
            </label>

            {erro && <p className="mt-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{erro}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { setForm(null); setErro(""); }} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void gravar()}
                disabled={aGravar || !form.tipo || !form.nome.trim() || !(Number(lerEuros(form.valor)) > 0)}
                className="flex items-center gap-1.5 rounded-lg bg-acao px-4 py-2 text-sm font-bold text-white hover:bg-acao-hover disabled:opacity-40"
              >
                {aGravar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
