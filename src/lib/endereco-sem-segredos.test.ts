import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  enderecoSemSegredos,
  temSegredoNoEndereco,
  ROTAS_COM_SEGREDO,
} from "./endereco-sem-segredos";

/**
 * O Google Analytics 4, e o token que não pode ir com ele.
 *
 * Seis rotas do site trazem uma credencial dentro do endereço — é assim que
 * o cliente sem conta abre o pedido dele. O gtag manda o endereço inteiro
 * para o Google; sem redigir, cada visita a um pedido escrevia a chave desse
 * pedido num relatório do Analytics, legível e clicável por quem lá tenha
 * acesso.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const RASTREIO = ler("src/components/RastreioConsentido.tsx");
const CONFIG = ler("next.config.ts");

describe("o token nunca vai no endereço", () => {
  it("troca o token pela palavra TOKEN em todas as seis rotas", () => {
    for (const rota of ROTAS_COM_SEGREDO) {
      const comSegredo = `https://clyon.pt${rota}a1b2c3d4e5f6`;
      expect(enderecoSemSegredos(comSegredo)).toBe(`https://clyon.pt${rota}TOKEN`);
    }
  });

  it("as seis rotas são as que têm [token] no ficheiro de páginas", () => {
    // Se nascer uma sétima rota com token e ninguém a puser na lista, o
    // token dela passa a viajar em silêncio.
    expect(ROTAS_COM_SEGREDO).toContain("/pedido/");
    expect(ROTAS_COM_SEGREDO).toContain("/orcamento/");
    expect(ROTAS_COM_SEGREDO).toContain("/admin/aprovar/");
    expect(ROTAS_COM_SEGREDO).toContain("/profissionais/pedidos/");
    expect(ROTAS_COM_SEGREDO).toContain("/profissionais/definir-senha/");
    expect(ROTAS_COM_SEGREDO).toContain("/profissionais/inscricao/");
  });

  it("deixa em paz o resto do site", () => {
    expect(enderecoSemSegredos("https://clyon.pt/simulador")).toBe(
      "https://clyon.pt/simulador",
    );
    expect(enderecoSemSegredos("https://clyon.pt/mudancas/lisboa")).toBe(
      "https://clyon.pt/mudancas/lisboa",
    );
    // A rota sem token nenhum não é a rota com token: não se toca.
    expect(enderecoSemSegredos("https://clyon.pt/pedido/")).toBe(
      "https://clyon.pt/pedido/",
    );
  });

  it("a chave do portão do MVP e um ?token= também não viajam", () => {
    expect(enderecoSemSegredos("https://clyon.pt/profissionais/entrar?chave=vUyd")).toBe(
      "https://clyon.pt/profissionais/entrar",
    );
    expect(enderecoSemSegredos("https://clyon.pt/x?token=abc&cidade=almada")).toBe(
      "https://clyon.pt/x?cidade=almada",
    );
  });

  it("um endereço ilegível devolve vazio — nunca o original", () => {
    // Se não se percebe o endereço, também não se percebe o que nele é
    // segredo. Perder um número de estatística é melhor do que revelar uma
    // chave.
    expect(enderecoSemSegredos("isto não é um endereço")).toBe("");
    expect(enderecoSemSegredos("")).toBe("");
  });
});

describe("nas páginas com token não entra medição nenhuma", () => {
  it("reconhece as páginas que trazem a credencial no endereço", () => {
    expect(temSegredoNoEndereco("/pedido/abc123")).toBe(true);
    expect(temSegredoNoEndereco("/profissionais/pedidos/xyz")).toBe(true);
    expect(temSegredoNoEndereco("/admin/aprovar/k")).toBe(true);
    // Sem token a seguir, é só a rota — e não há segredo nenhum.
    expect(temSegredoNoEndereco("/pedido/")).toBe(false);
    expect(temSegredoNoEndereco("/simulador")).toBe(false);
    expect(temSegredoNoEndereco("/")).toBe(false);
  });

  it("o gtag não carrega lá — redigir o page_location não chegava", () => {
    // Provado no browser: mesmo com page_location redigido, o tag do Google
    // Ads faz o pedido dele (ccm/collect?dl=…) a partir do location do
    // browser, e o endereço verdadeiro ia na mesma. Contra isso só vale não
    // pôr lá o script.
    expect(RASTREIO).toContain("temSegredoNoEndereco(window.location.pathname)");
    expect(RASTREIO).toContain("consentimento.marketing && !paginaComSegredo");
    expect(RASTREIO).toContain("consentimento.analytics && !paginaComSegredo");
  });
});

describe("o GA4 no site", () => {
  it("vive debaixo da escolha «analytics», não da de marketing", () => {
    expect(RASTREIO).toContain("const querGa4 = consentimento.analytics");
    expect(RASTREIO).toContain("const querAds = consentimento.marketing");
  });

  it("nada carrega antes de haver decisão", () => {
    expect(RASTREIO).toContain("if (!consentimento) return null;");
  });

  it("os dois destinos recebem o endereço já redigido", () => {
    expect(RASTREIO).toContain("enderecoSemSegredos(window.location.href)");
    expect(RASTREIO).toContain("enderecoSemSegredos(document.referrer)");
    expect(RASTREIO).toContain("gtag('config', '${GOOGLE_ADS_ID}', ${oQueSeDiz});");
    expect(RASTREIO).toContain("gtag('config', '${GA4_ID}', ${oQueSeDiz});");
  });

  it("a biblioteca do gtag pede-se uma vez só, para os dois", () => {
    expect(RASTREIO).toContain("const idDeArranque = querAds ? GOOGLE_ADS_ID : GA4_ID;");
  });

  it("a CSP deixa o Analytics ENVIAR, e não só carregar", () => {
    const connect = CONFIG.slice(CONFIG.indexOf('"connect-src'), CONFIG.indexOf('"frame-src'));
    expect(connect).toContain("https://www.google-analytics.com");
    expect(connect).toContain("https://*.google-analytics.com");
  });

  it("a CSP deixa entrar o script do Vercel Analytics", () => {
    // Faltava, e os dois scripts do Vercel eram recusados em toda a visita —
    // medição a contar zero, com o erro só na consola.
    const script = CONFIG.slice(CONFIG.indexOf('"script-src'), CONFIG.indexOf('"style-src'));
    expect(script).toContain("https://va.vercel-scripts.com");
  });

  it("a CSP deixa as conversões do Google Ads sair — nunca saíram até agora", () => {
    const connect = CONFIG.slice(CONFIG.indexOf('"connect-src'), CONFIG.indexOf('"frame-src'));
    const img = CONFIG.slice(CONFIG.indexOf('"img-src'), CONFIG.indexOf('"connect-src'));
    for (const bloco of [connect, img]) {
      expect(bloco).toContain("https://www.google.com");
      expect(bloco).toContain("https://*.doubleclick.net");
    }
  });
});
