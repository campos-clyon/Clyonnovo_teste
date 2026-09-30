import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Ligações e imagens que o público via partidas.
 *
 *   · /profissionais responde 404 a quem não tem a chave do MVP — e era para
 *     lá que iam o "Inscreva-se aqui" e o "Ver como funciona";
 *   · wa.me/351 + um número que já trazia o 351 abria o WhatsApp num número
 *     que não existe;
 *   · /og-image.jpg estava no layout, no Twitter e no JSON-LD, e não existia;
 *   · a imagem da galeria dava 404 sempre que a base soluçava.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

function ficheirosDe(pasta: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) saida.push(...ficheirosDe(caminho));
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.ts$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

describe("as portas para quem se quer inscrever", () => {
  it("o login do profissional manda a inscrição para a página pública", () => {
    const FORM = ler("src/app/profissionais/entrar/EntrarForm.tsx");
    expect(FORM).toContain('<Link href="/quero-ser-parceiro"');
    expect(FORM).not.toContain('href="/profissionais"');
  });

  it("o «ver como funciona» da candidatura fica na mesma página", () => {
    const FORM = ler("src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx");
    expect(FORM).toContain('href="/quero-ser-parceiro#como-funciona"');
    expect(FORM).not.toContain('href="/profissionais"');
    expect(ler("src/app/quero-ser-parceiro/page.tsx")).toContain('id="como-funciona"');
  });
});

describe("o wa.me com o 351 repetido", () => {
  it("nenhum ficheiro volta a pôr 351 à frente de um número que o pode já trazer", () => {
    const culpados = ficheirosDe(join(RAIZ, "src"))
      .filter((f) => /wa\.me\/351\$\{/.test(readFileSync(f, "utf8")))
      .map((f) => relative(RAIZ, f));
    expect(culpados).toEqual([]);
  });

  it("as avaliações usam o número como está", () => {
    expect(ler("src/app/avaliacoes/page.tsx")).toContain(
      '`https://wa.me/${BUSINESS_PHONE.replace(/\\D/g, "")}?text=',
    );
  });
});

describe("a imagem de partilha", () => {
  /** Largura e altura de um JPEG, lidas do marcador SOF — sem dependências. */
  function tamanhoDoJpeg(buf: Buffer): { largura: number; altura: number } | null {
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marcador = buf[i + 1];
      const comprimento = buf.readUInt16BE(i + 2);
      if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
        return { altura: buf.readUInt16BE(i + 5), largura: buf.readUInt16BE(i + 7) };
      }
      i += 2 + comprimento;
    }
    return null;
  }

  it("existe, e tem o tamanho que o layout anuncia (1200×630)", () => {
    const caminho = join(RAIZ, "public", "og-image.jpg");
    expect(existsSync(caminho)).toBe(true);
    expect(tamanhoDoJpeg(readFileSync(caminho))).toEqual({ largura: 1200, altura: 630 });
    const LAYOUT = ler("src/app/layout.tsx");
    // O endereço passou do layout para `IMAGEM_DE_PARTILHA` (open-graph.ts),
    // que o layout e todas as páginas usam — 30-09-2026.
    expect(readFileSync(join(RAIZ, "src", "lib", "open-graph.ts"), "utf8")).toContain('url: "/og-image.jpg"');
    expect(LAYOUT).toContain("IMAGEM_DE_PARTILHA");
    const OG = readFileSync(join(RAIZ, "src", "lib", "open-graph.ts"), "utf8");
    expect(OG).toContain("width: 1200");
    expect(OG).toContain("height: 630");
  });
});

describe("a imagem da galeria quando a base falha", () => {
  const ROTA = ler("src/app/api/media/gallery/render/[id]/route.ts");
  const GALERIA = ler("src/lib/work-gallery.ts");

  it("lê só o item pedido, e uma falha da base dá 503 e não 404", () => {
    expect(ROTA).toContain("item = await lerItemDaGaleria(id);");
    expect(ROTA).not.toContain("listGalleryItems()");
    expect(ROTA).toContain("status: 503");
    expect(ROTA).toContain('"Retry-After": "30"');
    expect(ROTA).toContain('"Cache-Control": "no-store"');
    expect(ler("src/lib/db.ts")).toContain("export async function getGalleryMediaItemById(id: string)");
  });

  it("alterar a galeria nunca parte da de omissão", () => {
    // Gravar por cima dela apagava as imagens reais todas.
    expect((GALERIA.match(/readGalleryData\(\{ estrito: true \}\)/g) ?? []).length).toBe(3);
    expect(GALERIA).toContain("if (opcoes.estrito) throw erro;");
  });
});
