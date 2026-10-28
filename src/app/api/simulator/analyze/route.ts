import { GoogleGenerativeAI } from "@google/generative-ai";
import { modeloDoGemini, MODELO_ACTUAL } from "@/lib/modelo-do-gemini";
import type { NextRequest } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { buscarImagemExterna } from "@/lib/url-externo-seguro";
import type { OrderData, EstimateResult, ExternalMarketEstimate, AnalysisSource } from "../../../simulador/types";
import {
  getActivePricingRulesForGemini,
  createPricingSnapshot,
  calculateFastEstimate,
  buildReferenceEstimate,
  FULL_LOAD_ITEM_THRESHOLD,
} from "@/lib/pricing-helper";
import { buildAnalysisPrompt } from "@/lib/prompt-do-orcamento";
import { servicoNaPesquisa, servicoParaOModelo } from "@/lib/nome-do-servico-no-orcamento";

// Gemini abortado após este tempo — cliente nunca fica preso
const GEMINI_TIMEOUT_MS = 4000;
// Pesquisa externa — timeout maior (grounding é mais lenta)
const GROUNDING_TIMEOUT_MS = 8000;

// ── Decidir se precisamos de pesquisa externa ─────────────────────────────────
function needsExternalSearch(analysis: EstimateResult): boolean {
  if (analysis.status === "onsite_required") return true;
  if (analysis.confidence === "low") return true;
  if (!analysis.estimatedPriceWithoutVat) return true;
  // missingFields críticos que indicam que o preçário não chegou
  const critical = ["serviceType", "city", "description", "zona"];
  const hasCritical = analysis.missingFields?.some((f) =>
    critical.some((c) => f.toLowerCase().includes(c))
  );
  if (hasCritical) return true;
  // Gemini não conseguiu calcular preço mas status é "estimated" (valor 0 ou nulo)
  if (
    analysis.status === "estimated" &&
    (analysis.estimatedPriceWithoutVat === 0 || analysis.estimatedPriceWithoutVat === null)
  )
    return true;
  return false;
}

// ── Construir query de pesquisa — SEM dados pessoais ─────────────────────────
function buildSearchQuery(order: OrderData): string {
  // Os nomes vivem em nome-do-servico-no-orcamento.ts, com a manutenção da casa (25-10-2026).
  const service = servicoNaPesquisa(order.serviceType);
  // Usar apenas cidade/localidade genérica, nunca morada completa, nome, telefone ou email
  const city = order.address?.city ?? order.city ?? "Lisboa";
  const safeCity = city.split(",")[0].split(" ").slice(0, 2).join(" "); // "Lisboa" ou "Setúbal"

  let q = `preço ${service} ${safeCity} Portugal`;

  if (order.serviceType === "recolha_entulho" && order.entulhoQuantidade) {
    q = `preço recolha entulho sacos ${safeCity} Portugal`;
  } else if (order.serviceType === "mudanca") {
    q = `preço mudança pequena ${safeCity} Portugal empresa mudanças`;
  } else if (order.serviceType === "esvaziamento_casa" || order.serviceType === "esvaziamento_apartamento") {
    q = `preço esvaziamento apartamento ${safeCity} Portugal`;
  }

  return q;
}

