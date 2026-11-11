import { diaEmLisboa, pecasEmLisboa } from "./hora-de-lisboa";
import { HORAS_PARA_RESPONDER, JANELA_DE_RESPOSTA } from "./prazo-de-resposta-do-parceiro";
import {
  diaEMes as diaMes,
  eEscolhida,
  horaEMinutos as hm,
  instanteOuNull as instante,
  oClientePediuAClyon,
  semRespostaDosEscolhidos,
  temResposta,
  type CanalDoAviso,
  type CasoSemResposta,
  type EscolhidosDoPedido,
  type MarcaSemResposta,
  type NegociacaoDoPedido,
  type SemResposta,
} from "./escolhidos-sem-resposta-regra";
import { linhaDoHistoricoSemResposta } from "./escolhidos-sem-resposta-na-mesa";

export * from "./escolhidos-sem-resposta-regra";
export * from "./escolhidos-sem-resposta-na-mesa";
export * from "./escolhidos-sem-resposta-do-escolhido";

/**
 * OS ESCOLHIDOS SEM RESPOSTA — 11-11-2026 (d6).
 *
 * Numa mudança com a lista de parceiros o pedido vai logo aos que o cliente
 * escolheu, e cada um tem 3 horas para responder (entre as 8h e as 21h de
 * Lisboa, `prazo-de-resposta-do-parceiro.ts`). Até aqui o prazo passava e não
 * acontecia nada ao cliente. Agora tem consequência:
 *
 *   1. a Mesa mostra o pedido como «escolhidos sem resposta» (a mesma regra
 *      no cartão «Do nosso lado», no selo do pedido e no aviso à equipa);
 *   2. o cliente é avisado UMA vez por pedido, só entre as 8h e as 21h, com
 *      as três saídas: esperar, escolher outro parceiro ou pedir à CLYON que
 *      procure por ele. A CLYON só envia o pedido a mais parceiros se o
 *      cliente o pedir;
 *   3. o escolhido responde com um toque: «Confirmo: faço por X/h + IVA».
 *
 * ESTA É A LIB DOS TEXTOS, UMA SÓ: o site, o backoffice, o painel do parceiro,
 * a app Pro e a app de cliente lêem as frases daqui (as apps, pela API — não
 * as escrevem). Importa-se tudo por este ficheiro. Por dentro está arrumada
 * por quem lê, porque cada leitor tem a sua língua (ao cliente diz-se
 * «parceiro»; à equipa e ao escolhido, «profissional»):
 *
 *   · este ficheiro — o que o CLIENTE lê (o aviso, o cartão do pedido, a
 *     linha das 3 horas na lista) e a rotina horária;
 *   · `escolhidos-sem-resposta-na-mesa.ts` — o que a EQUIPA lê;
 *   · `escolhidos-sem-resposta-do-escolhido.ts` — o que o ESCOLHIDO lê;
 *   · `escolhidos-sem-resposta-regra.ts` — a regra, sem frases.
 *
 * «VERIFICADOS» NÃO SE DIZ AQUI: os textos fechados diziam «outros parceiros
 * verificados da sua zona», mas a palavra só se usa junto de um parceiro com
 * as três confirmações (regra q do teste da orquestra, dono 01-11-2026) — e
 * quem recebe o pedido a mais são os parceiros elegíveis da zona.
 *
 * É PURA (sem base, sem rede): a rotina recebe as leituras e os envios por
 * fora, para os testes correrem sem base; o que toca na base e nos canais
 * está em `escolhidos-sem-resposta-no-servidor.ts`.
 *
 * Todas as horas saem de `hora-de-lisboa.ts`, seja qual for o fuso de quem
 * corre isto; os valores, de `formatarEuros`.
 */

/* ══ C. O AVISO AO CLIENTE ═══════════════════════════════════════════════ */

/** C1. As três saídas, por esta ordem (iguais no site, no email e na app de cliente). */
export const SAIDAS_DO_CLIENTE = Object.freeze({
  esperar: "Esperar mais um pouco",
  escolherOutro: "Escolher outro parceiro",
  pedirAClyon: "Pedir à CLYON que procure",
});

