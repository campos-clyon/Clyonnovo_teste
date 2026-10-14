"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight, Loader2, Minus, Plus, RefreshCw } from "lucide-react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import AdminCarteirasPanel from "@/components/admin/AdminCarteirasPanel";
import { diaEmLisboa } from "@/lib/hora-de-lisboa";
import {
  mesDoDia,
  nomeDoMes,
  somarMeses,
  type Categoria,
  type Conta,
  type Movimento,
  type TipoDeMovimento,
} from "@/lib/financas";
import PainelDasFinancas from "./PainelDasFinancas";
import ListaDeTransacoes, { type FiltroDoTipo } from "./ListaDeTransacoes";
import FormularioDoMovimento from "./FormularioDoMovimento";
import ContasECategorias from "./ContasECategorias";

/**
 * A GESTORA DE CONTAS DA CLYON — a secção das Carteiras, desde 14-10-2026.
 *
 * *«Quero que transforme a carteira nessa gestora de contas da CLYON, onde
 * podemos gerir os pagamentos e gastos da CLYON, valores recebidos e pagos,
 * com categorias, entre outros.»* As regras e as decisões do dono estão em
 * `src/lib/financas.ts`.
 *
 * Quatro separadores: o painel do mês, as transações, as contas e as
 * categorias, e o ecrã de antes — o que cada profissional tem a receber e o
 * IBAN para lho mandar —, que ficou cá dentro e não se perdeu.
 */

type Separador = "painel" | "transacoes" | "contas" | "profissionais";

const SEPARADORES: Array<{ id: Separador; rotulo: string }> = [
  { id: "painel", rotulo: "Painel" },
  { id: "transacoes", rotulo: "Transações" },
  { id: "contas", rotulo: "Contas e categorias" },
  { id: "profissionais", rotulo: "A pagar aos profissionais" },
];

type Dados = { contas: Conta[]; categorias: Categoria[]; movimentos: Movimento[]; hoje: string };

/**
 * A categoria do último lançado à mão, de cada tipo: o formulário abre nela,
 * porque os talões lançam-se por levas — a semana do combustível, os salários
 * do mês. O último é o de número mais alto (a base dá-os por ordem de criação).
 */
function ultimaCategoria(movimentos: Movimento[]): Partial<Record<"despesa" | "receita", number>> {
  const fora: Partial<Record<"despesa" | "receita", number>> = {};
  const maior: Record<"despesa" | "receita", number> = { despesa: -1, receita: -1 };
  for (const m of movimentos) {
    if (m.automatico || m.categoriaId == null || m.tipo === "transferencia") continue;
    const n = Number(m.id.slice(1)) || 0;
    if (n > maior[m.tipo]) {
      maior[m.tipo] = n;
      fora[m.tipo] = m.categoriaId;
    }
  }
  return fora;
}

