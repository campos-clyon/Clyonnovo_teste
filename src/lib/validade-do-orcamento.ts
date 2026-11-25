/**
 * O ORÇAMENTO TEM VALIDADE — d62 (CEO e dono, 18-11-2026).
 *
 * Na Mesa, «A aguardar cliente» ficava parado dias: a equipa mandava lembretes
 * à mão e os parceiros ficavam sem resposta. A regra:
 *
 *   · D (o envio): a mensagem do orçamento diz «Esta proposta é válida até
 *     {dia da semana, dd/mm}» — 3 dias depois, em Lisboa;
 *   · D+1, entre as 9h e as 20h de Lisboa: o lembrete, na voz da Vitória, com
 *     a melhor proposta e as opções 1/2/3;
 *   · D+3: o último aviso — «Se não tivermos resposta até amanhã às 18h,
 *     fechamos o pedido.»;
 *   · D+4 às 18h: o pedido fecha (arquivado por falta de resposta, nunca
 *     apagado), os parceiros com proposta são avisados, e o cliente também.
 *
 * Uma mensagem do cliente pára a contagem e passa à equipa; um pedido reaberto
 * recomeça do zero. Nunca duas mensagens automáticas ao mesmo cliente no mesmo
 * dia: se um passo atrasou (o interruptor ligado tarde, a conversa com uma
 * pessoa), os seguintes empurram-se — o último aviso é sempre num dia depois do
 * lembrete, e o fecho é sempre às 18h do dia a seguir ao último aviso.
 *
 * DESLIGADO POR OMISSÃO (o interruptor «Validade dos orçamentos», nas Configs):
 * desligado, nada sai e nada fecha, e a Mesa mostra «fecharia a …».
 *
 * PURO: as datas, a melhor proposta, os textos e a leitura das respostas. A
 * base, a rotina e a fila estão em `validade-do-orcamento-na-base.ts`.
 */

