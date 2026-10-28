import { EMPRESA_PARCEIRA_AO_PUBLICO } from "./identificacao-legal";

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
import { DIAS_PARA_PAGAR_A_DIVIDA } from "./divida-do-profissional";
import { PROMESSA } from "./pagamento-na-plataforma";
import { quotaEmPontos } from "./quota-da-clyon";
import { TAXA_MAXIMA, type Taxas } from "./taxas-plataforma";

export type PerguntaFrequente = {
  pergunta: string;
  resposta: string;
};

/*
 * A TAXA EM VIGOR, E NÃO A QUE ESTAVA ESCRITA — 28-10-2026 (d8).
 *
 * A resposta dizia a percentagem à mão. A taxa das negociações muda nas
 * Configs (`taxasActuais`), e /quero-ser-parceiro, /profissionais e os Termos
 * já a liam de lá: no dia em que mudasse, só a ajuda ficava com o número
 * antigo. Agora diz a de hoje — o painel recebe-a de /api/profissionais/ajuda.
 * Sem ela (a app CLYON Pro, enquanto não a ler da mesma rota), diz o nome da
 * taxa sem número, em vez de um número que pode estar errado.
 */
function aTaxaDasNegociacoes(taxas: Taxas | null): string {
  return taxas
    ? `${quotaEmPontos(taxas)} do valor do trabalho, sem IVA`
    : "a taxa da plataforma em vigor, contada sobre o valor do trabalho sem IVA";
}

/** As taxas que /api/profissionais/ajuda devolve — ou nada, se não vierem inteiras. */
export function taxasDaAjuda(v: unknown): Taxas | null {
  const t = v as Partial<Taxas> | null | undefined;
  const boa = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= TAXA_MAXIMA;
  return t && boa(t.cliente) && boa(t.profissional) ? { cliente: t.cliente, profissional: t.profissional } : null;
}

export function perguntasDoProfissional(taxas: Taxas | null): PerguntaFrequente[] {
  return [
    {
      pergunta: "Quanto é que a CLYON leva?",
      resposta:
        // A regra geral de 22-10-2026: a taxa sai do valor do trabalho, o IVA por cima. Dizia «6 % sobre
        // o valor acordado, e o cliente paga mais 5 % por cima» — as taxas de ORIGEM, de constantes.
        // A das negociações é a das Configs; um trabalho de valor fixo da CLYON traz a dele.
        `Nas negociações, a CLYON fica com ${aTaxaDasNegociacoes(taxas)}; nos trabalhos ` +
        "de valor fixo da CLYON, a taxa é a de cada trabalho. Nunca tem de fazer " +
        "contas: os valores que vê na sua conta já são líquidos, com a taxa da plataforma descontada. " +
        "O que aparece é o que recebe. O cliente vê o seu valor com IVA " +
        "incluído. Se ele pagar em dinheiro, no local, recebe dele o preço com IVA e entrega " +
        "depois à CLYON o IVA e a taxa da plataforma, por referência MB WAY ou Multibanco. " +
        // «Abater no saldo + bloquear» — decisão do dono, 01-10-2026.
        "Enquanto não os pagar, esse valor fica reservado no seu saldo (e é abatido quando " +
        "lhe transferirmos o resto); se passarem " +
        `${DIAS_PARA_PAGAR_A_DIVIDA} dias sem os pagar, deixa de poder propor e aceitar ` +
        "trabalhos em dinheiro até estarem pagos — os pagos pela plataforma continuam.",
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
      // As fotografias são opcionais desde 26-10-2026 (d22): sem elas não há prazo.
      resposta:
        PROMESSA.proComoRecebe +
        " Depois de marcar o trabalho como feito (com fotografias, se as tiver), o cliente " +
        `confirma; se não disser nada, fecha-se sozinho ao fim de ${DIAS_ATE_LIBERTAR_SOZINHO} dias. ` +
        "Sem fotografias, a CLYON confirma com o cliente antes de libertar o pagamento.",
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
        `Ao cliente, nenhum: quem lhe passa a fatura é a ${EMPRESA_PARCEIRA_AO_PUBLICO}, ` +
        "e é ela que liquida os 23 % — há fatura em todas as vendas, e os preços que o " +
        "cliente vê já vêm com IVA incluído. Em dinheiro, o IVA que recebe do cliente entrega-o à " +
        "CLYON, com a taxa da plataforma, por referência. O seu regime continua a " +
        "contar entre si e nós — declare-o em Faturação e IVA — e é com ele que nos fatura " +
        "a si o que recebe.",
    },
  ];
}

/**
 * As perguntas sem a percentagem — para quem ainda não lê a taxa em vigor (a
 * app CLYON Pro importa esta lista). O painel usa `perguntasDoProfissional`.
 */
export const PERGUNTAS_DO_PROFISSIONAL: PerguntaFrequente[] = perguntasDoProfissional(null);

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
