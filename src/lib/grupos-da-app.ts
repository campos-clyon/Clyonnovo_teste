import { SERVICOS_PUBLICOS } from "./service-categories";
import { ENTULHO_ATE_10_SACOS, minimoDe } from "./precos-publicos";
import { comIva, euros } from "./quanto-custa";
import { SEM_PARCEIROS, type PrecoPublicoDasMudancas } from "./preco-publico-das-mudancas";
import { PRECO_POR_HORA_DUAS_PESSOAS } from "./tabela-das-mudancas";
import { novoModeloEmVigor } from "./novo-modelo";
import { PAGA_AO_PARCEIRO_NO_FIM, SALVO_SE_COMBINAREM } from "./quando-se-paga";
import { PRAZO_DE_RESPOSTA } from "./seo-data";
import { passosDeComoFunciona } from "./como-funciona";

/**
 * O INÍCIO DA APP DE CLIENTE: OS GRUPOS, O «DESDE» CURTO E A CONFIANÇA
 * (d148, 27-11-2026, o CEO e o dono, depois de ver o protótipo).
 *
 * O Início mostrava os 13 serviços, cada um com o preço de referência inteiro
 * («por peça: pequena 15 €, média 30 €, grande 65 € a primeira…»). Passa a
 * perguntar «Do que precisa?» e a responder com quatro grupos pelo que a
 * pessoa quer fazer, cada um com um «desde» curto, sempre com o IVA ao lado.
 * O preço inteiro continua no Descobrir e no ecrã do serviço.
 *
 * Os números são os de sempre: o mínimo publicado de cada serviço (`minimoDe`),
 * os 10 sacos do entulho (`ENTULHO_ATE_10_SACOS`) e a hora das mudanças (a dos
 * parceiros da lista, ou a referência). Nada escrito à mão.
 *
 * O ENTULHO NUNCA DÁ O «DESDE» DE UM GRUPO (04-11-2026, entulho fora da
 * divulgação): está dentro do grupo «Levar», para quem o procura, mas o número
 * da entrada é o dos móveis e dos monos.
 *
 * Puro: sem base. A rota do catálogo lê o preço das mudanças antes de chamar.
 */

/**
 * «desde 60 € + IVA (73,80 € com IVA)» — uma frase só, com o com IVA entre
 * parênteses no fim (critério 35: nenhum preço sem o com IVA ao lado, na mesma
 * frase). A app parte-a para o ecrã como parte o preço de referência.
 */
export type DesdeCurto = string;

export type IdDoGrupo = "levar" | "esvaziar" | "mudar" | "reparar";

export type GrupoDoInicio = {
  id: IdDoGrupo;
  titulo: string;
  /** Uma linha do que cabe no grupo. */
  inclui: string;
  /** Os ids dos serviços, pela ordem — só os que o simulador oferece. */
  servicos: string[];
  desde: DesdeCurto | null;
};

/** Os grupos, pela ordem do ecrã. `desdeDe` é o serviço cujo «desde» o grupo mostra (o mais baixo, sem o entulho). */
const GRUPOS: ReadonlyArray<Omit<GrupoDoInicio, "desde" | "servicos"> & { servicos: readonly string[]; desdeDe: string }> = [
  {
    id: "levar",
    titulo: "Levar móveis e monos",
    inclui: "Sofás, colchões, eletrodomésticos e o que já não usa.",
    servicos: ["recolha_moveis", "recolha_monos", "recolha_entulho"],
    desdeDe: "recolha_moveis",
  },
  {
    id: "esvaziar",
    titulo: "Esvaziar um espaço",
    inclui: "Casa, apartamento, garagem, sótão, cave ou empresa.",
    servicos: [
      "esvaziamento_casa",
      "esvaziamento_apartamento",
      "esvaziamento_garagem",
      "esvaziamento_sotao",
      "esvaziamento_cave",
      "esvaziamento_empresa",
    ],
    desdeDe: "esvaziamento_garagem",
  },
  {
    id: "mudar",
    titulo: "Mudar de casa",
    inclui: "Carga, transporte e descarga, com montagem se a pedir.",
    servicos: ["mudanca"],
    desdeDe: "mudanca",
  },
  {
    id: "reparar",
    titulo: "Montar e reparar",
    inclui: "Montagem de móveis, reparações e remodelações.",
    servicos: ["montagem_moveis", "manutencao_casa"],
    desdeDe: "montagem_moveis",
  },
];

