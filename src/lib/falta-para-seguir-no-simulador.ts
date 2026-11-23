import { oQueFaltaNoPedido, type PedidoParaOQueFalta } from "./o-que-falta-no-pedido";
import { rotuloDaFalta } from "./mensagem-do-que-falta";
import { moradaCompleta } from "./morada";

/**
 * O QUE FALTA PARA O PEDIDO SEGUIR JÁ PARA OS PARCEIROS — d3, 23-11-2026.
 *
 * No passo 3 do simulador, sem bloquear nada: «Para seguir já para os
 * parceiros, falta: …». A conta é a MESMA do «Pedir o que falta» da Mesa e do
 * envio automático (`oQueFaltaNoPedido`), feita sobre o pedido como ele seria
 * gravado (as mesmas escolhas de `/api/simulador/pedido`: numa mudança, a
 * morada, o andar, o elevador e o estacionamento são os da origem).
 *
 * Fica no servidor (a régua traz a Vitória atrás e não vai para o browser):
 * o simulador pergunta a `/api/simulador/o-que-falta` com o pedido sem as
 * fotografias, só com quantas são.
 */

type Acesso = { floor?: unknown; hasElevator?: unknown; parkingDistance?: unknown } | undefined;
type Morada = Record<string, unknown> | undefined;

function t(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** O pedido do simulador, no formato da base, para contar o que falta. */
export function pedidoDoSimuladorParaOQueFalta(order: Record<string, unknown>, ficheiros: number): PedidoParaOQueFalta {
  const mudanca = order.serviceType === "mudanca";
  const origem = order.originAddress as Morada;
  const morada = order.address as Morada;
  const acessoOrigem = order.originAccess as Acesso;
  const dobrar = (a: unknown, b: unknown) => t(mudanca ? (a ?? b) : b);
  const partes = (m: Morada) => (m ?? {}) as Parameters<typeof moradaCompleta>[0];
  return {
    id: 0,
    serviceType: t(order.serviceType),
    contactName: t((order.receiver as { name?: unknown } | undefined)?.name),
    address: (mudanca ? moradaCompleta(partes(origem)) || moradaCompleta(partes(morada)) : moradaCompleta(partes(morada))) || null,
    city: t(morada?.city) ?? t(origem?.city) ?? t(order.city),
    postalCode: t(morada?.postalCode) ?? t(origem?.postalCode) ?? t(order.postalCode),
    floor: dobrar(acessoOrigem?.floor, order.floor),
    hasElevator: dobrar(acessoOrigem?.hasElevator, order.hasElevator),
    parkingDistance: dobrar(acessoOrigem?.parkingDistance, order.parkingDistance),
    description: t(order.description),
    // Só interessa quantos são: a régua conta as entradas com endereço.
    filesJson: JSON.stringify(Array.from({ length: Math.max(0, Math.min(Math.floor(ficheiros) || 0, 30)) }, () => ({ url: "x" }))),
    urgency: t(order.urgency),
    rawOrderJson: JSON.stringify(order),
  };
}

/** As frases do que falta, como o simulador as mostra («o que é para levar», «fotografias»…). */
export function oQueFaltaParaSeguirJa(order: Record<string, unknown>, ficheiros: number): string[] {
  const pedido = pedidoDoSimuladorParaOQueFalta(order, ficheiros);
  return oQueFaltaNoPedido(pedido).map((c) => rotuloDaFalta(c, pedido.serviceType));
}
