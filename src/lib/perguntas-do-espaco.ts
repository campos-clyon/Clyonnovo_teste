import { NOMES_DAS_FAIXAS, eEsvaziamentoDeEspaco } from "./precos-publicos";

/**
 * AS PERGUNTAS DA GARAGEM, DO SÓTÃO E DA CAVE — 29-10-2026 (especificação de
 * Produto aprovada pelo dono).
 *
 * No máximo quatro por tipo, contando com as que o simulador já faz (o andar e
 * o elevador, e o estacionamento): a quantidade (a faixa do preço), o acesso e,
 * na garagem e na cave, o que lá está que pede cuidado. Cada resposta escreve
 * uma linha na descrição do pedido, como a quantidade já fazia — o parceiro, a
 * Mesa e a app Pro lêem-na sem campos novos na base.
 *
 * O ACESSO DIFÍCIL leva a estimativa ao topo da faixa, sem a passar: alçapão
 * ou escada estreita no sótão, mais de 10 degraus na cave, parque com horário
 * na garagem, ou o estacionamento longe.
 */

export type OpcaoDoAcesso = { valor: string; texto: string; dificil: boolean };
export type OpcaoDasCoisas = { valor: string; texto: string; aviso?: string };

export type PerguntasDoEspaco = {
  /** A pergunta do acesso e as respostas. */
  acesso: { titulo: string; opcoes: readonly OpcaoDoAcesso[] };
  /** «Há alguma destas coisas?» — só na garagem e na cave. */
  coisas?: readonly OpcaoDasCoisas[];
  /** O sótão pergunta o andar e o elevador (os campos que já existem); a garagem e a cave não. */
  perguntaOAndar: boolean;
};

export const AVISO_DOS_QUIMICOS =
  "Diga quais na descrição. São resíduos que vão para um destino próprio, e nem todos os parceiros os podem levar.";
export const AVISO_DOS_PNEUS = "Diga quantos na descrição.";

export const DICA_DAS_FOTOS_DO_ESPACO =
  "Fotografe o espaço todo, de duas ou três pontas, e o caminho até à rua (escada, degraus, porta).";

const COISAS_DA_GARAGEM: readonly OpcaoDasCoisas[] = [
  { valor: "eletrodomesticos", texto: "Eletrodomésticos grandes" },
  { valor: "pneus", texto: "Pneus", aviso: AVISO_DOS_PNEUS },
  { valor: "quimicos", texto: "Latas de tinta, óleos ou produtos químicos", aviso: AVISO_DOS_QUIMICOS },
  { valor: "entulho", texto: "Entulho de obra" },
  { valor: "nenhuma", texto: "Nenhuma" },
];

export const PERGUNTAS_DO_ESPACO: Readonly<Record<string, PerguntasDoEspaco>> = {
  esvaziamento_garagem: {
    acesso: {
      titulo: "Onde fica a garagem?",
      opcoes: [
        { valor: "rua", texto: "Ao nível da rua, com porta para fora", dificil: false },
        { valor: "cave_do_predio", texto: "Na cave do prédio, com rampa ou elevador", dificil: false },
        { valor: "parque_com_horario", texto: "Num parque fechado, com horário de acesso", dificil: true },
      ],
    },
    coisas: COISAS_DA_GARAGEM,
    perguntaOAndar: false,
  },
  esvaziamento_sotao: {
    acesso: {
      titulo: "Como se chega ao sótão?",
      opcoes: [
        { valor: "escada_normal", texto: "Escada normal", dificil: false },
        { valor: "escada_estreita", texto: "Escada estreita ou em caracol", dificil: true },
        { valor: "alcapao", texto: "Alçapão com escada de abrir", dificil: true },
      ],
    },
    perguntaOAndar: true,
  },
  esvaziamento_cave: {
    acesso: {
      titulo: "Como se chega à cave?",
      opcoes: [
        { valor: "rua", texto: "Porta ao nível da rua", dificil: false },
        { valor: "ate_10_degraus", texto: "Até 10 degraus", dificil: false },
        { valor: "mais_de_10_degraus", texto: "Mais de 10 degraus ou escada estreita", dificil: true },
      ],
    },
    coisas: [
      ...COISAS_DA_GARAGEM.filter((c) => c.valor !== "nenhuma"),
      { valor: "humidade", texto: "Coisas molhadas ou com bolor" },
      { valor: "nenhuma", texto: "Nenhuma" },
    ],
    perguntaOAndar: false,
  },
};

