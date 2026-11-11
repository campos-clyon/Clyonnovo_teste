import {
  MATERIAIS,
  congelarTarifa,
  valorDaMudanca,
  type ContaDaMudanca,
  type QuantidadeDoMaterial,
  type RegrasDaConta,
  type TarifaCongelada,
  type TarifaDasMudancas,
} from "./conta-da-mudanca";
import { HORAS_POR_TIPOLOGIA, TIPOLOGIA_POR_EXTENSO, type Tipologia } from "./tabela-das-mudancas";
import { avaliarElegibilidade, type ProfissionalParaAvaliar } from "./profissional-elegivel";
import type { FormaDePagamento } from "./forma-de-pagamento";
import { SELO_DO_CARTAO } from "./parceiro-verificado";
import { formatarEuros } from "./formatar-euros";

/**
 * A LISTA DOS PARCEIROS DE UMA MUDANÇA — 10-11-2026 (fase 2).
 *
 * Decisões do dono: as mudanças fazem-se ao preço de cada parceiro; no fim do
 * pedido de mudança o cliente vê a LISTA dos que estão disponíveis e escolhe a
 * quem pede orçamento (até 3); o pedido vai logo aos escolhidos, sem a análise
 * da CLYON; a tarifa de cada um congela-se no pedido no momento da escolha.
 *
 * Esta lib é PURA (sem base, sem rede): a rota pública da lista, a rota do
 * pedido (que volta a conferir a escolha) e a app de cliente vêem a mesma
 * conta, e os testes fazem-na sem servidor. Os números e os textos que o
 * cliente lê saem daqui — a app não faz contas.
 *
 * Tudo em cêntimos, inteiros, como em `conta-da-mudanca.ts`.
 */

/** No máximo a quantos parceiros se pede orçamento de uma vez. */
export const MAXIMO_DE_ESCOLHIDOS = 3;

/** Com quantas avaliações a nota aparece. Antes disso, «Novo na CLYON». */
export const AVALIACOES_PARA_A_NOTA = 3;

/* ── A NOTA DO GOOGLE — 11-11-2026 ────────────────────────────────────────────
 * Vem da ficha do Google CONFIRMADA por um administrador (ficha-no-google.ts),
 * pedida no momento e nunca guardada na base. Fica SEPARADA da nota da CLYON:
 * nunca uma média das duas. Com menos de 5 avaliações no Google, não aparece.
 * A atribuição vai sempre com ela (termos da Google Maps Platform: dados do
 * Google fora de um mapa do Google levam «Google Maps»). */
export const AVALIACOES_PARA_A_NOTA_DO_GOOGLE = 5;
export const ATRIBUICAO_DO_GOOGLE = "Google Maps";

export type NotaDoGoogleNoCartao = { media: number; avaliacoes: number; texto: string; atribuicao: string };

/** «4,6 no Google (230 avaliações)», ou null (sem resposta, valores estranhos, menos de 5 avaliações). */
export function notaDoGoogleNoCartao(
  n: { rating: number; userRatingCount: number } | null | undefined,
): NotaDoGoogleNoCartao | null {
  if (!n) return null;
  const { rating, userRatingCount } = n;
  if (typeof rating !== "number" || !Number.isFinite(rating) || rating < 1 || rating > 5) return null;
  if (!Number.isInteger(userRatingCount) || userRatingCount < AVALIACOES_PARA_A_NOTA_DO_GOOGLE) return null;
  const media = Math.round(rating * 10) / 10;
  const mediaEmTexto = media.toFixed(1).replace(".", ",");
  // Milhares com espaço a partir de 10 000, como em pt-PT (sem depender do Intl do telemóvel).
  const quantas = userRatingCount >= 10000 ? String(userRatingCount).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : String(userRatingCount);
  return {
    media,
    avaliacoes: userRatingCount,
    texto: `${mediaEmTexto} no Google (${quantas} avaliações)`,
    atribuicao: ATRIBUICAO_DO_GOOGLE,
  };
}

export type Pessoas = 2 | 3;

export function lerPessoas(v: unknown): Pessoas | null {
  const n = typeof v === "string" ? Number(v) : v;
  return n === 2 || n === 3 ? n : null;
}

export function lerTipologia(v: unknown): Tipologia | null {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(HORAS_POR_TIPOLOGIA, v) ? (v as Tipologia) : null;
}

/* ── AS HORAS ─────────────────────────────────────────────────────────────── */

