import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contagemDosAnexos, nomeDoAnexo } from "./tipo-ficheiro";

/**
 * UM PDF JUNTADO A UM PEDIDO NÃO É UMA IMAGEM PARTIDA — pdf-no-pedido, 17-11-2026.
 *
 * O #630 tinha quatro fotografias e um «Inventario-fotos.pdf». A página do
 * pedido desenhava os cinco num `<img>`, e o quinto aparecia partido. O PDF
 * passa a ser um cartão com o ícone, o nome e «Abrir PDF», em todos os ecrãs
 * do site e do backoffice que mostram os ficheiros de um pedido.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8")
    .replace(/\r\n/g, "\n")
    // Comentários fora — só a regra ancorada ao início da linha.
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

describe("o contador diz o que lá está", () => {
  it("quatro fotografias e um PDF", () => {
    const lista = [
      { url: "https://x/a.jpg" },
      { url: "https://x/b.jpg" },
      { url: "https://x/c.png" },
      { url: "https://x/d.webp" },
      { url: "https://x/simulador/123-Inventario-fotos.pdf", name: "Inventario-fotos.pdf" },
    ];
    expect(contagemDosAnexos(lista)).toBe("4 fotografias e 1 documento");
  });

  it("singulares, plurais e os três juntos", () => {
    expect(contagemDosAnexos(["a.jpg"])).toBe("1 fotografia");
    expect(contagemDosAnexos(["a.pdf", "b.pdf"])).toBe("2 documentos");
    expect(contagemDosAnexos(["a.jpg", "b.mp4", "c.pdf"])).toBe("1 fotografia, 1 vídeo e 1 documento");
  });

  it("decide pelo nome quando o há, e pela URL quando não", () => {
    expect(contagemDosAnexos([{ url: "https://x/sem-extensao", name: "relatorio.pdf" }])).toBe("1 documento");
    expect(contagemDosAnexos([{ url: "https://x/r.pdf?v=2" }])).toBe("1 documento");
  });
});

describe("o nome do PDF quando só se tem a URL", () => {
  it("tira o carimbo que o armazenamento pôs à frente", () => {
    expect(nomeDoAnexo("https://x/simulador/1731840000000-ab12cd-Inventario-fotos.pdf")).toBe("Inventario-fotos.pdf");
    expect(
      nomeDoAnexo("https://x/simulador/0f8fad5b-d9cb-469f-a165-70867728950e-Inventario-fotos.pdf"),
    ).toBe("Inventario-fotos.pdf");
    expect(nomeDoAnexo("https://x/simulador/1731840000000-relatorio.pdf?v=1")).toBe("relatorio.pdf");
  });

  it("o nome guardado ganha sempre", () => {
    expect(nomeDoAnexo("https://x/123.pdf", "Inventario.pdf")).toBe("Inventario.pdf");
  });
});

describe("o cartão do PDF", () => {
  const ANEXO = ler("src/components/Anexo.tsx");

  it("é um link que abre noutro separador, com «Abrir PDF»", () => {
    const i = ANEXO.indexOf("export function CartaoDoDocumento");
    expect(i).toBeGreaterThan(-1);
    const cartao = ANEXO.slice(i, ANEXO.indexOf("export function Miniatura"));
    expect(cartao).toContain("<a");
    expect(cartao).toContain('target="_blank"');
    expect(cartao).toMatch(/rel="noopener[^"]*"/);
    expect(cartao).toContain("Abrir PDF");
    expect(cartao).toContain("FileText");
    expect(cartao).not.toContain("<img");
  });

  it("a Miniatura sem `onAbrir` entrega o PDF ao cartão ANTES de qualquer <img>", () => {
    const m = ANEXO.slice(ANEXO.indexOf("export function Miniatura"));
    const i = m.search(/if \(especie === "pdf" && !onAbrir\)/);
    expect(i).toBeGreaterThan(-1);
    expect(m.indexOf("<CartaoDoDocumento", i)).toBeGreaterThan(i);
    // A fotografia só entra no ramo da espécie «imagem».
    expect(m).toContain('especie === "imagem" ? (');
  });
});

describe("nenhum ecrã do pedido mete um PDF num <img>", () => {
  it("a página do pedido do cliente desenha os ficheiros pela Miniatura", () => {
    const V = ler("src/app/pedido/[token]/VistaDoPedido.tsx");
    expect(V).toContain("<Miniatura");
    expect(V).not.toContain("<img");
    expect(V).toContain("contagemDosAnexos(fotos)");
  });

  /*
   * Os ecrãs do backoffice tinham cada um a sua expressão regular de imagem.
   * Passam a decidir pela `especieDoAnexo` — uma regra só — e o PDF vai para o
   * cartão. Uma lista de extensões escrita à mão voltaria a divergir.
   */
  const BACKOFFICE = [
    "src/app/admin/pedidos/[id]/AdminPedidoDetalheClient.tsx",
    "src/components/admin/PedidoDetailModal.tsx",
  ];

  it.each(BACKOFFICE)("%s decide pela regra única e tem o cartão do PDF", (p) => {
    const F = ler(p);
    // A expressão própria que DECIDIA a imagem (`/\.(jpe?g|png…)$/i.test(url)`).
    // A que tira a extensão para o nome da transferência fica: não decide nada.
    expect(F).not.toMatch(/\/\\\.\(jpe\?g\|png[^/]*\$\/i\.test\(/);
    expect("const isImg = /\\.(jpe?g|png|gif|webp|avif|heic)$/i.test(url);").toMatch(
      /\/\\\.\(jpe\?g\|png[^/]*\$\/i\.test\(/,
    );
    expect(F).toContain('especieDoAnexo(url) === "imagem"');
    expect(F).toContain("<CartaoDoDocumento");
  });

  it.each(BACKOFFICE)("%s: cada <img> de um ficheiro está atrás de `isImg`", (p) => {
    const F = ler(p);
    const imgs = [...F.matchAll(/<img src=\{url\}|<img\s*\n\s*src=\{url\}/g)];
    expect(imgs.length).toBeGreaterThan(0);
    for (const m of imgs) {
      const antes = F.slice(Math.max(0, m.index! - 400), m.index!);
      expect(antes).toMatch(/isImg \? \(/);
    }
  });

  it("a prova nos Trabalhos CLYON passa pela Miniatura", () => {
    const T = ler("src/components/admin/TrabalhoClyon.tsx");
    expect(T).toContain("<Miniatura key={f} url={f}");
    expect(T).not.toContain('<img src={f}');
  });

  it("o visor e o painel do profissional já usavam a peça partilhada", () => {
    expect(ler("src/components/VisorDeFotos.tsx")).toContain("<AnexoGrande");
    expect(ler("src/app/profissionais/painel/Trabalhos.tsx")).toContain("<Miniatura");
  });
});
