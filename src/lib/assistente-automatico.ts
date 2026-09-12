import type { PedidoParaOAssistente } from "./db";
import type { Proposta } from "./negociacao";
import type { Capacidade } from "./assistente-interruptores";
import { ESCADA_DOS_LEMBRETES, deveTocar, esgotou, horaDeFalar } from "./assistente-interruptores";
import { contaDoCliente, regimeDeIva } from "./taxas-plataforma";
import { primeiroNome, rotuloServico } from "./mensagem-whatsapp";
import { saudacao } from "./whatsapp-recolha";

/**
 * O ASSISTENTE AUTOMÁTICO — o que ele vê, e o que decide dizer.
 *
 * "Sempre que tenha novidade deve informar o cliente. Deve acompanhar os
 * pedidos do início ao fim, desde a primeira mensagem até à finalização com
 * agradecimento." — 12-09-2026.
 *
 * A metade DIFÍCIL deste ficheiro é pura: `novidadesDoPedido` recebe um pedido
 * com as negociações dele e devolve as novidades que há para contar, sem tocar
 * na base e sem mandar nada. É isso que permite interrogá-la com trinta casos
 * num teste, incluindo os que nunca se conseguiriam reproduzir em produção —
 * um trabalho confirmado à meia-noite, uma proposta que expirou há uma hora.
 *
 * A metade SUJA — ler a base, mandar a mensagem, escrever que a mandou — está
 * toda em `correrOAssistente`, e não decide nada.
 *
 * UMA NOVIDADE DE CADA VEZ, POR PEDIDO. Quando o interruptor se ligar pela
 * primeira vez, os pedidos que já lá estão têm meia dúzia de transições por
 * contar cada um. Mandá-las todas seria estrear o assistente com uma rajada de
 * cinco mensagens a cada cliente — a melhor forma de o desligarem no primeiro
 * dia. Conta-se a mais adiantada, e as outras morrem por serem velhas.
 *
 * E SÓ O QUE É RECENTE. Uma proposta de há três semanas não é uma novidade; é
 * história. `DIAS_DE_NOVIDADE` é a linha entre as duas coisas.
 */

/** O que se conta. Cada espécie tem uma chave própria e uma capacidade que a autoriza. */
export type EspecieDeAviso =
  | "proposta_nova"
  | "pro_aceitou"
  | "fechado"
  | "dia_marcado"
  | "vespera"
  | "trabalho_feito"
  | "agradecimento"
  | "avaliacao"
  | "sem_propostas"
  /** Não vem das negociações: vem de uma recolha que ficou a meio. */
  | "recolha_parada";

export type Novidade = {
  especie: EspecieDeAviso;
  /** Única por transição. É ela que impede a mesma novidade de sair duas vezes. */
  chave: string;
  capacidade: Capacidade;
  pedidoId: number;
  negociacaoId: number | null;
  telefone: string;
  /** O nome próprio do cliente, para os lembretes não terem de o ir buscar ao texto. */
  nome: string;
  texto: string;
  /** Quando aconteceu o que se vai contar. Serve para saber se ainda é novidade. */
  quando: Date;
};

/**
 * Passado isto, deixa de ser novidade e passa a ser história.
 *
 * Sete dias e não um: um cron pode estar em baixo um fim-de-semana, e um
 * cliente que recebeu uma proposta na sexta continua a merecer saber dela na
 * segunda. Trinta dias já não — aí a mensagem chega como se ninguém tivesse
 * estado a olhar, que é pior do que não chegar.
 */
export const DIAS_DE_NOVIDADE = 7;

/** Quanto tempo um pedido pode ficar sem uma única proposta antes de ser um problema. */
export const HORAS_ATE_ESTRANHAR_O_SILENCIO = 48;

/**
 * Quantos pedidos cada passagem olha.
 *
 * Há um tecto porque isto corre de dez em dez minutos contra um pool de cinco
 * ligações, e uma consulta que varra a tabela inteira a esse ritmo põe o painel
 * lento — a doença que este projecto acabou de deixar de ter. O tecto é
 * anunciado quando é atingido: um limite silencioso lê-se como "estava tudo
 * visto", e é assim que se descobre tarde de mais que metade dos clientes nunca
 * foi avisada.
 */
