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
import { PROMESSA, PROMESSA_DO_NOVO_MODELO } from "./pagamento-na-plataforma";
import { DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO, NOVO_MODELO_DESDE_POR_EXTENSO, novoModeloEmVigor } from "./novo-modelo";
import { contaDoValorAcordado } from "./pagamento-directo";
import { quotaEmPontos } from "./quota-da-clyon";
import { TAXA_DAS_MUDANCAS_EM_FRASE, TAXA_DAS_MUDANCAS_SEM_NUMERO, TAXA_IVA, TAXA_MAXIMA, TAXA_TOTAL, type Taxas } from "./taxas-plataforma";

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

/*
 * O EXEMPLO DO «RECEBI EM DINHEIRO» — 03-11-2026 (d15). Uma proposta de 100 €
 * + IVA num pedido com a taxa de 11 % (a regra geral de 22-10-2026). As contas
 * fazem-se aqui, para os números do exemplo baterem sempre uns com os outros.
 *
 * A taxa do exemplo lê-se de `TAXA_TOTAL` (taxas-plataforma.ts) desde
 * 10-11-2026 (d28) — estava escrita à mão. O exemplo diz a taxa que usa
 * («num pedido com a taxa de…»); a de cada pedido é a que ele guardou.
 */
const EXEMPLO_EM_DINHEIRO = (() => {
  const semIva = 100;
  const taxa = TAXA_TOTAL;
  const iva = Math.round(semIva * TAXA_IVA * 100) / 100;
  const daTaxa = Math.round(semIva * taxa * 100) / 100;
  const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ","));
  return {
    taxa: `${Math.round(taxa * 100)} %`,
    semIva: n(semIva),
    comIva: n(semIva + iva),
    ganhos: n(semIva - daTaxa),
    entrega: n(iva + daTaxa),
    iva: n(iva),
    daTaxa: n(daTaxa),
  };
})();

