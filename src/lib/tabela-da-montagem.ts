/**
 * A MONTAGEM E DESMONTAGEM DE MÓVEIS — a tabela, num sítio só. 26-11-2026
 * (decisão d132, o CEO e o dono).
 *
 * O serviço tinha saído do site e do simulador a 25-10-2026 e volta com uma
 * tabela «desde»: o parceiro propõe o valor final. Os valores são SEM IVA e
 * mostram-se sempre com o valor com IVA ao lado (23 %).
 *
 *   · por peça: pequena 15 €, média 30 €, cama de casal 40 €, roupeiro de 2
 *     portas 45 €, de 3 portas 65 €, de 4 portas ou de correr 90 €, sofá-cama /
 *     estante grande / módulo PAX 50 €, fixar uma TV ou uma prateleira à parede
 *     25 €;
 *   · desmontar custa metade da montagem da peça; desmontar e voltar a montar
 *     (numa mudança) custa 75 % da soma dos dois;
 *   · à hora: 1 montador 30 €/h, 2 montadores 55 €/h;
 *   · o mínimo do serviço: 35 €;
 *   · extras: cada andar a pé a partir do 3.º (sem elevador) +10 €; fixar um
 *     móvel à parede (anti-queda) +10 € por móvel; retirar as embalagens +10 €;
 *   · a cozinha é só por orçamento (fotografias ou visita).
 *
 * Quem lê daqui: os preços públicos (`precos-publicos.ts`, o «desde»), a
 * estimativa do site e da app (`preco-de-referencia.ts`), o motor
 * (`pricing-helper.ts`), as perguntas do simulador (`simulador-por-categoria.ts`),
 * a página do serviço e o que a Vitória sabe (`o-que-o-site-sabe.ts`). O mesmo
 * número em todo o lado; o teste `tabela-da-montagem.test.ts` guarda as contas.
 *
 * Puro: sem base nem imports de preços (os preços públicos importam daqui).
 */

const TAXA_DO_IVA = 0.23;

const centimos = (v: number) => Math.round(v * 100) / 100;

/** O valor com IVA, arredondado ao cêntimo — como `comIva` (quanto-custa.ts). */
export const comIvaDaMontagem = (v: number) => centimos(v * (1 + TAXA_DO_IVA));

/** «15 €», «16,88 €». */
export function eurosDaMontagem(v: number): string {
  return `${Number.isInteger(v) ? v : v.toFixed(2).replace(".", ",")} €`;
}

/** «15 € + IVA (18,45 € com IVA)» — o sem IVA nunca sozinho. */
export const comOIvaAoLado = (v: number) => `${eurosDaMontagem(v)} + IVA (${eurosDaMontagem(comIvaDaMontagem(v))} com IVA)`;

/* ── A tabela ──────────────────────────────────────────────────────────── */

export type PecaDaMontagem = "pequena" | "media" | "cama_casal" | "roupeiro_2" | "roupeiro_3" | "roupeiro_4" | "grande" | "parede";

export type LinhaDaTabelaDaMontagem = {
  id: PecaDaMontagem;
  /** «Peça pequena», «Roupeiro de 3 portas». */
  nome: string;
  /** Os exemplos, quando o nome não chega. */
  exemplos?: string;
  /** A montagem da peça, sem IVA. */
  preco: number;
};

export const TABELA_DA_MONTAGEM: readonly LinhaDaTabelaDaMontagem[] = [
  { id: "pequena", nome: "Peça pequena", exemplos: "mesa de cabeceira, cadeira, banco, prateleira", preco: 15 },
  { id: "media", nome: "Peça média", exemplos: "cómoda, mesa, secretária, estante, móvel de TV, cama de solteiro", preco: 30 },
  { id: "cama_casal", nome: "Cama de casal", preco: 40 },
  { id: "roupeiro_2", nome: "Roupeiro de 2 portas", preco: 45 },
  { id: "roupeiro_3", nome: "Roupeiro de 3 portas", preco: 65 },
  { id: "roupeiro_4", nome: "Roupeiro de 4 portas ou de correr", preco: 90 },
  { id: "grande", nome: "Sofá-cama, estante grande ou módulo PAX", preco: 50 },
  { id: "parede", nome: "Fixar TV ou prateleira à parede", preco: 25 },
];

export const IDS_DAS_PECAS_DA_MONTAGEM: readonly PecaDaMontagem[] = TABELA_DA_MONTAGEM.map((l) => l.id);

