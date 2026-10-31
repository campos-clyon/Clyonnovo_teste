"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { GrelhaDeAgenda, type EventoDaAgenda } from "@/components/GrelhaDeAgenda";
import { corDaPessoa, tituloDoPeriodo } from "@/lib/agenda-em-grelha";
import {
  descricaoDaMarcacao,
  diaCurto,
  diasDaMarcacao,
  rotuloNoDia,
  type Marcacao,
} from "@/lib/agenda-das-assistentes";
import {
  dataEHoraEmLisboa,
  diaEmLisboa,
  doRelogioDeLisboa,
  horaEmLisboa,
  inicioDoDiaEmLisboa,
  instanteEmLisboa,
  noRelogioDeLisboa,
  pecasEmLisboa,
  primeiroDoMesSeguinte,
  somarDiasAoDia,
} from "@/lib/hora-de-lisboa";
import {
  ROTULO_DO_AVISO,
  duracaoEscrita,
  intervaloDaMarcacaoNoDia,
  type Aviso,
  type DiaDaPresenca,
} from "@/lib/presenca-do-backoffice";

type AssistenteNaPresenca = {
  id: number;
  nome: string;
  activo: boolean;
  totais: { hoje: number; semana: number; mes: number };
  activaAgora: boolean;
  dias: DiaDaPresenca[];
  semanas: Array<{ segunda: string; segundos: number }>;
  totalDoMes: number;
};

type Resposta = {
  mes: string;
  agora: string;
  minutosSemInteraccao: number;
  assistentes: AssistenteNaPresenca[];
  agendas: Marcacao[];
  ultimas: Marcacao[];
};

const COR_DO_AVISO: Record<Aviso, { faixa: string; texto: string }> = {
  avisou: { faixa: "bg-azul/30", texto: "text-azul-texto" },
  avisou_depois: { faixa: "bg-ambar/30", texto: "text-ambar-texto" },
  sem_aviso: { faixa: "bg-coral/30", texto: "text-coral-texto" },
};

const DIAS_DA_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** `AAAA-MM` do mês a seguir (ou antes). */
function outroMes(mes: string, sentido: 1 | -1): string {
  if (sentido === 1) return primeiroDoMesSeguinte(`${mes}-01`).slice(0, 7);
  return somarDiasAoDia(`${mes}-01`, -1).slice(0, 7);
}

/** O relógio de Lisboa dentro de um Date, para a grelha da agenda. */
function naGrelha(dia: string, hora = "00:00"): Date {
  return noRelogioDeLisboa(instanteEmLisboa(`${dia}T${hora}`) ?? inicioDoDiaEmLisboa(dia));
}

function intensidade(segundos: number): string {
  if (segundos <= 0) return "bg-slate-950/40";
  if (segundos < 2 * 3600) return "bg-esmeralda/14";
  if (segundos < 5 * 3600) return "bg-esmeralda/25";
  return "bg-esmeralda/40";
}

/**
 * «ASSISTENTES» → PRESENÇA E AGENDAS — 31-10-2026 (ordem do CEO e do dono).
 *
 * Só o administrador vê isto (e só ele chama /api/admin/presenca). Por
 * assistente: as horas activas de hoje, desta semana e deste mês; o mês dia a
 * dia; e a linha de um dia com os blocos, as ausências (vãos de 15 minutos ou
 * mais) e o que ela marcou na agenda — «avisou» ou «sem aviso». Por baixo, as
 * agendas de todas no calendário da Agenda, e as últimas marcações (o selo da
 * secção). Informação interna, sem efeito nenhum. Hora de Lisboa.
 */