function perguntasDoProfissionalNoModeloAntigo(taxas: Taxas | null): PerguntaFrequente[] {
  return [
    {
      pergunta: "Quanto é que a CLYON leva?",
      resposta:
        // A regra geral de 22-10-2026: a taxa sai do valor do trabalho, o IVA por cima. Dizia «6 % sobre
        // o valor acordado, e o cliente paga mais 5 % por cima» — as taxas de ORIGEM, de constantes.
        // A das negociações é a das Configs; um trabalho de valor fixo da CLYON traz a dele.
        `Nas negociações, a CLYON fica com ${aTaxaDasNegociacoes(taxas)}; nos trabalhos ` +
        // A das mudanças pela lista (d7, 11-11-2026): a ajuda só dizia a das negociações.
        `de valor fixo da CLYON, a taxa é a de cada trabalho. ${taxas ? TAXA_DAS_MUDANCAS_EM_FRASE : TAXA_DAS_MUDANCAS_SEM_NUMERO} Nunca tem de fazer ` +
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
      // Sem fotografias desde 30-10-2026: o prazo conta a partir do «Está feito».
      resposta:
        PROMESSA.proComoRecebe +
        " Depois de carregar em «Está feito» (sem fotografias), o cliente confirma; se não " +
        `disser nada, fecha-se sozinho ao fim de ${DIAS_ATE_LIBERTAR_SOZINHO} dias.`,
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
       * o serviço e tem a morada dentro do raio, emita ele factura ou não.
       */
      resposta:
        "Um pedido só lhe aparece se for de um serviço que faz e se a morada ficar dentro do raio " +
        "à volta da sua base. Confirme em Serviços e raio: apertar o raio ou tirar uma categoria faz o trabalho " +
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
    /*
     * «RECEBI EM DINHEIRO: E AGORA?» — 03-11-2026 (d15, aprovada pelo dono a
     * 04-11). Os parceiros activos perguntavam-no todas as semanas pelo
     * WhatsApp, e a equipa explicava a taxa de três maneiras. O texto é o do
     * Apoio, revisto pela Rede: cinco pontos e um exemplo, os botões com os
     * nomes da Carteira (painel e app). O recibo verde não é parecer: remete
     * para a CLYON ou para o contabilista.
     */
    {
      pergunta: "Recebi em dinheiro: e agora?",
      resposta: [
        "1. Veja no trabalho como o cliente paga. Se diz «Dinheiro no local», recebe dele o preço da proposta, " +
          "com IVA, e mais nada. Se diz que paga pela plataforma e o cliente lhe quer dar dinheiro, avise a CLYON " +
          "antes de receber.",
        "2. Fica consigo o valor dos seus ganhos, o mesmo que vê no trabalho. O resto, o IVA e a taxa da " +
          "plataforma, entrega-o à CLYON.",
        "3. Depois de o trabalho ser confirmado, a conta aparece em Carteira › Pagamentos em dinheiro: carregue " +
          "em «Pagar por MB WAY» ou «Gerar referência Multibanco». Se tiver saldo na Carteira, o valor fica " +
          "reservado e é descontado na transferência seguinte.",
        `4. Tem ${DIAS_PARA_PAGAR_A_DIVIDA} dias a partir daí. Se passarem, deixa de poder propor ou aceitar ` +
          "trabalhos pagos em dinheiro até a conta estar paga.",
        `5. A fatura ao cliente é passada pela ${EMPRESA_PARCEIRA_AO_PUBLICO}, já com o IVA. Sobre recibos verdes ` +
          "ou outros documentos seus, fale com a CLYON ou com o seu contabilista.",
        `Exemplo, num pedido com a taxa de ${EXEMPLO_EM_DINHEIRO.taxa}: proposta de ${EXEMPLO_EM_DINHEIRO.semIva} € + IVA. ` +
          `O cliente paga-lhe ${EXEMPLO_EM_DINHEIRO.comIva} €; fica com ${EXEMPLO_EM_DINHEIRO.ganhos} € e entrega ` +
          `${EXEMPLO_EM_DINHEIRO.entrega} € à CLYON (${EXEMPLO_EM_DINHEIRO.iva} € de IVA e ${EXEMPLO_EM_DINHEIRO.daTaxa} € de taxa). ` +
          "Num Trabalho CLYON, a conta faz-se da mesma maneira, com os ganhos que viu antes de aceitar.",
      ].join("\n"),
    },
  ];
}

/*
 * O EXEMPLO NO MODELO DE 15-11-2026 (d10) — a conta de `pagamento-directo.ts`, com
 * um parceiro com IVA: o cliente paga-lhe o total, e ele passa à CLYON a taxa e o
 * IVA dela.
 */
const EXEMPLO_NO_NOVO_MODELO = (() => {
  const c = contaDoValorAcordado(100, { cliente: 0, profissional: TAXA_TOTAL }, "normal");
  const n = (cent: number) => {
    const v = cent / 100;
    return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
  };
  return c
    ? {
        taxa: `${Math.round(TAXA_TOTAL * 100)} %`,
        total: n(c.totalAoClienteCent),
        fica: n(c.ficaAoProfissionalCent),
        passa: n(c.aPassarAClyonCent),
        daTaxa: n(c.taxaCent),
        ivaDaTaxa: n(c.ivaDaTaxaCent),
      }
    : null;
})();

/** As respostas do dinheiro no modelo de 15-11-2026 (d10). As outras ficam. */
function respostasDoNovoModelo(taxas: Taxas | null): Record<string, PerguntaFrequente> {
  return {
    "Quanto é que a CLYON leva?": {
      pergunta: "Quanto é que a CLYON leva?",
      resposta:
        `Nas negociações, a taxa da plataforma é ${aTaxaDasNegociacoes(taxas)}; nos trabalhos de valor fixo ` +
        `da CLYON, a taxa é a de cada trabalho. ${taxas ? TAXA_DAS_MUDANCAS_EM_FRASE : TAXA_DAS_MUDANCAS_SEM_NUMERO} ` +
        "O cliente paga-lhe diretamente o preço com IVA, que já inclui a taxa da plataforma e o IVA dela. Quando o " +
        "trabalho fecha, essa parte fica na sua carteira, em «A pagar à CLYON», como valor em atraso, com a " +
        `referência para a pagar. Tem ${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias; depois, a conta fica em stand-by ` +
        "— continua a ver os pedidos, mas não aceita nem envia propostas até o pagar. O pagamento confirmado " +
        "tira-a do stand-by sozinho.",
    },
    "Quando é que recebo o dinheiro?": {
      pergunta: "Quando é que recebo o dinheiro?",
      resposta:
        PROMESSA_DO_NOVO_MODELO.proComoRecebe +
        ` Nos trabalhos que o cliente já tinha pago antes de ${NOVO_MODELO_DESDE_POR_EXTENSO}, recebe da CLYON como ` +
        "antes, depois de o trabalho fechar: pede a transferência na sua carteira.",
    },
    "Recebi em dinheiro: e agora?": {
      pergunta: "O cliente pagou-me: e agora?",
      resposta: [
        "1. O cliente paga-lhe o preço da proposta, com IVA — por transferência para o seu IBAN, por MB WAY ou em " +
          "dinheiro no local, como escolheu no pedido.",
        "2. Fica consigo a sua parte. A taxa da plataforma e o IVA dela são da CLYON: quando o trabalho fecha, " +
          "aparecem na Carteira, em «A pagar à CLYON», como valor em atraso, com «Pagar por MB WAY» ou «Gerar " +
          "referência Multibanco».",
        `3. Tem ${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias. Se passarem, a conta fica em stand-by até pagar; o ` +
          "pagamento confirmado desbloqueia-a sozinho.",
        "4. A fatura do trabalho é sua: emita-a ao cliente e junte-a ao pedido. A da taxa da plataforma é passada " +
          `pela ${EMPRESA_PARCEIRA_AO_PUBLICO}.`,
        ...(EXEMPLO_NO_NOVO_MODELO
          ? [
              `Exemplo, num pedido com a taxa de ${EXEMPLO_NO_NOVO_MODELO.taxa} e um parceiro com IVA: proposta de 100 € + IVA. ` +
                `O cliente paga-lhe ${EXEMPLO_NO_NOVO_MODELO.total} €; fica com ${EXEMPLO_NO_NOVO_MODELO.fica} € e passa ` +
                `${EXEMPLO_NO_NOVO_MODELO.passa} € à CLYON (${EXEMPLO_NO_NOVO_MODELO.daTaxa} € de taxa e ${EXEMPLO_NO_NOVO_MODELO.ivaDaTaxa} € de IVA dela).`,
            ]
          : []),
      ].join("\n"),
    },
  };
}

/**
 * As perguntas do profissional, pela data: desde 15-11-2026 (d10) as do dinheiro
 * dizem o modelo novo. O painel passa as taxas em vigor.
 */
export function perguntasDoProfissional(taxas: Taxas | null, agora: Date = new Date()): PerguntaFrequente[] {
  const antigas = perguntasDoProfissionalNoModeloAntigo(taxas);
  if (!novoModeloEmVigor(agora)) return antigas;
  const novas = respostasDoNovoModelo(taxas);
  return antigas.map((p) => novas[p.pergunta] ?? p);
}

/**
 * As perguntas sem a percentagem — para quem ainda não lê a taxa em vigor (a
 * app CLYON Pro importa esta lista; as Apps passam a `perguntasDoProfissional`).
 * O painel usa `perguntasDoProfissional`.
 */
export const PERGUNTAS_DO_PROFISSIONAL: PerguntaFrequente[] = perguntasDoProfissionalNoModeloAntigo(null);

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