/** Os serviços que ficam fora dos grupos: o «Outro serviço» tem linha própria no Início. */
export const FORA_DOS_GRUPOS: readonly string[] = ["outro"];

const desdeDoValor = (v: number): DesdeCurto => `desde ${euros(v)} + IVA (${euros(comIva(v))} com IVA)`;

/**
 * O «desde» curto de um serviço, ou `null` se não publica preço (o esvaziamento
 * de empresa e o «Outro serviço» são só por proposta).
 */
export function desdeCurto(servico: string, pp: PrecoPublicoDasMudancas = SEM_PARCEIROS): DesdeCurto | null {
  if (servico === "mudanca") {
    // A hora, não o mínimo: «desde 120 €» leria-se como uma mudança inteira por 120 €.
    // Com parceiros na lista, o «desde» deles; sem eles, a referência com 2 pessoas (d60).
    const sem = pp.tipo === "parceiros" ? pp.desde.semIvaCent / 100 : PRECO_POR_HORA_DUAS_PESSOAS;
    const com = pp.tipo === "parceiros" ? pp.desde.comIvaCent / 100 : comIva(PRECO_POR_HORA_DUAS_PESSOAS);
    return `desde ${euros(sem)}/hora + IVA, com 2 pessoas (${euros(com)} com IVA)`;
  }
  if (servico === "recolha_entulho") {
    // O mínimo publicado é o m³; os 10 sacos são o pedido mais pequeno que se aceita.
    return `10 sacos ${desdeDoValor(ENTULHO_ATE_10_SACOS.minimo)}`;
  }
  const m = minimoDe(servico);
  return m == null ? null : desdeDoValor(m);
}

/** Os grupos do Início, só com os serviços que o simulador oferece hoje; um grupo vazio não aparece. */
export function gruposDoInicio(pp: PrecoPublicoDasMudancas = SEM_PARCEIROS): GrupoDoInicio[] {
  const oferecidos = new Set(SERVICOS_PUBLICOS.map((c) => c.id));
  return GRUPOS.flatMap((g) => {
    const servicos = g.servicos.filter((s) => oferecidos.has(s));
    if (servicos.length === 0) return [];
    const desdeDe = servicos.includes(g.desdeDe) ? g.desdeDe : servicos.find((s) => s !== "recolha_entulho");
    return [{ id: g.id, titulo: g.titulo, inclui: g.inclui, servicos, desde: desdeDe ? desdeCurto(desdeDe, pp) : null }];
  });
}

/** O que dá confiança, sem nada que não seja verdade: o título e uma linha. */
export type FactoDeConfianca = { titulo: string; texto: string };

const APROVADOS: FactoDeConfianca = {
  titulo: "Parceiros aprovados pela equipa",
  texto: "Empresas da sua zona, aprovadas pela equipa da CLYON antes de receberem pedidos.",
};

/**
 * A confiança do Início. No modelo de 15-11-2026 o cliente paga ao parceiro
 * (no fim do trabalho, salvo se combinarem outra coisa — a frase da
 * adjudicação) e recebe duas faturas; antes da data, só os parceiros
 * aprovados (o pagamento era outro).
 */
export function confiancaDoInicio(agora: Date = new Date()): FactoDeConfianca[] {
  if (!novoModeloEmVigor(agora)) return [APROVADOS];
  return [
    APROVADOS,
    {
      titulo: PAGA_AO_PARCEIRO_NO_FIM,
      texto: `${SALVO_SE_COMBINAREM.charAt(0).toUpperCase()}${SALVO_SE_COMBINAREM.slice(1)}. Por transferência, MB WAY ou dinheiro, só pelos dados que aparecem no seu pedido.`,
    },
    {
      titulo: "Duas faturas, juntas ao pedido",
      texto: "A do trabalho, emitida pelo parceiro, e a da taxa da plataforma.",
    },
  ];
}

/**
 * Os três passos do Início, em curto: os títulos de «Como funciona» (a mesma
 * fonte do site) e uma legenda de poucas palavras, com o prazo da promessa.
 * O texto inteiro de cada passo continua em «Ver mais».
 */
export function passosDoInicio(agora: Date = new Date()): FactoDeConfianca[] {
  const legendas = ["Com fotografias e a morada", `Em menos de ${PRAZO_DE_RESPOSTA.porExtenso}`, "Uma, ou nenhuma, sem custo"];
  return passosDeComoFunciona(agora)
    .slice(0, 3)
    .map((p, i) => ({ titulo: p.titulo, texto: legendas[i] }));
}