export default function AdminPresencaPanel({ novasAoAbrir = 0 }: { novasAoAbrir?: number }) {
  const { token } = useAdminAuth();
  const [mes, setMes] = useState(() => diaEmLisboa(new Date()).slice(0, 7));
  const [dados, setDados] = useState<Resposta | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [quem, setQuem] = useState<number | null>(null);
  const [dia, setDia] = useState(() => diaEmLisboa(new Date()));
  const [marcacaoAberta, setMarcacaoAberta] = useState<number | null>(null);

  const carregar = useCallback(
    async (_silencioso = false) => {
      if (!token) return;
      try {
        const r = await fetch(`/api/admin/presenca?mes=${mes}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const j = (await r.json().catch(() => ({}))) as Partial<Resposta> & { error?: string };
        if (!r.ok || !Array.isArray(j.assistentes)) {
          setAviso(j.error ?? "Não foi possível ler a presença.");
          return;
        }
        setDados(j as Resposta);
        setAviso(null);
      } catch {
        setAviso("Não foi possível ler a presença.");
      }
    },
    [token, mes],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);
  useAutoRefresh(() => carregar(true), { enabled: Boolean(token) });

  const assistentes = dados?.assistentes ?? [];
  const escolhida = assistentes.find((a) => a.id === quem) ?? assistentes.find((a) => a.activo) ?? assistentes[0];
  const nomes = useMemo(() => new Map(assistentes.map((a) => [a.id, a.nome])), [assistentes]);

  // O dia escolhido tem de ser do mês à vista.
  const diaAVer = dia.slice(0, 7) === mes ? dia : `${mes}-01`;
  const doDia = escolhida?.dias.find((d) => d.dia === diaAVer) ?? null;
  const marcacoesDoDia = (dados?.agendas ?? []).filter(
    (m) => m.colaboradorId === escolhida?.id && diasDaMarcacao(m).includes(diaAVer),
  );

  const eventos: EventoDaAgenda[] = useMemo(() => {
    const lista: EventoDaAgenda[] = [];
    for (const m of dados?.agendas ?? []) {
      diasDaMarcacao(m).forEach((d, i) => {
        const nome = nomes.get(m.colaboradorId) ?? "Assistente";
        // A hora vai na etiqueta do mês; o título diz o quê e quem.
        const titulo = `${m.tipo === "dia" ? "Folga" : "Ausente"} · ${nome}`;
        const etiqueta = m.tipo !== "parte" ? "dia" : m.ateHora ? rotuloNoDia(m) : `desde ${m.deHora}`;
        lista.push({
          // Um bloco por dia da marcação; o id leva o dia para não repetir.
          id: m.id * 100 + i,
          inicio: naGrelha(d, m.tipo === "parte" && m.deHora ? m.deHora : "00:00"),
          titulo,
          linha2: m.nota,
          cor: corDaPessoa(m.colaboradorId),
          fixo: true,
          etiquetaDaHora: etiqueta,
          rotuloAcessivel: `${nome}: ${descricaoDaMarcacao(m)}${m.nota ? ` — ${m.nota}` : ""}`,
        });
      });
    }
    return lista;
  }, [dados?.agendas, nomes]);

  const aberta = (dados?.agendas ?? []).find((m) => m.id === marcacaoAberta) ?? null;

  if (!dados) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        {aviso ?? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A ler a presença…
          </>
        )}
      </div>
    );
  }

  const tituloDoMes = tituloDoPeriodo("mes", naGrelha(`${mes}-15`, "12:00"));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-white">Presença e agendas</h3>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Informação interna, sem efeito nenhum: os períodos em que cada assistente esteve activa no backoffice (com um
          clique, uma tecla ou um scroll nos últimos {dados.minutosSemInteraccao} minutos) e o que marcou na agenda dela.
          Uma ausência é um intervalo de {dados.minutosSemInteraccao} minutos ou mais entre dois períodos. Hora de Lisboa.
          A assistente vê a agenda dela, mas não estas horas.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const hoje = diaEmLisboa(new Date());
            setMes(hoje.slice(0, 7));
            setDia(hoje);
          }}
          className="min-h-[36px] rounded-full border border-slate-700 bg-slate-950 px-4 text-sm font-semibold text-slate-200 hover:bg-slate-800"
        >
          Hoje
        </button>
        <button
          type="button"
          onClick={() => setMes((m) => outroMes(m, -1))}
          aria-label="Mês anterior"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setMes((m) => outroMes(m, 1))}
          aria-label="Mês seguinte"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="text-base font-semibold text-white">{tituloDoMes}</span>
        {aviso && <span className="text-xs text-coral-texto">{aviso}</span>}
      </div>

      {assistentes.length === 0 ? (
        <p className="text-sm text-slate-400">Ainda não há contas de assistente.</p>
      ) : (
        <>
          {assistentes.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Assistente">
              {assistentes.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={escolhida?.id === a.id}
                  onClick={() => setQuem(a.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    escolhida?.id === a.id
                      ? "bg-sky-500 text-white"
                      : "border border-slate-700 text-slate-300 hover:bg-slate-800"
                  } ${a.activo ? "" : "opacity-60"}`}
                >
                  {a.nome}
                </button>
              ))}
            </div>
          )}

          {escolhida && (
            <div className="space-y-4 rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-white">{escolhida.nome}</p>
                {escolhida.activaAgora && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-esmeralda-texto">
                    <span className="h-2 w-2 rounded-full bg-esmeralda" aria-hidden="true" /> activa agora
                  </span>
                )}
                {!escolhida.activo && <span className="text-xs text-slate-500">conta desactivada</span>}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["Hoje", escolhida.totais.hoje],
                    ["Esta semana", escolhida.totais.semana],
                    ["Este mês", escolhida.totais.mes],
                  ] as const
                ).map(([rotulo, s]) => (
                  <div key={rotulo} className="rounded-xl border border-slate-700/60 bg-slate-900 px-3 py-2">
                    <p className="text-[11px] font-medium text-slate-400">{rotulo}</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">{duracaoEscrita(s)}</p>
                  </div>
                ))}
              </div>

              <MesDiaADia
                mes={mes}
                pessoa={escolhida}
                agendas={(dados.agendas ?? []).filter((m) => m.colaboradorId === escolhida.id)}
                diaAVer={diaAVer}
                onDia={setDia}
              />

              <LinhaDoDia dia={diaAVer} doDia={doDia} marcacoes={marcacoesDoDia} />
            </div>
          )}
        </>
      )}

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">As agendas de todas</h3>
        <GrelhaDeAgenda
          vista="mes"
          ancora={naGrelha(`${mes}-15`, "12:00")}
          eventos={eventos}
          agora={noRelogioDeLisboa(new Date())}
          tema="escuro"
          onAbrir={(id) => setMarcacaoAberta(Math.floor(id / 100))}
          onIrParaDia={(d) => {
            const instante = doRelogioDeLisboa(d);
            if (!instante) return;
            const escolhido = diaEmLisboa(instante);
            setDia(escolhido);
            setMes(escolhido.slice(0, 7));
          }}
        />
        {aberta && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900 px-3 py-2 text-sm">
            <p className="font-semibold text-white">
              {nomes.get(aberta.colaboradorId) ?? "Assistente"} · {descricaoDaMarcacao(aberta)}
            </p>
            {aberta.nota && <p className="mt-0.5 text-slate-300">{aberta.nota}</p>}
            <p className="mt-0.5 text-xs text-slate-500">
              Marcada a {dataEHoraEmLisboa(new Date(aberta.criadaEm))}
              {aberta.actualizadaEm !== aberta.criadaEm
                ? ` · alterada a ${dataEHoraEmLisboa(new Date(aberta.actualizadaEm))}`
                : ""}
            </p>
          </div>
        )}
      </div>

      {dados.ultimas.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-white">Últimas marcações</h3>
          <ul className="space-y-1.5">
            {dados.ultimas.map((m, i) => (
              <li
                key={m.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-sm"
              >
                <span className="min-w-0 text-slate-200">
                  {i < novasAoAbrir && (
                    <span className="mr-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      nova
                    </span>
                  )}
                  <span className="font-semibold text-white">{nomes.get(m.colaboradorId) ?? "Assistente"}</span> ·{" "}
                  {descricaoDaMarcacao(m)}
                  {m.nota ? <span className="text-slate-400"> — {m.nota}</span> : null}
                </span>
                <span className="text-xs text-slate-500">
                  {m.actualizadaEm !== m.criadaEm ? "alterada a " : "marcada a "}
                  {dataEHoraEmLisboa(new Date(m.actualizadaEm))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** O mês da assistente: as semanas em linhas, cada dia com as horas, e o total da semana. */
function MesDiaADia({
  mes,
  pessoa,
  agendas,
  diaAVer,
  onDia,
}: {
  mes: string;
  pessoa: AssistenteNaPresenca;
  agendas: Marcacao[];
  diaAVer: string;
  onDia: (dia: string) => void;
}) {
  const porDia = new Map(pessoa.dias.map((d) => [d.dia, d]));
  const marcados = new Set(agendas.flatMap((m) => diasDaMarcacao(m)));
  const hoje = diaEmLisboa(new Date());
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/60">
      <div className="grid grid-cols-8 border-b border-slate-800 bg-slate-900 text-center text-[10px] font-semibold text-slate-500">
        {DIAS_DA_SEMANA.map((n) => (
          <div key={n} className="py-1.5">
            {n}
          </div>
        ))}
        <div className="py-1.5">Semana</div>
      </div>
      {pessoa.semanas.map((s) => (
        <div key={s.segunda} className="grid grid-cols-8 border-b border-slate-800 last:border-b-0">
          {Array.from({ length: 7 }, (_, i) => somarDiasAoDia(s.segunda, i)).map((d) => {
            const doMes = d.slice(0, 7) === mes;
            const info = porDia.get(d);
            const segundos = info?.segundos ?? 0;
            return (
              <button
                key={d}
                type="button"
                disabled={!doMes}
                onClick={() => onDia(d)}
                aria-label={`${diaCurto(d)}: ${duracaoEscrita(segundos)}${marcados.has(d) ? ", com marcação na agenda" : ""}`}
                className={`relative min-h-[3.25rem] border-l border-slate-800 px-1 py-1 text-left first:border-l-0 ${
                  doMes ? intensidade(segundos) : "bg-slate-950/70 opacity-40"
                } ${d === diaAVer ? "ring-2 ring-inset ring-sky-400" : ""}`}
              >
                <span className={`block text-[11px] font-semibold ${d === hoje ? "text-sky-300" : "text-slate-400"}`}>
                  {Number(d.slice(8, 10))}
                </span>
                {doMes && segundos > 0 && (
                  <span className="block text-[10px] font-semibold tabular-nums text-white sm:text-[11px]">
                    {duracaoEscrita(segundos).replace(" min", "m").replace(" h", "h")}
                  </span>
                )}
                {doMes && marcados.has(d) && (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-violeta" aria-hidden="true" />
                )}
              </button>
            );
          })}
          <div className="flex items-center justify-center border-l border-slate-800 bg-slate-900 px-1 text-[10px] font-semibold tabular-nums text-slate-200 sm:text-[11px]">
            {duracaoEscrita(s.segundos).replace(" min", "m").replace(" h", "h")}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between bg-slate-900 px-3 py-1.5 text-xs text-slate-400">
        <span>Total do mês</span>
        <span className="font-semibold tabular-nums text-white">{duracaoEscrita(pessoa.totalDoMes)}</span>
      </div>
    </div>
  );
}

/** A linha de um dia: os períodos activos, as ausências entre eles e o que estava na agenda. */
function LinhaDoDia({
  dia,
  doDia,
  marcacoes,
}: {
  dia: string;
  doDia: DiaDaPresenca | null;
  marcacoes: Marcacao[];
}) {
  const base = inicioDoDiaEmLisboa(dia).getTime();
  const fimDoDia = inicioDoDiaEmLisboa(somarDiasAoDia(dia, 1)).getTime();
  const minutos = (iso: string) => (Date.parse(iso) - base) / 60_000;
  const blocos = doDia?.blocos ?? [];
  const ausencias = doDia?.ausencias ?? [];
  const intervalos = marcacoes
    .map((m) => ({ m, i: intervaloDaMarcacaoNoDia(m, dia) }))
    .filter((x): x is { m: Marcacao; i: NonNullable<typeof x.i> } => x.i !== null);

  const comprimento = (fimDoDia - base) / 60_000;
  const pontas = blocos.flatMap((b) => [minutos(b.de), minutos(b.ate)]);
  const de = Math.max(0, Math.min(8 * 60, ...pontas.map((m) => Math.floor(m / 60) * 60)));
  const ate = Math.min(comprimento, Math.max(20 * 60, ...pontas.map((m) => Math.ceil(m / 60) * 60)));
  const largura = Math.max(60, ate - de);
  const posicao = (m: number) => `${(Math.min(Math.max(m, de), ate) - de) / largura * 100}%`;
  const tamanho = (a: number, b: number) =>
    `${Math.max(0.4, ((Math.min(Math.max(b, de), ate) - Math.min(Math.max(a, de), ate)) / largura) * 100)}%`;
  const marcas: number[] = [];
  for (let m = Math.ceil(de / 120) * 120; m <= ate; m += 120) marcas.push(m);

  const [ano, mesN, diaN] = dia.split("-").map(Number);
  const diaDaSemana = DIAS_DA_SEMANA[(pecasEmLisboa(new Date(base + 12 * 3600_000)).diaDaSemana + 6) % 7];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-white">
          {diaDaSemana}, {String(diaN).padStart(2, "0")}/{String(mesN).padStart(2, "0")}/{ano}
        </p>
        <p className="text-sm tabular-nums text-slate-300">
          Activa {duracaoEscrita(doDia?.segundos ?? 0)}
          {ausencias.length > 0 ? ` · ${ausencias.length} ${ausencias.length === 1 ? "ausência" : "ausências"}` : ""}
        </p>
      </div>

      <div>
        <div className="relative h-7 overflow-hidden rounded-lg bg-slate-900" aria-hidden="true">
          {ausencias.map((a) => (
            <div
              key={`a-${a.de}`}
              className={`absolute inset-y-0 ${COR_DO_AVISO[a.aviso].faixa}`}
              style={{ left: posicao(minutos(a.de)), width: tamanho(minutos(a.de), minutos(a.ate)) }}
            />
          ))}
          {blocos.map((b) => (
            <div
              key={`b-${b.de}`}
              className="absolute inset-y-1 rounded bg-esmeralda/80"
              style={{ left: posicao(minutos(b.de)), width: tamanho(minutos(b.de), minutos(b.ate)) }}
            />
          ))}
        </div>
        <div className="relative mt-1 h-3" aria-hidden="true">
          {intervalos.map(({ m, i }) => (
            <div
              key={`m-${m.id}`}
              className="absolute inset-y-0 rounded bg-violeta/50"
              style={{
                left: posicao((i.inicioEm.getTime() - base) / 60_000),
                width: tamanho((i.inicioEm.getTime() - base) / 60_000, (i.fimEm.getTime() - base) / 60_000),
              }}
            />
          ))}
        </div>
        <div className="relative mt-1 h-4 text-[10px] tabular-nums text-slate-500" aria-hidden="true">
          {marcas.map((m) => (
            <span key={m} className="absolute -translate-x-1/2" style={{ left: posicao(m) }}>
              {horaEmLisboa(new Date(base + m * 60_000))}
            </span>
          ))}
        </div>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-esmeralda/80" /> activa
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-violeta/50" /> na agenda
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-azul/30" /> ausência avisada
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-ambar/30" /> avisada depois
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-coral/30" /> sem aviso
          </span>
        </p>
      </div>

      {blocos.length === 0 && intervalos.length === 0 ? (
        <p className="text-sm text-slate-400">Sem actividade nem marcações neste dia.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {[
            ...blocos.map((b) => ({ de: b.de, el: (
              <li key={`lb-${b.de}`} className="flex flex-wrap justify-between gap-2 text-slate-200">
                <span className="tabular-nums">
                  {horaEmLisboa(new Date(b.de))}–{horaEmLisboa(new Date(b.ate))}
                </span>
                <span className="tabular-nums text-esmeralda-texto">activa {duracaoEscrita(b.segundos)}</span>
              </li>
            ) })),
            ...ausencias.map((a) => ({ de: a.de, el: (
              <li key={`la-${a.de}`} className="flex flex-wrap justify-between gap-2 text-slate-400">
                <span className="tabular-nums">
                  {horaEmLisboa(new Date(a.de))}–{horaEmLisboa(new Date(a.ate))}
                </span>
                <span className={COR_DO_AVISO[a.aviso].texto}>
                  ausência {duracaoEscrita(a.minutos * 60)} · {ROTULO_DO_AVISO[a.aviso]}
                </span>
              </li>
            ) })),
          ]
            .sort((x, y) => x.de.localeCompare(y.de))
            .map((x) => x.el)}
          {intervalos.map(({ m }) => (
            <li key={`lm-${m.id}`} className="flex flex-wrap justify-between gap-2 text-violeta-texto">
              <span>Na agenda: {descricaoDaMarcacao(m)}</span>
              <span className="text-xs text-slate-500">
                marcada a {dataEHoraEmLisboa(new Date(m.criadaEm))}
                {m.nota ? ` · ${m.nota}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
