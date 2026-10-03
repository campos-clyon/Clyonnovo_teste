import type { Proposta } from "./negociacao";
import { taxasDaNegociacao, TAXA_IVA } from "./taxas-plataforma";
import { precoDoCliente, semEComIva } from "./preco-do-cliente";
import { modeloDaNegociacao, type ModeloDoPreco } from "./iva-incluido";

import { promessaDaForma } from "./pagamento-na-plataforma";
import {
  FORMA_EM_PALAVRAS,
  FORMA_EM_PALAVRAS_ANTES_DO_IVA_INCLUIDO,
  lerForma,
  type FormaDePagamento,
} from "./forma-de-pagamento";
import { totalEmPalavras } from "./conta-em-palavras";
import { ORCAMENTOS_A_DISTANCIA, ORCAMENTO_A_DISTANCIA } from "./orcamento-a-distancia";

/** «23 %», escrito uma vez a partir da constante. */
const POR_CENTO = `${Math.round(TAXA_IVA * 100)} %`;

/*
 * A PERCENTAGEM DA TAXA SAIU DA MENSAGEM — 29-09-2026.
 *
 * Havia aqui um `taxaEmTexto` que escrevia «5%» ao lado de cada proposta:
 * «283,50 € (270,00 € para ele mais a taxa CLYON de 5%)». Desde que o preço
 * se diz já com a taxa (`preco-do-cliente.ts`), não há conta nenhuma para o
 * cliente refazer — e uma percentagem sem conta para fazer é só uma pergunta
 * à espera de ser feita.
 */

/**
 * A MENSAGEM PRONTA A MANDAR AO CLIENTE, com as propostas que recebeu.
 *
 * "Gostaria que ele viesse já com uma mensagem resumida para enviar ao cliente
 * sobre as propostas que ele recebeu — como no exemplo, mas informando que são
 * valores sem IVA."
 *
 * Ele escrevia-a à mão, uma a uma, no WhatsApp. Escrever à mão vinte vezes por
 * semana é onde nascem os enganos que custam dinheiro: um valor trocado, um
 * nome de outro profissional, e — o mais caro de todos — não dizer que ao
 * número acresce imposto.
 *
 * O QUE ESTA MENSAGEM NUNCA FAZ
 *
 * Não inventa propostas. Só entram os profissionais que puseram mesmo um
 * número em cima da mesa: ou contrapropuseram, ou aceitaram o valor do
 * cliente. Quem ainda não respondeu não aparece — dizer «recebemos 3 propostas»
 * quando são 2 é a forma mais rápida de perder a confiança de quem lê.
 */

export type PropostaParaOCliente = {
  profissional: string;
  /*
   * A TAXA DESTA NEGOCIAÇÃO, para a frase e a conta dizerem o mesmo.
   *
   * A mensagem dizia «a taxa CLYON de 5 %» lido da constante, enquanto o
   * total já era calculado com a taxa que aquela negociação guardou. Com uma
   * taxa mudada no backoffice, o cliente lia 5 % e pagava outra coisa — uma
   * frase e um número a discordar sobre dinheiro, na mesma linha.
   */
  taxaCliente: number;
  /** O valor que ELE pede, sem IVA. */
  valor: number;
  /**
   * O QUE ELE PAGA: valor mais a taxa CLYON, SEM IVA. É o número da mensagem.
   *
   * "Vamos apresentar os valores sempre sem IVA." — 17-09-2026. Vai ao lado do
   * valor e não escondido atrás do link: no ecrã do cliente o cartão mostra o
   * valor cru, e quem lê no WhatsApp decide antes de abrir seja o que for.
   */
  semIva: number;
  /** O que pagaria COM FACTURA: o de cima mais o imposto. Fica numa linha só. */
  total: number;
  /**
   * O MODELO DA NEGOCIAÇÃO — 01-10-2026. Com IVA incluído, o número da
   * mensagem é o `total` (`aPagar`) e não há linha «com factura acrescem».
   */
  modelo: ModeloDoPreco;
  /** O número da mensagem: o total com IVA incluído, o `semIva` antes do corte. */
  aPagar: number;
  /**
   * COMO O CLIENTE PAGA — 29-09-2026.
   *
   * Em dinheiro são duas entregas: o serviço em notas ao profissional e a
   * taxa à CLYON por referência. Um número só lia-se como um pagamento só, e
   * a linha que explica para que serve confirmar dizia-lhe o que acontece a
   * um dinheiro que nunca passa por nós.
   */
  forma: FormaDePagamento;
};

