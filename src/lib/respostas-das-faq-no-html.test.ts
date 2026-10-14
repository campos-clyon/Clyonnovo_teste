import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * AS RESPOSTAS DAS FAQ ESTÃO NO HTML — 14-10-2026.
 *
 * Na página inicial e em /faq o acordeão só criava a resposta quando alguém
 * carregava na pergunta. O Google lia as perguntas sem resposta nenhuma; as
 * respostas só existiam no JSON-LD, que ele deixou de mostrar em 2026.
 * Agora ficam sempre no HTML, escondidas até se abrirem.
 */
const ler = (f: string) =>
  readFileSync(join(process.cwd(), f), "utf8")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("as respostas das FAQ", () => {
  it("em /faq, a resposta esconde-se, não deixa de existir", () => {
    const FAQ = ler("src/app/faq/FAQClient.tsx");
    expect(FAQ).toContain("hidden={!isOpen}");
    expect(FAQ).not.toMatch(/\{isOpen && \(/);
    // E quem usa leitor de ecrã sabe se a pergunta está aberta.
    expect(FAQ).toContain("aria-expanded={isOpen}");
  });

  it("no acordeão da página inicial, o Radix monta-a sempre e o estado esconde-a", () => {
    const ACORDEAO = ler("src/components/ui/accordion.tsx");
    const content = ACORDEAO.slice(ACORDEAO.indexOf("<AccordionPrimitive.Content"));
    expect(content.indexOf("forceMount")).toBeGreaterThan(-1);
    // No próprio Content: com forceMount o Radix já não a esconde sozinho.
    expect(content.slice(0, content.indexOf(">"))).toContain("data-[state=closed]:hidden");
  });

  it("a secção de FAQ dos serviços já as tinha no HTML, e continua", () => {
    const SECCAO = ler("src/components/service/FAQSection.tsx");
    expect(SECCAO).toContain("{faq.answer}");
    expect(SECCAO).not.toMatch(/openIndex === index &&\s*\(/);
  });
});
