import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O CONCLUÍDO «POR VER», ESCRITO E PELO NOME — 22-10-2026.
 *
 * *«Está a mostrar 1 por ver nos concluídos, mas olhando os pedidos não tem
 * nenhuma diferença, não sei qual abrir.»* O realce era verde, a cor do
 * próprio bloco dos Concluídos. Agora o cartão diz «Por ver», e o bloco
 * aberto lista os que faltam, cada um a levar ao seu cartão.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const CLYON = ler("src/components/admin/TrabalhoClyon.tsx");

describe("o cartão diz que está por ver", () => {
  it("na Mesa e nos de valor fixo", () => {
    expect(MESA).toMatch(/\{porVer && \(\s*<span[^>]*>\s*Por ver\s*<\/span>/);
    expect(CLYON).toMatch(/\{porVer && \(\s*<span[^>]*>\s*Por ver\s*<\/span>/);
  });
});

describe("o bloco dos Concluídos diz quais são", () => {
  const i = MESA.indexOf('{b.chave === "concluidos" && !fechado && concluidosPorVer > 0 && (');
  const lista = MESA.slice(i, MESA.indexOf("abri-lo dá-o por visto", i));

  it("existe, e só com o bloco aberto e algum por ver", () => {
    expect(i).toBeGreaterThan(-1);
  });

  it("pela mesma regra do número: os da Mesa e os de valor fixo sem carimbo", () => {
    expect(lista).toContain(".filter((p) => !p.concluidoVistoEm)");
    expect(lista).toContain('clyonDoBloco("concluidos")');
    expect(lista).toContain(".filter((t) => !t.concluidoVistoEm)");
    expect(MESA).toContain('clyonDoBloco("concluidos").filter((t) => !t.concluidoVistoEm).length');
  });

  it("cada nome leva ao cartão", () => {
    expect(lista).toContain("document.getElementById(`pedido-${p.id}`)");
    expect(lista).toContain("document.getElementById(`trabalho-${t.pedidoId}`)");
    expect(MESA).toContain("id={`pedido-${p.id}`}");
    expect(CLYON).toContain("id={`trabalho-${t.pedidoId}`}");
  });
});
