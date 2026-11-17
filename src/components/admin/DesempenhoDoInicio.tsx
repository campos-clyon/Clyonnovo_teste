"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  FILTROS_DO_DESEMPENHO,
  fraseDaVariacao,
  numeroCurto,
  rotuloDoMes,
  type Comparacao,
  type Desempenho,
} from "@/lib/desempenho";

/**
 * O DESEMPENHO, NO INÍCIO — d41, 15-11-2026.
 *
 * Por baixo do «precisa de si»: os pedidos que entram e os trabalhos feitos,
 * por dia, por mês e no ano, a conversão e três gráficos. A conta é toda do
 * servidor (`/api/admin/resumo/desempenho`, `desempenho.ts`); aqui só se
 * desenha. Cores da paleta do backoffice: entrados em azul, realizados em
 * esmeralda; a subida em esmeralda e a descida em coral, sempre com ▲/▼.
 */

const COR_ENTRADOS = "#60A5FA"; // --color-azul
const COR_REALIZADOS = "#34D399"; // --color-esmeralda
const DIAS_DA_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** A variação só aparece quando há comparação; o anterior fica no `title`. */
function Variacao({ c, nota }: { c: Comparacao; nota: string }) {
  if (c.variacao == null) return null;
  const r = Math.round(c.variacao);
  const cor = r > 0 ? "text-esmeralda-texto" : r < 0 ? "text-coral-texto" : "text-slate-400";
  return (
    <span
      className={`ml-1.5 text-[11px] font-semibold ${cor}`}
      title={c.anterior != null ? `${nota}: ${numeroCurto(c.anterior)}` : nota}
    >
      {fraseDaVariacao(c.variacao)}
    </span>
  );
}

function Celula({ c, nota }: { c: Comparacao; nota: string }) {
  return (
    <td className="px-2 py-1 text-right tabular-nums">
      <span className="font-bold text-white">{numeroCurto(c.valor)}</span>
      <Variacao c={c} nota={nota} />
    </td>
  );
}

/**
 * OS PEDIDOS QUE ENTRAM E OS TRABALHOS REALIZADOS, LADO A LADO — d56,
 * 17-11-2026: uma tabela compacta em vez de dez caixas. A comparação de cada
 * número vai no `title` da variação.
 */
