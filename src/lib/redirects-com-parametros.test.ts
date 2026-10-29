import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "@/middleware";
import nextConfig from "../../next.config";

/**
 * OS REDIRECTS LEVAM OS PARÂMETROS DO ENDEREÇO — 28-10-2026.
 *
 * Os do middleware (as /Regiões/* antigas e as /mudancas-<cidade>) montavam
 * o destino com `new URL("/x", request.url)` e deixavam cair o «?…»: quem
 * chegava de um anúncio com gclid e utm_* perdia-os no salto, e o pedido
 * ficava sem origem; o ?servico= que abre o simulador no serviço certo,
 * também.
 */

async function destino(caminho: string) {
  const r = await middleware(new NextRequest(`https://clyon.pt${caminho}`));
  const para = r.headers.get("location");
  return { status: r.status, para: para ? new URL(para) : null };
}

const DO_ANUNCIO = "gclid=abc123&utm_source=google&utm_medium=cpc&utm_campaign=recolha";

describe("os redirects do middleware levam os parâmetros", () => {
  it("as /Regiões/* antigas", async () => {
    const r = await destino(`/Regi%C3%B5es/Lisboa?${DO_ANUNCIO}`);
    expect(r.status).toBe(301);
    expect(r.para?.pathname).toBe("/regioes/lisboa");
    expect(r.para?.search).toBe(`?${DO_ANUNCIO}`);
  });

  it("as /mudancas-<cidade>, com página e sem ela", async () => {
    const comPagina = await destino(`/mudancas-lisboa?servico=mudanca&${DO_ANUNCIO}`);
    expect(comPagina.status).toBe(301);
    expect(comPagina.para?.pathname).toBe("/mudancas/lisboa");
    expect(comPagina.para?.searchParams.get("servico")).toBe("mudanca");
    expect(comPagina.para?.searchParams.get("gclid")).toBe("abc123");

    const semPagina = await destino(`/mudancas-porto?${DO_ANUNCIO}`);
    expect(semPagina.para?.pathname).toBe("/mudancas");
    expect(semPagina.para?.searchParams.get("utm_campaign")).toBe("recolha");

    // Uma terra junta ao concelho (d13) vai ao concelho, com os parâmetros.
    const terra = await destino(`/mudancas-amora?gclid=xyz`);
    expect(terra.para?.pathname).toBe("/mudancas/seixal");
    expect(terra.para?.search).toBe("?gclid=xyz");
  });

  it("sem parâmetros, o destino fica sem «?»", async () => {
    const r = await destino("/Regi%C3%B5es/Setubal");
    expect(r.para?.href).toBe("https://clyon.pt/regioes/setubal");
  });

  it("o next.config passa-os sozinho: nenhum destino traz «?» que os substitua", async () => {
    for (const r of await nextConfig.redirects!()) {
      expect(r.destination, r.source).not.toContain("?");
    }
  });
});
