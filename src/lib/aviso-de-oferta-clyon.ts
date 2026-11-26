import { comoTratar } from "./whatsapp-recolha";
import { servicoEmPalavras } from "./servico-em-palavras";
import {
  COMO_SE_SAI,
  distanciaCurtaParaOAviso,
  localidadeParaOAviso,
} from "./aviso-de-pedido-ao-profissional";
import type { ModoDaOferta } from "./oferta-clyon";
import { TRABALHO_SEM_EFEITO } from "./prazo-do-cliente-clyon";
import { lerBase, precoComBase } from "./base-do-preco";
import { diaEHoraCurtosEmLisboa } from "./hora-de-lisboa";

/*
 * NADA A PAGAR AGORA — d100 (23-11-2026): a frase vive em `nada-a-pagar-agora.ts` (puro, para a app
 * Pro a importar sem arrastar o resto deste ficheiro); aqui re-exporta-se.
 */
export { NADA_A_PAGAR_AGORA_NO_NOVO_MODELO } from "./nada-a-pagar-agora";
import { NADA_A_PAGAR_AGORA_NO_NOVO_MODELO } from "./nada-a-pagar-agora";

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
  /** O dia marcado, quando o pedido o tem (d135b). */
  quando?: Date | null;
};

const eurosPorExtenso = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/**
 * A OFERTA CURTA — d135b (26-11-2026, o dono: «Sim, as duas»). No estilo do
 * aviso de pedido novo (d135): só o que faz decidir, e o resto na ligação.
 *
 *   CLYON · Trabalho #410 · Recolha de entulho
 *   📍 Sintra · a 7 km de si
 *   💶 Recebe: 200,00 € (valor fixo, já sem a taxa e sem IVA)
 *   📅 Dia: 28/11, 09:00            (só quando o pedido tem dia)
 *   Aceitar ou recusar: <ligação>
 *   (Para não receber estes avisos, responda parar.)
 *
 * Sem saudação pela primeira palavra do nome («Bom dia, Nova.» para a «Nova
 * Recolha»), sem a descrição e sem as frases do modo — está tudo na ligação.
 * O número é o que lhe fica (`ganhos`), pela base do preço.
 */
export function avisoDeOfertaAoProfissional(
  _nomeDoProfissional: string | null,
  o: OfertaParaAvisar,
  _agora: Date,
): string {
  const servico = servicoEmPalavras(o.servico);
  const titulo = `CLYON · Trabalho #${o.pedidoId} · ${servico.charAt(0).toUpperCase()}${servico.slice(1)}`;
  const onde = [localidadeParaOAviso(o.localidade), distanciaCurtaParaOAviso(o.distanciaKm)]
    .filter(Boolean)
    .join(" · ");
  const recebe = precoComBase(eurosPorExtenso(o.ganhos), lerBase(o.base));
  const dia = o.quando && !Number.isNaN(o.quando.getTime()) ? diaEHoraCurtosEmLisboa(o.quando) : null;
  return [
    titulo,
    onde ? `📍 ${onde}` : null,
    `💶 Recebe: ${recebe} (valor fixo, já sem a taxa e sem IVA)`,
    dia ? `📅 Dia: ${dia}` : null,
    `Aceitar ou recusar: ${o.link}`,
    `(${COMO_SE_SAI})`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** O WhatsApp a quem a CLYON escolheu. Sai a todos, como o aviso da data: é o trabalho dele. */
export function avisoDeEscolhaAoProfissional(
  nomeDoProfissional: string | null,
  o: {
    pedidoId: number;
    servico: string | null;
    localidade: string | null;
    valor: number;
    link: string;
    /**
     * Atribuído directamente pela CLYON, combinado por fora (11-11-2026, o
     * #591): não há nada para aceitar, e diz-se o dia.
     */
    porFora?: boolean;
    quando?: Date | null;
    /** O trabalho segue o modelo de 15-11 (`segueONovoModelo`): diz-se que não há nada a pagar agora (d100). */
    novoModelo?: boolean;
  },
  agora: Date,
): string {
  const onde = o.localidade ? ` em ${o.localidade}` : "";
  const trabalho = `${servicoEmPalavras(o.servico)}${onde} (#${o.pedidoId})`;
  const dia =
    o.quando && !Number.isNaN(o.quando.getTime()) ? ` Fica marcado para ${diaEHoraCurtosEmLisboa(o.quando)}.` : "";
  return [
    `${comoTratar(nomeDoProfissional, agora)} Aqui é a CLYON.`,
    o.porFora
      ? `O trabalho de ${trabalho} é seu, como ficou combinado, com ganhos estimados de ${eurosPorExtenso(o.valor)}. ` +
        `Não precisa de aceitar nada.${dia}`
      : `O trabalho é seu: a CLYON escolheu-o para ${trabalho}, com ganhos estimados de ${eurosPorExtenso(o.valor)}.${dia}`,
    `A morada e o contacto do cliente já estão no seu painel: ${o.link}`,
    o.novoModelo === true ? NADA_A_PAGAR_AGORA_NO_NOVO_MODELO : null,
  ]
    .filter(Boolean)
    .join("\n\n");
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
    /** «valor_mantido» (11-11-2026): já era dele e continua a ser — não há nada para aceitar. */
    motivo: "valor_novo" | "de_novo" | "valor_mantido";
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
  if (o.motivo === "valor_mantido") {
    return [
      `${comoTratar(nomeDoProfissional, agora)} Aqui é a CLYON.`,
      `O valor do trabalho CLYON de ${trabalho} foi atualizado: agora é ${numeros}.`,
      "O trabalho continua a ser seu, como combinado — não precisa de fazer nada.",
      `Ver no painel: ${o.link}`,
    ].join("\n\n");
  }
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
