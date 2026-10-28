import {
  aplicarOQueSeViu,
  comAgradecimentoDasImagens,
  entregarQuemSeQueixa,
  fechoDoPedidoAberto,
  juntarAoPedidoOQueDisse,
  notaDoPrecoPara,
  OBRIGADA_PELAS_IMAGENS,
  PASSO_A_ALGUEM_DA_EQUIPA,
  pedeUmaPessoa,
  perguntaDo,
  primeiroPassoEmFalta,
  respostasAsPerguntas,
  responderComCompreensao,
  responderNaRecolha,
  servicoPorPalavras,
  type DadosDaRecolha,
  type EstadoDaRecolha,
  type PassoDaRecolha,
  type RespostaDaRecolha,
} from "./whatsapp-recolha";
import type { CamposCrus, Intencao } from "./whatsapp-compreensao";
import {
  andarDaResposta,
  desisteDoPedido,
  fugiuAoNome,
  jaFezOPedido,
  perguntaPeloPreco,
  semAcentos,
} from "./leitor-da-recolha";
import { CLARO_QUE_SIM, EM_QUE_POSSO_AJUDAR, eUmaPergunta, PERGUNTA_ANOTADA, QUEM_FALA } from "./voz-da-vitoria";
import { linguaPedida, semPedidoDeLingua } from "./lingua-do-cliente";
import { primeiroNome } from "./mensagem-whatsapp";
import { servicoEmPalavras } from "./servico-em-palavras";
import { andarComLado } from "./pedido-da-recolha";
import { descricaoOrganizada } from "./descricao-do-pedido";
import { eDaEquipa } from "./rajada-do-whatsapp";
import { respostaDoSiteOuDasLicoes } from "./licoes-da-vitoria";

/**
 * O CLIENTE QUE JÁ TEM PEDIDO — a Vitória continua-o, em vez de recomeçar.
 * 26-10-2026 (decisão d30, pedida pelo dono na conversa com o CEO).
 *
 * *«A Vitória tem que, antes de iniciar os pedidos, olhar pelo número de
 * telefone daquele cliente, se ele já tem cadastro. Se tiver, não precisa de
 * começar do zero: só precisa de actualizar o que estiver a faltar — imagens,
 * morada, nome (o telefone não, é por ele que encontra).»* — o dono.
 *
 * O caso (nome e número inventados): a cliente tinha o pedido #812, uma
 * recolha de monos feita no simulador, com fotografias. Um colega escreveu-lhe
 * à mão — «Recebemos o seu pedido de recolha de monos (#812) (…), pode
 * enviar-nos algumas imagens?» —, ela mandou uma fotografia, e a Vitória
 * respondeu como a uma desconhecida: «Boa tarde! Aqui é a Vitória… diga-me só
 * que serviço é», e depois o nome, duas vezes. Ela acabou com «Consulte o
 * pedido de orçamento. Está lá tudo. Fotos também.»
 *
 * O que muda:
 *   · antes de recomeçar, procuram-se os pedidos ABERTOS e recentes do número
 *     (`pedidosDoTelefone`, os mesmos de sempre) e os de que a equipa já falou
 *     no fio (`pedidosFaladosNoFio`);
 *   · com um, a Vitória cumprimenta pelo pedido, pergunta só o que lhe falta
 *     (`PASSOS_DO_PEDIDO_ABERTO`) e o que ele mandar junta-se a ESSE pedido;
 *     com dois ou mais, pergunta a qual se refere;
 *   · se um colega já falou do pedido, não se apresenta outra vez;
 *   · se ele pedir claramente outra coisa, aí sim, é um pedido novo.
 *
 * Este ficheiro é PURO, como a recolha: quem lê a base e envia é
 * `whatsapp-negociacao.ts`.
 */

/** O que interessa de um pedido da base — as colunas de `simulatorOrders`. */
export type PedidoDaBase = {
  id: number;
  status?: string | null;
  serviceType?: string | null;
  contactName?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  floor?: string | null;
  hasElevator?: string | null;
  parkingDistance?: string | null;
  description?: string | null;
  filesJson?: string | null;
  createdAt?: Date | string | null;
  /** Um trabalho CLYON: o preço foi combinado à mão, e o cliente fala com uma pessoa. */
  valorFixoClyon?: unknown;
};

/** O pedido, como a Vitória fala dele. */
export type PedidoNaConversa = {
  id: number;
  servico: string | null;
  /** O primeiro nome do cliente, ou null. */
  nome: string | null;
  localidade: string | null;
  /** Fotografias que o pedido já tem. */
  fotos: number;
};

/** Os estados de um pedido que já não está aberto. */
const FECHADOS = new Set(["cancelado", "concluido", "arquivado", "rejeitado"]);

/** Recente: dos últimos 30 dias. Um pedido de há dois meses já não é «o pedido dele». */
export const DIAS_DE_UM_PEDIDO_ABERTO = 30;

