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
 *     Vitória envia ao cliente o orçamento pelo caminho do «Enviar pela CLYON»
 *     (`enviarTextoManualWhatsApp`, `marcarOrcamentoEnviado`). A partir daí
 *     correm a validade (d62) e o seguimento (d83);
 *   · das 9h às 20h de Lisboa; o que cai fora sai às 9h;
 *   · um parceiro que mudou a proposta há menos de 10 min: espera-se.
 *
 * Ficam com uma pessoa (e o cartão da Mesa diz porquê): a melhor proposta acima
 * de 500 € com IVA; os Trabalhos CLYON e o valor único; as mudanças à hora (a
 * folha); a conversa com uma pessoa (d73); o cliente noutra língua sem
 * tradução; um pedido com queixa; sem telemóvel ou com o número bloqueado; o
 * «não contactar» (d93).
 *
 * O interruptor «Enviar as propostas ao cliente» (Configs, só o administrador)
 * nasce LIGADO (o dono pediu); desligado, a Mesa diz «enviaria a …».
 *
 * d114 (25-11-2026) — POUCAS MENSAGENS, CURTAS. Esta é a única rotina que diz
 * as propostas ao cliente sozinha (a proposta nova e o «o parceiro aceitou»
 * deixaram de sair uma a uma — `propostas-curtas.ts`); a 1.ª mensagem sai 1 h
 * depois da 1.ª proposta, ou logo que chega a 2.ª (ou que um parceiro aceita o
 * valor que o cliente propôs), o que vier primeiro; depois de aceitar (um
 * parceiro contratado), nada mais; os pormenores vão na confirmação depois de
 * aceitar.
 *
 * d123 (25-11-2026, CEO e dono) — AS PROPOSTAS NOVAS NÃO ESPERAM PELO DIA
 * SEGUINTE. Substitui a «uma por dia» da d114:
 *
 *   · uma proposta NOVA depois da 1.ª mensagem sai sozinha, numa mensagem
 *     curta só com ela (nunca a lista toda outra vez), pelo menos 2 h depois
 *     da última mensagem de propostas a este cliente (as que chegarem
 *     entretanto vão juntas numa só), no máximo 3 por dia; os 10 min depois de
 *     um parceiro mudar o valor continuam;
 *   · as outras rotinas (o «pedir o que falta», a validade, o seguimento) já
 *     não atrasam as propostas para o dia seguinte; o «não contactar» (d93)
 *     continua a calar tudo;
 *   · o orçamento mandado à mão pela equipa conta como a última mensagem (as
 *     2 h contam dele), e o que chegar depois sai sozinho como proposta nova;
 *   · a conversa entregue a uma pessoa pela Vitória há mais de 2 h, sem
 *     ninguém da equipa a responder, já não prende as propostas: saem, e a
 *     conversa continua com a equipa (`aEntregaPrendeAsPropostas`);
 *   · os textos variam (`mensagemDasPropostasVariada`, 5 maneiras por tipo).
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
/** d123: entre duas mensagens de propostas ao mesmo cliente, pelo menos isto. */
export const MINUTOS_ENTRE_MENSAGENS_DAS_PROPOSTAS = 120;
/** d123: no máximo isto de mensagens de propostas por dia (de Lisboa) a um pedido. */
export const MAXIMO_DE_MENSAGENS_DAS_PROPOSTAS_POR_DIA = 3;
/** d123: uma conversa entregue pela Vitória há mais disto, sem resposta da equipa, já não prende as propostas. */
export const HORAS_DA_ENTREGA_SEM_RESPOSTA = 2;

export type MotivoComUmaPessoa =
  | "trabalho_clyon"
  | "valor_unico"
  | "a_hora"
  | "com_uma_pessoa"
  | "queixa"
  | "noutra_lingua"
  | "acima_de_500"
  | "sem_telemovel"
  | "bloqueado"
  | "nao_contactar"
  | "ditas_por_ler";

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
  nao_contactar: "o cliente pediu para não ser contactado",
  ditas_por_ler: "não li o que o cliente já ouviu (a base falhou) — tenta outra vez na volta seguinte",
};

/**
 * A PROPOSTA JÁ FOI DITA AO CLIENTE? — pura (d123, o #672). A chave de uma
 * proposta é a negociação e o n.º da proposta nela (`chaveDaProposta`); um
 * pedido recomeçado do zero REPÕE as mesmas negociações, e a 1.ª proposta
 * depois do recomeço tem a mesma chave da 1.ª de antes — que já tinha sido
 * dita. Só conta como dita o registo de DEPOIS da proposta (1 s de folga: a
 * base guarda ao segundo). Sem registo, não; sem hora de um lado ou do outro,
 * sim (o lado que não repete).
 */
export function aPropostaJaFoiDita(ditaEm: number | null | undefined, propostaEm: number | null | undefined): boolean {
  if (ditaEm === undefined) return false;
  if (ditaEm == null || propostaEm == null) return true;
  return ditaEm >= propostaEm - 1000;
}

