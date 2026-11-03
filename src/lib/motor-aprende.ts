/**
 * O MOTOR APRENDE COM OS VALORES DA CASA — 03-11-2026.
 *
 * "Quero ele mais inteligente e que ele aprenda com nossos valores." — o dono.
 *
 * O motor calcula; os profissionais propõem; o cliente aceita. O valor
 * ACORDADO numa negociação é o preço que o mercado da CLYON deu de facto a
 * esse trabalho. Este ficheiro compara-o com o que o motor estimou para o
 * mesmo pedido e tira, por tipo de serviço, um fator de correção.
 *
 * Regras, de propósito conservadoras — um preço errado custa um cliente ou
 * custa margem, e um fator tirado de três trabalhos é ruído:
 *
 *   1. Só conta um par com estimativa e valor acordado, ambos s/IVA, e com o
 *      preço dito «total» (não por carga nem por hora: aí os números medem
 *      coisas diferentes — ver `base-do-preco.ts`).
 *   2. Pares absurdos (acordado < 30 % ou > 300 % da estimativa) são erros de
 *      escrita ou trabalhos que mudaram no local, e saem.
 *   3. Usa-se a MEDIANA do rácio, não a média: um trabalho estranho não puxa
 *      o motor todo.
 *   4. Abaixo de `AMOSTRA_MINIMA` pares, o fator é 1 (não aprende).
 *   5. O fator é «encolhido» para 1 conforme a amostra: com 5 pares mexe
 *      pouco, com 50 mexe quase o que os dados dizem.
 *   6. O fator nunca passa de `FATOR_MINIMO`–`FATOR_MAXIMO`.
 *   7. E, mais importante: o fator move o preço DENTRO da faixa que o motor
 *      já publica (mínimo–máximo). Os preços públicos são uma promessa (a
 *      grelha do entulho, o preço por item, a tabela da mudança); aprender
 *      não pode pedir mais do que a página promete nem descer abaixo do
 *      mínimo comercial. A faixa aprende-se olhando para o relatório, e
 *      muda-se à mão, com a decisão escrita.
 *
 * Sem dependências de servidor: testa-se sozinho. A leitura da base vive em
 * `motor-aprende-na-base.ts`.
 */

export type ParParaAprender = {
  servico: string;
  /** O que o motor estimou, s/IVA. */
  estimativaSemIva: number;
  /** O que ficou acordado, s/IVA. */
  acordadoSemIva: number;
};

export type CalibracaoDoServico = {
  servico: string;
  /** Pares usados (depois de tirar os absurdos). */
  amostra: number;
  /** Pares postos de lado por serem absurdos. */
  descartados: number;
  /** Mediana de acordado ÷ estimativa. 1,10 = o mercado paga 10 % acima. */
  mediana: number | null;
  /** O fator que se aplica de facto (encolhido e com limites). */
  fator: number;
  /** Diferença média, em euros, entre o acordado e o estimado. */
  diferencaMediaEuros: number | null;
};

export const AMOSTRA_MINIMA = 5;
/** Quanto pesa «não sei» — com este número de pares, o fator vai a meio caminho. */
export const PESO_DA_DUVIDA = 10;
export const FATOR_MINIMO = 0.8;
export const FATOR_MAXIMO = 1.25;
const RACIO_MINIMO_VALIDO = 0.3;
const RACIO_MAXIMO_VALIDO = 3;

function arredondar(n: number, casas = 2): number {
  const m = 10 ** casas;
  return Math.round(n * m) / m;
}

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

export function parValido(p: ParParaAprender): boolean {
  if (!Number.isFinite(p.estimativaSemIva) || !Number.isFinite(p.acordadoSemIva)) return false;
  if (p.estimativaSemIva <= 0 || p.acordadoSemIva <= 0) return false;
  const r = p.acordadoSemIva / p.estimativaSemIva;
  return r >= RACIO_MINIMO_VALIDO && r <= RACIO_MAXIMO_VALIDO;
}

/** O fator de um serviço a partir dos seus pares. */
export function calibrarServico(servico: string, pares: ParParaAprender[]): CalibracaoDoServico {
  const doServico = pares.filter((p) => p.servico === servico);
  const validos = doServico.filter(parValido);
  const racios = validos.map((p) => p.acordadoSemIva / p.estimativaSemIva);
  const med = mediana(racios);
  const n = validos.length;

  let fator = 1;
  if (med != null && n >= AMOSTRA_MINIMA) {
    const encolhido = 1 + (med - 1) * (n / (n + PESO_DA_DUVIDA));
    fator = Math.min(FATOR_MAXIMO, Math.max(FATOR_MINIMO, encolhido));
  }

  const diferencaMediaEuros =
    n > 0 ? arredondar(validos.reduce((s, p) => s + (p.acordadoSemIva - p.estimativaSemIva), 0) / n) : null;

  return {
    servico,
    amostra: n,
    descartados: doServico.length - n,
    mediana: med != null ? arredondar(med, 3) : null,
    fator: arredondar(fator, 3),
    diferencaMediaEuros,
  };
}

/** Todos os serviços que aparecem nos pares, por ordem de amostra. */
export function calibrarTudo(pares: ParParaAprender[]): CalibracaoDoServico[] {
  const servicos = [...new Set(pares.map((p) => p.servico))];
  return servicos.map((s) => calibrarServico(s, pares)).sort((a, b) => b.amostra - a.amostra);
}

export type PrecoParaAjustar = {
  estimatedPriceWithoutVat: number | null;
  estimateMinWithoutVat?: number | null;
  estimateMaxWithoutVat?: number | null;
};

export type PrecoAjustado = {
  precoSemIva: number;
  precoComIva: number;
  ajustado: boolean;
  nota: string | null;
};

const IVA = 0.23;

/**
 * Aplica o fator ao preço do motor, sem nunca sair da faixa mínimo–máximo
 * que o motor já calculou (regra 7). Sem fator útil, devolve o preço igual.
 */
export function aplicarAprendizagem(preco: PrecoParaAjustar, cal: CalibracaoDoServico | null | undefined): PrecoAjustado | null {
  const base = preco.estimatedPriceWithoutVat;
  if (!base || base <= 0) return null;
  const igual = { precoSemIva: base, precoComIva: arredondar(base * (1 + IVA)), ajustado: false, nota: null };
  if (!cal || cal.fator === 1) return igual;

  const min = preco.estimateMinWithoutVat ?? base;
  const max = preco.estimateMaxWithoutVat ?? base;
  const alvo = arredondar(Math.min(Math.max(base * cal.fator, Math.min(min, base)), Math.max(max, base)));
  if (alvo === base) return igual;

  const emPct = (r: number) => {
    const p = Math.round((r - 1) * 100);
    return `${p > 0 ? "+" : ""}${p}%`;
  };
  return {
    precoSemIva: alvo,
    precoComIva: arredondar(alvo * (1 + IVA)),
    ajustado: true,
    nota:
      `Aprendizagem: em ${cal.amostra} trabalhos acordados deste serviço o valor real ficou, a meio, ` +
      `${emPct(cal.mediana ?? cal.fator)} face ao estimado (fator aplicado ${emPct(cal.fator)}). ` +
      `Preço movido de ${base}€ para ${alvo}€ s/IVA (${arredondar(alvo * (1 + IVA))}€ c/IVA), dentro da faixa ${min}–${max}€.`,
  };
}
