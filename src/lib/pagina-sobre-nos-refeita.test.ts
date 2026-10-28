import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { reviews } from "./reviews-data";

/**
 * /sobre-nos REFEITA — 18-10-2026.
 *
 * *«Faça o melhor que puder, com muito conteúdo criativo e palavras-chave nos
 * textos; esta está sem vida, muito fraca.»* — o dono. A regra de 30-09-2026
 * continua: nada de números nem testemunhos que não existam.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (t: string) =>
  t.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");
const CODIGO = semComentarios(ler("src/app/sobre-nos/page.tsx"));

describe("/sobre-nos", () => {
  it("tem a história, os serviços com preço, as regiões, as perguntas e os dados estruturados", () => {
    for (const s of [
      "const CAPITULOS = [",
      "const SERVICOS = [",
      "const REGIOES = REGIONS.map(",
      '"@type": "AboutPage"',
      '"@type": "FAQPage"',
      "jsonLd(breadcrumbSchema)",
    ]) {
      expect(CODIGO, s).toContain(s);
    }
  });

  it("os números vêm das constantes, e não se escrevem à mão", () => {
    // Só o Google desde 28-10-2026 (dono): as contratações da Fixando saíram.
    expect(CODIGO).not.toContain("AVALIACOES.contratacoes");
    expect(CODIGO).toContain("AVALIACOES.notaGoogle");
    expect(CODIGO).not.toMatch(/\b(158|119)\b/);
    expect(CODIGO).not.toMatch(/\d\s*€/);
    // Os preços dos serviços saem de precos-publicos, com «+ IVA».
    expect(CODIGO).toContain("preco: maisIva(PRECOS.recolha_moveis.etiqueta)");
  });

  it("os testemunhos são os de reviews-data, palavra por palavra", () => {
    const nomes = CODIGO.match(/const TESTEMUNHOS = \[([^\]]+)\]/)?.[1] ?? "";
    const escolhidos = [...nomes.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(escolhidos.length).toBeGreaterThanOrEqual(3);
    for (const n of escolhidos) expect(reviews.some((r) => r.name === n), n).toBe(true);
    expect(CODIGO).toContain("{t.text}");
  });

  /*
   * A HISTÓRIA DO FUNDADOR — 18-10-2026. Contada por ele, e publicada sem o que
   * ele pediu para ficar de fora: percalços com nomes, contas da casa e
   * críticas a terceiros.
   */
  it("a história é a do fundador, com o nome dos dados legais, e fecha com a carta", () => {
    expect(CODIGO).toContain('const FUNDADOR = IDENTIFICACAO.nomeLegal.split(" ")[0];');
    expect(CODIGO).toContain("Começou com uma carrinha e uma mensagem.");
    expect(CODIGO).toContain("O dia em que o camião parou");
    expect(CODIGO).toContain("{CARTA.map((p) => (");
    expect(CODIGO).toContain("Fundador da CLYON");
    expect(CODIGO).toContain('question: "Como nasceu a CLYON?"');
  });

  it("e não leva o que ficou de fora", () => {
    for (const fora of [
      /fake|falso|falsos/i,
      /8\s?mil|4\s?mil|euros por mês/i,
      /limite financeiro|dívida|prejuízo/i,
      /desistiu|stress|exausto/i,
      /documento|residência|legislação/i,
      /Gelai|La Rochelle|camarão|nuggets/i,
    ]) {
      expect(CODIGO, String(fora)).not.toMatch(fora);
    }
  });

  it("fala como plataforma: quem vai a casa é o profissional", () => {
    expect(CODIGO).toContain("É uma plataforma. Quem vai a sua casa é o profissional independente que escolher");
    expect(CODIGO).not.toMatch(/a nossa equipa|empresa local|nossa (base|sede)|seguros? inclu[íi]d|tudo inclu[íi]do|melhores pre[çc]os/i);
  });

  it("nada de texto escondido para o Google", () => {
    expect(CODIGO).not.toMatch(/sr-only|display:\s*none|className="hidden"|aria-hidden="true">[^<]{40,}/);
  });
});
