import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { depoisDeMarcar, obrigadoDoFeito } from "../../app-pro/src/lib/trabalhos";
import { pedirEmDemo } from "../../app-pro/src/lib/demo";
import { DIAS_ATE_LIBERTAR_SOZINHO, OBRIGADO_DEPOIS_DE_FEITO } from "./trabalho";

/**
 * A APP PRO SEM FOTOGRAFIAS NO «ESTÁ FEITO» — 30-10-2026 (dono).
 *
 * Substitui a versão de 26-10-2026 (fotografias opcionais, sem elas sem
 * prazo). Agora a caixa «Quando estiver feito» não tem «Fotografar» nem
 * galeria: o botão «Está feito», a nota opcional, e o cliente confirma — ou
 * fica confirmado 7 dias depois. As fotografias do ajuste no local ficam.
 */

const cru = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const semNotas = (f: string) =>
  cru(f)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s+/g, " ");

function ficheirosDaApp(pasta = "app-pro/src"): string[] {
  const fora: string[] = [];
  for (const nome of readdirSync(join(process.cwd(), pasta))) {
    const caminho = `${pasta}/${nome}`;
    if (statSync(join(process.cwd(), caminho)).isDirectory()) fora.push(...ficheirosDaApp(caminho));
    else if (/\.(ts|tsx)$/.test(nome)) fora.push(caminho);
  }
  return fora;
}

describe("a caixa «Quando estiver feito»", () => {
  const APP = semNotas("app-pro/src/componentes/TrabalhoContratado.tsx");
  const i = APP.indexOf("function EstaFeito(");
  const caixa = APP.slice(i, APP.indexOf(" function ", i + 10));

  it("não pede fotografias: sem «Fotografar», sem galeria, sem esperar por elas", () => {
    expect(caixa).not.toContain("<Fotografias");
    expect(caixa).not.toContain("fotosAEnviar");
    expect(caixa).not.toContain("FOTOGRAFIAS_SAO_OPCIONAIS");
    expect(caixa).toContain("Carregue em «Está feito» quando acabar.");
    expect(caixa).toContain('titulo="Está feito"');
    expect(caixa).toContain('placeholder="Nota (opcional)"');
    expect(caixa).toContain("corpo: { negociacaoId: t.negociacaoId, nota: nota.trim() }");
  });

  it("o ajuste no local continua com as suas fotografias", () => {
    expect(APP).toContain("<Fotografias negociacaoId={t.negociacaoId}");
  });

  it("nenhum ficheiro da app diz que é precisa uma fotografia para dar por feito", () => {
    for (const f of ficheirosDaApp()) {
      expect(cru(f), f).not.toContain("Precisa de pelo menos uma fotografia");
      expect(cru(f), f).not.toContain("Sem elas, espera que um colega da CLYON");
    }
  });
});

describe("o que a app diz", () => {
  it("antes do «Sim»: o cliente confirma, e o prazo", () => {
    expect(depoisDeMarcar("o cliente")).toContain(`${DIAS_ATE_LIBERTAR_SOZINHO} dias`);
    expect(depoisDeMarcar("o cliente")).toContain("o cliente é avisado para confirmar");
    expect(depoisDeMarcar("a CLYON")).toContain("a CLYON é avisada para confirmar");
    expect(depoisDeMarcar("o cliente", 0)).toBe(depoisDeMarcar("o cliente", 3));
  });

  it("depois: a frase da rota, ou a do site se não vier", () => {
    expect(obrigadoDoFeito({ mensagem: "Obrigado." })).toBe("Obrigado.");
    expect(obrigadoDoFeito(null)).toBe(OBRIGADO_DEPOIS_DE_FEITO);
  });

  it("o modo de demonstração responde como a rota: sem fotografias, com prazo", async () => {
    const r = await pedirEmDemo<{ confirmacaoAutomaticaEmDias: unknown; fotografias: unknown }>(
      "/api/profissionais/trabalho",
      "POST",
      { negociacaoId: 904, nota: "" },
    );
    expect(r.fotografias).toBe(0);
    expect(r.confirmacaoAutomaticaEmDias).toBe(DIAS_ATE_LIBERTAR_SOZINHO);
  });
});
