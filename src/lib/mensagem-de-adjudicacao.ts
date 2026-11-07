import { primeiroNome } from "./mensagem-whatsapp";
import { quandoPorExtenso } from "./aviso-de-data-ao-cliente";
import { linkDeWhatsApp } from "./link-de-whatsapp";
import { ABERTURA_DOS_METODOS, SEM_METODOS_DE_PAGAMENTO, limparMetodosDePagamento } from "./metodos-de-pagamento";
import { servicoComArtigo } from "./mensagem-das-propostas";
import { servicoEmPalavras } from "./servico-em-palavras";
import { telefoneLegivel } from "./telefone-legivel";

/**
 * A MENSAGEM DE ADJUDICAÇÃO — 21-10-2026.
 *
 * Depois de o cliente aceitar a proposta e de haver profissional, o dono
 * escrevia isto à mão no WhatsApp. Pediu um botão ao lado de «Alterar valor
 * ou taxa» que abrisse a conversa do cliente com ela já escrita.
 *
 * REESCRITA A 22-10-2026. *«Parece muito robotizada e está com caracteres
 * especiais que pegam muito mal para o cliente.»* Os emojis dos métodos de
 * pagamento chegavam ao cliente como «�» — saíram todos, e a mensagem passou
 * a falar como uma pessoa. E diz quem faz o trabalho: a empresa encarregada
 * e o responsável da empresa, que vai entrar em contacto o mais breve
 * possível, com o telefone dele, para o cliente poder ligar. O responsável
 * escreve-se na ficha do profissional; sem ele, fala-se da equipa da empresa.
 *
 * OS MÉTODOS DE PAGAMENTO VÊM DAS CONFIGURAÇÕES — 27-10-2026. Escrevem-se no
 * backoffice (Configs → «Métodos de pagamento para a adjudicação») e chegam
 * aqui em `metodosDePagamento`. Sem eles, a mensagem diz que os dados seguem
 * a seguir. Ver `metodos-de-pagamento.ts`.
 *
 * O PAGAMENTO SÓ PELA PLATAFORMA — 03-11-2026 (d15, aprovada pelo dono a
 * 04-11). O bloco das Configs saía por omissão neste botão, com dados de
 * pagamento de uma pessoa, e o cliente pagava fora da plataforma. Desde hoje:
 *
 *   · o link do pedido (onde o cliente paga por MB WAY, Multibanco ou
 *     transferência, como no «Enviar valores para pagamento» da d19) vem
 *     marcado no «Enviar adjudicação»;
 *   · os «Dados do dono» vêm desmarcados, e só entram com um motivo escrito
 *     (`lerMotivoDosDadosDoDono`) — o motivo fica no histórico do pedido;
 *   · sem formas escolhidas, a mensagem NUNCA leva o bloco das Configs: diz
 *     que os dados seguem a seguir. Os dados de uma pessoa (IBAN, Revolut, um
 *     telemóvel) não saem por omissão.
 */

/** O motivo para usar os dados do dono: o mesmo tamanho do «sem factura». */
export const MOTIVO_DOS_DADOS_DO_DONO_MINIMO = 5;
export const MOTIVO_DOS_DADOS_DO_DONO_MAXIMO = 300;
export const PEDE_O_MOTIVO_DOS_DADOS_DO_DONO =
  "Escreva porque vai com os dados do dono e não pela plataforma — sem o motivo, não entram.";

export function lerMotivoDosDadosDoDono(v: unknown): { ok: true; motivo: string } | { ok: false; erro: string } {
  const motivo = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, MOTIVO_DOS_DADOS_DO_DONO_MAXIMO) : "";
  return motivo.length >= MOTIVO_DOS_DADOS_DO_DONO_MINIMO
    ? { ok: true, motivo }
    : { ok: false, erro: PEDE_O_MOTIVO_DOS_DADOS_DO_DONO };
}

export type TrabalhoAdjudicado = {
  cliente: string | null;
  quando: string | null;
  servico?: string | null;
  localidade?: string | null;
  /** O nome da empresa que faz o trabalho — o profissional escolhido. */
  empresa?: string | null;
  /** Quem responde por ela, como o cliente o vai ouvir: o primeiro nome. */
  responsavel?: string | null;
  telefoneDaEmpresa?: string | null;
  /** O texto das Configs com os métodos de pagamento; vazio, os dados seguem a seguir. */
  metodosDePagamento?: string | null;
  /**
   * AS FORMAS ESCOLHIDAS NO «ENVIAR ADJUDICAÇÃO» — 27-10-2026 (d14). Quando
   * vem, manda: os dados do dono só entram se `comDadosDoDono`, e cada
   * referência euPago gerada para este pedido entra com os seus dados. Sem
   * isto, a mensagem é a de sempre (só os métodos das Configs).
   */
  formas?: {
    comDadosDoDono: boolean;
    /** Porque vão os dados do dono (d15): sem um motivo válido, não entram. */
    motivoDosDadosDoDono?: string | null;
    referencias: ReferenciaNaAdjudicacao[];
    /** O link do pedido, gerado no servidor ao preparar a mensagem (d15). */
    link?: string | null;
  };
};

/** Uma referência euPago gerada no servidor para este pedido. */
export type ReferenciaNaAdjudicacao = {
  metodo: "multibanco" | "mbway";
  valor: number;
  entidade?: string | null;
  referencia?: string | null;
  telemovel?: string | null;
  /** ISO ou Date: quando deixa de valer (Multibanco). */
  expiraEm?: string | Date | null;
};

const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

function diaEmLisboa(d: string | Date): string | null {
  const data = new Date(d);
  if (Number.isNaN(data.getTime())) return null;
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);
}

