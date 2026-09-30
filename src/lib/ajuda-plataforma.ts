import { ENTIDADE_QUE_FACTURA } from "./identificacao-legal";

/**
 * As perguntas que um profissional faz antes de escrever para o apoio.
 *
 * Não é um centro de ajuda: são as seis coisas que ele pergunta sempre, com a
 * resposta ao lado. Cada uma que ele resolve sozinho é um pedido de ajuda que
 * não chega — e um dia sem esperar por resposta.
 *
 * As respostas dizem números concretos. "Depende" e "em breve" mandam-no
 * escrever na mesma, e aí a página não serviu para nada.
 */

import { MAX_PROPOSTAS_POR_LADO } from "./negociacao";
import { DIAS_ATE_LIBERTAR_SOZINHO } from "./trabalho";
import { MINIMO_PARA_LEVANTAR } from "./carteira";
import { TAXA_CLIENTE, TAXA_PROFISSIONAL } from "./taxas-plataforma";
import { PROMESSA } from "./pagamento-na-plataforma";

export type PerguntaFrequente = {
  pergunta: string;
  resposta: string;
};

export const PERGUNTAS_DO_PROFISSIONAL: PerguntaFrequente[] = [
  {
    pergunta: "Quanto é que a CLYON leva?",
    resposta:
      `A comissão é de ${Math.round(TAXA_PROFISSIONAL * 100)} % sobre o valor acordado, e o ` +
      `cliente paga mais ${Math.round(TAXA_CLIENTE * 100)} % por cima. Nunca tem de fazer ` +
      "contas: os valores que vê na sua conta já são líquidos, com a comissão descontada. " +
      "O que aparece é o que recebe. Se o cliente pagar em dinheiro, no local, recebe o " +
      "valor acordado por inteiro: a CLYON não lhe desconta nada e cobra a parte dela ao cliente.",
  },
  {
    pergunta: "Quando é que recebo o dinheiro?",
    /*
     * ESTA RESPOSTA JÁ PROMETEU O QUE NÃO EXISTIA, E DEPOIS O CONTRÁRIO.
     *
     * Primeiro dizia que o cliente pagava à CLYON ao contratar e que o valor
     * ficava cativo, quando não havia forma nenhuma de pagar à plataforma.
     * Depois passou a dizer que quem pagava era sempre o cliente, no fim — e
     * desde 17-09-2026 quem paga pela plataforma paga à CLYON. Lê a fonte
     * única, que descreve as duas formas (29-09-2026).
     */
    resposta:
      PROMESSA.proComoRecebe +
      " Depois de marcar o trabalho como feito, o cliente confirma; se não disser nada, " +
      `fecha-se sozinho ao fim de ${DIAS_ATE_LIBERTAR_SOZINHO} dias.`,
  },
  {
    pergunta: "Como levanto o saldo?",
    /*
     * «UM A DOIS DIAS ÚTEIS» ERA UMA PROMESSA SOBRE O BANCO — 29-09-2026.
     *
     * O que é nosso é tratar do pedido em menos de 24 horas (decisão de
     * 17-09-2026). O que vem a seguir é do banco, e diz-se como tal — é a
     * mesma frase que o ecrã de transferir já diz.
     */
    resposta:
      "Em A minha carteira › Transferir. Indique primeiro o IBAN em Conta bancária. O mínimo " +
      `por transferência é de ${MINIMO_PARA_LEVANTAR} €. Tratamos do pedido de levantamento em ` +
      "menos de 24 horas; o banco pode demorar mais um dia útil a mostrar a transferência. Enquanto " +
      "o pedido estiver a ser processado aparece como «a caminho».",
  },
  {
    pergunta: "Porque é que não recebo pedidos?",
    /*
     * A FATURA SAIU DAQUI — 29-09-2026. Desde 22-09-2026 quem factura ao
     * cliente é a parceira da CLYON, e um pedido com factura chega a quem faz
     * o serviço e cobre a zona, emita ele factura ou não.
     */
    resposta:
      "Um pedido só lhe aparece se for de um serviço que faz e de uma zona onde trabalha. " +
      "Confirme em Serviços e zonas: apertar o raio ou tirar uma categoria faz o trabalho " +
      "deixar de aparecer sem nada avisar. Pedidos que exigem guia de transporte mostram um " +
      "aviso a quem não tem a guia verificada, antes de propor.",
  },
  {
    pergunta: "Como funcionam as propostas?",
    /*
     * «O QUE MANTÉM O PAGAMENTO GARANTIDO» SAIU — 29-09-2026. Não há garantia
     * de pagamento nenhuma a prometer: o que a regra dos valores sem mensagens
     * mantém é o acordo escrito.
     */
    resposta:
      `Cada lado tem ${MAX_PROPOSTAS_POR_LADO} propostas, e uma proposta fica de pé até ` +
      "alguém lhe responder. Só valores, sem mensagens — é isso que impede combinações " +
      "por fora e o que mantém o acordo por escrito. Aceitar não fecha o trabalho: o " +
      "cliente ainda tem de o contratar.",
  },
  {
    pergunta: "Quando é que vejo a morada do cliente?",
    resposta:
      "Depois de ele o contratar. Antes disso vê a zona, para saber se lhe serve e quanto " +
      "custa lá chegar. É o que impede que um pedido seja usado como lista de moradas — e " +
      "vale para si e para todos os outros.",
  },
  {
    pergunta: "Que IVA devo cobrar?",
    resposta:
      `Ao cliente, nenhum: quem lhe passa a factura é a ${ENTIDADE_QUE_FACTURA.nomeCurto}, nossa ` +
      "parceira, e é ela que liquida os 23 % quando ele a pede. O seu regime continua a " +
      "contar entre si e nós — declare-o em Faturação e IVA — e é com ele que nos factura " +
      "a si o que recebe.",
  },
];

