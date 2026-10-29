import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { buildCustomRoute } from "next/dist/lib/build-custom-route";

import { middleware } from "@/middleware";
import nextConfig from "../../next.config";
import { getAllCidadeSlugs } from "./mudancas-cidades";
import { cidadeDaPaginaDeMudancas } from "./paginas-consolidadas";

/**
 * UM ENDEREÇO, UMA REGRA — 26-10-2026.
 *
 * O Search Console pôs 18 endereços em «Erro de redirecionamento». Nenhum
 * estava partido: todos faziam um salto (308) para uma página que responde
 * 200. Mas o código contradizia-se em dois pontos:
 *
 * — /credito-fiscal tinha um 308 para /servicos no next.config e um 410 no
 *   middleware. Os redirects do next.config correm ANTES do middleware, e o
 *   410 nunca acontecia: o Google recebia um redirect para uma página que
 *   não responde a «crédito fiscal». Fica o 410.
 *
 * — O middleware tinha cópias de /contato, /avaliacoes-clientes,
 *   /central-ajuda e /mudanças-<cidade> que nunca corriam, pela mesma razão.
 *   Saíram; a regra que vale é a do next.config.
 *
 * Tudo aqui é verificado pelas regras, sem rede: os redirects do next.config
 * são compilados com a mesma função com que o Next escreve o
 * routes-manifest que a Vercel usa, e o middleware é chamado directamente.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

type Regra = { source: string; destination: string; statusCode: number; regex: RegExp };

/** Os redirects do next.config, pela ordem e com a expressão que o Next lhes dá. */
async function regrasDoNextConfig(): Promise<Regra[]> {
  const redirects = await nextConfig.redirects!();
  return redirects.map((r) => {
    const feita = buildCustomRoute("redirect", r, ["/_next"]);
    return {
      source: r.source,
      destination: r.destination,
      statusCode: feita.statusCode ?? 0,
      // Sem distinção de maiúsculas, como o Next as compila (`sensitive: false`).
      regex: new RegExp(feita.regex, "i"),
    };
  });
}

/** A primeira regra do next.config que apanha o caminho — é a que corre. */
function primeiraRegra(regras: Regra[], caminho: string): Regra | null {
  return regras.find((r) => r.regex.test(caminho)) ?? null;
}

/** O que o middleware faz a um caminho que lá chegue. */
async function noMiddleware(caminho: string) {
  const resposta = await middleware(new NextRequest(`https://clyon.pt${caminho}`));
  return {
    status: resposta.status,
    para: resposta.headers.get("location"),
    robots: resposta.headers.get("x-robots-tag"),
  };
}

/** A página do destino existe mesmo no site. */
function paginaExiste(destino: string): boolean {
  const cidade = destino.match(/^\/mudancas\/([a-z-]+)$/)?.[1];
  if (cidade) {
    return (
      getAllCidadeSlugs().includes(cidade) &&
      existsSync(join(process.cwd(), "src", "app", "mudancas", "[cidade]", "page.tsx"))
    );
  }
  return existsSync(join(process.cwd(), "src", "app", ...destino.split("/").filter(Boolean), "page.tsx"));
}

/**
 * Os 18 endereços do relatório «Erro de redirecionamento» (Search Console,
 * validação falhada a 20-10-2026), e para onde cada um tem de ir. O
 * www.clyon.pt/avaliacoes-clientes leva mais um salto antes deste — o do
 * domínio www para o sem www, que é da Vercel e não do código.
 */
const COM_CEDILHA = [
  "lumiar",
  "carnaxide",
  "alcochete",
  "corroios",
  "costa-da-caparica",
  "odivelas",
  "sintra",
  "barreiro",
  "oeiras",
  "palmela",
  "sesimbra",
  "montijo",
  "lisboa",
];
const DO_RELATORIO: ReadonlyArray<[string, string | 410]> = [
  // Corroios e a Costa da Caparica juntaram-se ao concelho a 28-10-2026 (d13):
  // vão, num salto, à página do Seixal e à de Almada.
  ...COM_CEDILHA.map((c): [string, string] => [`/mudan%C3%A7as-${c}`, `/mudancas/${cidadeDaPaginaDeMudancas(c)}`]),
  ["/mudancas-lumiar", "/mudancas/lumiar"],
  ["/central-ajuda", "/faq"],
  ["/avaliacoes-clientes", "/avaliacoes"],
  ["/esvaziamento-casas-amadora", "/esvaziamento-de-casas-amadora"],
  ["/credito-fiscal", 410],
];

