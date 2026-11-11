import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { imagensGuardadasEm, listaGuardadaEm, PASTAS_DE_IMAGENS } from "../../app-pro/src/lib/guardado";
import { mapasAManter, nomeDoMapaGuardado, trabalhoFechado, type Trabalho } from "../../app-pro/src/lib/trabalhos";

/**
 * O QUE A CLYON PRO DEIXA NO TELEMÓVEL — 11-11-2026.
 *
 * Duas regras: (1) a lista guardada para abrir sem rede só leva a morada, o
 * contacto e o percurso dos trabalhos VIVOS; (2) ao sair da conta, as imagens
 * dos trabalhos vão-se com o resto.
 *
 * O telemóvel aqui é de faz de conta: um disco em memória entregue às regras
 * de `app-pro/src/lib/guardado.ts`, para se ler o que a app escreve de facto.
 */

const disco = { ficheiros: new Map<string, string>(), pastas: new Set<string>() };

class Ficheiro {
  constructor(public uri: string) {}
  get name() {
    return this.uri.split("/").pop()!;
  }
  get exists() {
    return disco.ficheiros.has(this.uri);
  }
  create() {
    disco.ficheiros.set(this.uri, "");
  }
  write(texto: string) {
    disco.ficheiros.set(this.uri, texto);
  }
  async text() {
    return disco.ficheiros.get(this.uri) ?? "";
  }
  delete() {
    disco.ficheiros.delete(this.uri);
  }
}

class Pasta {
  constructor(public uri: string) {}
  get exists() {
    return disco.pastas.has(this.uri) || [...disco.ficheiros.keys()].some((f) => f.startsWith(this.uri + "/"));
  }
  create() {
    disco.pastas.add(this.uri);
  }
  list() {
    return [...disco.ficheiros.keys()].filter((f) => f.startsWith(this.uri + "/")).map((f) => new Ficheiro(f));
  }
  delete() {
    disco.pastas.delete(this.uri);
    for (const f of [...disco.ficheiros.keys()]) if (f.startsWith(this.uri + "/")) disco.ficheiros.delete(f);
  }
}

const FICHEIRO = "documentos/trabalhos.json";
const { guardarLista, lerListaGuardada } = listaGuardadaEm(() => new Ficheiro(FICHEIRO));
const { mapaNoTelemovel, ficarSoComOsMapas, apagarImagensGuardadas } = imagensGuardadasEm<Pasta, Ficheiro>({
  pasta: (nome) => new Pasta("cache/" + nome),
  ficheiro: (pasta, nome) => new Ficheiro(pasta.uri + "/" + nome),
  descarregar: async (_endereco, para, cabecalhos) => {
    if (!cabecalhos.Authorization) throw new Error("sem token");
    disco.ficheiros.set(para.uri, "imagem");
  },
  mover: (de, para) => {
    disco.ficheiros.set(para.uri, disco.ficheiros.get(de.uri) ?? "");
    disco.ficheiros.delete(de.uri);
  },
});

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

// Dados inventados, com marcas que não se confundem com mais nada no ficheiro.
const RUA = "Rua de Exemplo";
const NOME = "Cliente de Exemplo";
const TELEFONE = "900000000";
const MAPS = "maps/dir";

function trabalho(n: number, mudar: Partial<Trabalho>): Trabalho {
  return {
    negociacaoId: n,
    pedidoId: 100 + n,
    estado: "acordada",
    fase: "a_executar",
    pedidoCancelado: false,
    arquivadoEm: null,
    confirmadoEm: null,
    pagoEm: null,
    city: "Lisboa",
    valorAcordado: 120,
    morada: `${RUA} ${n}`,
    moradaDestino: `${RUA} ${n} (destino)`,
    contactoNome: `${NOME} ${n}`,
    contactoTelefone: `${TELEFONE}${n}`,
    percurso: {
      texto: "12 km · cerca de 20 min",
      mapa: `/api/mapa?percurso=${n}`,
      direccoes: `https://exemplo.invalid/${MAPS}/${n}`,
      exacto: true,
      deOndeParaOnde: "Lisboa → Sintra",
    },
    ...mudar,
  } as Trabalho;
}