/** Os assuntos por que um pedido de ajuda pode ser classificado. */
export const ASSUNTOS_DE_AJUDA = [
  { id: "pagamento", label: "Pagamentos e carteira" },
  { id: "pedidos", label: "Pedidos e propostas" },
  { id: "conta", label: "A minha conta" },
  { id: "cliente", label: "Problema com um cliente" },
  { id: "outro", label: "Outro assunto" },
] as const;

export type AssuntoDeAjuda = (typeof ASSUNTOS_DE_AJUDA)[number]["id"];

export function assuntoValido(valor: unknown): valor is AssuntoDeAjuda {
  return typeof valor === "string" && ASSUNTOS_DE_AJUDA.some((a) => a.id === valor);
}

export function rotuloDoAssunto(id: string | null | undefined): string {
  if (!id) return "—";
  return ASSUNTOS_DE_AJUDA.find((a) => a.id === id)?.label ?? id;
}

export type ErroDeAjuda = { campo: string; mensagem: string };

export type ResultadoDeAjuda =
  | { ok: true; dados: { assunto: AssuntoDeAjuda; mensagem: string } }
  | { ok: false; erros: ErroDeAjuda[] };

/** Mínimo para a mensagem ter conteúdo suficiente para alguém agir. */
export const MINIMO_DA_MENSAGEM = 15;

export function validarPedidoDeAjuda(corpo: unknown): ResultadoDeAjuda {
  const erros: ErroDeAjuda[] = [];
  const c = (corpo ?? {}) as Record<string, unknown>;

  const assunto = c.assunto;
  if (!assuntoValido(assunto)) {
    erros.push({ campo: "assunto", mensagem: "Escolha o assunto." });
  }

  const mensagem = typeof c.mensagem === "string" ? c.mensagem.trim() : "";
  if (mensagem.length < MINIMO_DA_MENSAGEM) {
    erros.push({
      campo: "mensagem",
      // Uma mensagem de três palavras obriga a uma troca de emails só para
      // perceber o que se passa — e essa troca custa dois dias a quem espera.
      mensagem: `Escreva o que se passa, com algum detalhe (pelo menos ${MINIMO_DA_MENSAGEM} caracteres).`,
    });
  }

  if (erros.length > 0) return { ok: false, erros };
  return {
    ok: true,
    dados: { assunto: assunto as AssuntoDeAjuda, mensagem: mensagem.slice(0, 4000) },
  };
}