type NegociacaoParaLer = {
  estado: string;
  profissionalNome: string;
  propostasJson: string | null;
  /** Como o cliente paga esta negociação. Nula = na plataforma. */
  formaDePagamento?: string | null;
  /** O regime de quem factura — decide se ao valor acresce IVA. */
  regimeIva?: string | null;
  /*
   * A comissão com que esta negociação nasceu.
   *
   * É o número que o cliente vê na mensagem — «fica em 387,45 €» — e é uma
   * promessa. A taxa pode mudar no backoffice; o que já foi dito a alguém
   * não pode mudar com ela.
   */
  taxaCliente?: string | number | null;
  taxaProfissional?: string | number | null;
  /** Quando a negociação abriu — decide o modelo do preço (01-10-2026). */
  criadaEm?: string | Date | null;
};

/** Os dois números de uma proposta — «294,00 € + IVA = 361,62 €» — ou o de sempre antes do corte. */
function precoDaLinha(p: PropostaParaOCliente): string {
  return semEComIva({ semIva: p.semIva, total: p.total, ivaIncluido: p.modelo === "iva_incluido" });
}

/** A proposta, contada no modelo da negociação. */
function paraOCliente(n: NegociacaoParaLer, valor: number): PropostaParaOCliente {
  const modelo = modeloDaNegociacao(n.criadaEm);
  const conta = precoDoCliente(valor, taxasDaNegociacao(n), modelo);
  return {
    profissional: n.profissionalNome,
    valor,
    taxaCliente: taxasDaNegociacao(n).cliente,
    semIva: conta.semIva,
    total: conta.total,
    modelo,
    aPagar: conta.aPagar,
    forma: lerForma(n.formaDePagamento),
  };
}

function lerPropostas(json: string | null): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

/**
 * O que cada profissional está a pedir, neste momento.
 *
 * Há duas formas de um profissional ter um número em cima da mesa, e as duas
 * contam:
 *
 *   · CONTRAPROPÔS — a última proposta é dele, e é esse o preço;
 *   · ACEITOU o valor do cliente — a última proposta é do cliente e está
 *     `aceite`. O número é o mesmo que o cliente pediu, mas agora tem alguém
 *     por trás dele, e é isso que o torna uma proposta.
 *
 * Quem ainda não respondeu não tem número nenhum — e não entra. Negociações
 * mortas ou desistidas também não: essas já não são uma escolha.
 */
export function propostasParaOCliente(
  negociacoes: NegociacaoParaLer[],
): PropostaParaOCliente[] {
  const saida: PropostaParaOCliente[] = [];

  for (const n of negociacoes ?? []) {
    /*
     * O que já está FECHADO não é uma proposta em cima da mesa.
     *
     * Um trabalho `acordada` já foi escolhido — convidar o cliente a "aceitar
     * a proposta que preferir" quando ele já escolheu é mandá-lo decidir uma
     * coisa que está decidida. Esse caso tem mensagem própria, mais abaixo.
     */
    if (n.estado === "acordada") continue;
    if (n.estado === "desistida" || n.estado === "morta") continue;

    const propostas = lerPropostas(n.propostasJson);
    const ultima = propostas.at(-1);
    if (!ultima || !Number.isFinite(Number(ultima.valor))) continue;

    const dele = ultima.por === "profissional";
    const aceitouONosso = ultima.por === "cliente" && ultima.estado === "aceite";
    if (!dele && !aceitouONosso) continue;

    /* Uma proposta recusada já não está em cima da mesa. */
    if (ultima.estado === "recusada" || ultima.estado === "expirada") continue;

    saida.push(paraOCliente(n, Number(ultima.valor)));
  }

  /*
   * Do mais barato para o mais caro, PELO NÚMERO QUE ELE VÊ.
   *
   * Ordena-se porque quem lê uma lista de preços lê-a de cima para baixo à
   * procura do menor, e comparar três números no telemóvel é trabalho que se
   * lhe pode poupar. A escolha continua inteiramente dele — e o mais barato
   * nem sempre é o que ele quer.
   *
   * Pelo `semIva`, que é o que está escrito em cada linha. Ordenava-se pelo
   * total com imposto, e com regimes diferentes as duas ordens divergiam — a
   * lista aparecia desordenada aos olhos de quem a lia, porque os números à
   * vista não eram os números da ordenação. Ordena-se pelo que se mostra.
   */
  return saida.sort((a, b) => a.aPagar - b.aPagar);
}

