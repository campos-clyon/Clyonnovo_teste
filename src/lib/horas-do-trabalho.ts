/**
 * AS HORAS DO TRABALHO — ordem do CEO com o sim do dono, 31-10-2026.
 *
 * O caso que a fez nascer é o #536: uma mudança «Por hora» com «Valor de
 * partida (sem IVA) 270.00» escrito como se fosse o total, e o painel do
 * profissional a mostrar «240,30 €» ao lado de «121,99 € por hora». Um número
 * por hora e um total, misturados, sem ninguém saber qual era qual.
 *
 * Num trabalho POR HORA:
 *
 *   · o valor diz-se sempre por hora, com o total estimado ao lado (horas
 *     previstas × valor por hora, nunca menos de 3 horas);
 *   · depois do «Cheguei» confirmado, quem faz o trabalho marca a hora de
 *     início e a hora de fim (hora de Lisboa, dois campos editáveis — não é um
 *     cronómetro), e o site conta as horas e o total;
 *   · o «Está feito» só aparece com as horas gravadas;
 *   · o cliente confirma as horas, ou diz que não concorda (vai à Mesa); só
 *     com as horas confirmadas — pelo cliente ou pela CLYON — o trabalho
 *     conclui, e o total confirmado passa a ser o valor do trabalho em todo o
 *     lado (pagamentos, conta em degraus, carteira).
 *
 * A REGRA DAS HORAS (`horasFaturadas`): conta-se ao quarto de hora, para cima,
 * e nunca menos de 3 horas (o mínimo da tabela das mudanças — `MINIMO_DE_HORAS`).
 * 2 h 10 min → 3 h; 3 h 01 min → 3,25 h; 4 h 10 min → 4,25 h.
 *
 * O total = horas × valor por hora + os materiais à parte usados
 * (`materiais-da-proposta.ts`). A deslocação acima de 50 km e os andares a pé
 * da tabela NÃO se somam aqui: numa negociação o valor por hora é o que quem
 * propôs escreveu, e somar-lhe linhas que ninguém lhe pôs à frente seria uma
 * surpresa no fim.
 *
 * Trabalhos com «Valor total» ou «Por carga» não mudam.
 *
 * Puro de propósito: a app Pro, a app de cliente e os testes importam-no.
 * Quem lê os textos daqui é o cliente — por isso dizem «parceiro».
 */