// ── Pesquisa externa com Gemini + Google Search grounding ────────────────────
async function getExternalMarketEstimate(
  order: OrderData,
  apiKey: string,
  modelName: string
): Promise<ExternalMarketEstimate | null> {
  const searchQuery = buildSearchQuery(order);
  // O nome legível, e não o código cru («manutencao_casa») — 25-10-2026.
  const serviceLabel = order.serviceType ? servicoParaOModelo(order.serviceType) : "serviço não especificado";

  const prompt = `És um analista interno da empresa CLYON em Portugal.

TAREFA: Pesquisa referências de mercado para o seguinte serviço, usando apenas termos genéricos sem dados pessoais.

Serviço: ${serviceLabel}
Query de pesquisa: ${searchQuery}

INSTRUÇÕES IMPORTANTES:
1. Esta pesquisa é apenas referência interna para a equipa CLYON. Não substitui o preçário oficial CLYON.
2. Procura referências de preços de mercado para serviços semelhantes em Portugal, preferencialmente Grande Lisboa / Setúbal.
3. Considera empresas de recolha de móveis, recolha de entulho, mudanças, esvaziamento de casas, transporte de volumosos e manutenção da casa (reparações e remodelações).
4. Devolve um intervalo estimado e explica a lógica.
5. Inclui fontes consultadas quando disponíveis.
6. Não uses dados pessoais do cliente na pesquisa.
7. Se não houver fonte fiável, usa confidence low.

Retorna APENAS um JSON válido com este formato exato:
{
  "minWithoutVat": número ou null,
  "maxWithoutVat": número ou null,
  "suggestedWithoutVat": número ou null,
  "confidence": "high" | "medium" | "low",
  "reasoning": "string com explicação do raciocínio e fontes",
  "sources": [
    { "title": "string", "url": "string", "snippet": "string opcional" }
  ]
}

Se não encontrares informação suficiente, devolve null para os valores numéricos e confidence "low".
Retorna APENAS o JSON sem texto adicional.`;

  try {
    const client = new GoogleGenerativeAI(apiKey);
    // O grounding pelo googleSearchRetrieval acompanha o modelo actual — ver
    // modelo-do-gemini.ts. Estava fixo no gemini-1.5-flash, que a Google retirou.
    const groundingModel = client.getGenerativeModel({
      model: MODELO_ACTUAL,
      tools: [{ googleSearchRetrieval: { dynamicRetrievalConfig: { dynamicThreshold: 0.3 } } }],
    });

    const groundingResult = await Promise.race([
      groundingModel.generateContent(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("GROUNDING_TIMEOUT")), GROUNDING_TIMEOUT_MS)
      ),
    ]);

    const resp = (groundingResult as Awaited<ReturnType<typeof groundingModel.generateContent>>).response;
    const text = resp.text();
    const groundingMeta = resp.candidates?.[0]?.groundingMetadata;

    // Parse JSON da resposta
    let jsonStr = text.trim();
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);

    const parsed = JSON.parse(jsonStr.trim());

    // Extrair fontes do grounding metadata (mais fiável que o que o Gemini inventar)
    const groundingSources = (groundingMeta?.groundingChunks ?? [])
      .filter((c: any) => c.web?.uri)
      .map((c: any) => ({
        title: c.web.title ?? c.web.uri,
        url: c.web.uri,
      }))
      .slice(0, 5); // máximo 5 fontes

    // Fundir fontes do grounding com as que o Gemini declarou (sem duplicados)
    const allUrls = new Set(groundingSources.map((s: any) => s.url));
    const geminiSources = (Array.isArray(parsed.sources) ? parsed.sources : []).filter(
      (s: any) => s.url && !allUrls.has(s.url)
    );
    const sources = [...groundingSources, ...geminiSources].slice(0, 5);

    return {
      minWithoutVat: typeof parsed.minWithoutVat === "number" ? parsed.minWithoutVat : null,
      maxWithoutVat: typeof parsed.maxWithoutVat === "number" ? parsed.maxWithoutVat : null,
      suggestedWithoutVat: typeof parsed.suggestedWithoutVat === "number" ? parsed.suggestedWithoutVat : null,
      confidence: (["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low") as "high" | "medium" | "low",
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "Pesquisa externa realizada.",
      sources,
      searchedAt: new Date().toISOString(),
    };
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === "GROUNDING_TIMEOUT";
    console.error("[v0] getExternalMarketEstimate:", isTimeout ? "timeout" : "erro", err);
    return null;
  }
}

// ── Determinar analysisSource final ──────────────────────────────────────────
function resolveAnalysisSource(
  baseSource: AnalysisSource,
  externalEstimate: ExternalMarketEstimate | null,
  analysis: EstimateResult
): AnalysisSource {
  // Fallback de referência — preservar a fonte original
  if (baseSource === "fallback_reference") return "fallback_reference";

  if (!externalEstimate) {
    // Sem pesquisa externa
    if (baseSource === "gemini" || baseSource === "clyon_pricing") {
      // Gemini não conseguiu calcular preço → marca como referência Gemini
      if (!analysis.estimatedPriceWithoutVat || analysis.estimatedPriceWithoutVat <= 0) {
        return "gemini_reference";
      }
      return "clyon_pricing";
    }
    if (baseSource === "timeout_fallback" || baseSource === "local_fast_estimate") {
      return baseSource;
    }
    if (analysis.status === "onsite_required" || analysis.confidence === "low") {
      return "needs_human_review";
    }
    return baseSource;
  }
  // Com pesquisa externa
  if (analysis.estimatedPriceWithoutVat && analysis.estimatedPriceWithoutVat > 0) {
    return "clyon_pricing_plus_web_reference";
  }
  return "web_reference_only";
}