/**
 * O trabalho já fechado, quando há um.
 *
 * O link continua a servir depois de o cliente contratar — é por lá que ele
 * acompanha e confirma. Mas a mensagem que o acompanha tem de mudar: já não há
 * escolha nenhuma para fazer.
 */
export function trabalhoFechado(
  negociacoes: NegociacaoParaLer[],
): PropostaParaOCliente | null {
  for (const n of negociacoes ?? []) {
    if (n.estado !== "acordada") continue;
    const ultima = lerPropostas(n.propostasJson).at(-1);
    const valor = Number(ultima?.valor);
    if (!Number.isFinite(valor)) continue;
    return paraOCliente(n, valor);
  }
  return null;
}

/**
 * EM DINHEIRO, A FRASE DAS DUAS ENTREGAS — a mesma de todos os canais.
 *
 * É `totalEmPalavras`, e não uma terceira redacção: o WhatsApp do assistente
 * e o ecrã do fecho já a dizem assim. A conta do cliente só lê a taxa DELE
 * (`contaDoCliente`), e é essa que a proposta guarda — a do profissional,
 * em dinheiro, é zero e não entra aqui.
 */
function emDinheiroEmPalavras(p: PropostaParaOCliente): string {
  return totalEmPalavras(p.valor, p.modelo, { cliente: p.taxaCliente, profissional: 0 }, "dinheiro");
}

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/**
 * A ÚNICA FRASE QUE FALA DE IMPOSTO, e só se diz uma vez por mensagem.
 *
 * "Vamos apresentar os valores sempre sem IVA, caso o cliente deseje factura
 * são mais 23 %, deixamos isso claro apenas." — 17-09-2026.
 *
 * UMA FRASE SÓ, desde 22-09-2026. Havia duas porque o imposto era do regime
 * de quem facturava, e um profissional na isenção do artigo 53.º não liquidava
 * nada sobre o serviço. Agora quem factura é uma empresa parceira, e é 23 % sobre tudo.
 */
function comFactura(p: PropostaParaOCliente): string {
  // Com IVA incluído (01-10-2026) não há linha: o número dito já leva o imposto.
  if (p.modelo === "iva_incluido") return "";
  if (p.total <= p.semIva) return "";
  return `Com factura acrescem ${POR_CENTO} de IVA: ${euros(p.total)}.`;
}

/**
 * O primeiro nome, para a saudação.
 *
 * "Olá, Maria" lê-se melhor do que "Olá, Maria Alexandra Antunes Ferreira".
 * Sem nome, cumprimenta-se na mesma — «Olá!» é melhor do que um espaço em
 * branco onde devia estar uma pessoa.
 */
function primeiroNome(nome: string | null | undefined): string | null {
  const limpo = (nome ?? "").trim();
  if (!limpo) return null;
  const primeiro = limpo.split(/\s+/)[0];
  return primeiro.length >= 2 ? primeiro : limpo;
}