function TabelaLadoALado({ d }: { d: Desempenho }) {
  const e = d.entrados;
  const r = d.realizados;
  const linhas: Array<{ rotulo: string; dica?: string; a: Comparacao; b: Comparacao; nota: string }> = [
    { rotulo: "Por dia (30 d)", a: e.mediaPorDia, b: r.mediaPorDia, nota: "30 dias anteriores" },
    {
      rotulo: e.mesesNaMedia >= 12 ? "Por mês (12 m)" : `Por mês (${e.mesesNaMedia} m com dados)`,
      a: e.mediaPorMes,
      b: r.mediaPorMes,
      nota: "12 meses anteriores",
    },
    {
      rotulo: `${rotuloDoMes(e.mesHomologo.mes)} (mês passado)`,
      a: e.mesHomologo,
      b: r.mesHomologo,
      nota: rotuloDoMes(e.mesHomologo.mesAnterior),
    },
    { rotulo: `${d.ano} até hoje`, a: e.anoAteHoje, b: r.anoAteHoje, nota: `mesmo período de ${d.ano - 1}` },
    {
      rotulo: "Previsão até dezembro",
      dica: `Ao ritmo dos últimos 90 dias (${numeroCurto(e.ritmo90)} entrados e ${numeroCurto(r.ritmo90)} realizados por dia).`,
      a: e.previsaoDoAno,
      b: r.previsaoDoAno,
      nota: `${d.ano - 1}`,
    },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[340px] text-left text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="py-1 pr-2 font-medium" />
            <th className="px-2 py-1 text-right font-medium">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COR_ENTRADOS }} aria-hidden="true" />
                Pedidos que entram
              </span>
            </th>
            <th className="px-2 py-1 text-right font-medium">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COR_REALIZADOS }} aria-hidden="true" />
                Trabalhos realizados
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {linhas.map((l) => (
            <tr key={l.rotulo}>
              <td className="py-1 pr-2 text-slate-400" title={l.dica}>{l.rotulo}</td>
              <Celula c={l.a} nota={l.nota} />
              <Celula c={l.b} nota={l.nota} />
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-slate-500">
        Cancelados ou arquivados (pelo dia em que entraram): {d.cancelados.ultimos30} em 30 dias · {d.cancelados.ultimos12Meses}{" "}
        em 12 meses · {d.cancelados.anoAteHoje} em {d.ano}. Realizados pelo dia em que o trabalho foi feito.
      </p>
    </div>
  );
}

const estiloDaDica = {
  contentStyle: { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#e2e8f0" },
  itemStyle: { color: "#cbd5e1" },
};

export default function DesempenhoDoInicio() {
  const { token, ready } = useAdminAuth();
  const [filtro, setFiltro] = useState("todos");
  const [d, setD] = useState<Desempenho | null>(null);
  const [erro, setErro] = useState("");
  const [aCarregar, setACarregar] = useState(true);

  const carregar = useCallback(async () => {
    if (!token) return;
    setACarregar(true);
    try {
      const res = await fetch(`/api/admin/resumo/desempenho?servico=${encodeURIComponent(filtro)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível carregar o desempenho.");
        return;
      }
      setD(dados);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token, filtro]);

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);

  const maxMapa = d ? Math.max(1, ...d.mapa.flat()) : 1;
  const ex = d?.extremos;
  const meses = d
    ? d.meses.map((m) => ({
        ...m,
        rotulo: `${rotuloDoMes(m.mes)}${m.emCurso ? " ·" : ""}`,
      }))
    : [];

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-white">Desempenho</h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Serviço">
          {FILTROS_DO_DESEMPENHO.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
              className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                filtro === f.id
                  ? "border-azul bg-azul/14 text-azul-texto"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erro}</p>
      )}

      {!d && aCarregar && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A fazer as contas…
        </p>
      )}

      {d && (
        <div className={`mt-2 space-y-3 ${aCarregar ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
            <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <TabelaLadoALado d={d} />
            </div>
          {/* (a) Mês a mês */}
          <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <h3 className="text-sm font-bold text-white">Mês a mês</h3>
            {ex && (
              <p className="mt-1 text-xs text-slate-400">
                {ex.entrados &&
                  `Entrados: melhor ${rotuloDoMes(ex.entrados.melhor)}, pior ${rotuloDoMes(ex.entrados.pior)}. `}
                {ex.realizados &&
                  `Realizados: melhor ${rotuloDoMes(ex.realizados.melhor)}, pior ${rotuloDoMes(ex.realizados.pior)}.`}
                {" "}O mês com «·» ainda está a decorrer.
              </p>
            )}
            <div className="mt-2 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={meses} barGap={2} barCategoryGap="22%">
                  <CartesianGrid stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="rotulo" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} {...estiloDaDica} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }} />
                  <Bar dataKey="entrados" name="Entrados" fill={COR_ENTRADOS} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="realizados" name="Realizados" fill={COR_REALIZADOS} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Conversão por coorte */}
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
              <p className="text-xs text-slate-400">Conversão dos 12 meses (realizados ÷ entrados, pelo mês de entrada):</p>
              <p className="text-sm font-bold text-white">{numeroCurto(d.conversao12Meses.valor)} %</p>
              <Variacao c={d.conversao12Meses} nota="12 meses anteriores" />
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1 pr-2 font-medium">Mês de entrada</th>
                    {d.meses.map((m) => (
                      <th key={m.mes} className="px-1 py-1 text-right font-medium">
                        {rotuloDoMes(m.mes)}
                        {m.emCurso ? " ·" : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  <tr>
                    <td className="py-1 pr-2 text-slate-400">Entrados</td>
                    {d.meses.map((m) => (
                      <td key={m.mes} className="px-1 py-1 text-right">{m.entrados}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-1 pr-2 text-slate-400">Feitos destes</td>
                    {d.meses.map((m) => (
                      <td key={m.mes} className="px-1 py-1 text-right">{m.realizadosDaCoorte}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-1 pr-2 text-slate-400">Cancelados</td>
                    {d.meses.map((m) => (
                      <td key={m.mes} className="px-1 py-1 text-right">{m.cancelados}</td>
                    ))}
                  </tr>
                  <tr className="font-semibold text-white">
                    <td className="py-1 pr-2">Conversão</td>
                    {d.meses.map((m) => (
                      <td key={m.mes} className="px-1 py-1 text-right">
                        {m.conversao == null ? "—" : `${Math.round(m.conversao)} %`}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Os meses recentes sobem com o tempo: há pedidos que ainda vão ser feitos.
            </p>
          </div>

          </div>

          <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
          {/* (b) Últimos 90 dias */}
          <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <h3 className="text-sm font-bold text-white">Últimos 90 dias</h3>
            <div className="mt-2 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.dias.map((x) => ({ ...x, rotulo: `${x.dia.slice(8, 10)}/${x.dia.slice(5, 7)}` }))}>
                  <CartesianGrid stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="rotulo"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval={14}
                  />
                  <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip {...estiloDaDica} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }} />
                  <Line type="monotone" dataKey="entrados" name="Entrados" stroke={COR_ENTRADOS} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="realizados" name="Realizados" stroke={COR_REALIZADOS} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* (c) Dias da semana × horas */}
          <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <h3 className="text-sm font-bold text-white">Quando entram os pedidos</h3>
            <p className="mt-1 text-xs text-slate-400">
              Últimos 12 meses, hora de Lisboa · {d.totalNoMapa} pedidos. Quanto mais forte, mais pedidos.
            </p>
            <div className="mt-3 overflow-x-auto">
              <div className="grid min-w-[560px] gap-[2px]" style={{ gridTemplateColumns: "32px repeat(24, minmax(0, 1fr))" }}>
                <span />
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="text-center text-[10px] text-slate-500">
                    {h % 3 === 0 ? `${h}h` : ""}
                  </span>
                ))}
                {d.mapa.map((linha, dia) => (
                  <div key={dia} className="contents">
                    <span className="pr-1 text-right text-[11px] leading-4 text-slate-400">{DIAS_DA_SEMANA[dia]}</span>
                    {linha.map((n, h) => (
                      <span
                        key={h}
                        title={`${DIAS_DA_SEMANA[dia]}, ${h}h–${h + 1}h: ${n} pedido${n === 1 ? "" : "s"}`}
                        className="h-4 rounded-[3px]"
                        style={{
                          background: n === 0 ? "#1e293b" : COR_ENTRADOS,
                          opacity: n === 0 ? 1 : 0.2 + 0.8 * (n / maxMapa),
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          </div>

          <p className="text-[11px] text-slate-500">
            {d.inicioDosDados
              ? `Dados desde ${d.inicioDosDados.split("-").reverse().join("/")} (inclui os pedidos já apagados pela retenção). `
              : ""}
            Sem contas de teste. Contas refeitas de 5 em 5 minutos.
          </p>
        </div>
      )}
    </section>
  );
}
