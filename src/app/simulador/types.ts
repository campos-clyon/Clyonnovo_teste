export type ServiceType =
  | "recolha_moveis"
  | "recolha_monos"
  | "recolha_entulho"
  | "esvaziamento_casa"
  | "esvaziamento_apartamento"
  | "mudanca"
  | "montagem_moveis"
  | "jardinagem"
  | "manutencao_casa"
  | "outro";

export type LocationZone = "A" | "B" | "C" | "D";

export interface UploadedFile {
  id: string;
  file?: File;
  previewUrl?: string;
  type?: "image" | "video";
  name: string;
  size: number;
  mimeType?: string;
  base64?: string;
}

export interface AddressData {
  formattedAddress?: string;
  city?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
}

export type AddressStatus = "empty" | "typing" | "selected" | "manual_confirmed";
export type DistanceStatus = "idle" | "calculating" | "calculated" | "error";

export interface DistanceFromBase {
  distanceMeters?: number;
  distanceKm?: number;
  durationSeconds?: number;
  durationText?: string;
  calculatedAt?: string;
  isEstimate?: boolean; // true quando calculado por Haversine (sem Google Maps)
}

export interface ReceiverData {
  name?: string;
  phone?: string;
  email?: string;
}

// ── Mudança: condições de acesso por local ──────────────────────────────────
export interface MovingAccess {
  floor?: string;
  hasElevator?: "yes" | "small" | "no" | "unknown";
  parkingDistance?: "door" | "under_20m" | "over_30m" | "difficult" | "unknown";
  difficultAccess?: boolean;
  accessNotes?: string;
}

// ── Mudança: distância origem → destino ──────────────────────────────────────
export interface MovingDistance {
  distanceMeters?: number;
  distanceKm?: number;
  durationSeconds?: number;
  durationText?: string;
  calculatedAt?: string;
  isEstimate?: boolean;
}

export interface OrderData {
  serviceType?: ServiceType;
  description?: string;
  files?: UploadedFile[];
  locationZone?: LocationZone;
  city?: string;
  address?: AddressData;
  addressStatus?: AddressStatus;
  distanceFromBase?: DistanceFromBase;
  distanceStatus?: DistanceStatus;
  floor?: string;
  hasElevator?: "yes" | "small" | "no" | "unknown";
  parkingDistance?: "door" | "under_20m" | "over_30m" | "difficult" | "unknown";
  needsDismantling?: "no" | "simple" | "medium" | "complex" | "unknown";
  heavyItems?: string[];
  urgency?: "no" | "today" | "tomorrow" | "this_week" | "flexible";
  receiver?: ReceiverData;
  // Campos específicos para entulho
  entulhoState?: "ensacado" | "chao" | "misto" | "bigbags" | "unknown";
  entulhoQuantidade?: string;
  entulhoQuantidadeEnsacados?: string;   // misto: sacos já ensacados
  entulhoQuantidadePorEnsacar?: string;  // misto: sacos por ensacar
  entulhoQuantidadeBigBags?: string;     // big bags: nº de big bags (1 = 42 sacos)
  entulhoVolume?: "carrinha" | "camiao_caixa" | "camiao_lixo" | "incerto"; // estimativa visual
  entulhoQuantidadeIncerta?: boolean;    // cliente marcou "não tenho a certeza"
  // Campos específicos para mudança (dois endereços)
  originAddress?: AddressData;
  originAddressValue?: string;
  originAddressStatus?: AddressStatus;
  destinationAddress?: AddressData;
  destinationAddressValue?: string;
  destinationAddressStatus?: AddressStatus;
  originAccess?: MovingAccess;
  destinationAccess?: MovingAccess;
  movingDistance?: MovingDistance;
  movingDistanceStatus?: DistanceStatus;
  /** Marcação recorrente (só relevante para categorias tipo jardinagem/manutenção) */
  recurrenceFrequency?: "semanal" | "quinzenal" | null;
}

export type EstimateStatus = "estimated" | "needs_more_info" | "onsite_required";
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export type AnalysisSource =
  | "clyon_pricing"
  | "clyon_pricing_plus_web_reference"
  | "web_reference_only"
  | "needs_human_review"
  | "gemini_reference"
  | "fallback_reference"
  | "gemini"
  | "local_fast_estimate"
  | "timeout_fallback";

