import { ESVAZIAMENTO_POR_ESPACO, ESVAZIAMENTO_POR_TIPOLOGIA, PECAS_DE_REFERENCIA, PRECOS } from "./precos-publicos";
import { PROPOSTA_COM_FOTOGRAFIAS, faixaSemEComIva, valorSemEComIva } from "./preco-de-referencia";
import { emTerra } from "./preposicao-da-terra";
import { linhasDoEntulho, linhasDosMonosEMoveis, type Valor } from "./quanto-custa";

/**
 * OS PREÇOS DE REFERÊNCIA DAS PÁGINAS DE CIDADE — 31-10-2026.
 *
 * O bloco «Referências úteis para o Barreiro, sem IVA» das páginas de monos,
 * de entulho e de esvaziamento não tinha preço nenhum: só a recolha de móveis
 * tinha referências, e os outros três serviços caíam em três frases gerais
 * («depende do volume e dos acessos»), sem um número, por baixo de um título
 * que prometia valores. O Marketing viu-o no ar no Barreiro, em Lisboa e no
 * Seixal.
 *
 * Aqui ficam as referências de cada serviço, lidas das fontes únicas
 * (`precos-publicos.ts`, e através de `quanto-custa.ts` também
 * `sacos-de-entulho.ts`) e escritas como o simulador e a app as escrevem
 * (`preco-de-referencia.ts`): o valor sem IVA e, ao lado, o com IVA. Nenhum
 * número se escreve aqui à mão. Um serviço sem referências devolve uma lista
 * vazia, e a página não mostra o bloco.
 */

export type ReferenciaDaCidade = {
  /** «Sofá de 2 a 3 lugares», «Até 1 m³ (≈ 40 sacos)». */
  oQue: string;
  /** Uma linha pequena por baixo, quando ajuda a escolher. */
  exemplo?: string;
  /**
   * «40 – 70 € + IVA (49,20 – 86,10 € com IVA)», «desde 120 € + IVA (147,60 €
   * com IVA)» — ou, quando a grelha não tem número, a proposta com fotografias.
   */
  preco: string;
};

/** O valor de uma linha da grelha, com o IVA ao lado — nunca o sem IVA sozinho. */
export function precoComOIvaAoLado(v: Valor): string {
  switch (v.tipo) {
    case "faixa":
      return faixaSemEComIva(v.de, v.ate);
    case "desde":
      return `desde ${valorSemEComIva(v.de)}`;
    case "exacto":
      return valorSemEComIva(v.valor);
    case "cerca":
      return `cerca de ${valorSemEComIva(v.valor)}`;
    case "orcamento":
      return PROPOSTA_COM_FOTOGRAFIAS;
  }
}

function exigir(n: number | null | undefined, onde: string): number {
  if (n == null) throw new Error(`${onde} sem preço em precos-publicos.ts`);
  return n;
}

const faixaDe = (servico: "recolha_moveis" | "recolha_monos"): Valor => ({
  tipo: "faixa",
  de: exigir(PRECOS[servico].minimo, servico),
  ate: exigir(PRECOS[servico].maximo, servico),
});

/** «Recolha de vários móveis no Barreiro» — a faixa da recolha de móveis. */
function variosMoveis(cidade: string): ReferenciaDaCidade {
  return { oQue: `Recolha de vários móveis ${emTerra(cidade)}`, preco: precoComOIvaAoLado(faixaDe("recolha_moveis")) };
}

/**
 * As referências de um serviço numa terra, pelo slug do serviço nas páginas
 * de cidade (`recolha-moveis`, `recolha-monos`, `recolha-entulho`,
 * `esvaziamento-casas`). Lista vazia para um serviço que não as tem.
 */
export function referenciasDaCidade(servicoDaCidade: string, cidade: string): ReferenciaDaCidade[] {
  switch (servicoDaCidade) {
    case "recolha-moveis":
      // As peças soltas ficam dentro da faixa da recolha de móveis (um teste
      // confere); o artigo do sofá diz as mesmas.
      return [
        ...PECAS_DE_REFERENCIA.map((p) => ({
          oQue: p.peca,
          preco: precoComOIvaAoLado({ tipo: "faixa", de: p.minimo, ate: p.maximo }),
        })),
        variosMoveis(cidade),
      ];

    case "recolha-monos": {
      // A linha dos monos de /precos/recolha-de-monos-e-moveis, e a dos móveis:
      // os móveis velhos também são monos, e é a pergunta que mais se faz.
      const monos = linhasDosMonosEMoveis().find((l) => l.oQue === "Recolha de monos");
      if (!monos) return [];
      return [
        { oQue: `Recolha de monos ${emTerra(cidade)}`, exemplo: monos.exemplo, preco: precoComOIvaAoLado(monos.valor) },
        variosMoveis(cidade),
      ];
    }

    case "recolha-entulho":
      // A grelha de /precos/recolha-de-entulho: os sacos, os três volumes e,
      // acima deles, a proposta com fotografias.
      return linhasDoEntulho().map((l) => ({ oQue: l.oQue, exemplo: l.exemplo, preco: precoComOIvaAoLado(l.valor) }));

    case "esvaziamento-casas": {
      // As tipologias de /esvaziamento-de-casas e, numa linha, a garagem, o
      // sótão e a cave — desde o mais baixo dos três.
      const desdeDosEspacos = Math.min(...ESVAZIAMENTO_POR_ESPACO.map((e) => e.faixas.carrinha.de));
      // «Garagem, sótão ou cave»
      const nomes = ESVAZIAMENTO_POR_ESPACO.map((e, i) => (i === 0 ? e.espaco : e.espaco.toLowerCase()));
      return [
        ...ESVAZIAMENTO_POR_TIPOLOGIA.map((t) => ({
          oQue: t.tipo,
          preco: precoComOIvaAoLado(
            t.maximo != null ? { tipo: "faixa", de: t.minimo, ate: t.maximo } : { tipo: "desde", de: t.minimo },
          ),
        })),
        {
          oQue: `${nomes.slice(0, -1).join(", ")} ou ${nomes[nomes.length - 1]}`,
          preco: precoComOIvaAoLado({ tipo: "desde", de: desdeDosEspacos }),
        },
      ];
    }

    default:
      return [];
  }
}
