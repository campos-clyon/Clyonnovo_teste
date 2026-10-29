import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O CARTÃO DOS PAGAMENTOS FICA ABERTO DEPOIS DE UMA RESPOSTA — 19-10-2026.
 *
 * *«Quando marco "Já pagámos" o cartão se fecha; quando marco "Já recebemos"
 * o pedido some. Caso eu marque que já recebemos primeiro, não consigo
 * responder se já pagámos.»* — o dono, no #444.
 */
const P = readFileSync(join(process.cwd(), "src/components/admin/AdminPagamentosPanel.tsx"), "utf8").replace(/\r\n/g, "\n");
const AGIR = P.slice(P.indexOf("async function agir("), P.indexOf("let mostradas = 0;"));

describe("depois de «Já recebemos» ou «Já pagámos»", () => {
  it("o cartão não fecha — só o excluir o fecha", () => {
    expect(AGIR).toContain('if (url.endsWith("/excluir")) setAberto(null);');
    expect(AGIR).not.toMatch(/^\s*setAberto\(null\);\s*$/m);
  });

  it("o que saiu do separador fica nele até se mudar de separador", () => {
    expect(AGIR).toContain("else setFicamAqui((s) => new Set(s).add(t.negociacaoId));");
    expect(P).toContain("useEffect(() => setFicamAqui(new Set()), [separador]);");
    expect(P).toContain("const emOrdem = porNumeroDoPedido([...actual.linhas, ...ficaramAqui]);");
    expect(P).toContain("saiuDaqui={ficaramAqui.includes(t) ? actual.rotulo : null}");
  });

  it("e não conta nos números nem nas somas de onde saiu", () => {
    expect(P).toContain("{euros(somaDe(contam(g.linhas), separador))}");
    expect(P).toContain("{euros(somaDe(contam(sg.linhas), separador))}");
    expect(P).toContain("{g.titulo} · {contam(g.linhas).length}");
    expect(P).not.toContain("somaDe(g.linhas, separador)");
    expect(P).not.toContain("somaDe(sg.linhas, separador)");
  });
});
