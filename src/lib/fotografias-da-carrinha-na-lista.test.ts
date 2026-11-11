import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A LISTA PÚBLICA DAS MUDANÇAS — 11-11-2026 (ordem do CEO com o sim do dono).
 *
 * Ao lado de `fotografias-da-carrinha.test.ts`: aquele guarda as rotas e os
 * ecrãs em `src/app`; este guarda a rota pública da lista, que vai buscar os
 * parceiros à base por uma função de `db.ts`.
 *
 *   1. Nenhuma fotografia da carrinha na resposta da lista — ao parceiro
 *      dizemos «O cliente não as vê».
 *   2. A lista responde o mesmo com e sem a forma de pagamento: o que depende
 *      dela só se confere no envio do pedido, com uma frase só.
 *   3. Quem aparece decide-se pela localidade da origem, não pela porta.
 *   4. A rota tem um tecto por dia, além do de 5 minutos.
 *
 * Lê-se a RESPOSTA da rota (com a base e o Google fingidos), e não só o código.
 */

const estado = vi.hoisted(() => ({
  candidatos: [] as unknown[],
  comDivida: new Set<number>(),
  destinos: [] as unknown[],
  limites: [] as Array<{ nome: string; limite: number; janela: number }>,
  recusarODia: false,
}));

vi.mock("@/lib/db", () => ({
  candidatosDaListaDasMudancas: vi.fn(async () => estado.candidatos),
  listaDeParceirosNasMudancasLigada: vi.fn(async () => true),
  gravarEscolhaDosParceiros: vi.fn(async () => undefined),
  appendOrderHistory: vi.fn(async () => undefined),
}));
vi.mock("@/lib/distancia-rodoviaria", () => ({
  distanciaRodoviaria: vi.fn(async () => ({ km: 20, minutos: 25, origem: "estrada" })),
  distanciasRodoviarias: vi.fn(async (pares: Array<{ origem: unknown; destino: unknown }>) => {
    estado.destinos.push(...pares.map((p) => p.destino));
    return pares.map((p) => (p.origem ? { km: 10, minutos: null, origem: "estrada" } : null));
  }),
}));
vi.mock("@/lib/geocodificar", () => ({ geocodificarMorada: vi.fn(async () => null) }));
vi.mock("@/lib/bloqueio-do-profissional", () => ({
  profissionaisBloqueadosEmDinheiro: vi.fn(async () => estado.comDivida),
}));
vi.mock("@/lib/distribuir-pedido", () => ({
  distribuirPedido: vi.fn(async () => ({ avisados: 0, receberam: 0, falhados: 0, candidatos: 0, jaTinham: 0, motivos: {} })),
  resumoDaDistribuicao: vi.fn(() => ""),
}));
vi.mock("@/lib/avisos-do-backoffice", () => ({ avisarCliente: vi.fn(async () => undefined) }));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async (_req: unknown, nome: string, limite: number, janela: number) => {
    estado.limites.push({ nome, limite, janela });
    if (estado.recusarODia && nome === "mudancas-parceiros-dia") {
      return { erro: NextResponse.json({ ok: false, error: "Demasiados pedidos." }, { status: 429 }) };
    }
    return { erro: null };
  }),
}));

process.env.JWT_SECRET = "segredo-de-teste";

import { POST } from "@/app/api/mudancas/parceiros/route";
import { candidatosDaListaDasMudancas } from "@/lib/db";
import { profissionaisBloqueadosEmDinheiro } from "@/lib/bloqueio-do-profissional";
import { ESCOLHA_INDISPONIVEL, idOpacoDoParceiro } from "./parceiros-da-mudanca";
import { prepararEscolhaDaMudanca } from "./mudanca-com-parceiros-escolhidos";
import { pontoDaZona } from "./zona-da-lista";
import { CONCELHOS_DA_COBERTURA } from "./concelhos-da-cobertura";

const FOTO = "https://loja1abc.public.blob.vercel-storage.com/candidaturas/00000001-aaaa-bbbb-cccc-dddddddddddd.jpg";

const TARIFA = {
  precoHora2: 40,
  precoHora3: 55,
  minimoHoras: 3,
  precoKm: 0.5,
  kmMinimo: 0,
  kmMaximo: 80,
  caixa: 2,
  cartaoMetro: null,
  filmeRolo: 10,
  plasticoBolhaRolo: null,
  aparecerNaLista: true,
};

/** Um parceiro como a base o devolvia ANTES — com as fotografias da carrinha agarradas. */
function candidato(id: number, mais: Record<string, unknown> = {}) {
  return {
    id,
    nome: `Parceiro ${id}`,
    email: `p${id}@exemplo.pt`,
    telefone: "912345678",
    avisaPorWhatsApp: true,
    isActive: true,
    estado: "aprovado",
    categorias: ["mudancas"],
    raioKm: 50,
    emiteFatura: true,
    emiteGuiaTransporte: false,
    guiaVerificadaEm: null,
    baseLat: 38.6,
    baseLng: -9.1,
    contaDeTeste: false,
    verificado: true,
    fotografia: FOTO,
    fotoViaturaUrl: FOTO,
    fotosViaturaJson: JSON.stringify([FOTO]),
    tarifa: TARIFA,
    notaMedia: null,
    avaliacoes: 0,
    googlePlaceId: null,
    ...mais,
  };
}

