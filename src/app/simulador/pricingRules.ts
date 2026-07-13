import type { OrderData, EstimateResult, DifficultyLevel, LocationZone } from "./types";
import { getActivePricingMap } from "@/lib/pricing-helper";
import type { SimulatorSettingsMap } from "@/lib/simulator-settings";
import { createSimulatorSettingsMap } from "@/lib/simulator-settings";

export const TAX_RATE = 0.23;

// Será carregado dinamicamente se disponível
let cachedSettings: SimulatorSettingsMap | null = null;
let settingsLoadTime = 0;
const SETTINGS_CACHE_MS = 60000; // Recarregar a cada minuto

// ─── Preçário CLYON (valores sem IVA) ────────────────────────────────────────
//
// Entulho : ~3 € por saco standard (50 L). Mínimo 90 €.
// Monos / móveis: preço por item (ver tabela abaixo). Mínimo 80 €.
// Esvaziamento: sempre visita presencial.
//
// Deslocação base por zona (incluída no serviço)
const ZONE_TRAVEL: Record<Exclude<LocationZone, "D">, number> = {
  A: 0,   // Amora / Fernão Ferro — base da empresa
  B: 20,  // Lisboa / Oeiras / Amadora / Odivelas
  C: 40,  // Cascais / Sintra / Loures / Almada / Setúbal / Montijo / Barreiro
};

function getZoneTravel(zone: LocationZone | undefined): number {
  if (!zone || zone === "D") return 0;
  return ZONE_TRAVEL[zone];
}

// Determina zona com base na cidade/morada
export function detectZone(city: string | undefined): LocationZone {
  if (!city) return "B";
  const c = city.toLowerCase();
  if (
    c.includes("amora") ||
    c.includes("fernão ferro") ||
    c.includes("fernao ferro") ||
    c.includes("seixal") ||
    c.includes("corroios") ||
    c.includes("laranjeiro") ||
    c.includes("fogueteiro")
  ) return "A";
  if (
    c.includes("loures") ||
    c.includes("vila franca") ||
    c.includes("alverca") ||
    c.includes("cascais") ||
    c.includes("sintra") ||
    c.includes("setúbal") ||
    c.includes("setubal") ||
    c.includes("montijo") ||
    c.includes("barreiro") ||
    c.includes("almada")
  ) return "C";
  if (
    c.includes("lisboa") ||
    c.includes("oeiras") ||
    c.includes("amadora") ||
    c.includes("odivelas")
  ) return "B";
  return "D";
}