describe("os 18 endereços do «Erro de redirecionamento»", () => {
  it("são mesmo os 18 do relatório", () => {
    expect(DO_RELATORIO).toHaveLength(18);
    expect(new Set(DO_RELATORIO.map(([c]) => c)).size).toBe(18);
  });

  it("cada um vai num salto só (308) para a página certa, que responde", async () => {
    const regras = await regrasDoNextConfig();
    for (const [origem, destino] of DO_RELATORIO) {
      if (destino === 410) continue;
      const regra = primeiraRegra(regras, origem);
      expect(regra?.destination, origem).toBe(destino);
      expect(regra?.statusCode, origem).toBe(308);
      // Um destino com parâmetro seria outra regra a montar: aqui não há.
      expect(destino, origem).not.toContain(":");
      // UM salto: o destino não é a origem de outro redirect…
      expect(primeiraRegra(regras, destino)?.source ?? null, `${origem} → ${destino}`).toBeNull();
      // …nem o middleware o desvia…
      expect(await noMiddleware(destino), `${origem} → ${destino}`).toEqual({
        status: 200,
        para: null,
        robots: null,
      });
      // …e a página existe.
      expect(paginaExiste(destino), `${origem} → ${destino}`).toBe(true);
    }
  });

  it("o ç escrito em minúsculas (%c3%a7) vai pelo mesmo caminho", async () => {
    const regras = await regrasDoNextConfig();
    expect(primeiraRegra(regras, "/mudan%c3%a7as-lumiar")?.destination).toBe("/mudancas/lumiar");
  });
});

describe("/credito-fiscal é um 410, e nada o contradiz", () => {
  it("o next.config não o redirecciona — nenhuma regra o apanha", async () => {
    const regras = await regrasDoNextConfig();
    expect(primeiraRegra(regras, "/credito-fiscal")).toBeNull();
  });

  it("o middleware responde 410, sem índice", async () => {
    expect(await noMiddleware("/credito-fiscal")).toEqual({
      status: 410,
      para: null,
      robots: "noindex",
    });
  });

  it("nenhum endereço do 410 tem um redirect à frente no next.config", async () => {
    // Os redirects correm antes do middleware: um redirect para um destes
    // endereços apagava o 410 sem ninguém dar por isso — foi o que aconteceu.
    const lista = ler("src/middleware.ts").match(/const goneUrls = \[([^\]]*)\]/)?.[1];
    expect(lista).toBeDefined();
    const removidas = [...lista!.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(removidas).toContain("/credito-fiscal");
    const regras = await regrasDoNextConfig();
    for (const caminho of removidas) {
      expect(primeiraRegra(regras, caminho)?.source ?? null, caminho).toBeNull();
      expect((await noMiddleware(caminho)).status, caminho).toBe(410);
    }
  });
});

describe("os redirects antigos vivem só no next.config", () => {
  /** Endereço antigo → para onde vai. A cópia do middleware saiu a 26-10-2026. */
  const SO_NO_NEXT_CONFIG: Record<string, string> = {
    "/contato": "/contactos",
    "/avaliacoes-clientes": "/avaliacoes",
    "/central-ajuda": "/faq",
    "/mudan%C3%A7as": "/mudancas",
    "/mudan%C3%A7as-lumiar": "/mudancas/lumiar",
    // Uma cidade sem página vai ao balcão geral, pelo apanha-tudo.
    "/mudan%C3%A7as-porto": "/mudancas",
  };

  it("o next.config apanha-os num salto", async () => {
    const regras = await regrasDoNextConfig();
    for (const [origem, destino] of Object.entries(SO_NO_NEXT_CONFIG)) {
      const regra = primeiraRegra(regras, origem);
      expect(regra?.destination, origem).toBe(destino);
      expect(regra?.statusCode, origem).toBe(308);
    }
  });

  it("e o middleware já não tem uma cópia de nenhum deles", async () => {
    // A cópia nunca corria (o next.config vem antes) e divergia com o tempo:
    // dizia 301 onde o site responde 308.
    for (const origem of Object.keys(SO_NO_NEXT_CONFIG)) {
      expect((await noMiddleware(origem)).para, origem).toBeNull();
    }
  });
});
