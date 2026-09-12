import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultSimulatorSettings } from "./simulator-settings";
import { TAXA_CLIENTE, TAXA_PROFISSIONAL } from "./taxas-plataforma";

/**
 * NENHUM VALOR CONFIGURÁVEL PODE FICAR INVISÍVEL.
 *
 * "Essa tela está desatualizada, trava as configurações reais — inclusive
 * taxas de pros, CLYON e assistentes." — 12-09-2026.
 *
 * O ecrã tinha uma lista de chaves escrita à mão e só desenhava o que lá
 * estivesse. Catorze valores existiam na base e não apareciam em lado nenhum:
 * a margem de lucro, o custo por km, o custo por hora e pessoa, o preço por
 * saco de entulho, o gasóleo, e o que se paga ao assistente por trabalho.
 *
 * O que este teste guarda não é a arrumação — é que **nada se perde**. Os
 * grupos podem mudar de nome, de ordem, de descrição; o que não pode voltar é
 * um valor que exista e que ninguém veja.
 */

const ADMIN = readFileSync(
  join(process.cwd(), "src/components/admin/LegacyAdminClient.tsx"),
  "utf8",
);

/** As chaves nomeadas nos grupos do ecrã. */
function chavesDosGrupos(): string[] {
  const i = ADMIN.indexOf("const simulatorDisplayGroups");
  const j = ADMIN.indexOf("] as const;", i);
  expect(i, "o bloco dos grupos deixou de existir com este nome").toBeGreaterThan(0);
  const bloco = ADMIN.slice(i, j);
  // As chaves vivem dentro de `keys: [...]`; os `id:` e `label:` ficam de fora.
  return [...bloco.matchAll(/keys:\s*\[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/"([a-z_0-9]+)"/g)].map((k) => k[1]));
}

describe("o ecrã das configurações mostra tudo o que existe", () => {
  it("há um grupo que apanha o que não foi arrumado", () => {
    /*
     * É esta a peça que impede a reincidência. Sem ela, um valor novo só
     * aparece se alguém se lembrar de o acrescentar à lista escrita à mão — e
     * foi exactamente isso que falhou catorze vezes.
     */
    expect(ADMIN).toContain("const arrumadas = new Set(");
    expect(ADMIN).toContain("!arrumadas.has(s.key)");
    expect(ADMIN).toContain("Outros valores");
  });

  it("os valores que o dono foi procurar estão num grupo com nome", () => {
    // Não chega caírem no «Outros»: estes são os que ele abriu o ecrã para ver.
    const nosGrupos = new Set(chavesDosGrupos());
    for (const chave of [
      "margem_lucro",
      "custo_km",
      "custo_hora_pessoa",
      "num_pessoas_equipa",
      "overhead_por_servico",
      "pagamento_assistente_por_trabalho",
      "entulho_saco_ensacado",
      "entulho_saco_chao",
      "diesel_preco",
      "km_por_litro",
    ]) {
      expect(nosGrupos.has(chave), `«${chave}» não está em grupo nenhum`).toBe(true);
    }
  });

  it("o mesmo valor não aparece em dois grupos", () => {
    /*
     * «Monos» e «Pós-obra» repetiam as duas chaves do entulho. Não eram
     * valores parecidos — eram a MESMA linha da base desenhada três vezes, e
     * mudar o número num cartão mudava nos outros dois. Quem visse isso
     * concluía, com razão, que o ecrã estava avariado.
     */
    const chaves = chavesDosGrupos();
    const repetidas = chaves.filter((k, i) => chaves.indexOf(k) !== i);
    expect(repetidas, `repetidas em mais do que um grupo: ${repetidas.join(", ")}`).toEqual([]);
  });

  it("nenhum grupo nomeia uma chave que não existe", () => {
    // Uma chave inventada não dá erro: o cartão simplesmente não aparece, e
    // quem a procura nunca sabe porquê.
    const existem = new Set(defaultSimulatorSettings.map((s) => s.key as string));
    // `entulho_saco_chao_extra` está gravado na base desde antes desta lista de
    // defaults; continua a ser mostrado de propósito.
    const toleradas = new Set(["entulho_saco_chao_extra"]);
    const fantasmas = chavesDosGrupos().filter((k) => !existem.has(k) && !toleradas.has(k));
    expect(fantasmas, `chaves que não existem: ${fantasmas.join(", ")}`).toEqual([]);
  });
});

describe("as taxas dizem onde vivem, em vez de se calarem", () => {
  it("o ecrã mostra-as e explica que não se editam ali", () => {
    expect(ADMIN).toContain("Taxas da plataforma");
    expect(ADMIN).toContain("TAXA_CLIENTE");
    expect(ADMIN).toContain("TAXA_PROFISSIONAL");
    expect(ADMIN).toContain("Não se mudam por aqui");
  });

  it("continuam a ser 5 % e 6 % — o ecrã lê a constante, não um número escrito", () => {
    expect(Math.round(TAXA_CLIENTE * 100)).toBe(5);
    expect(Math.round(TAXA_PROFISSIONAL * 100)).toBe(6);
    expect(ADMIN).toContain("Math.round(TAXA_CLIENTE * 100)");
    expect(ADMIN).toContain("Math.round(TAXA_PROFISSIONAL * 100)");
  });
});
