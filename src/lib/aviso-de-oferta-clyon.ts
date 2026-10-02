import { comoTratar } from "./whatsapp-recolha";
import { servicoEmPalavras } from "./servico-em-palavras";
import {
  COMO_SE_SAI,
  descricaoParaOAviso,
  distanciaParaOAviso,
  urgenciaParaOAviso,
} from "./aviso-de-pedido-ao-profissional";
import type { ModoDaOferta } from "./oferta-clyon";

/*
 * ── O AVISO NO WHATSAPP DO PROFISSIONAL ────────────────────────────────────
 *
 * Vai pela mesma fila e com a mesma vontade dele que os avisos de pedido novo
 * (`whatsappAvisos`, e «parar» desliga): é a CLYON a oferecer-lhe trabalho,
 * que é a mesma coisa que um pedido novo — com o preço já fechado.
 */
export type OfertaParaAvisar = {
  pedidoId: number;
  localidade: string | null;
  servico: string | null;
  descricao: string | null;
  urgencia: string | null;
  distanciaKm: number | null;
  valor: number;
  modo: ModoDaOferta;
  link: string;
};

const eurosPorExtenso = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

export function avisoDeOfertaAoProfissional(
  nomeDoProfissional: string | null,
  o: OfertaParaAvisar,
  agora: Date,
): string {
  const abertura = `${comoTratar(nomeDoProfissional, agora)} Aqui é a CLYON — trabalho oferecido pela CLYON.`;

  const onde = o.localidade ? ` em ${o.localidade}` : "";
  const oQueE = [
    `${servicoEmPalavras(o.servico)}${onde} (#${o.pedidoId}).`,
    urgenciaParaOAviso(o.urgencia),
    distanciaParaOAviso(o.distanciaKm),
  ]
    .filter(Boolean)
    .join(" ");

  const valor =
    `Valor fixo: recebe ${eurosPorExtenso(o.valor)}. Não há propostas — só aceitar ou recusar.\n` +
    (o.modo === "directa"
      ? "Foi escolhido pela CLYON para este trabalho: se aceitar, é seu."
      : "Foi oferecido a mais profissionais. Entre os que aceitarem, a CLYON escolhe e avisa.");

  const descricao = descricaoParaOAviso(o.descricao);
  const fecho = `Ver e responder: ${o.link}\n${COMO_SE_SAI}`;

  return [abertura, oQueE, valor, descricao, fecho].filter(Boolean).join("\n\n");
}

/** O WhatsApp a quem a CLYON escolheu. Sai a todos, como o aviso da data: é o trabalho dele. */
export function avisoDeEscolhaAoProfissional(
  nomeDoProfissional: string | null,
  o: { pedidoId: number; servico: string | null; localidade: string | null; valor: number; link: string },
  agora: Date,
): string {
  const onde = o.localidade ? ` em ${o.localidade}` : "";
  return [
    `${comoTratar(nomeDoProfissional, agora)} Aqui é a CLYON.`,
    `O trabalho é seu: a CLYON escolheu-o para ${servicoEmPalavras(o.servico)}${onde} (#${o.pedidoId}), ` +
      `pelo valor fixo de ${eurosPorExtenso(o.valor)}.`,
    `A morada e o contacto do cliente já estão no seu painel: ${o.link}`,
  ].join("\n\n");
}