/** As acções do cliente, como chegam à rota (`agirComoCliente`). */
export const ACCOES_DOS_ESCOLHIDOS = Object.freeze({
  ver: "ver_escolhidos",
  esperar: "esperar_pelos_escolhidos",
  listaParaEscolherOutro: "lista_para_escolher_outro",
  escolherOutro: "escolher_outros_parceiros",
  pedirAClyon: "pedir_a_clyon_que_procure",
});

export const JA_ESTA_A_PROCURAR = "A CLYON já está a procurar mais parceiros, como pediu.";

export type AvisoSemRespostaAoCliente = {
  whatsapp: string;
  email: { assunto: string; abertura: string; pergunta: string | null; blocos: Array<{ titulo: string; texto: string }>; nota: string | null; fecho: string };
  app: { titulo: string; texto: string };
};

const primeiroNome = (nome: string | null | undefined) => (nome ?? "").trim().split(/\s+/)[0] || "";

/**
 * O AVISO AO CLIENTE. Diz-se sempre «parceiro»; não leva valores (não há
 * número novo a dar). O WhatsApp leva a ligação do pedido, onde estão os
 * três botões; o email leva-os lá dentro.
 */
export function avisoSemRespostaAoCliente(d: {
  pedidoId: number;
  caso: CasoSemResposta;
  /** Os nomes dos parceiros que o cliente escolheu (um por escolhido). */
  nomes: readonly string[];
  /** Quantos escolheu, quando os nomes não se conhecem todos. */
  escolhidos?: number;
  /** O cliente marcou «Pedir também à CLYON que procure mais parceiros» na lista. */
  jaPediuAClyon: boolean;
  nomeDoCliente?: string | null;
  /** A ligação do pedido (a página com os três botões). */
  ligacao: string;
}): AvisoSemRespostaAoCliente {
  const quantos = d.escolhidos ?? d.nomes.length;
  const um = quantos === 1;
  const nome = (d.nomes[0] ?? "").trim();
  const oParceiro = nome ? `O parceiro ${nome}` : "O parceiro que escolheu";
  const n = d.pedidoId;
  const h = HORAS_PARA_RESPONDER;
  const disseramQueNao = d.caso === "disseram_que_nao";

  const primeiraDoWhatsApp = disseramQueNao
    ? um
      ? `${oParceiro} não pode fazer a sua mudança #${n}.`
      : `Os parceiros que escolheu não podem fazer a sua mudança #${n}.`
    : um
      ? `${oParceiro} ainda não respondeu ao seu pedido de mudança #${n}.`
      : `Os parceiros que escolheu para a sua mudança #${n} ainda não responderam.`;
  const segundaDoWhatsApp = d.jaPediuAClyon
    ? disseramQueNao
      ? `${JA_ESTA_A_PROCURAR} Entretanto pode escolher outro parceiro da lista:\n${d.ligacao}`
      : `${JA_ESTA_A_PROCURAR} Entretanto pode esperar ou escolher outro parceiro da lista:\n${d.ligacao}`
    : disseramQueNao
      ? `Pode escolher outro parceiro da lista ou pedir à CLYON que procure por si. Diga-nos o que prefere aqui:\n${d.ligacao}`
      : `Pode esperar mais um pouco, escolher outro parceiro da lista ou pedir à CLYON que procure por si. Diga-nos o que prefere aqui:\n${d.ligacao}`;

  const blocos: Array<{ titulo: string; texto: string }> = (
    [
    d.jaPediuAClyon
      ? null
      : {
          titulo: SAIDAS_DO_CLIENTE.pedirAClyon,
          texto:
            "A CLYON envia o seu pedido a outros parceiros da sua zona. Cada um responde com o seu preço por hora, e é sempre o cliente que escolhe.",
        },
    { titulo: SAIDAS_DO_CLIENTE.escolherOutro, texto: "Volta à lista, com os preços de cada um, e escolhe outro." },
    disseramQueNao ? null : { titulo: SAIDAS_DO_CLIENTE.esperar, texto: "Fica tudo como está. Os parceiros que escolheu ainda podem responder." },
    ] as Array<{ titulo: string; texto: string } | null>
  ).filter((b): b is { titulo: string; texto: string } => b != null);

  const proprio = primeiroNome(d.nomeDoCliente);
  return {
    whatsapp: `${primeiraDoWhatsApp}\n\n${segundaDoWhatsApp}`,
    email: {
      assunto: disseramQueNao
        ? `A sua mudança #${n}: escolha outro parceiro`
        : um
          ? `A sua mudança #${n}: o parceiro ainda não respondeu`
          : `A sua mudança #${n}: os parceiros ainda não responderam`,
      abertura:
        `Olá${proprio ? `, ${proprio}` : ""},\n\n` +
        (disseramQueNao
          ? "Os parceiros que escolheu não podem fazer a sua mudança."
          : um
            ? `${oParceiro} ainda não respondeu ao seu pedido de mudança. Tinha ${h} horas para o fazer.`
            : `Os parceiros que escolheu para a sua mudança ainda não responderam. Tinham ${h} horas para o fazer.`),
      pergunta: "O que prefere?",
      blocos,
      nota: d.jaPediuAClyon ? JA_ESTA_A_PROCURAR : null,
      fecho: "O seu pedido não se perde: fica guardado até decidir.",
    },
    app: {
      titulo: disseramQueNao ? "Escolha outro parceiro" : um ? "O parceiro ainda não respondeu" : "Os parceiros ainda não responderam",
      texto: disseramQueNao
        ? `Mudança #${n}: os parceiros que escolheu não podem. Escolha outro ou peça à CLYON que procure por si.`
        : `Mudança #${n}: pode esperar, escolher outro ou pedir à CLYON que procure por si.`,
    },
  };
}