/** A tabela das horas é para 3 pessoas; com 2, quatro terços (arredondado à meia hora, para cima). */
const FACTOR_DE_DUAS_PESSOAS = 4 / 3;
/** Desmontar e montar acrescenta uma hora, com 2 ou com 3. */
export const HORAS_DA_DESMONTAGEM = 1;

const meiaHoraAcima = (h: number) => Math.ceil(h * 2 - 1e-9) / 2;

/**
 * As horas habituais para esta casa, com esta equipa — antes do mínimo de
 * cada parceiro. 3 pessoas: a tabela; 2 pessoas: × 4/3 à meia hora acima.
 * Mais a desmontagem. Sem tipologia, conta-se a casa mais pequena.
 */
export function horasDaMudanca(tipologia: Tipologia | null, desmontagem: boolean, pessoas: Pessoas): number {
  const base = HORAS_POR_TIPOLOGIA[tipologia ?? "itens"];
  const daEquipa = pessoas === 3 ? base : meiaHoraAcima(base * FACTOR_DE_DUAS_PESSOAS);
  return daEquipa + (desmontagem ? HORAS_DA_DESMONTAGEM : 0);
}

/** As horas deste parceiro: as habituais, nunca abaixo do mínimo dele. */
export function horasDoParceiro(horas: number, minimoHoras: number): number {
  return Math.max(horas, minimoHoras);
}

/** Recomendação: em T3 ou maior, 3 pessoas. */
export function recomendaTresPessoas(tipologia: Tipologia | null): boolean {
  return tipologia === "T3" || tipologia === "T4+";
}

/* ── O KIT POR ALTO ──────────────────────────────────────────────────────────
 * As quantidades de referência de material, por tipologia — num só sítio. É
 * «por alto»: o cliente pode precisar de mais ou de menos, e o valor final
 * conta o que se gastou. As chaves são as da tabela MATERIAIS. */
export const KIT_POR_TIPOLOGIA: Readonly<Record<Tipologia, Readonly<Partial<Record<QuantidadeDoMaterial, number>>>>> =
  Object.freeze({
    itens: Object.freeze({ filmeRolos: 1 }),
    T0: Object.freeze({ caixas: 10, filmeRolos: 1 }),
    T1: Object.freeze({ caixas: 10, filmeRolos: 1 }),
    T2: Object.freeze({ caixas: 20, filmeRolos: 2, plasticoBolhaRolos: 1 }),
    T3: Object.freeze({ caixas: 30, filmeRolos: 3, plasticoBolhaRolos: 1, cartaoMetros: 10 }),
    "T4+": Object.freeze({ caixas: 40, filmeRolos: 4, plasticoBolhaRolos: 2, cartaoMetros: 20 }),
  });

/* ── O QUE O CLIENTE PAGA, DE UM VALOR DO PARCEIRO ───────────────────────── */

/** O IVA sobre um valor sem IVA, em cêntimos. */
const comIva = (cent: number, regras: RegrasDaConta) => cent + Math.round(cent * regras.iva);

/**
 * Um preço do parceiro (cêntimos sem IVA), como o cliente o paga: a taxa por
 * cima se for «por_cima» (só nas horas e nos km), e o IVA.
 */
export function aoCliente(cent: number, regras: RegrasDaConta, levaTaxa: boolean): { semIvaCent: number; comIvaCent: number } {
  const semIva = levaTaxa && regras.modo === "por_cima" ? cent + Math.round(cent * regras.taxa) : cent;
  return { semIvaCent: semIva, comIvaCent: comIva(semIva, regras) };
}

const eur = (cent: number) => formatarEuros(cent / 100);
const horasEmTexto = (h: number) => (Number.isInteger(h) ? String(h) : String(h).replace(".", ","));

/** «61,50 € com IVA (50,00 € sem IVA)» — o com IVA à frente e o sem IVA nunca sozinho. */
export function valorEmTexto(v: { semIvaCent: number; comIvaCent: number }, sufixo = ""): string {
  return `${eur(v.comIvaCent)}${sufixo} com IVA (${eur(v.semIvaCent)}${sufixo} sem IVA)`;
}

/* ── OS CANDIDATOS E A ELEGIBILIDADE ─────────────────────────────────────── */

/** Um parceiro como a base o devolve para a lista: o perfil, a tarifa, a nota. */
export type CandidatoDaMudanca = ProfissionalParaAvaliar & {
  nome: string;
  contaDeTeste: boolean;
  verificado: boolean;
  fotografia: string | null;
  tarifa: TarifaDasMudancas | null;
  /** A média das avaliações que contam (avaliacao-que-conta.ts), e quantas são. */
  notaMedia: number | null;
  avaliacoes: number;
};

