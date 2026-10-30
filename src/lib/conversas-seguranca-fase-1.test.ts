import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { anfitriaoDoNossoBlob, urlDeAnexoDaConversa } from "./url-externo-seguro";
import { prepararMensagem } from "./conversas-da-clyon";
import { ALERTA_NUMERO_PARTIDO, ALERTA_PALAVRA } from "./filtro-de-contactos";

/** Segurança das Conversas, fase 1 (30-10-2026): M1 ligado, M2, M3, B1, B3. */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/** O código sem as linhas de comentário (regra ancorada ao início da linha). */
const semComentarios = (s: string) =>
  s
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");

const ENV = { BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_AbC123xyz_segredo" };
const NOSSO = "https://abc123xyz.public.blob.vercel-storage.com";

describe("M3 — anexos só do nosso store, só imagem ou PDF", () => {
  it("o anfitrião sai do token, do store id, ou da variável fixa", () => {
    expect(anfitriaoDoNossoBlob(ENV)).toBe("abc123xyz.public.blob.vercel-storage.com");
    expect(anfitriaoDoNossoBlob({ FOTOS_READ_WRITE_TOKEN: '"vercel_blob_rw_Zz9_x"' })).toBe(
      "zz9.public.blob.vercel-storage.com",
    );
    expect(anfitriaoDoNossoBlob({ BLOB_STORE_ID: "store_QwE7" })).toBe("qwe7.public.blob.vercel-storage.com");
    expect(anfitriaoDoNossoBlob({ ...ENV, CLYON_BLOB_HOST: "outro.public.blob.vercel-storage.com" })).toBe(
      "outro.public.blob.vercel-storage.com",
    );
    expect(anfitriaoDoNossoBlob({ CLYON_BLOB_HOST: "mal.example.com" })).toBeNull();
    expect(anfitriaoDoNossoBlob({})).toBeNull();
  });

  it.each(["foto.jpg", "foto.JPEG", "a/b.png", "x.webp", "IMG_1.heic", "orcamento.pdf"])("aceita %s", (f) => {
    expect(urlDeAnexoDaConversa(`${NOSSO}/${f}`, ENV)).toBe(`${NOSSO}/${f}`);
  });

  it.each([
    "https://outrapessoa.public.blob.vercel-storage.com/foto.jpg", // store de outra pessoa
    `${NOSSO}/pagina.html`,
    `${NOSSO}/script.svg`,
    `${NOSSO}/foto.jpg?download=1`,
    `${NOSSO}/semextensao`,
    "http://abc123xyz.public.blob.vercel-storage.com/foto.jpg",
    "javascript:alert(1)",
  ])("recusa %s", (u) => {
    expect(urlDeAnexoDaConversa(u, ENV)).toBeNull();
  });

  it("sem store configurado, nenhum anexo passa", () => {
    expect(urlDeAnexoDaConversa(`${NOSSO}/foto.jpg`, {})).toBeNull();
  });

  it("B1 — mais de 500 caracteres é recusado (a coluna é VARCHAR(500))", () => {
    const longo = `${NOSSO}/${"a".repeat(490)}.jpg`;
    expect(longo.length).toBeGreaterThan(500);
    expect(urlDeAnexoDaConversa(longo, ENV)).toBeNull();
  });

  it("a mensagem nova usa a regra da conversa", () => {
    const c = semComentarios(ler("src/lib/conversa-com-a-clyon.ts"));
    expect(c).toContain("anexoUrl = urlDeAnexoDaConversa(corpo.anexoUrl)");
  });
});

describe("M1 — o sinal para a equipa chega à mensagem guardada", () => {
  it("palavra de sinal numa conversa de pedido", () => {
    const r = prepararMensagem({ tipo: "pedido" }, { texto: "insta joaosilva_lx", anexoUrl: null });
    expect(r.alerta).toBe(ALERTA_PALAVRA);
    expect(r.filtrada).toBe(false);
  });
  it("telefone partido pelas mensagens anteriores", () => {
    const r = prepararMensagem({ tipo: "pedido" }, { texto: "5678", anexoUrl: null }, ["91234"]);
    expect(r.alerta).toBe(ALERTA_NUMERO_PARTIDO);
  });
  it("no suporte não há filtro nem sinal", () => {
    expect(prepararMensagem({ tipo: "suporte_cliente" }, { texto: "insta x", anexoUrl: null }, []).alerta).toBeNull();
  });
  it("a rota passa as anteriores do mesmo autor, a base grava o alerta e a equipa vê-o", () => {
    const rota = semComentarios(ler("src/app/api/conversas/[id]/mensagens/route.ts"));
    expect(rota).toContain("textosAnterioresDoAutor(c.id, autor, autorId, 2)");
    expect(rota).toContain("prepararMensagem(c, lida, anteriores)");
    const base = semComentarios(ler("src/lib/conversas-na-base.ts"));
    expect(base).toContain("ADD COLUMN alerta VARCHAR(120)");
    expect(base).toMatch(/INSERT INTO mensagensDaConversa \([^)]*alerta/);
    expect(semComentarios(ler("src/app/api/admin/suporte/clientes/[id]/route.ts"))).toContain("alerta: m.alerta");
    expect(ler("src/components/admin/AdminSuporteClientesPanel.tsx")).toContain("{m.alerta && (");
  });
});

describe("M2 — conta apagada leva as conversas", () => {
  const base = semComentarios(ler("src/lib/conversas-na-base.ts"));
  const i = base.indexOf("export async function apagarConversasDaConta(");
  const corpo = base.slice(i, base.indexOf("\n}\n", i));

  it("apaga a Suporte CLYON e anonimiza as de pedido", () => {
    expect(i).toBeGreaterThan(-1);
    expect(corpo).toContain("DELETE FROM conversas WHERE tipo = 'suporte_cliente' AND clienteContaId = ?");
    expect(corpo).toMatch(/UPDATE mensagensDaConversa SET texto = \?, textoOriginal = NULL[^"]*autor = 'cliente'/);
    expect(corpo).toContain("MENSAGEM_REMOVIDA");
    expect(corpo).toContain("UPDATE conversas SET clienteContaId = NULL");
    expect(base).toContain('MENSAGEM_REMOVIDA = "[mensagem removida]"');
  });

  it("corre nos três caminhos que apagam ou desactivam a conta", () => {
    const db = semComentarios(ler("src/lib/db.ts"));
    const c = db.slice(db.indexOf("export async function apagarContaDeCliente("));
    const fim = c.indexOf("\nexport ");
    expect(c.slice(0, fim)).toContain("apagarConversasDaConta(id)");
    const adm = semComentarios(ler("src/app/api/admin/users/route.ts"));
    const del = adm.slice(adm.indexOf("export async function DELETE"), adm.indexOf("export async function PATCH"));
    expect(del).toContain("await apagarConversasDaConta(id)");
    const patch = adm.slice(adm.indexOf("export async function PATCH"));
    expect(patch).toContain("await apagarConversasDaConta(Number(id))");
  });
});

describe("B3 — a lista do backoffice só mostra suportes com mensagens", () => {
  it("suportesDosClientes filtra pela última mensagem", () => {
    const base = semComentarios(ler("src/lib/conversas-na-base.ts"));
    const i = base.indexOf("export async function suportesDosClientes(");
    expect(base.slice(i, i + 400)).toContain("c.ultimaMensagemEm IS NOT NULL");
  });
});
