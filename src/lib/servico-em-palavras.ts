import { SERVICE_CATEGORIES } from "@/lib/service-categories";

/**
 * O SERVIÇO DITO AO CLIENTE, JÁ COM O ARTIGO CERTO.
 *
 * Saiu isto para uma cliente, a 13-09-2026:
 *
 *   «Manuel Martins transportes propõe 148,57 € para a sua outro serviço»
 *
 * O artigo estava escrito à mão — `a sua ${etiqueta}` — e a etiqueta vinha de
 * uma lista onde três das dez são masculinas. Bastava o cliente ter escolhido
 * «Outro serviço», «Esvaziamento de casa» ou «Esvaziamento de apartamento»
 * para a frase sair torta. Os avisos automáticos repetiam o mesmo molde em
 * sete mensagens, uma delas com o particípio preso ao feminino («deu a sua
 * esvaziamento de casa por feita»).
 *
 * NÃO SE RESOLVE COM UMA TABELA DE GÉNEROS. Resolve-se escrevendo a frase por
 * extenso: quem a lê no código lê exactamente o que o cliente vai ler, e não
 * há concordância nenhuma para calcular — logo não há nenhuma para errar. Ao
 * lado fica o nome nu, para as frases que não levam possessivo.
 *
 * A LISTA TEM DE ESTAR COMPLETA, e é um teste que o garante. Havia uma segunda
 * lista escrita à mão em `mensagem-whatsapp.ts` a que faltava
 * `montagem_moveis`: quem pedisse montagem via o identificador da base a sair
 * pela frente, «montagem moveis», com o traço baixo trocado por um espaço e
 * sem acento.
 */

type ComoSeDiz = {
  /** O nome nu: «recolha de entulho». */
  nome: string;
  /** A frase feita, com o artigo já certo: «a sua recolha de entulho». */
  possessivo: string;
};

const SERVICOS: Record<string, ComoSeDiz> = {
  recolha_moveis: { nome: "recolha de móveis", possessivo: "a sua recolha de móveis" },
  recolha_monos: { nome: "recolha de monos", possessivo: "a sua recolha de monos" },
  recolha_entulho: { nome: "recolha de entulho", possessivo: "a sua recolha de entulho" },
  esvaziamento_casa: {
    nome: "esvaziamento de casa",
    possessivo: "o seu esvaziamento de casa",
  },
  esvaziamento_apartamento: {
    nome: "esvaziamento de apartamento",
    possessivo: "o seu esvaziamento de apartamento",
  },
  mudanca: { nome: "mudança", possessivo: "a sua mudança" },
  montagem_moveis: {
    nome: "montagem de móveis",
    possessivo: "a sua montagem de móveis",
  },
  jardinagem: { nome: "jardinagem", possessivo: "a sua jardinagem" },
  manutencao_casa: {
    nome: "manutenção da casa",
    possessivo: "o seu pedido de manutenção da casa",
  },
  /*
   * «Outro serviço» não tem nome para dizer — foi o cliente que não encontrou
   * o dele na lista. Chamar-lhe «o seu outro serviço» seria devolver-lhe a
   * etiqueta do formulário em vez de falar com ele.
   */
  outro: { nome: "serviço", possessivo: "o seu pedido" },
};

/** Os identificadores que esta lista conhece — para o teste que a guarda. */
export const CATEGORIAS_COM_PALAVRAS = Object.keys(SERVICOS);

/** Todas as categorias que existem no produto, para o mesmo teste. */
export const CATEGORIAS_DO_PRODUTO = SERVICE_CATEGORIES.map((c) => c.id);

/**
 * «recolha de entulho». Sem tipo nenhum: «serviço».
 *
 * Um tipo que esta lista não conheça pelo menos perde os traços baixos — é
 * melhor dizer «recolha especial xpto» do que esconder o que a pessoa pediu.
 * Com a lista completa e um teste a guardá-la, isto só se aplica a categorias
 * que ainda não existem.
 */
export function servicoEmPalavras(tipo: string | null | undefined): string {
  if (!tipo) return "serviço";
  return SERVICOS[tipo]?.nome ?? tipo.replace(/_/g, " ");
}

/**
 * «a sua recolha de entulho», «o seu esvaziamento de casa», «o seu pedido».
 *
 * Nunca devolve nada que precise de ser concordado por quem chama: a frase
 * entra na mensagem tal e qual.
 */
export function oSeuServico(tipo: string | null | undefined): string {
  if (!tipo) return "o seu pedido";
  return SERVICOS[tipo]?.possessivo ?? "o seu pedido";
}
