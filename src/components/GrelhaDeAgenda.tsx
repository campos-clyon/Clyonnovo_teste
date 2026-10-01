"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  ALTURA_DA_HORA,
  DIAS_CURTOS,
  DURACAO_PADRAO_MIN,
  VISTAS,
  andar,
  chaveDoDia,
  colunaDoDia,
  diaPorExtenso,
  diasDaVista,
  dispor,
  horaCurta,
  horaNoAlvo,
  instanteDaChave,
  janelaDeHoras,
  mesmoDia,
  minutosDoDia,
  semanasDoMes,
  tituloDoPeriodo,
  vistaValida,
  type Cor,
  type Vista,
} from "@/lib/agenda-em-grelha";
import { noRelogioDeLisboa } from "@/lib/hora-de-lisboa";

/**
 * A AGENDA EM GRELHA — a mesma para o profissional e para o backoffice.
 *
 * As contas vivem em `agenda-em-grelha.ts`; aqui só se desenha. Os dois sítios
 * passam os trabalhos já traduzidos para `EventoDaAgenda` e dizem o que fazer
 * quando se toca num: o profissional abre o cartão com o telefone e o «Pôr no
 * calendário»; o backoffice abre a ficha do trabalho. A grelha não sabe de
 * nenhum dos dois.
 */

export type EventoDaAgenda = {
  id: number;
  inicio: Date;
  /** O serviço — a primeira coisa que se lê num bloco. */
  titulo: string;
  /** O cliente, ou o profissional — quem. */
  linha2?: string | null;
  /** A morada ou a localidade — só cabe na vista de um dia. */
  linha3?: string | null;
  /** O valor já escrito — só na vista de um dia. */
  valor?: string | null;
  cor: Cor;
  /** «atrasado», «a hora passou» — um anel vermelho e a palavra ao lado da hora. */
  alerta?: string | null;
  /** Um trabalho já feito: fica no sítio, mais apagado. */
  apagado?: boolean;
  /** Não se arrasta — um trabalho já feito, cuja data é o que aconteceu. */
  fixo?: boolean;
  /** O que um leitor de ecrã diz ao chegar ao bloco. */
  rotuloAcessivel: string;
};

export type TemaDaAgenda = "claro" | "escuro";

/*
 * AS CORES DE CADA FUNDO, num sítio só.
 *
 * Escritas por extenso porque o Tailwind só gera as classes que encontra
 * escritas — uma classe montada aos bocados não chegava ao CSS.
 */
const TEMAS = {
  claro: {
    caixa: "border-[#E2EEF3] bg-white",
    linha: "border-[#E2EEF3]",
    linhaDaHora: "border-[#EEF3F6]",
    texto: "text-tinta",
    textoFraco: "text-tinta-fraca",
    hojeNumero: "bg-acao text-white",
    hojeDia: "text-acao",
    numero: "text-tinta hover:bg-slate-100",
    foraDoMes: "bg-slate-50/80 text-slate-400",
    chip: "text-tinta hover:bg-slate-100",
    botao: "border-[#E2EEF3] bg-white text-tinta hover:bg-slate-50",
    seta: "text-tinta hover:bg-slate-100",
    segmentos: "border-[#E2EEF3] bg-white",
    segmentoActivo: "bg-acao text-white shadow-sm",
    segmentoInactivo: "text-tinta-fraca hover:text-tinta",
    anel: "focus-visible:ring-acao",
    alerta: "text-rose-700",
  },
  escuro: {
    caixa: "border-slate-700/70 bg-slate-950/60",
    linha: "border-slate-800",
    linhaDaHora: "border-slate-800/70",
    texto: "text-white",
    textoFraco: "text-slate-500",
    /*
     * Ciano em HEXADECIMAL: o `globals.css` impõe a cor do texto a alguns
     * botões ciano, e na grelha a cor escolhe-se aqui. Ver a nota da paleta
     * em `agenda-em-grelha.ts`.
     */
    hojeNumero: "bg-[#22D3EE] text-[#020617]",
    hojeDia: "text-cyan-400",
    numero: "text-slate-200 hover:bg-slate-800",
    foraDoMes: "bg-slate-900/50 text-slate-600",
    chip: "text-slate-200 hover:bg-slate-800",
    botao: "border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800",
    seta: "text-slate-300 hover:bg-slate-800",
    segmentos: "border-slate-700 bg-slate-950",
    /* O seleccionado do backoffice: tingido e com anel, como os cartões de filtro. */
    segmentoActivo: "bg-[#22D3EE]/15 text-[#A5F3FC] ring-1 ring-inset ring-[#22D3EE]/60",
    segmentoInactivo: "text-slate-400 hover:text-white",
    anel: "focus-visible:ring-cyan-400",
    alerta: "text-rose-300",
  },
} as const;

