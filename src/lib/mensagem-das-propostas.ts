import type { Proposta } from "./negociacao";
import { contaDoCliente, regimeDeIva } from "./taxas-plataforma";
import { PROMESSA } from "./pagamento-na-plataforma";

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
  /** O valor que ELE pede, sem IVA. */
  valor: number;
  /**
   * O que o cliente paga por esta proposta: valor + IVA do regime DELE + taxa.
   *
   * Vai na mensagem ao lado do valor, e não escondido atrás do link. No ecrã
   * do cliente, o cartão da proposta mostra o valor cru e o total só aparece
   * DEPOIS de contratar — ele decidia a olhar para 270 € e descobria 348,30 €
   * a seguir ao clique. Enquanto esse ecrã não mudar, é esta mensagem que o
   * protege; e mesmo depois de mudar, um número que se lê no WhatsApp antes de
   * abrir seja o que for continua a valer mais.
   */
  total: number;
};

type NegociacaoParaLer = {
  estado: string;
  profissionalNome: string;
  propostasJson: string | null;
  /** O regime de quem factura — decide se ao valor acresce IVA. */
  regimeIva?: string | null;
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
    saida.push({
      profissional: n.profissionalNome,
      valor,
      total: contaDoCliente(valor, regimeDeIva(n.regimeIva)).total,
    });
  }

  /*
   * Do mais barato para o mais caro, PELO TOTAL e não pela base.
   *
   * Com regimes de IVA diferentes as duas ordens divergem: 280 € de quem
   * liquida IVA são 361,20 € a pagar, e 300 € de um isento são 318 €. Ordenar
   * pela base punha o mais caro primeiro e dizia-lhe que era o mais barato.
   *
   * Ordena-se porque quem lê uma lista de preços lê-a de cima para baixo à
   * procura do menor, e comparar três números no telemóvel é trabalho que se
   * lhe pode poupar. A escolha continua inteiramente dele — e o mais barato
   * nem sempre é o que ele quer.
   */
  return saida.sort((a, b) => a.total - b.total);
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
    return {
      profissional: n.profissionalNome,
      valor,
      total: contaDoCliente(valor, regimeDeIva(n.regimeIva)).total,
    };
  }
  return null;
}

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

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
    linhas.push(
      `Está combinado com ${d.fechado.profissional}${oQue !== "o seu pedido" ? ` para ${oQue}` : ""}:` +
        ` ${euros(d.fechado.valor)} sem IVA, ${euros(d.fechado.total)} a pagar` +
        " (já com o imposto e a taxa CLYON de 6%).",
    );
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
      linhas.push(`${p.profissional}: ${euros(p.valor)} — total a pagar ${euros(p.total)}`);
    }
    linhas.push("");
    /*
     * O IVA NA MESMA LINHA DOS VALORES, e não num rodapé.
     *
     * "Temos de deixar claro que todos os valores praticados são sem IVA,
     * principalmente para os clientes."
     *
     * Numa mensagem de WhatsApp, o que vem depois do link não se lê. Esta
     * frase fica encostada aos números, que é onde a dúvida nasce — e diz para
     * onde ir buscar o total, em vez de deixar a conta ao cliente.
     */
    /*
     * O IVA ENCOSTADO AOS NÚMEROS, e não num rodapé.
     *
     * Numa mensagem de WhatsApp, o que vem depois do link não se lê. Esta
     * frase fica onde a dúvida nasce.
     *
     * "nem todos cobram" e não "23%": o imposto é do regime de quem factura, e
     * um profissional na isenção do artigo 53.º não liquida nenhum. Anunciar
     * 23% a toda a gente mostrava a metade deles um imposto que não devem.
     */
    linhas.push(
      "O primeiro valor é sem IVA. No total já entram o imposto — que nem todos" +
        " os profissionais cobram — e a taxa CLYON de 6%.",
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