const VIVO = trabalho(1, {});
const FECHADOS: Array<[string, Trabalho]> = [
  ["confirmado", trabalho(2, { fase: "confirmado", confirmadoEm: "2026-11-01T10:00:00.000Z" })],
  ["pago", trabalho(3, { fase: "pago", pagoEm: "2026-11-02T10:00:00.000Z" })],
  ["arquivado", trabalho(4, { arquivadoEm: "2026-11-03T10:00:00.000Z" })],
  ["desistido", trabalho(5, { estado: "desistida", fase: "a_negociar" })],
  ["morto", trabalho(6, { estado: "morta", fase: "a_negociar" })],
  ["de um pedido cancelado", trabalho(7, { pedidoCancelado: true })],
];
const LISTA = [VIVO, ...FECHADOS.map(([, t]) => t)];

function guardados(): Trabalho[] {
  return JSON.parse(disco.ficheiros.get(FICHEIRO)!).trabalhos;
}

beforeEach(() => {
  disco.ficheiros.clear();
  disco.pastas.clear();
});

describe("regra 1 — a lista guardada só leva moradas, contacto e percurso dos trabalhos vivos", () => {
  it("um trabalho vivo guarda-se como veio do site", () => {
    guardarLista(LISTA, new Date("2026-11-11T12:00:00.000Z"));
    expect(guardados()[0]).toEqual(VIVO);
    expect(JSON.parse(disco.ficheiros.get(FICHEIRO)!).lidaEm).toBe("2026-11-11T12:00:00.000Z");
  });

  it.each(FECHADOS)("um trabalho %s fica sem morada, contacto nem percurso — e com o resto", (_nome, t) => {
    expect(trabalhoFechado(t)).toBe(true);
    guardarLista([t]);
    const [g] = guardados();
    expect(g.morada).toBeNull();
    expect(g.moradaDestino).toBeNull();
    expect(g.contactoNome).toBeNull();
    expect(g.contactoTelefone).toBeNull();
    expect(g.percurso).toBeNull();
    // O que não diz onde nem de quem continua lá: a lista sem rede não perde linhas.
    expect(g.negociacaoId).toBe(t.negociacaoId);
    expect(g.fase).toBe(t.fase);
    expect(g.valorAcordado).toBe(120);
    expect(g.city).toBe("Lisboa");
  });

  it("no ficheiro inteiro, as moradas, os contactos e os percursos são só os do trabalho vivo", () => {
    guardarLista(LISTA);
    const texto = disco.ficheiros.get(FICHEIRO)!;
    const vezes = (marca: string) => texto.split(marca).length - 1;
    expect(guardados()).toHaveLength(LISTA.length);
    expect(vezes(RUA)).toBe(2); // origem e destino do vivo
    expect(vezes(NOME)).toBe(1);
    expect(vezes(TELEFONE)).toBe(1);
    expect(vezes(MAPS)).toBe(1);
    expect(vezes("/api/mapa")).toBe(1);
  });

  it("uma lista guardada por uma versão anterior é limpa ao abrir — no ecrã e no ficheiro", async () => {
    disco.ficheiros.set(FICHEIRO, JSON.stringify({ trabalhos: LISTA, lidaEm: "2026-11-10T09:00:00.000Z" }));
    const lida = await lerListaGuardada();
    expect(lida!.lidaEm).toBe("2026-11-10T09:00:00.000Z");
    expect(lida!.trabalhos[0]).toEqual(VIVO);
    for (const t of lida!.trabalhos.slice(1)) {
      expect([t.morada, t.moradaDestino, t.contactoNome, t.contactoTelefone, t.percurso]).toEqual([null, null, null, null, null]);
    }
    const texto = disco.ficheiros.get(FICHEIRO)!;
    expect(texto.split(RUA).length - 1).toBe(2);
    expect(texto.split(MAPS).length - 1).toBe(1);
    // A hora a que foi lida do site não muda por se ter limpado.
    expect(JSON.parse(texto).lidaEm).toBe("2026-11-10T09:00:00.000Z");
  });

  it("o ficheiro só se escreve por esta regra", () => {
    // A app usa as regras testadas aqui em cima, e não outras ao lado.
    const GUARDADA = ler("app-pro/src/lib/lista-guardada.ts");
    expect(GUARDADA).toContain("export const { guardarLista, lerListaGuardada, apagarListaGuardada } = listaGuardadaEm(ficheiro);");
    expect(GUARDADA).not.toContain(".write(");
    expect(GUARDADA).not.toContain("JSON.stringify(");
    const REGRAS = ler("app-pro/src/lib/guardado.ts");
    expect(REGRAS).not.toContain("JSON.stringify(");
    expect(REGRAS.split("f.write(").length - 1).toBe(2);
    expect(REGRAS).toContain("f.write(textoDaListaGuardada(trabalhos, agora.toISOString()));");
    expect(REGRAS).toContain("f.write(limpo);");
    // E as regras não dependem do telemóvel: é por isso que este teste as corre.
    expect(REGRAS).not.toMatch(/from "(expo|react-native)/);
  });

  it("as imagens também: a app liga as mesmas regras às pastas da cache", () => {
    const IMAGENS = ler("app-pro/src/lib/imagens-guardadas.ts");
    expect(IMAGENS).toContain(
      "export const { mapaNoTelemovel, ficarSoComOsMapas, apagarImagensGuardadas } = imagensGuardadasEm<Directory, File>({",
    );
    expect(IMAGENS).toContain("new Directory(Paths.cache, nome)");
  });
});

describe("regra 2 — «Sair» limpa as imagens dos trabalhos", () => {
  it("o mapa vai para uma pasta da app, e não para a cache de imagens do sistema", async () => {
    const onde = await mapaNoTelemovel("https://exemplo.invalid/api/mapa?percurso=1", "/api/mapa?percurso=1", "t");
    expect(onde).toBe(`cache/mapas/${nomeDoMapaGuardado("/api/mapa?percurso=1")}`);
    expect(disco.ficheiros.has(onde!)).toBe(true);
    // O nome do ficheiro não leva o caminho do site.
    expect(nomeDoMapaGuardado("/api/mapa?percurso=1")).toMatch(/^mapa-[a-z0-9]+-\d+\.png$/);
    const MAPA = ler("app-pro/src/componentes/MapaDoPercurso.tsx");
    expect(MAPA).toContain("mapaNoTelemovel(`${SITE}${mapa}`, mapa, token)");
    expect(MAPA).toContain("source={{ uri: imagem }}");
    expect(MAPA).not.toContain("Authorization");
  });

  it("ao sair, as pastas de imagens ficam vazias", async () => {
    await mapaNoTelemovel("https://exemplo.invalid/a", "/api/mapa?percurso=1", "t");
    disco.ficheiros.set("cache/image_cache/v2/abc.cnt", "imagem");
    disco.ficheiros.set("cache/outra-coisa/fica", "x");
    expect(PASTAS_DE_IMAGENS).toEqual(["mapas", "image_cache"]);
    apagarImagensGuardadas();
    expect([...disco.ficheiros.keys()]).toEqual(["cache/outra-coisa/fica"]);
  });

  it("o «Sair» chama a limpeza — também quando a sessão se perde", () => {
    const SESSAO = ler("app-pro/src/estado/Sessao.tsx");
    const sair = SESSAO.slice(SESSAO.indexOf("const sair = useCallback("), SESSAO.indexOf("quandoPerderASessao(() => void sair())"));
    expect(sair).toContain("apagarImagensGuardadas();");
    expect(sair).toContain("await esquecerToken();");
    expect(SESSAO).toContain("quandoPerderASessao(() => void sair())");
  });

  it("com a conta aberta, ficam só os mapas dos trabalhos vivos", async () => {
    for (const t of LISTA) await mapaNoTelemovel("https://exemplo.invalid/a", t.percurso!.mapa, "t");
    expect(disco.ficheiros.size).toBe(LISTA.length);
    expect(mapasAManter(LISTA)).toEqual([nomeDoMapaGuardado(VIVO.percurso!.mapa)]);
    disco.ficheiros.set("cache/mapas/a-descarregar.png.tmp", "meio");
    ficarSoComOsMapas(mapasAManter(LISTA));
    expect([...disco.ficheiros.keys()].sort()).toEqual(
      ["cache/mapas/a-descarregar.png.tmp", `cache/mapas/${nomeDoMapaGuardado(VIVO.percurso!.mapa)}`].sort(),
    );
    const ESTADO = ler("app-pro/src/estado/Trabalhos.tsx");
    expect(ESTADO).toContain("ficarSoComOsMapas(mapasAManter(lista));");
  });
});
