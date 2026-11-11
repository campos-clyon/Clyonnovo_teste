import { AJUDA_DO_PROCURAR_MAIS, LINHA_DAS_3_HORAS } from "./escolhidos-sem-resposta";
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
import {
  EMBALAMENTO_POR_TIPOLOGIA,
  METROS_POR_ROLO_DE_CARTAO,
  NOTA_DO_T4_OU_MAIOR,
  PEDIR_EMBALAMENTO,
  PROTECAO_POR_TIPOLOGIA,
  SO_COM_TRES_PESSOAS,
  TIPOLOGIAS,
  TIPOLOGIA_POR_EXTENSO,
  horasEscritas,
  intervaloDeHoras,
  intervaloDeHorasEmTexto,
  meioDoIntervalo,
  pessoasParaACasa,
  soComTresPessoas,
  type IntervaloDeHoras,
  type QuantidadesDeMaterial,
  type Tipologia,
} from "./tabela-das-mudancas";
import { avaliarElegibilidade, type ProfissionalParaAvaliar } from "./profissional-elegivel";
import type { FormaDePagamento } from "./forma-de-pagamento";
import { SELO_DO_CARTAO } from "./parceiro-verificado";
import { formatarEuros } from "./formatar-euros";
import { REFERENCIA_DA_MUDANCA } from "./modelo-da-mudanca";

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
  return typeof v === "string" && (TIPOLOGIAS as readonly string[]).includes(v) ? (v as Tipologia) : null;
}

/* ── AS HORAS — em intervalo, pela tabela (11-11-2026) ───────────────────────
 * As horas saem de `tabela-das-mudancas.ts` (`intervaloDeHoras`): com 3 e com
 * 2 pessoas, mais a desmontagem por tipologia. Num T3 ou maior só há equipa
 * de 3: pedir 2 conta como 3 (`pessoasParaACasa`). Eram × 4/3 de um número
 * só, com 1 h a mais na desmontagem. */

/** As horas habituais para esta casa, com esta equipa — antes do mínimo de cada parceiro. */
export function horasDaMudanca(tipologia: Tipologia | null, desmontagem: boolean, pessoas: Pessoas): IntervaloDeHoras {
  return intervaloDeHoras(tipologia, desmontagem, pessoasParaACasa(tipologia, pessoas), 0);
}

/** As horas deste parceiro: as habituais, nos dois extremos, nunca abaixo do mínimo dele. */
export function horasDoParceiro(horas: IntervaloDeHoras, minimoHoras: number): IntervaloDeHoras {
  return [Math.max(horas[0], minimoHoras), Math.max(horas[1], minimoHoras)];
}

/** Em T3 ou maior, só 3 pessoas. */
export function recomendaTresPessoas(tipologia: Tipologia | null): boolean {
  return soComTresPessoas(tipologia);
}

/** «Num T3 ou maior a mudança faz-se com 3 pessoas…», com a nota do T4 ou maior; null nas outras casas. */
export function avisoDaEquipa(tipologia: Tipologia | null): string | null {
  if (!soComTresPessoas(tipologia)) return null;
  return tipologia === "T4+" ? `${SO_COM_TRES_PESSOAS} ${NOTA_DO_T4_OU_MAIOR}` : SO_COM_TRES_PESSOAS;
}

/* ── O MATERIAL, NAS UNIDADES DA TARIFA ──────────────────────────────────────
 * A proteção (por omissão) e o embalamento completo (se o cliente o pedir)
 * estão em `tabela-das-mudancas.ts`, com o cartão em rolos; a tarifa dos
 * parceiros conta o cartão em metros (`METROS_POR_ROLO_DE_CARTAO` por rolo). */
export function quantidadesNaTarifa(q: QuantidadesDeMaterial | null | undefined): Partial<Record<QuantidadeDoMaterial, number>> {
  const r: Partial<Record<QuantidadeDoMaterial, number>> = {};
  if (!q) return r;
  if (q.caixas) r.caixas = q.caixas;
  if (q.filmeRolos) r.filmeRolos = q.filmeRolos;
  if (q.cartaoRolos) r.cartaoMetros = q.cartaoRolos * METROS_POR_ROLO_DE_CARTAO;
  if (q.plasticoBolhaRolos) r.plasticoBolhaRolos = q.plasticoBolhaRolos;
  return r;
}

