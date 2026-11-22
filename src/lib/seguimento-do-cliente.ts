/**
 * O SEGUIMENTO DO CLIENTE — d83 (CEO e dono, 21-11-2026).
 *
 * Na Mesa, o «Precisa de si» juntava pedidos em que o cliente respondeu mas
 * não decidiu («#649 · O cliente respondeu — escolher parceiro»). A validade
 * dos orçamentos (d62) pára quando o cliente escreve, e o pedido ficava ali
 * parado dias, com uma nota escrita à mão («Ainda não se decidiu 19/11»).
 *
 * Agora a equipa carrega em «Falei com o cliente» e diz o que ele respondeu —
 * «Vai pensar», «Não atendeu», «Quer outra data» ou «Quer cancelar» — e,
 * menos no cancelar, quando voltar a contactar (dia e hora, das 9h00 às 20h59
 * de Lisboa; por omissão, amanhã às 10h00). A partir daí:
 *
 *   · na data marcada, a 1.ª mensagem da Vitória ao cliente; no dia seguinte e
 *     no outro, à MESMA hora, a 2.ª e a 3.ª (a 3.ª diz que o pedido fecha
 *     amanhã);
 *   · sem resposta às três, no 4.º dia à mesma hora o pedido é ARQUIVADO
 *     (nunca apagado), os parceiros com proposta são avisados e o cliente
 *     recebe a mensagem do fecho (pode voltar a pedir quando quiser);
 *   · qualquer mensagem do cliente pára o ciclo, e o pedido volta a contar no
 *     «Precisa de si»; o «1», o «2» e o «3» lêem-se como no lembrete do
 *     orçamento (`lerRespostaAoLembrete`), e o «3» pede o CANCELAR (d2);
 *   · nunca mais de UMA mensagem automática por dia ao mesmo cliente (contam
 *     a validade, os lembretes do que falta e este seguimento).
 *
 * Só entra o pedido que a equipa marcar à mão — não há interruptor geral para
 * ligar. Há um de emergência, «Seguimento do cliente», LIGADO por omissão:
 * desligado, nada sai e nada fecha, e o cartão diz «enviaria a …».
 *
 * PURO: o calendário, a janela, a regra de uma por dia, os textos e as linhas
 * da Mesa. A base, a rotina e a fila estão em `seguimento-do-cliente-na-base.ts`.
 */

