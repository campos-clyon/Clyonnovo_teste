import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O CABEÇALHO DA ÁREA DO PROFISSIONAL — 07-10-2026.
 *
 * «Adapte o menu do topo ao backoffice dos pros: o WhatsApp, por exemplo, não
 * devia lá estar.» O painel e a página de um pedido levavam o cabeçalho dos
 * clientes, com o botão verde que abre uma conversa a pedir um orçamento.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
// Só os comentários que começam a linha — os que vêm depois de código ficam.
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const CHROME = semNotas(ler("src/components/SiteChrome.tsx"));
const CABECALHO = semNotas(ler("src/components/portal/CabecalhoDoProfissional.tsx"));

describe("o painel e os pedidos do profissional têm cabeçalho próprio", () => {
  it("nas duas rotas de trabalho dele", () => {
    expect(CHROME).toContain('const ROTAS_DO_PROFISSIONAL = ["/profissionais/painel", "/profissionais/pedidos"];');
    expect(CHROME).toContain("{doProfissional ? <CabecalhoDoProfissional /> : <Header />}");
  });

  it("sem o WhatsApp, a localização e o menu dos clientes", () => {
    for (const fora of ["wa.me", "WhatsApp", "HeaderLocationSelector", "Soluções", "/avaliacoes", "/contactos", "/trabalhos"]) {
      expect(CABECALHO, fora).not.toContain(fora);
    }
  });

  it("o logótipo leva ao painel", () => {
    expect(CABECALHO).toContain('href="/profissionais/painel"');
  });

  it("com a altura do cabeçalho do site, que é a que o conteúdo desconta", () => {
    // `--altura-do-menu` (53 / 61 px) sai de py-2.5 + logótipo h-8 / sm:h-10 + borda.
    expect(CABECALHO).toContain("py-2.5");
    expect(CABECALHO).toContain('className="h-8 w-auto sm:h-10"');
    expect(CABECALHO).toContain("border-b");
  });

  it("e sem cores em hexadecimal, que o modo escuro não converteria", () => {
    expect(CABECALHO).not.toMatch(/(bg|text|border)-\[#/);
  });
});
