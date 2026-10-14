"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2, Zap } from "lucide-react";
import {
  CORES,
  ICONES,
  TIPOS_DE_CONTA,
  emEuros,
  saldoDaConta,
  type Categoria,
  type Conta,
  type Cor,
  type Icone,
  type Movimento,
  type TipoDeCategoria,
  type TipoDeConta,
} from "@/lib/financas";
import { BolaDaCategoria, CLASSES_DA_COR, DESENHO_DO_ICONE, DesenhoDaConta, NOME_DA_COR } from "./aparencia";

/**
 * AS CONTAS E AS CATEGORIAS — onde se arruma a gestora.
 *
 * As duas contas e as quatro categorias da plataforma têm um raio: mudam de
 * nome e de cor, mas não se apagam, porque é para lá que o dinheiro da
 * plataforma vai sozinho. Apagar o resto só sem movimentos, e só o
 * administrador.
 */
export default function ContasECategorias({
  contas,
  categorias,
  movimentos,
  hoje,
  token,
  podeApagar,
  onMudou,
}: {
  contas: Conta[];
  categorias: Categoria[];
  movimentos: Movimento[];
  hoje: string;
  token: string | null;
  podeApagar: boolean;
  onMudou: () => void;
}) {
  // O saldo inicial edita-se como texto: «1.234,50» escreve-se e só se lê ao gravar.
  const [conta, setConta] = useState<{ id?: number; nome: string; tipo: TipoDeConta; cor: Cor; saldoTexto: string } | null>(null);
  const [categoria, setCategoria] = useState<Partial<Categoria> | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState("");

  async function pedir(url: string, method: string, corpo?: unknown): Promise<boolean> {
    if (!token) return false;
    setAGravar(true);
    setErro("");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      const dados = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
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

  const campo = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";

  return (
    <div className="space-y-6">
      {erro && <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{erro}</p>}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-200">Contas</h3>
          <button
            type="button"
            onClick={() => setConta({ tipo: "banco", cor: "azul", saldoTexto: "", nome: "" })}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Nova conta
          </button>
        </div>
        <ul className="mt-3 divide-y divide-slate-800">
          {contas.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full ${CLASSES_DA_COR[c.cor].chip}`}>
                <DesenhoDaConta tipo={c.tipo} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-100">{c.nome}</span>
                <span className="block text-[11px] text-slate-500">
                  {TIPOS_DE_CONTA.find((t) => t.id === c.tipo)?.rotulo}
                  {c.papel === "plataforma" && " · recebe o dinheiro da plataforma e paga aos profissionais"}
                  {c.papel === "caixa" && " · recebe o numerário que um cliente entrega"}
                  {" · "}começou com {emEuros(c.saldoInicial)}
                </span>
              </span>
              <span className="text-sm font-semibold tabular-nums text-white">{emEuros(saldoDaConta(c, movimentos, hoje))}</span>
              <button
                type="button"
                onClick={() =>
                  setConta({ id: c.id, nome: c.nome, tipo: c.tipo, cor: c.cor, saldoTexto: c.saldoInicial.toFixed(2).replace(".", ",") })
                }
                aria-label={`Editar ${c.nome}`}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <Pencil className="h-4 w-4" />
              </button>
              {podeApagar && !c.papel && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Apagar a conta «${c.nome}»?`)) void pedir(`/api/admin/financas/contas?id=${c.id}`, "DELETE");
                  }}
                  aria-label={`Apagar ${c.nome}`}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>

        {conta && (
          <div className="mt-3 space-y-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-xs text-slate-400">
                Nome
                <input
                  autoFocus
                  value={conta.nome}
                  onChange={(e) => setConta({ ...conta, nome: e.target.value })}
                  maxLength={60}
                  className={`mt-1 ${campo}`}
                />
              </label>
              <label className="block text-xs text-slate-400">
                Tipo
                <select
                  value={conta.tipo}
                  onChange={(e) => setConta({ ...conta, tipo: e.target.value as TipoDeConta })}
                  className={`mt-1 ${campo}`}
                >
                  {TIPOS_DE_CONTA.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.rotulo}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-400">
                Saldo inicial
                <input
                  inputMode="decimal"
                  value={conta.saldoTexto}
                  onChange={(e) => setConta({ ...conta, saldoTexto: e.target.value })}
                  placeholder="0,00"
                  className={`mt-1 ${campo}`}
                />
              </label>
            </div>
            <EscolherCor cor={conta.cor} onCor={(cor) => setConta({ ...conta, cor })} />
            <p className="text-[11px] text-slate-500">
              O saldo inicial é o que a conta tinha antes do primeiro movimento lançado aqui — o do extracto do banco.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConta(null)} className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-white">
                Cancelar
              </button>
              <button
                type="button"
                disabled={aGravar}
                onClick={async () => {
                  const feito = await pedir("/api/admin/financas/contas", conta.id ? "PATCH" : "POST", {
                    id: conta.id,
                    nome: conta.nome,
                    tipo: conta.tipo,
                    cor: conta.cor,
                    saldoInicial: conta.saldoTexto,
                  });
                  if (feito) setConta(null);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-acao px-3 py-1.5 text-sm font-bold text-white hover:bg-acao-hover disabled:opacity-40"
              >
                {aGravar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Guardar conta
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {(["despesa", "receita"] as TipoDeCategoria[]).map((tipo) => (
          <section key={tipo} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-200">
                Categorias de {tipo === "despesa" ? "despesas" : "receitas"}
              </h3>
              <button
                type="button"
                onClick={() => setCategoria({ tipo, cor: "ardosia", icone: "outros", nome: "" })}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Nova
              </button>
            </div>

            {categoria && categoria.tipo === tipo && (
              <div className="mt-3 space-y-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                <label className="block text-xs text-slate-400">
                  Nome
                  <input
                    autoFocus
                    value={categoria.nome ?? ""}
                    onChange={(e) => setCategoria({ ...categoria, nome: e.target.value })}
                    maxLength={60}
                    className={`mt-1 ${campo}`}
                  />
                </label>
                <EscolherCor cor={(categoria.cor as Cor) ?? "ardosia"} onCor={(cor) => setCategoria({ ...categoria, cor })} />
                <div>
                  <span className="text-xs text-slate-400">Ícone</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ícone">
                    {ICONES.map((i) => {
                      const Desenho = DESENHO_DO_ICONE[i];
                      const escolhido = categoria.icone === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          role="radio"
                          aria-checked={escolhido}
                          aria-label={i}
                          onClick={() => setCategoria({ ...categoria, icone: i as Icone })}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                            escolhido
                              ? `border-transparent ${CLASSES_DA_COR[(categoria.cor as Cor) ?? "ardosia"].chip}`
                              : "border-slate-800 text-slate-400 hover:bg-slate-800"
                          }`}
                        >
                          <Desenho className="h-4 w-4" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setCategoria(null)} className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-white">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={aGravar}
                    onClick={async () => {
                      const feito = await pedir(
                        "/api/admin/financas/categorias",
                        categoria.id ? "PATCH" : "POST",
                        categoria,
                      );
                      if (feito) setCategoria(null);
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-acao px-3 py-1.5 text-sm font-bold text-white hover:bg-acao-hover disabled:opacity-40"
                  >
                    {aGravar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Guardar categoria
                  </button>
                </div>
              </div>
            )}

            <ul className="mt-3 divide-y divide-slate-800">
              {categorias
                .filter((c) => c.tipo === tipo)
                .map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <BolaDaCategoria cor={c.cor} icone={c.icone} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-100">{c.nome}</span>
                      {c.sistema && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-cyan-300/80">
                          <Zap className="h-3 w-3" aria-hidden="true" />
                          Da plataforma — enche-se sozinha
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCategoria(c)}
                      aria-label={`Editar ${c.nome}`}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {podeApagar && !c.sistema && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Apagar a categoria «${c.nome}»?`)) {
                            void pedir(`/api/admin/financas/categorias?id=${c.id}`, "DELETE");
                          }
                        }}
                        aria-label={`Apagar ${c.nome}`}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function EscolherCor({ cor, onCor }: { cor: Cor; onCor: (c: Cor) => void }) {
  return (
    <div>
      <span className="text-xs text-slate-400">Cor</span>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cor">
        {CORES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={cor === c}
            aria-label={NOME_DA_COR[c]}
            title={NOME_DA_COR[c]}
            onClick={() => onCor(c)}
            className={`h-7 w-7 rounded-full ${CLASSES_DA_COR[c].ponto} ${
              cor === c ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950" : "opacity-80 hover:opacity-100"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