/** As respostas da quantidade, pela ordem: as três faixas e «não sei». */
export const RESPOSTAS_DA_QUANTIDADE: ReadonlyArray<{ valor: string; texto: string }> = [
  { valor: "carrinha", texto: NOMES_DAS_FAIXAS.carrinha },
  { valor: "camiao_caixa", texto: NOMES_DAS_FAIXAS.camiao_caixa },
  { valor: "camiao_lixo", texto: NOMES_DAS_FAIXAS.camiao_lixo },
  { valor: "incerto", texto: "Não sei — vou mandar fotografias" },
];

/** O estacionamento «mais longe» conta como acesso difícil. */
const ESTACIONAMENTO_LONGE = new Set(["over_30m", "difficult"]);

/** O acesso é difícil? (leva a estimativa ao topo da faixa) */
export function acessoDificilDoEspaco(
  servico: string | null | undefined,
  acesso: string | null | undefined,
  estacionamento?: string | null,
): boolean {
  if (!eEsvaziamentoDeEspaco(servico)) return false;
  const p = PERGUNTAS_DO_ESPACO[servico as string];
  const escolhido = p?.acesso.opcoes.find((o) => o.valor === acesso);
  return !!escolhido?.dificil || (estacionamento != null && ESTACIONAMENTO_LONGE.has(estacionamento));
}

/** «Acesso: alçapão com escada de abrir.» */
export function linhaDoAcesso(servico: string, acesso: string | null | undefined): string | null {
  const o = PERGUNTAS_DO_ESPACO[servico]?.acesso.opcoes.find((x) => x.valor === acesso);
  return o ? `Acesso: ${o.texto.charAt(0).toLowerCase()}${o.texto.slice(1)}.` : null;
}

/** «No espaço há: pneus, entulho de obra.» */
export function linhaDasCoisas(servico: string, coisas: readonly string[] | null | undefined): string | null {
  const opcoes = PERGUNTAS_DO_ESPACO[servico]?.coisas;
  if (!opcoes || !coisas || coisas.length === 0) return null;
  const escolhidas = opcoes.filter((o) => coisas.includes(o.valor));
  if (escolhidas.length === 0) return null;
  if (escolhidas.some((o) => o.valor === "nenhuma")) return "No espaço há: nada destas coisas (eletrodomésticos, pneus, químicos, entulho).";
  return `No espaço há: ${escolhidas.map((o) => o.texto.charAt(0).toLowerCase() + o.texto.slice(1)).join(", ")}.`;
}

/** Os avisos das coisas escolhidas (químicos, pneus). */
export function avisosDasCoisas(servico: string, coisas: readonly string[] | null | undefined): string[] {
  const opcoes = PERGUNTAS_DO_ESPACO[servico]?.coisas ?? [];
  return opcoes.filter((o) => coisas?.includes(o.valor) && o.aviso).map((o) => o.aviso as string);
}

/** Troca (ou tira) a linha que começa por `prefixo` na descrição, e põe a nova no topo. */
export function comLinha(descricao: string | undefined, prefixo: string, linha: string | null): string {
  const resto = (descricao ?? "")
    .split("\n")
    .filter((l) => !l.startsWith(prefixo))
    .join("\n");
  return [linha, resto].filter(Boolean).join("\n").trim();
}