// Extrai quantidade de sacos/unidades da descrição livre
export function extractQuantityFromDescription(description: string | undefined): number | null {
  if (!description) return null;
  const t = description.toLowerCase();
  const m = t.match(/(\d+)\s*(sacos?|caixas?|monos?|móveis?|peças?|unidades?|cadeiras?|sofás?|armários?|mesas?|estantes?|camas?)/);
  if (m) return parseInt(m[1], 10);
  const m2 = t.match(/^(\d+)\s/);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

// ─── Cálculo por tipo de serviço ──────────────────────────────────────────────

// Entulho: NOVA REGRA - 2,50€ ensacado OU 3,00€ por ensacar + distância
// Esta função é um fallback; Gemini tem a versão correta no prompt
function calcEntulhoBase(qty: number | null, isBagged: boolean = true): { price: number; note: string } {
  const sacos = qty ?? 20;
  
  // Preços corretos do precário CLYON atualizado
  const pricePerBag = isBagged ? 2.50 : 3.00;
  const price = sacos * pricePerBag;
  
  const state = isBagged ? "ensacados" : "por ensacar";
  return { 
    price, 
    note: `${sacos} sacos ${state} × ${pricePerBag}€/saco = ${price}€` 
  };
}

// Preço unitário por tipo de item (móveis/monos)
const ITEM_PRICE: Record<string, number> = {
  sofa:        60,
  sofá:        60,
  cama:        50,
  colchao:     40,
  colchão:     40,
  armario:     70,
  armário:     70,
  arca:        50,
  frigorifico: 55,
  frigorífico: 55,
  maquina:     45,
  máquina:     45,
  televisao:   35,
  televisão:   35,
  computador:  30,
  mesa:        45,
  cadeira:     20,
  mono:        25,
};

function calcMovelBase(qty: number | null, description: string): { price: number; note: string } {
  const t = description.toLowerCase();
  const n = qty ?? 1;
  for (const [key, unitPrice] of Object.entries(ITEM_PRICE)) {
    if (t.includes(key)) {
      return { price: Math.max(80, n * unitPrice), note: `${n} × ${key} (~${unitPrice} €/item)` };
    }
  }
  // Genérico: 35 € por item, mínimo 90 €
  return { price: Math.max(90, n * 35), note: `${n} item(s) de mobiliário/monos (~35 €/item)` };
}

// ─── Dificuldade de acesso ────────────────────────────────────────────────────

function calcDifficulty(order: OrderData): DifficultyLevel {
  let score = 0;

  if (order.hasElevator === "no") score += 2;
  else if (order.hasElevator === "small") score += 1;

  const floor = order.floor ?? "";
  if (floor.includes("4") || floor.includes("5") || floor.includes("superior")) score += 2;
  else if (floor.includes("3")) score += 1;
  else if (floor.includes("2")) score += 1;

  if (order.parkingDistance === "difficult") score += 2;
  else if (order.parkingDistance === "over_30m") score += 1;

  if (order.needsDismantling === "complex") score += 2;
  else if (order.needsDismantling === "medium") score += 1;

  if (order.urgency === "today") score += 1;

  if (score <= 1) return 1;
  if (score <= 3) return 2;
  if (score <= 5) return 3;
  if (score <= 7) return 4;
  return 5;
}

const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  1: "Fácil",
  2: "Normal",
  3: "Acesso moderado",
  4: "Acesso difícil",
  5: "Muito difícil",
};

function needsOnsiteVisit(order: OrderData): boolean {
  const svc = order.serviceType;
  if (svc === "esvaziamento_casa" || svc === "esvaziamento_apartamento") return true;
  if (order.needsDismantling === "complex") return true;
  if (order.locationZone === "D") return true;
  return false;
}

// ─── Helper: Carregar settings com cache ──────────────────────────────────

async function getSettings(): Promise<SimulatorSettingsMap> {
  const now = Date.now();
  if (cachedSettings && (now - settingsLoadTime) < SETTINGS_CACHE_MS) {
    return cachedSettings; // Cache hit
  }
  
  try {
    cachedSettings = await getActivePricingMap();
    settingsLoadTime = now;
    console.log("[pricingRules] ✓ Settings carregados do backoffice");
  } catch (error) {
    console.warn("[pricingRules] Erro ao carregar settings, usando defaults", error);
    cachedSettings = createSimulatorSettingsMap(); // Defaults
  }
  
  return cachedSettings;
}

// ─── Função principal (agora async) ───────────────────────────────────────────

