import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { urlDeAccao } from "./url-do-site";
import { SITE_URL } from "./seo-data";

const CHAVES = ["NEXT_PUBLIC_SITE_URL", "VERCEL_ENV", "VERCEL_URL", "NODE_ENV", "PORT"] as const;

/**
 * O `NODE_ENV` está tipado como só de leitura pelo @types/node, e o `tsc`
 * recusa a atribuição directa mesmo funcionando em execução. Escrever por aqui
 * mantém o teste honesto sem desligar a verificação de tipos no ficheiro todo.
 */
function definir(chave: string, valor: string) {
  Reflect.set(process.env, chave, valor);
}

let original: Record<string, string | undefined>;

beforeEach(() => {
  original = Object.fromEntries(CHAVES.map((k) => [k, process.env[k]]));
  for (const k of CHAVES) delete process.env[k];
});

afterEach(() => {
  for (const k of CHAVES) {
    if (original[k] === undefined) delete process.env[k];
    else definir(k, original[k]!);
  }
});

describe("urlDeAccao", () => {
  it("em produção no Vercel usa o domínio a sério", () => {
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_URL = "clyon-site-abc123.vercel.app";
    expect(urlDeAccao()).toBe(SITE_URL);
  });

  // O caso que motivou este ficheiro: um email enviado de um preview apontava
  // para clyon.pt, onde o pedido acabado de criar não existe.
  it("num preview usa o host do preview", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL = "clyon-site-git-plataforma.vercel.app";
    expect(urlDeAccao()).toBe("https://clyon-site-git-plataforma.vercel.app");
  });

  it("na máquina de quem desenvolve usa o localhost", () => {
    definir("NODE_ENV", "development");
    expect(urlDeAccao()).toBe("http://localhost:3000");
  });

  it("respeita a porta quando não é a 3000", () => {
    definir("NODE_ENV", "development");
    process.env.PORT = "4000";
    expect(urlDeAccao()).toBe("http://localhost:4000");
  });

  it("a escotilha manual manda em tudo", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL = "seja-o-que-for.vercel.app";
    process.env.NEXT_PUBLIC_SITE_URL = "https://teste.clyon.pt";
    expect(urlDeAccao()).toBe("https://teste.clyon.pt");
  });

  it("não deixa barra a mais no fim", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://teste.clyon.pt/";
    expect(urlDeAccao()).toBe("https://teste.clyon.pt");
  });

  // Sem pistas nenhumas, o seguro é o domínio real — nunca um host inventado.
  it("sem nada definido em produção, cai no domínio real", () => {
    definir("NODE_ENV", "production");
    expect(urlDeAccao()).toBe(SITE_URL);
  });

  it("um preview sem VERCEL_URL não inventa host", () => {
    process.env.VERCEL_ENV = "preview";
    definir("NODE_ENV", "production");
    expect(urlDeAccao()).toBe(SITE_URL);
  });
});
