import { comoTratar } from "./whatsapp-recolha";
import { oSeuServico } from "./servico-em-palavras";
import { diaEmLisboa, pecasEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";

/**
 * «O SEU TRABALHO MUDOU DE DIA» — o WhatsApp ao cliente.
 *
 * *«Quer que o cliente receba uma mensagem quando a data do trabalho dele
 * muda?» — «Sim, avise o cliente pelo WhatsApp.»* — 01-10-2026, no mesmo dia
 * em que as agendas passaram a deixar arrastar um trabalho para outro dia.
 *
 * Até aqui mudar a data só ficava no histórico do pedido: o cliente descobria
 * quando o profissional não aparecia no dia que ele sabia, ou aparecia num
 * dia que ele não sabia.
 *
 * NÃO SAI NO INSTANTE — sai quando a data assenta. Um arrasto engana-se e
 * corrige-se em dez segundos; o dono reorganiza uma semana e mexe no mesmo
 * trabalho três vezes. Cada mudança só regista «este mudou» (ver
 * `registarMudancaDeData` em db.ts), e a passagem do assistente avisa
 * `MINUTOS_PARA_ASSENTAR` minutos depois da ÚLTIMA. Três arrastos dão uma
 * mensagem; um arrasto desfeito não dá nenhuma.
 *
 * E O «ANTES» É O QUE O CLIENTE SABIA, não o penúltimo arrasto: guarda-se o
 * dia da primeira mudança de cada volta, e é esse que a mensagem diz.
 */

/** Quanto tempo uma data tem de ficar quieta antes de o cliente ser avisado. */
export const MINUTOS_PARA_ASSENTAR = 5;

/**
 * Quantos avisos destes por passagem do assistente (de dez em dez minutos).
 *
 * O dono a reorganizar uma semana muda vinte trabalhos numa tarde. Vinte
 * primeiros contactos do mesmo número no mesmo minuto são o padrão que faz a
 * Meta banir um número — e um número banido cala a plataforma inteira. Os que
 * sobram saem na passagem seguinte.
 */
export const AVISOS_DE_DATA_POR_PASSAGEM = 8;

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** «16:00» em Lisboa — ou nada, quando é meia-noite em ponto, que é um dia sem hora marcada. */
function horaEmLisboaOuNada(d: Date): string | null {
  const p = pecasEmLisboa(d);
  if (p.hora === 0 && p.minuto === 0) return null;
  return `${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
}

/**
 * «amanhã, sexta-feira, 2 de outubro, às 16:00» — sempre em Lisboa.
 *
 * `soAHora` é para quando o dia não muda: «às 16:00» chega, e repetir o dia
 * todo faz o cliente procurar a diferença onde ela não está.
 */
export function quandoPorExtenso(d: Date, agora: Date, soAHora = false): string {
  const hora = horaEmLisboaOuNada(d);
  if (soAHora && hora) return `às ${hora}`;
  const p = pecasEmLisboa(d);
  const dia = diaEmLisboa(d);
  const hoje = diaEmLisboa(agora);
  const nome = `${DIAS[p.diaDaSemana]}, ${p.dia} de ${MESES[p.mes - 1]}`;
  const relativo =
    dia === hoje ? "hoje" : dia === somarDiasAoDia(hoje, 1) ? `amanhã, ${nome}` : nome;
  return hora ? `${relativo}, às ${hora}` : relativo;
}

const mesmoMinuto = (a: Date, b: Date) => Math.floor(a.getTime() / 60_000) === Math.floor(b.getTime() / 60_000);

export function textoDoAvisoDeData(
  t: {
    pedidoId: number;
    cliente: string | null;
    servico: string | null;
    /** O que o cliente sabia antes. `null` quando ainda não sabia dia nenhum. */
    antes: Date | null;
    depois: Date;
  },
  agora: Date,
): string {
  const abertura = `${comoTratar(t.cliente, agora)} Aqui é a CLYON.`;
  const servico = oSeuServico(t.servico);
  // Sem serviço conhecido a frase já é «o seu pedido» — «(pedido #402)» a seguir seria dizer pedido duas vezes.
  const sujeito =
    servico === "o seu pedido"
      ? `O seu pedido #${t.pedidoId}`
      : `${servico.charAt(0).toUpperCase()}${servico.slice(1)} (pedido #${t.pedidoId})`;

  let oQue: string;
  if (!t.antes) {
    oQue = `${sujeito} já tem dia: ${quandoPorExtenso(t.depois, agora)}.`;
  } else if (diaEmLisboa(t.antes) === diaEmLisboa(t.depois)) {
    // O mesmo dia, outra hora: diz-se a hora, e o dia uma vez só.
    oQue =
      `${sujeito} mudou de hora: fica para ${quandoPorExtenso(t.depois, agora)} ` +
      `(antes era ${quandoPorExtenso(t.antes, agora, true)}).`;
  } else {
    oQue =
      `${sujeito} mudou de dia: fica para ${quandoPorExtenso(t.depois, agora)} ` +
      `(antes era ${quandoPorExtenso(t.antes, agora)}).`;
  }

  return [abertura, oQue, "Se não lhe der jeito, responda a esta mensagem."].join("\n\n");
}

/*
 * ── QUANDO ELE RESPONDE ─────────────────────────────────────────────────────
 *
 * A mensagem diz «responda a esta mensagem», e ele responde. O assistente
 * automático não sabe mudar o dia de um trabalho já contratado: lia «esse dia
 * não me dá jeito» como um pedido novo, como «o seu pedido está a ser
 * conferido», ou — pior — como um NÃO a uma proposta de outro pedido dele.
 *
 * Por isso a resposta a este aviso não passa pelo cérebro: um obrigado fica
 * registado e mais nada; o resto passa a uma pessoa da CLYON, com a etiqueta
 * no painel a dizer porquê. Ver `tratarMensagemDoCliente`.
 */

/** Durante quanto tempo uma mensagem dele conta como resposta ao aviso. */
export const HORAS_PARA_RESPONDER_AO_AVISO = 48;

export const RESPOSTA_A_QUEM_RESPONDEU_AO_AVISO =
  "Obrigado. Vou passar a sua mensagem a uma pessoa da CLYON, que lhe responde por aqui o mais depressa possível.";

export function motivoNoPainelDoAvisoDeData(pedidoId: number): string {
  return `Respondeu ao aviso da data do pedido #${pedidoId}`;
}

/**
 * «ok», «obrigada!», «está bem 👍» — um obrigado, que não pede resposta.
 *
 * Curto e feito SÓ destas palavras. «Ok, mas pode ser às 10?» não é um
 * obrigado: tem uma pergunta, e vai para uma pessoa.
 */
export function eSoUmObrigado(texto: string): boolean {
  const limpo = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\p{Extended_Pictographic}\p{Cf}]/gu, " ")
    .replace(/[.,;:!]+/g, " ")
    .trim();
  if (!limpo) return true;
  if (limpo.length > 40 || limpo.includes("?")) return false;
  const PALAVRAS =
    /^(ok|okay|okey|oki|obrigad[oa]s?|obg|brigad[oa]|muito|mt|mto|certo|combinado|perfeito|otimo|optimo|beleza|sim|esta|ta|bem|fica|entao|de|nada|recebido|visto|boa|top|joia|show)$/;
  return limpo.split(/\s+/).every((p) => PALAVRAS.test(p));
}