/** Desmontar uma peça: metade da montagem dela. */
export const PARTE_DA_DESMONTAGEM = 0.5;
/** Desmontar e voltar a montar (numa mudança): 75 % da soma da montagem e da desmontagem. */
export const PARTE_DE_DESMONTAR_E_MONTAR = 0.75;

/** À hora, sem IVA: 1 montador e 2 montadores. */
export const HORA_DA_MONTAGEM: Readonly<Record<1 | 2, number>> = Object.freeze({ 1: 30, 2: 55 });

/** O mínimo do serviço, sem IVA — o «desde» publicado. */
export const MINIMO_DA_MONTAGEM = 35;

/** Cada andar a pé (sem elevador) a partir deste conta o extra. */
export const ANDAR_A_PARTIR_DO_QUAL_SE_CONTA = 3;
/** Por andar a pé, a partir do 3.º, sem IVA. */
export const POR_ANDAR_A_PE_NA_MONTAGEM = 10;
/** Fixar um móvel à parede (anti-queda), por móvel, sem IVA. */
export const FIXAR_A_PAREDE_POR_MOVEL = 10;
/** Retirar as embalagens, por serviço, sem IVA. */
export const RETIRAR_AS_EMBALAGENS = 10;

/** «A cozinha é só por orçamento» — a frase das páginas, do simulador e da Vitória. */
export const COZINHA_SO_POR_ORCAMENTO = "Os móveis de cozinha são só por orçamento, com fotografias ou uma visita.";

export type OperacaoDaMontagem = "montar" | "desmontar" | "os_dois";

export const OPERACOES_DA_MONTAGEM: ReadonlyArray<{ id: OperacaoDaMontagem; nome: string }> = [
  { id: "montar", nome: "Montar" },
  { id: "desmontar", nome: "Desmontar" },
  { id: "os_dois", nome: "Desmontar e voltar a montar" },
];

/** O preço de uma peça nesta operação, sem IVA, ao cêntimo. */
export function precoNaOperacao(preco: number, operacao: OperacaoDaMontagem): number {
  if (operacao === "desmontar") return centimos(preco * PARTE_DA_DESMONTAGEM);
  if (operacao === "os_dois") return centimos(PARTE_DE_DESMONTAR_E_MONTAR * (preco + preco * PARTE_DA_DESMONTAGEM));
  return preco;
}

/** O preço da peça desta linha, nesta operação. */
export function precoDaPecaDaMontagem(id: PecaDaMontagem, operacao: OperacaoDaMontagem = "montar"): number {
  const l = TABELA_DA_MONTAGEM.find((x) => x.id === id);
  if (!l) throw new Error(`Peça da montagem desconhecida: ${id}`);
  return precoNaOperacao(l.preco, operacao);
}

/* ── Ler as respostas sem confiar em nada ──────────────────────────────── */

export type PecasDaMontagem = Partial<Record<PecaDaMontagem, number>>;

const inteiroDe = (v: unknown, max = 99): number => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0;
};

/** As peças de um objecto `{ pequena: 2, roupeiro_3: 1 }` — só as conhecidas, inteiras, de 0 a 99. */
export function lerPecasDaMontagem(v: unknown): PecasDaMontagem {
  const out: PecasDaMontagem = {};
  if (!v || typeof v !== "object") return out;
  const o = v as Record<string, unknown>;
  for (const id of IDS_DAS_PECAS_DA_MONTAGEM) {
    const n = inteiroDe(o[id]);
    if (n > 0) out[id] = n;
  }
  return out;
}

export function lerOperacaoDaMontagem(v: unknown): OperacaoDaMontagem | null {
  return OPERACOES_DA_MONTAGEM.find((o) => o.id === v)?.id ?? null;
}

/** Quantas peças, ao todo. */
export const quantasPecas = (p: PecasDaMontagem) => Object.values(p).reduce<number>((s, n) => s + (n ?? 0), 0);

const simDe = (v: unknown) => v === true || v === "sim" || v === "true";

/** As respostas de um pedido de montagem, pelos ids do simulador (o site, a app e o motor usam os mesmos). */
export type RespostasDaMontagem = {
  operacao: OperacaoDaMontagem | null;
  pecas: PecasDaMontagem;
  fixarAParede: number;
  retirarEmbalagens: boolean;
  cozinha: boolean;
};