/** Espaço por cima da primeira hora e por baixo da última, para as etiquetas caberem. */
const MARGEM = 10;

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/**
 * A VISTA ESCOLHIDA FICA ESCOLHIDA — e a primeira depende do ecrã.
 *
 * Num ecrã largo abre na semana, que é a vista do Google que veio de exemplo.
 * Num telemóvel, sete colunas são sete tiras de quatro centímetros onde não
 * cabe uma palavra: abre no dia. Quem escolher outra coisa fica com o que
 * escolheu — guardado no próprio telemóvel, e só lá.
 *
 * Decide-se DEPOIS de montar: no servidor não há ecrã nenhum para medir, e
 * decidir lá dava uma vista no HTML e outra no telemóvel.
 */
export function useVistaDaAgenda(
  chave: string,
  porOmissao: { largo: Vista; estreito: Vista } = { largo: "semana", estreito: "dia" },
): [Vista, (v: Vista) => void] {
  const { largo, estreito } = porOmissao;
  const [vista, setVista] = useState<Vista>(largo);

  useEffect(() => {
    let escolhida: Vista | null = null;
    try {
      const guardada = window.localStorage.getItem(chave);
      if (vistaValida(guardada)) escolhida = guardada;
    } catch {
      /* Sem armazenamento (janela privada, bloqueado): fica a do ecrã. */
    }
    if (!escolhida) {
      try {
        escolhida = window.matchMedia("(min-width: 640px)").matches ? largo : estreito;
      } catch {
        escolhida = largo;
      }
    }
    setVista(escolhida);
  }, [chave, largo, estreito]);

  const mudar = useCallback(
    (v: Vista) => {
      setVista(v);
      try {
        window.localStorage.setItem(chave, v);
      } catch {
        /* A escolha vale para esta visita; da próxima volta a do ecrã. */
      }
    },
    [chave],
  );

  return [vista, mudar];
}

/**
 * O relógio da linha vermelha do «agora» — acerta-se de minuto a minuto.
 *
 * NO RELÓGIO DE LISBOA (01-10-2026), como tudo o que entra na grelha: ela lê
 * `getHours()` e `getDate()`, e do Brasil o «agora» ficava quatro horas atrás
 * dos trabalhos. Ver `noRelogioDeLisboa`.
 */
