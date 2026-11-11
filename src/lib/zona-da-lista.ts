import { CONCELHOS_DA_COBERTURA, concelhoDoPonto } from "./concelhos-da-cobertura";
import type { Ponto } from "./distancia-entre-pontos";

/**
 * A ZONA DE UM PEDIDO NA LISTA DAS MUDANÇAS — 11-11-2026.
 *
 * Quem entra na lista decide-se pela LOCALIDADE da origem, e não pela porta:
 * a distância da base de cada parceiro mede-se até ao centro do concelho da
 * origem (os de `concelhos-da-cobertura.ts`). Duas moradas da mesma terra
 * vêem a mesma lista.
 *
 * Fora dos concelhos que se medem, o ponto arredonda-se a uma décima de grau
 * (uns 10 km) — a mesma ideia, sem tabela.
 *
 * O percurso (origem → destino), os km e a estimativa continuam a ser os das
 * duas moradas: isto só decide quem aparece.
 *
 * Pura: a lista, a conferência do pedido e o envio aos escolhidos usam o mesmo
 * ponto, para que quem apareceu na lista seja quem recebe o pedido.
 */

/** O lado da quadrícula fora dos concelhos conhecidos, em graus. */
export const PASSO_DA_QUADRICULA = 0.1;

const CENTROS = new Map(CONCELHOS_DA_COBERTURA.map((c) => [c.id, c.centro]));

const aDecima = (v: number) => Math.round(v / PASSO_DA_QUADRICULA) * PASSO_DA_QUADRICULA;

export function pontoDaZona(p: Ponto): Ponto {
  const concelho = concelhoDoPonto(p);
  const centro = concelho ? CENTROS.get(concelho) : null;
  if (centro) return { lat: centro.lat, lng: centro.lng };
  return { lat: Number(aDecima(p.lat).toFixed(1)), lng: Number(aDecima(p.lng).toFixed(1)) };
}