/* ── C4. O cartão no ecrã do pedido (site e app de cliente) ─────────────── */

export type BotaoDoCartao = { accao: string; texto: string; principal: boolean };

export type CartaoDoCliente = {
  caso: CasoSemResposta;
  titulo: string | null;
  linha: string | null;
  /** A frase de depois de o cliente escolher uma saída (em vez do título e da linha). */
  depois: string | null;
  /** «A CLYON já está a procurar mais parceiros, como pediu.» */
  nota: string | null;
  botoes: BotaoDoCartao[];
  /** As ligações por baixo da frase de depois de «Esperar». */
  ligacoes: BotaoDoCartao[];
};

export const DEPOIS_DE_CADA_SAIDA = Object.freeze({
  esperar: "Combinado: esperamos pelos parceiros que escolheu. Avisamos assim que um responder.",
  pedirAClyon:
    "Pedido feito. A CLYON envia o seu pedido a outros parceiros da sua zona; as propostas chegam-lhe por aqui. Os que já escolheu continuam a poder responder.",
});

const botao = (saida: keyof typeof SAIDAS_DO_CLIENTE, principal = false): BotaoDoCartao => ({
  accao: saida === "esperar" ? ACCOES_DOS_ESCOLHIDOS.esperar : saida === "escolherOutro" ? ACCOES_DOS_ESCOLHIDOS.listaParaEscolherOutro : ACCOES_DOS_ESCOLHIDOS.pedirAClyon,
  texto: SAIDAS_DO_CLIENTE[saida],
  principal,
});

/**
 * O CARTÃO DO CLIENTE — fica à vista enquanto não houver resposta de um
 * escolhido nem um prazo novo a correr. Null quando não é preciso.
 */