export async function calculateLocalEstimate(order: OrderData): Promise<EstimateResult> {
  // Carregar settings dinâmicos
  const settings = await getSettings();
  const missingFields: string[] = [];

  if (!order.serviceType) missingFields.push("Tipo de serviço");
  if (!order.description && (!order.files || order.files.length === 0))
    missingFields.push("Descrição ou fotos");

  // Para entulho não é obrigatório ter morada — podemos dar preço só com sacos
  const isEntulho =
    order.serviceType === "recolha_entulho" ||
    order.description?.toLowerCase().includes("entulho") ||
    order.description?.toLowerCase().includes("saco");

  if (!isEntulho) {
    if (!order.floor) missingFields.push("Andar");
    if (!order.hasElevator || order.hasElevator === "unknown") missingFields.push("Elevador");
    if (!order.parkingDistance || order.parkingDistance === "unknown") missingFields.push("Estacionamento");
  }

  if (!order.receiver?.name || !order.receiver?.phone) missingFields.push("Nome e contacto");

  if (missingFields.length > 2) {
    // Se faltam mais do que 2 campos não-contacto, ainda não temos dados suficientes
    const nonContactMissing = missingFields.filter(
      (f) => f !== "Nome e contacto"
    );
    if (nonContactMissing.length > 0) {
      return {
        status: "needs_more_info",
        estimatedPriceWithoutVat: null,
        vatAmount: null,
        estimatedPriceWithVat: null,
        difficultyLevel: 2,
        summary: "Faltam dados para calcular a estimativa.",
        assumptions: [],
        missingFields,
        customerMessage:
          "Para calcular a estimativa precisamos de mais alguns detalhes: " +
          nonContactMissing.join(", ") + ".",
        internalNotes: ["Dados insuficientes para estimar."],
      };
    }
  }

  const zone = order.locationZone ?? detectZone(order.city ?? order.address?.city);

  if (needsOnsiteVisit(order)) {
    return {
      status: "onsite_required",
      estimatedPriceWithoutVat: null,
      vatAmount: null,
      estimatedPriceWithVat: null,
      difficultyLevel: calcDifficulty(order),
      summary: "Visita presencial recomendada",
      assumptions: [],
      missingFields: [],
      customerMessage:
        "Este pedido requer validação presencial ou análise por vídeo, devido ao volume, acesso ou complexidade. A nossa equipa irá contactá-lo para combinar uma visita gratuita.",
      internalNotes: ["Recomendada visita presencial."],
    };
  }

  if (zone === "D") {
    return {
      status: "onsite_required",
      estimatedPriceWithoutVat: null,
      vatAmount: null,
      estimatedPriceWithVat: null,
      difficultyLevel: calcDifficulty(order),
      summary: "Fora da zona padrão",
      assumptions: [],
      missingFields: [],
      customerMessage:
        "A morada indicada está fora da nossa área de cobertura padrão. Iremos contactá-lo para apresentar um orçamento personalizado.",
      internalNotes: ["Zona D — orçamento personalizado."],
    };
  }

  const difficulty = calcDifficulty(order);
  const assumptions: string[] = [];
  const internalNotes: string[] = [];

  const qty = extractQuantityFromDescription(order.description);

  // ── Preço base por tipo de serviço ──
  let base = 0;

  if (isEntulho) {
    // entulhoState === 'chao' → entulho por ensacar (isBagged = false)
    const isBagged = order.entulhoState !== "chao";
    const r = calcEntulhoBase(qty, isBagged);
    base = r.price;
    assumptions.push(r.note);
    internalNotes.push(`Entulho: ${r.note}`);
  } else if (order.serviceType === "outro") {
    // "Outro serviço" → preço base genérico com margem de segurança de 30%
    const baseRaw = calcMovelBase(qty, order.description ?? "").price;
    const r = { price: Math.round(baseRaw * 1.30), note: `Serviço genérico (+30% margem de segurança)` };
    base = r.price;
    assumptions.push(r.note);
    internalNotes.push(`Outro serviço: ${r.note}`);
  } else if (order.movelMode === "item") {
    // Modo Item: preço fixo por tamanho — custo laboral anulado (plano v3.0 §5.2)
    const p = (order.movelItemsPequeno ?? 0) * 25;
    const m = (order.movelItemsMedio  ?? 0) * 50;
    const g = (order.movelItemsGrande ?? 0) * 60;
    base = Math.max(80, p + m + g);
    const note = [
      order.movelItemsPequeno ? `${order.movelItemsPequeno}× pequeno (25€)` : null,
      order.movelItemsMedio   ? `${order.movelItemsMedio}× médio (50€)` : null,
      order.movelItemsGrande  ? `${order.movelItemsGrande}× grande (60€)` : null,
    ].filter(Boolean).join(", ") || "Itens por tamanho";
    assumptions.push(`Item — ${note}`);
    internalNotes.push(`Modo item: ${note} = ${p + m + g}€ (mín 80€)`);
  } else {
    const r = calcMovelBase(qty, order.description ?? "");
    base = r.price;
    assumptions.push(r.note);
    internalNotes.push(`Móveis/monos: ${r.note}`);
  }

  // ── Deslocação por zona ──
  const travel = getZoneTravel(zone);
  if (travel > 0) {
    base += travel;
    assumptions.push(
      `Deslocação Zona ${zone} (+${travel} €)`
    );
    internalNotes.push(`Zona ${zone}, deslocação: +${travel} €`);
  }

  // ── Extra por acesso difícil ──
  if (difficulty === 3) {
    base += 25;
    assumptions.push("Acesso moderado (+25 €)");
  } else if (difficulty === 4) {
    base += 60;
    assumptions.push("Acesso difícil — sem elevador ou peso (+60 €)");
  }

  // ── Extra por urgência ──
  if (order.urgency === "today") {
    base += 40;
    assumptions.push("Urgente — mesmo dia (+40 €)");
  } else if (order.urgency === "tomorrow") {
    base += 20;
    assumptions.push("Urgente — amanhã (+20 €)");
  }

  // ── Desmontagem ──
  if (order.needsDismantling === "simple") {
    base += 35;
    assumptions.push("Desmontagem simples (+35 €)");
  } else if (order.needsDismantling === "medium") {
    base += 80;
    assumptions.push("Desmontagem média (+80 €)");
  }

  // ── Ajuste por distância real ──
  const distKm = order.distanceFromBase?.distanceKm;
  if (distKm !== undefined) {
    if (distKm > 70) {
      return {
        status: "onsite_required",
        estimatedPriceWithoutVat: null,
        vatAmount: null,
        estimatedPriceWithVat: null,
        difficultyLevel: difficulty,
        summary: `Distância: ${distKm} km`,
        assumptions: [],
        missingFields: [],
        customerMessage:
          "A distância até à morada indicada é elevada. Iremos apresentar um orçamento personalizado.",
        internalNotes: [`Distância: ${distKm} km — orçamento personalizado.`],
      };
    } else {
      // Para entulho: 2€/km. Para outros: usar escala progressiva
      if (isEntulho) {
        const distCost = distKm * 2; // 2€ por km para entulho
        base += distCost;
        assumptions.push(`Distância de ${distKm} km × 2€ = +${distCost}€`);
      } else if (distKm > 35) {
        base += 40;
        assumptions.push(`Distância de ${distKm} km (+40 €)`);
      } else if (distKm > 20) {
        base += 20;
        assumptions.push(`Distância de ${distKm} km (+20 €)`);
      }
    }
    internalNotes.push(`Distância: ${distKm} km`);
  }

  // ── Intervalo de ±10% ──
  const low = Math.floor(base * 0.9 / 5) * 5;
  const high = Math.ceil(base * 1.1 / 5) * 5;
  const mid = (low + high) / 2;
  const vat = Math.round(mid * TAX_RATE);
  const total = Math.round(mid + vat);

  return {
    status: "estimated",
    estimatedPriceWithoutVat: mid,
    vatAmount: vat,
    estimatedPriceWithVat: total,
    difficultyLevel: difficulty,
    summary: DIFFICULTY_LABELS[difficulty],
    assumptions,
    missingFields: [],
    customerMessage:
      `Com base nas informações enviadas, a estimativa para este pedido é de ${low} € a ${high} € + IVA. ` +
      `O valor considera: ${assumptions.join("; ")}. ` +
      `Sujeito a confirmação pela equipa CLYON após verificação no local.`,
    internalNotes,
  };
}