const SEIXAL_A = { lat: 38.64, lng: -9.1, morada: "Rua A, Seixal", cidade: "Seixal" };
const SEIXAL_B = { lat: 38.625, lng: -9.115, morada: "Rua C, Seixal", cidade: "Seixal" };
const ALMADA = { lat: 38.68, lng: -9.16, morada: "Rua B, Almada", cidade: "Almada" };

async function lista(corpo: Record<string, unknown>) {
  const r = await POST(
    new NextRequest("https://clyon.pt/api/mudancas/parceiros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origem: SEIXAL_A, destino: ALMADA, tipologia: "T2", pessoas: 2, ...corpo }),
    }),
  );
  return { status: r.status, texto: await r.text() };
}

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (s: string) => s.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");
/** O corpo de uma função exportada de db.ts, até à exportação seguinte. */
function funcaoDaBase(nome: string): string {
  const DB = ler("src/lib/db.ts");
  const i = DB.indexOf(`export async function ${nome}(`);
  expect(i, nome).toBeGreaterThan(-1);
  const fim = DB.slice(i + 1).search(/\nexport /);
  return DB.slice(i, fim < 0 ? undefined : i + 1 + fim);
}

beforeEach(() => {
  vi.clearAllMocks();
  estado.candidatos = [candidato(1), candidato(2)];
  estado.comDivida = new Set();
  estado.destinos = [];
  estado.limites = [];
  estado.recusarODia = false;
});

