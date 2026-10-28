import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

import { middleware } from "@/middleware";
import { pedirNoSimulador, servicoDaLigacao } from "./servico-na-ligacao";

/**
 * O PEDIDO CONTA NO GOOGLE ADS — 28-10-2026 (decisão d2).
 *
 * A conversão do Google Ads é o pedido registado, e conta-se no /simulador.
 * Quem chega do anúncio entra na página de chegada com o gclid no endereço.
 * Sem o «Aceitar» não há cookie (modo avançado do Consent Mode), e o gclid
 * ficava na página de chegada: o pedido nascia noutra página, sem ele, e o
 * Google não o conseguia ligar ao anúncio. Os cliques no WhatsApp contavam
 * (são na própria página de chegada); os pedidos nunca.
 *
 * O `url_passthrough` faz o gtag levar o gclid (e o gbraid e o wbraid) nas
 * ligações internas, sem cookies. Este teste guarda a linha, e que o
 * simulador e o middleware aguentam os parâmetros que o Google acrescenta.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const RASTREIO = ler("src/components/RastreioConsentido.tsx");

/** Os parâmetros que o Google acrescenta a uma ligação, no anúncio ou pelo passthrough. */
const DO_GOOGLE = "gclid=TESTE_gclid-123&gclsrc=aw.ds&gbraid=0AAAAAB-teste&wbraid=CkQKCQ-teste&_gl=1*abc*_gcl_au*MTIz";

describe("o gtag leva o clique do anúncio entre páginas", () => {
  it("liga o url_passthrough", () => {
    expect(RASTREIO).toContain("gtag('set', 'url_passthrough', true);");
  });

  it("antes de configurar o Ads e o GA4, e depois do «default» negado", () => {
    const passthrough = RASTREIO.indexOf("gtag('set', 'url_passthrough', true);");
    const negado = RASTREIO.indexOf("gtag('consent', 'default'");
    const primeiroConfig = RASTREIO.indexOf("gtag('config'");
    expect(negado).toBeGreaterThan(-1);
    expect(primeiroConfig).toBeGreaterThan(-1);
    expect(passthrough).toBeGreaterThan(negado);
    expect(passthrough).toBeLessThan(primeiroConfig);
  });

  it("no mesmo arranque que corre em todas as páginas sem segredo", () => {
    const i = RASTREIO.indexOf('<Script id="gtag-init" strategy="afterInteractive">');
    const f = RASTREIO.indexOf("</Script>", i);
    expect(i).toBeGreaterThan(-1);
    expect(RASTREIO.slice(i, f)).toContain("gtag('set', 'url_passthrough', true);");
  });
});

describe("o simulador aguenta o que o Google acrescenta ao endereço", () => {
  it("o serviço do link continua a valer com o gclid, o gbraid e o wbraid ao lado", () => {
    expect(servicoDaLigacao(`?servico=mudanca&${DO_GOOGLE}`)).toBe("mudanca");
    expect(servicoDaLigacao(`?${DO_GOOGLE}&servico=recolha-entulho`)).toBe("recolha_entulho");
    expect(servicoDaLigacao(`?gclid=X&categoria=monos&wbraid=Y`)).toBe("recolha_monos");
  });

  it("sem serviço no link, o gclid sozinho não escolhe nada", () => {
    expect(servicoDaLigacao(`?${DO_GOOGLE}`)).toBeNull();
  });

  it("o botão «Pedir orçamento» não mudou: o passthrough acrescenta-lhe os parâmetros, não os tira", () => {
    expect(pedirNoSimulador("mudanca")).toBe("/simulador?servico=mudanca");
    expect(pedirNoSimulador(null)).toBe("/simulador");
  });
});

describe("o middleware deixa passar os parâmetros do Google", () => {
  async function noMiddleware(endereco: string) {
    const r = await middleware(new NextRequest(endereco));
    return { status: r.status, para: r.headers.get("location") };
  }

  for (const caminho of [
    `/orcamento-recolha-lisboa?${DO_GOOGLE}`,
    `/simulador?${DO_GOOGLE}`,
    `/simulador?servico=mudanca&${DO_GOOGLE}`,
  ]) {
    it(`${caminho.split("?")[0]} abre sem redireccionar`, async () => {
      expect(await noMiddleware(`https://clyon.pt${caminho}`)).toEqual({ status: 200, para: null });
    });
  }

  it("o salto para o domínio sem www leva os parâmetros com ele", async () => {
    const r = await noMiddleware(`https://www.clyon.pt/orcamento-recolha-lisboa?${DO_GOOGLE}`);
    expect(r.status).toBe(301);
    const para = new URL(r.para!);
    expect(para.host).toBe("clyon.pt");
    expect(para.pathname).toBe("/orcamento-recolha-lisboa");
    expect(para.searchParams.get("gclid")).toBe("TESTE_gclid-123");
    expect(para.searchParams.get("gbraid")).toBe("0AAAAAB-teste");
    expect(para.searchParams.get("wbraid")).toBe("CkQKCQ-teste");
  });
});
