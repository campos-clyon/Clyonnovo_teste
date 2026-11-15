import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { falaDoModeloAntigo } from "./palavras-do-modelo-antigo";
import {
  DUAS_FATURAS_POR_TRABALHO,
  DUAS_FATURAS_POR_TRABALHO_CURTA,
  PAGA_AO_PARCEIRO_QUE_CONTRATOU,
} from "./pagar-ao-parceiro";
import { faturaEmPalavras } from "./seo-data";
import { PRECO_FECHADO } from "./promessas-publicas";

/*
 * d30 (15-11-2026): «Há fatura em todas as vendas, emitida pela empresa parceira
 * da CLYON, e o preço já vem com IVA» deixou de ser verdade — a fatura do trabalho
 * é do parceiro, com IVA ou isenta. O texto novo é o do Jurídico, tal e qual.
 */
// relógio: datas explícitas — a única conta com data (faturaEmPalavras) leva-a; o resto são constantes.
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("d30 — as duas faturas de cada trabalho", () => {
  it("o texto do Jurídico, tal e qual", () => {
    expect(DUAS_FATURAS_POR_TRABALHO).toBe(
      "Cada trabalho tem duas faturas, juntas ao pedido: a do trabalho, emitida pelo parceiro, com IVA ou com isenção de IVA conforme o regime dele, e a da taxa da plataforma, emitida pela empresa parceira da CLYON, com IVA. O preço da proposta já é o total a pagar, e no perfil de cada parceiro vê, antes de o escolher, o tipo de fatura que ele emite.",
    );
    expect(DUAS_FATURAS_POR_TRABALHO_CURTA).toBe(
      "Cada trabalho tem duas faturas: a do trabalho, passada pelo parceiro (com IVA ou isento, conforme o regime dele), e a da taxa da plataforma, passada pela empresa parceira da CLYON.",
    );
  });

  it("a frase da fatura no modelo novo é a longa, e a do preço fechado leva a curta", () => {
    expect(faturaEmPalavras(new Date("2026-11-16T12:00:00Z"))).toBe(DUAS_FATURAS_POR_TRABALHO);
    expect(PRECO_FECHADO).toContain(DUAS_FATURAS_POR_TRABALHO_CURTA);
  });

  it("o teste da orquestra apanha as duas frases antigas", () => {
    expect(falaDoModeloAntigo("Há fatura em todas as vendas, emitida pela empresa parceira da CLYON.", "todos")).not.toBeNull();
    expect(falaDoModeloAntigo("Na proposta, o preço já vem com IVA incluído.", "todos")).not.toBeNull();
    expect(falaDoModeloAntigo("Sempre com fatura.", "todos")).not.toBeNull();
    // O IVA da taxa (o que o profissional passa à CLYON) continua a dizer-se.
    expect(falaDoModeloAntigo("o preço com IVA, que já inclui a taxa da plataforma e o IVA dela", "todos")).toBeNull();
    expect(falaDoModeloAntigo(DUAS_FATURAS_POR_TRABALHO, "cliente")).toBeNull();
    expect(falaDoModeloAntigo(PRECO_FECHADO, "cliente")).toBeNull();
  });
});

describe("d30 — a página dos anúncios (/orcamento-recolha-lisboa)", () => {
  const landing = ler("src/app/orcamento-recolha-lisboa/LandingClient.tsx");
  const pagina = ler("src/app/orcamento-recolha-lisboa/page.tsx");
  const semComentarios = (t: string) =>
    t.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  it("sem entulho no que a página promete e mostra (d12)", () => {
    expect(semComentarios(landing)).not.toMatch(/entulho/i);
    expect(semComentarios(pagina)).not.toMatch(/entulho/i);
  });

  it("diz que se paga diretamente ao parceiro, ao pé do preço", () => {
    expect(PAGA_AO_PARCEIRO_QUE_CONTRATOU).toBe("Paga diretamente ao parceiro que contratou.");
    expect(landing).toMatch(/\{PAGA_AO_PARCEIRO_QUE_CONTRATOU\} \{PRECO_FECHADO\}/);
  });

  it("título até 60 e descrição até 155", async () => {
    const { metadata } = await import("@/app/orcamento-recolha-lisboa/page");
    expect([...String(metadata.title)].length).toBeLessThanOrEqual(60);
    expect([...String(metadata.description)].length).toBeLessThanOrEqual(155);
    expect(String(metadata.description)).not.toMatch(/entulho/i);
  }, 120_000);
});
