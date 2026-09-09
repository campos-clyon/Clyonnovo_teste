/**
 * Os custos fixos ANUAIS do profissional, por rubrica — o que ele paga tenha
 * ou não trabalho — e a conta que os transforma num valor por trabalho.
 *
 * "Ele pode responder com os valores anuais e o site calcula para saber o
 * valor final por trabalho." As rubricas são as que o dono nomeou: Via
 * Verde, manutenção, IUC, inspecção e seguro. Cada uma é opcional; a soma
 * divide-se pelos trabalhos que faz num ano (trabalhos por mês × 12).
 *
 * Este ficheiro não toca na base nem no servidor: o ecrã do perfil (no
 * navegador) usa-o para a pré-visualização, e a conta da sugestão (no
 * servidor) usa-o para o valor a sério. A mesma aritmética nos dois lados.
 */

export type CustosFixosAnuais = {
  viaVerde?: number | null;
  manutencao?: number | null;
  iuc?: number | null;
  inspecao?: number | null;
  seguro?: number | null;
};

export const RUBRICAS_DOS_CUSTOS_FIXOS: Array<{ chave: keyof CustosFixosAnuais; rotulo: string }> = [
  { chave: "viaVerde", rotulo: "Via Verde e portagens" },
  { chave: "manutencao", rotulo: "Manutenção" },
  { chave: "iuc", rotulo: "IUC" },
  { chave: "inspecao", rotulo: "Inspecção" },
  { chave: "seguro", rotulo: "Seguro" },
];

function numeroOuNulo(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** A soma das rubricas, ou null se nenhuma estiver preenchida. */
export function totalDosCustosFixosAnuais(
  c: Partial<Record<string, number | null>> | null | undefined,
): number | null {
  if (!c) return null;
  let soma = 0;
  let alguma = false;
  for (const { chave } of RUBRICAS_DOS_CUSTOS_FIXOS) {
    const v = numeroOuNulo(c[chave]);
    if (v != null && v >= 0) {
      soma += v;
      alguma = true;
    }
  }
  return alguma ? Math.round(soma * 100) / 100 : null;
}

/**
 * Os custos fixos POR TRABALHO: o total anual a dividir pelos trabalhos do
 * ano. Sem o divisor, 3 000 € por ano não dizem nada sobre um trabalho —
 * devolve null e quem chama cai na referência da CLYON.
 */
export function custosFixosPorTrabalhoDe(
  anual: number | null | undefined,
  trabalhosPorMes: number | null | undefined,
): number | null {
  const a = numeroOuNulo(anual);
  const porMes = numeroOuNulo(trabalhosPorMes);
  if (a == null || porMes == null || porMes <= 0) return null;
  return Math.round((a / (porMes * 12)) * 100) / 100;
}
