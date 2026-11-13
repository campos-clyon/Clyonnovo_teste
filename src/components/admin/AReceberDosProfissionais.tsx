"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useEAdministrador } from "@/hooks/useAdminAuth";
import { diaEmLisboa } from "@/lib/hora-de-lisboa";
import { METODOS_DO_PROFISSIONAL } from "@/lib/pagamento-da-divida";
import {
  estadoDaParteEmPalavras,
  type EstadoDaCobranca,
  type EstadoDaParte,
  type ParteDaDivida,
} from "@/lib/cobrancas-ao-profissional";

/**
 * PAGAMENTOS › «A RECEBER DOS PROFISSIONAIS» — 11-11-2026 (dono).
 *
 * O que cada profissional deve à CLYON de trabalhos que o cliente lhe pagou em
 * mão: por trabalho, o IVA e a taxa da plataforma, cada um com o seu estado
 * («IVA 22,50 € · pendente» / «Taxa da plataforma 9,80 € · pago 05/11/2026 ·
 * MB WAY»). Marca-se uma parte, a outra ou as duas; o administrador desfaz,
 * com motivo. A conta é a da carteira dele — a mesma das Carteiras.
 */

export type TrabalhoAReceber = {
  negociacaoId: number;
  pedidoId: number | null;
  cliente: string | null;
  servico: string | null;
  nasceuEm: string | null;
  estado: EstadoDaCobranca;
  porPagar: number;
  total: number;
  partes: EstadoDaParte[];
  /** d10: no modelo de 15-11, o valor em atraso (a taxa e o IVA dela), o estado e a referência. */
  valorEmAtraso?: {
    estado: "pago" | "no_prazo" | "stand_by" | "sem_data";
    frase: string;
    referencia: { entidade: string | null; referencia: string | null } | null;
  } | null;
};

export type ProfissionalAReceber = {
  providerId: number;
  nome: string;
  contaDeTeste: boolean;
  devido: number;
  trabalhos: TrabalhoAReceber[];
};

export type DadosAReceber = {
  profissionais: ProfissionalAReceber[];
  totais: { devido: number; pendentes: number; parciais: number; pagos: number };
};

const euros = (v: number) => `${(Math.round((v + Number.EPSILON) * 100) / 100).toFixed(2).replace(".", ",")} €`;

function dataCurta(iso: string | null): string {
  if (!iso) return "";
  const [a, m, d] = diaEmLisboa(new Date(iso)).split("-");
  return `${d}/${m}/${a}`;
}

/** O que o separador lê — chamado pelo gestor dos Pagamentos, para o número no separador. */
export function useAReceberDosProfissionais(token: string | null) {
  const [dados, setDados] = useState<DadosAReceber | null>(null);
  const [erro, setErro] = useState("");
  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/pagamentos/a-receber-dos-profissionais", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (!res.ok) {
        setErro(j.error ?? "Não foi possível ler.");
        return;
      }
      setDados(j as DadosAReceber);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    }
  }, [token]);
  useEffect(() => {
    void ler();
  }, [ler]);
  return { dados, erro, ler };
}

type Filtro = "por_pagar" | "pendente" | "parcial" | "pago";

const FILTROS: Array<{ id: Filtro; rotulo: string }> = [
  { id: "por_pagar", rotulo: "Por pagar" },
  { id: "pendente", rotulo: "Pendentes" },
  { id: "parcial", rotulo: "Parciais" },
  { id: "pago", rotulo: "Pagos" },
];

const passa = (f: Filtro, e: EstadoDaCobranca) => (f === "por_pagar" ? e !== "pago" : e === f);

const COR_DO_ESTADO: Record<EstadoDaCobranca, string> = {
  pendente: "text-amber-300",
  parcial: "text-cyan-300",
  pago: "text-emerald-300",
};

const NOME_DO_ESTADO: Record<EstadoDaCobranca, string> = {
  pendente: "pendente",
  parcial: "pago em parte",
  pago: "pago",
};