/** A proteção de cada tipologia, nas unidades da tarifa. */
export const KIT_POR_TIPOLOGIA: Readonly<Record<Tipologia, Readonly<Partial<Record<QuantidadeDoMaterial, number>>>>> = Object.freeze(
  Object.fromEntries(TIPOLOGIAS.map((t) => [t, Object.freeze(quantidadesNaTarifa(PROTECAO_POR_TIPOLOGIA[t]))])) as Record<
    Tipologia,
    Readonly<Partial<Record<QuantidadeDoMaterial, number>>>
  >,
);

/** O embalamento completo de cada tipologia, nas unidades da tarifa (vazio em alguns móveis). */
export const EMBALAMENTO_NA_TARIFA: Readonly<Record<Tipologia, Readonly<Partial<Record<QuantidadeDoMaterial, number>>>>> = Object.freeze(
  Object.fromEntries(TIPOLOGIAS.map((t) => [t, Object.freeze(quantidadesNaTarifa(EMBALAMENTO_POR_TIPOLOGIA[t]))])) as Record<
    Tipologia,
    Readonly<Partial<Record<QuantidadeDoMaterial, number>>>
  >,
);

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
  if (pessoasParaACasa(ctx.tipologia, ctx.pessoas) === 3 && c.tarifa.precoHora3 == null) return "sem_equipa_de_3";
  return null;
}

/* ── O CARTÃO ─────────────────────────────────────────────────────────────── */

export type ValorAoCliente = { semIvaCent: number; comIvaCent: number; texto: string };

/** Uma estimativa em intervalo: os dois extremos e, nos campos de cima, o MEIO (é por ele que se ordena). */
export type EstimativaAoCliente = ValorAoCliente & {
  minimo: { semIvaCent: number; comIvaCent: number };
  maximo: { semIvaCent: number; comIvaCent: number };
};

export type MaterialDoCartao = {
  linhas: Array<{ nome: string; quantidade: number; unidade: string } & Omit<ValorAoCliente, never>>;
  /** O que este nível levaria e este parceiro não fornece. */
  naoFornece: string[];
  total: ValorAoCliente | null;
  texto: string;
};

export type CartaoDoParceiro = {
  /** Opaco: é este que volta no `parceirosEscolhidos` do pedido. */
  id: string;
  /**
   * A assinatura do preço mostrado (11-11-2026): quem a põe é o servidor
   * (parceiros-da-mudanca.ts) e o pedido devolve-a em `assinaturasDoPreco`,
   * por id. Se o parceiro mudou o preço entretanto, a escolha não se grava.
   */
  assinatura?: string;
  nome: string;
  verificado: boolean;
  /** «Parceiro verificado», ou null. */
  selo: string | null;
  nota: { media: number; avaliacoes: number; texto: string } | null;
  /** «Novo na CLYON» quando ainda não tem as avaliações para a nota. */
  novo: string | null;
  /** A nota do Google (ficha confirmada por um administrador), separada da da CLYON; null sem ela. */
  notaGoogle: NotaDoGoogleNoCartao | null;
  /**
   * Sempre null (11-11-2026): as fotografias da carrinha são só para a equipa —
   * ao parceiro dizemos «O cliente não as vê». O campo fica para a app de
   * cliente publicada, que o lê.
   */
  fotografia: null;
  /**
   * O preço da hora com 2 e com 3 pessoas. Numa casa que só se faz com 3 (T3
   * ou maior), o «2» leva o MESMO valor do «3»: a app de cliente publicada
   * antes de 11-11-2026 mostra sempre o «2» quando o cliente não mudou a
   * equipa, e assim mostra o preço com que a conta foi feita.
   */
  precoHora: { 2: ValorAoCliente; 3: ValorAoCliente | null };
  fazComTres: boolean;
  /** A equipa com que a conta foi feita (3 numa casa que só se faz com 3). */
  pessoas: Pessoas;
  minimoHoras: number;
  minimoTexto: string;
  materiais: Array<{ chave: string; nome: string; unidade: string } & ValorAoCliente>;
  /** A PROTEÇÃO (por omissão, já na estimativa). `kit` é o nome de antes, para a app publicada. */
  kit: MaterialDoCartao;
  protecao: MaterialDoCartao;
  /** As caixas e o embalamento completo, só se o cliente o pedir; null em alguns móveis. */
  embalamento: MaterialDoCartao | null;
  /** O meio do intervalo (cabe num número só). */
  horas: number;
  horasMinimo: number;
  horasMaximo: number;
  horasTexto: string;
  km: number;
  /** Horas + km + a proteção — é pelo meio desta que se ordena. */
  estimativa: EstimativaAoCliente;
  /** A mesma, com as caixas e o embalamento; null quando não há (alguns móveis, ou ele não fornece). */
  estimativaComEmbalamento: EstimativaAoCliente | null;
  /** Para a app publicada antes de 11-11-2026 («Com o kit: …»): a do embalamento, ou a estimativa. */
  estimativaComKit: EstimativaAoCliente;
};