export type ContextoDaMudanca = {
  tipologia: Tipologia | null;
  desmontagem: boolean;
  pessoas: Pessoas;
  /** Km do percurso, origem → destino. */
  kmPercurso: number;
  formaDePagamento: FormaDePagamento;
  /** A cidade da origem (para quando não há distância medida). */
  cidade: string | null;
};

export type MotivoForaDaLista =
  | "nao_elegivel"
  | "conta_de_teste"
  | "sem_tarifa"
  | "fora_da_lista"
  | "longe_demais"
  | "sem_equipa_de_3";

/**
 * Este parceiro entra na lista? A elegibilidade COMPLETA de sempre (aprovado,
 * activo, categoria, raio pela base, dívida num pedido em dinheiro) mais o que
 * é só da lista: não ser conta de teste, ter tarifa com «aparecer na lista»,
 * aceitar a distância do percurso e, com 3 pessoas, fazer com 3.
 *
 * `distanciaKm` é a da base dele à ORIGEM (é aí que ele vai primeiro).
 */
export function porqueFicaDeFora(
  c: CandidatoDaMudanca,
  distanciaKm: number | null,
  ctx: ContextoDaMudanca,
): MotivoForaDaLista | null {
  if (c.contaDeTeste) return "conta_de_teste";
  const r = avaliarElegibilidade(
    {
      serviceType: "mudanca",
      precisaFatura: false,
      precisaGuiaTransporte: false,
      formaDePagamento: ctx.formaDePagamento,
      distanciaKm,
      city: ctx.cidade,
    },
    c,
  );
  if (!r.elegivel) return "nao_elegivel";
  if (!c.tarifa) return "sem_tarifa";
  if (!c.tarifa.aparecerNaLista) return "fora_da_lista";
  if (!(c.tarifa.kmMaximo >= ctx.kmPercurso)) return "longe_demais";
  if (ctx.pessoas === 3 && c.tarifa.precoHora3 == null) return "sem_equipa_de_3";
  return null;
}

/* ── O CARTÃO ─────────────────────────────────────────────────────────────── */

export type ValorAoCliente = { semIvaCent: number; comIvaCent: number; texto: string };

export type CartaoDoParceiro = {
  /** Opaco: é este que volta no `parceirosEscolhidos` do pedido. */
  id: string;
  nome: string;
  verificado: boolean;
  /** «Parceiro verificado», ou null. */
  selo: string | null;
  nota: { media: number; avaliacoes: number; texto: string } | null;
  /** «Novo na CLYON» quando ainda não tem as avaliações para a nota. */
  novo: string | null;
  /** A nota do Google (ficha confirmada por um administrador), separada da da CLYON; null sem ela. */
  notaGoogle: NotaDoGoogleNoCartao | null;
  fotografia: string | null;
  precoHora: { 2: ValorAoCliente; 3: ValorAoCliente | null };
  fazComTres: boolean;
  minimoHoras: number;
  minimoTexto: string;
  materiais: Array<{ chave: string; nome: string; unidade: string } & ValorAoCliente>;
  kit: {
    linhas: Array<{ nome: string; quantidade: number; unidade: string } & ValorAoCliente>;
    /** O que o kit levaria e este parceiro não fornece. */
    naoFornece: string[];
    total: ValorAoCliente | null;
    texto: string;
  };
  horas: number;
  horasTexto: string;
  km: number;
  /** Horas + km, sem material — é por esta que se ordena. */
  estimativa: ValorAoCliente;
  /** A mesma, com o kit por alto. */
  estimativaComKit: ValorAoCliente;
};

function pluralDaUnidade(unidade: string, n: number): string {
  if (n === 1) return unidade;
  return unidade === "metro" ? "metros" : `${unidade}s`;
}

const KIT_NOMES: Record<QuantidadeDoMaterial, string> = {
  caixas: "caixa",
  cartaoMetros: "metro de cartão",
  filmeRolos: "rolo de filme",
  plasticoBolhaRolos: "rolo de plástico bolha",
};
const KIT_NOMES_PLURAL: Record<QuantidadeDoMaterial, string> = {
  caixas: "caixas",
  cartaoMetros: "metros de cartão",
  filmeRolos: "rolos de filme",
  plasticoBolhaRolos: "rolos de plástico bolha",
};