/** Custo de mão de obra calculado segundo a regra CLYON */
export interface LaborCost {
  estimatedHours: number;   // nunca < 1
  peopleCount: 3;           // fixo
  hourlyRatePerPerson: 9;   // fixo — 9€/hora/pessoa
  laborCost: number;        // = estimatedHours × 3 × 9
}

/** Fonte de informação consultada na pesquisa externa */
export interface ExternalSource {
  title: string;
  url: string;
  snippet?: string;
}

/**
 * Estimativa de referência obtida por pesquisa externa (web grounding via Gemini).
 * Apenas para uso interno no backoffice — nunca exposta ao cliente.
 */
export interface ExternalMarketEstimate {
  minWithoutVat: number | null;
  maxWithoutVat: number | null;
  suggestedWithoutVat: number | null;
  reasoning: string;
  sources: ExternalSource[];
  searchedAt: string;
  confidence: "high" | "medium" | "low";
}

export interface EstimateResult {
  status: EstimateStatus;
  estimatedPriceWithoutVat: number | null;
  vatAmount: number | null;
  estimatedPriceWithVat: number | null;
  /** Limite inferior do intervalo estimado (sem IVA) */
  estimateMinWithoutVat?: number | null;
  /** Limite superior do intervalo estimado (sem IVA) */
  estimateMaxWithoutVat?: number | null;
  difficultyLevel: DifficultyLevel;
  summary: string;
  assumptions: string[];
  missingFields: string[];
  customerMessage: string;
  internalNotes: string[];
  /** Equipa estimada (ex: "2 a 3 pessoas") */
  teamSize?: string | null;
  /** Horas estimadas em texto (ex: "1 a 2 horas") */
  estimatedHoursText?: string | null;
  /** Recomendação de acção para o admin */
  recommendation?: "pode_aprovar" | "pedir_fotos" | "pedir_info" | "visita_presencial" | null;
  /** Limite inferior do intervalo estimado (com IVA) */
  estimateMinWithVat?: number | null;
  /** Limite superior do intervalo estimado (com IVA) */
  estimateMaxWithVat?: number | null;
  /** Número de itens resolvido para o cálculo de mínimos */
  itemCount?: number | null;
  /** Indica se o pedido foi tratado como carga completa (≥ FULL_LOAD_ITEM_THRESHOLD) */
  isFullLoad?: boolean | null;
  /** Detalhes de mão de obra (sempre presente quando status = "estimated") */
  labor?: LaborCost;
  /**
   * Componente de deslocação considerada no cálculo (base CLYON → morada).
   * distanceCost é interno (regra CLYON: km × 2 €) e nunca é detalhado ao cliente.
   */
  travel?: {
    distanceKm: number | null;
    durationText?: string | null;
    distanceCost?: number | null;
    /** Origem do valor: "google" (Routes API), "manual" (admin) ou "estimate" (Haversine) */
    source?: "google" | "manual" | "estimate" | null;
  };
  /** Fonte da análise — preçário CLYON tem sempre prioridade */
  analysisSource?: AnalysisSource;
  /** Confiança geral da análise */
  confidence?: "high" | "medium" | "low";
  /**
   * Valor recomendado s/IVA — mais favorável à empresa do que o mínimo absoluto.
   * Aplicado a cargas completas para garantir margens estratégicas por zona e
   * distância. Nunca inferior ao mínimo absoluto (applyZoneMinimum).
   * Se igual ao estimatedPriceWithoutVat, o preço já estava acima do recomendado.
   */
  recommendedPriceWithoutVat?: number | null;
  /** recommendedPriceWithoutVat × 1.23 */
  recommendedPriceWithVat?: number | null;
  /**
   * Referência de mercado obtida por pesquisa externa.
   * APENAS para uso interno (assistente/admin). Nunca mostrar ao cliente.
   */
  externalMarketEstimate?: ExternalMarketEstimate;
  _pricingSnapshot?: Record<string, unknown>;
}

export type ChatMessageRole = "assistant" | "user";

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: Date;
  quickReplies?: string[];
  showContactForm?: boolean;
  showAddressField?: boolean;
  showUpload?: boolean;
  files?: UploadedFile[];
}

export type ChatStep =
  | "service_type"
  | "description"
  | "files"
  | "city"
  | "address"
  | "floor"
  | "elevator"
  | "parking"
  | "dismantling"
  | "heavy_items"
  | "urgency"
  | "receiver"
  | "complete";
