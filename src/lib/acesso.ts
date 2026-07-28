import { tElevator, tParking } from "@/lib/translations";

/**
 * Condições de acesso — que valores o backoffice pode ESCREVER.
 *
 * Os rótulos vivem em `translations.ts`, que também sabe ler o legado. Aqui
 * fica só a lista do que é válido gravar hoje, e é curta de propósito: a
 * tradução perdoa valores antigos, a escrita não os deve criar.
 *
 * O detalhe de pedido oferecia `sim`/`nao` e `porta`/`proximo`/`medio`/
 * `longe`. Nada disso existe nos dados — o simulador e o formulário gravam
 * `yes`/`small`/`no` e `door`/`under_20m`/`over_30m`/`difficult`. Por isso o
 * campo mostrava sempre "Não informado"; e bastava mexer-lhe e gravar para
 * escrever por cima um valor que o motor de preços não sabe ler.
 */

export const ELEVATOR_VALUES = ["yes", "small", "no", "unknown"] as const;
export type ElevatorValue = (typeof ELEVATOR_VALUES)[number];

export const PARKING_VALUES = ["door", "under_20m", "over_30m", "difficult", "unknown"] as const;
export type ParkingValue = (typeof PARKING_VALUES)[number];

export const elevatorLabel = (v?: string | null) => (v ? tElevator(v) : null);
export const parkingLabel = (v?: string | null) => (v ? tParking(v) : null);

/**
 * Um valor gravado que a lista de escrita não conhece — legado, tipicamente.
 * Serve para o mostrar na mesma em vez de o fazer desaparecer do ecrã.
 */
export function isUnknownAccessValue(value: unknown, valores: readonly string[]): boolean {
  const v = typeof value === "string" ? value.trim() : "";
  return v !== "" && !valores.includes(v);
}

/**
 * De onde veio o pedido.
 *
 * O simulador grava `origemPedido`; o formulário da homepage grava `_source`.
 * O backoffice só olhava para o primeiro, por isso todos os pedidos vindos do
 * formulário apareciam etiquetados como "Simulador".
 */
const ORIGEM_LABELS: Record<string, string> = {
  hero_quote_form: "Formulário",
  formulario_contactos: "Contactos",
  quero_contratar: "Contratar",
  quero_contratar_header: "Contratar",
  simulador: "Simulador",
};

export type OrigemPedido = { label: string; slug: string };

export function origemDoPedido(rawOrderJson: string | null | undefined): OrigemPedido {
  if (!rawOrderJson) return { label: "Simulador", slug: "simulador" };
  try {
    const raw = JSON.parse(rawOrderJson) as Record<string, unknown>;
    const bruto = raw.origemPedido ?? raw._source ?? raw.source ?? null;
    const slug = typeof bruto === "string" ? bruto.trim() : "";
    if (!slug) return { label: "Simulador", slug: "simulador" };
    // Uma origem nova aparece com o valor cru: é mais honesto do que assumir
    // que veio do simulador, que foi exactamente o erro que aqui existia.
    return { label: ORIGEM_LABELS[slug] ?? slug, slug };
  } catch {
    return { label: "Simulador", slug: "simulador" };
  }
}
