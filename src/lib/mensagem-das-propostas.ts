import type { Proposta } from "./negociacao";
import { contaDoCliente, regimeDeIva, taxasDaNegociacao, TAXA_IVA } from "./taxas-plataforma";

import { PROMESSA } from "./pagamento-na-plataforma";

/**
 * «5%» — a taxa DAQUELA negociação, escrita para uma pessoa ler.
 *
 * Era lido da constante, e isso passou a ser uma mentira no dia em que a taxa
 * ficou editável: o total já vinha calculado com a taxa que a negociação
 * guardou, e a frase ao lado continuava a dizer 5 %. Uma frase e um número a
 * discordar sobre dinheiro, na mesma linha.
 *
 * Sem decimais quando é redonda — «5%» e não «5,0%» — e com vírgula quando
 * não é, que é como se escreve em português.
 */
/** «23 %», escrito uma vez a partir da constante. */
const POR_CENTO = `${Math.round(TAXA_IVA * 100)} %`;

function taxaEmTexto(fraccao: number): string {
  const pontos = Math.round(fraccao * 10000) / 100;
  return `${(Number.isInteger(pontos) ? String(pontos) : pontos.toFixed(2)).replace(".", ",")}%`;
}

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
   * O imposto DO SERVIÇO desta proposta — zero se o profissional for isento.
   *
   * Existe para a frase da factura não anunciar 23 % a quem contrata um
   * isento do artigo 53.º: aí o que acresce é só o imposto da nossa taxa.
   */
  ivaDoServico: number;
};

type NegociacaoParaLer = {
  estado: string;
  profissionalNome: string;
  propostasJson: string | null;
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
};

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

    const valor = Number(ultima.valor);
    const conta = contaDoCliente(valor, regimeDeIva(n.regimeIva), taxasDaNegociacao(n));
    saida.push({
      profissional: n.profissionalNome,
      valor,
      taxaCliente: taxasDaNegociacao(n).cliente,
      semIva: conta.semIva,
      total: conta.total,
      ivaDoServico: conta.ivaDoServico,
    });
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
  return saida.sort((a, b) => a.semIva - b.semIva);
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
    const conta = contaDoCliente(valor, regimeDeIva(n.regimeIva), taxasDaNegociacao(n));
    return {
      profissional: n.profissionalNome,
      valor,
      taxaCliente: taxasDaNegociacao(n).cliente,
      semIva: conta.semIva,
      total: conta.total,
      ivaDoServico: conta.ivaDoServico,
    };
  }
  return null;
}

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/**
 * A ÚNICA FRASE QUE FALA DE IMPOSTO, e só se diz uma vez por mensagem.
 *
 * "Vamos apresentar os valores sempre sem IVA, caso o cliente deseje factura
 * são mais 23 %, deixamos isso claro apenas." — 17-09-2026.
 *
 * «23 %» só a quem vai mesmo pagar 23 %: o regime é do profissional, e um
 * isento pelo artigo 53.º não liquida nada sobre o serviço. A quem o contrata,
 * o que acresce com factura é só o imposto da NOSSA taxa — poucos euros — e
 * anunciar-lhe 23 % era mostrar-lhe um imposto que ninguém entrega ao Estado.
 */