export function lerRespostasDaMontagem(c: Record<string, unknown>): RespostasDaMontagem {
  return {
    operacao: lerOperacaoDaMontagem(c.operacaoDaMontagem),
    pecas: lerPecasDaMontagem(c.pecasDaMontagem),
    fixarAParede: inteiroDe(c.fixarAParede),
    retirarEmbalagens: simDe(c.retirarEmbalagens),
    cozinha: simDe(c.cozinhaNaMontagem),
  };
}

/* ── A conta ───────────────────────────────────────────────────────────── */

export type LinhaDaConta = { rotulo: string; valor: number };

export type ContaDaMontagem = {
  operacao: OperacaoDaMontagem;
  /** Peça a peça: «2 × Peça pequena (15 €)». */
  pecas: Array<{ id: PecaDaMontagem; nome: string; quantidade: number; unitario: number; subtotal: number }>;
  somaDasPecas: number;
  extras: LinhaDaConta[];
  /** As peças e os extras, antes do mínimo. */
  antesDoMinimo: number;
  /** O total, sem IVA — nunca abaixo do mínimo do serviço. */
  total: number;
  peloMinimo: boolean;
  /** Há móveis de cozinha: a cozinha vai por orçamento, à parte da conta. */
  cozinha: boolean;
};

/** Os andares a pé que contam o extra: do 3.º para cima, sem elevador. */
export function andaresAPeQueContam(andar: number | null | undefined, semElevador: boolean): number {
  if (!semElevador || andar == null || !Number.isFinite(andar)) return 0;
  return Math.max(0, Math.floor(andar) - (ANDAR_A_PARTIR_DO_QUAL_SE_CONTA - 1));
}

/**
 * A conta de um pedido de montagem, sem IVA: as peças pela operação, os
 * extras, e o mínimo do serviço por cima de tudo. `null` sem operação, ou sem
 * peças nem extras (aí vale o «desde», e a proposta sai das fotografias).
 */
export function contaDaMontagem(
  r: RespostasDaMontagem,
  acesso?: { andar?: number | null; semElevador?: boolean } | null,
): ContaDaMontagem | null {
  if (!r.operacao) return null;
  const operacao = r.operacao;
  const pecas = TABELA_DA_MONTAGEM.flatMap((l) => {
    const q = r.pecas[l.id] ?? 0;
    if (q <= 0) return [];
    const unitario = precoNaOperacao(l.preco, operacao);
    return [{ id: l.id, nome: l.nome, quantidade: q, unitario, subtotal: centimos(q * unitario) }];
  });
  if (pecas.length === 0) return null;
  const somaDasPecas = centimos(pecas.reduce((s, p) => s + p.subtotal, 0));
  const extras: LinhaDaConta[] = [];
  const andares = andaresAPeQueContam(acesso?.andar ?? null, acesso?.semElevador === true);
  if (andares > 0) extras.push({ rotulo: `${andares} ${andares === 1 ? "andar" : "andares"} a pé a partir do ${ANDAR_A_PARTIR_DO_QUAL_SE_CONTA}.º`, valor: andares * POR_ANDAR_A_PE_NA_MONTAGEM });
  if (r.fixarAParede > 0) extras.push({ rotulo: `Fixar à parede (anti-queda), ${r.fixarAParede} ${r.fixarAParede === 1 ? "móvel" : "móveis"}`, valor: r.fixarAParede * FIXAR_A_PAREDE_POR_MOVEL });
  if (r.retirarEmbalagens) extras.push({ rotulo: "Retirar as embalagens", valor: RETIRAR_AS_EMBALAGENS });
  const antesDoMinimo = centimos(somaDasPecas + extras.reduce((s, e) => s + e.valor, 0));
  const total = Math.max(MINIMO_DA_MONTAGEM, antesDoMinimo);
  return { operacao, pecas, somaDasPecas, extras, antesDoMinimo, total, peloMinimo: antesDoMinimo < MINIMO_DA_MONTAGEM, cozinha: r.cozinha };
}

/**
 * A DESMONTAGEM NUMA RECOLHA OU NUMA MUDANÇA — o extra «desmontar (e montar no
 * destino)». Numa recolha desmonta-se (50 % da montagem); numa mudança
 * desmonta-se e monta-se no destino (75 % da soma dos dois). Sem mínimo nem
 * andares: esses já os conta a recolha ou a mudança. `null` sem peças.
 */
