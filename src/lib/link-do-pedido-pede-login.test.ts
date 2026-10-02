import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { destinoInterno } from "@/lib/destino-seguro";

/**
 * O LINK DO PEDIDO JÁ NÃO CHEGA SOZINHO — 02-10-2026, decisão do dono:
 * «tudo com login».
 *
 * O link que vai ao profissional por WhatsApp e email levava um código que
 * valia por si: quem o tivesse via o pedido e propunha em nome dele. Agora o
 * código diz qual é a negociação e a sessão diz quem está a ver. Quem marcou
 * «manter-me ligado» não volta a entrar: a sessão dura e renova-se.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("a página do pedido do profissional", () => {
  const PAGINA = semComentarios(ler("src/app/profissionais/pedidos/[token]/page.tsx"));

  it("pede a sessão do profissional antes de mostrar o pedido", () => {
    const sessao = PAGINA.indexOf("sessaoActivaDoProfissional(");
    const pedido = PAGINA.indexOf("getSimulatorOrderById(negociacao.pedidoId)");
    expect(sessao).toBeGreaterThan(-1);
    expect(pedido).toBeGreaterThan(sessao);
  });

  it("sem sessão vai entrar e volta ao mesmo pedido", () => {
    expect(PAGINA).toMatch(/redirect\(`\/profissionais\/entrar\?destino=\$\{encodeURIComponent\(/);
  });

  it("com a sessão de outro profissional não mostra o pedido", () => {
    expect(PAGINA).toContain("Number(sessao.providerId) !== Number(negociacao.providerId)");
  });
});

describe("a rota das respostas", () => {
  const ROTA = semComentarios(ler("src/app/api/negociacao/[token]/route.ts"));

  it("do lado do profissional, exige a sessão dele", () => {
    const i = ROTA.indexOf('lado = "profissional"');
    const antes = ROTA.slice(0, i);
    expect(i).toBeGreaterThan(-1);
    expect(antes).toContain("sessaoActivaDoProfissional(");
    expect(antes).toContain("Number(sessao.providerId) !== Number(doProfissional.providerId)");
  });
});

describe("depois de entrar", () => {
  const ORIGEM = "https://clyon.pt";

  it("volta ao link do pedido", () => {
    expect(destinoInterno("/profissionais/pedidos/abc", ORIGEM, "/profissionais/painel")).toBe(
      "/profissionais/pedidos/abc",
    );
  });

  it("um destino de fora vai para o painel", () => {
    expect(destinoInterno("https://evil.com/x", ORIGEM, "/profissionais/painel")).toBe(
      "/profissionais/painel",
    );
    expect(destinoInterno("//evil.com", ORIGEM, "/profissionais/painel")).toBe("/profissionais/painel");
  });

  it("o formulário de entrada usa o destino validado", () => {
    expect(ler("src/app/profissionais/entrar/EntrarForm.tsx")).toContain("destinoInterno(");
  });
});
