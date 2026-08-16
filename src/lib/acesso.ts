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
  formulario_site: "Formulário do site",
  formulario_contactos: "Contactos",
  quero_contratar: "Contratar",
  quero_contratar_header: "Contratar",
  simulador: "Simulador",
};

export type OrigemPedido = { label: string; slug: string };

/**
 * A origem a partir do slug já extraído.
 *
 * A lista de pedidos não recebe o rawOrderJson inteiro — traria 100 objectos
 * completos para mostrar uma etiqueta. Recebe só o slug, extraído em SQL, e
 * usa isto. O mapa de rótulos é o mesmo dos dois lados, que é o que impede a
 * lista e o detalhe de voltarem a discordar como discordavam.
 */
export function origemPeloSlug(slug: string | null | undefined): OrigemPedido {
  const s = (slug ?? "").trim();
  if (!s) return { label: "Simulador", slug: "simulador" };
  return { label: ORIGEM_LABELS[s] ?? s, slug: s };
}

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

/**
 * De onde veio um lead, para a coluna "Origem".
 *
 * A coluna `leads.origem` existia e ninguém a preenchia, por isso o painel
 * caía no caminho da página — e mostrava `/` a todos os leads da homepage,
 * que não diz nada a quem está a trabalhar.
 */
export function origemDoLead(
  lead: { origem?: string | null; pagePath?: string | null; utmSource?: string | null },
): string {
  const o = lead.origem?.trim();
  if (o) return ORIGEM_LABELS[o] ?? o.replace(/_/g, " ");

  // Sem origem gravada (leads antigos), a página serve — mas escrita de
  // forma legível. A raiz é a homepage, não uma barra.
  const p = lead.pagePath?.trim();
  if (p) return p === "/" ? "Página inicial" : p;

  const utm = lead.utmSource?.trim();
  if (utm) return `Campanha · ${utm}`;
  return "—";
}
