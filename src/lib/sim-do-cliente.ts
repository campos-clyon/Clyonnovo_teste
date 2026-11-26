import { comoTratar } from "./whatsapp-recolha";
import { servicoEmPalavras } from "./servico-em-palavras";

/**
 * O SIM DO CLIENTE ANTES DE ATRIBUIR — d130 (dono, 26-11-2026; o #652).
 *
 * Num Trabalho CLYON de valor fixo, «Atribuir directamente a…» (ou escolher
 * quem aceitou) dava o trabalho ao parceiro antes de o cliente aceitar o
 * valor — sem aviso nenhum. Agora, sem o sim do cliente, o cartão avisa
 * «O cliente ainda não aceitou este valor.» e dá duas escolhas:
 *
 *   a) «Enviar o valor ao cliente e atribuir quando aceitar» — a proposta sai
 *      pelo caminho de sempre e o parceiro fica RESERVADO; com o sim (Vitória,
 *      app ou «O cliente aceitou (por telefone)»), a atribuição faz-se sozinha
 *      e ele é avisado como hoje; com o não, ou se o pedido for cancelado, a
 *      reserva cai e ele é avisado.
 *   b) «Atribuir já (o cliente aceitou por telefone)» — o sim fica registado
 *      com quem carregou, e atribui.
 *
 * Num trabalho que JÁ foi atribuído sem o sim, «Pedir o sim do cliente» envia
 * o valor e marca «Atribuído — falta o sim do cliente».
 *
 * Só o valor fixo: as negociações (propostas dos parceiros) não mudam.
 * Aqui só o que não lê a base — as frases e as regras. A base está em
 * `sim-do-cliente-na-base.ts`.
 */

export const FALTA_O_SIM_DO_CLIENTE = "O cliente ainda não aceitou este valor.";

export const ESCOLHA_RESERVAR = "Enviar o valor ao cliente e atribuir quando aceitar";
export const ESCOLHA_ATRIBUIR_JA = "Atribuir já (o cliente aceitou por telefone)";

/** Como o cartão diz o que está à espera. */
export const MARCA_RESERVADO = "reservado — à espera do sim do cliente";
export const MARCA_FALTA_O_SIM = "atribuído — falta o sim do cliente";

/** O que quem atribui escolheu, quando o cliente ainda não deu o sim. */
export type SimDoCliente = "reservar" | "telefone";

export function lerSimDoCliente(v: unknown): SimDoCliente | null {
  return v === "reservar" || v === "telefone" ? v : null;
}

/** Num valor fixo, atribuir precisa do sim do cliente: o «Aceito este preço» (app, Vitória, ou dito à equipa). */
export function faltaOSimDoCliente(p: { valorFixoClyon?: unknown; precoAceiteEm?: unknown }): boolean {
  return p.valorFixoClyon != null && !p.precoAceiteEm;
}

/** A resposta da rota quando se tenta atribuir sem o sim e sem escolher (a) ou (b). */
export const RECUSA_SEM_O_SIM_DO_CLIENTE = { error: FALTA_O_SIM_DO_CLIENTE, faltaOSimDoCliente: true } as const;

/** Uma reserva (a) ou um «falta o sim» (2), como o cartão a recebe. */
export type ReservaDoValorFixo = {
  tipo: "reserva" | "falta_o_sim";
  providerId: number | null;
  negociacaoId: number | null;
  profissional: string | null;
  por: string | null;
  em: string | null;
};

export function marcaDaReserva(r: Pick<ReservaDoValorFixo, "tipo" | "profissional">): string {
  if (r.tipo === "falta_o_sim") return `${r.profissional ? `${r.profissional}: ` : ""}${MARCA_FALTA_O_SIM}`;
  return `${r.profissional ? `${r.profissional} ` : ""}${MARCA_RESERVADO}`;
}

/** Porque a reserva caiu. */
export type PorqueCaiu = "recusou" | "cancelado";

/**
 * O aviso ao parceiro reservado quando a reserva cai — curto, sem dados do
 * cliente: ele ainda não tinha o trabalho.
 */
export function avisoDaReservaQueCaiu(
  nome: string | null,
  o: { pedidoId: number; servico: string | null; localidade: string | null; porque: PorqueCaiu },
  agora: Date,
): string {
  const onde = o.localidade ? ` em ${o.localidade}` : "";
  const porque = o.porque === "recusou" ? "o cliente não aceitou o valor" : "o pedido foi cancelado";
  return [
    `${comoTratar(nome, agora)} Aqui é a CLYON.`,
    `O trabalho de ${servicoEmPalavras(o.servico)}${onde} (#${o.pedidoId}) que tínhamos reservado consigo não avança: ${porque}.` +
      " Já não precisa de fazer nada — obrigado pela disponibilidade.",
  ].join("\n\n");
}

/** As linhas do histórico do pedido. */
export const HISTORICO = {
  reservado: (quem: string, profissional: string) =>
    `Reservado para ${profissional} por ${quem} — o valor vai ao cliente, e a atribuição faz-se quando ele aceitar (d130).`,
  simPedido: (quem: string, profissional: string | null) =>
    `Atribuído sem o sim do cliente${profissional ? ` (${profissional})` : ""}: ${quem} pediu-lhe o sim — fica «falta o sim do cliente» até ele responder (d130).`,
  simPorTelefone: (quem: string) => `O cliente aceitou o valor (dito à equipa, por telefone) — registado por ${quem}.`,
  simDepoisDeAtribuido: (profissional: string | null) =>
    `O cliente deu o sim ao valor — o trabalho segue${profissional ? ` com ${profissional}` : ""}, como estava.`,
  reservaNaoCumprida: (profissional: string | null, porque: string) =>
    `O cliente aceitou, mas a reserva${profissional ? ` de ${profissional}` : ""} não se fez sozinha: ${porque}. Atribua à mão.`,
  caiu: (profissional: string | null, porque: PorqueCaiu, quem: string | null, avisado: boolean) =>
    `A reserva${profissional ? ` de ${profissional}` : ""} caiu: ${porque === "recusou" ? "o cliente não aceitou o valor" : "o pedido foi cancelado"}` +
    `${quem ? ` (registado por ${quem})` : ""}. ` +
    (avisado ? "Foi avisado por WhatsApp." : "O WhatsApp não saiu — diga-lhe à mão."),
  substituida: (antes: string | null, quem: string) =>
    `A reserva${antes ? ` de ${antes}` : ""} foi substituída por ${quem}.`,
};