export async function POST(req: NextRequest) {
  // Rate limit: 20 análises por IP por 60 segundos
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`analyze:${ip}`, 20, 60);
  if (!rl.allowed) {
    return Response.json(
      { error: "Demasiados pedidos. Aguarde um momento e tente novamente." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let order: OrderData;
  try {
    const body = await req.json();
    order = body.order;
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  // ── 1. Estimativa rápida local (sempre calculada, < 50ms) ────────────────
  const fastEstimate = await calculateFastEstimate(order as never);

  // ── 2. Preparar ficheiros para Gemini ────────────────────────────────────
  // Preservar previewUrl e base64 das IMAGENS para análise multimodal.
  // Vídeos e ficheiros não-imagem são excluídos (Gemini só suporta imagens no SDK de API).
  const orderForGemini: OrderData = {
    ...order,
    files: order.files?.map((f) => ({
      id:         f.id,
      name:       f.name,
      size:       f.size,
      type:       f.type,
      mimeType:   f.mimeType,
      // Preservar URL e base64 apenas para imagens — vídeos omitidos
      previewUrl: f.type === "image" ? (f.previewUrl ?? undefined) : undefined,
      base64:     f.type === "image" ? (f.base64 ?? undefined)     : undefined,
    })) ?? [],
  };

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json({
      ...fastEstimate,
      analysisSource: "clyon_pricing" as AnalysisSource,
      confidence: "medium" as const,
      internalNotes: [
        ...fastEstimate.internalNotes,
        "GEMINI_API_KEY não configurada — usada estimativa local.",
        ...(fastEstimate.recommendedPriceWithoutVat && fastEstimate.recommendedPriceWithoutVat > (fastEstimate.estimatedPriceWithoutVat ?? 0)
          ? [`VALOR RECOMENDADO EMPRESA: ${fastEstimate.recommendedPriceWithoutVat}€ s/IVA (${fastEstimate.recommendedPriceWithVat}€ c/IVA)`]
          : []),
      ],
    } satisfies EstimateResult);
  }

  const modelName = modeloDoGemini(process.env.GEMINI_MODEL);

  // ── 3. Chamar Gemini com timeout rígido ──────────────────────────────────
  let analysis: EstimateResult;
  let baseSource: AnalysisSource = "clyon_pricing";

  try {
    const pricingRules = await getActivePricingRulesForGemini();
    const pricingSnapshot = await createPricingSnapshot();
    // Número de itens já calculado deterministicamente pelo motor local — o Gemini
    // NUNCA deve recontar a partir do texto livre (era a causa do bug de subcontagem).
    const resolvedItemCount = fastEstimate.itemCount ?? 1;
    const resolvedIsFullLoad = fastEstimate.isFullLoad ?? false;
    const formattedData = formatOrderDataForPrompt(orderForGemini, resolvedItemCount, resolvedIsFullLoad);
    // hasPhotos: indica ao Gemini que deve analisar as imagens multimodais em conjunto
    const hasPhotos = (orderForGemini.files ?? []).some(
      (f) => f.type === "image" && (f.base64 || f.previewUrl)
    );
    const prompt = buildAnalysisPrompt(formattedData, pricingRules, hasPhotos);

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: modelName });

    // ── Construir partes de imagem para análise multimodal ────────────────
    // Converte URLs do Vercel Blob em inlineData (base64) para o Gemini.
    // Máximo de 5 imagens, cada uma com timeout de 2s para não atrasar em excesso.
    // Se uma imagem falhar, é ignorada silenciosamente.
    const imageFiles = (orderForGemini.files ?? []).filter(
      (f) => f.type === "image" && (f.base64 || f.previewUrl)
    ).slice(0, 5);

    type ImagePart = { inlineData: { mimeType: string; data: string } };

    // Fetch de todas as imagens em paralelo (antes era sequencial — até 10s de latência)
    const imageResults = await Promise.allSettled(
      imageFiles.map(async (f): Promise<ImagePart | null> => {
        if (f.base64) {
          const mimeType = f.mimeType ?? "image/jpeg";
          const data = f.base64.replace(/^data:[^;]+;base64,/, "");
          return data.length > 0 ? { inlineData: { mimeType, data } } : null;
        }
        if (f.previewUrl) {
          // Este `fetch` era direto ao que viesse no corpo do pedido: o
          // servidor ia buscar qualquer endereço que lhe mandassem, incluindo
          // os da rede interna, e a resposta dizia ao atacante se o sítio
          // existia. Agora só vai ao nosso armazenamento — ver
          // src/lib/url-externo-seguro.ts.
          const imagem = await buscarImagemExterna(f.previewUrl);
          if (imagem) {
            return { inlineData: { mimeType: imagem.mimeType, data: imagem.buffer.toString("base64") } };
          }
        }
        return null;
      })
    );
    const imageParts = imageResults
      .filter((r): r is PromiseFulfilledResult<ImagePart | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((v): v is ImagePart => v !== null);

    // Construir conteúdo: imagens primeiro (contexto visual), depois o prompt de texto
    // Se não houver imagens, envia apenas o prompt (comportamento original)
    const geminiContent = imageParts.length > 0
      ? [...imageParts, { text: prompt }]
      : prompt;

    const geminiResult = await Promise.race([
      model.generateContent(geminiContent),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("GEMINI_TIMEOUT")), GEMINI_TIMEOUT_MS)
      ),
    ]);

    const responseText = (geminiResult as Awaited<ReturnType<typeof model.generateContent>>).response.text();
    analysis = parseGeminiResponse(responseText);
    baseSource = "clyon_pricing";

    // Registar na análise se foram usadas fotos (para rastreabilidade interna)
    if (imageParts.length > 0) {
      analysis = {
        ...analysis,
        internalNotes: [
          ...(analysis.internalNotes ?? []),
          `Análise multimodal: ${imageParts.length} foto(s) enviadas ao Gemini para ajuste visual de volume/itens.`,
        ],
      };
    }

    // Zero-price guard: se o Gemini devolveu preço 0 ou null, aplicar fallback de referência
    const geminiPrice = analysis.estimatedPriceWithoutVat;
    if (!geminiPrice || geminiPrice <= 0) {
      const ref = buildReferenceEstimate(order as never);
      analysis = {
        ...ref,
        // Manter campos qualitativos do Gemini (summary, missingFields, assumptions)
        status: analysis.status === "needs_more_info" ? "needs_more_info" : ref.status,
        summary: analysis.summary || ref.summary,
        missingFields: [...(analysis.missingFields ?? []), ...(ref.missingFields ?? [])],
        assumptions: [...(analysis.assumptions ?? []), ...ref.assumptions],
        internalNotes: [
          ...(analysis.internalNotes ?? []),
          "Gemini devolveu preço 0 ou null — aplicada estimativa de referência.",
          ...ref.internalNotes,
        ],
      } as EstimateResult;
      baseSource = "gemini_reference";
    }

    // Guarda de mínimo (anti-prejuízo): o motor local já sabe o mínimo comercial
    // real (por item, de zona, de entulho ou de mudança) para este pedido —
    // se o Gemini devolver um preço abaixo desse mínimo (ex: por ter avaliado
    // a descrição como tendo menos itens do que realmente tem), o preço é
    // ajustado para o mínimo local, preservando os campos qualitativos do Gemini.
    const localFloor = fastEstimate.estimateMinWithoutVat ?? fastEstimate.estimatedPriceWithoutVat ?? 0;
    if (
      localFloor > 0 &&
      analysis.estimatedPriceWithoutVat !== null &&
      analysis.estimatedPriceWithoutVat < localFloor
    ) {
      const geminiPriceBeforeClamp = analysis.estimatedPriceWithoutVat;
      const vatRate = 0.23;
      const clampedWithVat = Math.round(localFloor * (1 + vatRate) * 100) / 100;
      analysis = {
        ...analysis,
        estimatedPriceWithoutVat: localFloor,
        vatAmount: Math.round(localFloor * vatRate * 100) / 100,
        estimatedPriceWithVat: clampedWithVat,
        estimateMinWithoutVat: localFloor,
        estimateMaxWithoutVat: Math.max(analysis.estimateMaxWithoutVat ?? localFloor, fastEstimate.estimateMaxWithoutVat ?? localFloor),
        internalNotes: [
          ...(analysis.internalNotes ?? []),
          `Preço do Gemini (${geminiPriceBeforeClamp}€ s/IVA) estava abaixo do mínimo comercial calculado (${localFloor}€ s/IVA, ${resolvedItemCount} item(ns)) — ajustado para evitar prejuízo.`,
        ],
      } as EstimateResult;
    }

    analysis = {
      ...analysis,
      itemCount: resolvedItemCount,
      isFullLoad: resolvedIsFullLoad,
      estimateMinWithVat: analysis.estimateMinWithoutVat != null ? Math.round(analysis.estimateMinWithoutVat * 1.23 * 100) / 100 : fastEstimate.estimateMinWithVat,
      estimateMaxWithVat: analysis.estimateMaxWithoutVat != null ? Math.round(analysis.estimateMaxWithoutVat * 1.23 * 100) / 100 : fastEstimate.estimateMaxWithVat,
      internalNotes: [
        ...(analysis.internalNotes || []),
        `Preçário usado: ${pricingSnapshot?.timestamp || "default"}`,
      ],
      _pricingSnapshot: pricingSnapshot ?? undefined,
    };
  } catch (error) {
    const isTimeout = error instanceof Error && error.message === "GEMINI_TIMEOUT";
    console.error(
      "[v0] /api/simulator/analyze:",
      isTimeout ? "Gemini timeout — usando estimativa local" : "Erro Gemini",
      isTimeout ? "" : error
    );
    analysis = {
      ...fastEstimate,
      internalNotes: [
        ...fastEstimate.internalNotes,
        isTimeout
          ? `Gemini não respondeu em ${GEMINI_TIMEOUT_MS}ms. Estimativa rápida local usada.`
          : `Erro Gemini: ${error instanceof Error ? error.message : String(error)}. Estimativa rápida local usada.`,
      ],
    };
    baseSource = isTimeout ? "timeout_fallback" : "local_fast_estimate";
  }

  /*
   * NA MUDANÇA, O PREÇO É O DA TABELA — 25-10-2026.
   *
   * O motor local conta a mudança com `orcamentoDaMudanca` (a tabela à hora de
   * `tabela-das-mudancas.ts`); o Gemini contava com os 70 €/h e as 7 horas de
   * base do aviso antigo, e o número dele ficava por cima do da tabela. A
   * mudança contrata-se à hora: o valor de partida é o da tabela, e o modelo
   * fica com o resto (o resumo, os pressupostos, o que falta saber).
   */
  if (order.serviceType === "mudanca" && fastEstimate.estimatedPriceWithoutVat) {
    analysis = {
      ...analysis,
      estimatedPriceWithoutVat: fastEstimate.estimatedPriceWithoutVat,
      vatAmount: fastEstimate.vatAmount,
      estimatedPriceWithVat: fastEstimate.estimatedPriceWithVat,
      estimateMinWithoutVat: fastEstimate.estimateMinWithoutVat,
      estimateMaxWithoutVat: fastEstimate.estimateMaxWithoutVat,
      estimateMinWithVat: fastEstimate.estimateMinWithVat,
      estimateMaxWithVat: fastEstimate.estimateMaxWithVat,
      labor: fastEstimate.labor ?? analysis.labor,
      customerMessage: fastEstimate.customerMessage,
      internalNotes: [
        ...(analysis.internalNotes ?? []),
        `Mudança: preço da tabela à hora (${fastEstimate.estimatedPriceWithoutVat}€ s/IVA), e não o do modelo.`,
      ],
    };
  }

  // ── 4. Pesquisa externa se necessário ────────────────────────────────────
  let externalMarketEstimate: ExternalMarketEstimate | null = null;

  if (needsExternalSearch(analysis)) {
    externalMarketEstimate = await getExternalMarketEstimate(order, apiKey, modelName);
    if (externalMarketEstimate) {
      analysis = {
        ...analysis,
        internalNotes: [
          ...(analysis.internalNotes ?? []),
          `Pesquisa de mercado externa realizada (${externalMarketEstimate.sources.length} fonte(s)). Confiança: ${externalMarketEstimate.confidence}.`,
        ],
      };
    }
  }

  // ── 5. Determinar fonte e confiança finais ───────────────���────────────────
  const analysisSource = resolveAnalysisSource(baseSource, externalMarketEstimate, analysis);

  // Confiança: propagar o que o Gemini definiu, ou inferir
  let confidence: "high" | "medium" | "low" = analysis.confidence ?? "medium";
  if (analysis.status === "onsite_required" || analysis.status === "needs_more_info") {
    confidence = "low";
  } else if (analysis.estimatedPriceWithoutVat && analysis.missingFields?.length === 0) {
    confidence = "high";
  }

  // ── 6. Mensagem ao cliente — nunca expor referência externa ──────────────
  let customerMessage = analysis.customerMessage;
  if (
    analysisSource === "web_reference_only" ||
    analysisSource === "needs_human_review" ||
    analysisSource === "gemini_reference" ||
    analysisSource === "fallback_reference" ||
    confidence === "low"
  ) {
    customerMessage =
      "Pedido recebido. A CLYON confere o pedido e envia-o aos profissionais da sua zona.";
  }

  // ── Deslocação — garantir que o resultado leva sempre a distância do pedido ──
  // Se o Gemini não devolveu "travel" (ex: timeout/fallback local), derivamos a
  // partir da distância enviada no pedido para que o admin veja sempre os km.
  let travel = analysis.travel;
  const orderKm = order.distanceFromBase?.distanceKm ?? null;
  if ((!travel || travel.distanceKm == null) && orderKm != null) {
    travel = {
      distanceKm: orderKm,
      durationText: order.distanceFromBase?.durationText ?? null,
      distanceCost: Math.round(orderKm * 2 * 100) / 100,
      source: order.distanceFromBase?.isEstimate ? "estimate" : "google",
    };
  }

  // ── 7. Compor resposta final ──────────────────────────────────────────────
  const result: EstimateResult = {
    ...analysis,
    ...(travel ? { travel } : {}),
    analysisSource,
    confidence,
    customerMessage,
    // Preservar valor recomendado calculado localmente como metadado interno.
    // O Gemini não calcula este campo — vem sempre do motor local (calculateFastEstimate).
    recommendedPriceWithoutVat: fastEstimate.recommendedPriceWithoutVat,
    recommendedPriceWithVat: fastEstimate.recommendedPriceWithVat,
    // A taxa de agendamento é uma tabela, não uma estimativa: 29,99 hoje,
    // 14,99 amanhã, 0 até aos 7 dias, 9,99 dos 8 aos 30. Vem sempre do motor
    // local. Se viesse do Gemini, um dia ele inventava um valor e passávamos
    // a cobrar o que um modelo achou — e nem um teste apanharia isso.
    schedulingFee: fastEstimate.schedulingFee,
    schedulingFeeLabel: fastEstimate.schedulingFeeLabel,
    // Incluir referência externa APENAS quando existir — backoffice lê este campo
    ...(externalMarketEstimate ? { externalMarketEstimate } : {}),
  };

  return Response.json(result);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatOrderDataForPrompt(order: OrderData, resolvedItemCount: number, isFullLoad: boolean): string {
  const lines = [
    "=== DADOS DO PEDIDO ===",
    "",
    `Tipo de Serviço: ${getServiceName(order.serviceType)}`,
    `Descrição: ${order.description || "(não fornecida)"}`,
    "",
    "=== CONTAGEM DE ITENS (PRÉ-CALCULADA — NÃO RECALCULAR) ===",
    `Número de Itens: ${resolvedItemCount}`,
    `Classificação: ${isFullLoad ? `Carga completa (≥ ${FULL_LOAD_ITEM_THRESHOLD} itens ou esvaziamento)` : "Itens soltos (cobrança por item)"}`,
    `Volume Estimado: ${order.volumeTier === "carrinha" ? "Enche uma carrinha (poucos itens)" : order.volumeTier === "camiao_caixa" ? "Enche a caixa de um camião (volume médio)" : order.volumeTier === "camiao_lixo" ? "Enche um camião (grande volume)" : order.volumeTier === "incerto" ? "Cliente não tem certeza do volume" : "(não especificado)"}`,
    "Este valor já foi determinado pelo motor de preços CLYON a partir da lista de itens, descrição e/ou selecção de volume. USA EXATAMENTE este número de itens nos teus cálculos — não tentes recontar a partir da descrição em texto livre.",
  ];

  if (order.serviceType === "recolha_entulho") {
    lines.push(
      "",
      "=== DETALHES DO ENTULHO ===",
      `Estado do Entulho: ${
        order.entulhoState === "ensacado"
          ? "Já ensacado"
          : order.entulhoState === "chao"
          ? "No chão/Por ensacar — usar fórmula de tempo × 1.3"
          : order.entulhoState === "misto"
          ? "Misto (alguns ensacados, alguns não)"
          : "(não especificado)"
      }`,
      `Quantidade de Sacos: ${order.entulhoQuantidade || "(não fornecida)"}`,
    );
  }

  if (order.serviceType === "recolha_moveis" && order.movelMode === "item") {
    const p = order.movelItemsPequeno ?? 0;
    const m = order.movelItemsMedio ?? 0;
    const g = order.movelItemsGrande ?? 0;
    lines.push(
      "",
      "=== MODO ITEM (PREÇO FIXO POR TAMANHO) ===",
      `ATENÇÃO: Este pedido usa preço fixo por tamanho — custo laboral ANULADO.`,
      `Itens Pequenos (mesinha, micro-ondas…): ${p} × 25 € = ${p * 25} €`,
      `Itens Médios (fogão, frigorífico bar…): ${m} × 50 € = ${m * 50} €`,
      `Itens Grandes (sofá, armário, frigorífico…): ${g} × 60 € = ${g * 60} €`,
      `Subtotal Itens: ${p * 25 + m * 50 + g * 60} € (mínimo 80 €)`,
      `Acrescentar apenas: taxa de acesso (sem elevador, acesso difícil) + deslocação.`,
    );
  }

  if (order.serviceType === "mudanca") {
    const elevLabel = (v?: string) =>
      v === "yes" ? "Sim, funciona" : v === "small" ? "Sim, pequeno" : v === "no" ? "Não tem" : "(não especificado)";
    const parkLabel = (v?: string) =>
      v === "door" ? "À porta" : v === "under_20m" ? "Até 20m" : v === "over_30m" ? "Mais de 30m" : v === "difficult" ? "Difícil" : "(não especificado)";

    lines.push(
      "",
      "=== MUDANÇA: MORADA DE ORIGEM ===",
      `Morada: ${order.originAddress?.formattedAddress || "(não fornecida)"}`,
      `Localidade: ${order.originAddress?.city || "(não fornecida)"}`,
      `Código Postal: ${order.originAddress?.postalCode || "(não fornecido)"}`,
      "",
      "=== MUDANÇA: ACESSO NA ORIGEM ===",
      `Andar: ${order.originAccess?.floor || "(não fornecido)"}`,
      `Elevador: ${elevLabel(order.originAccess?.hasElevator)}`,
      `Estacionamento: ${parkLabel(order.originAccess?.parkingDistance)}`,
      `Acesso Difícil: ${order.originAccess?.difficultAccess ? "Sim" : "Não"}`,
      "",
      "=== MUDANÇA: MORADA DE DESTINO ===",
      `Morada: ${order.destinationAddress?.formattedAddress || "(não fornecida)"}`,
      `Localidade: ${order.destinationAddress?.city || "(não fornecida)"}`,
      `Código Postal: ${order.destinationAddress?.postalCode || "(não fornecido)"}`,
      "",
      "=== MUDANÇA: ACESSO NO DESTINO ===",
      `Andar: ${order.destinationAccess?.floor || "(não fornecido)"}`,
      `Elevador: ${elevLabel(order.destinationAccess?.hasElevator)}`,
      `Estacionamento: ${parkLabel(order.destinationAccess?.parkingDistance)}`,
      `Acesso Difícil: ${order.destinationAccess?.difficultAccess ? "Sim" : "Não"}`,
      "",
      "=== MUDANÇA: PERCURSO (OBRIGATÓRIO CONSIDERAR NO PREÇO) ===",
      `Base CLYON: Av. Q.ta das Laranjeiras, 2865-688 Fernão Ferro, Portugal`,
      `Distância Base→Origem: ${order.distanceFromBase?.distanceKm ? `${order.distanceFromBase.distanceKm} km${order.distanceFromBase.durationText ? ` · ${order.distanceFromBase.durationText}` : ""}` : "(não calculada)"}`,
      `Distância Origem→Destino: ${order.movingDistance?.distanceKm ? `${order.movingDistance.distanceKm} km` : "(não calculada)"}`,
      `Duração Estimada Origem→Destino: ${order.movingDistance?.durationText || "(não calculada)"}`,
    );
  } else {
    const dKm = order.distanceFromBase?.distanceKm;
    lines.push(
      "",
      "=== LOCALIZAÇÃO ===",
      `Morada: ${order.address?.formattedAddress || "(não fornecida)"}`,
      `Localidade: ${order.address?.city || "(não fornecida)"}`,
      `Código Postal: ${order.address?.postalCode || "(não fornecido)"}`,
      "",
      "=== DADOS DE DESLOCAÇÃO (OBRIGATÓRIO CONSIDERAR NO PREÇO) ===",
      `Base CLYON: Av. Q.ta das Laranjeiras, 2865-688 Fernão Ferro, Portugal`,
      `Morada do cliente: ${order.address?.formattedAddress || order.address?.city || "(não fornecida)"}`,
      `Distância da base: ${dKm ? `${dKm} km` : "(NÃO CALCULADA — assume acesso local e assinala em missingFields)"}`,
      `Tempo estimado de deslocação: ${order.distanceFromBase?.durationText || "(não calculado)"}`,
      `Custo de deslocação interno (km × 2 €, ida+volta; nas cargas completas e nos esvaziamentos já está dentro da faixa): ${dKm ? `${(Math.round(dKm * 2 * 100) / 100)} €` : "(a confirmar)"}`,
      "",
      "=== CONDIÇÕES DE ACESSO ===",
      `Andar: ${order.floor || "(não fornecido)"}`,
      `Elevador: ${order.hasElevator ? "Sim" : "Não / Não especificado"}`,
      `Estacionamento: ${order.parkingDistance || "(não especificado)"}`,
      `Acesso Difícil: ${order.needsDismantling ? "Sim" : "Não"}`,
    );
  }

  lines.push(
    "",
    "=== URGÊNCIA ===",
    `Urgência: ${order.urgency || "(não especificada)"}`,
    "",
    "=== ITENS ===",
    `Objetos Pesados: ${order.heavyItems?.length ? order.heavyItems.join(", ") : "Nenhum especificado"}`,
    `Fotos/Vídeos Enviados: ${order.files?.length || 0}`,
  );

  return lines.join("\n");
}