import { MINIMO_DE_HORAS, horasEstimadas, tipologiaDoTexto, type Tipologia } from "./tabela-das-mudancas";
import { diaEmLisboa, horaEmLisboa, instanteDaBase, instanteEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";
import { precoDoCliente, type PrecoDoCliente } from "./preco-do-cliente";
import { quantoOProfissionalRecebe, type Taxas } from "./taxas-plataforma";
import type { ModeloDoPreco } from "./iva-incluido";
import {
  lerMateriaisDaProposta,
  lerQuantidadesUsadas,
  materiaisUsados,
  quantidadesEmPalavras,
  type LinhaDeMaterial,
} from "./materiais-da-proposta";

/** Ao quarto de hora. */
export const MINUTOS_DO_ARREDONDAMENTO = 15;
/** O mínimo que se fatura, mesmo que se trabalhe menos — o da tabela das mudanças. */
export const MINIMO_DE_HORAS_FATURADAS = MINIMO_DE_HORAS;
/** Mais do que isto seguido é quase de certeza um engano no campo. */
export const MAXIMO_DE_HORAS_SEGUIDAS = 18;
/** A hora de fim pode ser «agora» — com esta folga para o relógio do telemóvel. */
export const FOLGA_DO_RELOGIO_MS = 15 * 60_000;
export const MOTIVO_MINIMO_DA_CONTESTACAO = 5;
export const MOTIVO_MAXIMO_DA_CONTESTACAO = 300;

/** A regra, numa frase — por baixo das horas, nos três lados. */
export const REGRA_DAS_HORAS = `Conta-se ao quarto de hora, para cima, com um mínimo de ${MINIMO_DE_HORAS_FATURADAS} horas.`;

/* ── Os botões e os títulos, iguais em todos os ecrãs ──────────────────── */
export const TITULO_DAS_HORAS = "Horas do trabalho";
export const HORA_DE_INICIO = "Hora de início";
export const HORA_DE_FIM = "Hora de fim";
export const GRAVAR_AS_HORAS = "OK";
export const CONFIRMO_AS_HORAS = "Confirmo as horas";
export const CONFIRMO_AS_HORAS_E_OS_MATERIAIS = "Confirmo as horas e os materiais";
export const NAO_CONCORDO = "Não concordo";
/** Quando o «Está feito» ainda não aparece por faltarem as horas. */
export const MARQUE_AS_HORAS_PRIMEIRO = "Marque primeiro as horas do trabalho (início e fim) e carregue em OK.";
/** O fim que o cliente tenta antes de as horas estarem confirmadas. */
export const CONFIRME_AS_HORAS_PRIMEIRO = "Confirme primeiro as horas do trabalho.";

const arred = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

function numero(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const tem = (v: Date | string | null | undefined): boolean => instanteDaBase(v ?? null) != null;

/* ──────────────────────────────────────────────────────────────────────────
 * AS CONTAS
 * ────────────────────────────────────────────────────────────────────────── */

/** «09:05» → { h: 9, m: 5 }. Só HH:MM (ou H:MM), 00:00 a 23:59. */
export function lerHora(v: unknown): { h: number; m: number } | null {
  if (typeof v !== "string") return null;
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(v);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

const dois = (n: number) => String(n).padStart(2, "0");

/**
 * AS HORAS FATURADAS — ao quarto de hora, para cima, nunca menos de 3.
 * Os minutos são os que passaram entre o início e o fim.
 */
export function horasFaturadas(minutos: number): number {
  if (!Number.isFinite(minutos) || minutos <= 0) return MINIMO_DE_HORAS_FATURADAS;
  const quartos = Math.ceil(minutos / MINUTOS_DO_ARREDONDAMENTO - 1e-9);
  return Math.max(MINIMO_DE_HORAS_FATURADAS, (quartos * MINUTOS_DO_ARREDONDAMENTO) / 60);
}

/** «3 h», «4,25 h» — vírgula decimal. */
export function horasEmPalavras(h: number): string {
  const t = Number.isInteger(h) ? String(h) : String(Math.round(h * 100) / 100).replace(".", ",");
  return `${t} h`;
}

/** «4 h 10 min», «45 min», «3 h» — o tempo que passou de facto. */
export function duracaoEmPalavras(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

export type IntervaloDasHoras = {
  inicioEm: Date;
  fimEm: Date;
  /** O tempo que passou, em minutos. */
  minutos: number;
  horasFaturadas: number;
  /** O fim é no dia a seguir ao início (passou a meia-noite). */
  passaDaMeiaNoite: boolean;
};

/**
 * O INÍCIO E O FIM, EM HORA DE LISBOA → os instantes e as horas.
 *
 * `dia` é o dia do início (AAAA-MM-DD, em Lisboa). Um fim igual ou antes do
 * início é no dia seguinte — uma mudança que acaba depois da meia-noite. Os
 * minutos contam-se entre os instantes verdadeiros, e por isso a noite em que
 * a hora muda conta certo.
 */
export function intervaloDasHoras(
  p: { dia: string; inicio: unknown; fim: unknown },
  agora: Date = new Date(),
): { ok: true; intervalo: IntervaloDasHoras } | { ok: false; erro: string } {
  const i = lerHora(p.inicio);
  const f = lerHora(p.fim);
  if (!i) return { ok: false, erro: "Indique a hora de início (HH:MM)." };
  if (!f) return { ok: false, erro: "Indique a hora de fim (HH:MM)." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dia)) return { ok: false, erro: "O dia do trabalho não é válido." };
  const passaDaMeiaNoite = f.h * 60 + f.m <= i.h * 60 + i.m;
  const inicioEm = instanteEmLisboa(`${p.dia}T${dois(i.h)}:${dois(i.m)}`);
  const diaDoFim = passaDaMeiaNoite ? somarDiasAoDia(p.dia, 1) : p.dia;
  const fimEm = instanteEmLisboa(`${diaDoFim}T${dois(f.h)}:${dois(f.m)}`);
  if (!inicioEm || !fimEm) return { ok: false, erro: "As horas não são válidas." };
  const minutos = Math.round((fimEm.getTime() - inicioEm.getTime()) / 60_000);
  if (minutos <= 0) return { ok: false, erro: "A hora de fim tem de ser depois da hora de início." };
  if (minutos > MAXIMO_DE_HORAS_SEGUIDAS * 60) {
    return { ok: false, erro: `Mais de ${MAXIMO_DE_HORAS_SEGUIDAS} horas seguidas? Confirme a hora de início e a de fim.` };
  }
  if (fimEm.getTime() > agora.getTime() + FOLGA_DO_RELOGIO_MS) {
    return { ok: false, erro: "A hora de fim ainda não chegou. Marque-a quando o trabalho acabar." };
  }
  return { ok: true, intervalo: { inicioEm, fimEm, minutos, horasFaturadas: horasFaturadas(minutos), passaDaMeiaNoite } };
}

/** O total do lado de quem faz o trabalho, sem IVA: horas × valor por hora + materiais. */
export function totalDasHoras(valorPorHora: number, horas: number, materiais = 0): number {
  return arred(arred(horas * valorPorHora) + materiais);
}

/** As horas que se esperam, nunca menos do mínimo. */
export function horasDaEstimativa(horasPrevistas: number | null | undefined): number {
  const h = numero(horasPrevistas);
  return Math.max(MINIMO_DE_HORAS_FATURADAS, h != null && h > 0 ? h : MINIMO_DE_HORAS_FATURADAS);
}

/** A estimativa: horas previstas (mínimo 3) × valor por hora. */
export function estimativaDasHoras(valorPorHora: number, horasPrevistas: number | null | undefined): number {
  return arred(horasDaEstimativa(horasPrevistas) * valorPorHora);
}

/**
 * AS HORAS PREVISTAS DE UM PEDIDO — numa mudança, pela tipologia (dita no
 * pedido ou na descrição) e pela desmontagem, como o simulador (tabela das
 * mudanças); noutro trabalho por hora, o mínimo.
 */
export function horasPrevistasDoPedido(p: {
  serviceType?: string | null;
  description?: string | null;
  tipologia?: string | null;
  desmontagem?: boolean | null;
}): number {
  if (p.serviceType !== "mudanca") return MINIMO_DE_HORAS_FATURADAS;
  const dita = (p.tipologia ?? "").trim();
  const tipologia: Tipologia | null = (["itens", "T0", "T1", "T2", "T3", "T4+"] as string[]).includes(dita)
    ? (dita as Tipologia)
    : tipologiaDoTexto(dita) ?? tipologiaDoTexto(p.description);
  return horasEstimadas(tipologia, p.desmontagem === true);
}

/** O mesmo, a partir do `rawOrderJson` do pedido (tipologia e desmontagem do simulador). */
export function horasPrevistasDaLinha(l: {
  serviceType?: unknown;
  description?: unknown;
  rawOrderJson?: unknown;
}): number {
  let bruto: Record<string, unknown> = {};
  if (typeof l.rawOrderJson === "string" && l.rawOrderJson) {
    try {
      const o = JSON.parse(l.rawOrderJson) as unknown;
      if (o && typeof o === "object") bruto = o as Record<string, unknown>;
    } catch {
      /* JSON estragado: conta-se pela descrição */
    }
  }
  const desmontar = bruto.needsDismantling;
  const acesso = (k: string) => (bruto[k] as { difficultAccess?: unknown } | undefined)?.difficultAccess === true;
  return horasPrevistasDoPedido({
    serviceType: typeof l.serviceType === "string" ? l.serviceType : null,
    description: typeof l.description === "string" ? l.description : null,
    tipologia: typeof bruto.tipologia === "string" ? bruto.tipologia : null,
    desmontagem:
      desmontar === true || desmontar === "true" || desmontar === "yes" || acesso("originAccess") || acesso("destinationAccess"),
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * O QUE ESTÁ MARCADO NA NEGOCIAÇÃO
 * ────────────────────────────────────────────────────────────────────────── */

/** As colunas das horas (negociações v14). Tudo opcional: uma consulta antiga não as traz. */
export type HorasNaBase = {
  horasInicioEm?: Date | string | null;
  horasFimEm?: Date | string | null;
  horasMinutos?: number | string | null;
  horasFaturadas?: number | string | null;
  horasMarcadasEm?: Date | string | null;
  horasConfirmadasEm?: Date | string | null;
  horasConfirmadasPor?: string | null;
  horasContestadasEm?: Date | string | null;
  horasContestacao?: string | null;
  valorPorHora?: number | string | null;
  valorDasHoras?: number | string | null;
  materiaisJson?: string | null;
  materiaisUsadosJson?: string | null;
};

export const horasMarcadas = (t: HorasNaBase): boolean => tem(t.horasMarcadasEm);
export const horasConfirmadas = (t: HorasNaBase): boolean => tem(t.horasConfirmadasEm);
/** O cliente disse que não concorda, e ainda ninguém as corrigiu nem confirmou. */
export const horasContestadas = (t: HorasNaBase): boolean => !horasConfirmadas(t) && tem(t.horasContestadasEm);
/** O cliente pode confirmar (ou contestar) agora: marcadas, por confirmar, e não contestadas ainda. */
export const clientePodeResponderAsHoras = (t: HorasNaBase): boolean =>
  horasMarcadas(t) && !horasConfirmadas(t) && !horasContestadas(t);

/** Quem confirmou as horas — «cliente» ou «clyon». */
export type QuemConfirmouAsHoras = "cliente" | "clyon";
export function lerQuemConfirmouAsHoras(v: unknown): QuemConfirmouAsHoras | null {
  return v === "cliente" || v === "clyon" ? v : null;
}

/**
 * AS HORAS NÃO TRAVAM O FIM: ou não há horas marcadas (um trabalho que não é
 * por hora, ou um de antes desta regra), ou estão confirmadas. É a mesma
 * condição do SQL do fim (`confirmarExecucao` e o cron do prazo).
 */
export const horasNaoTravamOFim = (t: HorasNaBase): boolean => !horasMarcadas(t) || horasConfirmadas(t);

/** A condição em SQL, para o confirmar e para o cron. */
export const HORAS_NAO_TRAVAM_O_FIM_SQL = "(horasMarcadasEm IS NULL OR horasConfirmadasEm IS NOT NULL)";

/** O «Está feito» de um trabalho por hora só com as horas gravadas. */
export function podeDarPorFeitoComAsHoras(porHora: boolean, t: HorasNaBase): boolean {
  return !porHora || horasMarcadas(t);
}

/**
 * Pode marcar (ou corrigir) as horas: trabalho por hora, fechado e ainda por
 * confirmar, com a chegada confirmada (`chegadaOk` — `podeMostrarConcluir` da
 * viagem), e as horas ainda não confirmadas.
 */
export function podeMarcarHoras(p: {
  porHora: boolean;
  estado: string;
  confirmadoEm?: Date | string | null;
  pagoEm?: Date | string | null;
  chegadaOk: boolean;
  horas: HorasNaBase;
}): boolean {
  if (!p.porHora || p.estado !== "acordada") return false;
  if (tem(p.confirmadoEm)) return false;
  if (!p.chegadaOk) return false;
  return !horasConfirmadas(p.horas);
}

/**
 * O VALOR POR HORA DESTE TRABALHO. Até as horas estarem confirmadas é o
 * `valorAcordado`; depois disso o `valorAcordado` passa a ser o total, e o
 * valor por hora fica guardado em `valorPorHora` (gravado ao marcar).
 */
export function valorPorHoraDe(t: HorasNaBase & { valorAcordado?: number | string | null }): number | null {
  return horasConfirmadas(t) ? numero(t.valorPorHora) ?? null : numero(t.valorAcordado);
}

export type TotalPorHora = {
  /** «final» confirmado · «marcado» por confirmar · «estimativa» antes das horas. */
  tipo: "final" | "marcado" | "estimativa";
  /** Sem IVA, do lado de quem faz o trabalho (antes da taxa da plataforma). */
  total: number;
  horas: number;
};

/**
 * O TOTAL DE UM TRABALHO POR HORA, agora: o confirmado (`valorAcordado` depois
 * de confirmadas), o marcado à espera do cliente, ou a estimativa. `null`
 * sem valor nenhum.
 */
export function totalPorHora(
  t: HorasNaBase & { valorAcordado?: number | string | null },
  horasPrevistas: number | null | undefined,
): TotalPorHora | null {
  if (horasConfirmadas(t)) {
    const v = numero(t.valorAcordado);
    return v == null ? null : { tipo: "final", total: v, horas: numero(t.horasFaturadas) ?? horasDaEstimativa(null) };
  }
  const porHora = numero(t.valorAcordado);
  if (horasMarcadas(t)) {
    const v = numero(t.valorDasHoras);
    if (v != null) return { tipo: "marcado", total: v, horas: numero(t.horasFaturadas) ?? horasDaEstimativa(null) };
  }
  if (porHora == null) return null;
  return { tipo: "estimativa", total: estimativaDasHoras(porHora, horasPrevistas), horas: horasDaEstimativa(horasPrevistas) };
}

/**
 * O VALOR QUE O DINHEIRO USA num trabalho por hora: o total confirmado, ou a
 * estimativa (o que o cliente paga antes; a diferença acerta-se no fim).
 */
export function valorParaPagar(
  t: HorasNaBase & { valorAcordado?: number | string | null },
  horasPrevistas: number | null | undefined,
): number | null {
  if (horasConfirmadas(t)) return numero(t.valorAcordado);
  // Marcadas mas por confirmar ainda não mandam no dinheiro: vale a estimativa.
  const porHora = numero(t.valorAcordado);
  return porHora == null ? null : estimativaDasHoras(porHora, horasPrevistas);
}

/* ──────────────────────────────────────────────────────────────────────────
 * O QUE SE DIZ
 * ────────────────────────────────────────────────────────────────────────── */

/** «50,00 €/hora + IVA (61,50 €/hora com IVA), mínimo 3 horas» — o preço por hora ao cliente. */
export function porHoraParaOCliente(p: Pick<PrecoDoCliente, "semIva" | "total" | "ivaIncluido">): string {
  const com = p.ivaIncluido ? ` (${eur(p.total)}/hora com IVA)` : "";
  return `${eur(p.semIva)}/hora + IVA${com}, mínimo ${MINIMO_DE_HORAS_FATURADAS} horas`;
}

/** «Estimativa para 4 h: 200,00 € + IVA (246,00 € com IVA)» — o total esperado, ao cliente. */
export function estimativaParaOCliente(horas: number, p: Pick<PrecoDoCliente, "semIva" | "total" | "ivaIncluido">): string {
  const com = p.ivaIncluido ? ` (${eur(p.total)} com IVA)` : "";
  return `Estimativa para ${horasEmPalavras(horas)}: ${eur(p.semIva)} + IVA${com}. O total sai das horas de trabalho no dia.`;
}

/** As duas linhas ao cliente, de um valor por hora do lado de quem propôs. */
export function precoPorHoraParaOCliente(
  valorPorHora: number,
  horasPrevistas: number | null | undefined,
  taxas: Taxas | undefined,
  modelo: ModeloDoPreco,
): { porHora: string; estimativa: string; horas: number } {
  const horas = horasDaEstimativa(horasPrevistas);
  return {
    porHora: porHoraParaOCliente(precoDoCliente(valorPorHora, taxas, modelo)),
    estimativa: estimativaParaOCliente(horas, precoDoCliente(estimativaDasHoras(valorPorHora, horas), taxas, modelo)),
    horas,
  };
}

/** «≈ 190,48 € em 4 h» — o total estimado, curto, ao lado de um valor por hora. */
export function totalEstimadoCurto(valorPorHora: number, horasPrevistas: number | null | undefined): string {
  const horas = horasDaEstimativa(horasPrevistas);
  return `≈ ${eur(estimativaDasHoras(valorPorHora, horas))} em ${horasEmPalavras(horas)}`;
}

/** «47,62 €/hora» — o número e a unidade, juntos. */
export function porHoraCurto(valor: number): string {
  return `${eur(valor)}/hora`;
}

export type ResumoDasHoras = {
  inicio: string;
  fim: string;
  passaDaMeiaNoite: boolean;
  minutos: number;
  horas: number;
  valorPorHora: number | null;
  materiais: LinhaDeMaterial[];
  totalDosMateriais: number;
  /** Sem IVA, do lado de quem faz o trabalho. */
  total: number;
  /** O que fica para quem faz o trabalho, depois da taxa da plataforma. */
  recebe: number;
  /** O preço ao cliente (com a taxa e o IVA da negociação). */
  cliente: PrecoDoCliente;
  marcadasEm: Date | null;
  confirmadas: boolean;
  confirmadasPor: QuemConfirmouAsHoras | null;
  confirmadasEm: Date | null;
  contestadas: boolean;
  contestacao: string | null;
  contestadasEm: Date | null;
  /** «O parceiro marcou das 09:00 às 13:10 = 4,25 h → total 212,50 € + IVA (261,38 € com IVA).» */
  textoParaOCliente: string;
  /** «Das 09:00 às 13:10 = 4,25 h × 47,62 €/hora = 202,39 € sem IVA (recebe 180,13 €).» */
  textoParaQuemFez: string;
  /** Linha da equipa, para o histórico e os cartões. */
  textoParaAEquipa: string;
};

/**
 * O RESUMO DAS HORAS MARCADAS — `null` sem horas. É o que os três lados
 * mostram; os números saem da base (gravados ao marcar), não se refazem aqui.
 */
export function resumoDasHoras(
  t: HorasNaBase & { valorAcordado?: number | string | null },
  taxas: Taxas | undefined,
  modelo: ModeloDoPreco,
): ResumoDasHoras | null {
  if (!horasMarcadas(t)) return null;
  const inicioEm = instanteDaBase(t.horasInicioEm ?? null);
  const fimEm = instanteDaBase(t.horasFimEm ?? null);
  const horas = numero(t.horasFaturadas);
  const total = numero(t.valorDasHoras);
  if (!inicioEm || !fimEm || horas == null || total == null) return null;
  const minutos = numero(t.horasMinutos) ?? Math.round((fimEm.getTime() - inicioEm.getTime()) / 60_000);
  const passaDaMeiaNoite = diaEmLisboa(inicioEm) !== diaEmLisboa(fimEm);
  const inicio = horaEmLisboa(inicioEm);
  const fim = horaEmLisboa(fimEm);
  const m = lerMateriaisDaProposta(t.materiaisJson ?? null);
  const usados = materiaisUsados(m, lerQuantidadesUsadas(t.materiaisUsadosJson ?? null, m));
  const valorPorHora = numero(t.valorPorHora) ?? (horasConfirmadas(t) ? null : numero(t.valorAcordado));
  const cliente = precoDoCliente(total, taxas, modelo);
  const recebe = quantoOProfissionalRecebe(total, taxas);
  const fimDito = passaDaMeiaNoite ? `${fim} (do dia seguinte)` : fim;
  const comMateriais = usados.linhas.length > 0 ? ` e materiais (${quantidadesEmPalavras(usados.linhas)})` : "";
  const totalAoCliente = cliente.ivaIncluido
    ? `${eur(cliente.semIva)} + IVA (${eur(cliente.total)} com IVA)`
    : `${eur(cliente.semIva)} + IVA`;
  const contas = valorPorHora != null ? ` × ${porHoraCurto(valorPorHora)}` : "";
  const dosMateriais = usados.total > 0 ? ` + ${eur(usados.total)} de materiais` : "";
  const confirmadasPor = lerQuemConfirmouAsHoras(t.horasConfirmadasPor);
  return {
    inicio,
    fim,
    passaDaMeiaNoite,
    minutos,
    horas,
    valorPorHora,
    materiais: usados.linhas,
    totalDosMateriais: usados.total,
    total,
    recebe,
    cliente,
    marcadasEm: instanteDaBase(t.horasMarcadasEm ?? null),
    confirmadas: horasConfirmadas(t),
    confirmadasPor,
    confirmadasEm: instanteDaBase(t.horasConfirmadasEm ?? null),
    contestadas: horasContestadas(t),
    contestacao: t.horasContestacao ?? null,
    contestadasEm: instanteDaBase(t.horasContestadasEm ?? null),
    textoParaOCliente: `O parceiro marcou das ${inicio} às ${fimDito} = ${horasEmPalavras(horas)}${comMateriais} → total ${totalAoCliente}.`,
    textoParaQuemFez:
      `Das ${inicio} às ${fimDito} (${duracaoEmPalavras(minutos)}) = ${horasEmPalavras(horas)}${contas}${dosMateriais} = ` +
      `${eur(total)} sem IVA (recebe ${eur(recebe)}).`,
    textoParaAEquipa:
      `Das ${inicio} às ${fimDito} (${duracaoEmPalavras(minutos)}) = ${horasEmPalavras(horas)}${contas}${dosMateriais} = ` +
      `${eur(total)} sem IVA; cliente ${totalAoCliente}.`,
  };
}

/** Quem confirmou, dito ao cliente e à equipa. */
export function quemConfirmouAsHorasEmPalavras(q: QuemConfirmouAsHoras | null): string {
  return q === "clyon" ? "pela CLYON" : q === "cliente" ? "pelo cliente" : "";
}

/** O estado das horas, ao cliente — `null` sem horas marcadas. */
export function estadoDasHorasParaOCliente(t: HorasNaBase): string | null {
  if (!horasMarcadas(t)) return null;
  if (horasConfirmadas(t)) {
    return lerQuemConfirmouAsHoras(t.horasConfirmadasPor) === "clyon" ? "Horas confirmadas pela CLYON." : "Confirmou as horas.";
  }
  if (horasContestadas(t)) return "Disse que não concorda com as horas. A equipa da CLYON vai ver consigo e com o parceiro.";
  return "Confira as horas e confirme, ou diga que não concorda.";
}

/** O estado das horas, a quem fez o trabalho (painel e app Pro) — `null` sem horas marcadas. */
export function estadoDasHorasParaQuemFez(t: HorasNaBase): string | null {
  if (!horasMarcadas(t)) return null;
  if (horasConfirmadas(t)) {
    return lerQuemConfirmouAsHoras(t.horasConfirmadasPor) === "clyon" ? "Horas confirmadas pela CLYON." : "O cliente confirmou as horas.";
  }
  if (horasContestadas(t)) {
    const porque = (t.horasContestacao ?? "").trim();
    return `O cliente não concorda com as horas${porque ? `: «${porque}»` : ""}. Corrija-as, ou espere pela CLYON.`;
  }
  return "À espera que o cliente confirme as horas.";
}

/** O motivo do «Não concordo», validado. */
export function lerMotivoDaContestacao(v: unknown): { ok: true; motivo: string } | { ok: false; erro: string } {
  const t = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  if (t.length < MOTIVO_MINIMO_DA_CONTESTACAO) return { ok: false, erro: "Diga em poucas palavras porque não concorda." };
  return { ok: true, motivo: t.slice(0, MOTIVO_MAXIMO_DA_CONTESTACAO) };
}

/** O dia (AAAA-MM-DD, Lisboa) a usar para o início, quando o ecrã não o manda: o da chegada, ou hoje. */
export function diaDoInicio(chegouEm: Date | string | null | undefined, agora: Date = new Date()): string {
  const c = instanteDaBase(chegouEm ?? null);
  return diaEmLisboa(c ?? agora);
}

/** «HH:MM» de agora, em Lisboa — o que o campo põe quando ele toca. */
export function agoraNoCampo(agora: Date = new Date()): string {
  return horaEmLisboa(agora);
}

/** «HH:MM» de um instante da base, em Lisboa — para pré-preencher os campos com o que está gravado. */
export function horaNoCampo(v: Date | string | null | undefined): string {
  const d = instanteDaBase(v ?? null);
  return d ? horaEmLisboa(d) : "";
}

/* ──────────────────────────────────────────────────────────────────────────
 * O DINHEIRO NO FIM: a diferença a pagar, ou a devolver
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * DEPOIS DE CONFIRMADAS, o que falta: o cliente já pagou `pago` (a estimativa
 * ou o mínimo, com IVA) e o total confirmado é `final` (o que ele paga, com
 * IVA). Mais → a diferença paga-se pela mesma rota (MB WAY/Multibanco); menos
 * → a equipa devolve à mão (nunca sozinho). Ao cêntimo.
 */
export function acertoDoFim(pago: number, final: number): { aPagar: number; aDevolver: number } {
  const d = arred(final - pago);
  if (d >= 0.01) return { aPagar: d, aDevolver: 0 };
  if (d <= -0.01) return { aPagar: 0, aDevolver: arred(-d) };
  return { aPagar: 0, aDevolver: 0 };
}

/** «A devolver ao cliente: 12,30 €» — a linha do backoffice. */
export function aDevolverEmPalavras(v: number): string {
  return `A devolver ao cliente: ${eur(v)}`;
}

/** «Falta pagar a diferença das horas: 24,60 € (com IVA)» — a linha do cliente. */
export function diferencaEmPalavras(v: number, ivaIncluido: boolean): string {
  return `Falta pagar a diferença das horas: ${eur(v)}${ivaIncluido ? " (com IVA)" : " + IVA"}.`;
}