import { diaEmLisboa, instanteDaBase, instanteEmLisboa, pecasEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";
import { lerRespostaAoLembrete, type RespostaAoLembrete } from "./validade-do-orcamento";

/** O nome do interruptor de emergência, como aparece nas Configs. */
export const NOME_DO_INTERRUPTOR_DO_SEGUIMENTO = "Seguimento do cliente";

/** A janela das mensagens automáticas, em Lisboa: das 9h00 às 20h59. */
export const JANELA_DO_SEGUIMENTO = { das: 9, as: 21 } as const;

/** Por omissão, «voltar a contactar» é amanhã a esta hora (Lisboa). */
export const HORA_POR_OMISSAO = "10:00";

/** Quantas mensagens ao cliente antes do fecho. */
export const MENSAGENS_DO_SEGUIMENTO = 3;

/** Até quantos dias à frente se pode marcar o «voltar a contactar». */
export const DIAS_NO_MAXIMO_PARA_VOLTAR = 30;

/** O tamanho da nota curta. */
export const NOTA_NO_MAXIMO = 300;

/* ── A resposta que a equipa marca ───────────────────────────────────────── */

export type RespostaDoContacto = "vai_pensar" | "nao_atendeu" | "outra_data" | "quer_cancelar";

export const RESPOSTAS_DO_CONTACTO: readonly RespostaDoContacto[] = ["vai_pensar", "nao_atendeu", "outra_data", "quer_cancelar"];

/** Os botões do painel. */
export const ROTULOS_DAS_RESPOSTAS: Record<RespostaDoContacto, string> = {
  vai_pensar: "Vai pensar",
  nao_atendeu: "Não atendeu",
  outra_data: "Quer outra data",
  quer_cancelar: "Quer cancelar",
};

/** A resposta a meio de uma frase («Falámos a 21/11 (Ana): vai pensar — …»). */
const RESPOSTA_NA_FRASE: Record<RespostaDoContacto, string> = {
  vai_pensar: "vai pensar",
  nao_atendeu: "não atendeu",
  outra_data: "quer outra data",
  quer_cancelar: "quer cancelar",
};

export function eRespostaDoContacto(v: unknown): v is RespostaDoContacto {
  return typeof v === "string" && (RESPOSTAS_DO_CONTACTO as readonly string[]).includes(v);
}

/* ── A janela e a hora marcada ───────────────────────────────────────────── */

const dois = (n: number) => String(n).padStart(2, "0");

/** Das 9h00 às 20h59 de Lisboa? */
export function naJanelaDoSeguimento(agora: Date): boolean {
  const h = pecasEmLisboa(agora).hora;
  return h >= JANELA_DO_SEGUIMENTO.das && h < JANELA_DO_SEGUIMENTO.as;
}

/** «HH:mm» → minutos do dia, ou null. */
function minutosDe(hora: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hora.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** «HH:mm» dentro da janela (9h00–20h59)? */
export function horaNaJanela(hora: string): boolean {
  const m = minutosDe(hora);
  return m != null && m >= JANELA_DO_SEGUIMENTO.das * 60 && m < JANELA_DO_SEGUIMENTO.as * 60;
}

/** O que o painel mostra ao abrir: amanhã (Lisboa) às 10h00. */
export function voltarPorOmissao(agora: Date): { dia: string; hora: string } {
  return { dia: somarDiasAoDia(diaEmLisboa(agora), 1), hora: HORA_POR_OMISSAO };
}

export type VoltarEmValidado = { ok: true; instante: Date } | { ok: false; porque: string };

/**
 * O «VOLTAR A CONTACTAR EM», como a equipa o escreveu (dia e hora de Lisboa).
 * Pura. Só das 9h00 às 20h59, no futuro, e até 30 dias à frente.
 */
export function validarVoltarEm(dia: unknown, hora: unknown, agora: Date): VoltarEmValidado {
  if (typeof dia !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { ok: false, porque: "Falta o dia para voltar a contactar." };
  if (typeof hora !== "string" || minutosDe(hora) == null) return { ok: false, porque: "Falta a hora para voltar a contactar." };
  if (!horaNaJanela(hora)) return { ok: false, porque: "A hora tem de ser entre as 9h00 e as 20h59 (Lisboa)." };
  const instante = instanteEmLisboa(`${dia}T${hora}`);
  if (!instante) return { ok: false, porque: "O dia não é válido." };
  // O relógio de Lisboa tem de dar o que se escreveu (um 31/02 não passa).
  const p = pecasEmLisboa(instante);
  if (`${p.ano}-${dois(p.mes)}-${dois(p.dia)}` !== dia || `${dois(p.hora)}:${dois(p.minuto)}` !== hora) {
    return { ok: false, porque: "O dia não é válido." };
  }
  if (instante.getTime() <= agora.getTime()) return { ok: false, porque: "Essa hora já passou." };
  if (dia > somarDiasAoDia(diaEmLisboa(agora), DIAS_NO_MAXIMO_PARA_VOLTAR)) {
    return { ok: false, porque: `No máximo ${DIAS_NO_MAXIMO_PARA_VOLTAR} dias à frente.` };
  }
  return { ok: true, instante };
}

/* ── O calendário do ciclo ───────────────────────────────────────────────── */

export type CanalDoSeguimento = "whatsapp" | "email";

export type PassoDoSeguimento = "mensagem1" | "mensagem2" | "mensagem3" | "arquivar";

/** Um ciclo de um pedido. Datas como instantes. */
export type CicloDoSeguimento = {
  /** O instante marcado para a 1.ª mensagem. A hora dele é a hora de todas. */
  voltarEm: Date;
  /** Por onde vai; null = não se envia (sem contacto, ou conta de teste). */
  canal: CanalDoSeguimento | null;
  mensagem1Em?: Date | null;
  mensagem2Em?: Date | null;
  mensagem3Em?: Date | null;
  arquivadoEm?: Date | null;
  canceladoEm?: Date | null;
  paradoEm?: Date | null;
};

/** Acabou: arquivado, cancelado ou parado. */
export function cicloAcabado(c: CicloDoSeguimento): boolean {
  return Boolean(c.arquivadoEm || c.canceladoEm || c.paradoEm);
}

/** Está a correr e vai mesmo enviar — é o que tira o pedido da conta do «Precisa de si». */
export function seguimentoEmCurso(c: CicloDoSeguimento | null | undefined): boolean {
  return Boolean(c && c.canal && !cicloAcabado(c));
}

/* ── A espera é do cliente (d83 v2, 22-11-2026) ──────────────────────────── */

/**
 * UM PEDIDO COM O SEGUIMENTO A CORRER, como sai do servidor
 * (`pedidosEmSeguimentoActivo`, a mesma conta do `emCurso` da Mesa): o número
 * e quando a equipa marcou o «Falei com o cliente».
 */
export type PedidoEmSeguimento = { pedidoId: number; marcadoEm: string | Date };

/** Os pedidos em seguimento, pelo número, com o instante da marcação. Pura. */
export function mapaDoSeguimento(lista: readonly PedidoEmSeguimento[] | null | undefined): Map<number, Date> {
  const m = new Map<number, Date>();
  for (const s of lista ?? []) {
    const id = Number(s?.pedidoId);
    const em = instanteDaBase(s?.marcadoEm ?? null);
    if (Number.isInteger(id) && id > 0 && em) m.set(id, em);
  }
  return m;
}

/**
 * A ESPERA É DO CLIENTE, E NÃO NOSSA? Pura. Enquanto o seguimento corre, o
 * pedido não conta como «à espera de nós» — no «Precisa de si», no «Do nosso
 * lado», nos atalhos e no «à espera de si» do Início. Com a última mensagem do
 * cliente: só se ele não escreveu DEPOIS da marcação (se escreveu, o ciclo
 * pára e volta a contar como sempre, mesmo antes de a rotina o gravar).
 */
export function esperaEDoCliente(
  mapa: ReadonlyMap<number, Date>,
  pedidoId: number | null | undefined,
  ultimaDoClienteEm?: Date | null,
): boolean {
  if (pedidoId == null) return false;
  const marcadoEm = mapa.get(pedidoId);
  if (!marcadoEm) return false;
  return !clienteRespondeuAoSeguimento(marcadoEm, ultimaDoClienteEm ?? null);
}

/** A hora do ciclo, em Lisboa («10:00»). */
export function horaDoCiclo(c: Pick<CicloDoSeguimento, "voltarEm">): string {
  const p = pecasEmLisboa(c.voltarEm);
  return `${dois(p.hora)}:${dois(p.minuto)}`;
}

const maior = (a: string, b: string) => (a >= b ? a : b);

export type DiasDoCiclo = { mensagem1: string; mensagem2: string; mensagem3: string; fecho: string };

/**
 * OS DIAS DE CADA PASSO, em Lisboa. Pura. A 1.ª no dia marcado; cada passo
 * seguinte no dia a seguir ao anterior (o que saiu, ou o planeado) e nunca
 * antes do planeado: uma mensagem atrasada (a regra de uma por dia) empurra as
 * outras, e o fecho é sempre no dia a seguir à 3.ª.
 */
export function diasDoCiclo(c: CicloDoSeguimento): DiasDoCiclo {
  const d0 = diaEmLisboa(c.voltarEm);
  const m1 = c.mensagem1Em ? diaEmLisboa(c.mensagem1Em) : d0;
  const m2 = c.mensagem2Em ? diaEmLisboa(c.mensagem2Em) : maior(somarDiasAoDia(d0, 1), somarDiasAoDia(m1, 1));
  const m3 = c.mensagem3Em ? diaEmLisboa(c.mensagem3Em) : maior(somarDiasAoDia(d0, 2), somarDiasAoDia(m2, 1));
  const fecho = maior(somarDiasAoDia(d0, 3), somarDiasAoDia(m3, 1));
  return { mensagem1: m1, mensagem2: m2, mensagem3: m3, fecho };
}

/** O instante, em Lisboa, de um dia do ciclo à hora do ciclo (a mudança da hora conta). */
export function instanteDoDia(dia: string, c: Pick<CicloDoSeguimento, "voltarEm">): Date {
  return instanteEmLisboa(`${dia}T${horaDoCiclo(c)}`) ?? new Date(Number.NaN);
}

/** Os instantes planeados de cada passo — para a Mesa e para a rotina. */
export function instantesDoCiclo(c: CicloDoSeguimento): Record<keyof DiasDoCiclo, Date> {
  const d = diasDoCiclo(c);
  return {
    mensagem1: instanteDoDia(d.mensagem1, c),
    mensagem2: instanteDoDia(d.mensagem2, c),
    mensagem3: instanteDoDia(d.mensagem3, c),
    fecho: instanteDoDia(d.fecho, c),
  };
}

/** Já é a hora do ciclo neste dia (Lisboa)? Um passo atrasado só sai à mesma hora, noutro dia. */
function jaEAHora(agora: Date, c: CicloDoSeguimento): boolean {
  const p = pecasEmLisboa(agora);
  return p.hora * 60 + p.minuto >= (minutosDe(horaDoCiclo(c)) ?? 0);
}

/**
 * O PASSO QUE TOCA AGORA — ou null. Pura.
 *
 *   · acabado, sem canal, ou fora das 9h–21h: nenhum;
 *   · cada passo a partir do dia dele, e só a partir da hora do ciclo;
 *   · nunca dois passos no mesmo dia (o arquivo também não: é uma mensagem);
 *   · o arquivo só depois de a 3.ª ter saído.
 */
export function proximoPassoDoSeguimento(c: CicloDoSeguimento, agora: Date): PassoDoSeguimento | null {
  if (cicloAcabado(c) || !c.canal) return null;
  if (!naJanelaDoSeguimento(agora) || !jaEAHora(agora, c)) return null;
  const hoje = diaEmLisboa(agora);
  const d = diasDoCiclo(c);
  if (!c.mensagem1Em) return hoje >= d.mensagem1 ? "mensagem1" : null;
  if (!c.mensagem2Em) return diaEmLisboa(c.mensagem1Em) !== hoje && hoje >= d.mensagem2 ? "mensagem2" : null;
  if (!c.mensagem3Em) return diaEmLisboa(c.mensagem2Em) !== hoje && hoje >= d.mensagem3 ? "mensagem3" : null;
  return diaEmLisboa(c.mensagem3Em) !== hoje && hoje >= d.fecho ? "arquivar" : null;
}

/**
 * NUNCA MAIS DE UMA MENSAGEM AUTOMÁTICA POR DIA AO MESMO CLIENTE. Pura. As
 * datas são as de TODAS as mensagens automáticas a este contacto — a validade
 * dos orçamentos (d62), os lembretes do que falta (d71) e este seguimento, de
 * qualquer pedido dele.
 */
export function jaSaiuHojeAoCliente(datas: ReadonlyArray<Date | null | undefined>, agora: Date): boolean {
  const hoje = diaEmLisboa(agora);
  return datas.some((d) => d instanceof Date && !Number.isNaN(d.getTime()) && diaEmLisboa(d) === hoje);
}

/* ── O cliente respondeu ─────────────────────────────────────────────────── */

/** Uma mensagem DELE depois de a equipa marcar o seguimento: o ciclo pára. Pura. */
export function clienteRespondeuAoSeguimento(marcadoEm: Date, ultimaMensagemDoClienteEm: Date | null | undefined): boolean {
  return ultimaMensagemDoClienteEm instanceof Date && ultimaMensagemDoClienteEm.getTime() > marcadoEm.getTime();
}

/**
 * O PEDIDO SAIU DO «PRECISA DE SI» POR OUTRO LADO? Pura. Escolheu parceiro
 * (uma negociação acordada), foi cancelado, arquivado, rejeitado, concluído
 * ou anonimizado: o ciclo pára. Devolve o porquê, ou null.
 */
export function porqueSaiuDoPrecisaDeSi(p: {
  existe: boolean;
  status: string | null;
  anonimizado: boolean;
  temAcordada: boolean;
}): string | null {
  if (!p.existe) return "o pedido já não existe";
  if (p.anonimizado) return "o pedido foi anonimizado";
  const s = String(p.status ?? "");
  if (s === "cancelado") return "o pedido foi cancelado";
  if (s === "arquivado") return "o pedido foi arquivado";
  if (s === "rejeitado") return "o pedido foi rejeitado";
  if (s === "concluido") return "o pedido foi concluído";
  if (p.temAcordada) return "o parceiro já foi escolhido";
  return null;
}

/* ── As respostas do cliente ─────────────────────────────────────────────── */

/**
 * O QUE ELE RESPONDEU AO SEGUIMENTO — a mesma leitura do lembrete do orçamento
 * (d62/d63): «1» avança (escolher o parceiro), «2» outra data (a equipa), «3»
 * cancelar (pede o CANCELAR, d2); o resto, null (a equipa). Pura.
 */
export function lerRespostaAoSeguimento(texto: string | null | undefined): RespostaAoLembrete | null {
  return lerRespostaAoLembrete(texto);
}

/* ── Os textos ao cliente (a voz da Vitória, sem emoji — d66) ────────────── */

export type DadosDaMensagem = {
  pedidoId: number;
  /** O nome do cliente (sai só o primeiro). */
  nome: string | null | undefined;
  /** O serviço em palavras, em minúsculas: «recolha de monos». */
  servico: string;
  /** O que a equipa marcou — muda a primeira frase da 1.ª mensagem. */
  resposta: RespostaDoContacto;
};

/** As três opções. É também por esta frase que se reconhece o seguimento na conversa. */
export const AS_OPCOES_DO_SEGUIMENTO = "Responda 1 para escolher o parceiro, 2 se precisar de outra data, ou 3 para cancelar.";
export const AINDA_QUER_AVANCAR = "Ainda quer avançar?";
export const O_PEDIDO_FECHA_AMANHA = "Se não tivermos resposta, o pedido fecha amanhã.";
export const PODE_VOLTAR_A_PEDIR = "Se ainda precisar, pode voltar a pedir quando quiser: basta responder aqui.";

function ola(nome: string | null | undefined): string {
  const p = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  return p.length >= 2 ? `Olá, ${p.charAt(0).toUpperCase()}${p.slice(1)}!` : "Olá!";
}

const oPedido = (d: DadosDaMensagem) => `#${d.pedidoId} (${d.servico})`;

/** A 1.ª, na data marcada. */
export function textoDaMensagem1(d: DadosDaMensagem): string {
  const frase =
    d.resposta === "nao_atendeu"
      ? `Tentámos falar consigo sobre o seu pedido ${oPedido(d)}.`
      : d.resposta === "outra_data"
        ? `Ficou de nos dizer outra data para o seu pedido ${oPedido(d)}.`
        : `Ficou de pensar no seu pedido ${oPedido(d)}.`;
  return `${ola(d.nome)} ${frase} ${AINDA_QUER_AVANCAR} ${AS_OPCOES_DO_SEGUIMENTO}`;
}

/** A 2.ª, no dia seguinte à mesma hora. */
export function textoDaMensagem2(d: DadosDaMensagem): string {
  return `${ola(d.nome)} Volto ao seu pedido ${oPedido(d)}: ainda quer avançar? ${AS_OPCOES_DO_SEGUIMENTO}`;
}

/** A 3.ª, no outro dia à mesma hora: diz que o pedido fecha amanhã. */
export function textoDaMensagem3(d: DadosDaMensagem): string {
  return `${ola(d.nome)} Esta é a última mensagem sobre o seu pedido ${oPedido(d)}. ${O_PEDIDO_FECHA_AMANHA} ${AS_OPCOES_DO_SEGUIMENTO}`;
}

/** No 4.º dia, ao arquivar. */
export function textoDoFechoDoSeguimento(pedidoId: number): string {
  return `Fechámos o pedido #${pedidoId}, porque não tivemos resposta. ${PODE_VOLTAR_A_PEDIR}`;
}

export function textoDoPassoDoSeguimento(passo: PassoDoSeguimento, d: DadosDaMensagem): string {
  if (passo === "mensagem1") return textoDaMensagem1(d);
  if (passo === "mensagem2") return textoDaMensagem2(d);
  if (passo === "mensagem3") return textoDaMensagem3(d);
  return textoDoFechoDoSeguimento(d.pedidoId);
}

/** O assunto do email (sem telemóvel). */
export function assuntoDoSeguimento(passo: PassoDoSeguimento, pedidoId: number): string {
  return passo === "arquivar" ? `O seu pedido #${pedidoId} na CLYON foi fechado` : `O seu pedido #${pedidoId} na CLYON`;
}

/** Por email não se responde com «1», «2» ou «3»: a última frase muda. */
export function paraEmail(texto: string): string {
  return texto.replace(AS_OPCOES_DO_SEGUIMENTO, "Responda a este email, ou fale connosco pelo WhatsApp, para escolher o parceiro, marcar outra data ou cancelar.");
}

/**
 * A ÚLTIMA MENSAGEM QUE SAIU PARA ESTE TELEFONE é o seguimento DESTE pedido?
 * Só então o «1», o «2» e o «3» respondem a ele. Outra mensagem pelo meio, ou
 * o seguimento de outro pedido, e não é. O registo das saídas fica em
 * português. Pura.
 */
export function eMensagemDoSeguimento(texto: string | null | undefined, pedidoId: number): boolean {
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return false;
  const t = (texto ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!new RegExp(`#${pedidoId}(?!\\d)`).test(t)) return false;
  return t.includes("responda 1 para escolher o parceiro");
}

/* ── As linhas da Mesa ───────────────────────────────────────────────────── */

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const ddmmDe = (d: Date) => ddmm(diaEmLisboa(d));

/** «10h», «10h30». */
export function horaCurta(hora: string): string {
  const [h, m] = hora.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

/** «22/11 às 10h» — o dia e a hora do ciclo. */
function quando(dia: string, c: CicloDoSeguimento): string {
  return `${ddmm(dia)} às ${horaCurta(horaDoCiclo(c))}`;
}

/** «22/11 10:00» — quando saiu. */
function saiuA(d: Date): string {
  const p = pecasEmLisboa(d);
  return `${ddmmDe(d)} ${dois(p.hora)}:${dois(p.minuto)}`;
}

export type EstadoDoSeguimentoNaMesa = CicloDoSeguimento & {
  /** Porque parou (o cliente respondeu, à mão, o envio falhou…). */
  paradoPorque?: string | null;
  /** O cliente respondeu (quando), se foi isso que o parou. */
  respondeuEm?: Date | null;
  /** Porque não se envia, com canal null. */
  semEnvioPorque?: string | null;
};

/**
 * O PASSO DO SEGUIMENTO NO CARTÃO — «Seguimento: 1.ª mensagem a 22/11 às 10h ·
 * 2.ª a 23/11 às 10h · 3.ª a 24/11 às 10h · fecha a 25/11 às 10h»; o que saiu
 * diz «enviada a 23/11 10:00». Com o interruptor desligado, «enviaria»/«fecharia».
 * Pura.
 */
export function linhaDoSeguimentoNaMesa(c: EstadoDoSeguimentoNaMesa, ligado: boolean): string {
  if (c.canceladoEm) return `Seguimento: pedido cancelado a ${ddmmDe(c.canceladoEm)} (quer cancelar)`;
  if (c.arquivadoEm) return `Seguimento: arquivado a ${ddmmDe(c.arquivadoEm)} — o cliente não respondeu ao seguimento`;
  if (c.paradoEm) {
    if (c.respondeuEm) {
      const como = c.paradoPorque && c.paradoPorque !== "o cliente respondeu" ? ` (${c.paradoPorque})` : "";
      return `Seguimento parado: o cliente respondeu a ${ddmmDe(c.respondeuEm)}${como} — é connosco`;
    }
    return `Seguimento parado a ${ddmmDe(c.paradoEm)}${c.paradoPorque ? `: ${c.paradoPorque}` : ""}`;
  }
  if (!c.canal) return `Seguimento sem envio: ${c.semEnvioPorque ?? "sem telemóvel nem email"} — é connosco`;
  const d = diasDoCiclo(c);
  const a = ligado ? "a" : "enviaria a";
  const por = c.canal === "email" ? " (por email)" : "";
  const passo = (n: 1 | 2 | 3, em: Date | null | undefined, dia: string) =>
    em ? `${n}.ª enviada a ${saiuA(em)}` : `${n}.ª${n === 1 ? " mensagem" : ""} ${a} ${quando(dia, c)}`;
  return (
    `Seguimento${por}: ` +
    [
      passo(1, c.mensagem1Em, d.mensagem1),
      passo(2, c.mensagem2Em, d.mensagem2),
      passo(3, c.mensagem3Em, d.mensagem3),
      `${ligado ? "fecha" : "fecharia"} a ${quando(d.fecho, c)}`,
    ].join(" · ")
  );
}

/** Um «Falei com o cliente» (ou um «Parar o seguimento»), como fica guardado. */
export type ContactoDoSeguimento = {
  /** ISO. */
  em: string;
  por: string;
  /** null num «Parar o seguimento». */
  resposta: RespostaDoContacto | null;
  nota?: string | null;
  /** ISO do «voltar a contactar», quando o há. */
  voltarEm?: string | null;
};

/**
 * «Falámos a 21/11 (Ana): vai pensar — volta a contactar 22/11 às 10h · «nota»». Pura.
 */
export function linhaDoContacto(k: ContactoDoSeguimento): string {
  const em = new Date(k.em);
  const quem = k.por?.trim() || "a equipa";
  if (k.resposta == null) return `Seguimento parado à mão a ${ddmmDe(em)} (${quem})`;
  const inicio = k.resposta === "nao_atendeu" ? "Tentámos falar" : "Falámos";
  const depois =
    k.resposta === "quer_cancelar"
      ? " — pedido cancelado"
      : k.voltarEm
        ? (() => {
            const v = new Date(k.voltarEm);
            const p = pecasEmLisboa(v);
            return ` — volta a contactar ${ddmmDe(v)} às ${horaCurta(`${dois(p.hora)}:${dois(p.minuto)}`)}`;
          })()
        : "";
  const nota = k.nota?.trim() ? ` · «${k.nota.trim()}»` : "";
  return `${inicio} a ${ddmmDe(em)} (${quem}): ${RESPOSTA_NA_FRASE[k.resposta]}${depois}${nota}`;
}

/** A nota da equipa, limpa: uma linha, no máximo 300 caracteres. */
export function notaLimpa(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim().slice(0, NOTA_NO_MAXIMO);
  return t || null;
}

/** Os contactos guardados, lidos do JSON da base (o que não se ler, fica de fora). */
export function contactosDeJson(json: string | null | undefined): ContactoDoSeguimento[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    if (!Array.isArray(l)) return [];
    return l.filter(
      (k): k is ContactoDoSeguimento =>
        k != null && typeof k === "object" && typeof k.em === "string" && typeof k.por === "string" && (k.resposta === null || eRespostaDoContacto(k.resposta)),
    );
  } catch {
    return [];
  }
}

/** Quantos contactos ficam guardados no ciclo (os mais recentes). Todos ficam também no histórico do pedido. */
export const CONTACTOS_GUARDADOS = 20;
