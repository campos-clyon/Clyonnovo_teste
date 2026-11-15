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
  type BlocoDoDesempenho,
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

function Variacao({ c }: { c: Comparacao }) {
  const cor =
    c.variacao == null
      ? "text-slate-500"
      : Math.round(c.variacao) > 0
        ? "text-esmeralda-texto"
        : Math.round(c.variacao) < 0
          ? "text-coral-texto"
          : "text-slate-400";
  return <span className={`text-xs font-semibold ${cor}`}>{fraseDaVariacao(c.variacao)}</span>;
}

function Numero({ rotulo, c, nota }: { rotulo: string; c: Comparacao; nota: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3">
      <p className="text-xs text-slate-400">{rotulo}</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xl font-bold text-white">
        {numeroCurto(c.valor)} <Variacao c={c} />
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        {nota}
        {c.anterior != null && c.variacao != null ? `: ${numeroCurto(c.anterior)}` : ""}
      </p>
    </div>
  );
}

function Bloco({
  titulo,
  cor,
  b,
  ano,
  rodape,
}: {
  titulo: string;
  cor: string;
  b: BlocoDoDesempenho;
  ano: number;
  rodape?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-white">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: cor }} aria-hidden="true" />
        {titulo}
      </h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Numero rotulo="Por dia (últimos 30 dias)" c={b.mediaPorDia} nota="30 dias anteriores" />
        <Numero
          rotulo={b.mesesNaMedia >= 12 ? "Por mês (últimos 12 meses)" : `Por mês (${b.mesesNaMedia} meses com dados)`}
          c={b.mediaPorMes}
          nota="12 meses anteriores"
        />
        <Numero
          rotulo={`${rotuloDoMes(b.mesHomologo.mes)} (último mês completo)`}
          c={b.mesHomologo}
          nota={rotuloDoMes(b.mesHomologo.mesAnterior)}
        />
        <Numero rotulo={`${ano} até hoje`} c={b.anoAteHoje} nota={`mesmo período de ${ano - 1}`} />
      </div>
      <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950/40 p-3">
        <p className="text-xs text-slate-400">Previsão até dezembro</p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xl font-bold text-white">
          {numeroCurto(b.previsaoDoAno.valor)} <Variacao c={b.previsaoDoAno} />
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          ao ritmo dos últimos 90 dias ({numeroCurto(b.ritmo90)} por dia) · contra {ano - 1}
          {b.previsaoDoAno.anterior != null && b.previsaoDoAno.variacao != null
            ? `: ${numeroCurto(b.previsaoDoAno.anterior)}`
            : ""}
        </p>
      </div>
      {rodape}
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
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-white">Desempenho</h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Serviço">
          {FILTROS_DO_DESEMPENHO.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
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
        <div className={`mt-4 space-y-4 ${aCarregar ? "opacity-60" : ""}`}>
          <div className="grid gap-3 lg:grid-cols-2">
            <Bloco
              titulo="Pedidos que entram"
              cor={COR_ENTRADOS}
              b={d.entrados}
              ano={d.ano}
              rodape={
                <p className="mt-2 text-xs text-slate-400">
                  Cancelados ou arquivados (à parte, pelo dia em que entraram): {d.cancelados.ultimos30} nos últimos 30
                  dias · {d.cancelados.ultimos12Meses} em 12 meses · {d.cancelados.anoAteHoje} em {d.ano}
                </p>
              }
            />
            <Bloco
              titulo="Trabalhos realizados"
              cor={COR_REALIZADOS}
              b={d.realizados}
              ano={d.ano}
              rodape={
                <p className="mt-2 text-xs text-slate-400">
                  Pelo dia em que o trabalho foi feito. Sem contas de teste, sem cancelados.
                </p>
              }
            />
          </div>

          {/* (a) Mês a mês */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
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
            <div className="mt-3 h-56">
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
              <Variacao c={d.conversao12Meses} />
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

          {/* (b) Últimos 90 dias */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h3 className="text-sm font-bold text-white">Últimos 90 dias</h3>
            <div className="mt-3 h-48">
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
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
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
                    <span className="pr-1 text-right text-[11px] leading-5 text-slate-400">{DIAS_DA_SEMANA[dia]}</span>
                    {linha.map((n, h) => (
                      <span
                        key={h}
                        title={`${DIAS_DA_SEMANA[dia]}, ${h}h–${h + 1}h: ${n} pedido${n === 1 ? "" : "s"}`}
                        className="h-5 rounded-[3px]"
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
