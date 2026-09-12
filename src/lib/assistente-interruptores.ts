/**
 * OS SEIS INTERRUPTORES DO ASSISTENTE.
 *
 * "Cada uma dessas ferramentas deve ter a opção de o admin parar, caso esteja
 * a cometer erros por parte do assistente." — 12-09-2026.
 *
 * Hoje há dois travões: o geral ("Desligar tudo") e o de cada conversa
 * ("Entregar a si"). Falta o do meio — parar os lembretes mas continuar a
 * responder, ou deixar de marcar acordos mas continuar a avisar. Sem esse, a
 * única reacção a um erro do assistente é calá-lo por inteiro, e a seguir
 * ninguém o volta a ligar.
 *
 * PORQUE É QUE NEM TODOS COMEÇAM DESLIGADOS
 *
 * O plano dizia "cada um começa desligado". Duas destas capacidades JÁ CORREM
 * hoje: o assistente recolhe pedidos pela conversa desde 10-09-2026, e fecha
 * negócios por WhatsApp desde antes disso. Pô-las a nascer desligadas não era
 * prudência — era desligar em silêncio duas coisas que estão a funcionar, e
 * descobri-lo pelo primeiro cliente que ficasse sem resposta.
 *
 * Por isso a regra é outra, e é honesta: **o interruptor de uma capacidade que
 * já funciona nasce ligado; o de uma capacidade nova nasce desligado.** O que
 * importa é que os dois existam e que o painel os mostre.
 */

export type Capacidade =
  /** Criar pedidos novos pela conversa — whatsapp-recolha. */
  | "recolher"
  /**
   * Avisar o cliente de que tem uma proposta, no instante em que ela é feita.
   *
   * É a SÉTIMA, e o plano falava de seis. Entrou porque a revisão apanhou uma
   * mentira: o interruptor "avisar" dizia na ficha que travava as propostas e
   * não travava nenhuma — esse caminho é o imediato, sai de
   * `propostaParaOWhatsApp` assim que a proposta é gravada, e existia muito
   * antes de haver assistente nenhum. Um botão que diz que pára uma coisa e não
   * a pára é pior do que não existir: o dono carrega nele, vê as mensagens
   * continuarem a sair, e deixa de acreditar no painel.
   *
   * São duas coisas diferentes e por isso são dois botões: esta é a mensagem
   * que corre contra o relógio (uma proposta que chega dez minutos depois já
   * perdeu para quem respondeu primeiro), e "avisar" é o que se conta a seguir.
   */
  | "propostas"
  /** Contar ao cliente o que muda no pedido depois disso. */
  | "avisar"
  /** Levar o sim e o não do cliente ao motor da negociação. */
  | "fechar"
  /** Os lembretes de quem não responde. */
  | "insistir"
  /** A véspera do trabalho, a execução, a confirmação. */
  | "acompanhar"
  /** A mensagem de fecho, e o pedido de avaliação no dia seguinte. */
  | "agradecer";

export const CAPACIDADES: Capacidade[] = [
  "recolher",
  "propostas",
  "avisar",
  "fechar",
  "insistir",
  "acompanhar",
  "agradecer",
];

export type FichaDaCapacidade = {
  titulo: string;
  /** O que deixa de acontecer quando se desliga. Escrito para quem carrega. */
  oQuePara: string;
  /** Nasce ligado? Só as que já corriam antes de haver interruptor. */
  porOmissao: boolean;
};

export const FICHA_DA_CAPACIDADE: Record<Capacidade, FichaDaCapacidade> = {
  recolher: {
    titulo: "Recolher pedidos",
    oQuePara:
      "Deixa de fazer perguntas a quem escreve sem pedido. As mensagens ficam por responder até alguém as ver.",
    porOmissao: true,
  },
  propostas: {
    titulo: "Avisar de propostas",
    oQuePara:
      "Deixa de dizer ao cliente que recebeu uma proposta, ou que o profissional aceitou a dele. Fica no painel à espera de alguém a escrever à mão.",
    porOmissao: true,
  },
  avisar: {
    titulo: "Contar novidades",
    oQuePara:
      "Deixa de contar o que muda no pedido depois da proposta: o negócio fechado, e o aviso interno de um pedido que ninguém quis.",
    porOmissao: false,
  },
  fechar: {
    titulo: "Fechar negócios",
    oQuePara:
      "Deixa de marcar aceites e recusas. Quem responder a uma proposta passa para si, com a conversa entregue.",
    porOmissao: true,
  },
  insistir: {
    titulo: "Insistir",
    oQuePara: "Deixa de lembrar quem não respondeu. Nada mais muda.",
    porOmissao: false,
  },
  acompanhar: {
    titulo: "Acompanhar até ao fim",
    oQuePara:
      "Deixa de lembrar a data na véspera e de pedir a confirmação do trabalho feito.",
    porOmissao: false,
  },
  agradecer: {
    titulo: "Agradecer",
    oQuePara: "Deixa de mandar a mensagem de fecho e o pedido de avaliação.",
    porOmissao: false,
  },
};

