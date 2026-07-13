import { getSimulatorSettings } from "./db";
import type { SimulatorSettingKey, SimulatorSettingsMap } from "./simulator-settings";
import { createSimulatorSettingsMap } from "./simulator-settings";
import type { LaborCost } from "../app/simulador/types";

/**
 * Carrega todas as configurações de preços ativas do backoffice
 * E devolve um objeto formatado pronto para o Gemini
 */
export async function getActivePricingRulesForGemini() {
  try {
    const settings = await getSimulatorSettings();
    console.log("[pricing-helper] Configurações carregadas:", settings?.length ?? 0, "itens");

    if (!settings || settings.length === 0) {
      console.warn("[pricing-helper] Nenhuma configuração de preços encontrada, usando defaults");
      return getDefaultPricingRules();
    }

    // Converter array para mapa utilizável
    const settingsMap = createSimulatorSettingsMap(settings);

    // Formatar para Gemini (texto legível)
    const result = formatPricingRulesForGemini(settingsMap);
    console.log("[pricing-helper] ✓ Preçário formatado para Gemini (" + result.length + " chars)");
    return result;
  } catch (error) {
    console.error("[pricing-helper] ❌ Erro ao carregar configurações:", error);
    console.log("[pricing-helper] Usando defaults como fallback");
    return getDefaultPricingRules();
  }
}

/**
 * Devolve um mapa estruturado dos preços atuais para cálculos backend
 */
export async function getActivePricingMap(): Promise<SimulatorSettingsMap> {
  try {
    const settings = await getSimulatorSettings();
    console.log("[pricing-helper] getActivePricingMap: Carregados", settings?.length ?? 0, "itens");
    const map = createSimulatorSettingsMap(settings);
    console.log("[pricing-helper] ✓ Mapa de preços criado");
    return map;
  } catch (error) {
    console.error("[pricing-helper] ❌ Erro ao carregar mapa de preços:", error);
    const fallback = createSimulatorSettingsMap([]);
    console.log("[pricing-helper] Usando fallback com defaults");
    return fallback;
  }
}

/**
 * Formata as regras de preço (com fórmula de custo real) em texto legível para o Gemini.
 * Lê os valores configuráveis da DB para que o Gemini use sempre os valores actuais.
 */
function formatPricingRulesForGemini(settingsMap: SimulatorSettingsMap): string {
  const custoKm       = settingsMap.custo_km          ?? 0.50;
  const custoHoraPess = settingsMap.custo_hora_pessoa  ?? 9;
  const numPessoas    = settingsMap.num_pessoas_equipa ?? 3;
  const overhead      = settingsMap.overhead_por_servico ?? 17.00;
  const margem        = settingsMap.margem_lucro       ?? 0.40;
  const margemPct     = (margem * 100).toFixed(0);
  const fatorMargem   = (1 + margem).toFixed(2);
  const custoHoraEquipa = custoHoraPess * numPessoas;

  return `ESTRUTURA DE CUSTOS REAIS CLYON (valores actuais do backoffice):

FÓRMULA UNIVERSAL OBRIGATÓRIA:
  custo_combustivel  = distancia_ida_volta_km × ${custoKm.toFixed(2)} €/km
  custo_pessoal      = horas_estimadas × ${numPessoas} pessoas × ${custoHoraPess} €/h = horas × ${custoHoraEquipa} €/h
  overhead_fixo      = ${overhead.toFixed(2)} € por serviço
  custo_total        = custo_combustivel + custo_pessoal + overhead_fixo
  preco_sem_iva      = custo_total × ${fatorMargem}  (margem ${margemPct}% de lucro sobre custo total)
  preco_com_iva      = preco_sem_iva × 1.23

DISTÂNCIAS:
  Recolhas/esvaziamento: distância base→cliente × 2 (ida + volta)
  Mudança: distância origem→destino (sem volta à base)

HORAS ESTIMADAS POR TIPO DE SERVIÇO:

RECOLHA / MONOS / ESVAZIAMENTO (1 a 7 itens = por item):
  - 30 min por item base
  - Sem elevador: × 1.5 no tempo total
  - Elevador pequeno: × 1.15 no tempo total
  - Andar > 2º sem elevador: +10 min por andar adicional
  - Estacionamento difícil: +20 min
  - Acesso difícil / desmontagem: +30 min

RECOLHA / ESVAZIAMENTO (carga completa ≥ 6 itens):
  - Base: 4h
  - Sem elevador: 6h (× 1.5)
  - Elevador pequeno: 4.5h
  - Acesso difícil: +1h

ENTULHO — PREÇO POR SACO (adiciona ao preço calculado pela fórmula de tempo):
  - Sacos já ensacados (padrão): 3,00 € por saco s/IVA
  - Sacos sem elevador ou acesso difícil: 3,20 € por saco s/IVA
  - Entulho no chão: usar apenas fórmula de tempo com × 1.3
  Mínimo de entulho: 90 € s/IVA (sem mínimo de zona)

ENTULHO — tabela de TEMPO (para a fórmula de custo pessoal):
  - 1 a 10 sacos: 1h
  - 11 a 30 sacos: 1.5h
  - 31 a 80 sacos: 2.5h
  - 81 a 150 sacos: 4h (1 carga)
  - 151 a 240 sacos: 6h (2 cargas)
  - >240 sacos: calcular proporcionalmente
  - Entulho no chão (não ensacado): × 1.3 no tempo
  - Acesso difícil: +30 min

MUDANÇA:
  - Base: 7h
  - Sem elevador na origem (andar > 2): +1h
  - Sem elevador no destino (andar > 2): +1h
  - Acesso difícil por local: +30 min
  - Percurso acima de 30 km: +30 min

MÍNIMOS — REGRAS DIFERENTES POR TIPO DE SERVIÇO:

ITENS SOLTOS (1 a 7 itens — recolha de móveis / monos):
  NÃO aplicar mínimo de zona. Calcular pela fórmula real.
  Mínimo por item: 48,78 € s/IVA (~60 € c/IVA) por item individual.
  EXEMPLOS DE PREÇOS COM IVA:
    1 frigorifico ou arca:          50 a 80 € c/IVA
    1 sofá ou chaise longue:        80 a 120 € c/IVA
    1 cama com colchão:             80 a 120 € c/IVA
    1 armário grande:               70 a 100 € c/IVA
    1 mesa:                         45 a 70 € c/IVA
    1 cadeira:                      20 a 35 € c/IVA
    1 mono pequeno genérico:        25 a 50 € c/IVA
    1 eletrodoméstico médio:        30 a 50 € c/IVA
  DESCONTO DE EFICIÊNCIA: para múltiplos itens soltos, NÃO somar linearmente.
    2 mesas + cadeiras num 2º andar Lisboa: 100 a 130 € c/IVA (NÃO 270 €!)
    A equipa já está no local — cada item adicional custa ~60% do primeiro.

CARGA COMPLETA (≥8 itens), ESVAZIAMENTO DE CASA/APARTAMENTO:
  Aplicar VALOR RECOMENDADO por zona e distância (mais favorável à empresa):
  - Amora / Seixal / Fernão Ferro / Corroios: 220 € s/IVA
  - Almada / Barreiro / Setúbal:              220 € s/IVA
  - Lisboa acesso normal, ≤ 15 km:            250 € s/IVA
  - Lisboa acesso normal, 15-25 km:           270 € s/IVA
  - Lisboa distância > 25 km:                 300 € s/IVA
  - Lisboa andar > 3º sem elevador:           360 € s/IVA
  - Loures / VFX / Sintra / Cascais ≤ 20 km: 270 € s/IVA
  - Loures / VFX / Sintra / Cascais > 20 km: 300 € s/IVA

ENTULHO: mínimo fixo 90 € s/IVA — sem mínimo de zona
MUDANÇA: mínimo fixo 150 € s/IVA — sem mínimo de zona

AGRAVAMENTOS (adicionais ao preço final s/IVA):
  - Urgência hoje: +40 €
  - Urgência amanhã: +20 €
  - Estacionamento difícil (taxa fixa): +15 €
  - Desmontagem simples: +30 €
  - Desmontagem complexa: +80 €

IVA: 23% → preco_com_iva = preco_sem_iva × 1.23

CAMPO LABOR OBRIGATÓRIO NO JSON:
  "labor": {
    "estimatedHours": número de horas estimadas,
    "peopleCount": ${numPessoas},
    "hourlyRatePerPerson": ${custoHoraPess},
    "laborCost": horas × ${custoHoraEquipa}
  }`;
}

