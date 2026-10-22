import { primeiroNome } from "./mensagem-whatsapp";
import { quandoPorExtenso } from "./aviso-de-data-ao-cliente";
import { linkDeWhatsApp } from "./link-de-whatsapp";
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
 * a falar como uma pessoa. E diz quem faz o trabalho: *«a Revolution será a
 * empresa encarregada, e o senhor William, o responsável, irá entrar em
 * contacto o mais breve possível»*, com o telefone dele, para o cliente
 * poder ligar. O responsável escreve-se na ficha do profissional; sem ele,
 * fala-se da equipa da empresa.
 */

/** Os métodos de pagamento, como o dono os dá aos clientes — só texto, sem emojis. */
export const METODOS_DE_PAGAMENTO = [
  "Para o pagamento, pode usar uma destas opções:",
  "MB WAY: 931 632 622",
  "Transferência bancária (Novo Banco)\nIBAN: PT50 0007 0000 0034 4144 7492 3\nBIC/SWIFT: BESCPTPL\nTitular: Wanderson Campos Silva",
  "Revolut: revolut.me/cpss\nIBAN Revolut: LT72 3250 0157 4466 0473\nTitular: Wanderson Campos Silva",
].join("\n\n");

export type TrabalhoAdjudicado = {
  cliente: string | null;
  quando: string | null;
  servico?: string | null;
  localidade?: string | null;
  /** O nome da empresa que faz o trabalho — o profissional escolhido. */
  empresa?: string | null;
  /** Quem responde por ela, como o cliente o vai ouvir: «William». */
  responsavel?: string | null;
  telefoneDaEmpresa?: string | null;
};

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
    METODOS_DE_PAGAMENTO,
    "Depois de pagar, envie-nos o comprovativo por aqui, por favor.",
    "Obrigado pela preferência,\nEquipa CLYON",
  ].join("\n\n");
}

/** O link que abre a conversa do cliente com a mensagem escrita — ou `null` sem telefone. */
export function linkDaAdjudicacao(t: TrabalhoAdjudicado & { telefone: string | null }, agora: Date): string | null {
  return linkDeWhatsApp(t.telefone, mensagemDeAdjudicacao(t, agora));
}
