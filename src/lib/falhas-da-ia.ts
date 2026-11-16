/*
 * AS FALHAS DA ANÁLISE COM IA, CONTADAS — d59, 16-11-2026.
 *
 * Quando o modelo não respondia a tempo, dava erro ou não havia chave, a
 * análise caía na estimativa local e só ficava uma linha no registo do
 * servidor (console.error): ninguém sabia quantas vezes acontecia. Agora cada
 * falha grava um evento na tabela dos eventos do site (leadEvents), com o
 * motivo na etiqueta e o serviço — sem nome, telefone, email nem morada — e o
 * Início do backoffice mostra quantas houve.
 *
 * O nome não começa por `simulator_` de propósito: o cartão «Simulador» dos
 * Leads conta `simulator_%`.
 */

export const EVENTO_DA_FALHA_DA_IA = "falha_da_ia";

/** Os motivos, pela ordem em que se mostram. */
export const MOTIVOS_DA_FALHA = ["timeout", "erro", "sem_chave", "resposta_invalida"] as const;
export type MotivoDaFalha = (typeof MOTIVOS_DA_FALHA)[number];

export const NOME_DO_MOTIVO: Readonly<Record<MotivoDaFalha, string>> = {
  timeout: "Sem resposta a tempo",
  erro: "Erro do modelo",
  sem_chave: "Sem chave configurada",
  resposta_invalida: "Resposta ilegível",
};

/**
 * O motivo da falha pela fonte da análise (`analysisSource`) e pelo que o
 * modelo devolveu; `null` quando não houve falha.
 *   · timeout_fallback → «timeout»;
 *   · local_fast_estimate (o modelo deu erro) → «erro»;
 *   · sem chave → «sem_chave»;
 *   · a resposta não se leu como JSON → «resposta_invalida».
 */
export function motivoDaFalha(o: { analysisSource?: string | null; semChave?: boolean; respostaInvalida?: boolean }): MotivoDaFalha | null {
  if (o.semChave) return "sem_chave";
  if (o.analysisSource === "timeout_fallback") return "timeout";
  if (o.analysisSource === "local_fast_estimate") return "erro";
  if (o.respostaInvalida) return "resposta_invalida";
  return null;
}

export type ContagemDasFalhas = Record<MotivoDaFalha, number> & { total: number };

/** As linhas da base ({ motivo, n }) numa contagem por motivo, com o total; motivos desconhecidos ficam de fora. */
export function contagemDasFalhas(linhas: ReadonlyArray<{ motivo: unknown; n: unknown }>): ContagemDasFalhas {
  const c = { timeout: 0, erro: 0, sem_chave: 0, resposta_invalida: 0, total: 0 } as ContagemDasFalhas;
  for (const l of linhas) {
    const m = l.motivo as MotivoDaFalha;
    if (!(MOTIVOS_DA_FALHA as readonly string[]).includes(m)) continue;
    const n = Number(l.n) || 0;
    c[m] += n;
    c.total += n;
  }
  return c;
}