/** O nome que o registo automático põe quando não o sabe — não é um nome. */
const SEM_NOME = /^cliente\s+whatsapp$/i;

const limpo = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Este pedido está aberto, e é recente? Sem data, conta como recente: na dúvida, não se recomeça. */
export function pedidoEstaAberto(p: PedidoDaBase | null | undefined, agora: Date = new Date()): boolean {
  if (!p) return false;
  if (FECHADOS.has(String(p.status ?? "").trim())) return false;
  if (p.createdAt == null) return true;
  const criado = new Date(p.createdAt as string);
  if (Number.isNaN(criado.getTime())) return true;
  return agora.getTime() - criado.getTime() <= DIAS_DE_UM_PEDIDO_ABERTO * 24 * 3600_000;
}

/**
 * UM PEDIDO QUE A VITÓRIA PODE CONTINUAR — aberto, recente, e que não seja um
 * trabalho CLYON: esses foram combinados à mão, e o cliente deles não leva
 * mensagens automáticas (decisão do dono, 02-10-2026; ver `oferta-clyon.ts`).
 */
export function pedidoParaAVitoria(p: PedidoDaBase | null | undefined, agora: Date = new Date()): boolean {
  return pedidoEstaAberto(p, agora) && (p?.valorFixoClyon == null || p.valorFixoClyon === "");
}

/**
 * OS PEDIDOS DE QUE A CLYON JÁ FALOU NESTE FIO — «(#812)», «pedido 812»,
 * «Pedido #812 registado» —, o mais recente primeiro.
 *
 * Só as mensagens que SAÍRAM: o que a equipa escreveu à mão e o que a
 * Vitória disse. Um número escrito pelo cliente não chega para lhe abrir um
 * pedido que não é do telefone dele.
 */