/**
 * A ENTREGA AINDA PRENDE AS PROPOSTAS? — pura (d123). Prende a que uma pessoa
 * fez (o «Assumir», a resposta à mão), a recente (menos de 2 h), e aquela a que
 * a equipa já respondeu depois (é com ela). Solta a que a Vitória fez há mais
 * de 2 h e ficou sem resposta: as propostas são uma notícia do pedido, e o
 * cliente não fica sem ela. Sem entrega, não prende.
 */
export function aEntregaPrendeAsPropostas(
  e: { quem?: string | null; entregueHaSegundos?: number | null; respostaHaSegundos?: number | null } | null | undefined,
): boolean {
  if (!e) return false;
  if (e.quem !== "vitoria") return true;
  const ha = typeof e.entregueHaSegundos === "number" && Number.isFinite(e.entregueHaSegundos) ? e.entregueHaSegundos : null;
  if (ha == null || ha < HORAS_DA_ENTREGA_SEM_RESPOSTA * 3600) return true;
  const resposta = e.respostaHaSegundos;
  return typeof resposta === "number" && Number.isFinite(resposta) && resposta <= ha;
}

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
  /**
   * Nada mais a dizer sobre estas propostas. Desde a d123 o orçamento mandado
   * à mão já não o liga: conta em `ultimoEnvioEm`.
   */
  jaEnviado: boolean;
  /** A última mensagem de propostas a este cliente — da Vitória ou da equipa à mão (d123) —, ou null. */
  ultimoEnvioEm?: Date | null;
  /** d123: quantas mensagens de propostas a Vitória mandou hoje (dia de Lisboa) a este pedido. */
  enviosHoje?: number;
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
  /** d93: o cliente pediu para não ser contactado. */
  naoContactar?: boolean;
  /** d123 (o #672): não se leu o que o cliente já ouviu — não sai, e o cartão diz porquê. */
  ditasPorLer?: boolean;
};

/** PORQUE FICA COM UMA PESSOA — ou null. Pura. */
export function porqueFicaComUmaPessoa(p: PedidoParaOEnvio): MotivoComUmaPessoa | null {
  if (p.ditasPorLer) return "ditas_por_ler";
  if (p.trabalhoClyon) return "trabalho_clyon";
  if (p.valorUnico) return "valor_unico";
  if (String(p.base ?? "").trim() === "hora") return "a_hora";
  if (p.queixa) return "queixa";
  if (!p.temTelemovel) return "sem_telemovel";
  if (p.bloqueado) return "bloqueado";
  if (p.naoContactar) return "nao_contactar";
  if (p.comUmaPessoa) return "com_uma_pessoa";
  if (p.linguaSemTraducao) return "noutra_lingua";
  if (p.melhorComIva != null && p.melhorComIva > LIMITE_DA_MELHOR_COM_IVA + 0.005) return "acima_de_500";
  return null;
}

/**
 * A PARTIR DE QUANDO PODE SAIR — pura. A 1.ª mensagem (d114): 1 h depois da
 * 1.ª proposta, ou quando chega a 2.ª, ou quando um parceiro aceitou o valor do
 * cliente — o que vier primeiro. Depois dela (d123): 2 h depois da última
 * mensagem de propostas a este cliente. Nunca antes de 10 min depois da última
 * mudança de um parceiro. A janela (9h–20h) e as 3 por dia vêm depois, em
 * `estadoDoEnvio`.
 */
export function devidoDasPropostas(
  p: Pick<PedidoParaOEnvio, "primeiraEm" | "segundaEm" | "aceitouEm" | "ultimaMudancaEm" | "ultimoEnvioEm">,
): Date {
  const depoisDaMudanca = p.ultimaMudancaEm.getTime() + MINUTOS_DEPOIS_DE_MUDAR * 60_000;
  let devido: number;
  if (p.ultimoEnvioEm) {
    devido = p.ultimoEnvioEm.getTime() + MINUTOS_ENTRE_MENSAGENS_DAS_PROPOSTAS * 60_000;
  } else {
    devido = Math.min(
      p.primeiraEm.getTime() + MINUTOS_ATE_A_PRIMEIRA_MENSAGEM * 60_000,
      p.segundaEm ? p.segundaEm.getTime() : Number.POSITIVE_INFINITY,
      p.aceitouEm ? p.aceitouEm.getTime() : Number.POSITIVE_INFINITY,
    );
  }
  return new Date(Math.max(devido, depoisDaMudanca));
}

export type PorqueEspera = "mudou" | "intervalo" | "tres_por_dia" | "janela" | "prazo" | null;

export type EstadoDoEnvio =
  /** `porque: "ditas"` — a Mesa ainda as conta por enviar, mas o cliente já as ouviu (a linha diz). */
  | { tipo: "ja_enviado"; porque?: "ditas" }
  | { tipo: "fica"; motivo: MotivoComUmaPessoa }
  | { tipo: "sai"; quando: Date; agora: boolean; porqueEspera: PorqueEspera };

