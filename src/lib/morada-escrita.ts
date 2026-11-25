/**
 * A MORADA ESCRITA MANDA SOBRE A ESCOLHIDA ANTES — d127, 25-11-2026.
 *
 * O formulário guardava a morada escolhida na lista (ou a que veio da visita
 * anterior, do rascunho ou do perfil) e o texto da caixa à parte. Quem apagava
 * o texto e escrevia outra morada sem tocar numa sugestão mandava o pedido com
 * a morada antiga: um cliente da Pontinha (Odivelas) ficou com o pedido noutra
 * ponta do país, a localidade da escolha anterior. Quando o texto deixa de ser
 * o da morada guardada, a morada guardada (e a distância dela) sai: o pedido só
 * avança com uma morada escolhida de novo na lista.
 */
export type ComMorada = {
  address?: { formattedAddress?: string; city?: string } | undefined;
  addressStatus?: string;
  distanceFromBase?: unknown;
  distanceStatus?: string;
  city?: string;
};

const normalizar = (t: string): string => t.trim().replace(/\s+/g, " ").toLowerCase();

/** O estado do formulário depois de a pessoa escrever `texto` na caixa da morada. */
export function moradaDepoisDeEscrever<T extends ComMorada>(prev: T, texto: string): T {
  const guardada = prev.address?.formattedAddress;
  if (!guardada) return prev;
  if (normalizar(guardada) === normalizar(texto)) return prev;
  const cidadeDaGuardada = prev.address?.city;
  return {
    ...prev,
    address: undefined,
    addressStatus: texto.trim() ? "typing" : "empty",
    distanceFromBase: undefined,
    distanceStatus: undefined,
    city: prev.city && prev.city === cidadeDaGuardada ? undefined : prev.city,
  };
}