export function cartaoDoCliente(
  negociacoes: readonly NegociacaoDoPedido[],
  e: EscolhidosDoPedido | null | undefined,
  agora: Date,
  pedidoFechado = false,
): CartaoDoCliente | null {
  if (pedidoFechado) return null;
  const s = semRespostaDosEscolhidos(negociacoes, agora);
  if (!s) return null;
  const pediu = oClientePediuAClyon(e);
  const disseramQueNao = s.caso === "disseram_que_nao";
  const d = e?.decisao ?? null;
  const vazio = { caso: s.caso, titulo: null, linha: null, depois: null, nota: null, botoes: [], ligacoes: [] } satisfies CartaoDoCliente;

  if (d?.saida === "pedir_a_clyon") return { ...vazio, depois: DEPOIS_DE_CADA_SAIDA.pedirAClyon };
  if (d?.saida === "esperar" && !disseramQueNao) {
    return { ...vazio, depois: DEPOIS_DE_CADA_SAIDA.esperar, ligacoes: [botao("escolherOutro"), ...(pediu ? [] : [botao("pedirAClyon")])] };
  }

  const um = s.escolhidos === 1;
  const nome = s.nomes[0];
  const titulo = disseramQueNao
    ? "Os parceiros que escolheu não podem fazer esta mudança"
    : um
      ? nome
        ? `O parceiro ${nome} ainda não respondeu`
        : "O parceiro que escolheu ainda não respondeu"
      : "Os parceiros que escolheu ainda não responderam";
  const linha = disseramQueNao
    ? "O que prefere?"
    : diaEmLisboa(s.prazo) === diaEmLisboa(agora)
      ? `O prazo de ${HORAS_PARA_RESPONDER} horas terminou às ${hm(s.prazo)}. O que prefere?`
      : `O prazo de ${HORAS_PARA_RESPONDER} horas terminou a ${diaMes(s.prazo)} às ${hm(s.prazo)}. O que prefere?`;
  return {
    ...vazio,
    titulo,
    linha,
    nota: pediu ? JA_ESTA_A_PROCURAR : null,
    botoes: [...(disseramQueNao ? [] : [botao("esperar")]), botao("escolherOutro", pediu), ...(pediu ? [] : [botao("pedirAClyon", true)])],
  };
}

/** «Escolher outro parceiro»: a lista do pedido, sem os já escolhidos. */
export const TEXTOS_DE_ESCOLHER_OUTRO = Object.freeze({
  titulo: "Escolher outro parceiro",
  linha: (maximo: number) => `Os que já escolheu continuam a poder responder. Escolha até ${maximo} parceiros.`,
  botao: "Pedir orçamento",
  semMaisNinguem: "Não há mais parceiros com preço para a sua zona. Peça à CLYON que procure por si.",
});

/** «Pedido enviado a {nomes}. Têm até às {HH:MM} para responder.» (noutro dia: «até {DD/MM} às {HH:MM}»). */
export function pedidoEnviadoAOutros(nomes: readonly string[], prazo: Date, agora: Date = new Date()): string {
  const quando = diaEmLisboa(prazo) === diaEmLisboa(agora) ? `até às ${hm(prazo)}` : `até ${diaMes(prazo)} às ${hm(prazo)}`;
  return `Pedido enviado a ${nomes.join(", ")}. Têm ${quando} para responder.`;
}

export const ERROS_DO_CLIENTE = Object.freeze({
  jaRespondeu: "Já não é preciso: um parceiro já respondeu ao seu pedido. Veja o pedido.",
  jaFechado: "Já não é preciso: este pedido já está fechado. Veja o pedido.",
  verOPedido: "Ver o pedido",
  rede: "Não foi possível guardar a sua escolha. Tente outra vez.",
});

/* ══ E. A LINHA DAS 3 HORAS (site e app de cliente) ══════════════════════ */

/** E1. Na lista, por baixo de «Escolha até 3 parceiros…» (`TEXTOS_DA_LISTA.prazo`). */
export const LINHA_DAS_3_HORAS =
  `Os parceiros que escolher têm ${HORAS_PARA_RESPONDER} horas para responder, entre as ${JANELA_DE_RESPOSTA.abre}h e as ${JANELA_DE_RESPOSTA.fecha}h. ` +
  "Se nenhum responder, avisamos: pode esperar, escolher outro ou pedir à CLYON que procure por si.";

/** F. A ajuda por baixo de «Pedir também à CLYON que procure mais parceiros» (`TEXTOS_DA_LISTA.procurarMaisAjuda`). */
export const AJUDA_DO_PROCURAR_MAIS = "Além dos que escolher, o pedido vai a outros parceiros da sua zona, que respondem com o preço de cada um.";