describe("1. nenhuma rota pública devolve fotografia da carrinha — a lista das mudanças", () => {
  it("a resposta da lista não traz fotografia nenhuma, mesmo que a base as devolvesse", async () => {
    const r = await lista({});
    expect(r.status).toBe(200);
    const d = JSON.parse(r.texto) as { parceiros: Array<Record<string, unknown>> };
    expect(d.parceiros).toHaveLength(2);
    for (const p of d.parceiros) expect(p.fotografia).toBeNull();
    expect(r.texto).not.toContain("blob.vercel-storage.com");
    expect(r.texto).not.toContain("candidaturas/");
    expect(r.texto).not.toMatch(/fotoViatura|fotosViatura/);
  });

  it("a consulta dos candidatos da lista não lê as colunas das fotografias", () => {
    expect(funcaoDaBase("candidatosDaListaDasMudancas")).not.toMatch(/fotoViatura|fotosViatura|lerFotos\(|fotografia/);
  });

  it("o cartão manda sempre null, e as libs da lista não sabem das fotografias", () => {
    const LISTA = semNotas(ler("src/lib/lista-de-parceiros-da-mudanca.ts"));
    expect(LISTA).toContain("fotografia: null,");
    expect(LISTA).not.toMatch(/c\.fotografia|fotoViatura|fotosViatura/);
    for (const f of ["src/lib/parceiros-da-mudanca.ts", "src/lib/mudanca-com-parceiros-escolhidos.ts", "src/app/api/mudancas/parceiros/route.ts"]) {
      expect(semNotas(ler(f)), f).not.toMatch(/fotografia|fotoViatura|fotosViatura/);
    }
  });

  it("o ecrã da lista no simulador não desenha fotografia do parceiro", () => {
    expect(semNotas(ler("src/app/simulador/components/ParceirosDaMudanca.tsx"))).not.toMatch(/fotografia/);
  });

  it("em db.ts, só lê as fotografias da carrinha quem já as lia para a equipa e para o próprio parceiro", () => {
    const DB = ler("src/lib/db.ts");
    const quemLe = new Set<string>();
    let actual = "";
    for (const linha of DB.split("\n")) {
      const m = linha.match(/^export (?:async )?function (\w+)/);
      if (m) actual = m[1];
      if (/fotoViaturaUrl|fotosViaturaJson/.test(linha) && actual) quemLe.add(actual);
    }
    expect([...quemLe].sort()).toEqual(
      [
        "actualizarPerfilDoProfissional",
        "apagarProfissional",
        "ensureProvidersSchema",
        "fotosDaViatura",
        "guardarFotosDaViatura",
        "perfilDoProfissional",
        "urlDaFotoDaViatura",
      ].sort(),
    );
  });
});

describe("2. a lista responde igual com e sem a forma de pagamento", () => {
  it("o mesmo corpo, byte a byte, com dinheiro, na plataforma ou sem dizer — mesmo com um parceiro que não pode receber em dinheiro", async () => {
    estado.comDivida = new Set([1]);
    const sem = await lista({});
    const plataforma = await lista({ formaDePagamento: "na_plataforma" });
    const dinheiro = await lista({ formaDePagamento: "dinheiro" });
    expect(sem.status).toBe(200);
    expect(dinheiro.texto).toBe(sem.texto);
    expect(plataforma.texto).toBe(sem.texto);
    expect((JSON.parse(dinheiro.texto) as { parceiros: unknown[] }).parceiros).toHaveLength(2);
    // A rota da lista nem pergunta quem está bloqueado em dinheiro.
    expect(profissionaisBloqueadosEmDinheiro).not.toHaveBeenCalled();
  });

  const ORDER = {
    serviceType: "mudanca",
    tipologia: "T2",
    originAddress: { lat: 38.64, lng: -9.1, formattedAddress: "Rua A, Seixal", city: "Seixal" },
    destinationAddress: { lat: 38.68, lng: -9.16, formattedAddress: "Rua B, Almada", city: "Almada" },
    pessoas: 2,
  };

  it("o filtro passou para o envio do pedido: em dinheiro, o escolhido que não pode recusa o pedido", async () => {
    estado.comDivida = new Set([1]);
    const emDinheiro = await prepararEscolhaDaMudanca({ ...ORDER, formaDePagamento: "dinheiro", parceirosEscolhidos: [idOpacoDoParceiro(1)] });
    expect(emDinheiro).toEqual({ caminho: "recusado", erro: ESCOLHA_INDISPONIVEL, campo: "parceirosEscolhidos" });
    const naPlataforma = await prepararEscolhaDaMudanca({ ...ORDER, formaDePagamento: "na_plataforma", parceirosEscolhidos: [idOpacoDoParceiro(1)] });
    expect(naPlataforma.caminho).toBe("escolhidos");
    // O outro parceiro, em dinheiro, segue.
    const outro = await prepararEscolhaDaMudanca({ ...ORDER, formaDePagamento: "dinheiro", parceirosEscolhidos: [idOpacoDoParceiro(2)] });
    expect(outro.caminho).toBe("escolhidos");
  });

  it("a frase é a mesma seja qual for a razão, e não fala de pagamento nem de dívida", async () => {
    estado.comDivida = new Set([1]);
    const porPagamento = await prepararEscolhaDaMudanca({ ...ORDER, formaDePagamento: "dinheiro", parceirosEscolhidos: [idOpacoDoParceiro(1)] });
    const porJaNaoEstar = await prepararEscolhaDaMudanca({ ...ORDER, parceirosEscolhidos: [idOpacoDoParceiro(999)] });
    expect(porPagamento).toEqual(porJaNaoEstar);
    expect(ESCOLHA_INDISPONIVEL).not.toMatch(/dinheiro|pagamento|d[ií]vida|deve|bloque/i);
  });
});

describe("3. quem aparece decide-se pela localidade, não pela porta", () => {
  it("duas moradas da mesma terra medem-se até ao mesmo ponto — o centro do concelho — e dão a mesma lista", async () => {
    const a = await lista({ origem: SEIXAL_A });
    const destinosA = [...estado.destinos];
    estado.destinos = [];
    const b = await lista({ origem: SEIXAL_B });
    const seixal = CONCELHOS_DA_COBERTURA.find((c) => c.id === "seixal")!.centro;
    expect(destinosA).toEqual([seixal, seixal]);
    expect(estado.destinos).toEqual(destinosA);
    expect((JSON.parse(a.texto) as { parceiros: unknown[] }).parceiros).toEqual((JSON.parse(b.texto) as { parceiros: unknown[] }).parceiros);
    // As coordenadas da porta nunca são o ponto da medida.
    expect(JSON.stringify(destinosA)).not.toContain("38.64");
  });

  it("fora dos concelhos que se medem, o ponto arredonda-se à décima de grau", () => {
    expect(pontoDaZona({ lat: 41.1496, lng: -8.6109 })).toEqual({ lat: 41.1, lng: -8.6 });
    expect(pontoDaZona({ lat: 41.1012, lng: -8.5899 })).toEqual({ lat: 41.1, lng: -8.6 });
    expect(pontoDaZona({ lat: 38.6401, lng: -9.1002 })).toEqual(pontoDaZona({ lat: 38.6259, lng: -9.1151 }));
  });

  it("o envio aos escolhidos mede até ao mesmo ponto da lista", () => {
    const ENVIO = semNotas(ler("src/lib/mudanca-com-parceiros-escolhidos.ts"));
    expect(ENVIO).toContain("zonaPonto: lista.zonaPonto,");
    expect(ENVIO).toContain("lat: (e.zonaPonto ?? e.origemPonto).lat,");
    expect(ENVIO).toContain("lng: (e.zonaPonto ?? e.origemPonto).lng,");
  });
});

describe("4. a rota tem um tecto por dia, por máquina", () => {
  it("dois limites: o de 5 minutos e o do dia", async () => {
    await lista({});
    expect(estado.limites).toEqual([
      { nome: "mudancas-parceiros", limite: 20, janela: 300 },
      { nome: "mudancas-parceiros-dia", limite: 100, janela: 86400 },
    ]);
  });

  it("passado o do dia: 429, e a base nem é lida", async () => {
    estado.recusarODia = true;
    const r = await lista({});
    expect(r.status).toBe(429);
    expect(candidatosDaListaDasMudancas).not.toHaveBeenCalled();
  });
});
