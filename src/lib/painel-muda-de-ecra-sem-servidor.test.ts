import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O PAINEL DO PROFISSIONAL MUDA DE ECRÃ SEM IR AO SERVIDOR — 07-10-2026.
 *
 * «Estou em Os meus trabalhos e clico para a Agenda, mas ele não vai de
 * imediato; clico várias vezes e nada muda, e só após 10 s vai sozinho.» E na
 * consola, a cada recarregar, o «Minified React error #418».
 *
 * Duas causas, duas guardas:
 *
 *   · cada ecrã era um `router.push`, que numa página dinâmica vai buscar a
 *     página ao servidor e deixa o ecrã parado até ela chegar;
 *   · o servidor desenhava a roda e o browser, com a fotografia do
 *     `sessionStorage`, desenhava logo os trabalhos — duas páginas diferentes.
 *
 * Provado a 07-10-2026 com o painel verdadeiro: desenhado com `renderToString`
 * e acordado com `hydrateRoot` e uma fotografia guardada, a versão antiga dava
 * o #418 e esta não dá erro nenhum.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
// Só os comentários que começam a linha — os que vêm depois de código ficam.
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const PAINEL = semNotas(ler("src/app/profissionais/painel/PainelDoProfissional.tsx"));

describe("mudar de ecrã não espera pelo servidor", () => {
  it("o endereço muda pelo `history.pushState`, que o Next acompanha sem pedido nenhum", () => {
    const i = PAINEL.indexOf("function irPara(endereco: string) {");
    expect(i).toBeGreaterThan(-1);
    const corpo = PAINEL.slice(i, PAINEL.indexOf("\n}\n", i));
    expect(corpo).toContain('window.history.pushState(null, "", endereco);');
    // E abre do princípio, como o router fazia — sem o deslizar suave do site.
    expect(corpo).toContain('window.scrollTo({ top: 0, behavior: "instant" });');
  });

  it("abrir um ecrã, abrir um trabalho e voltar passam todos por lá", () => {
    expect(PAINEL).toContain("irPara(`/profissionais/painel?ecra=${destino}`);");
    const i = PAINEL.indexOf("function abrirTrabalho(negociacaoId: number | null) {");
    expect(PAINEL.slice(i, i + 200)).toContain("irPara(");
    const v = PAINEL.indexOf("const voltar = useCallback(");
    const voltar = PAINEL.slice(v, PAINEL.indexOf("}, [", v));
    expect(voltar).toContain('irPara("/profissionais/painel?ecra=trabalhos");');
    expect(voltar).toContain('irPara("/profissionais/painel?ecra=menu");');
  });

  it("nenhum caminho de dentro do painel volta ao `router.push`", () => {
    // O router fica só para sair do painel — a entrada é outra página.
    expect(PAINEL).not.toMatch(/router\.(push|replace)\(\s*[`"']\/profissionais\/painel/);
    expect(PAINEL).toContain('router.push("/profissionais/entrar");');
  });
});

describe("o primeiro desenho no browser é o do servidor", () => {
  it("até o React acordar a página, os dois desenham a mesma roda", () => {
    expect(PAINEL).toContain("export default function PainelDoProfissional() {");
    expect(PAINEL).toContain("useSyncExternalStore(");
    // No servidor (e ao acordar a página) é `false`; no browser, `true`.
    expect(PAINEL).toMatch(/useSyncExternalStore\(\s*semAvisos,\s*\(\) => true,\s*\(\) => false,\s*\)/);
    expect(PAINEL).toContain("return noBrowser ? <PainelNoBrowser /> : <Roda />;");
  });

  it("a fotografia só se lê depois disso, dentro do painel do browser", () => {
    const browser = PAINEL.indexOf("function PainelNoBrowser() {");
    const fotografia = PAINEL.indexOf("lerFotografia<Fotografia>(CHAVE_DO_PAINEL)");
    expect(browser).toBeGreaterThan(-1);
    expect(fotografia).toBeGreaterThan(browser);
    // E não há outra leitura dela antes, onde o servidor também passa (o
    // `import` fica lá em cima, e esse não lê nada).
    expect(PAINEL.slice(0, browser)).not.toMatch(/lerFotografia\s*[<(]/);
  });

  it("a roda de quem ainda não tem fotografia é a mesma do servidor", () => {
    expect(PAINEL).toContain("if (aCarregar) return <Roda />;");
    expect(PAINEL.match(/animate-spin/g)?.length).toBe(1);
  });
});
