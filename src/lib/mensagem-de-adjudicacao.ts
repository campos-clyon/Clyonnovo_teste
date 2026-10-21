import { primeiroNome } from "./mensagem-whatsapp";
import { quandoPorExtenso } from "./aviso-de-data-ao-cliente";
import { linkDeWhatsApp } from "./link-de-whatsapp";

/**
 * A MENSAGEM DE ADJUDICAÇÃO — 21-10-2026.
 *
 * Depois de o cliente aceitar a proposta e de haver profissional, o dono
 * escrevia isto à mão no WhatsApp. Pediu um botão ao lado de «Alterar valor
 * ou taxa» que abrisse a conversa do cliente com ela já escrita:
 *
 *   «Excelente, Daniela! O serviço fica então agendado e adjudicado para
 *   sexta-feira, 23 de outubro, às 10:30. Um colega vai entrar em contacto
 *   para alinhar os detalhes… Métodos de pagamento disponíveis: …»
 *
 * O nome e o dia vêm do trabalho; os métodos de pagamento são os dele, tal e
 * qual os mandou.
 */

/** Os métodos de pagamento, como o dono os escreve aos clientes. */
export const METODOS_DE_PAGAMENTO = [
  "Métodos de pagamento disponíveis:",
  "💳 MB WAY: +351 931 632 622",
  "🏦 Novo Banco\nIBAN: PT50 0007 0000 0034 4144 7492 3\nBIC/SWIFT: BESCPTPL\nTitular: Wanderson Campos Silva",
  "🌍 Revolut: revolut.me/cpss",
  "🏦 IBAN Revolut: LT72 3250 0157 4466 0473\nTitular: Wanderson Campos Silva",
].join("\n\n");

export function mensagemDeAdjudicacao(
  t: { cliente: string | null; quando: string | null },
  agora: Date,
): string {
  const nome = primeiroNome(t.cliente);
  // O dia só se diz se ainda está para vir — como na proposta.
  const dia = t.quando ? new Date(t.quando) : null;
  const futuro = dia != null && !Number.isNaN(dia.getTime()) && dia.getTime() > agora.getTime();
  const fica = futuro
    ? `O serviço fica então agendado e adjudicado para ${quandoPorExtenso(dia, agora)}.`
    : "O serviço fica então adjudicado.";
  return [
    `Excelente${nome ? `, ${nome}` : ""}! ${fica}`,
    "Um colega vai entrar em contacto para alinhar os detalhes, como os horários.",
    METODOS_DE_PAGAMENTO,
    "Após o pagamento, envie o comprovativo para agilizar o processo.",
  ].join("\n\n");
}

/** O link que abre a conversa do cliente com a mensagem escrita — ou `null` sem telefone. */
export function linkDaAdjudicacao(
  t: { cliente: string | null; telefone: string | null; quando: string | null },
  agora: Date,
): string | null {
  return linkDeWhatsApp(t.telefone, mensagemDeAdjudicacao(t, agora));
}
