import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { podeOptimizar } from "./fotografia-no-tamanho";

/**
 * A VELOCIDADE NO TELEMÓVEL — 07-10-2026.
 *
 * «Melhore os números para Portugal.» No Speed Insights (telemóveis em
 * Portugal, 7 dias) a nota era 82, puxada para baixo pelas rotas de quem
 * trabalha: o painel do profissional (68, 791 visitas), o pedido pelo link
 * (40) e a conta do cliente (36). As páginas públicas estavam a 100.
 *
 * Medido no painel verdadeiro, com 250 trabalhos e o processador quatro
 * vezes mais lento: o que mais pesava eram formatadores de datas criados a
 * cada chamada (mais de um segundo), fotografias inteiras em quadrados de
 * 112 px, e 67 KB da `jose` que só serve no servidor. Estes testes guardam o
 * que se corrigiu.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
// Só os comentários que começam a linha — os que vêm depois de código ficam.
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("os formatadores de datas fazem-se uma vez", () => {
  const MODULOS = ["src/lib/quando-e-o-trabalho.ts", "src/lib/agenda-dos-trabalhos.ts", "src/lib/hora-de-lisboa.ts"];

  it.each(MODULOS)("%s não cria nenhum dentro de uma função", (f) => {
    const linhas = semNotas(ler(f)).split("\n");
    const criados = linhas.filter((l) => l.includes("new Intl.DateTimeFormat("));
    expect(criados.length).toBeGreaterThan(0);
    // Cada um nasce numa constante do módulo, encostada à margem.
    for (const l of criados) expect(l, f).toMatch(/^const [A-Z_]+ = new Intl\.DateTimeFormat\(/);
  });
});

describe("as fotografias pedem-se no tamanho em que se mostram", () => {
  it("só as do nosso armazenamento passam pelo optimizador", () => {
    expect(podeOptimizar("https://abc123.public.blob.vercel-storage.com/simulador/sofa.jpg")).toBe(true);
    // Uma pré-visualização local, outro sítio, ou um disfarce: como vêm.
    expect(podeOptimizar("blob:https://clyon.pt/1234")).toBe(false);
    expect(podeOptimizar("data:image/png;base64,AAAA")).toBe(false);
    expect(podeOptimizar("http://abc.public.blob.vercel-storage.com/x.jpg")).toBe(false);
    expect(podeOptimizar("https://abc.public.blob.vercel-storage.com.evil.pt/x.jpg")).toBe(false);
    expect(podeOptimizar("https://evil.pt/abc.public.blob.vercel-storage.com/x.jpg")).toBe(false);
    expect(podeOptimizar(null)).toBe(false);
  });

  it("e o optimizador do site autoriza esse armazenamento", () => {
    // Se o `remotePatterns` deixasse de o ter, o optimizador dava 400 — e a
    // `Miniatura` caía no original, que é o que se queria evitar.
    expect(ler("next.config.ts")).toContain('hostname: "**.public.blob.vercel-storage.com"');
  });

  it("a Miniatura usa o optimizador do Next, e volta ao original se ele falhar", () => {
    const A = semNotas(ler("src/components/Anexo.tsx"));
    expect(A).toContain('import { getImageProps } from "next/image";');
    expect(A).toContain("onError={() => setOriginal(true)}");
    expect(A).toContain('loading={prioridade ? "eager" : "lazy"}');
  });

  it("a lista do painel pede 112 px, e o carrossel abre pela primeira com prioridade", () => {
    const T = semNotas(ler("src/app/profissionais/painel/Trabalhos.tsx"));
    expect(T).toContain('className="h-28 w-28" tamanho="112px"');
    expect(T).toContain("prioridade={i === 0}");
  });

  it("os ecrãs que mostravam o original com <img> passaram à Miniatura", () => {
    expect(ler("src/app/conta/components/OrderDetailModal.tsx")).not.toContain("<img");
  });
});

describe("o código do servidor não vai para o telemóvel", () => {
  /** Todos os ficheiros "use client" debaixo de `src`. */
  function doCliente(dir: string, fora: string[] = []): string[] {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) doCliente(p, fora);
      else if (/\.tsx?$/.test(nome) && !nome.endsWith(".test.ts")) {
        const s = readFileSync(p, "utf8");
        if (/^\s*["']use client["']/.test(s)) fora.push(p);
      }
    }
    return fora;
  }

  it("nenhum ecrã do browser importa a autenticação do profissional (`jose`, `bcryptjs`)", () => {
    const culpados = doCliente(join(process.cwd(), "src")).filter((p) =>
      /from ["']@\/lib\/profissional-auth["']/.test(readFileSync(p, "utf8")),
    );
    expect(culpados).toEqual([]);
  });

  it("o mínimo da palavra-passe vive à parte, e a autenticação reexporta-o", () => {
    expect(ler("src/lib/palavra-passe-minima.ts")).toContain("export const MINIMO_DA_PALAVRA_PASSE = 10;");
    expect(ler("src/lib/profissional-auth.ts")).toContain("export { MINIMO_DA_PALAVRA_PASSE };");
  });

  it("o cliente do armazenamento só se carrega quando há um ficheiro a enviar", () => {
    const E = semNotas(ler("src/lib/enviar-ficheiro.ts"));
    expect(E).not.toMatch(/^import .*@vercel\/blob\/client/m);
    expect(E).toContain('await import("@vercel/blob/client")');
  });
});

describe("o pedido pelo link não espera por uma leitura atrás da outra", () => {
  const P = semNotas(ler("src/app/profissionais/pedidos/[token]/page.tsx"));

  it("o pedido, a sessão e a tabela de preços partem juntos", () => {
    const tabela = P.indexOf("const tabelaDePrecos = getActivePricingMap();");
    const juntos = P.indexOf("await Promise.all([\n    negociacaoPorTokenHash(");
    expect(tabela).toBeGreaterThan(-1);
    expect(juntos).toBeGreaterThan(tabela);
    expect(P.slice(juntos, juntos + 300)).toContain("sessaoActivaDoProfissional(");
  });

  it("os custos dele lêem-se ao mesmo tempo que o pedido — e só depois da sessão certa", () => {
    const sessaoCerta = P.indexOf("Number(sessao.providerId) !== Number(negociacao.providerId)");
    const custos = P.indexOf("const custosDele = custosEBaseDoProfissional(");
    const pedido = P.indexOf("await getSimulatorOrderById(negociacao.pedidoId)");
    expect(sessaoCerta).toBeGreaterThan(-1);
    expect(custos).toBeGreaterThan(sessaoCerta);
    expect(pedido).toBeGreaterThan(custos);
    // Uma falha nos custos continua a só tirar a sugestão.
    expect(P).toContain('if ("erro" in lidos) throw lidos.erro;');
  });
});
