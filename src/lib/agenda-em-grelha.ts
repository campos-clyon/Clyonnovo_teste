/**
 * AS CONTAS DA AGENDA EM GRELHA — dias, semanas, horas e sobreposições.
 *
 * "É possível melhorar essa agenda para ser mais profissional, como essa?" —
 * 01-10-2026, com a semana do Google Calendar ao lado da agenda do painel do
 * profissional. E logo a seguir, sobre a do backoffice: "A nossa agenda
 * também."
 *
 * As duas agendas eram listas — uma por dia, a outra por urgência. Uma lista
 * diz o que vem a seguir; não diz como é a semana. Quem tem três trabalhos na
 * quinta e nenhum na sexta só o via depois de ler a lista inteira, e um
 * trabalho às 9h sobreposto a outro às 9h30 não se via de todo.
 *
 * ESTE FICHEIRO É PURO, e é de propósito: as duas agendas leem daqui, e assim
 * a semana do profissional e a semana do backoffice são a mesma semana — o
 * mesmo primeiro dia, as mesmas horas, a mesma maneira de pôr lado a lado dois
 * trabalhos à mesma hora. Duas grelhas escritas à parte divergiam no dia em
 * que alguém corrigisse uma.
 *
 * TUDO NO RELÓGIO DE LISBOA (01-10-2026). As contas lêem-se com `getHours()` e
 * `getDate()` — e isso é o relógio do computador de quem olha, que nem sempre
 * é Lisboa: do Brasil, os trabalhos apareciam quatro horas antes. Por isso
 * quem chama passa as datas por `noRelogioDeLisboa` à entrada (os eventos, o
 * «agora», o «Hoje»), e as contas daqui ficam iguais. Ver `hora-de-lisboa.ts`.
 */

export type Vista = "dia" | "semana" | "mes" | "lista";

export const VISTAS: ReadonlyArray<{ id: Vista; rotulo: string }> = [
  { id: "dia", rotulo: "Dia" },
  { id: "semana", rotulo: "Semana" },
  { id: "mes", rotulo: "Mês" },
  { id: "lista", rotulo: "Lista" },
];

export function vistaValida(v: unknown): v is Vista {
  return v === "dia" || v === "semana" || v === "mes" || v === "lista";
}

/** A altura de uma hora na grelha, em píxeis. A do Google é a mesma. */
export const ALTURA_DA_HORA = 48;

/**
 * Quanto dura um trabalho na grelha, quando ninguém disse.
 *
 * Não se guarda a duração de trabalho nenhum, e a grelha precisa de um bloco
 * com altura. Duas horas é o que já vai para o calendário do telemóvel
 * (`linkGoogleCalendar`, na agenda do profissional) — a grelha e o telemóvel
 * têm de desenhar o mesmo bloco.
 *
 * O cartão mostra só a hora de INÍCIO, nunca «11:00–13:00»: o fim é um desenho
 * e não um compromisso, e escrevê-lo era inventar uma hora de saída.
 *
 * A DURAÇÃO PASSOU A PODER MUDAR-SE — 03-10-2026. *«Deixe eu mudar o tempo
 * estimado para realizar o trabalho, ex. o da Irene eram 4 horas.»* Arrasta-se
 * a borda de baixo do bloco, e grava-se em `negociacoes.duracaoMinutos`. Sem
 * nada gravado, continuam a ser estas duas horas.
 */
export const DURACAO_PADRAO_MIN = 120;

/** Os limites da borda: meia hora a doze horas, de quarto em quarto de hora. */
export const DURACAO_MINIMA_MIN = 30;
export const DURACAO_MAXIMA_MIN = 12 * 60;
export const PASSO_DA_DURACAO_MIN = 15;

/** Uma duração que se pode gravar: inteira, no passo, e dentro dos limites. */
export function duracaoValida(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isInteger(v) &&
    v >= DURACAO_MINIMA_MIN &&
    v <= DURACAO_MAXIMA_MIN &&
    v % PASSO_DA_DURACAO_MIN === 0
  );
}

/**
 * A DURAÇÃO DE UM BLOCO ESTICADO: a altura em píxeis, desde o topo do bloco,
 * passada a minutos, encaixada ao quarto de hora e presa aos limites — e nunca
 * para lá da meia-noite do próprio dia.
 */
