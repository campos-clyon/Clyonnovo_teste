import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { urlDeAccao, urlDeAccaoDoPedido } from "./url-do-site";
import { SITE_URL } from "./seo-data";

const CHAVES = [
  "NEXT_PUBLIC_SITE_URL",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_BRANCH_URL",
  "NODE_ENV",
  "PORT",
] as const;

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

describe("urlDeAccaoDoPedido", () => {
  // O caso real: num preview sem as variáveis de sistema expostas, o
  // urlDeAccao() caía em clyon.pt e o email levava a pessoa para produção,
  // onde o pedido acabado de criar não existe — 404. Os cabeçalhos do pedido
  // sabem sempre onde ela está.
  it("usa o anfitrião do próprio pedido", () => {
    const h = new Headers({ host: "clyon-site-abc.vercel.app", "x-forwarded-proto": "https" });
    expect(urlDeAccaoDoPedido(h)).toBe("https://clyon-site-abc.vercel.app");
  });

  it("prefere o x-forwarded-host, que é o que o proxy reescreve", () => {
    const h = new Headers({
      host: "interno:3000",
      "x-forwarded-host": "clyon.pt",
      "x-forwarded-proto": "https",
    });
    expect(urlDeAccaoDoPedido(h)).toBe("https://clyon.pt");
  });

  it("assume http em localhost e https no resto", () => {
    expect(urlDeAccaoDoPedido(new Headers({ host: "localhost:3000" }))).toBe(
      "http://localhost:3000",
    );
    expect(urlDeAccaoDoPedido(new Headers({ host: "clyon.pt" }))).toBe("https://clyon.pt");
  });

  it("fica com o primeiro protocolo quando vem uma lista", () => {
    const h = new Headers({ host: "clyon.pt", "x-forwarded-proto": "https,http" });
    expect(urlDeAccaoDoPedido(h)).toBe("https://clyon.pt");
  });

  // O caso que partiu o convite de aprovação: o projecto tem
  // NEXT_PUBLIC_SITE_URL=https://clyon.pt para TODOS os ambientes, e por isso um
  // email enviado do preview levava um link para produção. O cabeçalho sabe
  // onde a pessoa está; a variável é um palpite estático.
  it("o anfitrião do pedido ganha ao NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://clyon.pt";
    const h = new Headers({ host: "clyon-site-git-plataforma.vercel.app" });
    expect(urlDeAccaoDoPedido(h)).toBe("https://clyon-site-git-plataforma.vercel.app");
  });

  it("sem cabeçalho, o NEXT_PUBLIC_SITE_URL serve de recurso", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://teste.clyon.pt";
    expect(urlDeAccaoDoPedido(new Headers())).toBe("https://teste.clyon.pt");
  });

  it("sem cabeçalhos nenhuns cai no caminho antigo", () => {
    definir("NODE_ENV", "production");
    expect(urlDeAccaoDoPedido(new Headers())).toBe(SITE_URL);
  });
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
    process.env.VERCEL_URL = "clyon-site-abc123.vercel.app";
    expect(urlDeAccao()).toBe("https://clyon-site-abc123.vercel.app");
  });

  // O VERCEL_URL muda a cada publicação; o BRANCH_URL não. Num email isso é a
  // diferença entre um link que abre a versão de hoje e um que continua a
  // abrir a mais recente do ramo.
  it("prefere o endereço estável do ramo ao do deployment", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL = "clyon-site-abc123.vercel.app";
    process.env.VERCEL_BRANCH_URL = "clyon-site-git-plataforma.vercel.app";
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
