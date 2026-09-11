import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A CLYON NÃO TEM SEGURO — e o site prometia um.
 *
 * «Não temos nenhum seguro» — 11-09-2026, depois de a auditoria encontrar
 * «Seguro de responsabilidade civil incluído» em /mudancas, em dois sítios da
 * mesma página.
 *
 * Não é uma frase infeliz: é a promessa mais cara que o site podia fazer. Um
 * cliente com um móvel partido reclama uma cobertura que não existe, e tem por
 * escrito que lha prometemos. Não há apólice, não se pede seguro ao
 * profissional, não se verifica, não se guarda — não há um único campo de
 * seguro na tabela dos profissionais.
 *
 * Este teste é o guarda. Procura as promessas em todo o código de produção e
 * chumba se alguma voltar — e vão voltar, porque «seguro incluído» é o que
 * qualquer pessoa escreve numa página de mudanças sem pensar duas vezes.
 *
 * SE UM DIA HOUVER SEGURO, isto não se apaga: o caminho coerente com o resto
 * do produto é EXIGIR apólice ao profissional e verificá-la, como já se faz
 * com o número de transportador. Aí a frase passa a «profissionais com seguro
 * verificado» — que é verdade, é verificável, e não é esta.
 */

const RAIZ = join(process.cwd(), "src");

function ficheirosDeProducao(dir = RAIZ, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      ficheirosDeProducao(caminho, acc);
    } else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) {
      acc.push(caminho);
    }
  }
  return acc;
}

/*
 * SÃO AS FRASES, E NÃO A PALAVRA.
 *
 * «Seguro» é legítimo em dois sítios deste produto: o SEGURO DE RISCO do
 * perfil do profissional — uma percentagem que ele põe de lado nos custos
 * dele, dinheiro dele para ele — e «em segurança», «pagamento seguro»,
 * «processo seguro». Um teste que apanhasse a palavra apanhava esses, e um
 * teste que apanha demais acaba desligado.
 */
const PROMESSAS_DE_SEGURO = [
  "Seguro de responsabilidade civil",
  "seguro de responsabilidade civil",
  "Seguro incluído",
  "seguro incluído",
  "seguro incluido",
  "com seguro e",
  "segurados pela CLYON",
  "cobertura de seguro",
  "apólice da CLYON",
];

describe("o site não promete um seguro que não existe", () => {
  it("nenhuma das promessas sobrevive em código de produção", () => {
    const reincidentes: string[] = [];
    for (const f of ficheirosDeProducao()) {
      // O ficheiro que explica porque é que não há seguro cita-as de propósito.
      if (f.endsWith("sem-seguro.ts")) continue;
      const texto = readFileSync(f, "utf8");
      for (const frase of PROMESSAS_DE_SEGURO) {
        if (texto.includes(frase)) {
          reincidentes.push(`${f.replace(process.cwd(), "")} → «${frase}»`);
        }
      }
    }
    expect(
      reincidentes,
      `A promessa do seguro voltou em:\n${reincidentes.join("\n")}`,
    ).toEqual([]);
  });

  it("a página de mudanças deixou de falar por uma frota que não existe", () => {
    /*
     * O mesmo bloco vendia «Equipa profissional treinada» e «Veículos de vários
     * tamanhos (carrinhas a camiões)». A CLYON não tem veículos nem pessoal:
     * quem vai é um profissional independente, com a carrinha dele.
     */
    const MUDANCAS = readFileSync(join(RAIZ, "app/mudancas/page.tsx"), "utf8");
    expect(MUDANCAS).not.toContain("Veículos de vários tamanhos");
    expect(MUDANCAS).not.toContain("Equipa profissional treinada");
    expect(MUDANCAS).not.toContain("Chegamos à hora combinada");
    // E o que ficou no lugar é verdade e é verificável.
    expect(MUDANCAS).toContain("acordado por escrito");
  });

  it("o seguro de risco do profissional continua a existir — é outra coisa", () => {
    // É dinheiro que ELE põe de lado nos custos dele, para partidos e viagens
    // em vão. Não é cobertura nenhuma para o cliente, e não pode desaparecer
    // por arrasto de uma limpeza de texto.
    const PERFIL = readFileSync(join(RAIZ, "app/profissionais/painel/Perfil.tsx"), "utf8");
    expect(PERFIL).toContain("Seguro de risco");
  });
});