const NOMES_NO_KIT: Record<QuantidadeDoMaterial, [um: string, varios: string]> = {
  caixas: ["caixa", "caixas"],
  cartaoMetros: ["metro de cartão", "metros de cartão"],
  filmeRolos: ["rolo de filme", "rolos de filme"],
  plasticoBolhaRolos: ["rolo de plástico bolha", "rolos de plástico bolha"],
};

const FORMATO_INTEIRO = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0, minimumFractionDigits: 0 });
const eurInteiro = (cent: number) => FORMATO_INTEIRO.format(Math.round(cent / 100));
/** «544–668 €» — ao euro, que é uma estimativa; um valor só quando os dois arredondam ao mesmo. */
function faixaEmEuros(minCent: number, maxCent: number): string {
  const a = eurInteiro(minCent);
  const b = eurInteiro(maxCent);
  return a === b ? a : `${a.replace(/\s*€$/, "")}–${b}`;
}

/** «544–668 € com IVA (442–543 € sem IVA)» — o com IVA à frente, o sem IVA nunca sozinho. */
export function faixaEmTexto(min: { semIvaCent: number; comIvaCent: number }, max: { semIvaCent: number; comIvaCent: number }): string {
  return `${faixaEmEuros(min.comIvaCent, max.comIvaCent)} com IVA (${faixaEmEuros(min.semIvaCent, max.semIvaCent)} sem IVA)`;
}

function estimativaEmIntervalo(
  min: ContaDaMudanca,
  max: ContaDaMudanca,
  texto: (faixa: string) => string,
): EstimativaAoCliente {
  const a = contaParaTexto(min);
  const b = contaParaTexto(max);
  return {
    semIvaCent: Math.round((a.semIvaCent + b.semIvaCent) / 2),
    comIvaCent: Math.round((a.comIvaCent + b.comIvaCent) / 2),
    minimo: a,
    maximo: b,
    texto: texto(faixaEmTexto(a, b)),
  };
}

function contaParaTexto(c: ContaDaMudanca): { semIvaCent: number; comIvaCent: number } {
  return { semIvaCent: c.semIvaCent, comIvaCent: c.totalCent };
}

/** As quantidades de um nível que este parceiro fornece, e os nomes do que não fornece. */
function oQueFornece(
  t: TarifaCongelada,
  q: Readonly<Partial<Record<QuantidadeDoMaterial, number>>>,
): { fornece: Partial<Record<QuantidadeDoMaterial, number>>; naoFornece: string[] } {
  const fornece: Partial<Record<QuantidadeDoMaterial, number>> = {};
  const naoFornece: string[] = [];
  for (const m of MATERIAIS) {
    const n = q[m.quantidade];
    if (!n) continue;
    if (t.materiaisCent[m.chave] == null) naoFornece.push(m.nome);
    else fornece[m.quantidade] = n;
  }
  return { fornece, naoFornece };
}

/** O material de um nível no cartão: as linhas, o total e a frase. */
function materialDoCartao(
  t: TarifaCongelada,
  regras: RegrasDaConta,
  fornece: Partial<Record<QuantidadeDoMaterial, number>>,
  naoFornece: string[],
  rotulo: string,
  semNada: string,
): MaterialDoCartao {
  const linhas = MATERIAIS.flatMap((m) => {
    const q = fornece[m.quantidade];
    const preco = t.materiaisCent[m.chave];
    if (!q || preco == null) return [];
    const semIvaCent = Math.round(q * preco);
    const comIvaCent = regras.materialComIva ? comIva(semIvaCent, regras) : semIvaCent;
    return [{ nome: m.nome, quantidade: q, unidade: m.unidade, semIvaCent, comIvaCent, texto: valorEmTexto({ semIvaCent, comIvaCent }) }];
  });
  const total =
    linhas.length > 0
      ? (() => {
          const semIvaCent = linhas.reduce((s, l) => s + l.semIvaCent, 0);
          const comIvaCent = linhas.reduce((s, l) => s + l.comIvaCent, 0);
          return { semIvaCent, comIvaCent, texto: valorEmTexto({ semIvaCent, comIvaCent }) };
        })()
      : null;
  const partes = (Object.keys(fornece) as QuantidadeDoMaterial[]).map((k) => {
    const q = fornece[k] as number;
    return `${q} ${q === 1 ? NOMES_NO_KIT[k][0] : NOMES_NO_KIT[k][1]}`;
  });
  const falta = naoFornece.length > 0 ? ` · não fornece: ${naoFornece.map((n) => n.toLowerCase()).join(", ")}` : "";
  const texto = total && partes.length > 0 ? `${rotulo}: ${partes.join(", ")} — ${total.texto}${falta}` : semNada;
  return { linhas, naoFornece, total, texto };
}

