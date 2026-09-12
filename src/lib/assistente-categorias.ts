import { faseDoTrabalho } from "./trabalho";
import type { Proposta } from "./negociacao";

/**
 * A CATEGORIA DE UM PEDIDO — derivada, nunca guardada.
 *
 * "O assistente deve ter categorias mais robustas para gerir os pedidos e
 * marcar tudo bem organizado, como por exemplo pedidos criados, orçamentos
 * enviados, orçamentos aceites, orçamentos recusados, pedidos cancelados." —
 * 12-09-2026.
 *
 * A tentação é acrescentar uma coluna `categoria` e escrevê-la a cada passo.
 * Não se faz assim. Uma coluna de estado escrita à mão em doze sítios fica
 * errada no primeiro que alguém esquecer — e aí o painel diz "orçamento
 * enviado" sobre um pedido que já foi pago, e o assistente manda ao cliente
 * uma mensagem sobre um negócio que acabou na semana passada.
 *
 * Este ficheiro já tem a lição escrita ao lado: `faseDoTrabalho` calcula a
 * fase a partir das datas que existem, e por isso nunca pode divergir. A
 * categoria faz o mesmo um nível acima — olha para o pedido INTEIRO, com
 * todas as negociações dele, e diz em que pé está.
 *
 * É uma função PURA e sem base de dados de propósito: é o que permite que o
 * painel e o assistente leiam a MESMA verdade, e que um teste a interrogue
 * com trinta casos sem ligar a nada.
 *
 * A ORDEM DAS PERGUNTAS É A REGRA. Um pedido cancelado que tenha uma
 * negociação acordada é um pedido cancelado — quem manda é o gesto mais
 * recente e mais forte, não o que lá estava antes.
 */

export type CategoriaDoPedido =
  /** Ainda não foi para a rua: nenhum profissional o viu. */
  | "criado"
  /** Distribuído, e ninguém propôs nada ainda. */
  | "a_espera_de_propostas"
  /** Há pelo menos uma proposta na mesa. A bola está do lado do cliente. */
  | "orcamento_enviado"
  /** Fechado com um profissional, e o trabalho ainda não foi feito. */
  | "aceite_por_fazer"
  /** O profissional provou que fez. Falta o cliente confirmar. */
  | "feito_por_confirmar"
  /** Confirmado pelo cliente (ou pelo prazo). */
  | "concluido"
  /** O profissional já levantou o dinheiro. */
  | "pago"
  /** Houve propostas e não houve acordo: todas mortas ou desistidas. */
  | "recusado"
  /** O cliente desistiu, ou a CLYON recusou o pedido. */
  | "cancelado"
  /** Fora da mesa por arrumação. Não é um fim, é uma gaveta. */
  | "arquivado";

/** O nome que aparece no ecrã. Em pt-PT, porque é o que o painel fala. */
export const ETIQUETA_DA_CATEGORIA: Record<CategoriaDoPedido, string> = {
  criado: "Pedido criado",
  a_espera_de_propostas: "À espera de propostas",
  orcamento_enviado: "Orçamento enviado",
  aceite_por_fazer: "Orçamento aceite",
  feito_por_confirmar: "Feito, por confirmar",
  concluido: "Concluído",
  pago: "Pago",
  recusado: "Orçamento recusado",
  cancelado: "Pedido cancelado",
  arquivado: "Arquivado",
};

/**
 * O DESENHO DE CADA CATEGORIA, num sítio só.
 *
 * Vive aqui e não em cada ecrã de propósito: a mesa dos Pedidos e a das
 * Negociações mostram a mesma fase do mesmo pedido, e duas paletas escritas à
 * mão acabavam a dizer a mesma palavra com duas cores — que é a maneira mais
 * rápida de fazer alguém pensar que são coisas diferentes.
 *
 * Verde é dinheiro a caminho, âmbar é bola do lado do cliente, cinzento é
 * espera nossa, vermelho é fim sem negócio.
 */
export const CORES_DA_CATEGORIA: Record<string, string> = {
  criado: "bg-slate-100 text-slate-600 border-slate-200",
  a_espera_de_propostas: "bg-slate-100 text-slate-600 border-slate-200",
  orcamento_enviado: "bg-amber-50 text-amber-700 border-amber-200",
  aceite_por_fazer: "bg-emerald-50 text-emerald-700 border-emerald-200",
  feito_por_confirmar: "bg-cyan-50 text-cyan-700 border-cyan-200",
  concluido: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pago: "bg-green-100 text-green-800 border-green-300",
  recusado: "bg-rose-50 text-rose-700 border-rose-200",
  cancelado: "bg-slate-100 text-slate-500 border-slate-200",
  arquivado: "bg-slate-100 text-slate-500 border-slate-200",
};

/**
 * A ordem em que as categorias fazem sentido numa lista: do princípio ao fim
 * do funil, e os becos sem saída no fim. Serve os separadores do painel.
 */
export const CATEGORIAS_POR_ORDEM: CategoriaDoPedido[] = [
  "criado",
  "a_espera_de_propostas",
  "orcamento_enviado",
  "aceite_por_fazer",
  "feito_por_confirmar",
  "concluido",
  "pago",
  "recusado",
  "cancelado",
  "arquivado",
];

