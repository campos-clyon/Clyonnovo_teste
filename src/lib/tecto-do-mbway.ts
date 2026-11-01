import { TELEFONE_DA_CLYON_NACIONAL } from "./telefone-da-clyon";

/**
 * O TECTO DO MB WAY POR TRABALHO — 01-11-2026 (Segurança, proposta de 31-10).
 *
 * Cada pedido MB WAY é uma notificação no telemóvel que o cliente escreveu, em
 * nome da CLYON. O travão por endereço e por conta (10 em 5 minutos) deixava
 * ≈120 por hora: a partir de um trabalho seu, alguém podia pôr a CLYON a mandar
 * pedidos a números alheios. Ninguém precisa de mais de dois ou três para pagar
 * um trabalho.
 *
 * Por isso, num trabalho e em 24 horas: no máximo MAX_PEDIDOS_MBWAY pedidos e
 * MAX_TELEMOVEIS_MBWAY telemóveis diferentes. Acima disso, Multibanco ou falar
 * connosco. Contam todos os MB WAY do trabalho, de qualquer parte (o trabalho
 * e a diferença das horas). O backoffice não passa por aqui.
 */
export const MAX_PEDIDOS_MBWAY = 6;
export const MAX_TELEMOVEIS_MBWAY = 3;
export const HORAS_DO_TECTO_MBWAY = 24;

export const MENSAGEM_DO_TECTO_MBWAY =
  "Já pediu vários pagamentos MB WAY para este trabalho nas últimas 24 horas. " +
  `Pague por Multibanco ou fale connosco pelo WhatsApp (${TELEFONE_DA_CLYON_NACIONAL}).`;

type PedidoAnterior = {
  metodo: string;
  telemovel: string | null;
  criadoEm: Date;
};

/** Os 9 algarismos do número português, para «+351 912…» e «912…» contarem como um. */
export function telemovelComparavel(t: string | null | undefined): string {
  const digitos = (t ?? "").replace(/\D/g, "");
  return digitos.length > 9 ? digitos.slice(-9) : digitos;
}

/** Devolve a mensagem ao cliente quando o tecto já foi atingido; null se pode pedir. */
export function porqueNaoPodePedirMaisMbway(
  anteriores: PedidoAnterior[],
  telemovelNovo: string | null | undefined,
  agora: number = Date.now(),
): string | null {
  const desde = agora - HORAS_DO_TECTO_MBWAY * 3_600_000;
  const recentes = anteriores.filter(
    (l) =>
      l.metodo === "mbway" &&
      l.criadoEm instanceof Date &&
      l.criadoEm.getTime() >= desde,
  );
  if (recentes.length >= MAX_PEDIDOS_MBWAY) return MENSAGEM_DO_TECTO_MBWAY;

  const numeros = new Set(recentes.map((l) => telemovelComparavel(l.telemovel)).filter(Boolean));
  const novo = telemovelComparavel(telemovelNovo);
  if (novo && !numeros.has(novo) && numeros.size >= MAX_TELEMOVEIS_MBWAY) return MENSAGEM_DO_TECTO_MBWAY;

  return null;
}