/** E2. «Os parceiros que escolheu têm até às 14:30 para responder.» (noutro dia: «até 12/11 às 10:00»). */
export function prazoParaOCliente(prazo: Date, escolhidos: number, agora: Date = new Date()): string {
  const quando = diaEmLisboa(prazo) === diaEmLisboa(agora) ? `até às ${hm(prazo)}` : `até ${diaMes(prazo)} às ${hm(prazo)}`;
  return escolhidos === 1 ? `O parceiro que escolheu tem ${quando} para responder.` : `Os parceiros que escolheu têm ${quando} para responder.`;
}

/**
 * E2, pela regra: a linha do prazo enquanto nenhum escolhido respondeu e o
 * prazo não passou. Null fora disso (quando o prazo passa, dá lugar ao cartão).
 */
export function linhaDoPrazoParaOCliente(negociacoes: readonly NegociacaoDoPedido[], agora: Date): string | null {
  const escolhidas = negociacoes.filter(eEscolhida);
  if (escolhidas.length === 0 || negociacoes.some(temResposta)) return null;
  const abertas = escolhidas.filter((n) => n.estado === "aberta");
  const prazos = abertas.map((n) => instante(n.prazoRespostaEm)?.getTime()).filter((t): t is number => t != null);
  if (prazos.length === 0) return null;
  const prazo = Math.max(...prazos);
  return prazo > agora.getTime() ? prazoParaOCliente(new Date(prazo), abertas.length, agora) : null;
}

/* ══ A ROTINA HORÁRIA ════════════════════════════════════════════════════ */

/** Está na janela em que se avisa o cliente? 8h–21h em Lisboa, seja qual for o fuso do servidor. */
export function naJanelaDeResposta(agora: Date): boolean {
  const h = pecasEmLisboa(agora).hora;
  return h >= JANELA_DE_RESPOSTA.abre && h < JANELA_DE_RESPOSTA.fecha;
}

/** Um pedido de mudança com parceiros escolhidos, como a rotina o lê. */
export type PedidoComEscolhidos = {
  id: number;
  status: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  /** O cliente marcou «Pedir também à CLYON…» ao enviar o pedido. */
  procurarMais: boolean;
  /** O aviso já saiu (ou está a sair) para este pedido. */
  jaAvisado: boolean;
  negociacoes: NegociacaoDoPedido[];
};

const FECHADOS: ReadonlySet<string> = new Set(["cancelado", "concluido", "arquivado", "rejeitado"]);

/** Os pedidos a avisar AGORA: sem resposta (ou todos disseram que não), abertos, ainda não avisados. */
export function pedidosPorAvisar(
  pedidos: readonly PedidoComEscolhidos[],
  agora: Date,
): Array<{ pedido: PedidoComEscolhidos; semResposta: SemResposta }> {
  const out: Array<{ pedido: PedidoComEscolhidos; semResposta: SemResposta }> = [];
  for (const pedido of pedidos) {
    if (pedido.jaAvisado || FECHADOS.has(pedido.status ?? "")) continue;
    const semResposta = semRespostaDosEscolhidos(pedido.negociacoes, agora);
    if (semResposta) out.push({ pedido, semResposta });
  }
  return out;
}

export type DependenciasDaRotina = {
  /** Os pedidos de mudança com escolhidos, por fechar e ainda sem aviso. */
  ler: () => Promise<PedidoComEscolhidos[]>;
  /**
   * Grava a marca no pedido e devolve `true` SÓ a quem a gravou primeiro. É o
   * que garante uma só vez: reserva-se antes de falar, e quem perder a corrida
   * (ou a passagem seguinte) não fala.
   */
  reservar: (pedidoId: number, marca: MarcaSemResposta) => Promise<boolean>;
  /** A ligação do pedido, para o WhatsApp (a página com os três botões). */
  ligacao: (pedido: PedidoComEscolhidos) => Promise<string>;
  whatsapp: (pedido: PedidoComEscolhidos, texto: string) => Promise<boolean>;
  email: (pedido: PedidoComEscolhidos, aviso: AvisoSemRespostaAoCliente["email"], ligacao: string) => Promise<boolean>;
  app: (pedido: PedidoComEscolhidos, aviso: AvisoSemRespostaAoCliente["app"]) => Promise<boolean>;
  /** Fecha a marca com os canais por onde saiu, e escreve a linha do histórico. */
  registar: (pedidoId: number, marca: MarcaSemResposta, linha: string) => Promise<void>;
};

