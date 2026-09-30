import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A POLÍTICA DE SEGURANÇA SÓ ABRE O QUE O BROWSER USA.
 *
 * O `connect-src` tinha o Gemini, a Resend e a Upstash — serviços que só o
 * servidor chama, e a CSP não se aplica ao servidor. Na lista, só serviam
 * para um script injectado na página ter para onde mandar os dados. E faltava
 * o `frame-ancestors`, a forma moderna de dizer quem pode pôr o site numa
 * moldura.
 */

const CFG = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
const SO_DO_SERVIDOR = ["upstash.io", "api.resend.com", "generativelanguage.googleapis.com"];

function linha(diretiva: string): string {
  const i = CFG.indexOf(`"${diretiva}`);
  expect(i, `${diretiva} não encontrado`).toBeGreaterThan(-1);
  return CFG.slice(i, CFG.indexOf('",', i));
}

function ficheiros(pasta: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) saida.push(...ficheiros(caminho));
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

describe("connect-src", () => {
  it("não abre o que só o servidor chama", () => {
    const connect = linha("connect-src");
    for (const host of SO_DO_SERVIDOR) {
      expect(connect, host).not.toContain(host);
    }
  });

  it("e nenhum código do browser os chama — foi isso que permitiu tirá-los", () => {
    const doBrowser = ficheiros(join(process.cwd(), "src"))
      .map((f) => ({ f, fonte: readFileSync(f, "utf8") }))
      .filter(({ fonte }) => /^\s*["']use client["']/.test(fonte));
    expect(doBrowser.length).toBeGreaterThan(20);
    for (const { f, fonte } of doBrowser) {
      for (const host of SO_DO_SERVIDOR) {
        expect(fonte, `${f} chama ${host}`).not.toContain(host);
      }
    }
  });

  it("mantém o envio directo de ficheiros, que corre no browser", () => {
    const connect = linha("connect-src");
    expect(connect).toContain("https://vercel.com");
    expect(connect).toContain("https://blob.vercel-storage.com");
  });
});

describe("frame-ancestors", () => {
  it("só o próprio site põe o site numa moldura", () => {
    expect(CFG).toContain(`"frame-ancestors 'self'"`);
  });
});
