import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatarEuros } from "./formatar-euros";

/**
 * «123.45 €» na área do cliente — o ponto decimal do `toFixed`.
 *
 * Os espaços do `Intl` não são espaços normais: entre o número e o € vai um
 * espaço que não parte (U+00A0), e os milhares podem levar outro, ou o fino
 * (U+202F), conforme a versão do ICU. Compara-se com os espaços todos
 * trocados por um normal — o que interessa é a vírgula, o símbolo no fim e
 * não haver ponto decimal.
 */
const normal = (s: string) => s.replace(/\s/g, " ");

describe("formatarEuros", () => {
  it("usa vírgula decimal e o símbolo depois", () => {
    expect(normal(formatarEuros(123.45))).toBe("123,45 €");
    expect(normal(formatarEuros(0))).toBe("0,00 €");
    expect(normal(formatarEuros(12.5))).toBe("12,50 €");
  });

  it("aceita o texto que vem da base («123.45»)", () => {
    expect(normal(formatarEuros("123.45"))).toBe("123,45 €");
  });

  it("os milhares não levam ponto decimal nem vírgula a mais", () => {
    // Em pt-PT os de quatro algarismos podem vir sem separador; os de cinco trazem-no.
    expect(normal(formatarEuros(1234.56))).toMatch(/^1 ?234,56 €$/);
    expect(normal(formatarEuros(12345.67))).toBe("12 345,67 €");
  });

  it("o que não é número dá um travessão, e não «NaN €» nem «0,00 €»", () => {
    expect(formatarEuros(null)).toBe("—");
    expect(formatarEuros(undefined)).toBe("—");
    expect(formatarEuros("")).toBe("—");
    expect(formatarEuros("   ")).toBe("—");
    expect(formatarEuros("abc")).toBe("—");
    expect(formatarEuros(Number.NaN)).toBe("—");
  });
});

describe("a área do cliente usa-o", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("a lista e o detalhe do pedido deixaram o toFixed com ponto", () => {
    for (const f of [
      "src/app/conta/components/MeusPedidos.tsx",
      "src/app/conta/components/OrderDetailModal.tsx",
    ]) {
      const fonte = ler(f);
      expect(fonte).toContain('import { formatarEuros } from "@/lib/formatar-euros";');
      expect(fonte).toContain("formatarEuros(preco)");
      expect(fonte).not.toContain("Number(preco).toFixed(2)");
    }
  });
});