function contaParaTexto(c: ContaDaMudanca): { semIvaCent: number; comIvaCent: number } {
  return { semIvaCent: c.semIvaCent, comIvaCent: c.totalCent };
}

/**
 * O cartão de UM parceiro elegível, com a tarifa congelada agora (é a mesma
 * conta que fica no pedido se o cliente o escolher). Null se a conta não fechar.
 */
export function cartaoDoParceiro(
  c: CandidatoDaMudanca & { tarifa: TarifaDasMudancas },
  ctx: ContextoDaMudanca,
  id: string,
  agora: Date = new Date(),
): CartaoDoParceiro | null {
  const t: TarifaCongelada = congelarTarifa(c.tarifa, undefined, agora);
  const regras = t.regras;
  const horas = horasDoParceiro(horasDaMudanca(ctx.tipologia, ctx.desmontagem, ctx.pessoas), t.minimoHoras);

  const conta = valorDaMudanca(t, { pessoas: ctx.pessoas, horas, km: ctx.kmPercurso });
  if (!conta.ok) return null;

  // O kit por alto, só com o que ele fornece.
  const kit = KIT_POR_TIPOLOGIA[ctx.tipologia ?? "itens"];
  const materiaisDoKit: Partial<Record<QuantidadeDoMaterial, number>> = {};
  const naoFornece: string[] = [];
  for (const m of MATERIAIS) {
    const q = kit[m.quantidade];
    if (!q) continue;
    if (t.materiaisCent[m.chave] == null) naoFornece.push(m.nome);
    else materiaisDoKit[m.quantidade] = q;
  }
  const comKit = valorDaMudanca(t, { pessoas: ctx.pessoas, horas, km: ctx.kmPercurso, materiais: materiaisDoKit });
  if (!comKit.ok) return null;

  const hora = (cent: number | null): ValorAoCliente | null => {
    if (cent == null) return null;
    const v = aoCliente(cent, regras, true);
    return { ...v, texto: valorEmTexto(v, "/h") };
  };

  const materiais = MATERIAIS.flatMap((m) => {
    const cent = t.materiaisCent[m.chave];
    if (cent == null) return [];
    const v = aoCliente(cent, { ...regras, iva: regras.materialComIva ? regras.iva : 0 }, false);
    return [{ chave: m.chave, nome: m.nome, unidade: m.unidade, ...v, texto: `${valorEmTexto(v)} por ${m.unidade}` }];
  });

  const linhasDoKit = comKit.materiais.linhas.map((l) => {
    const semIvaCent = l.cent;
    const comIvaCent = regras.materialComIva ? comIva(l.cent, regras) : l.cent;
    return { nome: l.nome, quantidade: l.quantidade, unidade: l.unidade, semIvaCent, comIvaCent, texto: valorEmTexto({ semIvaCent, comIvaCent }) };
  });
  const totalDoKit =
    linhasDoKit.length > 0
      ? (() => {
          const semIvaCent = comKit.materiais.cent;
          const comIvaCent = comKit.totalCent - conta.totalCent;
          return { semIvaCent, comIvaCent, texto: valorEmTexto({ semIvaCent, comIvaCent }) };
        })()
      : null;
  const partesDoKit = (Object.keys(materiaisDoKit) as QuantidadeDoMaterial[]).map((k) => {
    const q = materiaisDoKit[k] as number;
    return `${q} ${q === 1 ? KIT_NOMES[k] : KIT_NOMES_PLURAL[k]}`;
  });
  const tipoNoTexto = ctx.tipologia ? TIPOLOGIA_POR_EXTENSO[ctx.tipologia] : TIPOLOGIA_POR_EXTENSO.itens;
  const textoDoKit =
    partesDoKit.length > 0 && totalDoKit
      ? `Material por alto para ${ctx.tipologia === "itens" || !ctx.tipologia ? tipoNoTexto : `um ${tipoNoTexto}`}: ${partesDoKit.join(", ")} — ${totalDoKit.texto}`
      : "Este parceiro não fornece o material de embalagem.";

  const temNota = c.notaMedia != null && c.avaliacoes >= AVALIACOES_PARA_A_NOTA;
  const media = temNota ? Math.round((c.notaMedia as number) * 10) / 10 : 0;

  const estimativa = contaParaTexto(conta);
  const estimativaComKit = contaParaTexto(comKit);
  const p3 = hora(t.precoHora3Cent);

  return {
    id,
    nome: c.nome,
    verificado: c.verificado,
    selo: c.verificado ? SELO_DO_CARTAO : null,
    nota: temNota
      ? { media, avaliacoes: c.avaliacoes, texto: `${String(media).replace(".", ",")} em 5 · ${c.avaliacoes} avaliações` }
      : null,
    novo: temNota ? null : NOVO_NA_CLYON,
    notaGoogle: null,
    fotografia: c.fotografia,
    precoHora: { 2: hora(t.precoHora2Cent) as ValorAoCliente, 3: p3 },
    fazComTres: p3 != null,
    minimoHoras: t.minimoHoras,
    minimoTexto: `Mínimo de ${horasEmTexto(t.minimoHoras)} ${t.minimoHoras === 1 ? "hora" : "horas"}`,
    materiais,
    kit: { linhas: linhasDoKit, naoFornece, total: totalDoKit, texto: textoDoKit },
    horas,
    horasTexto: `Cerca de ${horasEmTexto(horas)} h com ${ctx.pessoas} pessoas`,
    km: ctx.kmPercurso,
    estimativa: { ...estimativa, texto: valorEmTexto(estimativa) },
    estimativaComKit: { ...estimativaComKit, texto: valorEmTexto(estimativaComKit) },
  };
}