export function duracaoDoArrasto({
  px,
  inicioMin,
  alturaDaHora,
}: {
  px: number;
  inicioMin: number;
  alturaDaHora: number;
}): number {
  const crua = (px / alturaDaHora) * 60;
  const encaixada = Math.round(crua / PASSO_DA_DURACAO_MIN) * PASSO_DA_DURACAO_MIN;
  const ateMeiaNoite =
    Math.floor((24 * 60 - inicioMin) / PASSO_DA_DURACAO_MIN) * PASSO_DA_DURACAO_MIN;
  return Math.max(
    DURACAO_MINIMA_MIN,
    Math.min(encaixada, DURACAO_MAXIMA_MIN, Math.max(DURACAO_MINIMA_MIN, ateMeiaNoite)),
  );
}

/** «4 h», «1 h 30», «45 min» — a duração lida de relance. */
export function duracaoPorExtenso(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** As horas que se vêem sempre — um dia de trabalho de recolhas. */
export const JANELA_PADRAO = { de: 7, ate: 21 } as const;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * A SEMANA COMEÇA À SEGUNDA.
 *
 * É assim em Portugal, e é assim no calendário que os profissionais têm no
 * telemóvel. A captura do Google que veio de exemplo começava ao domingo — a
 * conta de quem a tirou estava configurada para França — e copiar isso punha o
 * domingo de ontem na primeira coluna da semana que vem.
 */
export const DIAS_CURTOS = ["SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB.", "DOM."];

/** Indexado por `getDay()`, que começa ao domingo. */
const DIAS_LONGOS = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

/** A coluna de um dia numa semana que começa à segunda: 0 = segunda, 6 = domingo. */
export function colunaDoDia(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function meiaNoite(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Somar dias PELO CALENDÁRIO, e não por 24 horas.
 *
 * No último domingo de Março e no de Outubro um dia tem 23 e 25 horas.
 * `d + 7 * 86 400 000` atravessava a mudança da hora e caía às 23h do dia
 * anterior — a semana seguinte começava num domingo.
 */
export function somarDias(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

export function mesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

export function inicioDaSemana(d: Date): Date {
  return somarDias(meiaNoite(d), -colunaDoDia(d));
}

/** Os dias que uma vista de grelha mostra: um, ou sete a começar à segunda. */
export function diasDaVista(vista: "dia" | "semana", ancora: Date): Date[] {
  if (vista === "dia") return [meiaNoite(ancora)];
  const inicio = inicioDaSemana(ancora);
  return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
}

/**
 * As semanas de um mês, de segunda a domingo, a cobrir o mês inteiro.
 *
 * Quatro a seis linhas, as que forem precisas — e não seis sempre: um
 * Fevereiro que comece à segunda tem quatro semanas, e duas linhas vazias no
 * fundo pareciam dias sem trabalho.
 */
export function semanasDoMes(ancora: Date): Date[][] {
  const primeiro = new Date(ancora.getFullYear(), ancora.getMonth(), 1);
  const ultimo = new Date(ancora.getFullYear(), ancora.getMonth() + 1, 0);
  const semanas: Date[][] = [];
  let inicio = inicioDaSemana(primeiro);
  while (inicio.getTime() <= ultimo.getTime()) {
    semanas.push(Array.from({ length: 7 }, (_, i) => somarDias(inicio, i)));
    inicio = somarDias(inicio, 7);
  }
  return semanas;
}

/** O primeiro e o último instante do que a vista mostra — o fim é exclusivo. */
export function periodoDaVista(vista: Vista, ancora: Date): { de: Date; ate: Date } | null {
  if (vista === "dia") {
    const de = meiaNoite(ancora);
    return { de, ate: somarDias(de, 1) };
  }
  if (vista === "semana") {
    const de = inicioDaSemana(ancora);
    return { de, ate: somarDias(de, 7) };
  }
  if (vista === "mes") {
    return {
      de: new Date(ancora.getFullYear(), ancora.getMonth(), 1),
      ate: new Date(ancora.getFullYear(), ancora.getMonth() + 1, 1),
    };
  }
  return null;
}

/** As setas: um dia, uma semana ou um mês para trás ou para a frente. */
export function andar(vista: Vista, ancora: Date, sentido: 1 | -1): Date {
  if (vista === "dia") return somarDias(meiaNoite(ancora), sentido);
  if (vista === "semana") return somarDias(meiaNoite(ancora), 7 * sentido);
  if (vista === "mes") return new Date(ancora.getFullYear(), ancora.getMonth() + sentido, 1);
  return ancora;
}

function maiuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * O título da barra, como o Google o escreve — mas em português de Portugal.
 *
 *   semana dentro de um mês:  «Setembro de 2026»
 *   semana entre dois meses:  «Set – out de 2026»
 *   semana entre dois anos:   «Dez de 2026 – jan de 2027»
 *   dia:                      «Quarta-feira, 30 de setembro de 2026»
 */
export function tituloDoPeriodo(vista: Vista, ancora: Date): string {
  if (vista === "lista") return "Todos os trabalhos marcados";
  if (vista === "dia") {
    return `${DIAS_LONGOS[ancora.getDay()]}, ${ancora.getDate()} de ${MESES[ancora.getMonth()]} de ${ancora.getFullYear()}`;
  }
  if (vista === "mes") return `${maiuscula(MESES[ancora.getMonth()])} de ${ancora.getFullYear()}`;

  const de = inicioDaSemana(ancora);
  const ate = somarDias(de, 6);
  if (de.getMonth() === ate.getMonth()) {
    return `${maiuscula(MESES[de.getMonth()])} de ${de.getFullYear()}`;
  }
  if (de.getFullYear() === ate.getFullYear()) {
    return `${maiuscula(MESES_CURTOS[de.getMonth()])} – ${MESES_CURTOS[ate.getMonth()]} de ${ate.getFullYear()}`;
  }
  return (
    `${maiuscula(MESES_CURTOS[de.getMonth()])} de ${de.getFullYear()} – ` +
    `${MESES_CURTOS[ate.getMonth()]} de ${ate.getFullYear()}`
  );
}

/** «Quarta-feira, 30 de setembro» — para a janela de um trabalho. */
export function diaPorExtenso(d: Date): string {
  return `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** «09:00» — sempre com dois dígitos e às 24 horas, como se lê em Portugal. */
export function horaCurta(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function minutosDoDia(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * AS HORAS QUE A GRELHA MOSTRA — das 7 às 21, e mais se for preciso.
 *
 * O Google mostra as vinte e quatro horas e obriga a rolar até às sete da manhã
 * para ver o primeiro trabalho do dia. Um profissional de recolhas trabalha de
 * dia: dezassete horas de grelha vazia por cima e por baixo eram ruído.
 *
 * Mas nunca se esconde um trabalho. Um às 6h abre a grelha às 6, um às 21h
 * estica-a até às 23 — a janela é a do costume, alargada ao que lá estiver.
 */
export function janelaDeHoras(
  inicios: Date[],
  /** Uma duração para todos, ou uma por trabalho, pela mesma ordem (03-10-2026). */
  duracaoMin: number | ReadonlyArray<number> = DURACAO_PADRAO_MIN,
): { de: number; ate: number } {
  let de: number = JANELA_PADRAO.de;
  let ate: number = JANELA_PADRAO.ate;
  inicios.forEach((d, i) => {
    const m = minutosDoDia(d);
    const dur = typeof duracaoMin === "number" ? duracaoMin : (duracaoMin[i] ?? DURACAO_PADRAO_MIN);
    de = Math.min(de, Math.floor(m / 60));
    ate = Math.max(ate, Math.min(24, Math.ceil((m + dur) / 60)));
  });
  return { de: Math.max(0, de), ate: Math.min(24, ate) };
}

export type Disposto<T> = {
  item: T;
  inicioMin: number;
  fimMin: number;
  /** Em que coluna do grupo fica, a contar de zero. */
  coluna: number;
  /** Quantas colunas tem o grupo de sobrepostos a que pertence. */
  colunas: number;
};

/**
 * DOIS TRABALHOS À MESMA HORA FICAM LADO A LADO, E NÃO UM POR CIMA DO OUTRO.
 *
 * Desenhados um por cima do outro, o de baixo deixava de existir — e um
 * profissional com dois trabalhos marcados às 9h é exactamente o caso que a
 * agenda tem de mostrar, porque é o que o faz faltar a um deles.
 *
 * É o arranjo do Google: os trabalhos que se tocam, mesmo em cadeia, formam um
 * grupo; dentro do grupo cada um ocupa a primeira coluna livre; e todos ficam
 * com a largura da coluna mais estreita do grupo.
 */
export function dispor<T>(
  entradas: ReadonlyArray<{ item: T; inicioMin: number; fimMin: number }>,
): Disposto<T>[] {
  const ordenadas = [...entradas].sort(
    (a, b) => a.inicioMin - b.inicioMin || b.fimMin - a.fimMin,
  );
  const saida: Disposto<T>[] = [];
  let grupo: Disposto<T>[] = [];
  let fimDasColunas: number[] = [];
  let fimDoGrupo = -Infinity;

  const fechar = () => {
    for (const d of grupo) d.colunas = fimDasColunas.length;
    saida.push(...grupo);
    grupo = [];
    fimDasColunas = [];
    fimDoGrupo = -Infinity;
  };

  for (const e of ordenadas) {
    if (grupo.length > 0 && e.inicioMin >= fimDoGrupo) fechar();
    let coluna = fimDasColunas.findIndex((fim) => fim <= e.inicioMin);
    if (coluna < 0) {
      coluna = fimDasColunas.length;
      fimDasColunas.push(e.fimMin);
    } else {
      fimDasColunas[coluna] = e.fimMin;
    }
    grupo.push({ ...e, coluna, colunas: 0 });
    fimDoGrupo = Math.max(fimDoGrupo, e.fimMin);
  }
  if (grupo.length > 0) fechar();
  return saida;
}

/*
 * ── ARRASTAR UM TRABALHO PARA OUTRO DIA OU OUTRA HORA ─────────────────────
 *
 * *«Quero também poder puxar/arrastar esses agendamentos para mudar sua data e
 * horário como na agenda, e eles salvarem automático ao soltar.»* — 01-10-2026.
 *
 * As contas do arrasto vivem aqui, puras, pela mesma razão que as outras: a
 * grelha do profissional e a do backoffice têm de largar o trabalho no mesmo
 * sítio, e um engano de um quarto de hora numa delas é um profissional a
 * chegar quinze minutos atrasado.
 */

/** O arrasto encaixa de quarto em quarto de hora, como no Google. */
export const PASSO_DO_ARRASTO = 15;

/** «2026-10-01» — o dia como chave, na hora local. É o que vai no `data-dia` de cada coluna. */
export function chaveDoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** O instante de um dia (`chaveDoDia`) a uma hora dada em minutos desde a meia-noite. */
export function instanteDaChave(chave: string, minutos: number): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(chave);
  if (!m || !Number.isFinite(minutos)) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Math.floor(minutos / 60), minutos % 60);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * A HORA ONDE O TRABALHO CAI, a partir de onde está o rato na coluna do dia.
 *
 * `agarraMin` é onde o bloco foi agarrado, medido desde o topo dele: quem pega
 * num bloco pelo meio e o larga, larga-o pelo meio — o topo do bloco não salta
 * para debaixo do rato.
 *
 * Encaixa ao quarto de hora e nunca sai das horas que a grelha mostra: largar
 * por baixo das 21h deixava o trabalho num sítio que deixa de se ver.
 */
export function horaNoAlvo(args: {
  /** Píxeis desde o topo da coluna até ao rato. */
  y: number;
  /** A margem de cima da grelha, em píxeis. */
  margem: number;
  janela: { de: number; ate: number };
  agarraMin: number;
}): number {
  const { y, margem, janela, agarraMin } = args;
  const bruto = janela.de * 60 + ((y - margem) / ALTURA_DA_HORA) * 60 - agarraMin;
  const encaixado = Math.round(bruto / PASSO_DO_ARRASTO) * PASSO_DO_ARRASTO;
  const minimo = janela.de * 60;
  const maximo = janela.ate * 60 - PASSO_DO_ARRASTO;
  return Math.max(minimo, Math.min(maximo, encaixado));
}

/** O primeiro instante marcado DEPOIS do período — para «o próximo é a 3 de outubro». */
export function proximoDepois(datas: ReadonlyArray<Date>, depoisDe: Date): Date | null {
  let melhor: Date | null = null;
  for (const d of datas) {
    if (d.getTime() >= depoisDe.getTime() && (!melhor || d.getTime() < melhor.getTime())) melhor = d;
  }
  return melhor;
}

/**
 * AS CORES DOS BLOCOS — fundo claro, uma barra à esquerda, texto escuro.
 *
 * É o desenho do Google, e por uma razão de leitura: o texto de um bloco
 * pequeno tem de se ler a um palmo do telemóvel, e texto branco sobre uma cor
 * saturada perde-se nos tons médios. Aqui o contraste é o de texto escuro sobre
 * quase branco, seja qual for a cor.
 *
 * As classes estão escritas por extenso porque o Tailwind só gera o que
 * encontra escrito: uma classe montada aos bocados (`bg-${cor}-50`) não existia
 * no CSS final.
 */
/**
 * Duas versões de cada cor, porque há dois fundos: o painel do profissional é
 * claro e o backoffice é escuro. No escuro o bloco é a cor em transparência com
 * texto quase branco — um bloco pastel num fundo preto encandeava.
 */
export type Cor = { bloco: string; blocoEscuro: string; ponto: string };

/*
 * ⚠️ O CIANO ESTÁ EM HEXADECIMAL, E NÃO É CAPRICHO.
 *
 * O `globals.css` tem regras com `!important` que mudam a cor do texto dos
 * botões ciano: `bg-cyan-600`/`700` → branco, `bg-cyan-50` → a cor da marca.
 * Foram escritas para os botões de acção do site. Os blocos desta grelha são
 * botões, e o bloco claro quer `text-[#083344]` sobre `cyan-50` — com a
 * palavra, saía azul-petróleo.
 *
 * Quando isto se escreveu (captura de 01-10-2026) era pior: as regras
 * procuravam um pedaço da classe e apanhavam QUALQUER «bg-cyan-», e no escuro o
 * número do dia de hoje ficava branco sobre ciano. Isso corrigiu-se no próprio
 * globals.css no mesmo dia; o caso do `cyan-50` fica.
 *
 * `bg-[#ECFEFF]` é exactamente o `cyan-50` — só não tem a palavra que essas
 * regras procuram. O teste `agenda-em-grelha.test.ts` não deixa a palavra
 * voltar a estes dois ficheiros.
 */
const PALETA: readonly Cor[] = [
  { bloco: "border-cyan-600 bg-[#ECFEFF] text-[#083344]", blocoEscuro: "border-cyan-400 bg-[#06B6D4]/15 text-[#ECFEFF]", ponto: "bg-[#06B6D4]" },
  { bloco: "border-amber-500 bg-amber-50 text-amber-950", blocoEscuro: "border-amber-400 bg-amber-500/15 text-amber-50", ponto: "bg-amber-500" },
  { bloco: "border-violet-500 bg-violet-50 text-violet-950", blocoEscuro: "border-violet-400 bg-violet-500/20 text-violet-50", ponto: "bg-violet-500" },
  { bloco: "border-blue-500 bg-blue-50 text-blue-950", blocoEscuro: "border-blue-400 bg-blue-500/20 text-blue-50", ponto: "bg-blue-500" },
  { bloco: "border-emerald-500 bg-emerald-50 text-emerald-950", blocoEscuro: "border-emerald-400 bg-emerald-500/15 text-emerald-50", ponto: "bg-emerald-500" },
  { bloco: "border-rose-500 bg-rose-50 text-rose-950", blocoEscuro: "border-rose-400 bg-rose-500/15 text-rose-50", ponto: "bg-rose-500" },
  { bloco: "border-orange-500 bg-orange-50 text-orange-950", blocoEscuro: "border-orange-400 bg-orange-500/15 text-orange-50", ponto: "bg-orange-500" },
  { bloco: "border-lime-600 bg-lime-50 text-lime-950", blocoEscuro: "border-lime-400 bg-lime-500/15 text-lime-50", ponto: "bg-lime-500" },
  { bloco: "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-950", blocoEscuro: "border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-50", ponto: "bg-fuchsia-500" },
  { bloco: "border-teal-600 bg-teal-50 text-teal-950", blocoEscuro: "border-teal-400 bg-teal-500/15 text-teal-50", ponto: "bg-teal-500" },
];

const COR_DO_SERVICO: Record<string, number> = {
  recolha_moveis: 0,
  recolha_entulho: 1,
  esvaziamento_casa: 2,
  esvaziamento_apartamento: 2,
  mudanca: 3,
  montagem_moveis: 4,
  manutencao_casa: 5,
  recolha_monos: 6,
  jardinagem: 7,
};

const COR_NEUTRA: Cor = {
  bloco: "border-slate-400 bg-slate-50 text-slate-900",
  blocoEscuro: "border-slate-400 bg-slate-500/20 text-slate-50",
  ponto: "bg-slate-400",
};

/**
 * Para a agenda do PROFISSIONAL: a cor diz o serviço.
 *
 * Os trabalhos são todos dele; o que muda de um bloco para o outro é o que vai
 * fazer — e uma recolha de entulho e um esvaziamento pedem a carrinha de
 * maneiras diferentes.
 */
export function corDoServico(servico: string | null | undefined): Cor {
  const i = servico != null ? COR_DO_SERVICO[servico] : undefined;
  return i != null ? PALETA[i] : COR_NEUTRA;
}

/**
 * Para a agenda do BACKOFFICE: a cor diz o profissional.
 *
 * Aí a pergunta é outra — quem está onde — e é a do Google com várias agendas
 * ligadas: uma cor por pessoa. A cor sai do número dele, e não da ordem em que
 * aparece, para o Revolution ser da mesma cor hoje e amanhã, com ou sem filtro.
 */
export function corDaPessoa(id: number): Cor {
  const i = Math.abs(Math.trunc(id)) % PALETA.length;
  return PALETA[i];
}
