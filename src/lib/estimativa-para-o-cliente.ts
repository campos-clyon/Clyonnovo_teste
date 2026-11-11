import type { EstimateResult } from "@/app/simulador/types";

/**
 * O QUE A ROTA PÚBLICA DA ESTIMATIVA DEVOLVE — 11-11-2026.
 *
 * `/api/simulator/analyze` é pública (o simulador chama-a antes de gravar o
 * pedido) e devolvia a análise inteira: a mão de obra com o custo por pessoa,
 * os pressupostos e o resumo com a fórmula de custo interna, as notas
 * internas, o valor recomendado à empresa. Nada disso é para quem visita.
 *
 * Ao público vão só os números da estimativa e o que o simulador lê (o preço
 * para a medição, a dificuldade, a fonte). A fórmula fica no servidor: a rota
 * do pedido calcula a estimativa completa outra vez (d22) e é essa que a Mesa
 * vê; o backoffice, com a sessão da equipa, continua a receber tudo.
 */
export function estimativaParaOCliente(r: EstimateResult): EstimateResult {
  return {
    status: r.status,
    estimatedPriceWithoutVat: r.estimatedPriceWithoutVat,
    vatAmount: r.vatAmount,
    estimatedPriceWithVat: r.estimatedPriceWithVat,
    estimateMinWithoutVat: r.estimateMinWithoutVat ?? null,
    estimateMaxWithoutVat: r.estimateMaxWithoutVat ?? null,
    estimateMinWithVat: r.estimateMinWithVat ?? null,
    estimateMaxWithVat: r.estimateMaxWithVat ?? null,
    schedulingFee: r.schedulingFee,
    schedulingFeeLabel: r.schedulingFeeLabel,
    difficultyLevel: r.difficultyLevel,
    analysisSource: r.analysisSource,
    confidence: r.confidence,
    customerMessage: r.customerMessage,
    missingFields: r.missingFields ?? [],
    // Os campos obrigatórios do tipo, vazios: o conteúdo é interno.
    summary: "",
    assumptions: [],
    internalNotes: [],
  };
}
