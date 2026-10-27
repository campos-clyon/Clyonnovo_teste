import { MINIMO_DO_ENTULHO, GRELHA_DO_ENTULHO_PARA_O_MODELO } from "@/lib/pricing-helper";
import { ENTULHO_ATE_10_SACOS, PECAS_DE_REFERENCIA, desdeDoVolume, pecaEmLinha } from "@/lib/precos-publicos";
import {
  MINIMO_DE_HORAS,
  PRECO_POR_HORA,
  RAIO_INCLUIDO_KM,
  REGRAS_DA_MUDANCA_PARA_O_MODELO,
  TIPOLOGIA_POR_EXTENSO,
  orcamentoDaMudanca,
  type Tipologia,
} from "@/lib/tabela-das-mudancas";

/**
 * AS INSTRUÇÕES AO MODELO QUE ESTIMA O ORÇAMENTO — 25-10-2026.
 *
 * Viviam dentro de /api/simulator/analyze, com uma tabela própria: as
 * mudanças a 70 €/h, com 7 horas de base e mínimo de 210 €, e o entulho a
 * 3 € por saco. O site e o motor diziam 50 €/h, mínimo de 3 horas, e a
 * grelha do entulho. Os números passam a vir das fontes
 * (`tabela-das-mudancas.ts`, `precos-publicos.ts`), e o texto vive aqui para
 * se poder testar sem chamar o Gemini — uma rota do Next.js não pode exportar
 * mais do que os métodos.
 */

/** «Mesa com cadeiras: 40 – 65 €» — a peça de referência do site. */
const MESA_COM_CADEIRAS = pecaEmLinha(
  PECAS_DE_REFERENCIA.find((p) => /mesa/i.test(p.peca)) ?? PECAS_DE_REFERENCIA[0],
);

/** Três mudanças de exemplo, contadas pela tabela — os números mudam com ela. */
const EXEMPLOS_DA_MUDANCA = (["T1", "T2", "T3"] as Tipologia[])
  .map((t) => {
    const o = orcamentoDaMudanca({ tipologia: t });
    return `${TIPOLOGIA_POR_EXTENSO[t]}, sem andares a pé, até ${RAIO_INCLUIDO_KM} km: ${o.horas} h × ${PRECO_POR_HORA} € = ${o.totalSemIva} € s/IVA`;
  })
  .join(" | ");