/** O estado de tudo quando a base ainda não tem linha nenhuma. */
export function interruptoresPorOmissao(): Record<Capacidade, boolean> {
  const r = {} as Record<Capacidade, boolean>;
  for (const c of CAPACIDADES) r[c] = FICHA_DA_CAPACIDADE[c].porOmissao;
  return r;
}

export function eCapacidade(v: unknown): v is Capacidade {
  return typeof v === "string" && (CAPACIDADES as string[]).includes(v);
}

/*
 * ────────────────────────────────────────────────────────────────────────────
 * A CADÊNCIA DE QUEM INSISTE — três toques e pára.
 *
 * "Caso o cliente não responda, o botão deve reenviar mensagens para garantir
 * que o pedido fique finalizado."
 *
 * Um assistente que insiste sem limite é um assistente que chateia, e no
 * WhatsApp isso não custa um cliente: custa o NÚMERO. Um número banido cala a
 * plataforma inteira, e não se recupera pedindo com jeito.
 *
 * Por isso o limite está aqui em cima, em horas, e não espalhado por três
 * funções. Ao fim da escada a conversa passa para a mesa do admin com a
 * etiqueta de quem não responde — que é a única coisa honesta a fazer a seguir
 * a três tentativas.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Espécies de aviso que admitem lembrete, e de quantas em quantas horas. */
export const ESCADA_DOS_LEMBRETES: Record<string, number[]> = {
  /*
   * PROPOSTA NA MESA: 12 h, e depois um dia. Dois toques, não três.
   *
   * A escada tinha [24, 48, 72] e era uma ficção. Uma proposta MORRE às 48
   * horas (`PRAZO_DA_PROPOSTA_HORAS`), e a partir daí o assistente deixa de a
   * ver como novidade e fecha o aviso. O segundo toque só chegaria às 72 h —
   * quando já não havia proposta nenhuma sobre que insistir. Na prática saía
   * UM lembrete, e os outros dois eram um número escrito num ficheiro.
   *
   * Agora os dois toques cabem dentro da vida da proposta: às 12 h e às 36 h.
   * Quem não responder até lá não está a ignorar um lembrete — está a deixar a
   * proposta expirar, que é outra coisa e tem outro fim.
   */
  proposta_nova: [12, 24],
  /*
   * A ACEITAÇÃO DO PROFISSIONAL não expira: `aguarda_contratacao` fica à
   * espera do cliente o tempo que for preciso. Aqui os três toques do plano
   * cabem mesmo — e é o caso que mais interessa, porque há um profissional do
   * outro lado a contar com o trabalho.
   */
  pro_aceitou: [24, 48, 72],
  // Trabalho feito por confirmar: dois toques. Aos 7 dias liberta-se sozinho,
  // e esse caminho já existe — insistir mais do que isso não muda nada.
  trabalho_feito: [24, 48],
  // Recolha a meio, parada: 6 h e depois um dia. Depois arruma-se a conversa.
  recolha_parada: [6, 24],
};

export const TOQUES_NO_MAXIMO = 3;

/** As horas em que o assistente não fala. Um lembrete às 3 da manhã perde tudo. */
export const HORA_A_QUE_ACORDA = 9;
export const HORA_A_QUE_ADORMECE = 21;

/**
 * Pode falar agora?
 *
 * Lê a hora de Lisboa e não a do servidor: a Vercel corre em UTC, e em Agosto
 * isso são duas horas de diferença — um lembrete das 22 h de Lisboa passaria
 * pelo guarda por o servidor achar que eram 21.
 */
export function horaDeFalar(agora: Date): boolean {
  const escrita = agora.toLocaleString("pt-PT", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    hour12: false,
  });
  const h = Number(escrita.replace(/\D/g, ""));
  if (!Number.isFinite(h)) return false;
  return h >= HORA_A_QUE_ACORDA && h < HORA_A_QUE_ADORMECE;
}

/**
 * Está na hora do toque seguinte?
 *
 * `toques` é quantos já saíram (o próprio aviso conta como o primeiro contacto
 * mas NÃO como toque). `desde` é o instante do último — o aviso, ou o último
 * lembrete.
 */
export function horasAteAoToqueSeguinte(especie: string, toques: number): number | null {
  const escada = ESCADA_DOS_LEMBRETES[especie];
  if (!escada) return null;
  if (toques >= escada.length || toques >= TOQUES_NO_MAXIMO) return null;
  return escada[toques];
}

export function deveTocar(
  especie: string,
  toques: number,
  desde: Date,
  agora: Date,
): boolean {
  const horas = horasAteAoToqueSeguinte(especie, toques);
  if (horas == null) return false;
  if (!horaDeFalar(agora)) return false;
  return (agora.getTime() - desde.getTime()) / 3600_000 >= horas;
}

/** Já se insistiu tudo o que havia a insistir — passa para a mesa do admin. */
export function esgotou(especie: string, toques: number): boolean {
  return horasAteAoToqueSeguinte(especie, toques) == null;
}