export function pedidosFaladosNoFio(
  fio: Array<{ direccao?: string; texto?: string }> | null | undefined,
): number[] {
  if (!Array.isArray(fio)) return [];
  const ids: number[] = [];
  for (let i = fio.length - 1; i >= 0; i--) {
    const m = fio[i];
    if (m?.direccao !== "out" || typeof m.texto !== "string") continue;
    for (const x of m.texto.matchAll(/(?:#\s?|\bpedido\s+(?:n\.?\s?[º°o]\s?|n[úu]mero\s+)?)(\d{2,6})\b/gi)) {
      const n = Number(x[1]);
      if (Number.isFinite(n) && !ids.includes(n)) ids.push(n);
    }
  }
  return ids;
}

/**
 * A MEIO DE UMA RECOLHA NOVA, VALE A PENA IR VER SE ELE JÁ TEM PEDIDO? Quando
 * ele o diz («Consulte o pedido de orçamento», «a pessoa que pediu o
 * orçamento»), ou quando um colega escreveu à mão sobre um pedido no fio.
 */
export function procurarOPedidoAMeio(
  texto: string,
  fio: Array<{ direccao?: string; texto?: string }> | null | undefined,
): boolean {
  if (texto.trim() && (jaFezOPedido(texto) || fugiuAoNome(texto))) return true;
  const daEquipa = (Array.isArray(fio) ? fio : []).filter(
    (m) => m?.direccao === "out" && typeof m.texto === "string" && eDaEquipa(m.texto),
  );
  return pedidosFaladosNoFio(daEquipa).length > 0;
}

/** As fotografias que o pedido já tem — o `filesJson`. */
function fotosDoPedido(filesJson: string | null | undefined): number {
  try {
    const l = JSON.parse(filesJson ?? "[]");
    return Array.isArray(l) ? l.length : 0;
  } catch {
    return 0;
  }
}

/** O pedido, como a Vitória fala dele. */
export function pedidoNaConversa(p: PedidoDaBase): PedidoNaConversa {
  const nome = limpo(p.contactName);
  return {
    id: Number(p.id),
    servico: limpo(p.serviceType) || null,
    nome: nome && !SEM_NOME.test(nome) ? primeiroNome(nome) || null : null,
    localidade: limpo(p.city).replace(/\s*,?\s*portugal\s*$/i, "") || null,
    fotos: fotosDoPedido(p.filesJson),
  };
}

/** «yes», «no», «small» — e o que o simulador grava quando não sabe. */
function elevadorDoPedido(v: string | null | undefined): string | null {
  const e = semAcentos(limpo(v));
  if (!e) return null;
  if (e === "yes" || e === "sim" || e === "true" || e === "1") return "yes";
  if (e === "no" || e === "nao" || e === "false" || e === "0") return "no";
  if (e === "small" || /pequen/.test(e)) return "small";
  // «unknown»: ele disse que não sabe — não se volta a perguntar.
  return "unknown";
}

/**
 * O estacionamento com as palavras da recolha: «near», «far», ou `null` (por
 * saber). Cada sítio grava o seu: o simulador «door»/«under_20m»/«over_30m»,
 * o backoffice «easy»/«difficult», a Vitória «near»/«far».
 */
function estacionamentoDoPedido(v: string | null | undefined): string | null | undefined {
  const e = limpo(v);
  if (!e) return undefined;
  if (["door", "under_20m", "near", "easy"].includes(e)) return "near";
  if (["over_30m", "difficult", "far"].includes(e)) return "far";
  return null;
}

/**
 * OS DADOS DA CONVERSA A PARTIR DO PEDIDO — o que já lá está não se pergunta.
 *
 * A descrição NÃO vem: a de `dados.description` é só o que ele disser nesta
 * conversa, que se junta à do pedido sem a repetir (`blocoDoWhatsApp`).
 */
export function dadosDoPedido(p: PedidoDaBase): DadosDaRecolha {
  const d: DadosDaRecolha = { pedidoAberto: Number(p.id) };
  if (limpo(p.serviceType)) d.serviceType = limpo(p.serviceType);
  const nome = limpo(p.contactName);
  if (nome && !SEM_NOME.test(nome)) d.contactName = nome;
  if (limpo(p.address)) d.address = limpo(p.address);
  if (limpo(p.city)) d.city = limpo(p.city);
  if (limpo(p.postalCode)) d.postalCode = limpo(p.postalCode);
  const andar = limpo(p.floor);
  if (andar) d.floor = andarDaResposta(andar) ?? andar;
  const elevador = elevadorDoPedido(p.hasElevator);
  if (elevador) d.hasElevator = elevador;
  const est = estacionamentoDoPedido(p.parkingDistance);
  if (est !== undefined) d.parkingDistance = est;
  return d;
}

/**
 * O que a conversa guarda para lá do pedido — o resto lê-se do pedido em cada
 * mensagem, para não ficar com um valor que a equipa entretanto mudou.
 */
const DA_CONVERSA: Array<keyof DadosDaRecolha> = [
  "description",
  "volumeDito",
  "clienteCarrega",
  "acessoDito",
  "quandoTexto",
  "dataDesejada",
  "urgency",
  "fotosDitas",
  "fotosRecebidas",
  "blocoNoPedido",
  "tentativas",
  "saltados",
  "lado",
  "entulhoQuantidade",
  "notas",
];

/** Os dados desta mensagem: o pedido, e o que a conversa já tinha juntado a ele. */
export function dadosDaConversaNoPedido(
  p: PedidoDaBase,
  guardados?: Record<string, unknown> | null,
  /** O que se apanhou de uma recolha nova que dá lugar ao pedido. */
  herdados?: DadosDaRecolha | null,
): DadosDaRecolha {
  const d = dadosDoPedido(p);
  const g = (guardados ?? {}) as DadosDaRecolha;
  if (g.pedidoAberto === d.pedidoAberto) {
    for (const k of DA_CONVERSA) if (g[k] !== undefined) (d as Record<string, unknown>)[k] = g[k];
  } else if (guardados) {
    /*
     * A recolha que DEU este pedido (a Vitória registou-o nesta conversa): o
     * que ela já disse está no pedido, mas o que ficou por responder também
     * conta — o nome que ele não quis dar não se volta a pedir.
     */
    if (g.saltados) d.saltados = g.saltados;
    if (g.tentativas) d.tentativas = g.tentativas;
  }
  if (herdados) {
    for (const k of DA_CONVERSA) {
      if (k === "tentativas" || k === "saltados" || k === "blocoNoPedido") continue;
      if (herdados[k] !== undefined && d[k] === undefined) (d as Record<string, unknown>)[k] = herdados[k];
    }
    for (const k of ["contactName", "address", "city", "postalCode", "floor", "hasElevator", "parkingDistance"] as const) {
      if (herdados[k] !== undefined && d[k] === undefined) (d as Record<string, unknown>)[k] = herdados[k];
    }
  }
  return d;
}

/** «recolha de monos em Almada» — o pedido em meia dúzia de palavras. */
function oPedidoEmPalavras(p: PedidoNaConversa): string {
  const servico = p.servico ? servicoEmPalavras(p.servico) : null;
  const onde = p.localidade ? `em ${p.localidade}` : null;
  return [servico, onde].filter(Boolean).join(" ");
}

/**
 * O CUMPRIMENTO PELO PEDIDO — «Olá, Graciete! Aqui é a Vitória, assistente
 * online da CLYON 😊 Tenho aqui o seu pedido #812 — recolha de monos em
 * Almada.» Sem a apresentação quando ela já se apresentou neste fio.
 */
export function saudacaoDoPedido(p: PedidoNaConversa, nome: string | null, jaSeApresentou: boolean): string {
  const ola = nome ? `Olá, ${nome}!` : "Olá!";
  const quem = jaSeApresentou ? "" : ` ${QUEM_FALA} 😊`;
  const oQue = oPedidoEmPalavras(p);
  return `${ola}${quem}\nTenho aqui o seu pedido #${p.id}${oQue ? ` — ${oQue}` : ""}.`;
}

const POR_EXTENSO = ["", "um", "dois", "três", "quatro", "cinco"];

/** «Tenho aqui dois pedidos seus em aberto: …  A qual deles se refere?» */
export function perguntaQualPedido(pedidos: PedidoNaConversa[], nome: string | null, jaSeApresentou: boolean): string {
  const ola = nome ? `Olá, ${nome}!` : "Olá!";
  const quem = jaSeApresentou ? "" : ` ${QUEM_FALA} 😊`;
  const n = pedidos.length;
  const linhas = pedidos.map((p) => {
    const oQue = oPedidoEmPalavras(p);
    return `• #${p.id}${oQue ? ` — ${oQue}` : ""}`;
  });
  return (
    `${ola}${quem}\nTenho aqui ${POR_EXTENSO[n] ?? n} pedidos seus em aberto:\n${linhas.join("\n")}\n\n` +
    "A qual deles se refere? Se for um pedido novo, diga-me também."
  );
}

/** «#812 ou #805» */
function osNumeros(pedidos: PedidoNaConversa[]): string {
  const ids = pedidos.map((p) => `#${p.id}`);
  return ids.length > 1 ? `${ids.slice(0, -1).join(", ")} ou ${ids[ids.length - 1]}` : ids.join("");
}

/** À segunda vez, mais curta — e com os números, que é como se escolhe sem dúvida. */
export function perguntaQualPedidoOutraVez(pedidos: PedidoNaConversa[]): string {
  return `Peço desculpa, não percebi a qual se refere. Diga-me o número do pedido — ${osNumeros(pedidos)} — ou se é um pedido novo.`;
}

/** Mandou imagens antes de dizer o pedido: ficam à espera, e pergunta-se a qual. */
export function perguntaQualPedidoDasImagens(pedidos: PedidoNaConversa[]): string {
  return `${OBRIGADA_PELAS_IMAGENS} Diga-me só a qual dos pedidos se referem — ${osNumeros(pedidos)} —, para as juntar ao certo.`;
}

/** As famílias de serviços: uma recolha de móveis e uma de monos são o mesmo pedido dito de outra maneira. */
function familia(servico: string): string {
  if (servico.startsWith("recolha_")) return "recolha";
  if (servico.startsWith("esvaziamento_")) return "esvaziamento";
  return servico;
}

/**
 * PEDIU CLARAMENTE OUTRA COISA — um pedido novo, e não o que já tem.
 *
 * «Quero fazer outro pedido», «é um pedido novo», «também preciso de uma
 * mudança». Um serviço da mesma família não conta: «Trata-se da recolha de um
 * sofá» sobre uma recolha de monos é o mesmo pedido, dito pelas palavras dele.
 */
export function querOutroPedido(texto: string, servicoDoPedido: string | null | undefined): boolean {
  const t = semAcentos(texto);
  if (/\b(outro|novo|mais\s+um|segundo|nova|outra)\s+(pedido|orcamento|servico|trabalho|recolha|mudanca)\b/.test(t)) return true;
  if (/\b(pedido|orcamento)\s+(novo|diferente|a\s+parte|separado)\b/.test(t)) return true;
  if (/^(e\s+)?(um\s+)?(pedido\s+)?novo[.!]*$|^e\s+outra\s+coisa\b/.test(t)) return true;
  const s = servicoPorPalavras(texto);
  if (!s || !servicoDoPedido || servicoDoPedido === "outro" || s === "outro") return false;
  if (familia(s) === familia(servicoDoPedido)) return false;
  return /\b(tambem|alem\s+disso|e\s+ainda|outra\s+coisa|preciso|precisava|queria|quero|gostava|gostaria|pedir|orcamento)\b/.test(t);
}

/** O número de um pedido que ele escreveu — «o 812», «#812» —, se for um destes. */
export function pedidoDitoNoTexto(texto: string, ids: number[]): number | null {
  const numeros = [...texto.matchAll(/(?<!\d)(\d{2,6})(?!\d)/g)].map((m) => Number(m[1]));
  const ditos = ids.filter((id) => numeros.includes(id));
  return ditos.length === 1 ? ditos[0] : null;
}

/**
 * A QUAL DOS PEDIDOS SE REFERE — pelo número, pela ordem («o primeiro»),
 * pelo serviço ou pela localidade, quando só um bate. «Novo» quando diz que é
 * outra coisa; `null` quando não se percebe.
 */
export function escolherOPedido(texto: string, pedidos: PedidoNaConversa[]): number | "novo" | null {
  const t = semAcentos(texto);
  if (/\b(nenhum|nenhuma)\b|\b(pedido\s+novo|um\s+novo|outro\s+pedido|e\s+outra\s+coisa|outro\s+assunto)\b/.test(t)) return "novo";
  const pelo = pedidoDitoNoTexto(texto, pedidos.map((p) => p.id));
  if (pelo != null) return pelo;
  const ordem: RegExp[] = [
    /^(o\s+)?(1|1º|1o|primeiro)\b|\bo\s+primeiro\b|\bo\s+de\s+cima\b/,
    /^(o\s+)?(2|2º|2o|segundo)\b|\bo\s+segundo\b/,
    /^(o\s+)?(3|3º|3o|terceiro)\b|\bo\s+terceiro\b/,
  ];
  for (let i = 0; i < Math.min(ordem.length, pedidos.length); i++) if (ordem[i].test(t)) return pedidos[i].id;
  if (/\bo\s+(de\s+baixo|ultimo)\b/.test(t)) return pedidos[pedidos.length - 1].id;
  const servico = servicoPorPalavras(texto);
  const peloServico = pedidos.filter(
    (p) => p.servico && (p.servico === servico || t.includes(semAcentos(servicoEmPalavras(p.servico)))),
  );
  if (peloServico.length === 1) return peloServico[0].id;
  const pelaLocalidade = pedidos.filter((p) => p.localidade && t.includes(semAcentos(p.localidade)));
  if (pelaLocalidade.length === 1) return pelaLocalidade[0].id;
  return null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * A CONVERSA SOBRE O PEDIDO QUE JÁ EXISTE
 * ────────────────────────────────────────────────────────────────────────── */

export type ContextoDoPedidoAberto = {
  pedido: PedidoNaConversa;
  /** A primeira resposta da Vitória sobre este pedido, nesta conversa. */
  primeira: boolean;
  /** A CLYON (um colega à mão, ou a Vitória) já falou deste pedido no fio: não se volta a apresentar. */
  colegaJaFalou: boolean;
  /** A Vitória já se apresentou neste fio. */
  jaSeApresentou: boolean;
  /** Já se lhe disse qual era o pedido — na pergunta «a qual se refere?». */
  jaDisseOPedido?: boolean;
  compreensao?: { intencao: Intencao; campos: CamposCrus; resposta?: string } | null;
  /** Fotografias e vídeos desta rajada. */
  imagensNovas?: number;
  /** O que se viu nelas — ver `aplicarOQueSeViu`. */
  visto?: string[];
  lista?: readonly string[] | null;
  jaExplicouOPreco?: boolean;
  jaDisseQueNaoCompra?: boolean;
  /** Já há negócio fechado com um profissional: não se prometem propostas. */
  contratado?: boolean;
};

export type RespostaNoPedidoAberto = RespostaDaRecolha & {
  /** Pediu outra coisa: começa-se um pedido novo, com a mensagem dele. */
  novoPedido?: boolean;
  /** Nada de novo para dizer — quem chama dá o ponto de situação de sempre. */
  semNovidade?: boolean;
};

/**
 * O QUE VEM A SEGUIR — as propostas, enquanto não houver negócio fechado. A um
 * trabalho já contratado não se promete proposta nenhuma.
 */
function oQueSegue(ctx: ContextoDoPedidoAberto): string {
  return ctx.contratado ? "" : " As propostas dos profissionais chegam-lhe por aqui.";
}

/**
 * «Tem razão — está tudo no seu pedido #812, com as fotografias. Obrigada!» —
 * ou, quando ainda lhe falta alguma coisa, que só falta isso.
 */
function temRazao(p: PedidoNaConversa, nome: string | null, falta: string, ctx: ContextoDoPedidoAberto): string {
  const a = `Tem razão${nome ? `, ${nome}` : ""}`;
  if (falta) return `${a} — tenho aqui o seu pedido #${p.id}. Só me falta uma coisa:${falta}`;
  return (
    `${a} — está tudo no seu pedido #${p.id}${p.fotos > 0 ? ", com as fotografias" : ""}. Obrigada! ` +
    `A CLYON está a tratar dele.${oQueSegue(ctx)}`
  );
}

/** Só um obrigado, um ok — não há nada a juntar ao pedido. */
function soAgradece(texto: string): boolean {
  return /^(ok(ay)?|okey|certo|combinado|perfeito|obrigad[oa]s?|muito\s+obrigad[oa]|obg|grato|grata|de\s+nada|ate\s+(ja|logo)|bom\s+dia|boa\s+tarde|boa\s+noite|ola|sim|nao)([\s,!.]+(obrigad[oa]|muito\s+obrigad[oa]|cumprimentos))?[\s!.]*$/.test(
    semAcentos(texto),
  );
}

/**
 * A RESPOSTA A QUEM JÁ TEM PEDIDO — pura, como a recolha.
 *
 * Com uma pergunta por fazer (o nome, a morada, o andar, o elevador), é a
 * recolha de sempre a responder, com os dados do pedido: só se pergunta o que
 * falta, e no fim não há resumo — fica tudo no pedido (`fechoDoPedidoAberto`).
 * Sem nada por perguntar, o que ele diz junta-se ao pedido, e a Vitória diz
 * que ficou, com as coisas que percebeu.
 */
export function responderNoPedidoAberto(
  estado: EstadoDaRecolha,
  texto: string,
  agora: Date,
  ctx: ContextoDoPedidoAberto,
): RespostaNoPedidoAberto {
  /*
   * «DO YOU SPEAK ENGLISH?» — «Claro que sim!», e nunca «deixo-a anotada»
   * (28-10-2026, decisão d35). A língua já mudou ao registar a mensagem; o
   * resto da mensagem, se houver, lê-se como sempre.
   */
  if (linguaPedida(texto) != null) {
    const r = responderNoPedidoAberto(estado, semPedidoDeLingua(texto), agora, ctx);
    if (r.pedirPessoa || r.novoPedido) return r;
    return { ...r, resposta: `${CLARO_QUE_SIM} ${r.resposta || EM_QUE_POSSO_AJUDAR}`, semNovidade: false };
  }
  const t = texto.trim();
  const p = ctx.pedido;
  const nome = primeiroNome(estado.dados.contactName) || p.nome || null;
  const imagens = (ctx.imagensNovas ?? 0) > 0;
  /*
   * A ABERTURA: na primeira resposta sobre o pedido, cumprimenta-se por ele —
   * a não ser que um colega (ou ela) já tenha falado dele no fio, e aí
   * continua-se de onde ficou. Depois da pergunta «a qual se refere?», diz-se
   * só qual ficou.
   */
  const abertura = !ctx.primeira
    ? ""
    : ctx.jaDisseOPedido
      ? `Muito bem: o seu pedido #${p.id}${oPedidoEmPalavras(p) ? ` — ${oPedidoEmPalavras(p)}` : ""}.\n\n`
      : ctx.colegaJaFalou
        ? ""
        : `${saudacaoDoPedido(p, nome, ctx.jaSeApresentou)}\n\n`;

  /* ── As palavras que mandam sobre tudo ─────────────────────────────────── */
  if (t) {
    const queixa = entregarQuemSeQueixa(estado, t);
    if (queixa) return queixa;
    if (pedeUmaPessoa(t) || ctx.compreensao?.intencao === "falar_com_pessoa") {
      return { estado, resposta: PASSO_A_ALGUEM_DA_EQUIPA, pedirPessoa: true };
    }
    if (querOutroPedido(t, p.servico) || /^(recomecar|reiniciar|comecar de novo|do inicio)[.!]*$/.test(semAcentos(t))) {
      return { estado, resposta: "", novoPedido: true };
    }
    // Desistir de um pedido que já existe é com a equipa — não é a Vitória que o apaga.
    if (desisteDoPedido(t) || /^cancel(ar|o|e)\b/.test(semAcentos(t))) {
      return {
        estado,
        resposta:
          `${abertura}Compreendo${nome ? `, ${nome}` : ""}. Passo já a conversa a uma pessoa da CLYON, ` +
          `que trata do seu pedido #${p.id} consigo.`,
        pedirPessoa: true,
        motivoDaEntrega: `Quer desistir do pedido #${p.id} — ver a conversa`,
      };
    }
  }

  /*
   * ── Há uma pergunta feita e por responder: a recolha de sempre, com o pedido.
   * Na primeira mensagem ainda não se perguntou nada — o que ele diz junta-se,
   * e pergunta-se a seguir o que faltar.
   */
  const pendente = estado.passo;
  if (t && pendente !== "confirmar" && !ctx.primeira && !jaFezOPedido(t)) {
    const contexto = {
      texto: t,
      jaCumprimentou: true,
      jaDisseQueNaoCompra: ctx.jaDisseQueNaoCompra === true,
      fotos: p.fotos,
      jaExplicouOPreco: ctx.jaExplicouOPreco === true,
      visto: ctx.visto,
      lista: ctx.lista,
    };
    const r = ctx.compreensao
      ? responderComCompreensao(estado, ctx.compreensao, agora, contexto)
      : responderNaRecolha(estado, t, agora, true, ctx.jaDisseQueNaoCompra === true, contexto);
    // Recomeçar, pela recolha, apagava o pedido da conversa: é um pedido novo.
    if (r.estado.dados.pedidoAberto == null) return { estado, resposta: "", novoPedido: true };
    if (r.pedirPessoa) return { ...r, resposta: `${abertura}${r.resposta}` };
    let dados = r.estado.dados;
    let passo: PassoDaRecolha = r.estado.passo;
    let resposta = r.resposta;
    // «Deixa estar», «esquece» a uma pergunta: fica para depois, e segue-se.
    if (r.desistir) {
      dados = { ...estado.dados, saltados: [...new Set([...(estado.dados.saltados ?? []), pendente])] };
      passo = primeiroPassoEmFalta(dados);
      resposta = `Sem problema. ${perguntaDo(passo, dados, false)}`;
    }
    // Um SIM a meio não regista nada: o pedido já existe.
    if (r.registar || !resposta) resposta = perguntaDo(passo, dados, false);
    // Acabou o que faltava: diz-se o que vem a seguir.
    if (passo === "confirmar") resposta += oQueSegue(ctx);
    if (imagens) resposta = comAgradecimentoDasImagens(resposta);
    return { estado: { passo, dados }, resposta: `${abertura}${resposta}` };
  }

  /* ── Nada por perguntar: o que ele disser junta-se ao pedido ──────────── */
  const d: DadosDaRecolha = { ...estado.dados };
  const aprendeu = juntarAoPedidoOQueDisse(d, t, agora, ctx.compreensao?.campos ?? null);
  // O que se viu nas imagens vai para a descrição; o serviço não se adivinha — o pedido já o tem.
  aplicarOQueSeViu(d, ctx.visto, false);
  if (imagens) d.fotosDitas = true;
  const mudou = aprendeu || JSON.stringify(d) !== JSON.stringify(estado.dados);
  const proximo = primeiroPassoEmFalta(d);
  const falta = proximo !== "confirmar" ? ` ${perguntaDo(proximo, d, false)}` : "";
  const fim = (r: string): RespostaNoPedidoAberto => ({ estado: { passo: proximo, dados: d }, resposta: r });

  if (t && (jaFezOPedido(t) || fugiuAoNome(t))) {
    return fim(`${abertura}${temRazao(p, nome, falta, ctx)}`);
  }

  if (imagens && !t) {
    const obrigada = nome ? `Obrigada pelas imagens, ${nome}!` : OBRIGADA_PELAS_IMAGENS;
    const resto = falta || (ctx.primeira ? " Se quiser acrescentar mais algum pormenor, é só dizer-me." : "");
    return fim(`${abertura}${obrigada} Ficam juntas ao seu pedido #${p.id}.${resto}`);
  }

  /*
   * O QUE NÃO É PARA FAZER, tal e qual — «Só não é preciso tirar o
   * frigorífico» (27-10-2026, o #853). Diz-se que ficou com as palavras dele:
   * «fica anotado: frigorífico» dizia o contrário.
   */
  const notasNovas = (d.notas ?? []).filter((n) => !(estado.dados.notas ?? []).includes(n));
  const ficaNoPedido = notasNovas.length > 0 ? ` Fica anotado no seu pedido #${p.id}: «${notasNovas.join(" ")}».` : "";

  /*
   * Perguntou o preço, a hora, se levam o material — responde-se, e segue. E
   * as perguntas de depois do pedido que o site já responde: os vídeos, o que
   * é uma carga, o prazo, o IVA, os contentores, quem faz, como se paga —
   * ver `perguntas-frequentes-da-vitoria.ts` (27-10-2026, decisão d2). E as
   * lições aprovadas pela equipa, e a resposta livre do modelo, antes de a
   * deixar anotada (27-10-2026, decisão d11).
   */
  const frequente = t ? respostaDoSiteOuDasLicoes(t) : null;
  if (t && (frequente || perguntaPeloPreco(t) || eUmaPergunta(t))) {
    const preco = notaDoPrecoPara(t, "confirmar", ctx.jaExplicouOPreco === true, p.servico);
    const outras = respostasAsPerguntas(t, d);
    const principal = frequente ?? (preco ? preco.trim() : null);
    const resposta =
      [principal, outras].filter(Boolean).join(" ") || ctx.compreensao?.resposta || PERGUNTA_ANOTADA;
    return fim(`${abertura}${resposta}${ficaNoPedido}${falta}`);
  }

  if (t && notasNovas.length > 0) {
    const obrigada = imagens ? `Obrigada pelas imagens${nome ? `, ${nome}` : ""}!` : `Obrigada${nome ? `, ${nome}` : ""}!`;
    return fim(`${abertura}${obrigada}${ficaNoPedido}${falta}`);
  }

  if (t && mudou) {
    const itens = itensParaDizer(t);
    const obrigada = imagens
      ? `Obrigada pelas imagens${nome ? `, ${nome}` : ""}! Fica anotado no seu pedido #${p.id}`
      : `Obrigada${nome ? `, ${nome}` : ""}, fica anotado no seu pedido #${p.id}`;
    return fim(`${abertura}${obrigada}${itens ? `: ${itens}` : ""}.${falta}`);
  }

  // Acabou de dizer qual é o pedido: pergunta-se o que falta, ou em que se pode ajudar.
  if (abertura) {
    return fim(
      falta
        ? `${abertura}${falta.trim()}`
        : `${abertura}Em que posso ajudar? Se quiser acrescentar alguma coisa — imagens, a morada ou outros pormenores —, ` +
            `é só dizer-me.${ctx.jaDisseOPedido ? "" : " Se for um pedido novo, diga-me também."}`,
    );
  }

  if (t && soAgradece(t)) {
    return { estado: { passo: proximo, dados: d }, resposta: "", semNovidade: true };
  }

  return { estado: { passo: proximo, dados: d }, resposta: falta.trim(), semNovidade: !falta };
}

/** As coisas que ele disse agora, para lhe mostrar que se percebeu — «1 sofá». */
function itensParaDizer(texto: string): string {
  const d = descricaoOrganizada({ description: texto });
  const linha = (d ?? "").split("\n").find((l) => /^(Para levar|Para transportar|O que referiu):/.test(l));
  return linha ? linha.replace(/^[^:]+:\s*/, "").replace(/\.$/, "") : "";
}

/* ──────────────────────────────────────────────────────────────────────────
 * O QUE SE ESCREVE NO PEDIDO
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * O QUE ESTA CONVERSA ACRESCENTOU — os campos que o pedido não tinha, e o que
 * ele contou. É isto, e só isto, que vai para o bloco da descrição: o que o
 * pedido já dizia não se repete.
 */
export function oQueEDaConversa(doPedido: DadosDaRecolha, depois: DadosDaRecolha): DadosDaRecolha {
  const novos: DadosDaRecolha = { serviceType: depois.serviceType, contactName: depois.contactName };
  const campos = ["floor", "lado", "hasElevator", "parkingDistance"] as const;
  for (const k of campos) {
    if (doPedido[k] === undefined && depois[k] !== undefined) (novos as Record<string, unknown>)[k] = depois[k];
  }
  const daConversa = [
    "description",
    "volumeDito",
    "clienteCarrega",
    "acessoDito",
    "quandoTexto",
    "dataDesejada",
    "fotosDitas",
    "entulhoQuantidade",
    "notas",
  ] as const;
  for (const k of daConversa) {
    if (depois[k] !== undefined && depois[k] !== null) (novos as Record<string, unknown>)[k] = depois[k];
  }
  return novos;
}

/** Os campos do pedido que estavam vazios e a conversa preencheu — nunca por cima do que lá está. */
export function camposParaOPedido(
  p: PedidoDaBase,
  depois: DadosDaRecolha,
): Partial<Record<"contactName" | "address" | "city" | "postalCode" | "floor" | "hasElevator" | "parkingDistance", string>> {
  const out: Partial<Record<"contactName" | "address" | "city" | "postalCode" | "floor" | "hasElevator" | "parkingDistance", string>> = {};
  const vazio = (v: unknown) => !limpo(v);
  const nome = limpo(depois.contactName);
  if (nome && (vazio(p.contactName) || SEM_NOME.test(limpo(p.contactName)))) out.contactName = nome.slice(0, 120);
  if (vazio(p.address) && limpo(depois.address)) out.address = limpo(depois.address);
  if (vazio(p.city) && limpo(depois.city)) out.city = limpo(depois.city);
  if (vazio(p.postalCode) && limpo(depois.postalCode)) out.postalCode = limpo(depois.postalCode);
  if (vazio(p.floor)) {
    const andar = andarComLado(depois);
    if (andar) out.floor = andar;
  }
  if (vazio(p.hasElevator) && ["yes", "no", "small"].includes(String(depois.hasElevator))) {
    out.hasElevator = String(depois.hasElevator);
  }
  // Como no formulário do backoffice: «easy» e «difficult» (ver `camposDaRecolha`).
  if (vazio(p.parkingDistance) && (depois.parkingDistance === "near" || depois.parkingDistance === "far")) {
    out.parkingDistance = depois.parkingDistance === "near" ? "easy" : "difficult";
  }
  return out;
}

/** O cabeçalho do que a conversa acrescentou à descrição do pedido. */
export const CABECA_DO_BLOCO = "Acrescentado pelo cliente no WhatsApp:";

/** O bloco da descrição com o que a conversa trouxe — arrumado como o resto (`descricaoOrganizada`). */
export function blocoDoWhatsApp(novos: DadosDaRecolha, fotos: number): string | null {
  const corpo = descricaoOrganizada(novos, { fotos });
  return corpo ? `${CABECA_DO_BLOCO}\n${corpo}` : null;
}

/**
 * A DESCRIÇÃO DO PEDIDO COM O BLOCO — por baixo da que lá estava, que fica
 * como estava. O bloco que a Vitória escreveu antes TROCA-SE pelo novo, se
 * ainda estiver no fim; se alguém mexeu na descrição entretanto, junta-se
 * outro por baixo — nunca se apaga o que a equipa escreveu.
 */
export function descricaoComOBloco(
  atual: string | null | undefined,
  blocoAnterior: string | null | undefined,
  bloco: string,
): string {
  const cur = limpo(atual);
  const anterior = limpo(blocoAnterior);
  if (anterior && cur.endsWith(anterior)) {
    const base = cur.slice(0, cur.length - anterior.length).trimEnd();
    return base ? `${base}\n\n${bloco}` : bloco;
  }
  if (cur.includes(bloco)) return cur;
  return cur ? `${cur}\n\n${bloco}` : bloco;
}