function comFactura(p: PropostaParaOCliente): string {
  if (p.total <= p.semIva) return "";
  return p.ivaDoServico > 0
    ? `Com factura acrescem ${POR_CENTO} de IVA: ${euros(p.total)}.`
    : `Com factura acresce o IVA da taxa CLYON: ${euros(p.total)}.`;
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
  link: string;
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
    linhas.push(
      `Está combinado com ${d.fechado.profissional}${oQue !== "o seu pedido" ? ` para ${oQue}` : ""}:` +
        ` ${euros(d.fechado.semIva)} a pagar` +
        ` (${euros(d.fechado.valor)} para ele mais a taxa CLYON de ${taxaEmTexto(d.fechado.taxaCliente)}).`,
    );
    const facturaDoFechado = comFactura(d.fechado);
    if (facturaDoFechado) linhas.push(facturaDoFechado);
    linhas.push("");
    linhas.push(
      PROMESSA.whatsappConfirmar,
    );
  } else if (quantas === 0) {
    /*
     * SEM PROPOSTAS TAMBÉM SE ESCREVE — e diz-se a verdade.
     *
     * É a mensagem que ele manda quando o cliente pergunta «então?». Fingir
     * que há propostas seria o pior; ficar calado é o que já acontecia.
     */
    linhas.push(
      `Ainda não temos propostas para ${oQue}. Assim que` +
        ` chegarem, pode vê-las e responder aqui:`,
    );
  } else {
    linhas.push(
      quantas === 1
        ? `Já recebemos uma proposta para ${oQue}:`
        : `Já recebemos ${quantas} propostas para ${oQue}:`,
    );
    linhas.push("");
    for (const p of d.propostas) {
      /*
        UM NÚMERO POR PROFISSIONAL — o que ele paga se não pedir factura.

        Dizia «280,00 € — total a pagar 361,20 €», e com três propostas eram
        seis números numa mensagem de telemóvel. O valor dele fica entre
        parênteses porque é sobre ele que se negoceia; o número à frente do
        nome é o único que o cliente tem de comparar.
      */
      linhas.push(
        `${p.profissional}: ${euros(p.semIva)} (${euros(p.valor)} para ele mais a taxa CLYON)`,
      );
    }
    linhas.push("");
    /*
     * A TAXA, quando é a mesma em todas as propostas.
     *
     * Na prática é sempre: as negociações de um pedido nascem todas no mesmo
     * instante e guardam a mesma taxa. Mas um pedido reaberto depois de a taxa
     * mudar pode ter negociações de duas gerações — e aí a frase não pode dizer
     * um número, porque não há UM número. Cala-se sobre a percentagem e diz só
     * que a taxa entra no total, que é a parte que interessa e continua a ser
     * verdade. Cada linha acima já tem o seu total certo.
     */
    const taxas = new Set(d.propostas.map((p) => p.taxaCliente));
    const taxaUnica = taxas.size === 1 ? [...taxas][0] : null;
    /*
     * O IVA ENCOSTADO AOS NÚMEROS, e não num rodapé.
     *
     * Numa mensagem de WhatsApp, o que vem depois do link não se lê. Esta
     * frase fica onde a dúvida nasce — e é a ÚNICA que fala de imposto.
     *
     * "23 %" só quando é verdade para todos os da lista: o imposto é do regime
     * de quem factura, e um profissional na isenção do artigo 53.º não liquida
     * nenhum. Numa lista com os dois casos não há uma percentagem para dizer,
     * e diz-se o que é certo em vez de um número que engana metade dela.
     */
    const comImposto = d.propostas.filter((p) => p.ivaDoServico > 0).length;
    linhas.push(
      `Valores sem IVA, já com a taxa CLYON${taxaUnica != null ? ` de ${taxaEmTexto(taxaUnica)}` : ""}.` +
        (comImposto === 0
          ? " Com factura acresce só o IVA da taxa."
          : comImposto === quantas
            ? ` Com factura acrescem ${POR_CENTO} de IVA.`
            : " Com factura acresce o IVA de quem o liquida — nem todos os profissionais cobram."),
    );
    linhas.push("");
    /*
     * NÃO SE PROMETE "RECUSAR": esse botão não existe.
     *
     * `accoesDisponiveis` dá ao cliente aceitar, contratar, propor e desistir —
     * e desistir cancela o PEDIDO INTEIRO, não uma proposta. Prometer um botão
     * que não está lá é o que o põe ao telefone.
     */
    linhas.push(
      "No link em baixo aceita a proposta que preferir, ou propõe outro valor —" +
        " quem faz o trabalho é o profissional que escolher.",
    );
  }

  linhas.push("");
  linhas.push(d.link);
  linhas.push("");
  linhas.push("Qualquer dúvida, é só dizer.");

  return linhas.join("\n");
}
