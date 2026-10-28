import { comoTratar } from "./whatsapp-recolha";
import { servicoEmPalavras } from "./servico-em-palavras";
import {
  COMO_SE_SAI,
  descricaoParaOAviso,
  distanciaParaOAviso,
  urgenciaParaOAviso,
} from "./aviso-de-pedido-ao-profissional";
import type { ModoDaOferta } from "./oferta-clyon";
import { TRABALHO_SEM_EFEITO } from "./prazo-do-cliente-clyon";
import { lerBase, notaDaCargaParaOCliente, precoComBase } from "./base-do-preco";

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
  /** O valor do trabalho, sem IVA — o que o cliente paga (08-10-2026). */
  valor: number;
  /** O que fica para ele: o valor menos a taxa. Num trabalho antigo, igual ao valor. */
  ganhos: number;
  modo: ModoDaOferta;
  link: string;
  /** Pelo trabalho todo, por carga ou por hora — 22-10-2026. Sem ela, pelo todo. */
  base?: string | null;
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

  /*
   * «Trabalho oferecido pela CLYON no valor de 350, ganhos estimados de 280,
   * deseja aceitar?» — 08-10-2026. O valor do trabalho e o que lhe fica, os
   * dois, porque é com os dois que ele decide.
   */
  // Por carga, os dois números dizem-no (22-10-2026): «360,00 € por carga — ganhos de 306,00 € por carga».
  const base = lerBase(o.base);
  const valor =
    `No valor de ${precoComBase(eurosPorExtenso(o.valor), base)} — ganhos estimados de ${precoComBase(eurosPorExtenso(o.ganhos), base)}. ` +
    (base === "total" ? "" : `${(notaDaCargaParaOCliente(base) ?? "").replace(" — combine o número com o profissional", "")} `) +
    `Não há propostas — só aceitar ou recusar.\n` +
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
      `com ganhos estimados de ${eurosPorExtenso(o.valor)}.`,
    `A morada e o contacto do cliente já estão no seu painel: ${o.link}`,
  ].join("\n\n");
}

/**
 * O VALOR MUDOU, OU O TRABALHO VOLTOU — 08-10-2026.
 *
 * *«Caso o valor seja alterado, mesmo que os pros já tenham aceitado, ele deve
 * aparecer novamente com o valor actualizado para aceitar.»* Quem já o tinha
 * fica com ele se aceitar o valor novo; os outros voltam a poder aceitar. E
 * quando o escolhido recusa, os que tinham ficado de fora recebem-no de novo.
 */
export function avisoDeValorNovoAoProfissional(
  nomeDoProfissional: string | null,
  o: {
    pedidoId: number;
    servico: string | null;
    localidade: string | null;
    valor: number;
    ganhos: number;
    motivo: "valor_novo" | "de_novo";
    eraDele: boolean;
    link: string;
    base?: string | null;
  },
  agora: Date,
): string {
  const onde = o.localidade ? ` em ${o.localidade}` : "";
  const trabalho = `${servicoEmPalavras(o.servico)}${onde} (#${o.pedidoId})`;
  const base = lerBase(o.base);
  const numeros = `no valor de ${precoComBase(eurosPorExtenso(o.valor), base)} — ganhos estimados de ${precoComBase(eurosPorExtenso(o.ganhos), base)}`;
  const oQue =
    o.motivo === "de_novo"
      ? `O trabalho CLYON de ${trabalho} voltou a estar disponível, ${numeros}.`
      : `O valor do trabalho CLYON de ${trabalho} mudou: agora é ${numeros}.`;
  const pergunta =
    o.motivo === "valor_novo" && o.eraDele
      ? "O trabalho continua a ser seu se aceitar o valor novo. Deseja aceitar?"
      : "Deseja aceitar este trabalho?";
  return [
    `${comoTratar(nomeDoProfissional, agora)} Aqui é a CLYON.`,
    oQue,
    pergunta,
    `Ver e responder: ${o.link}\n${COMO_SE_SAI}`,
  ].join("\n\n");
}

/**
 * O CLIENTE NÃO RESPONDEU AO PREÇO EM 72 HORAS — 28-10-2026 (d12). A quem
 * tinha aceitado, quando a rotina arquiva o pedido. Ver `prazo-do-cliente-clyon.ts`.
 */
export function avisoDeSemEfeitoAoProfissional(
  nomeDoProfissional: string | null,
  o: { pedidoId: number; servico: string | null; localidade: string | null },
  agora: Date,
): string {
  const onde = o.localidade ? ` em ${o.localidade}` : "";
  return [
    `${comoTratar(nomeDoProfissional, agora)} Aqui é a CLYON.`,
    `Trabalho CLYON de ${servicoEmPalavras(o.servico)}${onde} (#${o.pedidoId}): ${TRABALHO_SEM_EFEITO}`,
  ].join("\n\n");
}

/**
 * O TRABALHO FOI CANCELADO PELA CLYON — a todos a quem tinha sido oferecido (08-10-2026).
 * Com o motivo, quando se escreveu um (19-10-2026, como no «Cancelar pedido» da Mesa).
 */
export function avisoDeCancelamentoAoProfissional(
  nomeDoProfissional: string | null,
  o: { pedidoId: number; servico: string | null; localidade: string | null; motivo?: string | null },
  agora: Date,
): string {
  const onde = o.localidade ? ` em ${o.localidade}` : "";
  const motivo = o.motivo?.trim();
  return [
    `${comoTratar(nomeDoProfissional, agora)} Aqui é a CLYON.`,
    `O trabalho CLYON de ${servicoEmPalavras(o.servico)}${onde} (#${o.pedidoId}) foi cancelado pela CLYON.` +
      (motivo ? ` Motivo: ${motivo.replace(/[.!]+$/, "")}.` : "") +
      " Já não precisa de fazer nada — obrigado pela disponibilidade.",
  ].join("\n\n");
}