import { JANELA_DE_CONTACTO } from "./janela-de-contacto";
import { diaEmLisboa, instanteEmLisboa, pecasEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";
import { textoDoFechoAoParceiro } from "./textos-dos-avisos-ao-profissional";
import { regraDaBase } from "./frase-da-base";

/** O nome do interruptor, como aparece nas Configs. */
export const NOME_DO_INTERRUPTOR_DA_VALIDADE = "Validade dos orçamentos";

/** Quantos dias vale a proposta, contados do dia do envio (Lisboa). */
export const DIAS_DE_VALIDADE = 3;
/** O lembrete sai no dia a seguir ao envio. */
export const DIAS_ATE_AO_LEMBRETE = 1;
/** O último aviso, no dia em que a validade acaba (e sempre num dia depois do lembrete). */
export const DIAS_ATE_AO_ULTIMO_AVISO = 3;
/** A hora do fecho, em Lisboa, no dia a seguir ao último aviso. */
export const HORA_DO_FECHO = 18;
/** A janela das mensagens automáticas: a de contacto (das 9h00 às 19h59, em Lisboa). */
export const JANELA_DA_VALIDADE = { das: JANELA_DE_CONTACTO.abre, as: JANELA_DE_CONTACTO.fecha } as const;
/** «Até 10 % mais cara, com melhor avaliação» — a escolha da proposta do lembrete. */
export const MARGEM_PARA_A_MELHOR_AVALIADA = 0.1;

export type PassoDaValidade = "lembrete1" | "ultimo_aviso" | "fechar";

/** Um ciclo de um pedido: de onde conta, e o que já saiu. Datas como instantes. */
export type CicloDoOrcamento = {
  /** O início da contagem: o envio do orçamento, ou o momento em que o pedido foi reaberto. */
  desde: Date;
  lembrete1Em?: Date | null;
  ultimoAvisoEm?: Date | null;
  fechadoEm?: Date | null;
  /** O cliente respondeu (ou o pedido saiu por outro lado): a contagem parou. */
  paradoEm?: Date | null;
};

const dois = (n: number) => String(n).padStart(2, "0");
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const maior = (a: string, b: string) => (a >= b ? a : b);

const DIAS_DA_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** O dia (YYYY-MM-DD, Lisboa) até ao qual a proposta vale: o do envio + 3. */
export function diaDaValidade(enviadoEm: Date): string {
  return somarDiasAoDia(diaEmLisboa(enviadoEm), DIAS_DE_VALIDADE);
}

/** «sexta-feira, 21/11» — o dia da semana e o dia, em Lisboa. */
export function diaDaSemanaEDia(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  const semana = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${DIAS_DA_SEMANA[semana]}, ${dois(d)}/${dois(m)}`;
}

/** A linha que vai na mensagem do orçamento: «Esta proposta é válida até sexta-feira, 21/11.» */
export function linhaDaValidade(enviadoEm: Date): string {
  return `Esta proposta é válida até ${diaDaSemanaEDia(diaDaValidade(enviadoEm))}.`;
}

/** A mensagem do orçamento com a validade no fim (uma vez: uma que já a tem fica como está). */
export function comValidade(texto: string, enviadoEm: Date): string {
  if (/Esta proposta é válida até /.test(texto)) return texto;
  return `${texto.trimEnd()}\n${linhaDaValidade(enviadoEm)}`;
}

/* ── As datas de um ciclo ─────────────────────────────────────────────────── */

export type DatasDoCiclo = {
  /** O dia do envio (ou da reabertura). */
  diaDoEnvio: string;
  /** O dia do lembrete: o planeado, ou o que saiu. */
  diaDoLembrete: string;
  /** O dia do último aviso: o planeado, ou o que saiu. */
  diaDoUltimoAviso: string;
  /** O instante do fecho: às 18h de Lisboa do dia a seguir ao último aviso. */
  fecho: Date;
};

/** Pura. As datas de um ciclo, contadas em dias de Lisboa. */
export function datasDoCiclo(c: CicloDoOrcamento): DatasDoCiclo {
  const diaDoEnvio = diaEmLisboa(c.desde);
  const diaDoLembrete = c.lembrete1Em ? diaEmLisboa(c.lembrete1Em) : somarDiasAoDia(diaDoEnvio, DIAS_ATE_AO_LEMBRETE);
  // O último aviso: no D+3, e nunca antes de dois dias depois do lembrete (um lembrete atrasado empurra-o).
  const diaDoUltimoAviso = c.ultimoAvisoEm
    ? diaEmLisboa(c.ultimoAvisoEm)
    : maior(somarDiasAoDia(diaDoEnvio, DIAS_ATE_AO_ULTIMO_AVISO), somarDiasAoDia(diaDoLembrete, 2));
  const fecho =
    instanteEmLisboa(`${somarDiasAoDia(diaDoUltimoAviso, 1)}T${dois(HORA_DO_FECHO)}:00`) ?? new Date(Number.NaN);
  return { diaDoEnvio, diaDoLembrete, diaDoUltimoAviso, fecho };
}

/** Na janela de contacto (9h–20h de Lisboa)? */
export function naJanelaDaValidade(agora: Date): boolean {
  const h = pecasEmLisboa(agora).hora;
  return h >= JANELA_DA_VALIDADE.das && h < JANELA_DA_VALIDADE.as;
}

/** O dia (Lisboa) da última mensagem automática deste ciclo, ou null. */
export function diaDaUltimaMensagem(c: CicloDoOrcamento): string | null {
  const dias = [c.ultimoAvisoEm, c.lembrete1Em].filter((d): d is Date => d instanceof Date).map(diaEmLisboa);
  return dias.length ? dias.sort().at(-1)! : null;
}

/**
 * O PASSO QUE TOCA AGORA — ou null. Pura.
 *
 *   · com o ciclo fechado ou parado, nenhum;
 *   · o lembrete, a partir do D+1;
 *   · o último aviso, a partir do dia dele, e nunca no dia do lembrete;
 *   · o fecho, a partir das 18h do dia a seguir ao último aviso — e só depois
 *     de o último aviso ter saído (sem aviso, não se fecha).
 *
 * A rotina só fala dentro da janela (9h–20h). O «Lembrar agora» da Mesa
 * (`manual`) salta a janela e o dia do lembrete, mas não manda dois avisos no
 * mesmo dia, e não fecha.
 */
export function proximoPasso(c: CicloDoOrcamento, agora: Date, opcoes: { manual?: boolean } = {}): PassoDaValidade | null {
  if (c.fechadoEm || c.paradoEm) return null;
  const manual = opcoes.manual === true;
  if (!manual && !naJanelaDaValidade(agora)) return null;
  const hoje = diaEmLisboa(agora);
  const d = datasDoCiclo(c);
  if (!c.lembrete1Em) return manual || hoje >= d.diaDoLembrete ? "lembrete1" : null;
  if (!c.ultimoAvisoEm) {
    if (diaEmLisboa(c.lembrete1Em) === hoje) return null;
    return manual || hoje >= d.diaDoUltimoAviso ? "ultimo_aviso" : null;
  }
  if (manual) return null;
  return agora.getTime() >= d.fecho.getTime() ? "fechar" : null;
}

/**
 * NUNCA DUAS MENSAGENS AUTOMÁTICAS AO MESMO CLIENTE NO MESMO DIA. Pura.
 * Os ciclos de outros pedidos do mesmo telefone contam: com dois pedidos à
 * espera, sai um passo por dia.
 */
export function jaFalouHoje(ciclosDoTelefone: CicloDoOrcamento[], agora: Date, outrasMensagensHoje: Date[] = []): boolean {
  const hoje = diaEmLisboa(agora);
  const dias = [
    ...ciclosDoTelefone.flatMap((c) => [c.lembrete1Em, c.ultimoAvisoEm, c.fechadoEm]),
    ...outrasMensagensHoje,
  ]
    .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
    .map(diaEmLisboa);
  return dias.includes(hoje);
}

/* ── O cliente respondeu ─────────────────────────────────────────────────── */

/**
 * Uma mensagem DELE depois do início do ciclo: a contagem pára. Pura.
 *
 * Só a do cliente: a conversa «passada a uma pessoa» não conta — a ponte
 * entrega a conversa sempre que alguém da equipa escreve do telemóvel, e é
 * assim que muitos orçamentos saem; contá-la parava quase todos no próprio
 * envio (visto na Mesa a 18-11-2026, com 6 de 9 parados à nascença).
 */
export function clienteRespondeuNoCiclo(desde: Date, ultimaMensagemDoClienteEm: Date | null | undefined): boolean {
  return ultimaMensagemDoClienteEm instanceof Date && ultimaMensagemDoClienteEm.getTime() > desde.getTime();
}

/* ── A melhor proposta ───────────────────────────────────────────────────── */

export type PropostaCandidata = {
  negociacaoId: number | null;
  /** O nome da empresa parceira; null num valor único (quem faz escolhe-o a CLYON). */
  parceiro: string | null;
  /** O que o cliente paga, sem IVA. */
  semIva: number;
  /** O mesmo, com IVA. */
  total: number;
  /** A nota que conta (média e quantas); null sem avaliações. */
  nota: { media: number; quantas: number } | null;
};

/**
 * A PROPOSTA DO LEMBRETE. Pura. A mais barata (pelo que o cliente paga); mas se
 * houver outra até 10 % mais cara com melhor avaliação, essa — a mais bem
 * avaliada dessas (mais avaliações a desempatar, depois a mais barata).
 */
export function melhorProposta<T extends PropostaCandidata>(candidatas: T[]): T | null {
  const validas = candidatas.filter((c) => Number.isFinite(c.total) && c.total > 0);
  if (validas.length === 0) return null;
  const porPreco = [...validas].sort((a, b) => a.total - b.total || a.semIva - b.semIva);
  const barata = porPreco[0];
  const notaDe = (c: T) => (c.nota ? c.nota.media : -1);
  const limite = barata.total * (1 + MARGEM_PARA_A_MELHOR_AVALIADA) + 0.005;
  const melhores = porPreco
    .filter((c) => c !== barata && c.total <= limite && notaDe(c) > notaDe(barata))
    .sort((a, b) => notaDe(b) - notaDe(a) || (b.nota?.quantas ?? 0) - (a.nota?.quantas ?? 0) || a.total - b.total);
  return melhores[0] ?? barata;
}

/* ── Os textos ───────────────────────────────────────────────────────────── */

const euros = (v: number) => {
  const c = Math.round(v * 100) / 100;
  const [inteiro, cent] = c.toFixed(2).split(".");
  const grupos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return cent === "00" ? `${grupos} €` : `${grupos},${cent} €`;
};

export type DadosDoLembrete = {
  pedidoId: number;
  /** O primeiro nome do cliente, ou vazio. */
  nome: string | null | undefined;
  /** O serviço em palavras, em minúsculas: «recolha de monos». */
  servico: string;
  semIva: number;
  total: number;
  /** «por carga», «por hora», ou nada. */
  unidade?: "carga" | "hora" | null;
  parceiro: string | null;
  /** d91 (3.13): o dia (YYYY-MM-DD, Lisboa) até ao qual a proposta vale — `diaDaValidade`. */
  validaAte?: string | null;
  /** d91 (5.2, variante B): a nota do parceiro, do campo, quando a há. */
  nota?: { media: number; quantas: number } | null;
};

/** «105 € + IVA (129,15 € com IVA)» — nunca o sem IVA sozinho; sem IVA a acrescer, o total. */
export function valorDoLembrete(semIva: number, total: number, unidade?: "carga" | "hora" | null): string {
  const por = unidade === "carga" ? " por carga" : unidade === "hora" ? " por hora" : "";
  if (Math.abs(total - semIva) < 0.005) return `${euros(total)}${por}`;
  return `${euros(semIva)} + IVA (${euros(total)} com IVA)${por}`;
}

/**
 * «129,15 € com IVA (105 € + IVA)» — o que paga primeiro, e o sem IVA ao lado
 * (nunca sozinho: a regra p da orquestra). Sem IVA a acrescer, o total. d113.
 */
export function valorComIvaPrimeiro(semIva: number, total: number, unidade?: "carga" | "hora" | null): string {
  const por = unidade === "carga" ? " por carga" : unidade === "hora" ? " por hora" : "";
  if (Math.abs(total - semIva) < 0.005) return `${euros(total)}${por}`;
  return `${euros(total)} com IVA (${euros(semIva)} + IVA)${por}`;
}

export const AS_TRES_OPCOES =
  "Responda 1 para avançar, 2 se tiver dúvidas ou quiser outra data, ou 3 se já não precisar.";

function olaENome(nome: string | null | undefined): string {
  const p = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  return p.length >= 2 ? `Olá, ${p.charAt(0).toUpperCase()}${p.slice(1)}!` : "Olá!";
}

/**
 * «O parceiro X faz por 129,15 € com IVA (105 € + IVA).» — d113 (25-11-2026):
 * quem faz é o parceiro, e o valor numa frase só. Sem o nome (um valor único,
 * em que o parceiro ainda se escolhe), «O parceiro faz por …».
 */
export function oParceiroFazPor(d: Pick<DadosDoLembrete, "parceiro" | "semIva" | "total" | "unidade">): string {
  const nome = d.parceiro?.trim() ? ` ${d.parceiro.replace(/\s+/g, " ").trim()}` : "";
  return `O parceiro${nome} faz por ${valorComIvaPrimeiro(d.semIva, d.total, d.unidade)}.`;
}

/** d63: por carga ou por hora, a regra única da base (`frase-da-base.ts`), com o exemplo das cargas — ou nada. Fica mesmo curto (d114): é o que diz o que o valor quer dizer. */
const aRegraDaBase = (d: DadosDoLembrete) => (d.unidade ? regraDaBase(d.unidade, null, { semIva: d.semIva, total: d.total }) : "");

/*
 * OS TEXTOS DA d91 (Marketing, 23-11-2026, secções 3.13–3.17), com a correcção
 * do CEO: do pagamento só o que o código cumpre desde 15-11 — não há nada
 * adiantado (`SEM_PAGAMENTO_ADIANTADO`); nunca «só paga depois do trabalho
 * feito». «É o total a pagar» só num valor fechado: por carga ou por hora o
 * total depende das cargas ou das horas, e diz-o a regra da base.
 */
/** Num valor fechado: o que o cliente lê é o que paga (d113: mais curto). */
export const E_O_TOTAL_A_PAGAR = "É o total, sem nada adiantado.";
/** Por carga ou por hora. */
export const NAO_PAGA_NADA_ADIANTADO = "Não paga nada adiantado.";

/** «Vale até sexta-feira, 27/11.» — ou nada, sem o dia. */
function validoAte(d: DadosDoLembrete): string {
  return d.validaAte && /^\d{4}-\d{2}-\d{2}$/.test(d.validaAte) ? `Vale até ${diaDaSemanaEDia(d.validaAte)}.` : "";
}

const juntar = (...partes: string[]) => partes.filter((p) => p && p.trim()).join(" ");

/** A variante do A/B do lembrete D+1 (d91, 5.2): pedido par → A, ímpar → B. Pura. */
export function varianteDoLembrete(pedidoId: number): "A" | "B" {
  return Math.abs(Math.trunc(pedidoId)) % 2 === 0 ? "A" : "B";
}


/**
 * D+1 — o lembrete. A/B (d91, 5.2): A (par) «ficou a pensar?»; B (ímpar)
 * «ficou alguma dúvida?». As duas acabam nas três opções, letra a letra
 * (`aUltimaSaidaE`). d113 (25-11-2026): o tom leve do dia a dia — uma ideia
 * por frase, o parceiro que faz, o valor com IVA e o sem IVA ao lado.
 * d114 (25-11-2026): mais curto — só o valor, o parceiro, até quando vale e a
 * pergunta (e, por carga ou por hora, a regra da base, d63: é o que diz o que
 * o valor quer dizer); o pagamento e a nota ficam para a confirmação depois
 * de aceitar (e para quando ele perguntar).
 */
export function textoDoLembrete(d: DadosDoLembrete): string {
  const pergunta =
    varianteDoLembrete(d.pedidoId) === "B"
      ? `Ficou alguma dúvida sobre o orçamento do pedido #${d.pedidoId} (${d.servico})?`
      : `Ficou a pensar no seu pedido #${d.pedidoId} (${d.servico})?`;
  return juntar(olaENome(d.nome), pergunta, oParceiroFazPor(d), aRegraDaBase(d), validoAte(d), AS_TRES_OPCOES);
}

/** d113: o prazo, dito por ela, numa frase. */
export const SE_NAO_TIVERMOS_RESPOSTA = "Se não me disser nada até amanhã às 18h, o pedido fecha.";

/** D+3 — o último aviso. */
export function textoDoUltimoAviso(d: DadosDoLembrete): string {
  return juntar(
    olaENome(d.nome),
    `Não queria que perdesse o orçamento do pedido #${d.pedidoId} (${d.servico}).`,
    oParceiroFazPor(d),
    aRegraDaBase(d),
    SE_NAO_TIVERMOS_RESPOSTA,
    AS_TRES_OPCOES,
  );
}

/** d113: a porta que fica aberta depois do fecho. */
export const SE_AINDA_PRECISAR_REABRO = "Se ainda precisar, é só responder e volto a abri-lo.";

/** D+4 às 18h — ao cliente. */
export function textoDoFechoAoCliente(pedidoId: number): string {
  return `Como não tive notícias, fechei o pedido #${pedidoId}. ${SE_AINDA_PRECISAR_REABRO}`;
}

/** D+4 às 18h — aos parceiros com proposta (o texto vive com os outros avisos ao profissional). */
export { textoDoFechoAoParceiro };

/** «1» depois de aceite: a resposta ao cliente (a adjudicação segue pela equipa). */
export function textoDoAvancarNumTrabalhoClyon(pedidoId: number, parceiro: string | null, nome?: string | null): string {
  const com = parceiro?.trim() ? ` com o parceiro ${parceiro.trim()}` : "";
  // d91 (3.16): «uma pessoa da equipa» — não se sabe quem vai falar.
  const obrigada = olaENome(nome).replace(/^Olá/, "Obrigada");
  return `${obrigada} O pedido #${pedidoId} fica reservado${com}. Uma pessoa da equipa fala consigo por aqui para combinar o dia.`;
}

/* ── As respostas ────────────────────────────────────────────────────────── */

export type RespostaAoLembrete = "avancar" | "duvidas" | "cancelar";

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/[!.,;:…]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O QUE ELE RESPONDEU AO LEMBRETE — ou null (passa à equipa). Pura.
 *
 *   · «1», «sim», «avançar», «aceito» → avançar;
 *   · «2», «tenho uma dúvida», «outra data» → dúvidas (a equipa);
 *   · «3», «já não preciso», «cancelar» → cancelar.
 *
 * Só o que é claro: um «sim, mas…» ou uma pergunta não é um «1» — vai à equipa.
 */
export function lerRespostaAoLembrete(texto: string | null | undefined): RespostaAoLembrete | null {
  const t = normalizar(texto ?? "");
  if (!t) return null;
  const numero = /^(?:opcao|op|numero|n)?\s*([123])$/.exec(t)?.[1];
  if (numero === "1") return "avancar";
  if (numero === "2") return "duvidas";
  if (numero === "3") return "cancelar";
  if (/\?/.test(texto ?? "") || /\b(mas|but|however)\b/.test(t)) return null;
  /*
   * d63 (18-11-2026), o #603 (cliente inglesa): «sorted now» e «found someone»
   * valem «3», como «já resolvi» ou «arranjei outra empresa». Começa a frase,
   * com o que for a seguir («all sorted, thanks», «já resolvi, obrigada»).
   */
  if (
    /^(?:hi |hello |ola |obrigad[oa] |thanks |thank you )?(?:(?:it'?s |its |is |were |we'?re |we are |i'?m |i am |all |already |everything'?s |everything is )*sorted(?: now| out)?|(?:it'?s |its )?all (?:done|good)|already (?:done|sorted|found|booked|taken care)|(?:i'?ve |we'?ve |i have |we have |i |we )?(?:already )?found (?:someone|somebody|another|other|a company|someone else)|(?:i |we )?(?:dont |do not |don'?t )?(?:no longer|not anymore) need(?:ed)?|(?:i |we )?(?:dont|do not|don'?t) need(?: (?:it|this|you|them|the service))?(?: anymore| any more)?|no longer (?:needed|required|necessary)|not (?:needed|required|necessary)(?: anymore| any more)?|no thanks?|no thank you|nope|cancel(?: it| please)?|please cancel|ja nao preciso|nao preciso|ja nao e (?:preciso|necessario)|ja nao quero|nao quero mais|nao obrigad[oa]|pode cancelar|quero cancelar|cancelar|cancele|cancela|cancelem|desisto|ja (?:resolvi|resolvemos|tratei|tratamos|arranjei|arranjamos|contratei|contratamos)|ja (?:esta|ficou|foi) (?:resolvido|tratado|feito)|arranjei (?:outra|outro|alguem)|arranjamos (?:outra|outro|alguem)|ja tenho (?:outra|outro|quem))\b/.test(
      t,
    )
  ) {
    return "cancelar";
  }
  if (/^(tenho (uma )?duvida|tenho duvidas|duvida|outra data|quero outra data|prefiro outra data|i have a question|another date|other date)\b/.test(t)) return "duvidas";
  if (
    /^(sim|avancar|quero avancar|pode avancar|podem avancar|vamos avancar|aceito|aceitamos|pode ser|ok|okay|ok avancar|ok pode avancar|yes|yeah|yep|go ahead|yes go ahead|ok go ahead|lets go ahead|let'?s go ahead|lets do it|let'?s do it)( (sim|ok|obrigad[oa]|por favor|pode ser|avancar|quero|aceito|pode avancar|yes|please|go ahead|thanks|thank you))*$/.test(
      t,
    )
  ) {
    return "avancar";
  }
  return null;
}

/* ── A linha da Mesa ─────────────────────────────────────────────────────── */

/**
 * «orçamento enviado 17/11 · lembrete 1 a 18/11 · último aviso a 20/11 · fecha
 * a 21/11 às 18h» — ou, com o interruptor desligado, «… · fecharia a 21/11 às
 * 18h». O que já saiu diz «enviado». Pura.
 */
/**
 * É CONNOSCO? — d119 (25-11-2026). O cliente respondeu durante o ciclo: só é
 * connosco («Precisa de si») se ficou sem resposta, ou se a conversa passou à
 * equipa depois. Com a Vitória a responder-lhe a seguir (e a conversa com
 * ela), a contagem para mas o pedido fica em «A aguardar cliente». Pura.
 */
export function respostaEConnosco(r: {
  ultimaDoClienteEm: Date | null | undefined;
  ultimaDaVitoriaEm?: Date | null;
  passadaEm?: Date | null;
}): boolean {
  const cliente = r.ultimaDoClienteEm?.getTime();
  if (cliente == null || Number.isNaN(cliente)) return true;
  const passada = r.passadaEm?.getTime();
  if (passada != null && !Number.isNaN(passada) && passada >= cliente) return true;
  const vitoria = r.ultimaDaVitoriaEm?.getTime();
  return vitoria == null || Number.isNaN(vitoria) || vitoria < cliente;
}

export function linhaDaMesa(
  c: CicloDoOrcamento & { reaberto?: boolean; vitoriaRespondeu?: boolean },
  ligado: boolean,
): string {
  const d = datasDoCiclo(c);
  const inicio = `${c.reaberto ? "reaberto" : "orçamento enviado"} ${ddmm(d.diaDoEnvio)}`;
  if (c.fechadoEm) return `${inicio} · fechado a ${ddmm(diaEmLisboa(c.fechadoEm))} por falta de resposta`;
  // d119: com a Vitória a responder-lhe depois, a contagem parou mas não é connosco.
  if (c.paradoEm && c.vitoriaRespondeu) {
    return `${inicio} · o cliente respondeu a ${ddmm(diaEmLisboa(c.paradoEm))} e a Vitória já lhe respondeu — contagem parada`;
  }
  if (c.paradoEm) return `${inicio} · o cliente respondeu a ${ddmm(diaEmLisboa(c.paradoEm))} — contagem parada, é connosco`;
  const lembrete = c.lembrete1Em ? `lembrete 1 enviado a ${ddmm(d.diaDoLembrete)}` : `lembrete 1 a ${ddmm(d.diaDoLembrete)}`;
  const aviso = c.ultimoAvisoEm
    ? `último aviso enviado a ${ddmm(d.diaDoUltimoAviso)}`
    : `último aviso a ${ddmm(d.diaDoUltimoAviso)}`;
  const fecho = `${ligado ? "fecha" : "fecharia"} a ${ddmm(diaEmLisboa(d.fecho))} às ${HORA_DO_FECHO}h`;
  return [inicio, lembrete, aviso, fecho].join(" · ");
}

/** O passo que o «Lembrar agora» mandaria, em palavras — ou null (não há botão). */
export function rotuloDoLembrarAgora(c: CicloDoOrcamento, agora: Date): string | null {
  const p = proximoPasso(c, agora, { manual: true });
  if (p === "lembrete1") return "Lembrar agora";
  if (p === "ultimo_aviso") return "Lembrar agora (último aviso)";
  return null;
}

/* ── O «3» pede confirmação — d2 (CEO e dono, 18-11-2026) ────────────────── */

/**
 * O «3» (ou «já não preciso») ao lembrete já não cancela logo: a Vitória
 * pergunta «Confirma que quer cancelar o pedido #N? Responda CANCELAR.», e só
 * o CANCELAR cancela. Um «3» que responde a outra pergunta, um «3» de outro
 * telefone ou de outro pedido nunca cancela nada.
 */
export function textoDaConfirmacaoDoCancelamento(pedidoId: number): string {
  return `Confirma que quer cancelar o pedido #${pedidoId}? Responda CANCELAR. ${SE_FOR_O_VALOR_OU_A_DATA}`;
}

/** d91 (3.17): salva os «3» que são uma objecção de preço ou de data, e não uma desistência. */
export const SE_FOR_O_VALOR_OU_A_DATA =
  "Se for por causa do valor ou da data, diga-nos o que lhe serve e falamos com os parceiros antes de fechar.";

/** Quanto tempo a pergunta do CANCELAR vale. Depois disso, um CANCELAR já não cancela (vai à equipa). */
export const HORAS_PARA_CONFIRMAR_O_CANCELAMENTO = 48;

/**
 * Os dados do pedido cancelado pelo lembrete não saem no momento: a purga
 * anonimiza-o 7 dias depois, e até lá a equipa ainda pode desfazer (reabrir o
 * pedido tira-o da purga).
 */
export const DIAS_ATE_ANONIMIZAR_O_CANCELADO = 7;

/**
 * É O CANCELAR? Só a palavra (em português, ou como o tradutor a pôs —
 * «cancel», «annuler»), com o pedido e o número se ele os escrever. Um «3», um
 * «sim» ou um «já não preciso» não são o CANCELAR. Pura.
 */
export function eConfirmacaoDoCancelamento(texto: string | null | undefined): boolean {
  // Uma pergunta («cancelar?») não é o CANCELAR.
  if (/\?/.test(texto ?? "")) return false;
  const t = normalizar(texto ?? "")
    .replace(/[#°º]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /^(?:cancelar|cancel|annuler)(?: (?:o |the |la )?(?:pedido|request|demande))?(?: (?:n |no )?\d+)?$/.test(t);
}

/** O telefone para comparar: dígitos, sem «00», com o 351 nos telemóveis portugueses de 9 dígitos. Pura. */
export function telefoneEstrito(v: string | null | undefined): string {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (/^9\d{8}$/.test(d)) d = `351${d}`;
  return d.length >= 9 ? d : "";
}

/** O MESMO TELEFONE, número inteiro (não os últimos 9 dígitos). Pura. */
export function mesmoTelefoneEstrito(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = telefoneEstrito(a);
  return x !== "" && x === telefoneEstrito(b);
}

/**
 * A ÚLTIMA MENSAGEM QUE SAIU PARA ESTE TELEFONE é a deste pedido? O «1», o «2»
 * e o «3» só respondem ao lembrete (ou ao último aviso) se for ele a última
 * coisa que lhe dissemos; o CANCELAR, se for a pergunta do CANCELAR. Outra
 * pergunta pelo meio (da Vitória ou da equipa), ou o lembrete de outro pedido,
 * e não é resposta a este. O registo das saídas fica em português. Pura.
 */
export function aUltimaSaidaE(texto: string | null | undefined, pedidoId: number): "lembrete" | "confirmacao" | null {
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return null;
  const t = (texto ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!new RegExp(`#${pedidoId}(?!\\d)`).test(t)) return null;
  if (t.includes("confirma que quer cancelar o pedido") && t.includes("responda cancelar")) return "confirmacao";
  if (t.includes(normalizarFrase(AS_TRES_OPCOES).slice(0, 23))) return "lembrete";
  return null;
}

function normalizarFrase(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