function blocoDaReferencia(r: ReferenciaNaAdjudicacao): string {
  if (r.metodo === "multibanco") {
    const ate = r.expiraEm ? diaEmLisboa(r.expiraEm) : null;
    return [
      "Por Multibanco (homebanking ou caixa Multibanco), pelo valor exacto:",
      `Entidade: ${r.entidade ?? "—"}`,
      `Referência: ${r.referencia ?? "—"}`,
      `Valor: ${euros(r.valor)}`,
      ate ? `Válida até ${ate}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `Por MB WAY: enviámos um pedido de ${euros(r.valor)}${r.telemovel ? ` para o ${r.telemovel}` : ""}.`,
    "Abra a aplicação MB WAY e confirme — tem 5 minutos. Se não aparecer, diga-nos e enviamos outro.",
  ].join("\n");
}

/**
 * O BLOCO DO PAGAMENTO, com as formas escolhidas — 27-10-2026 (d14). Sem
 * nenhuma, diz que os dados seguem a seguir.
 */
export function blocoDasFormasDePagamento(
  formas: NonNullable<TrabalhoAdjudicado["formas"]>,
  metodosDePagamento: string | null | undefined,
): string {
  const doDono =
    formas.comDadosDoDono && lerMotivoDosDadosDoDono(formas.motivoDosDadosDoDono).ok
      ? limparMetodosDePagamento(metodosDePagamento ?? null)
      : null;
  const link = formas.link?.trim() || null;
  const partes = [
    // Primeiro o pedido, onde se paga pela plataforma (d15).
    ...(link ? [`No seu pedido, por MB WAY, por Multibanco ou por transferência:\n${link}`] : []),
    ...formas.referencias.map(blocoDaReferencia),
    // A abertura que o dono tenha escrito nas Configs não se repete.
    ...(doDono ? [doDono.replace(/^para o pagamento[^\n]*\n+/i, "")] : []),
  ];
  if (partes.length === 0) return SEM_METODOS_DE_PAGAMENTO;
  // Só o link: a frase da d19, sem abertura.
  if (link && partes.length === 1) {
    return [
      `Pode pagar por MB WAY, por Multibanco ou por transferência, no seu pedido:\n${link}`,
      "Paga à CLYON, que só paga ao parceiro depois de o trabalho estar feito.",
    ].join("\n\n");
  }
  const abertura = partes.length > 1 ? ABERTURA_DOS_METODOS : "Para o pagamento:";
  const euPago =
    formas.referencias.length > 0
      ? "Os pagamentos por Multibanco e MB WAY são processados pelo euPago."
      : null;
  // Como no «Enviar valores para pagamento» (d19): a quem se paga, e quando o parceiro recebe.
  const aQuem =
    link || formas.referencias.length > 0
      ? "Paga à CLYON, que só paga ao parceiro depois de o trabalho estar feito."
      : null;
  return [abertura, ...partes, euPago, aQuem].filter(Boolean).join("\n\n");
}

const maiuscula = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function mensagemDeAdjudicacao(t: TrabalhoAdjudicado, agora: Date): string {
  const nome = primeiroNome(t.cliente);

  const comArtigo = servicoComArtigo(servicoEmPalavras(t.servico ?? null));
  const onde = t.localidade?.trim() ? ` em ${t.localidade.trim()}` : "";
  const oTrabalho = t.servico && comArtigo ? `${maiuscula(comArtigo)}${onde}` : "O serviço";

  // O dia só se diz se ainda está para vir — como na proposta.
  const dia = t.quando ? new Date(t.quando) : null;
  const futuro = dia != null && !Number.isNaN(dia.getTime()) && dia.getTime() > agora.getTime();
  // «A mudança fica marcada», «o esvaziamento fica marcado» — pelo artigo.
  const a = oTrabalho.startsWith("A ") ? "a" : "o";
  const fica = futuro
    ? `${oTrabalho} fica marcad${a} para ${quandoPorExtenso(dia, agora)}.`
    : `${oTrabalho} fica confirmad${a}.`;

  const empresa = t.empresa?.trim() || null;
  const responsavel = t.responsavel?.trim() || null;
  const telefone = t.telefoneDaEmpresa?.trim() ? telefoneLegivel(t.telefoneDaEmpresa) : null;
  const quemFaz = empresa
    ? [
        `O trabalho fica a cargo da empresa ${empresa}.`,
        responsavel
          ? `O ${responsavel}, responsável da ${empresa}, vai entrar em contacto consigo o mais breve possível para combinar os pormenores.`
          : `A equipa da ${empresa} vai entrar em contacto consigo o mais breve possível para combinar os pormenores.`,
        telefone ? `Se preferir, pode ligar-lhe directamente para o ${telefone}.` : null,
      ]
        .filter(Boolean)
        .join(" ")
    : "Um colega vai entrar em contacto consigo o mais breve possível para combinar os pormenores.";

  return [
    `Olá${nome ? `, ${nome}` : ""}! Obrigado pela confirmação.`,
    fica,
    quemFaz,
    // Sem formas escolhidas, nunca os dados do dono (d15): os dados seguem a seguir.
    blocoDasFormasDePagamento(t.formas ?? { comDadosDoDono: false, referencias: [] }, t.metodosDePagamento),
    "Depois de pagar, envie-nos o comprovativo por aqui, por favor.",
    "Obrigado pela preferência,\nEquipa CLYON",
  ].join("\n\n");
}

/** O link que abre a conversa do cliente com a mensagem escrita — ou `null` sem telefone. */
export function linkDaAdjudicacao(t: TrabalhoAdjudicado & { telefone: string | null }, agora: Date): string | null {
  return linkDeWhatsApp(t.telefone, mensagemDeAdjudicacao(t, agora));
}