export const PEDIDOS_POR_PASSAGEM = 300;

/**
 * As que não são para o cliente: são para quem gere.
 *
 * "Sem propostas" é um problema de OFERTA e não de conversa. Dizer ao cliente
 * "ainda ninguém respondeu" três dias seguidos é anunciar-lhe que a plataforma
 * está vazia — resolve-se falando com os profissionais, ou baixando o valor de
 * partida. Fica registado, aparece no ecrã do assistente, e não sai para o
 * WhatsApp de ninguém.
 */
export const PARA_A_EQUIPA: EspecieDeAviso[] = ["sem_propostas"];

export function eParaAEquipa(e: EspecieDeAviso): boolean {
  return PARA_A_EQUIPA.includes(e);
}

/**
 * Esta espécie faz uma PERGUNTA, ou só dá uma notícia?
 *
 * A diferença decide o que acontece a seguir. Uma pergunta fica aberta à
 * espera de resposta e pode levar lembretes; uma notícia fecha-se no instante
 * em que sai. Sem esta distinção, um agradecimento ficaria para sempre na
 * lista dos que não responderam — e ao fim de três dias a conversa era
 * entregue a uma pessoa por o cliente não ter agradecido de volta.
 */
export function esperaResposta(e: EspecieDeAviso): boolean {
  return Object.prototype.hasOwnProperty.call(ESCADA_DOS_LEMBRETES, e);
}

/**
 * A precedência: a fase mais adiantada ganha.
 *
 * Não é gosto — é a definição de "a novidade mais recente". Um pedido cujo
 * trabalho já foi confirmado não tem nada para contar sobre a proposta que o
 * abriu. A ordem do funil é, por construção, a ordem do tempo.
 */
const PRECEDENCIA: EspecieDeAviso[] = [
  "avaliacao",
  "agradecimento",
  "trabalho_feito",
  "vespera",
  "dia_marcado",
  "fechado",
  "pro_aceitou",
  "proposta_nova",
  "sem_propostas",
  "recolha_parada",
];

/* ── As chaves, num sítio só ─────────────────────────────────────────────────
 *
 * São construídas em DOIS sítios: aqui, quando o assistente descobre a
 * novidade sozinho, e no caminho de sempre, quando a proposta é gravada e a
 * mensagem sai logo. Se as duas não derem exactamente a mesma string, o
 * cliente recebe a mesma notícia duas vezes — uma do envio imediato e outra do
 * cron dez minutos depois. Por isso vivem aqui, e não escritas à mão nos dois
 * lados.
 * ────────────────────────────────────────────────────────────────────────── */

/** Quantas propostas já houve identifica a proposta sem depender de relógios. */
export function chaveDaProposta(negociacaoId: number, quantasPropostas: number): string {
  return `proposta:${negociacaoId}:${quantasPropostas}`;
}

export function chaveDaAceitacao(negociacaoId: number, valor: number): string {
  return `aceitou:${negociacaoId}:${valor}`;
}

export function chaveDoFecho(negociacaoId: number): string {
  return `fechado:${negociacaoId}`;
}

function euros(v: number): string {
  return v.toFixed(2).replace(".", ",") + " €";
}

