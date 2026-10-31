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

/** Os títulos das perguntas, os mesmos no simulador do site e na app (R7). */
export const TITULO_DA_QUANTIDADE = "Quanto há para levar?";
export const TITULO_DAS_COISAS = "Há alguma destas coisas?";
export const AJUDA_DAS_COISAS = "(pode escolher várias)";

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

/** «Quantidade estimada: Pouca coisa (enche uma carrinha).» — a linha que o simulador escreve. */
export function linhaDaQuantidade(volume: string | null | undefined): string | null {
  const r = RESPOSTAS_DA_QUANTIDADE.find((x) => x.valor === volume);
  return r ? `Quantidade estimada: ${r.texto}.` : null;
}

/**
 * AS PERGUNTAS DO ESPAÇO PARA A APP DE CLIENTE — d5, 31-10-2026.
 *
 * A R7 (`GET /api/cliente/catalogo`) serve-as em cada um dos três serviços,
 * já escritas, com a linha que cada resposta deixa na descrição do pedido:
 * a app pergunta o mesmo que o simulador do site, com os nomes das faixas do
 * site, e escreve as mesmas linhas — sem as ter no código. As coisas que lá
 * estão juntam-se numa linha só (`prefixo` + `emLinha` por vírgulas + «.»,
 * ou `linhaNenhuma`), a mesma de `linhaDasCoisas` (o teste de contrato o
 * guarda).
 */
export function perguntasDoEspacoParaAApp(servico: string) {
  const p = PERGUNTAS_DO_ESPACO[servico];
  if (!p) return null;
  const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
  return {
    quantidade: {
      titulo: TITULO_DA_QUANTIDADE,
      opcoes: RESPOSTAS_DA_QUANTIDADE.map((r) => ({ id: r.valor, nome: r.texto, linha: linhaDaQuantidade(r.valor) as string })),
    },
    acesso: {
      titulo: p.acesso.titulo,
      opcoes: p.acesso.opcoes.map((o) => ({ id: o.valor, nome: o.texto, linha: linhaDoAcesso(servico, o.valor) as string })),
    },
    coisas: p.coisas
      ? {
          titulo: TITULO_DAS_COISAS,
          ajuda: AJUDA_DAS_COISAS,
          opcoes: p.coisas.map((o) => ({ id: o.valor, nome: o.texto, emLinha: minuscula(o.texto), ...(o.aviso ? { aviso: o.aviso } : {}) })),
          nenhuma: "nenhuma",
          prefixo: "No espaço há: ",
          linhaNenhuma: linhaDasCoisas(servico, ["nenhuma"]) as string,
        }
      : null,
    perguntaOAndar: p.perguntaOAndar,
    dicaDasFotos: DICA_DAS_FOTOS_DO_ESPACO,
  };
}

/** Troca (ou tira) a linha que começa por `prefixo` na descrição, e põe a nova no topo. */
export function comLinha(descricao: string | undefined, prefixo: string, linha: string | null): string {
  const resto = (descricao ?? "")
    .split("\n")
    .filter((l) => !l.startsWith(prefixo))
    .join("\n");
  return [linha, resto].filter(Boolean).join("\n").trim();
}