export function useAgora(): Date {
  const [agora, setAgora] = useState(() => noRelogioDeLisboa(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setAgora(noRelogioDeLisboa(new Date())), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return agora;
}

const SETAS: Record<Exclude<Vista, "lista">, [string, string]> = {
  dia: ["Dia anterior", "Dia seguinte"],
  semana: ["Semana anterior", "Semana seguinte"],
  mes: ["Mês anterior", "Mês seguinte"],
};

/**
 * A BARRA DE CIMA: «Hoje», as setas, o período e a vista.
 *
 * É a barra do Google, peça por peça, e pela mesma razão: quem abre uma agenda
 * pergunta primeiro «onde estou?» — o título — e depois «como volto a hoje?».
 */
export function BarraDaAgenda({
  vista,
  ancora,
  tema,
  onVista,
  onAncora,
}: {
  vista: Vista;
  ancora: Date;
  tema: TemaDaAgenda;
  onVista: (v: Vista) => void;
  onAncora: (d: Date) => void;
}) {
  const t = TEMAS[tema];
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
      {vista !== "lista" && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAncora(noRelogioDeLisboa(new Date()))}
            className={`min-h-[40px] rounded-full border px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 ${t.botao} ${t.anel}`}
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => onAncora(andar(vista, ancora, -1))}
            aria-label={SETAS[vista][0]}
            title={SETAS[vista][0]}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 ${t.seta} ${t.anel}`}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onAncora(andar(vista, ancora, 1))}
            aria-label={SETAS[vista][1]}
            title={SETAS[vista][1]}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 ${t.seta} ${t.anel}`}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      <h2 aria-live="polite" className={`min-w-0 flex-1 truncate text-lg font-semibold ${t.texto}`}>
        {tituloDoPeriodo(vista, ancora)}
      </h2>

      <div
        role="group"
        aria-label="Como ver a agenda"
        className={`flex w-full rounded-full border p-0.5 sm:w-auto ${t.segmentos}`}
      >
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onVista(v.id)}
            aria-pressed={vista === v.id}
            className={`min-h-[36px] flex-1 rounded-full px-3.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 sm:flex-none ${t.anel} ${
              vista === v.id ? t.segmentoActivo : t.segmentoInactivo
            }`}
          >
            {v.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

/** O que está a ser arrastado agora, e para onde — para desenhar a sombra. */
type Arrasto = {
  id: number;
  /** O dia por baixo do rato (`chaveDoDia`), ou null fora da grelha. */
  dia: string | null;
  /** A hora onde o trabalho cai, em minutos; null no mês, que só muda o dia. */
  minutos: number | null;
};

/**
 * ARRASTAR UM TRABALHO PARA OUTRO DIA OU OUTRA HORA — e gravar ao largar.
 *
 * *«Quero também poder puxar/arrastar esses agendamentos para mudar sua data e
 * horário como na agenda, e eles salvarem automático ao soltar.»* — 01-10-2026.
 *
 * COMO SE DECIDE O ALVO: cada coluna de dia tem `data-dia`, e as colunas de
 * horas têm também a janela de horas que mostram. Debaixo do rato procura-se a
 * coluna (`elementFromPoint` + `closest`), e a altura dentro dela dá a hora —
 * encaixada ao quarto de hora, em `horaNoAlvo`.
 *
 * UM CLIQUE CONTINUA A SER UM CLIQUE. Só é arrasto a partir de seis píxeis de
 * movimento; abaixo disso, largar abre o trabalho como sempre. E o clique que o
 * browser dispara depois de um arrasto é engolido — sem isso, largar um
 * trabalho abria-o logo a seguir.
 *
 * ⚠️ SÓ COM RATO OU CANETA, e não com o dedo. Num telemóvel, um dedo que
 * começa num bloco está quase sempre a querer fazer deslizar a página; tomar
 * esse gesto como arrasto prendia a agenda de cada vez que alguém a percorria.
 * No telemóvel muda-se pelo «Mudar o dia ou a hora» do cartão, que já existia.
 *
 * Um trabalho `fixo` (já feito) não se arrasta: mudar-lhe a data é reescrever
 * o que aconteceu.
 */
function useArrastar(onMover: ((id: number, novoInicio: Date) => void) | undefined) {
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const engolirClique = useRef(false);

  const aoPressionar = useCallback(
    (
      e: React.PointerEvent<HTMLElement>,
      ev: EventoDaAgenda,
      comHoras: { janela: { de: number; ate: number } } | null,
    ) => {
      if (!onMover || ev.fixo || e.button !== 0 || e.pointerType === "touch") return;
      const bloco = e.currentTarget.getBoundingClientRect();
      const agarraMin = comHoras ? ((e.clientY - bloco.top) / ALTURA_DA_HORA) * 60 : 0;
      const x0 = e.clientX;
      const y0 = e.clientY;
      let activo = false;
      let alvo: Arrasto | null = null;

      const alvoEm = (x: number, y: number): Arrasto => {
        const coluna = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-dia]") ?? null;
        if (!coluna?.dataset.dia) return { id: ev.id, dia: null, minutos: null };
        if (!comHoras) return { id: ev.id, dia: coluna.dataset.dia, minutos: null };
        const r = coluna.getBoundingClientRect();
        return {
          id: ev.id,
          dia: coluna.dataset.dia,
          minutos: horaNoAlvo({ y: y - r.top, margem: MARGEM, janela: comHoras.janela, agarraMin }),
        };
      };

      const mover = (m: PointerEvent) => {
        if (!activo) {
          if (Math.hypot(m.clientX - x0, m.clientY - y0) < 6) return;
          activo = true;
          document.body.style.userSelect = "none";
          document.body.style.cursor = "grabbing";
        }
        alvo = alvoEm(m.clientX, m.clientY);
        setArrasto(alvo);
      };

      const arrumar = () => {
        window.removeEventListener("pointermove", mover);
        window.removeEventListener("pointerup", largar);
        window.removeEventListener("pointercancel", desistir);
        window.removeEventListener("keydown", tecla);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        setArrasto(null);
      };

      const largar = () => {
        arrumar();
        if (!activo) return;
        // O clique que vem logo a seguir ao largar não é um clique.
        engolirClique.current = true;
        window.setTimeout(() => {
          engolirClique.current = false;
        }, 0);
        if (!alvo?.dia) return;
        const minutos = alvo.minutos ?? minutosDoDia(ev.inicio);
        const novo = instanteDaChave(alvo.dia, minutos);
        if (novo && novo.getTime() !== ev.inicio.getTime()) onMover(ev.id, novo);
      };

      const desistir = () => {
        activo = false;
        arrumar();
      };

      /* Escape a meio do arrasto: o trabalho volta para onde estava, e nada se grava. */
      const tecla = (k: KeyboardEvent) => {
        if (k.key === "Escape" && activo) {
          engolirClique.current = true;
          window.setTimeout(() => {
            engolirClique.current = false;
          }, 0);
          desistir();
        }
      };

      window.addEventListener("pointermove", mover);
      window.addEventListener("pointerup", largar);
      window.addEventListener("pointercancel", desistir);
      window.addEventListener("keydown", tecla);
    },
    [onMover],
  );

  const deveEngolirClique = useCallback(() => engolirClique.current, []);

  return { arrasto, aoPressionar, deveEngolirClique };
}

