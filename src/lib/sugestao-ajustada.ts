import type { SugestaoParaOProfissional } from "./sugestao-para-o-profissional";
import { quantoOProfissionalRecebe } from "./taxas-plataforma";

/**
 * A CONTA REFEITA COM OUTRO TEMPO E OUTRA EQUIPA — e num ficheiro só dela.
 *
 * "O tempo estimado e a quantidade de pessoas vamos deixar editável, pois é
 * uma variável." — 12-09-2026.
 *
 * E é mesmo. O mesmo esvaziamento leva duas horas com três pessoas ou quatro
 * com uma, e o número que a CLYON estima é uma média sobre trabalhos que não
 * são este. Quem sabe quanto tempo vai demorar é quem o vai fazer — e até
 * aqui ele via a conta feita sobre um palpite nosso sem ter como a corrigir,
 * a não ser indo ao perfil mudar a média de TODOS os trabalhos.
 *
 * PORQUE É QUE ISTO NÃO VIVE EM `sugestao-para-o-profissional.ts`
 *
 * Porque esse ficheiro importa `pricing-helper`, que importa `db`, que importa
 * o `mysql2` e o `drizzle`. Enquanto o ecrã do profissional só lhe pedia o
 * TIPO, isso não custava nada — um `import type` desaparece na compilação.
 * No instante em que ele passou a chamar a função, o browser passou a receber
 * a camada de base de dados inteira, e o `next build` recusou-se — com razão.
 *
 * A dependência aponta para o lado seguro: o módulo do servidor importa daqui
 * os formatadores, e nunca o contrário. Assim não há duas maneiras de escrever
 * «2,5 h» nem duas fórmulas para a mesma conta.
 *
 * E NÃO SE VOLTA AO SERVIDOR, o que não é pressa: a sugestão já traz todas as
 * parcelas — custo/hora, combustível, fixos, risco e margem. Refazer a conta
 * aqui dá exactamente o mesmo número que o servidor daria, e dá-o enquanto ele
 * escreve no campo.
 */

export function aosCentimos(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
export const km = (v: number) => `${(Math.round(v * 10) / 10).toString().replace(".", ",")} km`;

export function horasPorExtenso(h: number): string {
  const arredondado = Math.round(h * 100) / 100;
  return `${String(arredondado).replace(".", ",")} h`;
}

/** Os limites do que faz sentido escrever. Meia hora a um dia; uma a seis pessoas. */
export const HORAS_MINIMAS = 0.5;
export const HORAS_MAXIMAS = 24;
export const PESSOAS_MINIMAS = 1;
export const PESSOAS_MAXIMAS = 6;

export function horasValidas(h: number): number {
  if (!Number.isFinite(h)) return HORAS_MINIMAS;
  return Math.min(HORAS_MAXIMAS, Math.max(HORAS_MINIMAS, Math.round(h * 2) / 2));
}

export function pessoasValidas(p: number): number {
  if (!Number.isFinite(p)) return PESSOAS_MINIMAS;
  return Math.min(PESSOAS_MAXIMAS, Math.max(PESSOAS_MINIMAS, Math.round(p)));
}

/**
 * A mesma sugestão, com outro tempo e outra equipa.
 *
 * Devolve a sugestão inteira, para o ecrã não ter de compor nada: os três
 * números de cima, as parcelas por extenso, e o que lhe fica no fim.
 */
export function sugestaoComOutroTempo(
  base: SugestaoParaOProfissional,
  pedido: { horas?: number; pessoas?: number },
): SugestaoParaOProfissional {
  const horas = horasValidas(pedido.horas ?? base.horas);
  const pessoas = pessoasValidas(pedido.pessoas ?? base.pessoas);
  if (horas === base.horas && pessoas === base.pessoas) return base;

  const custoPessoal = aosCentimos(horas * pessoas * base.custoHoraPessoa);
  const seguroDeRisco = aosCentimos(
    (base.custoCombustivel + custoPessoal) * (base.riscoPercent / 100),
  );
  const custoMinimo = aosCentimos(
    base.custoCombustivel + custoPessoal + base.custosFixos + seguroDeRisco,
  );
  const precoSugerido = aosCentimos(custoMinimo * (1 + base.margem));
  const recebeSePropuser = quantoOProfissionalRecebe(precoSugerido);

  /*
   * As parcelas reescrevem-se NO SÍTIO, e não se acrescentam ao fim.
   *
   * São duas as que mudam — o pessoal, e o seguro de risco que se calcula
   * sobre ele. Reescrevê-las pela posição perdia-se à primeira parcela nova;
   * reconhecê-las pelo princípio da frase sobrevive a isso.
   */
  const pressupostos = base.pressupostos.map((linha) => {
    if (linha.startsWith("Pessoal:")) {
      const daCasa = linha.includes("(tempo estimado pela CLYON)");
      return (
        `Pessoal: ${horasPorExtenso(horas)} × ${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"}` +
        ` × ${euros(base.custoHoraPessoa)}/h = ${euros(custoPessoal)}` +
        (daCasa ? " (tempo que indicou)" : " (o seu tempo médio, deslocação e recolha)")
      );
    }
    if (linha.startsWith("Seguro de risco:")) {
      return (
        `Seguro de risco: ${base.riscoPercent} % de ` +
        `${euros(aosCentimos(base.custoCombustivel + custoPessoal))} = ${euros(seguroDeRisco)}`
      );
    }
    return linha;
  });

  return {
    ...base,
    horas,
    pessoas,
    custoPessoal,
    seguroDeRisco,
    custoMinimo,
    precoSugerido,
    recebeSePropuser,
    lucroEstimado: aosCentimos(recebeSePropuser - custoMinimo),
    pressupostos,
  };
}
