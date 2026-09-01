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

import { MAX_PROPOSTAS_POR_LADO, PRAZO_DA_PROPOSTA_HORAS } from "./negociacao";
import { DIAS_ATE_LIBERTAR_SOZINHO } from "./trabalho";
import { MINIMO_PARA_LEVANTAR } from "./carteira";
import { TAXA_CLIENTE, TAXA_PROFISSIONAL } from "./taxas-plataforma";

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
      "O que aparece é o que recebe.",
  },
  {
    pergunta: "Quando é que recebo o dinheiro?",
    resposta:
      "O cliente paga à CLYON no momento em que o contrata, e o valor fica cativo — é a " +
      "garantia dele de que o trabalho é feito, e a sua de que o dinheiro existe. Depois de " +
      "marcar o trabalho como feito, o cliente confirma e o valor passa a disponível. Se ele " +
      `não disser nada, liberta-se sozinho ao fim de ${DIAS_ATE_LIBERTAR_SOZINHO} dias.`,
  },
  {
    pergunta: "Como levanto o saldo?",
    resposta:
      "Em A minha carteira › Transferir. Indique primeiro o IBAN em Conta bancária. O mínimo " +
      `por transferência é de ${MINIMO_PARA_LEVANTAR} €, e costuma chegar em um a dois dias ` +
      "úteis. Enquanto o pedido estiver a ser processado aparece como «a caminho».",
  },
  {
    pergunta: "Porque é que não recebo pedidos?",
    resposta:
      "Um pedido só lhe aparece se for de um serviço que faz e se a morada dele estiver " +
      "dentro do raio que indicou, contado a partir da sua base. Confirme em Serviços e " +
      "zonas: apertar o raio ou tirar uma categoria faz o trabalho deixar de aparecer sem " +
      "nada avisar. Pedidos que exigem guia de transporte só vão para quem tem a guia " +
      "verificada, e pedidos com fatura só para quem emite.",
  },
  {
    pergunta: "Como funcionam as propostas?",
    resposta:
      `Cada lado tem ${MAX_PROPOSTAS_POR_LADO} propostas e ${PRAZO_DA_PROPOSTA_HORAS} horas ` +
      "para responder a cada uma. Só valores, sem mensagens — é isso que impede combinações " +
      "por fora e o que mantém o pagamento garantido. Se a proposta expirar, não gasta " +
      "nenhuma das suas. Aceitar não fecha o trabalho: o cliente ainda tem de o contratar.",
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
      "O regime é seu, não nosso. Escolha-o em Faturação e IVA: isento pelo artigo 53.º, ou " +
      "regime normal a 23 %. Se estiver no normal, o IVA vem incluído no valor acordado e " +
      "aparece decomposto na confirmação do cliente — nunca é somado por cima.",
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