/**
 * Devolve as regras padrão com os valores default (fallback quando DB indisponível)
 */
function getDefaultPricingRules(): string {
  // Criar um mapa de defaults e reutilizar o formatador
  const { createSimulatorSettingsMap } = require("./simulator-settings");
  try {
    const defaultMap = createSimulatorSettingsMap([]);
    return formatPricingRulesForGemini(defaultMap);
  } catch {
    // Fallback de último recurso — texto literal com defaults
    return `ESTRUTURA DE CUSTOS REAIS CLYON (valores default):

FÓRMULA: custo_combustivel (distancia × 0.50 €/km) + custo_pessoal (horas × 3p × 9 €/h) + overhead (17.00 €) → × 1.40 (40% margem) = preço s/IVA
IVA: 23%

HORAS: Recolha 1-7 itens: 0.5h/item | Carga completa: 4h | Entulho 1-10 sacos: 1h, 11-30: 1.5h, 31-80: 2.5h, 81-150: 4h | Mudança: 7h base

MÍNIMOS (REGRA CRÍTICA):
  ITENS SOLTOS (1-7 itens): SEM mínimo de zona. Preço real pela fórmula. Mínimo 48,78€ s/IVA por item.
    Exemplos c/IVA: 1 frigorifico 50-80€ | 1 sofá 80-120€ | 1 mesa 45-70€ | 2 mesas+cadeiras Lisboa 100-130€ (NÃO 270€)
  CARGA COMPLETA (≥8 itens) / ESVAZIAMENTO: mínimo de zona — Local 220€ | Almada 230€ | Lisboa 250€ | Lisboa difícil/Loures 270€
  ENTULHO: mínimo 90€ s/IVA (sem zona) | MUDANÇA: mínimo 150€ s/IVA (sem zona)
AGRAVAMENTOS: Urgência hoje +40€ | amanhã +20€ | Estacionamento difícil +15€`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTIMATIVA RÁPIDA LOCAL (sem Gemini)
// Devolve resultado em < 50ms a partir do preçário em memória.
// ─────────────────────────────────────────────────────────────────────────────

export interface FastEstimateInput {
  serviceType?: string;
  entulhoState?: string;
  entulhoQuantidade?: string;
  entulhoQuantidadeEnsacados?: string;
  floor?: string;
  hasElevator?: string;
  parkingDistance?: string;
  needsDismantling?: string | boolean;
  distanceFromBase?: { distanceKm?: number };
  movingDistance?: { distanceKm?: number };
  originAccess?: { floor?: string; hasElevator?: string; parkingDistance?: string; difficultAccess?: boolean };
  destinationAccess?: { floor?: string; hasElevator?: string; parkingDistance?: string; difficultAccess?: boolean };
  /** Lista de itens pesados descritos pelo cliente (ex: "sofá 3 lugares", "frigorífico") */
  heavyItems?: string[];
  description?: string;
}

export interface FastEstimateResult {
  ok: boolean;
  source: "local_fast_estimate" | "fallback_reference";
  status: "estimated" | "onsite_required" | "needs_more_info";
  estimatedPriceWithoutVat: number | null;
  vatAmount: number | null;
  estimatedPriceWithVat: number | null;
  estimateMinWithoutVat?: number | null;
  estimateMaxWithoutVat?: number | null;
  estimateMinWithVat?: number | null;
  estimateMaxWithVat?: number | null;
  /** Número de itens determinado de forma determinística (resolveItemCount) — fonte única de verdade. */
  itemCount?: number;
  /** true quando tratado como carga completa (≥ FULL_LOAD_ITEM_THRESHOLD itens ou esvaziamento) */
  isFullLoad?: boolean;
  /**
   * Valor recomendado s/IVA — mais favorável à empresa que o mínimo absoluto.
   * Garantido apenas para cargas completas (zona + distância + dificuldade).
   * Se igual a estimatedPriceWithoutVat, o preço calculado já era suficiente.
   */
  recommendedPriceWithoutVat?: number | null;
  /** recommendedPriceWithoutVat × 1.23 */
  recommendedPriceWithVat?: number | null;
  labor?: LaborCost;
  difficultyLevel: 1 | 2 | 3 | 4 | 5;
  summary: string;
  assumptions: string[];
  missingFields: string[];
  customerMessage: string;
  internalNotes: string[];
  analysisSource: "local_fast_estimate" | "fallback_reference";
  confidence?: "high" | "medium" | "low";
}

// ─── Ranges de referência por tipo de serviço ─────────────────────────────────
// Valores mínimos de referência INTERNA — nunca mostrar ao cliente como orçamento final
const SERVICE_REFERENCE_RANGES: Record<string, { min: number; max: number; suggested: number }> = {
  recolha_moveis:            { min: 80,  max: 150, suggested: 110 },
  recolha_monos:             { min: 80,  max: 160, suggested: 115 },
  recolha_entulho:           { min: 120, max: 300, suggested: 180 },
  esvaziamento_apartamento:  { min: 250, max: 600, suggested: 380 },
  esvaziamento_casa:         { min: 300, max: 800, suggested: 500 },
  mudanca:                   { min: 150, max: 350, suggested: 220 },
  outro:                     { min: 100, max: 250, suggested: 160 },
};

/**
 * Estimativa de referência — usada quando não há dados suficientes para
 * calcular pelo preçário CLYON nem o Gemini conseguiu produzir valor.
 * NUNCA mostrar ao cliente como orçamento final.
 * Assegura que nenhum pedido fica com preço 0 ou null.
 */
export function buildReferenceEstimate(input: FastEstimateInput): FastEstimateResult {
  const svc = input.serviceType ?? "outro";
  const range = SERVICE_REFERENCE_RANGES[svc] ?? SERVICE_REFERENCE_RANGES["outro"];

  const assumptions: string[] = [
    `Tipo de serviço: ${svc}`,
    `Intervalo de referência mínimo para este tipo: ${range.min}€ a ${range.max}€ s/IVA`,
    "Valor sugerido: ponto médio do intervalo de referência",
  ];
  const missingFields: string[] = [];

  let suggestedBase = range.suggested;

  // Ajuste por distância — usar estimativa de zona quando não há km
  const distKm =
    input.distanceFromBase?.distanceKm ??
    input.movingDistance?.distanceKm ??
    null;

  if (distKm && distKm > 0) {
    const distExtra = distKm * 2; // 2€/km como referência
    suggestedBase += distExtra;
    assumptions.push(`Distância: ${distKm} km × 2€/km = +${distExtra.toFixed(0)}€`);
  } else {
    // Sem km → usar estimativa de zona
    const cityRef = (input as any).address?.city ?? (input as any).city ?? "";
    const isLisboa = cityRef.toLowerCase().includes("lisboa") || cityRef.toLowerCase().includes("setúbal");
    const refKm = isLisboa ? 20 : 25;
    const distExtra = refKm * 2;
    suggestedBase += distExtra;
    assumptions.push(`Distância não calculada — estimativa ${refKm} km referência (${isLisboa ? "Grande Lisboa" : "zona genérica"}): +${distExtra.toFixed(0)}€`);
    missingFields.push("distância da base");
  }

  // Mão de obra mínima
  const laborHours = estimateLaborHours(input);
  const labor = calculateLaborCost(laborHours);
  suggestedBase += labor.laborCost;
  assumptions.push(`Mão de obra: ${labor.estimatedHours}h × ${labor.peopleCount}p × ${labor.hourlyRatePerPerson}€/h = ${labor.laborCost}€`);

  // IVA
  const vatRate = 0.23;
  const vatAmount = Math.round(suggestedBase * vatRate * 100) / 100;
  const withVat = Math.round((suggestedBase + vatAmount) * 100) / 100;

  // Guardar min/max com mão de obra incluída
  const minWithLabor = Math.round((range.min + labor.laborCost) * 100) / 100;
  const maxWithLabor = Math.round((range.max + labor.laborCost) * 100) / 100;
  const vatRateRef = 0.23;
  const minWithLaborVat = Math.round(minWithLabor * (1 + vatRateRef) * 100) / 100;
  const maxWithLaborVat = Math.round(maxWithLabor * (1 + vatRateRef) * 100) / 100;
  const itemCount = resolveItemCount(input);

  return {
    ok: true,
    source: "fallback_reference",
    status: "onsite_required",
    estimatedPriceWithoutVat: Math.round(suggestedBase * 100) / 100,
    vatAmount,
    estimatedPriceWithVat: withVat,
    estimateMinWithoutVat: minWithLabor,
    estimateMaxWithoutVat: maxWithLabor,
    estimateMinWithVat: minWithLaborVat,
    estimateMaxWithVat: maxWithLaborVat,
    itemCount,
    isFullLoad: itemCount >= FULL_LOAD_ITEM_THRESHOLD,
    labor,
    difficultyLevel: 2,
    confidence: "low",
    summary: "Estimativa de referência interna (dados insuficientes para calcular pelo preçário CLYON).",
    assumptions,
    missingFields,
    customerMessage: "Pedido recebido para análise. A equipa CLYON irá confirmar os dados e entrar em contacto em breve.",
    internalNotes: [
      "ESTIMATIVA DE REFERENCIA — não usar como orçamento final sem revisão da equipa.",
      `Intervalo de referência: ${range.min}€ a ${range.max}€ s/IVA (sem mão de obra)`,
      `Com mão de obra: ${minWithLabor}€ a ${maxWithLabor}€ s/IVA`,
      `Valor sugerido s/IVA: ${Math.round(suggestedBase * 100) / 100}€, c/IVA: ${withVat}€`,
    ],
    analysisSource: "fallback_reference",
  };
}

/**
 * Tenta extrair o número de itens a partir da descrição em texto livre.
 * Usado quando heavyItems não está populado (pedidos via chat ou texto livre).
 * Devolve null se não conseguir determinar com confiança.
 *
 * Estratégia:
 *  1. Detectar palavras de quantidade explícitas: "3 sofás", "uma mesa e duas cadeiras"
 *  2. Contar ocorrências de palavras-chave de mobiliário
 *  3. Se menciona "carga completa", "tudo", "casa", "quarto" → devolver 6 (carga completa)
 */
export function countItemsFromDescription(description: string): number | null {
  if (!description) return null;
  const d = description.toLowerCase();

  // Carga completa explícita → mínimo de zona
  const fullLoadKw = ["carga completa", "tudo", "toda a casa", "todo o apartamento", "quarto inteiro", "sala inteira", "escritório inteiro"];
  if (fullLoadKw.some((kw) => d.includes(kw))) return 6;

  // Keywords de itens de mobiliário/eletrodomésticos
  const itemKeywords = [
    "sofá", "sofa", "frigorifico", "frigorífico", "arca", "mesa",
    "cadeira", "cama", "colchão", "colchao", "roupeiro", "armário", "armario",
    "estante", "televisão", "televisao", "televisor", "tv", "maquina", "máquina",
    "microondas", "forno", "computador", "secretária", "secretaria",
    "cadeirão", "cadeirao", "banco", "prateleira", "cómoda", "comoda",
    "beliche", "berço", "berco", "bicicleta", "mono", "móvel", "movel",
    "eletrodoméstico", "electrodomestico", "aparador", "vitrine", "poltrona",
  ];

  // Passagem única: cada ocorrência de keyword conta como pelo menos 1 item;
  // se tiver um quantificador (dígito OU palavra numérica) imediatamente
  // antes, usa esse valor. Isto cobre frases mistas como "uma cama com mesa
  // e 1 frigorífico mais uma máquina de lavar" → cama(1) + mesa(1) +
  // frigorífico(1) + máquina(1) = 4 itens, em vez de a primeira estratégia
  // que encontrasse QUALQUER match "ganhar" e ignorar os restantes itens
  // (bug original: a frase acima devolvia 1 em vez de 4).
  const numberWordMap: Record<string, number> = {
    um: 1, uma: 1, dois: 2, duas: 2,
    "três": 3, tres: 3, quatro: 4, cinco: 5,
    seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  };
  const numberWordsPattern = Object.keys(numberWordMap).join("|");
  const combinedRegex = new RegExp(
    `(?:(\\d+|${numberWordsPattern})\\s+)?(${itemKeywords.join("|")})`,
    "gi"
  );

  const matches = [...d.matchAll(combinedRegex)];
  if (matches.length === 0) return null;

  let total = 0;
  let lastEnd = -1;
  for (const m of matches) {
    const start = m.index ?? 0;
    if (start < lastEnd) continue; // match sobreposto com o anterior — já contado
    const qtyToken = m[1]?.toLowerCase();
    let qty = 1;
    if (qtyToken) {
      const asDigit = parseInt(qtyToken, 10);
      qty = !isNaN(asDigit) ? asDigit : numberWordMap[qtyToken] ?? 1;
    }
    total += qty;
    lastEnd = start + m[0].length;
  }

  return total > 0 ? total : null;
}

/**
 * Limite de itens a partir do qual o pedido passa a ser tratado como "carga
 * completa" (4h base + mínimo de zona) em vez de cobrado item a item.
 * Regra de negócio actual da CLYON: 1 a 7 itens cobra por item,
 * 8 ou mais é carga completa. Ponto único de configuração —
 * alterar aqui se a empresa decidir mudar o limite.
 */
export const FULL_LOAD_ITEM_THRESHOLD = 8;

/**
 * Determina o número de itens de forma determinística — fonte ÚNICA de
 * verdade, usada tanto no cálculo de horas (estimateLaborHours) como no
 * mínimo por item e mínimo de zona (applyZoneMinimum), e enviada ao Gemini
 * para que nunca tenha de recontar a partir do texto livre.
 *
 * Prioridade: heavyItems[] (lista explícita do simulador) > contagem na
 * descrição (countItemsFromDescription) > 1 (conservador — nunca infla o
 * preço por falta de informação).
 */
export function resolveItemCount(input: FastEstimateInput): number {
  const heavyItemCount = input.heavyItems?.length ?? 0;
  if (heavyItemCount > 0) return heavyItemCount;
  const fromDescription = countItemsFromDescription(input.description ?? "");
  return fromDescription !== null ? fromDescription : 1;
}

/**
 * Classifica um item descrito em texto como "pequeno", "medio" ou "grande".
 * Heurística baseada em palavras-chave comuns em pedidos CLYON.
 */
function classifyItem(description: string): "pequeno" | "medio" | "grande" {
  const d = description.toLowerCase();

  // Itens grandes (>2m): sofás, camas, roupeiros, frigoríficos, máquinas, etc.
  const large = [
    "sofá", "sofa", "roupeiro", "guarda-roupa", "guarda roupa", "frigorífico", "frigorifico",
    "máquina de lavar", "maquina de lavar", "cama dupla", "cama casal", "cama king",
    "cama queen", "armário", "armario", "secretária grande", "secretaria grande",
    "estante grande", "aparador", "vitrine", "piano", "camas", "sofas", "cama de casal",
    "estante", "escrivaninha grande", "tv grande", "televisão grande",
  ];
  // Itens médios (1-2m): cadeiras, mesas pequenas, caixas, gavetas, etc.
  const medium = [
    "cadeira", "mesa", "gaveta", "comoda", "cómoda", "criado", "prateleira",
    "caixote", "caixa grande", "microondas", "forno", "ar condicionado", "cadeiras",
    "secretária pequena", "secretaria pequena", "banqueta", "poltrona",
  ];

  if (large.some((kw) => d.includes(kw))) return "grande";
  if (medium.some((kw) => d.includes(kw))) return "medio";
  return "pequeno";
}

function floorNumber(floor?: string): number {
  if (!floor || floor === "rés-do-chão") return 0;
  if (floor === "4º+") return 4;
  return parseInt(floor.replace(/[^\d]/g, ""), 10) || 0;
}

function accessExtra(
  floor?: string,
  hasElevator?: string,
  difficultAccess?: boolean,
  pricing?: SimulatorSettingsMap
): { cost: number; notes: string[] } {
  const notes: string[] = [];
  let cost = 0;
  const n = floorNumber(floor);
  const elevPricePerFloor = pricing?.apartamento_com_elevador_por_andar ?? 3;
  const noElevPricePerFloor = pricing?.apartamento_sem_elevador_por_andar ?? 6;
  const difficultExtra = pricing?.acesso_dificil_extra ?? 30;

  if (n > 0) {
    const hasElev = hasElevator === "yes" || hasElevator === "small";
    const perFloor = hasElev ? elevPricePerFloor : noElevPricePerFloor;
    cost += n * perFloor;
    notes.push(`${n} andares ${hasElev ? "com" : "sem"} elevador: +${(n * perFloor).toFixed(2)}€`);
  }
  if (difficultAccess) {
    cost += difficultExtra;
    notes.push(`Acesso difícil: +${difficultExtra}€`);
  }
  return { cost, notes };
}

// ─── Mão de obra ─────────────────────────────────────────────────────────────
// Regras fixas CLYON:
//   equipa = 3 pessoas
//   valor hora por pessoa = 9€
//   mínimo = 1 hora
// ─────────────────────────────────────────────────────────────────────────────

const LABOR_PEOPLE = 3 as const;
const LABOR_HOURLY_RATE = 9 as const;
const LABOR_MIN_HOURS = 1;

/**
 * Estima horas de trabalho segundo as regras reais da CLYON (documento de custos).
 * Nunca devolve menos de LABOR_MIN_HOURS (1h).
 *
 * MUDANÇA         — base 7h + acesso origen/destino + percurso
 * ENTULHO         — tabela de sacos (1-10→1h, 11-30→1.5h, 31-80→2.5h,
 *                   81-150→4h, 151-240→6h, >240 proporcional)
 *                   + no chão: +30% | acesso difícil: +0.5h
 * RECOLHA/MONO/   — por item (30 min/item) OU carga completa (≥8 itens → 4h)
 * ESVAZIAMENTO    — escala por andar/elevador/estacionamento
 */
export function estimateLaborHours(input: FastEstimateInput): number {
  let hours = LABOR_MIN_HOURS;
  const svc = input.serviceType;

  if (svc === "mudanca") {
    // Base: 7 horas (conforme documento de custos)
    hours = 7;
    const origFloor = floorNumber(input.originAccess?.floor);
    const destFloor = floorNumber(input.destinationAccess?.floor);
    const origNoElev = input.originAccess?.hasElevator === "no";
    const destNoElev = input.destinationAccess?.hasElevator === "no";
    // Sem elevador acima do 2º andar: +1h em cada local
    if (origFloor > 2 && origNoElev) hours += 1;
    if (destFloor > 2 && destNoElev) hours += 1;
    // Acesso difícil: +30 min por local
    if (input.originAccess?.difficultAccess) hours += 0.5;
    if (input.destinationAccess?.difficultAccess) hours += 0.5;
    // Percurso acima de 30 km: +30 min
    const distKm = input.movingDistance?.distanceKm ?? 0;
    if (distKm > 30) hours += 0.5;

  } else if (svc === "recolha_entulho") {
    // Tabela de sacos — cada saco adicional demora menos (não linear)
    const qtd = parseInt((input.entulhoQuantidade ?? "").replace(/[^\d]/g, ""), 10) || 0;
    if (qtd <= 10)       hours = 1;
    else if (qtd <= 30)  hours = 1.5;
    else if (qtd <= 80)  hours = 2.5;
    else if (qtd <= 150) hours = 4;
    else if (qtd <= 240) hours = 6;
    else                 hours = 6 + Math.ceil((qtd - 240) / 80) * 2; // proporcional
    // Entulho no chão (inclui big bags, tratados como sacos no chão): +30% no tempo
    if (
      input.entulhoState === "chao" ||
      input.entulhoState === "misto" ||
      input.entulhoState === "bigbags"
    ) {
      hours = Math.round(hours * 1.3 * 2) / 2;
    }
    // Acesso difícil: +30 min
    if (input.parkingDistance === "difficult" || input.needsDismantling) hours += 0.5;

  } else {
    // Recolha móveis / monos / esvaziamento / outro
    const floor = floorNumber(input.floor);
    const noElev = input.hasElevator === "no";
    const smallElev = input.hasElevator === "small";
    // Fonte única de verdade — usa heavyItems[] ou conta na descrição (nunca 0)
    const itemCount = resolveItemCount(input);
    const isFull = svc === "esvaziamento_casa" || svc === "esvaziamento_apartamento" || itemCount >= FULL_LOAD_ITEM_THRESHOLD;

    if (isFull) {
      // Carga completa: base 4h
      hours = 4;
      if (noElev)       hours = 6;      // sem elevador: 4h × 1.5
      else if (smallElev) hours = 4.5;  // elevador pequeno
      if (input.parkingDistance === "difficult" || input.needsDismantling) hours += 1; // acesso difícil
    } else {
      // Por item (1 a 7 itens): 30 min/item = 0.5h/item
      hours = Math.max(0.5, itemCount * 0.5);
      // Sem elevador: +50% no tempo total
      if (noElev) hours = hours * 1.5;
      // Elevador pequeno: +15% no tempo total
      else if (smallElev) hours = hours * 1.15;
      // Andar acima do 2º sem elevador: +10 min por andar adicional
      if (noElev && floor > 2) hours += (floor - 2) * (10 / 60);
      // Estacionamento difícil: +20 min
      if (input.parkingDistance === "difficult") hours += 20 / 60;
      // Acesso difícil / desmontagem: +30 min
      if (input.needsDismantling === "medium") hours += 0.5;
      else if (input.needsDismantling === "complex" || input.needsDismantling === "true" || input.needsDismantling === true) hours += 0.5;
    }
  }

  // Arredondar a 0.5h e garantir mínimo de 1h
  return Math.max(LABOR_MIN_HOURS, Math.round(hours * 2) / 2);
}

/**
 * Calcula o custo de mão de obra com as regras fixas CLYON.
 * equipa = 3 pessoas, 9€/hora/pessoa, mínimo 1 hora.
 */
export function calculateLaborCost(hours: number): LaborCost {
  const clampedHours = Math.max(LABOR_MIN_HOURS, hours);
  return {
    estimatedHours: clampedHours,
    peopleCount: LABOR_PEOPLE,
    hourlyRatePerPerson: LABOR_HOURLY_RATE,
    laborCost: Math.round(clampedHours * LABOR_PEOPLE * LABOR_HOURLY_RATE * 100) / 100,
  };
}

/**
 * Determina a distância de ida e volta (em km) para o cálculo de combustível.
 * - Recolhas/esvaziamento: base → cliente → base (ida + volta)
 * - Mudança: origem → destino (sem volta à base — não é necessário)
 */
function getDistanceForFuel(input: FastEstimateInput): number {
  if (input.serviceType === "mudanca") {
    return input.movingDistance?.distanceKm ?? 0;
  }
  const oneWay = input.distanceFromBase?.distanceKm ?? 0;
  return oneWay * 2; // ida e volta
}

/**
 * Aplica mínimos comerciais por zona ao preço final sem IVA.
 * Retorna o preço com mínimo aplicado e nota de pressuposto se ajustado.
 *
 * Regra de negócio:
 *   - Entulho: mínimo fixo 90 € s/IVA (sem mínimo de zona)
 *   - Mudança: mínimo fixo 150 € s/IVA (sem mínimo de zona)
 *   - Itens soltos (1–7 itens): mínimo 48,78 € s/IVA por item (~60 € c/IVA)
 *     SEM aplicar mínimo de zona — o preço é o real calculado pela fórmula
 *   - Carga completa (≥8 itens), esvaziamento: aplicar mínimo de zona
 */
function applyZoneMinimum(
  priceWithoutVat: number,
  city: string,
  floor: string | undefined,
  hasElevator: string | undefined,
  parkingDistance: string | undefined,
  svc: string | undefined,
  itemCount: number = 1,
  isFullLoad: boolean = false,
): { price: number; note: string | null; minimumThreshold: number } {
  // Entulho: mínimo fixo próprio, sem mínimo de zona
  if (svc === "recolha_entulho") {
    if (priceWithoutVat < 90) return { price: 90, note: "Mínimo de entulho aplicado: 90 € s/IVA", minimumThreshold: 90 };
    return { price: priceWithoutVat, note: null, minimumThreshold: 90 };
  }

  // Mudança: mínimo fixo, sem mínimo de zona
  if (svc === "mudanca") {
    if (priceWithoutVat < 150) return { price: 150, note: "Mínimo de mudança aplicado: 150 € s/IVA", minimumThreshold: 150 };
    return { price: priceWithoutVat, note: null, minimumThreshold: 150 };
  }

  // Itens soltos (1 a FULL_LOAD_ITEM_THRESHOLD-1 itens): NÃO aplicar mínimo de zona
  // Para recolha_moveis/monos sem carga completa, usar apenas mínimo por item: 48,78€ s/IVA
  const isLooseItems = !isFullLoad && (svc === "recolha_moveis" || svc === "recolha_monos") && itemCount < FULL_LOAD_ITEM_THRESHOLD;
  if (isLooseItems) {
    const effectiveCount = Math.max(1, itemCount);
    const perItemMin = 48.78; // ~60 € c/IVA por item
    const itemMin = Math.round(effectiveCount * perItemMin * 100) / 100;
    if (priceWithoutVat < itemMin) {
      return {
        price: itemMin,
        note: `Mínimo por item aplicado: ${effectiveCount} item(s) × 48,78 € = ${itemMin.toFixed(2)} € s/IVA`,
        minimumThreshold: itemMin,
      };
    }
    return { price: priceWithoutVat, note: null, minimumThreshold: itemMin };
  }

  // Carga completa / esvaziamento: aplicar mínimo de zona
  const c = city.toLowerCase();
  const isLisboa = c.includes("lisboa") || c.includes("lisbon");
  const isLoures = c.includes("loures") || c.includes("alverca") || c.includes("vila franca") || c.includes("cascais") || c.includes("sintra");
  const isAlmada = c.includes("almada") || c.includes("barreiro") || c.includes("setúbal") || c.includes("setubal");
  const isLocal = c.includes("amora") || c.includes("seixal") || c.includes("fernão ferro") || c.includes("fernao ferro") || c.includes("corroios");

  const floorN = floorNumber(floor);
  const noElev = hasElevator === "no";
  const hardParking = parkingDistance === "difficult";
  const isDifficultAccess = (floorN > 2 && noElev) || hardParking;

  let minimum = 220; // default: zona local
  if (isLocal)        minimum = 220;
  else if (isAlmada)  minimum = 230;
  else if (isLisboa)  minimum = isDifficultAccess ? 270 : 250;
  else if (isLoures)  minimum = 270;
  else                minimum = 240; // zona genérica não mapeada

  if (priceWithoutVat < minimum) {
    return { price: minimum, note: `Mínimo de zona aplicado (${city || "zona"}): ${minimum} € s/IVA`, minimumThreshold: minimum };
  }
  return { price: priceWithoutVat, note: null, minimumThreshold: minimum };
}

/**
 * Calcula o valor recomendado pela empresa para cargas completas — mais
 * favorável que o mínimo absoluto (applyZoneMinimum), incorporando zona,
 * distância e dificuldade de acesso. Afecta APENAS o campo
 * recommendedPriceWithoutVat; nunca altera o mínimo absoluto nem o max.
 *
 * Tabela de referência (valores s/IVA):
 *   Margem Sul local / Almada / Barreiro     — 220 €
 *   Lisboa normal, distância ≤ 15 km         — 250 €
 *   Lisboa normal, distância 15-25 km        — 270 €
 *   Lisboa distância > 25 km                 — 300 €
 *   Lisboa andar > 3 sem elevador (qualquer) — 360 €
 *   Loures / Sintra / Cascais / VFX ≤ 20 km — 270 €
 *   Loures / Sintra / Cascais / VFX > 20 km — 300 €
 *
 * Só se aplica a cargas completas (isFullLoad = true).
 * Devolve null para entulho, mudança ou itens soltos.
 */
function applyRecommendedPrice(
  currentPriceSemIva: number,
  city: string,
  floor: string | undefined,
  hasElevator: string | undefined,
  parkingDistance: string | undefined,
  svc: string | undefined,
  isFullLoad: boolean,
  distKmOneWay: number,
): { recommended: number; note: string | null } {
  // Só cargas completas ou esvaziamentos
  if (!isFullLoad || svc === "recolha_entulho" || svc === "mudanca") {
    return { recommended: currentPriceSemIva, note: null };
  }
  if (svc !== "esvaziamento_casa" && svc !== "esvaziamento_apartamento" &&
      svc !== "recolha_moveis" && svc !== "recolha_monos" && svc !== undefined) {
    // outro tipo — não aplicar
  }

  const c = city.toLowerCase();
  const floorN = floorNumber(floor);
  const noElev = hasElevator === "no";
  const hardParking = parkingDistance === "difficult";

  const isLisboa  = c.includes("lisboa") || c.includes("lisbon");
  const isLoures  = c.includes("loures") || c.includes("alverca") || c.includes("vila franca") || c.includes("cascais") || c.includes("sintra");
  const isAlmada  = c.includes("almada") || c.includes("barreiro") || c.includes("setúbal") || c.includes("setubal");
  const isLocal   = c.includes("amora") || c.includes("seixal") || c.includes("fernão ferro") || c.includes("fernao ferro") || c.includes("corroios");

  let recommended: number;
  let zone: string;

  if (isLisboa) {
    // Andar alto sem elevador → máximo agravamento
    if (floorN > 3 && noElev) {
      recommended = 360;
      zone = "Lisboa, andar > 3 sem elevador";
    } else if (hardParking || (floorN > 2 && noElev)) {
      // Acesso difícil qualquer
      recommended = distKmOneWay > 20 ? 300 : 270;
      zone = `Lisboa, acesso difícil, ${distKmOneWay} km`;
    } else {
      // Acesso normal — escala por distância
      if      (distKmOneWay > 25) recommended = 300;
      else if (distKmOneWay > 15) recommended = 270;
      else                         recommended = 250;
      zone = `Lisboa normal, ${distKmOneWay} km`;
    }
  } else if (isLoures) {
    recommended = distKmOneWay > 20 ? 300 : 270;
    zone = `Loures/Sintra/Cascais, ${distKmOneWay} km`;
  } else if (isAlmada || isLocal || c === "") {
    recommended = 220;
    zone = isAlmada ? "Almada/Barreiro" : "Margem Sul local";
  } else {
    // Zona genérica não mapeada
    recommended = 240;
    zone = "zona genérica";
  }

  // O valor recomendado nunca pode ser inferior ao preço actual (que já
  // passou pelo mínimo absoluto de zona)
  recommended = Math.max(recommended, currentPriceSemIva);

  if (recommended > currentPriceSemIva) {
    return {
      recommended,
      note: `Valor recomendado (${zone}): ${recommended} € s/IVA`,
    };
  }
  return { recommended, note: null };
}

export async function calculateFastEstimate(input: FastEstimateInput): Promise<FastEstimateResult> {
  const pricing = await getActivePricingMap();

  // ── Parâmetros reais da estrutura de custos (da DB) ─────────────────────────
  const custoKm       = pricing.custo_km          ?? 0.50;   // €/km
  const custoHoraPess = pricing.custo_hora_pessoa  ?? 9;     // €/hora/pessoa
  const numPessoas    = pricing.num_pessoas_equipa ?? 3;     // pessoas na equipa
  const overhead      = pricing.overhead_por_servico ?? 17.00; // €/serviço
  // "Outro Serviço" é sempre tratado como genérico de risco desconhecido —
  // margem de segurança fixa de 30%, independente da margem configurada no
  // backoffice para os restantes tipos de serviço.
  const margem        = input.serviceType === "outro" ? 0.30 : (pricing.margem_lucro ?? 0.40);

  const missing: string[] = [];
  const assumptions: string[] = [];
  const notes: string[] = ["Estimativa rápida local — fórmula de custo real CLYON + 40% margem"];

  // ── 1. Horas estimadas ───────────────────────────────────────────────────────
  if (input.serviceType === "recolha_entulho") {
    const qtdStr = input.entulhoQuantidade ?? "";
    const qtd = parseInt(qtdStr.replace(/[^\d]/g, ""), 10);
    if (!qtd || isNaN(qtd)) missing.push("quantidade de sacos de entulho");
  }

  const laborHours = estimateLaborHours(input);
  const labor = calculateLaborCost(laborHours);

  // ── 2. Custo de combustível (ida + volta ou percurso de mudança) ─────────────
  const distKmFuel = getDistanceForFuel(input);
  const custoCombustivel = Math.round(distKmFuel * custoKm * 100) / 100;
  if (distKmFuel > 0) {
    assumptions.push(`Combustível: ${distKmFuel} km × ${custoKm.toFixed(2)} €/km = ${custoCombustivel.toFixed(2)} €`);
  } else {
    assumptions.push("Distância não calculada — combustível estimado a 0 €");
    missing.push("distância da base");
  }

  // ── 3. Custo de pessoal ──────────────────────────────────────────────────────
  const custoPessoal = Math.round(laborHours * numPessoas * custoHoraPess * 100) / 100;
  assumptions.push(
    `Pessoal: ${laborHours}h × ${numPessoas} pessoas × ${custoHoraPess} €/h = ${custoPessoal.toFixed(2)} €`
  );

  // ── 4. Overhead fixo por serviço ─────────────────────────────────────────────
  assumptions.push(`Overhead fixo: ${overhead.toFixed(2)} €`);

  // ── 5. Custo total + margem de lucro ─────────────────────────────────────────
  const custoTotal = custoCombustivel + custoPessoal + overhead;
  const precoSemIva = Math.round(custoTotal * (1 + margem) * 100) / 100;
  notes.push(
    `Custo total: combustível ${custoCombustivel}€ + pessoal ${custoPessoal}€ + overhead ${overhead}€ = ${custoTotal.toFixed(2)}€ → ×${(1 + margem).toFixed(2)} (margem ${(margem * 100).toFixed(0)}%) = ${precoSemIva}€ s/IVA`
  );

  // ── 6. Custo por saco de entulho (entulho ensacado ou misto) ────────────────
  // Motor B unifica com a regra do prompt Gemini: saco ensacado = 3,00€; difícil = 3,20€
  let sacoCost = 0;
  if (input.serviceType === "recolha_entulho") {
    const sacoDificil = input.hasElevator === "no" || input.parkingDistance === "difficult";
    const taxaSaco = sacoDificil
      ? (pricing.entulho_saco_chao ?? 3.20)
      : (pricing.entulho_saco_ensacado ?? 3.00);

    if (input.entulhoState === "ensacado") {
      const qtd = parseInt((input.entulhoQuantidade ?? "").replace(/[^\d]/g, ""), 10) || 0;
      if (qtd > 0) {
        sacoCost = Math.round(qtd * taxaSaco * 100) / 100;
        assumptions.push(`Sacos ensacados: ${qtd} × ${taxaSaco.toFixed(2)} €/saco = ${sacoCost.toFixed(2)} €`);
      }
    } else if (input.entulhoState === "misto") {
      const qtdEns = parseInt((input.entulhoQuantidadeEnsacados ?? "").replace(/[^\d]/g, ""), 10) || 0;
      if (qtdEns > 0) {
        sacoCost = Math.round(qtdEns * taxaSaco * 100) / 100;
        assumptions.push(`Sacos já ensacados (misto): ${qtdEns} × ${taxaSaco.toFixed(2)} €/saco = ${sacoCost.toFixed(2)} €`);
      }
    }
  }

  // ── 7. Agravamentos adicionais (taxas fixas do documento) ────────────────────
  let extras = sacoCost;
  const urgency = (input as any).urgency ?? "";
  if (urgency === "today")    { extras += 40; assumptions.push("Urgência hoje: +40 €"); }
  if (urgency === "tomorrow") { extras += 20; assumptions.push("Urgência amanhã: +20 €"); }
  if (input.parkingDistance === "difficult") { extras += 15; assumptions.push("Estacionamento difícil (taxa fixa): +15 €"); }

  // ── 7. Fallback se dados insuficientes ───────────────────────────────────────
  if (missing.length > 0 && precoSemIva <= 0) {
    const ref = buildReferenceEstimate(input);
    return {
      ...ref,
      assumptions: [...assumptions, ...ref.assumptions],
      missingFields: [...missing, ...ref.missingFields],
      internalNotes: [
        ...notes,
        `Dados em falta: ${missing.join(", ")} — aplicada estimativa de referência.`,
        ...ref.internalNotes,
      ],
    };
  }

  // ── 8. Aplicar mínimos de zona ───────────────────────────────────────────────
  const city = (input as any).address?.city ?? (input as any).city ?? "";

  // Determinar itemCount — fonte única de verdade (heavyItems[] > descrição > 1)
  const itemCount = resolveItemCount(input);

  const isFull =
    input.serviceType === "esvaziamento_casa" ||
    input.serviceType === "esvaziamento_apartamento" ||
    itemCount >= FULL_LOAD_ITEM_THRESHOLD;
  const { price: precoComMinimo, note: minNote, minimumThreshold } = applyZoneMinimum(
    precoSemIva + extras,
    city,
    input.floor,
    input.hasElevator,
    input.parkingDistance,
    input.serviceType,
    itemCount,
    isFull,
  );
  if (minNote) assumptions.push(minNote);

  // ── 9. Valor recomendado pela empresa (cargas completas) ─────────────────
  // Distância de uma via para cálculo do recomendado (não ida+volta)
  const distKmOneWay = input.distanceFromBase?.distanceKm ?? input.movingDistance?.distanceKm ?? 0;
  const { recommended: precoRecomendado, note: recNote } = applyRecommendedPrice(
    precoComMinimo,
    city,
    input.floor,
    input.hasElevator,
    input.parkingDistance,
    input.serviceType,
    isFull,
    distKmOneWay,
  );
  if (recNote) assumptions.push(recNote);

  // ── 10. IVA e resultado final ─────────────────────────────────────────────
  const vatRate = 0.23;
  const finalSemIva = Math.round(precoComMinimo * 100) / 100;
  const vat = Math.round(finalSemIva * vatRate * 100) / 100;
  const withVat = Math.round((finalSemIva + vat) * 100) / 100;

  const recSemIva = Math.round(precoRecomendado * 100) / 100;
  const recComIva = Math.round(recSemIva * 1.23 * 100) / 100;

  // Dificuldade estimada
  const totalFloors =
    floorNumber(input.floor) +
    floorNumber(input.originAccess?.floor) +
    floorNumber(input.destinationAccess?.floor);
  const diff: 1 | 2 | 3 | 4 | 5 =
    totalFloors >= 6 ? 4 : totalFloors >= 4 ? 3 : totalFloors >= 2 ? 2 : 1;

  // Intervalo mínimo/médio/máximo — o mínimo NUNCA pode ficar abaixo do
  // mínimo comercial aplicável (zona/entulho/mudança/por item), para nunca
  // gerar prejuízo; o máximo dá margem de ±10% sobre o valor médio calculado.
  const minVal = Math.max(minimumThreshold, Math.round(finalSemIva * 0.90 * 100) / 100);
  const maxVal = Math.round(finalSemIva * 1.10 * 100) / 100;
  const minValWithVat = Math.round(minVal * (1 + vatRate) * 100) / 100;
  const maxValWithVat = Math.round(maxVal * (1 + vatRate) * 100) / 100;

  return {
    ok: true,
    source: "local_fast_estimate",
    status: missing.length > 0 ? "needs_more_info" : "estimated",
    estimatedPriceWithoutVat: finalSemIva,
    vatAmount: vat,
    estimatedPriceWithVat: withVat,
    estimateMinWithoutVat: minVal,
    estimateMaxWithoutVat: maxVal,
    estimateMinWithVat: minValWithVat,
    estimateMaxWithVat: maxValWithVat,
    recommendedPriceWithoutVat: recSemIva,
    recommendedPriceWithVat: recComIva,
    itemCount,
    isFullLoad: isFull,
    labor,
    difficultyLevel: diff,
    confidence: missing.length > 0 ? "low" : distKmFuel > 0 ? "high" : "medium",
    summary: `Estimativa calculada com fórmula de custo real CLYON: combustível + pessoal + overhead × ${(1 + margem).toFixed(2)} (margem ${(margem * 100).toFixed(0)}%).`,
    assumptions,
    missingFields: missing,
    customerMessage: `Estimativa de referência: à volta de ${finalSemIva.toFixed(2)} € + IVA (${withVat.toFixed(2)} € c/IVA). Inclui equipa de ${numPessoas} pessoas, ${laborHours}h de trabalho.`,
    internalNotes: [
      ...notes,
      `Itens identificados: ${itemCount} (${isFull ? "carga completa" : "itens soltos"})`,
      `Total s/IVA: ${finalSemIva}€ | IVA 23%: ${vat}€ | Total c/IVA: ${withVat}€`,
      `Intervalo: ${minVal}€ a ${maxVal}€ s/IVA (${minValWithVat}€ a ${maxValWithVat}€ c/IVA)`,
      ...(recSemIva > finalSemIva
        ? [`Valor recomendado (acima do calculado): ${recSemIva}€ s/IVA (${recComIva}€ c/IVA)`]
        : []),
    ],
    analysisSource: "local_fast_estimate",
  };
}

/**
 * Snapshot do preçário para guardar junto ao pedido
 */
export async function createPricingSnapshot() {
  try {
    const settingsMap = await getActivePricingMap();
    return {
      timestamp: new Date().toISOString(),
      source: "backoffice_simulator_values",
      entulho_saco_ensacado: settingsMap.entulho_saco_ensacado,
      entulho_saco_chao: settingsMap.entulho_saco_chao,
      entulho_distancia_km: settingsMap.entulho_distancia_km,
      apartamento_com_elevador_por_andar: settingsMap.apartamento_com_elevador_por_andar,
      apartamento_sem_elevador_por_andar: settingsMap.apartamento_sem_elevador_por_andar,
      acesso_dificil_extra: settingsMap.acesso_dificil_extra,
    };
  } catch (error) {
    console.error("[pricing-helper] Erro ao criar snapshot:", error);
    return null;
  }
}