export default function AReceberDosProfissionais({
  token,
  dados,
  erro,
  onMudou,
}: {
  token: string | null;
  dados: DadosAReceber | null;
  erro: string;
  onMudou: () => void | Promise<void>;
}) {
  const eAdministrador = useEAdministrador();
  const [filtro, setFiltro] = useState<Filtro>("por_pagar");

  if (erro && !dados) return <p className="mt-3 text-sm text-rose-300">{erro}</p>;
  if (!dados) {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A ler…
      </p>
    );
  }

  const contagem: Record<Filtro, number> = {
    por_pagar: dados.totais.pendentes + dados.totais.parciais,
    pendente: dados.totais.pendentes,
    parcial: dados.totais.parciais,
    pago: dados.totais.pagos,
  };
  const visiveis = dados.profissionais
    .map((p) => ({ ...p, trabalhos: p.trabalhos.filter((t) => passa(filtro, t.estado)) }))
    .filter((p) => p.trabalhos.length > 0);

  return (
    <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">A receber dos profissionais</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
        Trabalhos que o cliente pagou ao profissional em mão: o IVA e a taxa da plataforma são da CLYON, e cada
        um paga-se por si. Faltam {euros(dados.totais.devido)} no total. É o mesmo número das Carteiras.
      </p>

      <div role="tablist" aria-label="Filtrar" className="mt-3 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filtro === f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              filtro === f.id
                ? "border-cyan-500/60 bg-cyan-500/10 text-white"
                : "border-slate-700 text-slate-300 hover:border-slate-500"
            }`}
          >
            {f.rotulo} · {contagem[f.id]}
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          {filtro === "pago" ? "Ainda não há dívidas pagas." : "Nenhum profissional deve nada à CLYON."}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {visiveis.map((p) => (
            <section key={p.providerId} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-sm font-bold text-white">
                  {p.nome}
                  {p.contaDeTeste && <span className="ml-2 text-[11px] font-normal text-slate-500">conta de teste</span>}
                </h4>
                <p className={`text-sm font-bold tabular-nums ${p.devido > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                  {p.devido > 0 ? `deve ${euros(p.devido)}` : "nada por pagar"}
                </p>
              </div>
              <ul className="mt-2 divide-y divide-slate-800">
                {p.trabalhos.map((t) => (
                  <LinhaDoTrabalho
                    key={t.negociacaoId}
                    t={t}
                    token={token}
                    eAdministrador={eAdministrador}
                    onMudou={onMudou}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function LinhaDoTrabalho({
  t,
  token,
  eAdministrador,
  onMudou,
}: {
  t: TrabalhoAReceber;
  token: string | null;
  eAdministrador: boolean;
  onMudou: () => void | Promise<void>;
}) {
  const [aMarcar, setAMarcar] = useState<ParteDaDivida[] | null>(null);
  const [aDesfazer, setADesfazer] = useState<ParteDaDivida | null>(null);
  const [metodo, setMetodo] = useState<string>(METODOS_DO_PROFISSIONAL[0].id);
  const [dia, setDia] = useState(() => diaEmLisboa(new Date()));
  const [nota, setNota] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const pendentes = t.partes.filter((x) => !x.paga);

  async function enviar(corpo: Record<string, unknown>) {
    if (!token) return;
    setOcupado(true);
    setErro("");
    try {
      const res = await fetch("/api/admin/pagamentos/a-receber-dos-profissionais", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ negociacaoId: t.negociacaoId, ...corpo }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErro(j.error ?? "Não foi possível gravar.");
        return;
      }
      setAMarcar(null);
      setADesfazer(null);
      setNota("");
      setMotivo("");
      await onMudou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(false);
    }
  }

  const botao =
    "rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:border-cyan-500 hover:text-white disabled:opacity-50";

  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-slate-200">
          <span className="font-semibold text-white">{t.pedidoId != null ? `#${t.pedidoId}` : `negociação ${t.negociacaoId}`}</span>
          {t.cliente ? ` · ${t.cliente}` : ""}
          {t.nasceuEm ? ` · ${dataCurta(t.nasceuEm)}` : ""}
        </p>
        <p className={`text-[11px] font-semibold uppercase tracking-wide ${COR_DO_ESTADO[t.estado]}`}>
          {NOME_DO_ESTADO[t.estado]}
          {t.porPagar > 0 ? ` · faltam ${euros(t.porPagar)}` : ""}
        </p>
      </div>

      {t.valorEmAtraso && (
        <p
          className={`mt-1 text-[12px] ${t.valorEmAtraso.estado === "stand_by" ? "font-semibold text-red-300" : t.valorEmAtraso.estado === "pago" ? "text-emerald-300" : "text-amber-200"}`}
        >
          Modelo de 15/11 · {t.valorEmAtraso.frase}
          {t.valorEmAtraso.referencia?.referencia
            ? ` · Multibanco: entidade ${t.valorEmAtraso.referencia.entidade ?? "—"}, referência ${t.valorEmAtraso.referencia.referencia}`
            : t.valorEmAtraso.estado !== "pago"
              ? " · sem referência viva"
              : ""}
        </p>
      )}

      <ul className="mt-1 space-y-0.5">
        {t.partes.map((x) => (
          <li key={x.parte} className="flex flex-wrap items-center gap-x-2 text-[13px] tabular-nums">
            <span className={x.paga ? "text-emerald-300" : "text-amber-300"}>
              {x.parte === "iva" ? "IVA" : "Taxa da plataforma"} {euros(x.valor)} · {estadoDaParteEmPalavras(x)}
            </span>
            {x.paga && (x.marcadoPor || x.nota) && (
              <span className="text-[11px] text-slate-500">
                {x.marcadoPor ? `por ${x.marcadoPor}` : ""}
                {x.nota ? `${x.marcadoPor ? " · " : ""}${x.nota}` : ""}
              </span>
            )}
            {eAdministrador && x.paga && x.desfazivel && aDesfazer !== x.parte && (
              <button onClick={() => setADesfazer(x.parte)} className="text-[11px] text-slate-400 underline hover:text-white">
                Desfazer
              </button>
            )}
          </li>
        ))}
      </ul>

      {eAdministrador && pendentes.length > 0 && !aMarcar && (
        <div className="mt-2 flex flex-wrap gap-2">
          {pendentes.some((x) => x.parte === "iva") && (
            <button className={botao} onClick={() => setAMarcar(["iva"])}>
              Marcar IVA pago
            </button>
          )}
          {pendentes.some((x) => x.parte === "taxa") && (
            <button className={botao} onClick={() => setAMarcar(["taxa"])}>
              Marcar taxa paga
            </button>
          )}
          {pendentes.length > 1 && (
            <button className={botao} onClick={() => setAMarcar(pendentes.map((x) => x.parte))}>
              Marcar tudo pago
            </button>
          )}
        </div>
      )}

      {aMarcar && (
        <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950/60 p-2.5">
          <p className="text-xs font-semibold text-slate-200">
            {aMarcar.length > 1 ? "O IVA e a taxa da plataforma" : aMarcar[0] === "iva" ? "O IVA" : "A taxa da plataforma"}{" "}
            ({euros(t.partes.filter((x) => aMarcar.includes(x.parte)).reduce((s, x) => s + x.valor, 0))}) — como e quando pagou?
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
              aria-label="Método"
            >
              {METODOS_DO_PROFISSIONAL.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.rotulo}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dia}
              max={diaEmLisboa(new Date())}
              onChange={(e) => setDia(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
              aria-label="Dia em que pagou"
            />
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={255}
              placeholder="Nota (opcional)"
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              disabled={ocupado}
              onClick={() => void enviar({ accao: "marcar", partes: aMarcar, metodo, dia, nota })}
              className="flex items-center gap-1.5 rounded-lg bg-acao px-3 py-1.5 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-50"
            >
              {ocupado && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
              Confirmar
            </button>
            <button onClick={() => setAMarcar(null)} className={botao}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {aDesfazer && (
        <div className="mt-2 rounded-lg border border-rose-900/60 bg-rose-950/20 p-2.5">
          <p className="text-xs font-semibold text-rose-200">
            Desfazer a marca {aDesfazer === "iva" ? "do IVA" : "da taxa da plataforma"}? Volta a pendente, e fica no
            histórico do pedido e do profissional.
          </p>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={200}
            placeholder="Motivo"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
          />
          <div className="mt-2 flex gap-2">
            <button
              disabled={ocupado || motivo.trim().length < 3}
              onClick={() => void enviar({ accao: "desfazer", parte: aDesfazer, motivo })}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {ocupado && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
              Desfazer
            </button>
            <button onClick={() => setADesfazer(null)} className={botao}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {erro && <p className="mt-1.5 text-xs text-rose-300">{erro}</p>}
    </li>
  );
}
