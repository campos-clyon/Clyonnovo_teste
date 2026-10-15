import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A PROCURA LEVA AO SEPARADOR ONDE O PEDIDO ESTÁ — 15-10-2026.
 *
 * *«Não aparece, como vou confirmar?»* Nos Pagamentos procurou-se «422» com o
 * separador em «Por receber»: o #422 estava em «Recebidos» e em «Por pagar aos
 * pros» (os números diziam-no), e a lista dizia «Nada com estes filtros».
 */
const PAINEL = readFileSync(join(process.cwd(), "src/components/admin/AdminPagamentosPanel.tsx"), "utf8")
  .replace(/\r\n/g, "\n")
  .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "");

describe("os Pagamentos, ao procurar", () => {
  it("abrem o primeiro separador com resultados quando o aberto fica vazio — só ao mudar os filtros", () => {
    expect(PAINEL).toContain("const comResultados = contas.filter((c) => c.linhas.length > 0);");
    expect(PAINEL).toContain("if (!aFiltrar || actual.linhas.length > 0 || comResultados.length === 0) return;");
    expect(PAINEL).toContain("setSeparador(comResultados[0].id);");
    // As dependências são os filtros, e não a lista: recarregar não faz saltar.
    expect(PAINEL).toContain("}, [q, profissional, periodo, entreDe, entreAte]);");
  });

  it("e, vazio aqui mas não noutro, dizem onde está, com o botão para lá", () => {
    expect(PAINEL).toContain("Neste separador não há nada com estes filtros. Está em");
    expect(PAINEL).toContain("onClick={() => setSeparador(c.id)}");
  });
});