/**
 * As que ainda pedem alguma coisa a alguém. É por esta lista que o assistente
 * decide se vale a pena falar — de um pedido pago não há novidades para dar.
 */
export const CATEGORIAS_VIVAS: CategoriaDoPedido[] = [
  "criado",
  "a_espera_de_propostas",
  "orcamento_enviado",
  "aceite_por_fazer",
  "feito_por_confirmar",
];

export function categoriaViva(c: CategoriaDoPedido): boolean {
  return CATEGORIAS_VIVAS.includes(c);
}

/**
 * Uma negociação, como esta função precisa de a ver.
 *
 * As propostas chegam de duas formas conforme quem pergunta — o painel lê
 * `propostasJson` da base, os testes passam o array já feito. Aceitam-se as
 * duas, e nenhum chamador tem de fazer o `JSON.parse` à mão só para saber
 * uma categoria.
 */
export type NegociacaoParaCategoria = {
  estado: string;
  propostasJson?: string | null;
  propostas?: Proposta[];
  execucaoEnviadaEm?: Date | string | null;
  confirmadoEm?: Date | string | null;
  pagoEm?: Date | string | null;
};

export type PedidoParaCategoria = {
  status?: string | null;
  negociacoes?: NegociacaoParaCategoria[] | null;
};

function propostasDe(n: NegociacaoParaCategoria): Proposta[] {
  if (Array.isArray(n.propostas)) return n.propostas;
  if (!n.propostasJson) return [];
  try {
    const l = JSON.parse(n.propostasJson);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

/** Negociações que acabaram sem acordo: não contam para "há alguém a negociar". */
function terminouSemAcordo(estado: string): boolean {
  return estado === "morta" || estado === "desistida";
}

/**
 * Em que pé está este pedido.
 *
 * Sem negociações nenhumas devolve "criado" e não "à espera de propostas": as
 * duas coisas parecem a mesma e não são. Um pedido sem negociações não foi
 * distribuído a ninguém — o problema é nosso, e é a equipa que tem de agir.
 * Um pedido distribuído sem propostas está à espera dos profissionais — o
 * problema é de oferta. Misturá-los escondia exactamente a diferença que
 * interessa a quem gere.
 */
export function categoriaDoPedido(p: PedidoParaCategoria): CategoriaDoPedido {
  const status = (p.status ?? "").trim().toLowerCase();

  // O gesto mais forte manda, mesmo que haja um trabalho fechado por baixo.
  if (status === "cancelado" || status === "rejeitado") return "cancelado";
  if (status === "arquivado") return "arquivado";

  const negociacoes = p.negociacoes ?? [];

  /*
   * A ACORDADA MANDA SOBRE TUDO O RESTO.
   *
   * Um pedido com um negócio fechado pode ter outras negociações mortas ao
   * lado — são as que ficaram para trás quando o cliente escolheu. Olhar
   * primeiro para o acordo evita que um pedido pago apareça como "recusado"
   * só porque as outras três morreram.
   */
  const acordada = negociacoes.find((n) => n.estado === "acordada");
  if (acordada) {
    const fase = faseDoTrabalho({
      estado: "acordada",
      execucaoEnviadaEm: acordada.execucaoEnviadaEm ?? null,
      confirmadoEm: acordada.confirmadoEm ?? null,
      pagoEm: acordada.pagoEm ?? null,
    });
    if (fase === "pago") return "pago";
    if (fase === "confirmado") return "concluido";
    if (fase === "a_confirmar") return "feito_por_confirmar";
    return "aceite_por_fazer";
  }

  if (negociacoes.length === 0) return "criado";

  const vivas = negociacoes.filter((n) => !terminouSemAcordo(n.estado));
  if (vivas.length === 0) {
    /*
     * Todas acabaram. "Recusado" só quando chegou a haver proposta — sem
     * nenhuma, ninguém recusou nada: o pedido morreu à espera, e essa é a
     * história que a equipa precisa de ler.
     */
    const houvePropostas = negociacoes.some((n) => propostasDe(n).length > 0);
    return houvePropostas ? "recusado" : "a_espera_de_propostas";
  }

  const naMesa = vivas.some((n) => propostasDe(n).length > 0);
  return naMesa ? "orcamento_enviado" : "a_espera_de_propostas";
}

/**
 * A proposta que está à espera de resposta do cliente, se houver, em toda a
 * mesa deste pedido. É o que o assistente precisa de saber para decidir se
 * há novidade para contar — e, mais tarde, se vale a pena insistir.
 */
export function esperaPeloCliente(n: NegociacaoParaCategoria, agora: Date): boolean {
  if (n.estado === "aguarda_contratacao") return true;
  if (n.estado !== "aberta") return false;
  const propostas = propostasDe(n);
  for (let i = propostas.length - 1; i >= 0; i--) {
    const pr = propostas[i];
    if (pr.estado !== "pendente") continue;
    if (pr.por !== "profissional") return false;
    // Uma proposta cujo prazo passou já não espera por ninguém.
    const criada = pr.criadaEm instanceof Date ? pr.criadaEm : new Date(pr.criadaEm);
    const horas = (agora.getTime() - criada.getTime()) / 3600_000;
    return horas < 48;
  }
  return false;
}