export default function GestoraDeContas() {
  const { token, ready } = useAdminAuth();
  // Apagar é do administrador, como em todo o backoffice; o servidor recusa-o na mesma.
  const podeApagar = useEAdministrador();
  const [separador, setSeparador] = useState<Separador>("painel");
  const [mes, setMes] = useState(() => mesDoDia(diaEmLisboa(new Date())));
  const [dados, setDados] = useState<Dados | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<FiltroDoTipo>("todas");
  const [formulario, setFormulario] = useState<{ tipo: TipoDeMovimento; movimento: Movimento | null } | null>(null);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!token) return;
      if (!silencioso) setACarregar(true);
      try {
        const res = await fetch("/api/admin/financas", { headers: { Authorization: `Bearer ${token}` } });
        const d = (await res.json().catch(() => ({}))) as Partial<Dados> & { error?: string };
        if (!res.ok) {
          setErro(d.error ?? "Não foi possível ler as finanças.");
          return;
        }
        setDados({
          contas: d.contas ?? [],
          categorias: d.categorias ?? [],
          movimentos: d.movimentos ?? [],
          hoje: d.hoje ?? diaEmLisboa(new Date()),
        });
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

  // Os pagamentos da plataforma entram sozinhos: a gestora vai buscá-los de vez em quando.
  useAutoRefresh(() => carregar(true), {
    enabled: ready && Boolean(token) && separador !== "profissionais" && formulario == null,
  });

  const lancar = (tipo: TipoDeMovimento) => setFormulario({ tipo, movimento: null });

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-700/60 bg-slate-900/80 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Plataforma</p>
            <h2 className="mt-1 font-[Poppins] text-2xl font-bold text-white">Finanças</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              As contas da CLYON: o que entra e o que sai, por categoria. O que os clientes pagam e o que se
              transfere aos profissionais entra sozinho; o resto lança-se aqui.
            </p>
          </div>
          {separador !== "profissionais" && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => lancar("despesa")}
                className="flex items-center gap-1.5 rounded-xl border border-coral/50 bg-coral/10 px-3 py-2 text-sm font-semibold text-coral-texto hover:bg-coral/20"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
                Despesa
              </button>
              <button
                type="button"
                onClick={() => lancar("receita")}
                className="flex items-center gap-1.5 rounded-xl border border-esmeralda/50 bg-esmeralda/10 px-3 py-2 text-sm font-semibold text-esmeralda-texto hover:bg-esmeralda/20"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Receita
              </button>
              <button
                type="button"
                onClick={() => lancar("transferencia")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                Transferência
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Finanças" className="flex flex-wrap gap-2">
            {SEPARADORES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={separador === s.id}
                onClick={() => setSeparador(s.id)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  separador === s.id
                    ? "border-cyan-500/60 bg-[#06B6D4]/10 text-cyan-200"
                    : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600"
                }`}
              >
                {s.rotulo}
              </button>
            ))}
          </div>
          {(separador === "painel" || separador === "transacoes") && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMes(somarMeses(mes, -1))}
                aria-label="Mês anterior"
                className="rounded-full p-2 text-cyan-300 hover:bg-slate-800"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="min-w-[10.5rem] rounded-full border border-cyan-500/50 px-4 py-1.5 text-center text-sm font-semibold text-cyan-200">
                {nomeDoMes(mes)}
              </span>
              <button
                type="button"
                onClick={() => setMes(somarMeses(mes, 1))}
                aria-label="Mês seguinte"
                className="rounded-full p-2 text-cyan-300 hover:bg-slate-800"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => void carregar()}
                aria-label="Actualizar"
                title="Actualizar"
                className="ml-1 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      {erro && <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{erro}</p>}

      {separador === "profissionais" ? (
        <AdminCarteirasPanel />
      ) : aCarregar && !dados ? (
        <p className="flex items-center gap-2 py-10 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A carregar…
        </p>
      ) : dados ? (
        separador === "painel" ? (
          <PainelDasFinancas
            contas={dados.contas}
            categorias={dados.categorias}
            movimentos={dados.movimentos}
            mes={mes}
            hoje={dados.hoje}
            onVerTransacoes={(tipo) => {
              setFiltro(tipo);
              setSeparador("transacoes");
            }}
            onLancar={lancar}
          />
        ) : separador === "transacoes" ? (
          <ListaDeTransacoes
            contas={dados.contas}
            categorias={dados.categorias}
            movimentos={dados.movimentos}
            mes={mes}
            filtro={filtro}
            onFiltro={setFiltro}
            onEditar={(m) => setFormulario({ tipo: m.tipo, movimento: m })}
          />
        ) : (
          <ContasECategorias
            contas={dados.contas}
            categorias={dados.categorias}
            movimentos={dados.movimentos}
            hoje={dados.hoje}
            token={token}
            podeApagar={podeApagar}
            onMudou={() => void carregar(true)}
          />
        )
      ) : null}

      {formulario && dados && (
        <FormularioDoMovimento
          tipoInicial={formulario.tipo}
          movimento={formulario.movimento}
          contas={dados.contas}
          categorias={dados.categorias}
          hoje={dados.hoje}
          ultimaCategoria={ultimaCategoria(dados.movimentos)}
          token={token}
          podeApagar={podeApagar}
          onGravado={() => void carregar(true)}
          onFechar={() => setFormulario(null)}
        />
      )}
    </div>
  );
}
