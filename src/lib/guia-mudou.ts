/**
 * A GUIA DE TRANSPORTE MUDOU MESMO? — 20-10-2026.
 *
 * Mexer na guia volta a pôr a verificação por fazer: o distintivo que o
 * cliente vê tem de garantir um número que alguém da CLYON confirmou. Mas
 * «mexer» era «vir no pedido» — e o painel manda a guia e o número em CADA
 * gravação da Faturação, e o backoffice em cada gravação da ficha. Quem só
 * mudava o regime do IVA perdia o selo da guia sem ter tocado nela, e o
 * administrador que gravava a ficha desfazia a verificação que acabara de
 * fazer. (Encontrado ao comparar o painel com a app, que só manda o que muda.)
 *
 * Agora conta o que mudou de facto, comparado com o que está na base. Sem o
 * «antes» (a base não respondeu), conta como mudado: na dúvida, verifica-se
 * outra vez.
 */

type Guia = { emiteGuiaTransporte?: unknown; numeroTransportador?: unknown };

const emite = (v: unknown) => v === true || Number(v) === 1;
const numero = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function guiaMudouDeFacto(antes: Guia | undefined | null, depois: Guia): boolean {
  if (!antes) return true;
  if (depois.emiteGuiaTransporte !== undefined && emite(depois.emiteGuiaTransporte) !== emite(antes.emiteGuiaTransporte)) {
    return true;
  }
  if (depois.numeroTransportador !== undefined && numero(depois.numeroTransportador) !== numero(antes.numeroTransportador)) {
    return true;
  }
  return false;
}
