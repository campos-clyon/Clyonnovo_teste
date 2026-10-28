/**
 * «RESPONDE EM» — quanto tempo cada profissional leva a responder a um pedido
 * (28-10-2026, d5). Só de leitura, para a lista de Profissionais do backoffice.
 *
 * A rapidez decide quem fica com o trabalho, e não se media em lado nenhum,
 * apesar de a base ter tudo: quando a negociação nasceu (`createdAt`, o envio),
 * quando ele a abriu (`abertoProfissionalEm`) e quando propôs (as propostas,
 * cada uma com a data). Aqui faz-se a conta, pura e testável.
 *
 * A medida é a MEDIANA, dos últimos 30 dias, do envio à primeira proposta dele
 * — e não a média: um pedido que ficou uma semana esquecido não pode esconder
 * vinte respostas em dez minutos. Os Trabalhos CLYON de valor fixo ficam de
 * fora: aí ele aceita ou recusa, e o aceitar não tem data gravada.
 */

export const DIAS_DA_MEDIDA = 30;

export type NegociacaoParaMedir = {
  providerId: number | string;
  /** O envio: quando a negociação nasceu. */
  createdAt: Date | string | null;
  abertoProfissionalEm?: Date | string | null;
  propostasJson?: string | null;
  ofertaClyon?: string | null;
};

export type TempoDeResposta = {
  /** Mediana, em minutos, do envio à primeira proposta. Nula sem nenhuma. */
  minutosAtePropor: number | null;
  /** Mediana, em minutos, do envio à primeira abertura. Nula sem nenhuma. */
  minutosAteAbrir: number | null;
  /** Em quantos pedidos se mediu a proposta. */
  pedidos: number;
};

function comoData(v: Date | string | null | undefined): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A data da primeira proposta DELE nesta negociação, ou null. */
export function primeiraPropostaDoProfissional(propostasJson: string | null | undefined): Date | null {
  if (!propostasJson) return null;
  let lista: unknown;
  try {
    lista = JSON.parse(propostasJson);
  } catch {
    return null;
  }
  if (!Array.isArray(lista)) return null;
  let primeira: Date | null = null;
  for (const p of lista as Array<{ por?: unknown; criadaEm?: unknown }>) {
    if (p?.por !== "profissional") continue;
    const d = comoData(p.criadaEm as string | null);
    if (d && (!primeira || d < primeira)) primeira = d;
  }
  return primeira;
}

/** A mediana de uma lista de números, ou null sem nenhum. */
export function mediana(numeros: number[]): number | null {
  const v = numeros.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const meio = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

function minutosEntre(de: Date, ate: Date | null): number | null {
  if (!ate) return null;
  const m = (ate.getTime() - de.getTime()) / 60000;
  // Uma data anterior ao envio é uma negociação reaberta: não se mede.
  return m >= 0 ? m : null;
}

/** O tempo de resposta de cada profissional, das negociações que lhe chegam. */
export function temposDeResposta(
  negociacoes: NegociacaoParaMedir[],
  agora: Date = new Date(),
  dias: number = DIAS_DA_MEDIDA,
): Map<number, TempoDeResposta> {
  const desde = agora.getTime() - dias * 86_400_000;
  const porProfissional = new Map<number, { propor: number[]; abrir: number[] }>();
  for (const n of negociacoes) {
    if (n.ofertaClyon) continue;
    const enviado = comoData(n.createdAt);
    if (!enviado || enviado.getTime() < desde) continue;
    const id = Number(n.providerId);
    if (!Number.isInteger(id)) continue;
    const linha = porProfissional.get(id) ?? { propor: [], abrir: [] };
    const propor = minutosEntre(enviado, primeiraPropostaDoProfissional(n.propostasJson));
    if (propor != null) linha.propor.push(propor);
    const abrir = minutosEntre(enviado, comoData(n.abertoProfissionalEm ?? null));
    if (abrir != null) linha.abrir.push(abrir);
    porProfissional.set(id, linha);
  }
  const resultado = new Map<number, TempoDeResposta>();
  for (const [id, l] of porProfissional) {
    resultado.set(id, {
      minutosAtePropor: mediana(l.propor),
      minutosAteAbrir: mediana(l.abrir),
      pedidos: l.propor.length,
    });
  }
  return resultado;
}

/** «8 min», «1 h 20 min», «5 h», «2 dias» — ou «—» sem medida. */
export function tempoEmPalavras(minutos: number | null | undefined): string {
  if (minutos == null || !Number.isFinite(minutos) || minutos < 0) return "—";
  const m = Math.round(minutos);
  if (m < 60) return `${Math.max(1, m)} min`;
  const horas = Math.floor(m / 60);
  if (horas < 24) {
    const resto = m % 60;
    return horas < 3 && resto >= 5 ? `${horas} h ${resto} min` : `${horas} h`;
  }
  const dias = Math.round(horas / 24);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}
