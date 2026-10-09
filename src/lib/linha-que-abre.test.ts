import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { cliqueParaAbrir } from "./linha-que-abre";

/**
 * A LINHA ABRE AO CLIQUE — 09-10-2026. «Remova os botões abrir; clicar no
 * pedido já deve abrir sem um botão; faça isso em todo o backoffice.»
 */

// Um DOM de brincar: cada nó sabe quem é o pai e responde a `closest` pelo nome da etiqueta.
type No = { tag: string; pai: No | null; closest: (s: string) => No | null; contains: (o: unknown) => boolean };
function no(tag: string, pai: No | null = null): No {
  const n: No = {
    tag,
    pai,
    closest(seletor) {
      const tags = ["a", "button", "input", "select", "textarea", "label", "summary"];
      for (let x: No | null = n; x; x = x.pai) {
        if (tags.includes(x.tag) && seletor.includes(x.tag)) return x;
        if (x.tag === "linha" && seletor.includes("[role='button']")) return x;
      }
      return null;
    },
    contains(o) {
      for (let x = o as No | null; x; x = x.pai) if (x === n) return true;
      return false;
    },
  };
  return n;
}

const semSeleccao = { isCollapsed: true, toString: () => "", anchorNode: null };

describe("o clique na linha", () => {
  const linha = no("linha");
  const texto = no("span", linha);
  const caixa = no("input", linha);
  const telefone = no("a", linha);
  const dentroDoBotao = no("svg", no("button", linha));

  it("no texto da linha, abre", () => {
    expect(cliqueParaAbrir(texto, linha, semSeleccao)).toBe(true);
    expect(cliqueParaAbrir(linha, linha, semSeleccao)).toBe(true);
  });

  it("na caixa de marcar, no telefone ou num botão de dentro, não abre", () => {
    expect(cliqueParaAbrir(caixa, linha, semSeleccao)).toBe(false);
    expect(cliqueParaAbrir(telefone, linha, semSeleccao)).toBe(false);
    expect(cliqueParaAbrir(dentroDoBotao, linha, semSeleccao)).toBe(false);
  });

  it("depois de seleccionar texto da linha (para copiar um número), não abre", () => {
    const seleccao = { isCollapsed: false, toString: () => "912 345 678", anchorNode: texto };
    expect(cliqueParaAbrir(texto, linha, seleccao)).toBe(false);
    // Texto seleccionado noutro sítio da página não conta.
    const fora = { isCollapsed: false, toString: () => "outra coisa", anchorNode: no("p") };
    expect(cliqueParaAbrir(texto, linha, fora)).toBe(true);
  });
});

describe("no backoffice inteiro", () => {
  const raiz = process.cwd();
  function ficheiros(d: string, out: string[] = []): string[] {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) ficheiros(p, out);
      else if (/\.tsx$/.test(e.name)) out.push(p);
    }
    return out;
  }
  const admin = [...ficheiros(join(raiz, "src/components/admin")), ...ficheiros(join(raiz, "src/app/admin"))];

  it("nenhum botão diz «Abrir» — a linha é que abre", () => {
    const achados = admin.flatMap((f) => {
      const s = readFileSync(f, "utf8").replace(/\r\n/g, "\n");
      const maus = [
        /\n\s*Abrir\n\s*<\/button>/,
        // Como texto do botão — o rótulo «Abrir o pedido #12» do leitor de ecrã pode.
        /"Abrir"\}\s*\n/,
        /`Abrir Pedido \(/,
      ].filter((r) => r.test(s));
      return maus.length ? [relative(raiz, f)] : [];
    });
    expect(achados).toEqual([]);
  });

  it("os sítios que tinham o botão abrem pela linha", () => {
    const ler = (p: string) => readFileSync(join(raiz, p), "utf8").replace(/\r\n/g, "\n");
    expect(ler("src/components/admin/AdminPagamentosPanel.tsx")).toContain("{...linhaQueAbre(() => {");
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain(
      '{...linhaQueAbre(alternarAberto, `${aberto ? "Fechar" : "Abrir"} o pedido #${p.id}`)}',
    );
    const L = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(L).toContain("onClick={cliqueDeLinhaDeTabela(() => { setSelectedPedido(p); setPedidoDetalheOpen(true); })}");
    expect(L).toContain("onClick={cliqueDeLinhaDeTabela(() => abrirTicket(t.id))}");
    expect(L).toContain("onClick={cliqueDeLinhaDeTabela(() => {\n");
    expect(L).not.toContain('title="Ver detalhes"');
  });
});
