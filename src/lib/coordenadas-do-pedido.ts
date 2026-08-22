import { geocodificarMorada } from "./geocodificar";
import { updateSimulatorOrder } from "./db";

/**
 * As coordenadas de um pedido — indo buscá-las se ainda não existirem.
 *
 * PORQUE É QUE ISTO DECIDE QUEM RECEBE O TRABALHO
 *
 * A regra de elegibilidade tem dois critérios e não são equivalentes. Havendo
 * coordenadas, compara-se a distância real com o RAIO que o profissional
 * declarou. Não havendo, cai-se na lista de ZONAS que ele escreveu à mão, que
 * costuma ter cinco ou seis nomes.
 *
 * O #205 mostrou o que isso custa: uma recolha na Avenida Mouzinho de
 * Albuquerque, em Lisboa, registada ao telefone e portanto sem coordenadas,
 * comparada contra "palmela, montijo, seixal, amora, setubal" — fora de
 * alcance. Foi enviada três vezes e as três não chegaram a ninguém, quando a
 * 35 km havia um profissional com raio de 125.
 *
 * PORQUE É QUE NÃO CHEGA GEOCODIFICAR NA CRIAÇÃO
 *
 * Porque os pedidos que já existem não voltam a ser criados. Há mais de cem na
 * base sem coordenadas — os do formulário da homepage, os do simulador cuja
 * pesquisa não devolveu nada, e todos os que a equipa registou antes disto
 * existir. Corrigir só a criação deixava-os a todos exactamente como estavam.
 *
 * Por isso a busca acontece aqui, no momento em que as coordenadas são
 * precisas, e o resultado é GRAVADO. Da segunda vez que o mesmo pedido for
 * enviado já não há chamada nenhuma ao Google — e um pedido antigo passa a
 * comportar-se como um novo.
 *
 * NUNCA LANÇA. Uma morada que ninguém reconheça devolve os nulos que já lá
 * estavam, e a regra cai nas zonas como caía antes. É degradação, não avaria.
 */

export type CoordenadasDoPedido = {
  lat: number | null;
  lng: number | null;
  /** Verdadeiro quando foram descobertas agora e gravadas. */
  descobertasAgora: boolean;
};

export async function coordenadasDoPedido(pedido: {
  id: number;
  address?: string | null;
  postalCode?: string | null;
  rawOrderJson?: string | null;
}): Promise<CoordenadasDoPedido> {
  let cru: Record<string, unknown> = {};
  try {
    cru = JSON.parse(pedido.rawOrderJson ?? "{}") as Record<string, unknown>;
  } catch {
    cru = {};
  }

  const morada = (cru.address ?? {}) as Record<string, unknown>;
  const lat = typeof morada.lat === "number" ? morada.lat : null;
  const lng = typeof morada.lng === "number" ? morada.lng : null;

  if (lat != null && lng != null) {
    return { lat, lng, descobertasAgora: false };
  }

  // O que houver para procurar: a morada da coluna, ou a que ficou no JSON.
  const texto =
    pedido.address ??
    (typeof morada.formattedAddress === "string" ? morada.formattedAddress : null);
  const cp =
    pedido.postalCode ?? (typeof morada.postalCode === "string" ? morada.postalCode : null);

  const achadas = await geocodificarMorada(texto, cp);
  if (!achadas) return { lat: null, lng: null, descobertasAgora: false };

  try {
    await updateSimulatorOrder(pedido.id, {
      rawOrderJson: JSON.stringify({
        ...cru,
        address: { ...morada, lat: achadas.lat, lng: achadas.lng },
        // Deixa escrito que estas não vieram do cliente. Uma coordenada
        // deduzida de texto não é a mesma coisa que uma escolhida na pesquisa,
        // e quem investigar um preço estranho tem de o poder saber.
        coordenadasGeocodificadasEm: new Date().toISOString(),
      }),
    } as Parameters<typeof updateSimulatorOrder>[1]);
  } catch (err) {
    // Não conseguir gravar não impede de usar o que se acabou de descobrir —
    // só faz com que da próxima vez se volte a procurar.
    console.error("[coordenadasDoPedido] nao gravou as coordenadas:", err);
  }

  return { lat: achadas.lat, lng: achadas.lng, descobertasAgora: true };
}
