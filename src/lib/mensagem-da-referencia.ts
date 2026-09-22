import { NOME_DO_METODO, type MetodoDePagamento } from "./eupago";

/**
 * A MENSAGEM QUE SE MANDA AO CLIENTE COM A REFERÊNCIA.
 *
 * *«Vamos colocar apenas para o admin gerar as referências e enviar
 * individualmente para cada pedido.»* — 18-09-2026.
 *
 * É a decisão mais sensata que este trabalho podia ter tomado: em vez de um
 * ecrã de pagamento aberto a toda a gente, uma pessoa a decidir pedido a
 * pedido. Tira a pressa de cima do interruptor, e põe a cobrança a nascer do
 * sítio onde a CLYON já fala com os clientes.
 *
 * ESTE FICHEIRO É PURO. Constrói o texto e mais nada — quem o manda é quem
 * carrega no botão, no WhatsApp ou no email dele.
 *
 * ⚠️ TRÊS COISAS TÊM DE ESTAR SEMPRE LÁ, e nenhuma é decoração:
 *
 *   · O VALOR EXACTO. Uma referência Multibanco de valor fixo recusa qualquer
 *     outro montante — um cliente que tente pagar 100 num pedido de 105 vê o
 *     multibanco dizer «não» sem lhe explicar porquê;
 *   · O QUE É. Uma entidade e uma referência soltas num WhatsApp parecem
 *     burla, e é assim que são tratadas. Diz-se o pedido a que pertencem;
 *   · QUEM PROCESSA. O contrato do euPago obriga a informar o consumidor de
 *     que os pagamentos passam por eles.
 */

export type DadosDaMensagem = {
  pedidoId: number;
  metodo: MetodoDePagamento;
  valor: number;
  /** Só Multibanco. */
  entidade?: string | null;
  referencia?: string | null;
  /** Só MB WAY: o número para onde foi o pedido. */
  telemovel?: string | null;
  /** Quando deixa de valer. */
  expiraEm?: Date | null;
  /** O nome de quem vai ler. Sem ele, a mensagem começa por «Boa tarde,». */
  cliente?: string | null;
  comFactura?: boolean;
};

function euros(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

function dia(d: Date): string {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * O texto pronto a colar num WhatsApp ou num email.
 *
 * Linhas curtas e um valor por linha: isto lê-se num telemóvel, muitas vezes
 * ao sol, e uma entidade colada a uma referência copia-se mal. O que é para
 * copiar fica sozinho na sua linha.
 */
export function mensagemDaReferencia(d: DadosDaMensagem): string {
  const nome = (d.cliente ?? "").trim().split(/\s+/)[0] || "";
  const linhas: string[] = [];

  linhas.push(nome ? `Boa tarde, ${nome}!` : "Boa tarde!");
  linhas.push("");

  if (d.metodo === "multibanco") {
    linhas.push(
      `Aqui está a referência para pagar o pedido #${d.pedidoId} na CLYON:`,
      "",
      `Entidade: ${d.entidade ?? "—"}`,
      `Referência: ${d.referencia ?? "—"}`,
      `Valor: ${euros(d.valor)}`,
    );
    if (d.expiraEm) linhas.push(`Válida até ${dia(d.expiraEm)}`);
    linhas.push(
      "",
      /*
       * O AVISO DO VALOR EXACTO É O QUE POUPA A CHAMADA A SEGUIR.
       * Uma referência de valor fixo não aceita outro montante, e o
       * homebanking recusa sem dizer porquê.
       */
      "Pague no homebanking ou numa caixa Multibanco, pelo valor exacto.",
    );
  } else {
    linhas.push(
      `Enviámos um pedido de pagamento por MB WAY para o pedido #${d.pedidoId} na CLYON:`,
      "",
      `Valor: ${euros(d.valor)}`,
    );
    if (d.telemovel) linhas.push(`Telemóvel: ${d.telemovel}`);
    linhas.push(
      "",
      // Os cinco minutos são do MB WAY, não nossos. Dizê-los evita a pergunta
      // «não recebi nada» de quem foi buscar o telemóvel a outra divisão.
      "Abra a aplicação MB WAY e confirme — tem 5 minutos. Se não aparecer, diga-nos e enviamos outra vez.",
    );
  }

  if (d.comFactura) {
    linhas.push("", "Este valor já inclui os 23 % de IVA, para lhe podermos passar factura.");
  }

  linhas.push(
    "",
    // Obrigação do contrato do euPago: o consumidor tem de saber quem processa.
    "Os pagamentos são processados pelo euPago. Qualquer dúvida, é só responder a esta mensagem.",
  );

  return linhas.join("\n");
}

/** O link que abre o WhatsApp já com a mensagem escrita. */
export function linkDoWhatsApp(telefone: string | null | undefined, texto: string): string | null {
  const so = (telefone ?? "").replace(/[^0-9]/g, "");
  if (so.length < 9) return null;
  /*
   * Sem indicativo, assume-se Portugal. Um número de nove dígitos escrito por
   * um cliente português é isso em 99 % dos casos, e o `wa.me` sem país não
   * abre conversa nenhuma.
   */
  const comPais = so.length === 9 ? `351${so}` : so;
  return `https://wa.me/${comPais}?text=${encodeURIComponent(texto)}`;
}

/** O assunto do email, quando se manda por aí. */
export function assuntoDoEmail(pedidoId: number, metodo: MetodoDePagamento): string {
  return `CLYON — ${NOME_DO_METODO[metodo]} para o pedido #${pedidoId}`;
}
