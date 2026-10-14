import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { reviews } from "./reviews-data";

/*
 * O TOPO DA PÁGINA INICIAL E O QUE SE DIZ DAS AVALIAÇÕES — 14-10-2026.
 *
 * Da auditoria de SEO: o telefone não estava no topo, o topo não dizia quem
 * faz o trabalho, o formulário recebia uma estimativa e não mostrava nada, e
 * os depoimentos tinham datas com um dia que ninguém sabia.
 */
const ler = (f: string) =>
  readFileSync(join(process.cwd(), f), "utf8")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("o topo da página inicial", () => {
  const INICIAL = ler("src/app/page.tsx");

  it("tem o telefone, e não só o WhatsApp", () => {
    expect(INICIAL).toContain("href={`tel:${BUSINESS_PHONE}`}");
    expect(INICIAL).toContain("Ligar {telefoneLegivel(BUSINESS_PHONE)}");
  });

  it("diz quem faz o trabalho", () => {
    expect(INICIAL).toContain("Quem faz o trabalho é o profissional que escolher.");
  });
});

describe("o formulário da página inicial, depois de enviado", () => {
  const FORM = ler("src/components/HeroQuoteForm.tsx");

  it("mostra a faixa de referência do serviço, com o IVA ao lado", () => {
    expect(FORM).toContain("{maisIva(precoDe(form.tipoServico) ?? \"\")}");
  });

  it("e não a estimativa do motor — decisão do dono, 18-09-2026", () => {
    // O número do motor ancora quem o lê; a proposta a seguir parece um aumento.
    const sucesso = FORM.slice(FORM.indexOf("if (sent) {"), FORM.indexOf("// ── form card"));
    expect(sucesso.length).toBeGreaterThan(100);
    expect(sucesso).not.toMatch(/estimate\??\.(estimated|estimateM)/);
  });
});

describe("as datas dos depoimentos", () => {
  it("são mês e ano — o dia era o da cópia, não o da avaliação", () => {
    const meses = "janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";
    const comDia = reviews.filter((r) => !new RegExp(`^(${meses}) de \\d{4}$`).test(r.date)).map((r) => r.date);
    expect(comDia).toEqual([]);
  });
});