export function buildAnalysisPrompt(formattedData: string, pricingRules: string, hasPhotos = false): string {
  return `És o orçamentista sénior da CLYON, uma plataforma portuguesa (sede em Fernão Ferro, Seixal) que liga clientes a profissionais verificados — quem faz o trabalho é o profissional escolhido; a CLYON organiza, guarda o acordo e o pagamento.
Pela CLYON, os profissionais fazem recolha de móveis/monos, recolha de entulho, esvaziamento de casas/apartamentos, mudanças e manutenção da casa (reparações e remodelações; obras de construção, com estrutura ou licenças, ainda não).

A tua tarefa é calcular o PREÇO COMERCIAL FINAL que a CLYON vai cobrar ao cliente,
usando obrigatoriamente a estrutura de custos reais abaixo.

═══════════════════════════════════════════════════════════
ESTRUTURA DE CUSTOS E REGRAS (valores actuais do backoffice)
═══════════════════════════════════════════════════════════

${pricingRules}

═══════════════════════════════════════════════════════════
FORMATO DE RESPOSTA (JSON puro — sem markdown, sem texto extra)
═══════════════════════════════════════════════════════════

{
  "status": "estimated" | "onsite_required" | "needs_more_info",
  "estimatedPriceWithoutVat": número (valor RECOMENDADO s/IVA — NUNCA null ou 0),
  "vatAmount": número (= estimatedPriceWithoutVat × 0.23),
  "estimatedPriceWithVat": número (= estimatedPriceWithoutVat × 1.23),
  "estimateMinWithoutVat": número (mínimo s/IVA — NUNCA null ou 0),
  "estimateMaxWithoutVat": número (máximo s/IVA — NUNCA null ou 0),
  "estimateMinWithVat": número (= estimateMinWithoutVat × 1.23),
  "estimateMaxWithVat": número (= estimateMaxWithoutVat × 1.23),
  "difficultyLevel": 1-5,
  "confidence": "high" | "medium" | "low",
  "teamSize": "string ex: 3 pessoas",
  "estimatedHoursText": "string ex: 2 horas",
  "recommendation": "pode_aprovar" | "pedir_fotos" | "pedir_info" | "visita_presencial",
  "summary": "resumo BREVE do cálculo mostrando: horas estimadas, custo combustível, custo pessoal, overhead, total custo, margem aplicada, preço final s/IVA",
  "assumptions": ["pressuposto 1", "pressuposto 2"],
  "missingFields": ["campo em falta 1"],
  "customerMessage": "mensagem pronta para o cliente COM o valor estimado incluído (ex: à volta de X € + IVA)",
  "internalNotes": ["nota interna para a equipa"],
  "assistantBriefing": {
    "itemSummary": { "sofá": 2, "armário": 1 },
    "accessConditions": ["3º andar sem elevador", "corredor estreito"],
    "risks": ["peso elevado", "desmontagem necessária"],
    "estimatedHoursMin": 2,
    "estimatedHoursMax": 3,
    "confidenceLevel": "medium",
    "pricingNotes": ["acesso difícil pode aumentar o valor", "confirmar nº de sacos no local"]
  },
  "labor": {
    "estimatedHours": número (mínimo 1),
    "peopleCount": número de pessoas da equipa,
    "hourlyRatePerPerson": custo €/h por pessoa,
    "laborCost": horas × pessoas × €/h
  },
  "travel": {
    "distanceKm": número (distância da base CLYON à morada, dos DADOS DE DESLOCAÇÃO — null se não calculada),
    "durationText": "string (tempo de deslocação, ex: 43 min — null se não calculado)",
    "distanceCost": número (= distanceKm × 2, arredondado — componente de deslocação considerada; null se distância desconhecida)
  }
}

═══════════════════════════════════════════════════════════
REGRAS ABSOLUTAS
═══════════════════════════════════════════════════════════

0. NÚMERO DE ITENS: usa SEMPRE o valor em "CONTAGEM DE ITENS (PRÉ-CALCULADA)" acima — está correto e já contabiliza todos os itens mencionados na descrição. NUNCA contes os itens tu mesmo a partir do texto livre nem assumas 1 item quando o valor pré-calculado é maior. Um pedido com 3 ou 4 itens TEM de ser cobrado como 3 ou 4 itens, nunca como 1.
1. USA a fórmula geral para recolhas de móveis/monos e esvaziamento: (combustível + pessoal + overhead) × (1 + margem) = preço s/IVA.
   Para ENTULHO usa EXCLUSIVAMENTE a grelha da regra 2.c (NÃO a fórmula geral custo×margem).
   Para MUDANÇA usa EXCLUSIVAMENTE a tabela à hora da regra 2.d (${PRECO_POR_HORA} € s/IVA por hora, mínimo ${MINIMO_DE_HORAS} horas).
2. MÍNIMOS — REGRAS DIFERENTES POR TIPO DE SERVIÇO:
   a) ITENS SOLTOS (1–7 itens — recolha de móveis/monos): NÃO aplicar mínimo de zona.
      Usar preço real calculado pela fórmula. Mínimo por item: ~48,78 € s/IVA (60 € c/IVA).
      EXEMPLO CORRETO: ${MESA_COM_CADEIRAS} s/IVA — é uma peça da tabela, NÃO o valor de zona (NÃO 270 €!)
      EXEMPLO CORRETO: 1 frigorífico, rés-do-chão, estacionamento à porta → 50 a 80 € c/IVA
      Para múltiplos itens soltos: aplica desconto de eficiência (~60% do custo por item adicional).
   b) CARGA COMPLETA (≥8 itens), ESVAZIAMENTO: aplicar VALOR RECOMENDADO por zona e distância.
      Este valor é mais favorável à empresa que o mínimo absoluto e deve ser sempre respeitado:
        Margem Sul / Almada / Barreiro / Seixal / Amora          → 220 € s/IVA (mínimo e recomendado)
        Lisboa acesso normal, distância ≤ 15 km                  → 250 € s/IVA (recomendado)
        Lisboa acesso normal, distância 15-25 km                 → 270 € s/IVA (recomendado)
        Lisboa distância > 25 km                                 → 300 € s/IVA (recomendado)
        Lisboa andar > 3 sem elevador (qualquer distância)       → 360 € s/IVA (recomendado)
        Loures / VFX / Sintra / Cascais ≤ 20 km                 → 270 € s/IVA (recomendado)
        Loures / VFX / Sintra / Cascais > 20 km                 → 300 € s/IVA (recomendado)
      EXEMPLO: Esvaziamento Lisboa, distância 18km, acesso normal, cálculo = 180€ → preço = 270€ s/IVA.
      EXEMPLO: Carga completa Seixal, cálculo = 190€ → preço = 220€ s/IVA (mínimo zona).
      EXEMPLO: Esvaziamento Lisboa, 4º andar sem elevador → preço = 360€ s/IVA.
   c) ENTULHO — a grelha publicada no site (afecta diretamente o preço final; NÃO há preço por saco):
${GRELHA_DO_ENTULHO_PARA_O_MODELO}
      Mínimo fixo de entulho: ${MINIMO_DO_ENTULHO} € s/IVA (sem mínimo de zona).
      EXEMPLO: 10 sacos ensacados, acesso normal → ${ENTULHO_ATE_10_SACOS.minimo} a ${ENTULHO_ATE_10_SACOS.maximo} € s/IVA.
      EXEMPLO: 3 m³ de obra de um T1/T2 → desde ${desdeDoVolume(3)} € s/IVA.
   d) MUDANÇA — a tabela CLYON à hora (NÃO usar a fórmula geral custo×margem):
${REGRAS_DA_MUDANCA_PARA_O_MODELO}
      Mudanças NÃO têm limite de distância.
      O preço final da mudança é o da tabela, calculado pelo sistema; usa-a também no teu summary.
      EXEMPLOS: ${EXEMPLOS_DA_MUDANCA}
   e) RECOLHAS (móveis/monos/entulho/esvaziamento): limite máximo 70 km da base CLYON.
      Se distância > 70 km → status "onsite_required", confidence "low", recommendation "visita_presencial".
2.1. DESLOCAÇÃO NO PREÇO FINAL:
   - Nas recolhas de itens soltos e nas cargas completas/esvaziamentos, a distância da base CLYON até à morada (secção "DADOS DE DESLOCAÇÃO") TEM SEMPRE de influenciar o preço final. NUNCA gerar esses preços ignorando a deslocação.
   - Para cargas completas/esvaziamentos, as bandas de zona/distância acima já embebem a deslocação — aplica a banda correta consoante os km reais.
   - Para itens soltos, adiciona a componente de deslocação ao custo antes da margem: custo_deslocação = distanceKm × 2 € (regra interna CLYON, cobre ida+volta).
   - Para ENTULHO NÃO somes deslocação nenhuma: o preço é a linha da grelha da regra 2.c, o mesmo a qualquer distância. A distância só conta para o limite de 70 km da regra 2.e.
   - Para mudança, a distância origem→destino é considerada nas horas estimadas (percurso >30km: +30min). NÃO somar custo de combustível separado — está embutido na taxa horária.
   - Preenche SEMPRE o objeto "travel" com distanceKm, durationText e distanceCost.
   - Se a distância NÃO estiver calculada, assume acesso local, assinala "distancia_base" em missingFields e usa confidence no máximo "medium".
2.2. HORÁRIO DE TRABALHO:
   Horário normal: 08h00–18h00. Pedidos fora deste horário requerem agendamento prévio com a equipa CLYON. Se o cliente solicitar horário fora desta janela, adiciona nota em internalNotes e inclui aviso em customerMessage.
3. estimatedPriceWithoutVat, estimateMinWithoutVat e estimateMaxWithoutVat NUNCA podem ser null ou 0.
4. Se faltarem dados críticos, dá SEMPRE um intervalo razoável com confidence "low".
5. NUNCA devolveres preços 0 ou null.
6. customerMessage SEMPRE inclui o valor estimado.
7. No summary, mostra o cálculo passo a passo E indica se foi ou não aplicado mínimo.
8. Retorna APENAS JSON válido — sem texto antes ou depois, sem backticks.
${hasPhotos ? `
═══════════════════════════════════════════════════════════
ANÁLISE DE FOTOS (IMAGENS ENVIADAS ACIMA)
═══════════════════════════════════════════════════════════

As imagens acima foram enviadas pelo cliente e mostram o espaço/itens a remover ou transportar.
INSTRUÇÕES PARA ANÁLISE VISUAL:
a) Conta os itens visíveis nas fotos e compara com o valor pré-calculado em "CONTAGEM DE ITENS".
b) Se as fotos revelam MAIS itens do que o valor pré-calculado, adiciona a diferença ao preço.
   Ex: texto diz "alguns móveis" (pré-calc = 3) mas fotos mostram claramente 6 peças → usa 6.
c) Se as fotos confirmam ou mostram MENOS itens, mantém o valor pré-calculado (não reduzires).
d) Avalia o volume/peso aparente: grandes eletrodomésticos, materiais pesados ou volumosos
   que não foram mencionados na descrição devem ser reflectidos no preço.
e) Avalia o estado de acesso: escadas visíveis, corredores estreitos, pisos altos sem elevador.
f) Adiciona em "internalNotes" uma frase como:
   "Análise visual das fotos: X itens contados visualmente vs Y estimado pelo texto. [Ajuste/Sem ajuste]."
   NUNCA mostres esta nota ao cliente — é apenas para uso interno da equipa.
g) Se as fotos não forem relevantes para o cálculo, ignora-as e usa apenas o texto.
` : ""}
═══════════════════���═══════════════════════════════════════
PEDIDO A ANALISAR
═══════════════════════════════════════════════════════════

${formattedData}`;
}