/* ── A ORDEM ──────────────────────────────────────────────────────────────── */

/**
 * Os parâmetros da ordem, para a frase «Como ordenamos» (DL 109-G/2021: o
 * cliente tem de saber os principais parâmetros que decidem a ordem). Nenhum
 * parceiro paga para aparecer mais acima — não existe esse parâmetro.
 */
export const ORDENACAO = Object.freeze({
  criterio: "estimativa_total_crescente" as const,
  desempate: "nota_clyon_decrescente" as const,
  pago: false as const,
  titulo: "Como ordenamos",
  frase:
    "Ordenamos pela estimativa (horas e quilómetros, sem o material), do valor mais baixo para o mais alto; " +
    "em caso de empate, pela nota dada na CLYON por clientes de trabalhos feitos e confirmados. " +
    "Nenhum parceiro paga para aparecer mais acima.",
});

export function ordenarCartoes(cartoes: CartaoDoParceiro[]): CartaoDoParceiro[] {
  return [...cartoes].sort((a, b) => {
    const d = a.estimativa.comIvaCent - b.estimativa.comIvaCent;
    if (d !== 0) return d;
    const na = a.nota?.media ?? -1;
    const nb = b.nota?.media ?? -1;
    if (na !== nb) return nb - na;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/* ── OS TEXTOS DO ECRÃ ────────────────────────────────────────────────────── */

export const NOVO_NA_CLYON = "Novo na CLYON";

export const TEXTOS_DA_LISTA = Object.freeze({
  titulo: "Parceiros disponíveis para a sua mudança",
  escolha: `Escolha até ${MAXIMO_DE_ESCOLHIDOS} parceiros. O pedido vai logo aos que escolher, com os preços que vê aqui.`,
  recomendaTres: "Para T3 ou maior recomendamos 3 pessoas.",
  semParceiros: "Ainda não temos parceiros de mudanças com preço para esta zona.",
  semParceirosSegue: "Pode enviar o pedido na mesma: a CLYON procura parceiros da sua zona e as propostas chegam-lhe por aqui.",
  procurarMais: "Pedir também à CLYON que procure mais parceiros",
  botao: "Pedir orçamento",
  notaDaEstimativa:
    "Estimativa com os preços de cada parceiro, para as horas habituais numa casa como a sua e o percurso entre as duas moradas. " +
    "O valor final conta as horas feitas, os quilómetros e o material que usar.",
  quemFaz: "O trabalho é feito pelo parceiro que escolher.",
});

/** «T2 · Seixal → Almada · cerca de 5,5 h com 2 pessoas» */
export function resumoDaMudanca(
  tipologia: Tipologia | null,
  origem: string | null,
  destino: string | null,
  horas: number,
  pessoas: Pessoas,
): string {
  const tipo = TIPOLOGIA_POR_EXTENSO[tipologia ?? "itens"];
  const tipoComMaiuscula = tipo.charAt(0).toUpperCase() + tipo.slice(1);
  const caminho = origem && destino ? `${origem} → ${destino}` : origem || destino || null;
  return [tipoComMaiuscula, caminho, `cerca de ${horasEmTexto(horas)} h com ${pessoas} pessoas`].filter(Boolean).join(" · ");
}
