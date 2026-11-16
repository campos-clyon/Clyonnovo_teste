import { inicioDoDiaEmLisboa, segundaDaSemanaEmLisboa, somarDiasAoDia } from "@/lib/hora-de-lisboa";

/*
 * O SIMULADOR PASSO A PASSO — d56, 16-11-2026.
 *
 * Quantos abrem o simulador, quantos passam do passo 1 ao 2, do 2 ao 3, e
 * quantos carregam em Enviar — por semana (de segunda a domingo, em hora de
 * Lisboa), e se vieram de um anúncio ou não.
 *
 * Grava-se o mínimo: na tabela dos eventos que o site já tinha (leadEvents),
 * um evento `funil_simulador` com o passo na etiqueta, o serviço e a origem
 * da visita (as UTM, que dizem o nome de uma campanha, não de uma pessoa).
 * Sem nome, telefone, email nem morada. As entradas são o `simulator_start`
 * que já se gravava ao abrir o simulador.
 *
 * O nome não começa por `simulator_` de propósito: o cartão «Simulador» dos
 * Leads conta `simulator_%`, e três eventos a mais por visita enchiam-no.
 */

export const EVENTO_DO_FUNIL = "funil_simulador";

export const PASSOS_DO_FUNIL = ["passo_2", "passo_3", "enviar"] as const;
export type PassoDoFunil = (typeof PASSOS_DO_FUNIL)[number];

/** O número do passo que se acabou (o mesmo que vai para o GA4). */
export const NUMERO_DO_PASSO: Record<PassoDoFunil, number> = { passo_2: 1, passo_3: 2, enviar: 3 };

/** Os meios das UTM que querem dizer «anúncio pago» — os mesmos de canal-do-pedido.ts. */
export const MEIOS_PAGOS = ["cpc", "ppc", "paid", "paidsearch", "paid_search", "ads", "display"] as const;

type OrigemCurta = { utm_medium?: string | null; gclid?: string | null } | null | undefined;

/** «pago» quando a visita veio de um anúncio (gclid ou meio pago); o resto é «orgânico». */
export function tipoDaOrigem(o: OrigemCurta): "pago" | "orgânico" {
  if (!o) return "orgânico";
  if (o.gclid) return "pago";
  const meio = (o.utm_medium ?? "").trim().toLowerCase();
  return (MEIOS_PAGOS as readonly string[]).includes(meio) ? "pago" : "orgânico";
}

/** A mesma conta, em SQL, sobre as colunas de leadEvents. */
export const E_PAGO_SQL = `((gclid IS NOT NULL AND gclid <> '') OR LOWER(TRIM(utmMedium)) IN (${MEIOS_PAGOS.map((m) => `'${m}'`).join(", ")}))`;

export type EtapaDoFunil = "entradas" | PassoDoFunil;

/** Uma linha da base, já agrupada: a semana (0 = esta), a etapa, se é pago, e quantas. */
export type LinhaDoFunil = { semana: number; etapa: string; pago: number | boolean; n: number | string };

export type ContagemDoFunil = { entradas: number; passo_2: number; passo_3: number; enviar: number };

export type SemanaDoFunil = {
  /** Segunda-feira da semana, AAAA-MM-DD em Lisboa. */
  inicio: string;
  todos: ContagemDoFunil;
  pago: ContagemDoFunil;
  organico: ContagemDoFunil;
};

const zero = (): ContagemDoFunil => ({ entradas: 0, passo_2: 0, passo_3: 0, enviar: 0 });

/**
 * As segundas-feiras das últimas `n` semanas (a primeira é a desta), e o
 * instante em que cada uma começa em Lisboa — para a base, que está em UTC.
 */
export function semanasDoFunil(n: number, agora: Date = new Date()): Array<{ inicio: string; desde: Date }> {
  const esta = segundaDaSemanaEmLisboa(agora);
  return Array.from({ length: n }, (_, i) => {
    const inicio = somarDiasAoDia(esta, -7 * i);
    return { inicio, desde: inicioDoDiaEmLisboa(inicio) };
  });
}

/** Junta as linhas da base em semanas, com o total e a divisão pago / orgânico. */
export function funilPorSemana(linhas: LinhaDoFunil[], semanas: Array<{ inicio: string }>): SemanaDoFunil[] {
  const out: SemanaDoFunil[] = semanas.map((s) => ({ inicio: s.inicio, todos: zero(), pago: zero(), organico: zero() }));
  for (const l of linhas) {
    const s = out[Number(l.semana)];
    if (!s) continue;
    const etapa = l.etapa as EtapaDoFunil;
    if (!(etapa in s.todos)) continue;
    const n = Number(l.n) || 0;
    s.todos[etapa] += n;
    (Number(l.pago) ? s.pago : s.organico)[etapa] += n;
  }
  return out;
}

/** «38 %» de quantos chegaram à etapa anterior; «—» sem ninguém lá. */
export function percentagemDoPasso(chegaram: number, antes: number): string {
  if (!antes) return "—";
  return `${Math.round((chegaram / antes) * 100)} %`;
}