/**
 * O SERVIÇO COM O ARTIGO CERTO.
 *
 * A primeira versão escrevia "propostas para a esvaziamento de apartamento" —
 * o artigo colado à mão, sempre no feminino, porque a maioria dos serviços
 * começa por «recolha». Um erro de concordância numa mensagem que sai em nome
 * da casa faz-nos parecer uma máquina mal afinada, que é precisamente o
 * contrário do que esta mensagem existe para transmitir.
 *
 * O género vem do substantivo que encabeça o nome, e não de adivinhar pela
 * terminação: «mudança» acaba em -a e é feminino, «esvaziamento» acaba em -o e
 * é masculino, mas «montagem» acaba em -m e também é feminino. Uma lista curta
 * do que existe é mais fiável do que qualquer regra.
 *
 * O QUE NÃO CONHECE, NÃO ARRISCA. Um serviço novo devolve `null`, e a frase
 * reescreve-se sem artigo nenhum — "propostas para o seu pedido". Preferível a
 * uma concordância errada.
 */
const ARTIGO: Record<string, "a" | "o"> = {
  recolha: "a",
  esvaziamento: "o",
  mudança: "a",
  mudanca: "a",
  montagem: "a",
  transporte: "o",
  entrega: "a",
  limpeza: "a",
  desmontagem: "a",
};

export function servicoComArtigo(nome: string | null | undefined): string | null {
  const limpo = (nome ?? "").trim();
  if (!limpo) return null;
  const primeira = limpo.split(/\s+/)[0].toLowerCase();
  const artigo = ARTIGO[primeira];
  return artigo ? `${artigo} ${limpo}` : null;
}

export type DadosDaMensagem = {
  nomeCliente?: string | null;
  /** O serviço por extenso: "recolha de entulho". */
  servico?: string | null;
  cidade?: string | null;
  propostas: PropostaParaOCliente[];
  /** Preenchido quando o cliente já contratou alguém. Ver `trabalhoFechado`. */
  fechado?: PropostaParaOCliente | null;
  /*
   * SEM LINK — 03-10-2026. *«Não coloque a mensagem do link e nem o link,
   * vamos fazer manualmente.»* A mensagem diz as propostas e pede-lhe que
   * diga qual prefere; o resto trata-o a CLYON, à mão. Ver o fim de
   * `mensagemDasPropostas`.
   */
};

/**
 * A mensagem, pronta a colar no WhatsApp.
 *
 * Texto simples e curto: é lida no telemóvel, muitas vezes na rua. Sem
 * formatação, sem emojis, sem parágrafos de três linhas.
 */
