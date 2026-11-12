import { dataEHoraEmLisboa } from "@/lib/hora-de-lisboa";
import { quotaEmPontos } from "@/lib/quota-da-clyon";
import type { UltimaMudancaDeTaxa } from "@/lib/ultima-mudanca-de-taxa";

const pontos = (n: number) => `${String(Math.round(n * 10000) / 100).replace(".", ",")} %`;

/**
 * A frase do ecrã: «DD/MM/AAAA · HH:mm, por X (administrador): CLYON a % → b %
 * do que o cliente paga (cliente …, profissional …).»
 * Em hora de Lisboa, seja qual for o fuso de quem vê.
 */
export function fraseDaMudancaDeTaxa(m: UltimaMudancaDeTaxa): string {
  const quando = dataEHoraEmLisboa(new Date(m.quando));
  const quem = m.perfil ? `${m.quem} (${m.perfil})` : m.quem;
  return (
    `${quando}, por ${quem}: CLYON ${quotaEmPontos(m.antes)} → ${quotaEmPontos(m.depois)} do que o cliente paga ` +
    `(cliente ${pontos(m.antes.cliente)} → ${pontos(m.depois.cliente)}, ` +
    `profissional ${pontos(m.antes.profissional)} → ${pontos(m.depois.profissional)}).`
  );
}
