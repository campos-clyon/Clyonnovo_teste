import { diaEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";
import { MINUTOS_ATE_A_PRIMEIRA_MENSAGEM } from "./propostas-curtas";
import {
  aHoraDoDia,
  diaEHoraCurtos,
  HORA_DO_QUE_FICOU_PARA_DEPOIS,
  momentoDeSaida,
} from "./janela-das-mensagens-automaticas";

/**
 * AS PROPOSTAS VÃO AO CLIENTE SOZINHAS — d88 passo 3 (CEO e dono, 23-11-2026).
 *
 * Até aqui as propostas dos parceiros ficavam em «Propostas de parceiros por
 * enviar ao cliente» (`do-nosso-lado.ts`) até alguém da equipa carregar em
 * «Enviar orçamento» ou «Enviar pela CLYON». Agora, num pedido em negociação
 * com propostas por enviar (a mesma conta da Mesa, `propostasPorEnviarDoPedido`):
 *
 *   · (d6, 23-11-2026) assim que chega a 1.ª proposta — a regra de antes, 3
 *     propostas ou 3 horas depois da 1.ª, fica para as que chegaram antes dela —, a
 *     Vitória envia ao cliente o orçamento — o MESMO texto e o mesmo caminho do
 *     «Enviar pela CLYON» (`textoDoOrcamentoDaMesa`, `enviarTextoManualWhatsApp`,
 *     `marcarOrcamentoEnviado`): «válido até…», cada parceiro com o valor sem
 *     e com IVA. A partir daí correm a validade (d62) e o seguimento (d83);
 *   · das 9h às 20h de Lisboa; o que cai fora sai às 9h; e nunca no dia em que
 *     já saiu outra mensagem automática a esse cliente (vai no dia seguinte, às
 *     9h);
 *   · um parceiro que mudou a proposta há menos de 10 min: espera-se;
 *   · UMA vez por pedido (a reserva na base), e só se o orçamento ainda não foi
 *     ao cliente: depois de enviado (por aqui ou à mão), o que chegar a seguir é
 *     da equipa.
 *
 * Ficam com uma pessoa (e o cartão da Mesa diz porquê): a melhor proposta acima
 * de 500 € com IVA; os Trabalhos CLYON e o valor único; as mudanças à hora (a
 * folha); a conversa com uma pessoa (d73); o cliente noutra língua sem
 * tradução; um pedido com queixa; sem telemóvel ou com o número bloqueado.
 *
 * O interruptor «Enviar as propostas ao cliente» (Configs, só o administrador)
 * nasce LIGADO (o dono pediu); desligado, a Mesa diz «enviaria a …».
 *
 * d114 (25-11-2026) — POUCAS MENSAGENS, CURTAS. Esta é a única rotina que diz
 * as propostas ao cliente sozinha (a proposta nova e o «o parceiro aceitou»
 * deixaram de sair uma a uma — `propostas-curtas.ts`):
 *
 *   · a 1.ª mensagem sai 1 h depois da 1.ª proposta, ou logo que chega a 2.ª
 *     (ou que um parceiro aceita o valor que o cliente propôs), o que vier
 *     primeiro — sempre das 9h às 20h; fora disso, às 9h com o que houver;
 *   · depois, no máximo UMA por dia, com a lista completa e curta, e só se
 *     houver propostas que o cliente ainda não ouviu (`novas`); as do mesmo
 *     dia esperam pela do dia seguinte, às 9h;
 *   · depois de aceitar (um parceiro contratado), nada mais;
 *   · o texto é `mensagemCurtaDasPropostas` — sem os pormenores, que vão na
 *     confirmação depois de aceitar.
 *
 * PURO: as regras, o relógio e os textos. A base está em
 * `envio-das-propostas-ao-cliente-na-base.ts`.
 */

export const NOME_DO_INTERRUPTOR_DAS_PROPOSTAS = "Enviar as propostas ao cliente";

/**
 * A 1.ª MENSAGEM (d114): 1 h depois da 1.ª proposta, ou quando chega a 2.ª (ou
 * um parceiro aceita o valor do cliente). Antes (d6, 23-11) era logo à 1.ª; e
 * antes disso, 3 propostas ou 3 h.
 */
export { MINUTOS_ATE_A_PRIMEIRA_MENSAGEM } from "./propostas-curtas";
/** Acima disto (com IVA) na melhor proposta, fica com uma pessoa. */
export const LIMITE_DA_MELHOR_COM_IVA = 500;
/** Um parceiro mudou a proposta há menos disto: espera-se. */
export const MINUTOS_DEPOIS_DE_MUDAR = 10;

export type MotivoComUmaPessoa =
  | "trabalho_clyon"
  | "valor_unico"
  | "a_hora"
  | "com_uma_pessoa"
  | "queixa"
  | "noutra_lingua"
  | "acima_de_500"
  | "sem_telemovel"
  | "bloqueado";

export const MOTIVOS_COM_UMA_PESSOA: Record<MotivoComUmaPessoa, string> = {
  trabalho_clyon: "é um Trabalho CLYON (valor fixo)",
  valor_unico: "tem o valor único da equipa",
  a_hora: "mudança à hora (a folha do dia)",
  com_uma_pessoa: "a conversa está com uma pessoa da equipa",
  queixa: "o cliente fez uma queixa",
  noutra_lingua: "cliente noutra língua, sem tradução fixa",
  acima_de_500: `a melhor proposta passa dos ${LIMITE_DA_MELHOR_COM_IVA} € com IVA`,
  sem_telemovel: "sem telemóvel para o WhatsApp",
  bloqueado: "o número está bloqueado",
};

/** O pedido, como o envio automático o vê. */
export type PedidoParaOEnvio = {
  pedidoId: number;
  /** De quantos parceiros são as propostas por enviar. */
  parceiros: number;
  /** A 1.ª proposta por enviar, a 2.ª (se houver), e a última mudança de um parceiro. */
  primeiraEm: Date;
  segundaEm?: Date | null;
  /** Um parceiro aceitou o valor que o cliente propôs (a mais antiga por dizer): a 1.ª mensagem não espera a hora. */
  aceitouEm?: Date | null;
  ultimaMudancaEm: Date;
  /** A equipa mandou o orçamento à mão depois da última mensagem da Vitória: o resto é dela. */
  jaEnviado: boolean;
  /** A última mensagem das propostas que a Vitória mandou sozinha (d114), ou null. */
  ultimoEnvioEm?: Date | null;
  /** Quantas propostas o cliente ainda não ouviu (pela rotina, pela passagem ou pela conversa). Sem isto, as por enviar. */
  novas?: number;
  /** Já há um parceiro contratado: depois de aceitar, nada mais sobre propostas. */
  fechado?: boolean;
  trabalhoClyon?: boolean;
  valorUnico?: boolean;
  /** Pelo trabalho todo, por carga ou por hora. */
  base?: string | null;
  comUmaPessoa?: boolean;
  queixa?: boolean;
  linguaSemTraducao?: string | null;
  /** O valor com IVA da melhor proposta (`melhorProposta`, d62), ou null. */
  melhorComIva: number | null;
  temTelemovel: boolean;
  bloqueado?: boolean;
};

/** PORQUE FICA COM UMA PESSOA — ou null. Pura. */
export function porqueFicaComUmaPessoa(p: PedidoParaOEnvio): MotivoComUmaPessoa | null {
  if (p.trabalhoClyon) return "trabalho_clyon";
  if (p.valorUnico) return "valor_unico";
  if (String(p.base ?? "").trim() === "hora") return "a_hora";
  if (p.queixa) return "queixa";
  if (!p.temTelemovel) return "sem_telemovel";
  if (p.bloqueado) return "bloqueado";
  if (p.comUmaPessoa) return "com_uma_pessoa";
  if (p.linguaSemTraducao) return "noutra_lingua";
  if (p.melhorComIva != null && p.melhorComIva > LIMITE_DA_MELHOR_COM_IVA + 0.005) return "acima_de_500";
  return null;
}

/**
 * A PARTIR DE QUANDO PODE SAIR — pura (d114). A 1.ª mensagem: 1 h depois da
 * 1.ª proposta, ou quando chega a 2.ª, ou quando um parceiro aceitou o valor do
 * cliente — o que vier primeiro. Depois dela, a seguinte só no dia seguinte
 * (às 9h): uma por dia. Nunca antes de 10 min depois da última mudança de um
 * parceiro. A janela (9h–20h) e a uma-por-dia de todas as rotinas vêm depois,
 * em `estadoDoEnvio`.
 */
export function devidoDasPropostas(
  p: Pick<PedidoParaOEnvio, "primeiraEm" | "segundaEm" | "aceitouEm" | "ultimaMudancaEm" | "ultimoEnvioEm">,
): Date {
  const depoisDaMudanca = p.ultimaMudancaEm.getTime() + MINUTOS_DEPOIS_DE_MUDAR * 60_000;
  let devido: number;
  if (p.ultimoEnvioEm) {
    devido = aHoraDoDia(somarDiasAoDia(diaEmLisboa(p.ultimoEnvioEm), 1), HORA_DO_QUE_FICOU_PARA_DEPOIS).getTime();
  } else {
    devido = Math.min(
      p.primeiraEm.getTime() + MINUTOS_ATE_A_PRIMEIRA_MENSAGEM * 60_000,
      p.segundaEm ? p.segundaEm.getTime() : Number.POSITIVE_INFINITY,
      p.aceitouEm ? p.aceitouEm.getTime() : Number.POSITIVE_INFINITY,
    );
  }
  return new Date(Math.max(devido, depoisDaMudanca));
}

export type EstadoDoEnvio =
  | { tipo: "ja_enviado" }
  | { tipo: "fica"; motivo: MotivoComUmaPessoa }
  | { tipo: "sai"; quando: Date; agora: boolean; porqueEspera: "mudou" | "uma_por_dia" | "janela" | "prazo" | "amanha" | null };

/**
 * O QUE ACONTECE A ESTE PEDIDO — pura. Já enviado; fica com uma pessoa (e
 * porquê); ou sai, e quando: já, ou à hora a que pode (o prazo, os 10 min da
 * mudança, a janela das 9h–20h, ou amanhã às 9h por já ter saído hoje outra
 * mensagem automática).
 */
export function estadoDoEnvio(p: PedidoParaOEnvio, agora: Date, opcoes: { jaSaiuHoje?: boolean } = {}): EstadoDoEnvio {
  // d114: depois de aceitar, à mão pela equipa, ou sem nada que o cliente não tenha ouvido — nada sai.
  if (p.jaEnviado || p.fechado || (p.novas ?? 1) <= 0) return { tipo: "ja_enviado" };
  const motivo = porqueFicaComUmaPessoa(p);
  if (motivo) return { tipo: "fica", motivo };
  const devido = devidoDasPropostas(p);
  let quando = momentoDeSaida(devido, agora);
  let porqueEspera: "mudou" | "uma_por_dia" | "janela" | "prazo" | "amanha" | null = null;
  if (quando.getTime() > agora.getTime()) {
    const daMudanca = p.ultimaMudancaEm.getTime() + MINUTOS_DEPOIS_DE_MUDAR * 60_000;
    porqueEspera =
      devido.getTime() > agora.getTime()
        ? devido.getTime() === daMudanca
          ? "mudou"
          : p.ultimoEnvioEm
            ? "amanha"
            : "prazo"
        : "janela";
  }
  if (opcoes.jaSaiuHoje && diaEmLisboa(quando) === diaEmLisboa(agora)) {
    quando = aHoraDoDia(somarDiasAoDia(diaEmLisboa(agora), 1), HORA_DO_QUE_FICOU_PARA_DEPOIS);
    porqueEspera = "uma_por_dia";
  }
  return { tipo: "sai", quando, agora: quando.getTime() <= agora.getTime(), porqueEspera };
}

/**
 * A LINHA DO CARTÃO DA MESA — «a Vitória envia ao cliente a 23/11 às 15h20»,
 * «fica com uma pessoa: a melhor proposta passa dos 500 € com IVA»; com o
 * interruptor desligado, «envio automático desligado: enviaria a …». Pura.
 */
export function linhaDoEnvioNaMesa(e: EstadoDoEnvio, ligado: boolean): string | null {
  if (e.tipo === "ja_enviado") return null;
  if (e.tipo === "fica") return `fica com uma pessoa: ${MOTIVOS_COM_UMA_PESSOA[e.motivo]}`;
  const quando = e.agora ? "já" : `a ${diaEHoraCurtos(e.quando)}`;
  if (!ligado) return `envio automático desligado: enviaria ${e.agora ? "já" : quando}`;
  const porque =
    e.porqueEspera === "mudou"
      ? " (um parceiro mudou a proposta há menos de 10 min)"
      : e.porqueEspera === "uma_por_dia"
        ? " (já saiu hoje outra mensagem automática a este cliente)"
        : e.porqueEspera === "amanha"
          ? " (as propostas novas juntam-se numa mensagem por dia)"
          : e.porqueEspera === "prazo"
            ? " (1 h depois da 1.ª proposta, ou quando chegar a 2.ª)"
            : "";
  return `a Vitória envia ao cliente ${quando}${porque}`;
}

/** d119: a nota de quando as propostas saem ao cliente por um caminho automático — o «Já enviei» da Vitória. */
export const NOTA_DO_ENVIO_PELA_VITORIA = "Orçamento enviado ao cliente pela Vitória (WhatsApp)";

/** O que fica no histórico do pedido quando a Vitória envia. */
export function historicoDoEnvioAutomatico(propostas: number, actualizacao = false): string {
  const quantas = `${propostas} ${propostas === 1 ? "proposta" : "propostas"}`;
  return actualizacao
    ? `Propostas atualizadas ao cliente pela Vitória (WhatsApp) — ${quantas}, mensagem curta (d114).`
    : `${NOTA_DO_ENVIO_PELA_VITORIA} — ${quantas}, mensagem curta (d114).`;
}