/**
 * O QUE ACONTECE A ESTE PEDIDO — pura. Já dito; fica com uma pessoa (e
 * porquê); ou sai, e quando: já, ou à hora a que pode (o prazo da 1.ª, os
 * 10 min da mudança, as 2 h desde a última mensagem de propostas, a janela das
 * 9h–20h, ou amanhã às 9h por já terem saído hoje 3).
 */
export function estadoDoEnvio(p: PedidoParaOEnvio, agora: Date): EstadoDoEnvio {
  // Depois de aceitar, ou sem nada que o cliente não tenha ouvido — nada sai.
  if (p.jaEnviado || p.fechado) return { tipo: "ja_enviado" };
  if (p.ditasPorLer) return { tipo: "fica", motivo: "ditas_por_ler" };
  if ((p.novas ?? 1) <= 0) return { tipo: "ja_enviado", porque: "ditas" };
  const motivo = porqueFicaComUmaPessoa(p);
  if (motivo) return { tipo: "fica", motivo };
  const devido = devidoDasPropostas(p);
  let quando = momentoDeSaida(devido, agora);
  let porqueEspera: PorqueEspera = null;
  if (quando.getTime() > agora.getTime()) {
    const daMudanca = p.ultimaMudancaEm.getTime() + MINUTOS_DEPOIS_DE_MUDAR * 60_000;
    porqueEspera =
      devido.getTime() > agora.getTime()
        ? devido.getTime() === daMudanca
          ? "mudou"
          : p.ultimoEnvioEm
            ? "intervalo"
            : "prazo"
        : "janela";
  }
  // d123: no máximo 3 por dia — a 4.ª fica para amanhã às 9h.
  if ((p.enviosHoje ?? 0) >= MAXIMO_DE_MENSAGENS_DAS_PROPOSTAS_POR_DIA && diaEmLisboa(quando) === diaEmLisboa(agora)) {
    quando = aHoraDoDia(somarDiasAoDia(diaEmLisboa(agora), 1), HORA_DO_QUE_FICOU_PARA_DEPOIS);
    porqueEspera = "tres_por_dia";
  }
  return { tipo: "sai", quando, agora: quando.getTime() <= agora.getTime(), porqueEspera };
}

/**
 * A LINHA DO CARTÃO DA MESA — «a Vitória envia ao cliente a 23/11 às 15h20»,
 * «fica com uma pessoa: a melhor proposta passa dos 500 € com IVA»; com o
 * interruptor desligado, «envio automático desligado: enviaria a …». Pura.
 */
export function linhaDoEnvioNaMesa(e: EstadoDoEnvio, ligado: boolean): string | null {
  // d123 (o #672): a Mesa conta-as por enviar e a rotina não as diz — nunca calado.
  if (e.tipo === "ja_enviado")
    return e.porque === "ditas" ? `não sai sozinha: ${LINHA_DAS_JA_DITAS}` : null;
  if (e.tipo === "fica") return `fica com uma pessoa: ${MOTIVOS_COM_UMA_PESSOA[e.motivo]}`;
  const quando = e.agora ? "já" : `a ${diaEHoraCurtos(e.quando)}`;
  if (!ligado) return `envio automático desligado: enviaria ${e.agora ? "já" : quando}`;
  const porque =
    e.porqueEspera === "mudou"
      ? " (um parceiro mudou a proposta há menos de 10 min)"
      : e.porqueEspera === "tres_por_dia"
        ? ` (já saíram hoje ${MAXIMO_DE_MENSAGENS_DAS_PROPOSTAS_POR_DIA} mensagens de propostas a este cliente)`
        : e.porqueEspera === "intervalo"
          ? " (2 h depois da última mensagem de propostas)"
          : e.porqueEspera === "prazo"
            ? " (1 h depois da 1.ª proposta, ou quando chegar a 2.ª)"
            : "";
  return `a Vitória envia ao cliente ${quando}${porque}`;
}

/** d123: a linha de quando a Mesa conta as propostas por enviar mas o cliente já as ouviu. */
export const LINHA_DAS_JA_DITAS = "o cliente já ouviu estas propostas (na conversa ou noutro envio) — se já as tem, «Já enviei»";

/** d123: a linha de quando o envio automático não conseguiu ler o pedido. */
export const LINHA_DO_ENVIO_POR_LER = "o envio automático não leu este pedido (erro) — enviar à mão ou esperar pela volta seguinte";

/** d119: a nota de quando as propostas saem ao cliente por um caminho automático — o «Já enviei» da Vitória. */
export const NOTA_DO_ENVIO_PELA_VITORIA = "Orçamento enviado ao cliente pela Vitória (WhatsApp)";

/** O que fica no histórico do pedido quando a Vitória envia. */
export function historicoDoEnvioAutomatico(propostas: number, actualizacao = false): string {
  const quantas = `${propostas} ${propostas === 1 ? "proposta" : "propostas"}`;
  return actualizacao
    ? `Propostas atualizadas ao cliente pela Vitória (WhatsApp) — ${quantas}, mensagem curta (d114).`
    : `${NOTA_DO_ENVIO_PELA_VITORIA} — ${quantas}, mensagem curta (d114).`;
}