/*
 * ── A VOLTA DE MUDANÇAS — quem sabia o quê ─────────────────────────────────
 *
 * *«Avise também o profissional quando a data mudar.»* — 01-10-2026, umas
 * horas depois do aviso ao cliente. Os dois avisos saem da mesma volta, mas
 * não sabem a mesma coisa:
 *
 *   · o CLIENTE não mexe na data — é avisado de todas as mudanças, e o
 *     «antes era» é o dia que ele sabia quando a volta começou;
 *   · o PROFISSIONAL só é avisado do que a CLYON lhe mudou. O que ele próprio
 *     marcou, já sabe — e se a CLYON muda e ele volta a mudar a seguir, o dia
 *     final é o dele, e não há nada a dizer-lhe.
 */
export type VoltaDeData = {
  /** A volta ainda não foi avisada (`fechadoEm` NULL). */
  aberta: boolean;
  conhecida: Date | null;
  proSabe: Date | null;
  proPrecisaDeAviso: boolean;
};

/**
 * A volta depois de mais uma mudança. `antes` é o dia que estava em vigor
 * imediatamente antes desta mudança (o combinado, ou o que o cliente pediu).
 */
export function proximaVolta(
  anterior: VoltaDeData | null,
  mudanca: { antes: Date | null; porQuem: "clyon" | "profissional" },
): Omit<VoltaDeData, "aberta"> {
  const continua = anterior?.aberta === true;
  const conhecida = continua ? anterior.conhecida : mudanca.antes;
  if (mudanca.porQuem === "profissional") {
    return { conhecida, proSabe: null, proPrecisaDeAviso: false };
  }
  // A primeira mudança da CLYON depois do que ele sabia fixa o «antes era» dele.
  const proSabe = continua && anterior.proPrecisaDeAviso ? anterior.proSabe : mudanca.antes;
  return { conhecida, proSabe, proPrecisaDeAviso: true };
}

export type MotivoParaNaoAvisar =
  /** Ficou sem dia: «por combinar» não é notícia que se mande. */
  | "desmarcado"
  /** Voltou ao dia que o cliente já sabia — um arrasto desfeito. */
  | "igual"
  /** Já não é um trabalho em curso: cancelado, desistido, ou fechado. */
  | "fora_de_curso"
  /** O dia novo já passou: estão a acertar o registo, não a avisar ninguém. */
  | "ja_passou";

/**
 * Avisa-se, ou não? A decisão sem base nem relógio — para se poder testar.
 *
 * Chamada NA PASSAGEM, com o estado de agora, e não no momento da mudança:
 * entre as duas coisas o trabalho pode ter sido cancelado, ou a data voltado
 * ao que era.
 */
export function decidirAvisoDeData(
  a: {
    /** A data do trabalho agora (`negociacoes.dataCombinada`). */
    dataCombinada: Date | null;
    /** O que o cliente sabia quando esta volta de mudanças começou. */
    conhecida: Date | null;
    estado: string;
    estadoDoPedido: string | null;
    confirmadoEm: Date | null;
    pagoEm: Date | null;
    execucaoEnviadaEm: Date | null;
  },
  agora: Date,
): { avisar: true } | { avisar: false; porque: MotivoParaNaoAvisar } {
  if (
    a.estado !== "acordada" ||
    a.confirmadoEm ||
    a.pagoEm ||
    a.execucaoEnviadaEm ||
    (a.estadoDoPedido != null && ["cancelado", "concluido", "arquivado"].includes(a.estadoDoPedido))
  ) {
    return { avisar: false, porque: "fora_de_curso" };
  }
  if (!a.dataCombinada) return { avisar: false, porque: "desmarcado" };
  if (a.conhecida && mesmoMinuto(a.conhecida, a.dataCombinada)) return { avisar: false, porque: "igual" };
  if (a.dataCombinada.getTime() < agora.getTime()) return { avisar: false, porque: "ja_passou" };
  return { avisar: true };
}