export function extraDaDesmontagem(servico: string | null | undefined, pecas: PecasDaMontagem): { operacao: OperacaoDaMontagem; valor: number; quantas: number } | null {
  if (!servico || !SERVICOS_COM_O_EXTRA_DA_DESMONTAGEM.includes(servico)) return null;
  const quantas = quantasPecas(pecas);
  if (quantas <= 0) return null;
  const operacao: OperacaoDaMontagem = servico === "mudanca" ? "os_dois" : "desmontar";
  const valor = centimos(TABELA_DA_MONTAGEM.reduce((s, l) => s + (pecas[l.id] ?? 0) * precoNaOperacao(l.preco, operacao), 0));
  return { operacao, valor, quantas };
}

/** Onde há o extra da desmontagem pela tabela: as recolhas de móveis e de monos, e a mudança. */
export const SERVICOS_COM_O_EXTRA_DA_DESMONTAGEM: readonly string[] = ["recolha_moveis", "recolha_monos", "mudanca"];

/** O rótulo do extra, conforme o serviço. */
export const rotuloDoExtraDaDesmontagem = (servico: string | null | undefined) =>
  servico === "mudanca" ? "Desmontar e montar no destino" : "Desmontar antes de levar";

/* ── Os textos ─────────────────────────────────────────────────────────── */

/** «desde 35 €» — a etiqueta do cartão (o «+ IVA» acrescenta-o `maisIva`). */
export const ETIQUETA_DA_MONTAGEM = `desde ${MINIMO_DA_MONTAGEM} €`;

/** «desde 35 € + IVA (43,05 € com IVA)». */
export const DESDE_DA_MONTAGEM = `desde ${comOIvaAoLado(MINIMO_DA_MONTAGEM)}`;

/** A peça e o preço, com o IVA ao lado: «Roupeiro de 3 portas: 65 € + IVA (79,95 € com IVA)». */
export const linhaDaTabelaEmTexto = (l: LinhaDaTabelaDaMontagem) =>
  `${l.nome}${l.exemplos ? ` (${l.exemplos})` : ""}: ${comOIvaAoLado(l.preco)}`;

/** As regras da tabela, em frases com o IVA ao lado (a página, o simulador e a Vitória). */
export const REGRAS_DA_MONTAGEM: readonly string[] = [
  `Desmontar custa metade da montagem da peça; desmontar e voltar a montar (numa mudança) custa ${Math.round(PARTE_DE_DESMONTAR_E_MONTAR * 100)} % da soma dos dois.`,
  `À hora: 1 montador ${comOIvaAoLado(HORA_DA_MONTAGEM[1])} por hora; 2 montadores ${comOIvaAoLado(HORA_DA_MONTAGEM[2])} por hora.`,
  `Mínimo do serviço: ${comOIvaAoLado(MINIMO_DA_MONTAGEM)}.`,
  `Extras: cada andar a pé a partir do ${ANDAR_A_PARTIR_DO_QUAL_SE_CONTA}.º (sem elevador) ${comOIvaAoLado(POR_ANDAR_A_PE_NA_MONTAGEM)}; fixar um móvel à parede (anti-queda) ${comOIvaAoLado(FIXAR_A_PAREDE_POR_MOVEL)}; retirar as embalagens ${comOIvaAoLado(RETIRAR_AS_EMBALAGENS)}.`,
  COZINHA_SO_POR_ORCAMENTO,
];

/** Todos os euros da tabela, sem IVA — para a guarda dos números da Vitória (`EUROS_DAS_FONTES`). */
export const EUROS_DA_MONTAGEM: readonly number[] = [
  ...TABELA_DA_MONTAGEM.flatMap((l) => [l.preco, precoNaOperacao(l.preco, "desmontar"), precoNaOperacao(l.preco, "os_dois")]),
  HORA_DA_MONTAGEM[1],
  HORA_DA_MONTAGEM[2],
  MINIMO_DA_MONTAGEM,
  POR_ANDAR_A_PE_NA_MONTAGEM,
  FIXAR_A_PAREDE_POR_MOVEL,
  RETIRAR_AS_EMBALAGENS,
];

/** As peças contadas numa linha para a descrição: «2 × Peça pequena, 1 × Roupeiro de 3 portas». */
export function pecasEmTexto(p: PecasDaMontagem): string {
  return TABELA_DA_MONTAGEM.filter((l) => (p[l.id] ?? 0) > 0)
    .map((l) => `${p[l.id]} × ${l.nome}`)
    .join(", ");
}
