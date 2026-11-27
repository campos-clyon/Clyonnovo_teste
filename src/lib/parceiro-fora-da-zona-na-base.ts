import { limiteDaZonaKm } from "./fora-da-zona-na-base";
import { geocodificarLocalidade, type Coordenadas } from "./geocodificar";
import { parceiroForaDaZona, type ParceiroForaDaZona } from "./parceiro-fora-da-zona";

/**
 * O PARCEIRO FORA DA ZONA, NO SERVIDOR — d15 (27-11-2026). A regra está em
 * `parceiro-fora-da-zona.ts`; aqui lê-se o limite das Configs (`limiteDaZonaKm`,
 * a mesma função que marca os pedidos) e, nas candidaturas — que só têm a cidade
 * escrita —, procuram-se as coordenadas dela. Nunca lança.
 */

/** O limite das Configs, para os ecrãs e os avisos (o mesmo dos pedidos). */
export const limiteDaZonaParaOsParceiros = limiteDaZonaKm;

/** Quantas cidades novas se procuram por pedido (o Nominatim pede um pedido por segundo). */
const PROCURAS_POR_PEDIDO = 6;

const lembradas = new Map<string, Coordenadas | null>();

const chaveDaCidade = (cidade: string) => cidade.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * A marca de cada candidatura (pelo id) cuja cidade fica acima do limite. A cidade
 * sem coordenadas — ou que ficou por procurar neste pedido — não marca.
 */
export async function candidaturasForaDaZona(
  candidaturas: ReadonlyArray<{ id: number; cidade: string | null; estado: string }>,
): Promise<Map<number, ParceiroForaDaZona>> {
  const marcadas = new Map<number, ParceiroForaDaZona>();
  try {
    const limite = await limiteDaZonaKm();
    let procuras = 0;
    for (const c of candidaturas) {
      // Só as que ainda se decidem: uma recusada ou já convertida em conta não precisa de aviso.
      if (c.estado !== "nova" && c.estado !== "convidada") continue;
      const cidade = c.cidade ? chaveDaCidade(c.cidade) : "";
      if (cidade.length < 2) continue;
      let ponto = lembradas.get(cidade);
      if (ponto === undefined) {
        if (procuras >= PROCURAS_POR_PEDIDO) continue;
        procuras++;
        ponto = await geocodificarLocalidade(cidade);
        // Falhou: não se lembra (pode ser a rede); acertou, ou não existe: lembra-se.
        if (ponto) lembradas.set(cidade, ponto);
      }
      const f = parceiroForaDaZona(ponto, limite);
      if (f) marcadas.set(c.id, f);
    }
  } catch (e) {
    console.error("[parceiro-fora-da-zona] candidaturas:", e instanceof Error ? e.message : e);
  }
  return marcadas;
}

/** A marca de cada conta (pelo id), pelas coordenadas da base que já tem. */
export async function contasForaDaZona(
  contas: ReadonlyArray<{ id: unknown; baseLat: unknown; baseLng: unknown }>,
): Promise<{ limite: number; marcas: Map<number, ParceiroForaDaZona> }> {
  const limite = await limiteDaZonaKm();
  const marcas = new Map<number, ParceiroForaDaZona>();
  for (const c of contas) {
    const f = parceiroForaDaZona({ lat: c.baseLat, lng: c.baseLng }, limite);
    if (f) marcas.set(Number(c.id), f);
  }
  return { limite, marcas };
}
