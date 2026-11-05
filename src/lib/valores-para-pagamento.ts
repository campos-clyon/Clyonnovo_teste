import { comoTratar } from "./whatsapp-recolha";
import { servicoEmPalavras } from "./servico-em-palavras";
import { lerBase, ePorUnidade, unidadeDaBase } from "./base-do-preco";
import { notaDoPrecoParaOCliente } from "./itens-a-mais";
import { emEuros, type ContaDoPagamento } from "./conta-do-pagamento";
import { TAXA_IVA } from "./taxas-plataforma";
import { TELEFONE_DA_CLYON_DIGITOS } from "./telefone-da-clyon";

/**
 * «ENVIAR VALORES PARA PAGAMENTO» — 05-11-2026 (decisão d19).
 *
 * *«Temos que ter um botão para enviar os valores finais para pagamento;
 * nesse botão devem ir os dados para pagamento e a mensagem.»* — o dono. O
 * botão ficou no lugar do «Enviar pela CLYON» do cartão do Trabalho CLYON (na
 * Mesa e nos Trabalhos CLYON), e sai pelo mesmo caminho: o WhatsApp da CLYON.
 *
 * O QUE LEVA: os valores finais da conta do trabalho — o sem IVA, o IVA e o
 * total com IVA, que é o número a pagar —, todos da conta em degraus
 * (`contaDoTrabalhoClyon`), nunca escritos à mão; o serviço, o n.º do pedido e
 * o dia; e o link do pedido, onde o cliente paga por MB WAY, por Multibanco ou
 * por transferência.
 *
 * O QUE NÃO LEVA: os dados de pessoas (MB WAY, IBAN, Revolut). *«Só o link da
 * CLYON»* — o dono. O bloco «Métodos de pagamento» das Configs fica com o
 * «Enviar adjudicação», e não entra aqui.
 *
 * O LINK NASCE AO ENVIAR: o token do pedido só existe em hash, e cada link
 * novo mata o anterior (`linkParaQuemFechou`). Na pré-visualização vai o
 * marcador `LINK_POR_GERAR`, que o servidor troca pelo link no momento em que
 * a mensagem sai.
 */

/** O lugar do link na pré-visualização; o servidor troca-o pelo link verdadeiro. */
export const LINK_POR_GERAR = "[o link do pedido entra aqui ao enviar]";

export type ValoresParaPagamento = {
  pedidoId: number;
  cliente: string | null;
  servico: string | null;
  localidade: string | null;
  /** O dia do trabalho: o combinado com o parceiro, ou o pedido pelo cliente. */
  quando: string | Date | null;
  /** Pelo trabalho todo, por carga ou por hora. */
  base?: string | null;
  conta: Pick<ContaDoPagamento, "semIva" | "iva" | "total">;
  /** O link do pedido; sem ele, o marcador da pré-visualização. */
  link?: string | null;
};

function diaPorExtenso(quando: string | Date | null): string | null {
  if (!quando) return null;
  const d = new Date(quando);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

const maiuscula = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** A mensagem pronta, em voz de plataforma, com «parceiro». */
export function mensagemDosValoresParaPagamento(v: ValoresParaPagamento, agora: Date): string {
  const base = lerBase(v.base);
  const unidade = unidadeDaBase(base);
  const servico = servicoEmPalavras(v.servico);
  const onde = v.localidade?.trim() ? ` em ${v.localidade.trim()}` : "";
  const dia = diaPorExtenso(v.quando);
  const semFactura = v.conta.iva === 0;

  const linhaDoPedido = [
    `Pedido n.º ${v.pedidoId}`,
    servico ? `${maiuscula(servico)}${onde}` : null,
    dia ? `Dia ${dia}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const valores = semFactura
    ? [`Valor (sem fatura): ${emEuros(v.conta.total)}${unidade}`, `Total a pagar: ${emEuros(v.conta.total)}${unidade}`]
    : [
        `Valor sem IVA: ${emEuros(v.conta.semIva)}${unidade}`,
        `IVA (${Math.round(TAXA_IVA * 100)} %): ${emEuros(v.conta.iva)}${unidade}`,
        `Total a pagar, com IVA: ${emEuros(v.conta.total)}${unidade}`,
      ];

  return [
    `${comoTratar(v.cliente, agora)} Aqui é a CLYON.`,
    "Seguem os valores finais do seu pedido, para pagamento:",
    linhaDoPedido,
    valores.join("\n"),
    ePorUnidade(base) ? notaDoPrecoParaOCliente(base, "clyon") : null,
    `Pode pagar por MB WAY, por Multibanco ou por transferência, no seu pedido:\n${v.link?.trim() || LINK_POR_GERAR}`,
    "Paga à CLYON, que só paga ao parceiro depois de o trabalho estar feito.",
    "Obrigado pela preferência,\nEquipa CLYON",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Põe o link no lugar do marcador; se a equipa o apagou ao editar, junta-o no fim. */
export function comOLink(texto: string, link: string): string {
  if (texto.includes(LINK_POR_GERAR)) return texto.split(LINK_POR_GERAR).join(link);
  if (texto.includes(link)) return texto;
  return `${texto.trimEnd()}\n\nO seu pedido: ${link}`;
}

/*
 * O QUE NÃO PODE IR — a mensagem pode ser editada antes de sair, e por isso o
 * servidor confere-a: os dados de pagamento de uma pessoa (IBAN, Revolut, um
 * telemóvel para MB WAY) não saem por aqui.
 */
const IBAN = /\bIBAN\b|\bPT\s?50(\s?\d){4,}/i;
const REVOLUT = /revolut/i;
const TELEMOVEL = /(?<!\d)(?:\+?351[\s.-]?)?9[1236](?:[\s.-]?\d){7}(?!\d)/g;

export function oQueNaoPodeIr(texto: string): string | null {
  if (IBAN.test(texto)) return "A mensagem não pode levar um IBAN: o cliente paga no pedido da CLYON.";
  if (REVOLUT.test(texto)) return "A mensagem não pode levar dados do Revolut: o cliente paga no pedido da CLYON.";
  for (const m of texto.matchAll(TELEMOVEL)) {
    const digitos = m[0].replace(/\D/g, "").replace(/^351/, "");
    if (`351${digitos}` !== TELEFONE_DA_CLYON_DIGITOS) {
      return "A mensagem não pode levar o telemóvel de uma pessoa: o cliente paga no pedido da CLYON.";
    }
  }
  return null;
}