function parseGeminiResponse(response: string): EstimateResult {
  try {
    let jsonStr = response.trim();
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);

    const parsed = JSON.parse(jsonStr.trim());

    const diffLevel = Math.max(1, Math.min(5, parsed.difficultyLevel || 2)) as 1 | 2 | 3 | 4 | 5;

    let labor = undefined;
    if (parsed.labor && typeof parsed.labor.estimatedHours === "number") {
      const hrs = Math.max(1, parsed.labor.estimatedHours);
      labor = {
        estimatedHours: hrs,
        peopleCount: 3 as const,
        hourlyRatePerPerson: 9 as const,
        laborCost: Math.round(hrs * 3 * 9 * 100) / 100,
      };
    }

    // Deslocação — km deve ter sido considerado no preço. distanceCost = km × 2 (regra CLYON).
    let travel: EstimateResult["travel"] = undefined;
    const tk = parsed.travel?.distanceKm;
    if (parsed.travel && (typeof tk === "number" || tk === null)) {
      const km = typeof tk === "number" ? tk : null;
      const cost =
        typeof parsed.travel.distanceCost === "number"
          ? parsed.travel.distanceCost
          : km !== null
            ? Math.round(km * 2 * 100) / 100
            : null;
      travel = {
        distanceKm: km,
        durationText: typeof parsed.travel.durationText === "string" ? parsed.travel.durationText : null,
        distanceCost: cost,
        source: "google",
      };
    }

    const confidence = (["high", "medium", "low"].includes(parsed.confidence)
      ? parsed.confidence
      : "medium") as "high" | "medium" | "low";

    const validRecommendations = ["pode_aprovar", "pedir_fotos", "pedir_info", "visita_presencial"] as const;
    const recommendation = validRecommendations.includes(parsed.recommendation)
      ? (parsed.recommendation as "pode_aprovar" | "pedir_fotos" | "pedir_info" | "visita_presencial")
      : null;

    return {
      status: parsed.status || "estimated",
      estimatedPriceWithoutVat: parsed.estimatedPriceWithoutVat ?? null,
      vatAmount: parsed.vatAmount ?? null,
      estimatedPriceWithVat: parsed.estimatedPriceWithVat ?? null,
      estimateMinWithoutVat: typeof parsed.estimateMinWithoutVat === "number" ? parsed.estimateMinWithoutVat : null,
      estimateMaxWithoutVat: typeof parsed.estimateMaxWithoutVat === "number" ? parsed.estimateMaxWithoutVat : null,
      estimateMinWithVat: typeof parsed.estimateMinWithVat === "number" ? parsed.estimateMinWithVat : null,
      estimateMaxWithVat: typeof parsed.estimateMaxWithVat === "number" ? parsed.estimateMaxWithVat : null,
      difficultyLevel: diffLevel,
      confidence,
      teamSize: typeof parsed.teamSize === "string" ? parsed.teamSize : null,
      estimatedHoursText: typeof parsed.estimatedHoursText === "string" ? parsed.estimatedHoursText : null,
      recommendation,
      summary: parsed.summary || "Análise com base nos dados fornecidos",
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
      missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields : [],
      customerMessage: parsed.customerMessage || "Análise completada",
      internalNotes: Array.isArray(parsed.internalNotes) ? parsed.internalNotes : [],
      labor,
      travel,
      assistantBriefing: parsed.assistantBriefing && typeof parsed.assistantBriefing === "object"
        ? {
            itemSummary: parsed.assistantBriefing.itemSummary && typeof parsed.assistantBriefing.itemSummary === "object"
              ? parsed.assistantBriefing.itemSummary
              : {},
            accessConditions: Array.isArray(parsed.assistantBriefing.accessConditions)
              ? parsed.assistantBriefing.accessConditions
              : [],
            risks: Array.isArray(parsed.assistantBriefing.risks) ? parsed.assistantBriefing.risks : [],
            estimatedHoursMin: typeof parsed.assistantBriefing.estimatedHoursMin === "number"
              ? parsed.assistantBriefing.estimatedHoursMin
              : 1,
            estimatedHoursMax: typeof parsed.assistantBriefing.estimatedHoursMax === "number"
              ? parsed.assistantBriefing.estimatedHoursMax
              : 3,
            confidenceLevel: (["high", "medium", "low"].includes(parsed.assistantBriefing.confidenceLevel)
              ? parsed.assistantBriefing.confidenceLevel
              : "medium") as "high" | "medium" | "low",
            pricingNotes: Array.isArray(parsed.assistantBriefing.pricingNotes)
              ? parsed.assistantBriefing.pricingNotes
              : [],
          }
        : null,
    };
  } catch (error) {
    console.error("[v0] parseGeminiResponse: Erro ao parse JSON", error);
    const diffLevel: 1 | 2 | 3 | 4 | 5 = 2;
    return {
      status: "needs_more_info",
      estimatedPriceWithoutVat: null,
      vatAmount: null,
      estimatedPriceWithVat: null,
      difficultyLevel: diffLevel,
      confidence: "low",
      summary: "Análise incompleta. Por favor, forneça mais informações.",
      assumptions: [],
      missingFields: ["Dados incompletos para análise precisa"],
      customerMessage: "Erro ao analisar",
      internalNotes: [],
    };
  }
}

function getServiceName(serviceType?: string): string {
  return servicoParaOModelo(serviceType);
}