export function mensagemDasPropostas(d: DadosDaMensagem): string {
  const nome = primeiroNome(d.nomeCliente);
  const quantas = d.propostas.length;

  /*
   * "para a recolha de entulho em Carnaxide" — ou, quando o serviço é novo e o
   * artigo é desconhecido, "para o seu pedido". Nunca uma concordância errada.
   */
  const comArtigo = servicoComArtigo(d.servico);
  const onde = d.cidade?.trim() ? ` em ${d.cidade.trim()}` : "";
  const oQue = comArtigo ? `${comArtigo}${onde}` : "o seu pedido";

  const linhas: string[] = [];

  linhas.push(nome ? `Olá, ${nome}!` : "Olá!");
  linhas.push("");

  if (d.fechado) {
    /*
     * JÁ ESTÁ FECHADO — e a mensagem deixa de ser um convite a escolher.
     *
     * O link continua a servir: é por lá que ele acompanha e confirma o
     * trabalho no fim. Mandar-lhe a lista de propostas depois de ter
     * escolhido seria pedir-lhe para decidir o que já decidiu.
     */
    /*
      UM NÚMERO, e o imposto numa linha à parte.

      Dizia «280,00 € sem IVA, 361,20 € a pagar (já com o imposto do
      profissional e a taxa CLYON de 5 %)» — três números e uma parêntese numa
      frase só, lida na rua, no telemóvel. Um cliente que não queria factura
      leu isto, não percebeu qual era o dele, e pagou ao profissional os 280 €
      sem os 14 € da nossa taxa.
    */
    /*
      E DESDE 29-09-2026 UM NÚMERO SÓ: o preço dele, já com a taxa. Dizia
      «(270,00 € para ele mais a taxa CLYON de 5%)» — a conta a ser feita à
      frente de quem já escolheu.
    */
    linhas.push(
      `Está combinado com ${d.fechado.profissional}${oQue !== "o seu pedido" ? ` para ${oQue}` : ""}:` +
        ` ${precoDaLinha(d.fechado)} a pagar.`,
    );
    if (d.fechado.forma === "dinheiro") {
      /*
        EM DINHEIRO SÃO DUAS ENTREGAS — 29-09-2026. O número de cima é o total
        dele, mas não vai todo para o mesmo sítio: o serviço em notas ao
        profissional e a taxa à CLYON por referência. É a frase que o assistente
        diz no mesmo momento, e a factura, em dinheiro, é só da taxa — vem lá
        dentro, em vez da linha dos 23 % sobre tudo.
      */
      linhas.push(emDinheiroEmPalavras(d.fechado));
    } else {
      const facturaDoFechado = comFactura(d.fechado);
      if (facturaDoFechado) linhas.push(facturaDoFechado);
    }
    /*
      E COMO É QUE ESTE NÚMERO FOI FEITO.

      Aqui é onde mais importa: já está combinado, e o que falta é o dia. Se
      o valor mudar à porta, é agora que ele tem de saber que isso é possível
      — e não no instante em que acontece.
    */
    linhas.push(ORCAMENTO_A_DISTANCIA);
    linhas.push("");
    // Para que serve confirmar depende de por onde passa o dinheiro. Sem o
    // «no link em baixo» desde 03-10-2026 — a mensagem já não leva o link.
    linhas.push(promessaDaForma(d.fechado.forma, d.fechado.modelo).whatsappConfirmar);
  } else if (quantas === 0) {
    /*
     * SEM PROPOSTAS TAMBÉM SE ESCREVE — e diz-se a verdade.
     *
     * É a mensagem que ele manda quando o cliente pergunta «então?». Fingir
     * que há propostas seria o pior; ficar calado é o que já acontecia.
     */
    linhas.push(`Ainda não temos propostas para ${oQue}. Assim que chegarem, avisamos.`);
  } else {
    linhas.push(
      quantas === 1
        ? `Já recebemos uma proposta para ${oQue}:`
        : `Já recebemos ${quantas} propostas para ${oQue}:`,
    );
    linhas.push("");
    const todasComIva = d.propostas.every((p) => p.modelo === "iva_incluido");
    const misturadas = !todasComIva && d.propostas.some((p) => p.modelo === "iva_incluido");
    for (const p of d.propostas) {
      /*
        UM NÚMERO POR PROFISSIONAL — o que ele paga se não pedir factura.

        Dizia «280,00 € — total a pagar 361,20 €», e com três propostas eram
        seis números numa mensagem de telemóvel. Depois ficou o valor do
        profissional entre parênteses, «porque é sobre ele que se negoceia».
        Desde 29-09-2026 negoceia-se sobre o preço do cliente — é esse que ele
        escreve quando contrapropõe —, e o parêntese saiu com a razão dele.
      */
      /*
        E DESDE 03-10-2026 OS DOIS NÚMEROS: «294,00 € + IVA = 361,62 €». O que
        se paga continua a ser um — o do fim —, e o de antes diz de que é feito.
      */
      linhas.push(`${p.profissional}: ${precoDaLinha(p)}`);
    }
    linhas.push("");
    /*
     * O IVA ENCOSTADO AOS NÚMEROS, e não num rodapé.
     *
     * Numa mensagem de WhatsApp, o que vem depois do link não se lê. Esta
     * frase fica onde a dúvida nasce — e é a ÚNICA que fala de imposto.
     *
     * UMA FRASE, E JÁ NÃO TRÊS — 22-09-2026.
     *
     * Havia três porque o imposto era do regime de quem facturava: uma lista
     * com um isento do artigo 53.º e um do regime normal não tinha uma
     * percentagem que servisse para os dois, e a mensagem acabava a dizer
     * «acresce o IVA de quem o liquida — nem todos os profissionais cobram».
     * Era verdade e não ajudava ninguém a somar.
     *
     * Quem factura passou a ser a CLYON, e a factura é a mesma venha a
     * proposta de quem vier: 23 % sobre tudo, a quem a pedir.
     *
     * E SEM A TAXA CLYON — 29-09-2026. Dizia «Valores sem IVA, já com a taxa
     * CLYON de 5%». Com os preços a chegarem-lhe já com ela lá dentro, a
     * percentagem era a única coisa na mensagem que o convidava a fazer uma
     * conta — e não havia conta nenhuma para fazer.
     */
    /*
     * EM DINHEIRO, QUEM RECEBE O QUÊ — e a factura é só da taxa. 29-09-2026.
     *
     * O serviço vai em notas ao profissional e não passa pela CLYON; o que se
     * factura é o que ela cobra. «Com factura acrescem 23 % de IVA», dito a
     * quem escolheu dinheiro, anunciava imposto sobre um valor que ninguém vai
     * facturar. As negociações de um pedido nascem todas com a forma que o
     * cliente escolheu, por isso a lista é de uma forma só.
     */
    const emDinheiro = d.propostas.every((p) => p.forma === "dinheiro");
    /*
     * COM IVA INCLUÍDO — 01-10-2026. "O cliente vê um número só por proposta,
     * já com a taxa da CLYON e com 23 % de IVA." Uma frase, e nenhuma conta
     * por fazer. Em dinheiro, a quem entrega: ao profissional, tudo.
     *
     * As negociações de um pedido podem ter nascido dos dois lados do corte
     * (uma redistribuição depois dele). Aí cada linha diz o seu, e a frase
     * explica as duas.
     */
    if (todasComIva) {
      linhas.push(
        emDinheiro
          ? `O valor a pagar é o com IVA. ${FORMA_EM_PALAVRAS.dinheiro.cliente}`
          : "O valor a pagar é o com IVA.",
      );
    } else if (misturadas) {
      linhas.push(
        `Nos valores com «+ IVA» paga-se o total; aos outros, com factura, acrescem ${POR_CENTO} de IVA.`,
      );
    } else {
      linhas.push(
        emDinheiro
          ? `Valores sem IVA. ${FORMA_EM_PALAVRAS_ANTES_DO_IVA_INCLUIDO.dinheiro.cliente} Com factura, acrescem ${POR_CENTO} de IVA sobre a taxa da CLYON.`
          : `Valores sem IVA. Com factura acrescem ${POR_CENTO} de IVA.`,
      );
    }
    /*
     * COMO É QUE ESTES NÚMEROS FORAM FEITOS, na linha a seguir aos números.
     *
     * "Temos que também dizer aos clientes, de forma simples, que esses
     * orçamentos são online, portanto carecem de confirmação de uma colega no
     * local." — 18-09-2026.
     *
     * Encostada aos valores e antes do link, pela mesma razão que a linha do
     * IVA: numa mensagem de WhatsApp, o que vem depois do link não se lê.
     */
    linhas.push(ORCAMENTOS_A_DISTANCIA);
    linhas.push("");
    /*
     * NÃO SE PROMETE "RECUSAR": esse botão não existe.
     *
     * `accoesDisponiveis` dá ao cliente aceitar, contratar, propor e desistir —
     * e desistir cancela o PEDIDO INTEIRO, não uma proposta. Prometer um botão
     * que não está lá é o que o põe ao telefone.
     */
    /*
     * SEM O LINK — 03-10-2026. *«Não coloque a mensagem do link e nem o link,
     * vamos fazer manualmente.»* Ele responde a dizer qual quer, e a CLYON
     * trata do resto à mão.
     */
    linhas.push(
      "Diga-nos qual prefere e tratamos do resto — quem faz o trabalho é o profissional que escolher.",
    );
  }

  linhas.push("");
  linhas.push("Qualquer dúvida, é só dizer.");

  return linhas.join("\n");
}