function comoData(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** O dia civil em Lisboa, no formato AAAA-MM-DD. A Vercel corre em UTC. */
export function diaEmLisboa(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" });
}

function horaEmLisboa(d: Date): string {
  return d.toLocaleTimeString("pt-PT", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function diaPorExtenso(d: Date): string {
  return d.toLocaleDateString("pt-PT", {
    timeZone: "Europe/Lisbon",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function propostasDe(json: string | null | undefined): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

/**
 * Como se trata o cliente.
 *
 * O exemplo que o dono deu dizia "senhor João". Aqui vai só o nome próprio, e
 * a razão é simples: a base guarda o nome e NÃO guarda o género. "Sr." num
 * nome que seja de uma senhora é uma falta de educação que uma máquina não tem
 * desculpa para cometer, e acontece à primeira Maria. Sem título não se erra,
 * e em português de Portugal "Boa tarde, João" continua a ser uma forma de
 * tratamento correcta de uma empresa para um cliente.
 */
export function comoTratar(nome: string | null | undefined, agora: Date): string {
  const p = primeiroNome(nome);
  return p ? `${saudacao(agora)}, ${p}.` : `${saudacao(agora)}.`;
}

/** O que ele paga no fim: o valor do profissional, mais o imposto e a taxa. */
function total(valor: number, regimeIva: string | null): number {
  return contaDoCliente(valor, regimeDeIva(regimeIva)).total;
}

/**
 * TODAS as novidades que este pedido tem para contar agora.
 *
 * Função pura. Não sabe se alguma delas já foi contada — isso é a chave única
 * na base que responde, e é lá que tem de ser respondido: dois crons a correr
 * ao mesmo tempo chegariam aqui os dois com a mesma lista.
 */
export function novidadesDoPedido(p: PedidoParaOAssistente, agora: Date): Novidade[] {
  const telefone = (p.contactPhone ?? "").trim();
  if (!telefone) return [];

  const nome = primeiroNome(p.contactName);
  const ola = comoTratar(p.contactName, agora);
  const servico = rotuloServico(p.serviceType).toLowerCase();
  const novidades: Novidade[] = [];

  const acrescentar = (n: Omit<Novidade, "telefone" | "pedidoId" | "nome">) =>
    novidades.push({ ...n, telefone, pedidoId: p.id, nome });

  /*
   * NENHUMA PROPOSTA, E JÁ PASSARAM DOIS DIAS.
   *
   * Vai para a equipa, nunca para o cliente. Conta-se a partir da criação do
   * pedido e só enquanto ele estiver vivo — um pedido que ninguém quis há um
   * mês já não é uma notícia, é uma estatística.
   */
  const temPropostas = p.negociacoes.some((n) => propostasDe(n.propostasJson).length > 0);
  const temAcordo = p.negociacoes.some((n) => n.estado === "acordada");
  const criado = comoData(p.createdAt);
  if (!temPropostas && !temAcordo && criado) {
    const horas = (agora.getTime() - criado.getTime()) / 3600_000;
    if (horas >= HORAS_ATE_ESTRANHAR_O_SILENCIO) {
      acrescentar({
        especie: "sem_propostas",
        chave: `sem_propostas:${p.id}`,
        capacidade: "avisar",
        negociacaoId: null,
        quando: new Date(criado.getTime() + HORAS_ATE_ESTRANHAR_O_SILENCIO * 3600_000),
        texto:
          `Pedido #${p.id} (${servico}) está há ${Math.floor(horas / 24)} dia(s) sem uma única ` +
          `proposta. ` +
          (p.negociacoes.length === 0
            ? "Não foi distribuído a nenhum profissional."
            : `Foi a ${p.negociacoes.length} profissional(ais) e nenhum respondeu.`) +
          ` Vale a pena rever o valor de partida ou alargar o raio.`,
      });
    }
  }

  for (const n of p.negociacoes) {
    const pro = n.profissionalNome || "o profissional";
    const acordado = n.valorAcordado != null ? Number(n.valorAcordado) : null;
    const propostas = propostasDe(n.propostasJson);

    // ── Há uma proposta do profissional à espera de resposta ───────────────
    if (n.estado === "aberta") {
      const pendente = [...propostas].reverse().find((pr) => pr.estado === "pendente");
      const criada = pendente ? comoData(pendente.criadaEm) : null;
      if (pendente && pendente.por === "profissional" && criada) {
        // Uma proposta cujo prazo de 48 h passou já não espera por ninguém.
        const horas = (agora.getTime() - criada.getTime()) / 3600_000;
        if (horas < 48) {
          acrescentar({
            especie: "proposta_nova",
            chave: chaveDaProposta(n.id, propostas.length),
            capacidade: "avisar",
            negociacaoId: n.id,
            quando: criada,
            texto:
              `${ola} Acabou de receber uma proposta de ${pro} para a sua ${servico}: ` +
              `${euros(pendente.valor)} sem IVA, que com o imposto e a taxa da CLYON fica em ` +
              `${euros(total(pendente.valor, n.regimeIva))}. Só paga depois de o trabalho estar ` +
              `feito e confirmado. Diga-me se lhe serve, ou responda com o valor que gostaria de pagar.`,
          });
        }
      }
    }

    // ── O profissional aceitou o valor DELE. Falta a palavra do cliente ────
    if (n.estado === "aguarda_contratacao" && acordado != null) {
      acrescentar({
        especie: "pro_aceitou",
        chave: chaveDaAceitacao(n.id, acordado),
        capacidade: "avisar",
        negociacaoId: n.id,
        quando: comoData(n.actualizadaEm) ?? agora,
        texto:
          `${ola} Boas notícias: ${pro} aceitou os ${euros(acordado)} que propôs para a sua ` +
          `${servico}. Com o imposto e a taxa fica em ${euros(total(acordado, n.regimeIva))}, ` +
          `e só paga depois de estar feito. Falta só a sua palavra para ficar combinado.`,
      });
    }

    if (n.estado !== "acordada") continue;

    const execucao = comoData(n.execucaoEnviadaEm);
    const confirmado = comoData(n.confirmadoEm);
    const marcada = comoData(n.dataCombinada);
    const combinada = marcada ?? comoData(p.dataAgendada);

    // ── Ficou fechado ──────────────────────────────────────────────────────
    acrescentar({
      especie: "fechado",
      chave: chaveDoFecho(n.id),
      capacidade: "avisar",
      negociacaoId: n.id,
      quando: comoData(n.actualizadaEm) ?? agora,
      texto:
        `${ola} Está combinado com ${pro} para a sua ${servico}` +
        (acordado != null
          ? `, por ${euros(acordado)} sem IVA (${euros(total(acordado, n.regimeIva))} no total)`
          : "") +
        `. Ele já tem a morada e o seu contacto.` +
        (combinada ? "" : " Se já tem dia pensado, diga-me qual que eu deixo marcado."),
    });

    // ── O dia ficou marcado ────────────────────────────────────────────────
    if (marcada) {
      acrescentar({
        especie: "dia_marcado",
        chave: `agenda:${n.id}:${marcada.toISOString()}`,
        capacidade: "acompanhar",
        negociacaoId: n.id,
        quando: comoData(n.actualizadaEm) ?? agora,
        texto:
          `${ola} A sua ${servico} ficou marcada para ${diaPorExtenso(marcada)}, às ` +
          `${horaEmLisboa(marcada)}, com ${pro}. Se precisar de mudar alguma coisa, diga-me.`,
      });
    }

    // ── A véspera ──────────────────────────────────────────────────────────
    if (combinada && !execucao) {
      const amanha = new Date(agora.getTime() + 86_400_000);
      if (diaEmLisboa(combinada) === diaEmLisboa(amanha)) {
        acrescentar({
          especie: "vespera",
          chave: `vespera:${n.id}:${diaEmLisboa(combinada)}`,
          capacidade: "acompanhar",
          negociacaoId: n.id,
          quando: agora,
          texto:
            `${ola} É só para lembrar que amanhã, às ${horaEmLisboa(combinada)}, ${pro} vai ter ` +
            `consigo para a sua ${servico}. Se houver alguma coisa a mudar, é hoje que dá jeito saber.`,
        });
      }
    }

    // ── O trabalho foi dado por feito ──────────────────────────────────────
    if (execucao && !confirmado) {
      acrescentar({
        especie: "trabalho_feito",
        chave: `execucao:${n.id}`,
        capacidade: "acompanhar",
        negociacaoId: n.id,
        quando: execucao,
        texto:
          `${ola} ${pro} deu a sua ${servico} por feita e mandou as fotografias. ` +
          `Diga-me se ficou tudo bem, para eu poder fechar o pedido. Se não me disser nada, ` +
          `ao fim de sete dias fecha sozinho.`,
      });
    }

    // ── O agradecimento, e a avaliação no dia seguinte ─────────────────────
    if (confirmado) {
      acrescentar({
        especie: "agradecimento",
        chave: `obrigado:${n.id}`,
        capacidade: "agradecer",
        negociacaoId: n.id,
        quando: confirmado,
        texto:
          `${ola} Está tudo fechado, e fico-lhe grato por ter confiado a sua ${servico} à CLYON. ` +
          `Foi um gosto tratar disto consigo. Ficamos por aqui para o que precisar.`,
      });

      /*
       * O AGRADECIMENTO NÃO PEDE NADA — por isso a avaliação vem à parte, e um
       * dia depois. Juntar "e avalie-nos" ao obrigado transforma um gesto numa
       * cobrança, e é a diferença entre uma empresa que agradece e uma que
       * cobra um favor por ter feito o trabalho que lhe pagaram.
       */
      const passouUmDia = agora.getTime() - confirmado.getTime() >= 86_400_000;
      if (passouUmDia && !comoData(n.avaliadoEm)) {
        acrescentar({
          especie: "avaliacao",
          chave: `avaliacao:${n.id}`,
          capacidade: "agradecer",
          negociacaoId: n.id,
          quando: new Date(confirmado.getTime() + 86_400_000),
          texto:
            `${ola} Uma última coisa e não o incomodo mais: como é que correu o trabalho de ${pro}? ` +
            `Duas linhas suas ajudam quem vier a seguir a escolher bem.`,
        });
      }
    }
  }

  return novidades;
}

/** Ainda é novidade, ou já é história? */
export function aindaENovidade(n: Novidade, agora: Date): boolean {
  const dias = (agora.getTime() - n.quando.getTime()) / 86_400_000;
  return dias >= 0 && dias <= DIAS_DE_NOVIDADE;
}

/**
 * A ÚNICA novidade que este pedido conta ao CLIENTE nesta passagem, mais o que
 * houver para a equipa.
 *
 * As duas não competem: são canais diferentes, e calar um alerta interno
 * porque houve uma proposta seria perder exactamente a informação de que a
 * equipa precisa.
 */
export function novidadeAContar(
  p: PedidoParaOAssistente,
  agora: Date,
  podeFazer: (c: Capacidade) => boolean,
): Novidade[] {
  const frescas = novidadesDoPedido(p, agora)
    .filter((n) => aindaENovidade(n, agora))
    .filter((n) => podeFazer(n.capacidade));

  const daEquipa = frescas.filter((n) => eParaAEquipa(n.especie));
  const doCliente = frescas
    .filter((n) => !eParaAEquipa(n.especie))
    .sort((a, b) => PRECEDENCIA.indexOf(a.especie) - PRECEDENCIA.indexOf(b.especie));

  return [...daEquipa, ...doCliente.slice(0, 1)];
}

/**
 * O texto do lembrete — e ele MUDA a cada toque.
 *
 * Repetir a mesma frase palavra por palavra é o que faz uma pessoa perceber
 * que está a falar com uma máquina, e é também o que a faz bloquear o número.
 * O primeiro toque relembra, o segundo abre a porta de saída, o terceiro
 * despede-se. Um assistente que sabe despedir-se é um assistente a que se
 * volta.
 */
export function textoDoLembrete(
  especie: EspecieDeAviso,
  nome: string,
  toque: number,
  agora: Date,
): string | null {
  const tratamento = nome ? `${nome}, ` : "";

  if (especie === "proposta_nova" || especie === "pro_aceitou") {
    if (toque === 0) {
      return (
        `${tratamento}a proposta que lhe mandei continua à espera de si. Diga-me se lhe serve, ` +
        `ou que valor lhe faria sentido, que eu falo com o profissional.`
      );
    }
    if (toque === 1) {
      return (
        `${tratamento}ainda sobre o seu pedido. Se entretanto já resolveu ou mudou de ideias, ` +
        `diga-me também, que eu arrumo isto e não lhe volto a escrever.`
      );
    }
    return (
      `${tratamento}fico por aqui para não o estar a incomodar. Se quiser retomar, é só ` +
      `escrever-me e eu volto a pôr o pedido de pé.`
    );
  }

  if (especie === "trabalho_feito") {
    if (toque === 0) {
      return (
        `${tratamento}só falta a sua confirmação de que o trabalho ficou bem feito. ` +
        `Se houver alguma coisa menos boa, é agora que dá para resolver.`
      );
    }
    return (
      `${tratamento}se não me disser nada, o pedido fecha-se sozinho dentro de poucos dias e o ` +
      `profissional recebe. Se houver algum problema, diga-me antes disso.`
    );
  }

  if (especie === "recolha_parada") {
    if (toque === 0) {
      return (
        `${saudacao(agora)}. Ficámos a meio do seu pedido e não quero deixá-lo pendurado. ` +
        `Quando puder, continue de onde parámos que eu trato do resto.`
      );
    }
    return (
      `Se entretanto já não precisa, não se preocupe em responder. Guardo o que já me disse ` +
      `durante uns dias, caso queira voltar.`
    );
  }

  return null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * A PASSAGEM — a metade suja, que lê a base e fala.
 * ──────────────────────────────────────────────────────────────────────────── */

export type ResumoDaPassagem = {
  /** Correu mesmo, ou o interruptor geral estava em baixo? */
  correu: boolean;
  novidades: number;
  lembretes: number;
  fechados: number;
  entregues: number;
  alertas: number;
  /** O que se passou, em palavras, para o registo e para o painel. */
  linhas: string[];
};

/**
 * Uma passagem do assistente. Chamada pelo cron e pelo botão do painel.
 *
 * NÃO LANÇA. Um cron que rebenta a meio deixa metade dos clientes avisados e
 * metade não, e na passagem seguinte não há como saber onde ficou. Cada
 * mensagem é independente das outras, e um erro numa não pode calar as
 * restantes.
 */
export async function correrOAssistente(agora: Date = new Date()): Promise<ResumoDaPassagem> {
  const resumo: ResumoDaPassagem = {
    correu: false,
    novidades: 0,
    lembretes: 0,
    fechados: 0,
    entregues: 0,
    alertas: 0,
    linhas: [],
  };

  const db = await import("@/lib/db");
  const { enviarTextoWhatsApp } = await import("@/lib/whatsapp-cloud");

  if (!(await db.whatsappLigado())) {
    resumo.linhas.push("O WhatsApp está desligado. Nada a fazer.");
    return resumo;
  }
  resumo.correu = true;

  const interruptores = await db.interruptoresDoAssistente();
  const podeFazer = (c: Capacidade) => interruptores[c] === true;

  // Quem respondeu deixou de precisar de lembrete. Primeiro isto, sempre:
  // insistir com quem já respondeu é o erro que mais depressa custa o número.
  resumo.fechados += await db.fecharAvisosComResposta().catch(() => 0);

  const pedidos = await db.pedidosParaOAssistente(PEDIDOS_POR_PASSAGEM).catch(() => []);
  if (pedidos.length >= PEDIDOS_POR_PASSAGEM) {
    // Um tecto que não se anuncia lê-se como "estava tudo visto".
    console.warn(
      `[assistente] a passagem bateu no tecto de ${PEDIDOS_POR_PASSAGEM} pedidos - os mais antigos ficaram de fora`,
    );
    resumo.linhas.push(`Atenção: só foram vistos os ${PEDIDOS_POR_PASSAGEM} pedidos mais recentes.`);
  }

  /*
   * O MAPA DE TUDO O QUE AINDA FAZ SENTIDO.
   *
   * A mesma derivação serve duas coisas: decidir o que contar de novo, e
   * decidir o que já não vale a pena lembrar. Um aviso cuja chave desapareceu
   * daqui é um aviso sobre um estado que mudou — o cliente aceitou pelo site,
   * o profissional desistiu — e insistir nele era falar de um assunto morto.
   */
  const vivas = new Map<string, Novidade>();
  /*
   * E A LISTA DOS PEDIDOS QUE CHEGÁMOS MESMO A OLHAR.
   *
   * Sem ela, "a chave desapareceu do mapa" querria dizer duas coisas: o estado
   * mudou, OU o pedido ficou de fora da janela lida — porque é antigo, porque
   * foi cancelado, ou porque bateu no tecto desta passagem. Tratar as duas da
   * mesma maneira dava por resolvido um aviso que continuava à espera de
   * resposta, e o cliente deixava de levar os lembretes que lhe eram devidos
   * sem que nada o dissesse.
   */
  const pedidosVistos = new Set<number>();
  for (const p of pedidos) {
    pedidosVistos.add(p.id);
    for (const n of novidadesDoPedido(p, agora)) vivas.set(n.chave, n);
  }

  // ── 1. Contar as novidades ──────────────────────────────────────────────
  for (const p of pedidos) {
    for (const n of novidadeAContar(p, agora, podeFazer)) {
      if (!eParaAEquipa(n.especie) && !horaDeFalar(agora)) continue;

      const { id } = await db.reservarAvisoDoAssistente({
        chave: n.chave,
        especie: n.especie,
        telefone: n.telefone,
        pedidoId: n.pedidoId,
        negociacaoId: n.negociacaoId,
      });
      if (!id) continue; // já tinha sido contado

      if (eParaAEquipa(n.especie)) {
        await db.guardarTextoDoAviso(id, n.texto);
        await db.fecharAvisoDoAssistente(id, "informado");
        await db.registarSemFalhar({
          acontecimento: "assistente_alerta",
          pedidoId: n.pedidoId,
          autorTipo: "assistente",
          autorNome: "assistente automático",
          resumo: n.texto,
        });
        resumo.alertas++;
        resumo.linhas.push(`Alerta à equipa sobre o pedido #${n.pedidoId}.`);
        continue;
      }

      const saiu = await enviarTextoWhatsApp(n.telefone, n.texto).catch(() => false);
      if (!saiu) {
        /*
         * Não saiu — a conversa está entregue a uma pessoa, o número está
         * bloqueado, ou o canal falhou. Liberta-se a chave: guardá-la fazia
         * desta novidade uma que nunca mais seria contada, e o cliente ficava
         * sem saber da proposta dele para sempre.
         */
        await db.libertarAvisoDoAssistente(id);
        continue;
      }
      await db.guardarTextoDoAviso(id, n.texto);
      /*
       * UMA NOTÍCIA FECHA-SE AO SAIR; UMA PERGUNTA FICA ABERTA.
       *
       * Só as que esperam resposta entram na lista dos lembretes. Sem esta
       * linha, um agradecimento ficava para sempre por responder e, três dias
       * depois, a conversa era entregue a uma pessoa por o cliente não ter
       * agradecido de volta.
       */
      if (!esperaResposta(n.especie)) await db.fecharAvisoDoAssistente(id, "informado");
      resumo.novidades++;
      resumo.linhas.push(`${n.especie} no pedido #${n.pedidoId}.`);
    }
  }

  // ── 2. Insistir com quem não respondeu ──────────────────────────────────
  const abertos = await db.avisosPorFechar().catch(() => []);
  for (const a of abertos) {
    const especie = a.especie as EspecieDeAviso;
    const ainda = vivas.get(a.chave);

    /*
     * O estado mudou sozinho: não há nada para lembrar. A recolha a meio é a
     * excepção, porque não vem das negociações — quem a fecha é a resposta do
     * cliente, ou o fim da escada.
     *
     * E só se o pedido tiver mesmo sido olhado nesta passagem. Um pedido que
     * ficou de fora da janela não diz nada sobre o aviso dele: dá-lo por
     * resolvido era desligar os lembretes de um cliente que continua à espera.
     * Nesse caso não se fecha nem se insiste — fica quieto até voltar a entrar
     * na janela, ou até a limpeza dos 60 dias o levar.
     */
    if (especie !== "recolha_parada") {
      const visto = a.pedidoId != null && pedidosVistos.has(a.pedidoId);
      if (!visto) continue;
      if (!ainda) {
        await db.fecharAvisoDoAssistente(a.id, "resolvido");
        resumo.fechados++;
        continue;
      }
    }

    if (!podeFazer("insistir")) continue;

    const desde = new Date(a.ultimoToqueEm ?? a.enviadoEm);
    if (Number.isNaN(desde.getTime())) continue;

    if (esgotou(especie, a.toques)) {
      /*
       * TRÊS TOQUES E PÁRA — e a conversa deixa de ser do assistente.
       *
       * Continuar a bater à porta é o caminho directo para o número ser
       * banido. Uma recolha a meio ARRUMA-SE (não chegou a haver pedido, não
       * há nada que uma pessoa possa fazer); um negócio por fechar ENTREGA-SE,
       * porque aí há dinheiro em cima da mesa e vale a pena alguém telefonar.
       */
      await db.fecharAvisoDoAssistente(a.id, "esgotou");
      if (especie === "recolha_parada") {
        await db.arquivarConversaWhatsApp(a.telefone, true).catch(() => {});
        resumo.linhas.push(`Arquivada: ${a.telefone} deixou a recolha a meio.`);
      } else {
        await db
          .interromperNumeroWhatsApp(a.telefone, "Nao responde - tres lembretes sem resposta")
          .catch(() => {});
        resumo.entregues++;
        resumo.linhas.push(`Entregue a si: ${a.telefone} não respondeu a três lembretes.`);
      }
      continue;
    }

    if (!deveTocar(especie, a.toques, desde, agora)) continue;

    const texto = textoDoLembrete(especie, ainda?.nome ?? "", a.toques, agora);
    if (!texto) continue;

    const saiu = await enviarTextoWhatsApp(a.telefone, texto).catch(() => false);
    if (!saiu) continue;
    await db.marcarToqueDoAssistente(a.id);
    resumo.lembretes++;
    resumo.linhas.push(`Lembrete ${a.toques + 1} sobre ${especie} a ${a.telefone}.`);
  }

  // ── 3. As recolhas paradas a meio ───────────────────────────────────────
  //
  // Vêm de outra tabela que não as negociações, e por isso têm o seu próprio
  // caminho. O primeiro toque sai AQUI, no instante em que se descobre a
  // paragem: deixá-lo para a passagem seguinte dobrava a espera do cliente,
  // porque a escada conta a partir do momento em que a linha é criada.
  if (podeFazer("insistir") && horaDeFalar(agora)) {
    const recolhas = await db.listarRecolhasWhatsAppEmCurso().catch(() => []);
    for (const r of recolhas) {
      const desde = new Date(r.actualizadoEm);
      if (Number.isNaN(desde.getTime())) continue;
      if ((agora.getTime() - desde.getTime()) / 3600_000 < 6) continue;
      const { id } = await db.reservarAvisoDoAssistente({
        chave: `recolha:${String(r.telefone).replace(/\D/g, "").slice(-9)}:${r.actualizadoEm}`,
        especie: "recolha_parada",
        telefone: r.telefone,
      });
      if (!id) continue;
      const texto = textoDoLembrete("recolha_parada", "", 0, agora);
      const saiu = texto
        ? await enviarTextoWhatsApp(r.telefone, texto).catch(() => false)
        : false;
      if (!saiu) {
        await db.libertarAvisoDoAssistente(id);
        continue;
      }
      await db.guardarTextoDoAviso(id, texto!);
      await db.marcarToqueDoAssistente(id);
      resumo.lembretes++;
      resumo.linhas.push(`Lembrete 1 sobre recolha_parada a ${r.telefone}.`);
    }
  }

  await db.limparAvisosVelhos().catch(() => 0);
  return resumo;
}