export type ResultadoDaRotina = {
  naJanela: boolean;
  /** Pedidos sem resposta e por avisar, nesta passagem. */
  porAvisar: number;
  avisados: number[];
  /** Reservados, mas o aviso não saiu por nenhum canal: a Mesa diz «fale com ele». */
  semCanal: number[];
  falhas: string[];
};

const tentar = (envio: () => Promise<boolean>) => envio().catch(() => false);

/**
 * UMA PASSAGEM. Fora da janela (21h–8h de Lisboa) não lê nem envia: o que
 * passou de noite é avisado na primeira passagem depois das 8h. Nunca lança.
 * NÃO envia o pedido a mais parceiros: isso só a pedido do cliente.
 */
export async function correrOsEscolhidosSemResposta(deps: DependenciasDaRotina, agora: Date = new Date()): Promise<ResultadoDaRotina> {
  const r: ResultadoDaRotina = { naJanela: naJanelaDeResposta(agora), porAvisar: 0, avisados: [], semCanal: [], falhas: [] };
  if (!r.naJanela) return r;

  let lista: Array<{ pedido: PedidoComEscolhidos; semResposta: SemResposta }>;
  try {
    lista = pedidosPorAvisar(await deps.ler(), agora);
  } catch (e) {
    r.falhas.push(`leitura: ${e instanceof Error ? e.message : String(e)}`);
    return r;
  }
  r.porAvisar = lista.length;

  for (const { pedido, semResposta } of lista) {
    try {
      const marca: MarcaSemResposta = {
        avisadoEm: agora.toISOString(),
        prazoEm: semResposta.prazo.toISOString(),
        escolhidos: semResposta.escolhidos,
        caso: semResposta.caso,
        canais: [],
        saiu: null,
      };
      // Se a reserva falhar ou outro a tiver feito, cala-se: repetir um aviso é pior do que esperar uma hora.
      if (!(await deps.reservar(pedido.id, marca))) continue;

      const ligacao = await deps.ligacao(pedido).catch(() => "");
      const aviso = avisoSemRespostaAoCliente({
        pedidoId: pedido.id,
        caso: semResposta.caso,
        nomes: semResposta.nomes,
        escolhidos: semResposta.escolhidos,
        jaPediuAClyon: pedido.procurarMais,
        nomeDoCliente: pedido.contactName,
        ligacao,
      });
      const canais: CanalDoAviso[] = [];
      if (ligacao && (await tentar(() => deps.whatsapp(pedido, aviso.whatsapp)))) canais.push("whatsapp");
      if (ligacao && (await tentar(() => deps.email(pedido, aviso.email, ligacao)))) canais.push("email");
      if (await tentar(() => deps.app(pedido, aviso.app))) canais.push("app");

      const fechada: MarcaSemResposta = { ...marca, canais, saiu: canais.length > 0 };
      await deps
        .registar(pedido.id, fechada, linhaDoHistoricoSemResposta(semResposta, semResposta.nomes, canais))
        .catch((e) => r.falhas.push(`registo #${pedido.id}: ${e instanceof Error ? e.message : String(e)}`));
      (canais.length > 0 ? r.avisados : r.semCanal).push(pedido.id);
    } catch (e) {
      r.falhas.push(`#${pedido.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return r;
}

export function resumoDaRotinaSemResposta(r: ResultadoDaRotina): string {
  if (!r.naJanela) return `Escolhidos sem resposta: fora das ${JANELA_DE_RESPOSTA.abre}h–${JANELA_DE_RESPOSTA.fecha}h de Lisboa, nada se envia.`;
  return (
    `Escolhidos sem resposta: ${r.avisados.length} cliente(s) avisado(s)` +
    (r.avisados.length ? ` (${r.avisados.map((id) => `#${id}`).join(", ")})` : "") +
    (r.semCanal.length ? `; ${r.semCanal.length} sem canal (${r.semCanal.map((id) => `#${id}`).join(", ")})` : "") +
    (r.falhas.length ? `; ${r.falhas.length} falha(s)` : "") +
    "."
  );
}