/**
 * O cartão de UM parceiro elegível, com a tarifa congelada agora (é a mesma
 * conta que fica no pedido se o cliente o escolher). Null se a conta não fechar.
 *
 * Desde 11-11-2026: as horas num intervalo (nunca abaixo do mínimo dele), a
 * estimativa nos dois extremos com a proteção por omissão, e as caixas e o
 * embalamento numa linha à parte.
 */
export function cartaoDoParceiro(
  c: CandidatoDaMudanca & { tarifa: TarifaDasMudancas },
  ctx: ContextoDaMudanca,
  id: string,
  agora: Date = new Date(),
): CartaoDoParceiro | null {
  const t: TarifaCongelada = congelarTarifa(c.tarifa, undefined, agora);
  const regras = t.regras;
  const pessoas = pessoasParaACasa(ctx.tipologia, ctx.pessoas);
  const [hMin, hMax] = horasDoParceiro(horasDaMudanca(ctx.tipologia, ctx.desmontagem, pessoas), t.minimoHoras);
  const tipologia = ctx.tipologia ?? "itens";

  const prot = oQueFornece(t, KIT_POR_TIPOLOGIA[tipologia]);
  const emb = oQueFornece(t, EMBALAMENTO_NA_TARIFA[tipologia]);
  const comEmbalamento: Partial<Record<QuantidadeDoMaterial, number>> = { ...prot.fornece };
  for (const [k, v] of Object.entries(emb.fornece) as Array<[QuantidadeDoMaterial, number]>) comEmbalamento[k] = (comEmbalamento[k] ?? 0) + v;

  const conta = (horas: number, materiais: Partial<Record<QuantidadeDoMaterial, number>>) =>
    valorDaMudanca(t, { pessoas, horas, km: ctx.kmPercurso, materiais });
  const protMin = conta(hMin, prot.fornece);
  const protMax = conta(hMax, prot.fornece);
  if (!protMin.ok || !protMax.ok) return null;
  const temEmbalamento = Object.keys(emb.fornece).length > 0;
  const embMin = temEmbalamento ? conta(hMin, comEmbalamento) : null;
  const embMax = temEmbalamento ? conta(hMax, comEmbalamento) : null;
  if (embMin && !embMin.ok) return null;
  if (embMax && !embMax.ok) return null;

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

  const tipoNoTexto = tipologia === "itens" ? TIPOLOGIA_POR_EXTENSO.itens : `um ${TIPOLOGIA_POR_EXTENSO[tipologia]}`;
  const protecao = materialDoCartao(
    t,
    regras,
    prot.fornece,
    prot.naoFornece,
    `Proteção para ${tipoNoTexto}, já na estimativa`,
    "Este parceiro não fornece o material de proteção.",
  );
  const embalamento =
    EMBALAMENTO_POR_TIPOLOGIA[tipologia] == null
      ? null
      : materialDoCartao(
          t,
          regras,
          emb.fornece,
          emb.naoFornece,
          `Caixas e embalamento para ${tipoNoTexto}`,
          "Este parceiro não fornece caixas nem plástico bolha.",
        );

  const comProtecao = Object.keys(prot.fornece).length > 0;
  const estimativa = estimativaEmIntervalo(protMin, protMax, (f) => `Estimativa: ${f}${comProtecao ? ", com a proteção" : ", sem o material"}`);
  const estimativaComEmbalamento =
    embMin && embMax && embMin.ok && embMax.ok ? estimativaEmIntervalo(embMin, embMax, (f) => `Com caixas e embalamento: ${f}`) : null;
  const estimativaComKit = estimativaComEmbalamento
    ? { ...estimativaComEmbalamento, texto: `${faixaEmTexto(estimativaComEmbalamento.minimo, estimativaComEmbalamento.maximo)}, se também precisar de caixas e embalamento` }
    : { ...estimativa, texto: `${faixaEmTexto(estimativa.minimo, estimativa.maximo)}${comProtecao ? ", com a proteção" : ""}` };

  const temNota = c.notaMedia != null && c.avaliacoes >= AVALIACOES_PARA_A_NOTA;
  const media = temNota ? Math.round((c.notaMedia as number) * 10) / 10 : 0;
  const p2 = hora(t.precoHora2Cent) as ValorAoCliente;
  const p3 = hora(t.precoHora3Cent);
  const intervalo: IntervaloDeHoras = [hMin, hMax];
  const horasTexto = `${intervaloDeHorasEmTexto(intervalo)} com ${pessoas} pessoas`;

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
    fotografia: null,
    precoHora: { 2: soComTresPessoas(ctx.tipologia) && p3 ? p3 : p2, 3: p3 },
    fazComTres: p3 != null,
    pessoas,
    minimoHoras: t.minimoHoras,
    minimoTexto: `Mínimo de ${horasEscritas(t.minimoHoras)} ${t.minimoHoras === 1 ? "hora" : "horas"}`,
    materiais,
    kit: protecao,
    protecao,
    embalamento,
    horas: meioDoIntervalo(intervalo),
    horasMinimo: hMin,
    horasMaximo: hMax,
    horasTexto: horasTexto.charAt(0).toUpperCase() + horasTexto.slice(1),
    km: ctx.kmPercurso,
    estimativa,
    estimativaComEmbalamento,
    estimativaComKit,
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
    "Ordenamos pela estimativa (o meio do intervalo de horas, os quilómetros e a proteção, sem as caixas), do valor mais baixo para o mais alto; " +
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

/** O botão de quem não quer escolher parceiro (11-11-2026) — o mesmo no site e na app de cliente. */
export const DEIXAR_A_CLYON_ESCOLHER = "Deixar a CLYON escolher por mim";

/** Quanto se espera pela lista antes de seguir sem ela (11-11-2026): 8 s, no site e na app. */
export const PRAZO_DA_LISTA_MS = 8000;

export const TEXTOS_DA_LISTA = Object.freeze({
  titulo: "Parceiros disponíveis para a sua mudança",
  escolha: `Escolha até ${MAXIMO_DE_ESCOLHIDOS} parceiros. O pedido vai logo aos que escolher, com os preços que vê aqui.`,
  recomendaTres: SO_COM_TRES_PESSOAS,
  soComTres: SO_COM_TRES_PESSOAS,
  /** 11-11-2026: sem parceiros com preço na zona, diz-se como o pedido segue e a referência — não «ainda não temos». */
  semParceiros: "Os parceiros da sua zona respondem a este pedido com o preço por hora de cada um.",
  semParceirosSegue: `A ${REFERENCIA_DA_MUDANCA}.`,
  /** d6 (11-11-2026): os escolhidos têm 3 horas para responder, e o que acontece se nenhum responder. */
  prazo: LINHA_DAS_3_HORAS,
  procurarMais: "Pedir também à CLYON que procure mais parceiros",
  /** d6: a opção aparece sempre que há parceiros na lista, com esta ajuda por baixo. */
  procurarMaisAjuda: AJUDA_DO_PROCURAR_MAIS,
  /** 11-11-2026: quem não quer escolher segue o caminho de sempre (a Mesa escolhe). */
  deixarEscolher: DEIXAR_A_CLYON_ESCOLHER,
  pedirEmbalamento: PEDIR_EMBALAMENTO,
  botao: "Pedir orçamento",
  notaDaEstimativa:
    "Estimativa com os preços de cada parceiro, entre as horas habituais numa casa como a sua, com o percurso entre as duas moradas " +
    "e o material de proteção dos móveis e do chão. O valor final conta as horas feitas, os quilómetros e o material que usar.",
  quemFaz: "O trabalho é feito pelo parceiro que escolher.",
});

/** «T3 · Seixal → Almada · entre 7 e 9 h com 3 pessoas» */
export function resumoDaMudanca(
  tipologia: Tipologia | null,
  origem: string | null,
  destino: string | null,
  horas: IntervaloDeHoras | number,
  pessoas: Pessoas,
): string {
  const tipo = TIPOLOGIA_POR_EXTENSO[tipologia ?? "itens"];
  const tipoComMaiuscula = tipo.charAt(0).toUpperCase() + tipo.slice(1);
  const caminho = origem && destino ? `${origem} → ${destino}` : origem || destino || null;
  const iv: IntervaloDeHoras = typeof horas === "number" ? [horas, horas] : horas;
  return [tipoComMaiuscula, caminho, `${intervaloDeHorasEmTexto(iv)} com ${pessoasParaACasa(tipologia, pessoas)} pessoas`]
    .filter(Boolean)
    .join(" · ");
}