/** A grelha: as horas de um dia ou de uma semana, ou o mês. */
export function GrelhaDeAgenda({
  vista,
  ancora,
  eventos,
  agora,
  tema,
  onAbrir,
  onIrParaDia,
  onMover,
}: {
  vista: "dia" | "semana" | "mes";
  ancora: Date;
  eventos: EventoDaAgenda[];
  agora: Date;
  tema: TemaDaAgenda;
  onAbrir: (id: number) => void;
  onIrParaDia: (d: Date) => void;
  /**
   * Largar um trabalho noutro dia ou noutra hora. Sem isto, a grelha não deixa
   * arrastar nada — é só para ver.
   */
  onMover?: (id: number, novoInicio: Date) => void;
}) {
  const t = TEMAS[tema];
  const { arrasto, aoPressionar, deveEngolirClique } = useArrastar(onMover);
  const abrir = (id: number) => {
    if (deveEngolirClique()) return;
    onAbrir(id);
  };

  if (vista === "mes") {
    return (
      <Mes
        ancora={ancora}
        eventos={eventos}
        agora={agora}
        tema={tema}
        onAbrir={abrir}
        onIrParaDia={onIrParaDia}
        arrasto={arrasto}
        aoPressionar={onMover ? aoPressionar : null}
      />
    );
  }

  const dias = diasDaVista(vista, ancora);
  const doPeriodo = eventos.filter((e) => dias.some((d) => mesmoDia(d, e.inicio)));
  const janela = janelaDeHoras(doPeriodo.map((e) => e.inicio));
  const { de, ate } = janela;
  const horas = Array.from({ length: ate - de + 1 }, (_, i) => de + i);
  const altura = (ate - de) * ALTURA_DA_HORA + MARGEM * 2;
  /*
   * A coluna das horas encolhe no telemóvel: «07:00» cabe em 44 px, e cada
   * píxel que sai dali vai para os sete dias, que no telemóvel são estreitos.
   */
  const colunas = `var(--sarjeta) repeat(${dias.length}, minmax(0, 1fr))`;
  const largo = vista === "dia";
  const aArrastar = arrasto ? eventos.find((e) => e.id === arrasto.id) ?? null : null;

  return (
    <div className={`overflow-hidden rounded-2xl border [--sarjeta:2.75rem] sm:[--sarjeta:3.5rem] ${t.caixa}`}>
      {/* Os dias, em cima: «SEG.» e o número, como no Google. */}
      <div className="grid" style={{ gridTemplateColumns: colunas }}>
        <div className={`border-b ${t.linha}`} />
        {dias.map((d) => {
          const hoje = mesmoDia(d, agora);
          const conteudo = (
            <>
              <span className={`text-[11px] font-semibold tracking-wide ${hoje ? t.hojeDia : t.textoFraco}`}>
                {DIAS_CURTOS[colunaDoDia(d)]}
              </span>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-lg font-medium transition ${
                  hoje ? t.hojeNumero : t.numero
                }`}
              >
                {d.getDate()}
              </span>
            </>
          );
          return largo ? (
            <div key={d.getTime()} className={`flex flex-col items-center gap-1 border-b border-l py-2 ${t.linha}`}>
              {conteudo}
            </div>
          ) : (
            /* Tocar no dia abre esse dia — também como no Google. */
            <button
              key={d.getTime()}
              type="button"
              onClick={() => onIrParaDia(d)}
              aria-label={`Ver ${diaPorExtenso(d)}`}
              className={`flex flex-col items-center gap-1 border-b border-l py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset ${t.linha} ${t.anel}`}
            >
              {conteudo}
            </button>
          );
        })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: colunas }}>
        {/* As horas, à esquerda, centradas na linha a que pertencem. */}
        <div className="relative" style={{ height: altura }} aria-hidden="true">
          {horas.map((h, i) => (
            <span
              key={h}
              className={`absolute right-2 -translate-y-1/2 text-[11px] tabular-nums ${t.textoFraco}`}
              style={{ top: MARGEM + i * ALTURA_DA_HORA }}
            >
              {doisDigitos(h)}:00
            </span>
          ))}
        </div>

        {dias.map((d) => {
          const chave = chaveDoDia(d);
          const doDia = doPeriodo.filter((e) => mesmoDia(e.inicio, d));
          const dispostos = dispor(
            doDia.map((e) => {
              const m = minutosDoDia(e.inicio);
              return { item: e, inicioMin: m, fimMin: Math.min(24 * 60, m + DURACAO_PADRAO_MIN) };
            }),
          );
          const hoje = mesmoDia(d, agora);
          const agoraMin = minutosDoDia(agora);
          const agoraVisivel = hoje && agoraMin >= de * 60 && agoraMin <= ate * 60;
          const sombraAqui =
            arrasto && aArrastar && arrasto.dia === chave && arrasto.minutos != null ? arrasto.minutos : null;

          return (
            <div
              key={d.getTime()}
              role="group"
              data-dia={chave}
              aria-label={`${diaPorExtenso(d)}: ${doDia.length === 0 ? "nada marcado" : `${doDia.length} trabalho${doDia.length === 1 ? "" : "s"}`}`}
              className={`relative border-l ${t.linha}`}
              style={{ height: altura }}
            >
              {horas.map((h, i) => (
                <div
                  key={h}
                  aria-hidden="true"
                  className={`absolute inset-x-0 border-t ${t.linhaDaHora}`}
                  style={{ top: MARGEM + i * ALTURA_DA_HORA }}
                />
              ))}

              {dispostos.map(({ item: e, inicioMin, fimMin, coluna, colunas: n }) => {
                const topo = MARGEM + ((inicioMin - de * 60) / 60) * ALTURA_DA_HORA;
                const alturaDoBloco = Math.max(24, ((fimMin - inicioMin) / 60) * ALTURA_DA_HORA - 2);
                const arrastavel = Boolean(onMover) && !e.fixo;
                const esteSai = arrasto?.id === e.id && arrasto.dia != null;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => abrir(e.id)}
                    onPointerDown={(p) => aoPressionar(p, e, { janela })}
                    aria-label={e.rotuloAcessivel}
                    title={arrastavel ? `${e.rotuloAcessivel} — arraste para mudar o dia ou a hora` : e.rotuloAcessivel}
                    className={`absolute z-[1] overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left leading-tight shadow-sm transition hover:z-[2] hover:shadow-md focus:outline-none focus-visible:z-[2] focus-visible:ring-2 ${t.anel} ${
                      tema === "claro" ? e.cor.bloco : e.cor.blocoEscuro
                    } ${e.alerta ? "ring-2 ring-rose-500" : ""} ${e.apagado ? "opacity-50" : ""} ${
                      arrastavel ? "cursor-grab active:cursor-grabbing" : ""
                    } ${esteSai ? "opacity-30" : ""}`}
                    style={{
                      top: topo,
                      height: alturaDoBloco,
                      left: `calc(${(coluna / n) * 100}% + 2px)`,
                      width: `calc(${100 / n}% - 4px)`,
                    }}
                  >
                    <span className="block text-[11px] font-bold tabular-nums">
                      {horaCurta(e.inicio)}
                      {e.alerta && <span className={`font-semibold ${t.alerta}`}> · {e.alerta}</span>}
                    </span>
                    <span className={`block truncate font-semibold ${largo ? "text-sm" : "text-[11px] sm:text-xs"}`}>
                      {e.titulo}
                    </span>
                    {e.linha2 && (
                      <span className={`truncate opacity-80 ${largo ? "block text-xs" : "hidden text-[11px] sm:block"}`}>
                        {e.linha2}
                      </span>
                    )}
                    {largo && e.linha3 && <span className="mt-0.5 block truncate text-xs opacity-80">{e.linha3}</span>}
                    {largo && e.valor && <span className="mt-0.5 block text-xs font-bold">{e.valor}</span>}
                  </button>
                );
              })}

              {/*
                A SOMBRA DO ARRASTO: onde o trabalho vai cair, com a hora nova
                escrita. É a confirmação que o Google dá antes de largar — e
                aqui vale mais, porque largar grava logo.
              */}
              {sombraAqui != null && aArrastar && (
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-x-1 z-[4] rounded-md border-2 border-dashed px-1.5 py-1 text-[11px] font-bold tabular-nums ${
                    tema === "claro" ? "border-acao bg-white/85 text-acao" : "border-cyan-300 bg-slate-950/85 text-cyan-200"
                  }`}
                  style={{
                    top: MARGEM + ((sombraAqui - de * 60) / 60) * ALTURA_DA_HORA,
                    height: (DURACAO_PADRAO_MIN / 60) * ALTURA_DA_HORA - 2,
                  }}
                >
                  {doisDigitos(Math.floor(sombraAqui / 60))}:{doisDigitos(sombraAqui % 60)}
                  <span className="block truncate font-semibold opacity-80">{aArrastar.titulo}</span>
                </div>
              )}

              {/* O AGORA: a linha vermelha do Google, no dia de hoje. */}
              {agoraVisivel && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 z-[3]"
                  style={{ top: MARGEM + ((agoraMin - de * 60) / 60) * ALTURA_DA_HORA }}
                >
                  <div className="relative h-0.5 bg-rose-500">
                    <span className="absolute -left-1.5 -top-[5px] h-3 w-3 rounded-full bg-rose-500" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * O MÊS — para ver de longe onde há trabalho e onde há buracos.
 *
 * Num ecrã largo cada dia mostra até três trabalhos com a hora; num telemóvel
 * não cabe uma palavra por dia, e mostra pontos da cor de cada um. Tocar no dia
 * abre esse dia — é a mesma ida do Google, do mês para o dia.
 *
 * Arrastar um trabalho para outro dia do mês muda o DIA e deixa a hora como
 * estava: no mês não há horas onde o largar.
 */
function Mes({
  ancora,
  eventos,
  agora,
  tema,
  onAbrir,
  onIrParaDia,
  arrasto,
  aoPressionar,
}: {
  ancora: Date;
  eventos: EventoDaAgenda[];
  agora: Date;
  tema: TemaDaAgenda;
  onAbrir: (id: number) => void;
  onIrParaDia: (d: Date) => void;
  arrasto: Arrasto | null;
  aoPressionar:
    | ((e: React.PointerEvent<HTMLElement>, ev: EventoDaAgenda, comHoras: null) => void)
    | null;
}) {
  const t = TEMAS[tema];
  const semanas = semanasDoMes(ancora);
  return (
    <div className={`overflow-hidden rounded-2xl border ${t.caixa}`}>
      <div className="grid grid-cols-7">
        {DIAS_CURTOS.map((n) => (
          <div
            key={n}
            className={`border-b py-2 text-center text-[11px] font-semibold tracking-wide ${t.linha} ${t.textoFraco}`}
          >
            {n}
          </div>
        ))}
      </div>
      {semanas.map((semana, i) => (
        <div
          key={semana[0].getTime()}
          className={`grid grid-cols-7 ${i < semanas.length - 1 ? `border-b ${t.linha}` : ""}`}
        >
          {semana.map((d, j) => {
            const chave = chaveDoDia(d);
            const doDia = eventos
              .filter((e) => mesmoDia(e.inicio, d))
              .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
            const fora = d.getMonth() !== ancora.getMonth();
            const hoje = mesmoDia(d, agora);
            const alvo = arrasto?.dia === chave;
            return (
              <div
                key={d.getTime()}
                data-dia={chave}
                className={`min-h-[4.5rem] p-1 sm:min-h-[6.5rem] ${j > 0 ? `border-l ${t.linha}` : ""} ${fora ? t.foraDoMes : ""} ${
                  alvo ? (tema === "claro" ? "bg-[#E6F4F6] ring-2 ring-inset ring-acao" : "bg-slate-800/60 ring-2 ring-inset ring-cyan-400") : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => onIrParaDia(d)}
                  aria-label={`${diaPorExtenso(d)}${doDia.length > 0 ? `, ${doDia.length} trabalho${doDia.length === 1 ? "" : "s"}` : ""}`}
                  className={`flex w-full flex-col items-center rounded-md focus:outline-none focus-visible:ring-2 sm:items-start ${t.anel}`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      hoje ? t.hojeNumero : fora ? "" : t.numero
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  {doDia.length > 0 && (
                    <span className="mt-1 flex flex-wrap justify-center gap-0.5 sm:hidden" aria-hidden="true">
                      {doDia.slice(0, 4).map((e) => (
                        <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${e.cor.ponto}`} />
                      ))}
                    </span>
                  )}
                </button>
                <div className="mt-1 hidden space-y-0.5 sm:block">
                  {doDia.slice(0, 3).map((e) => {
                    const arrastavel = Boolean(aoPressionar) && !e.fixo;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => onAbrir(e.id)}
                        onPointerDown={aoPressionar ? (p) => aoPressionar(p, e, null) : undefined}
                        aria-label={e.rotuloAcessivel}
                        title={arrastavel ? `${e.rotuloAcessivel} — arraste para outro dia` : e.rotuloAcessivel}
                        className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight transition focus:outline-none focus-visible:ring-2 ${t.chip} ${t.anel} ${e.apagado ? "opacity-50" : ""} ${
                          arrastavel ? "cursor-grab" : ""
                        } ${arrasto?.id === e.id && arrasto.dia ? "opacity-30" : ""}`}
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${e.alerta ? "bg-rose-500" : e.cor.ponto}`} />
                        <span className="font-semibold tabular-nums">{horaCurta(e.inicio)}</span>
                        <span className="min-w-0 truncate">{e.titulo}</span>
                      </button>
                    );
                  })}
                  {doDia.length > 3 && (
                    <button
                      type="button"
                      onClick={() => onIrParaDia(d)}
                      className={`px-1 text-[11px] font-semibold hover:underline ${t.textoFraco}`}
                    >
                      +{doDia.length - 3} mais
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
