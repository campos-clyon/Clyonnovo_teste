import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * A NOTA DO GOOGLE NO CARTÃO DA LISTA DAS MUDANÇAS — 11-11-2026.
 *
 * A ficha do Google proposta pelo parceiro, confirmada por um administrador;
 * a nota pedida ao Google no momento (só rating e userRatingCount), em
 * paralelo e com prazo curto, numa memória de minutos — nunca na base nem na
 * prova do pedido; sem resposta ou com menos de 5 avaliações, sem a linha; a
 * atribuição sempre com ela; nunca misturada com a nota da CLYON.
 */

vi.mock("@/lib/db", () => ({
  candidatosDaListaDasMudancas: vi.fn(async () => []),
  listaDeParceirosNasMudancasLigada: vi.fn(async () => true),
  gravarEscolhaDosParceiros: vi.fn(async () => undefined),
  appendOrderHistory: vi.fn(async () => undefined),
}));
vi.mock("@/lib/distancia-rodoviaria", () => ({
  distanciaRodoviaria: vi.fn(async () => ({ km: 20, minutos: 25, origem: "estrada" })),
  distanciasRodoviarias: vi.fn(async (pares: unknown[]) => pares.map(() => ({ km: 10, minutos: null, origem: "estrada" }))),
}));
vi.mock("@/lib/geocodificar", () => ({ geocodificarMorada: vi.fn(async () => null) }));
vi.mock("@/lib/bloqueio-do-profissional", () => ({ profissionaisBloqueadosEmDinheiro: vi.fn(async () => new Set<number>()) }));
vi.mock("@/lib/distribuir-pedido", () => ({ distribuirPedido: vi.fn(), resumoDaDistribuicao: vi.fn(() => "") }));
vi.mock("@/lib/avisos-do-backoffice", () => ({ avisarCliente: vi.fn(async () => undefined) }));

process.env.JWT_SECRET = "segredo-de-teste";
process.env.GOOGLE_MAPS_SERVER_API_KEY = "chave-de-teste";

import {
  ATRIBUICAO_DO_GOOGLE,
  AVALIACOES_PARA_A_NOTA_DO_GOOGLE,
  notaDoGoogleNoCartao,
} from "./lista-de-parceiros-da-mudanca";
import { CAMPOS_DA_NOTA, esquecerOGoogle, lerPlaceId, notaNoGoogle, procurarFichasNoGoogle } from "./ficha-no-google";
import { lerPedidoDaLista, listaDosParceirosDaMudanca } from "./parceiros-da-mudanca";
import { provaDaEscolha } from "./mudanca-com-parceiros-escolhidos";
import { estadoDaFicha, TEXTOS_DA_FICHA_NO_GOOGLE } from "./estado-da-ficha-no-google";

const RAIZ = join(__dirname, "..", "..");
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");

const PLACE_A = "ChIJAAAAAAAAAAAAAAAAAAAAAAA";
const PLACE_B = "ChIJBBBBBBBBBBBBBBBBBBBBBBB";

const TARIFA = {
  precoHora2: 40,
  precoHora3: null,
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

function candidato(id: number, googlePlaceId: string | null, mais: Record<string, unknown> = {}) {
  return {
    id,
    nome: `Parceiro ${id}`,
    email: null,
    telefone: null,
    avisaPorWhatsApp: false,
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
    verificado: false,
    fotografia: null,
    tarifa: TARIFA,
    notaMedia: 4.8,
    avaliacoes: 6,
    googlePlaceId,
    ...mais,
  };
}

function pedido() {
  const lido = lerPedidoDaLista({
    origem: { lat: 38.64, lng: -9.1, morada: "Rua A", cidade: "Seixal" },
    destino: { lat: 38.68, lng: -9.16, morada: "Rua B", cidade: "Almada" },
    tipologia: "T2",
    pessoas: 2,
  });
  if (!lido.ok) throw new Error(lido.erro);
  return lido.pedido;
}

/** Um Google fingido: por place_id, a nota (ou um estado HTTP); conta as chamadas e guarda o FieldMask. */
function googleFingido(respostas: Record<string, { rating: number; userRatingCount: number } | number>) {
  const chamadas: Array<{ url: string; campos: string | null; chave: string | null }> = [];
  const busca = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const h = new Headers(init?.headers);
    chamadas.push({ url: u, campos: h.get("X-Goog-FieldMask"), chave: h.get("X-Goog-Api-Key") });
    const id = decodeURIComponent(u.split("/places/")[1]?.split("?")[0] ?? "");
    const r = respostas[id];
    if (typeof r === "number") return new Response("{}", { status: r });
    if (!r) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify(r), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { busca, chamadas };
}

beforeEach(() => esquecerOGoogle());

describe("o texto do cartão", () => {
  it("«4,6 no Google (230 avaliações)», com a atribuição", () => {
    const n = notaDoGoogleNoCartao({ rating: 4.63, userRatingCount: 230 });
    expect(n).toEqual({ media: 4.6, avaliacoes: 230, texto: "4,6 no Google (230 avaliações)", atribuicao: "Google Maps" });
    expect(ATRIBUICAO_DO_GOOGLE).toBe("Google Maps");
    expect(notaDoGoogleNoCartao({ rating: 5, userRatingCount: 12345 })?.texto).toBe("5,0 no Google (12 345 avaliações)");
  });

  it("sem resposta, com valores estranhos ou com menos de 5 avaliações: sem a linha", () => {
    expect(AVALIACOES_PARA_A_NOTA_DO_GOOGLE).toBe(5);
    expect(notaDoGoogleNoCartao(null)).toBeNull();
    expect(notaDoGoogleNoCartao({ rating: 4.9, userRatingCount: 4 })).toBeNull();
    expect(notaDoGoogleNoCartao({ rating: 4.9, userRatingCount: 5 })).not.toBeNull();
    expect(notaDoGoogleNoCartao({ rating: 0, userRatingCount: 50 })).toBeNull();
    expect(notaDoGoogleNoCartao({ rating: 7, userRatingCount: 50 })).toBeNull();
    expect(notaDoGoogleNoCartao({ rating: Number.NaN, userRatingCount: 50 })).toBeNull();
  });
});

describe("o pedido ao Google", () => {
  it("só rating e userRatingCount (o FieldMask mínimo), com a chave do servidor", async () => {
    const g = googleFingido({ [PLACE_A]: { rating: 4.6, userRatingCount: 230 } });
    expect(CAMPOS_DA_NOTA).toBe("rating,userRatingCount");
    const n = await notaNoGoogle(PLACE_A, { busca: g.busca });
    expect(n).toEqual({ rating: 4.6, userRatingCount: 230 });
    expect(g.chamadas).toHaveLength(1);
    expect(g.chamadas[0].campos).toBe("rating,userRatingCount");
    expect(g.chamadas[0].chave).toBe("chave-de-teste");
    expect(g.chamadas[0].url).toBe(`https://places.googleapis.com/v1/places/${PLACE_A}`);
  });

  it("fica uns minutos na memória do servidor, e depois pergunta outra vez", async () => {
    const g = googleFingido({ [PLACE_A]: { rating: 4.6, userRatingCount: 230 } });
    const t0 = 1_000_000;
    await notaNoGoogle(PLACE_A, { busca: g.busca, agora: t0 });
    await notaNoGoogle(PLACE_A, { busca: g.busca, agora: t0 + 60_000 });
    expect(g.chamadas).toHaveLength(1);
    await notaNoGoogle(PLACE_A, { busca: g.busca, agora: t0 + 6 * 60_000 });
    expect(g.chamadas).toHaveLength(2);
  });

  it("falha ou demora: null, sem esperar mais do que o prazo", async () => {
    const g = googleFingido({ [PLACE_A]: 500 });
    expect(await notaNoGoogle(PLACE_A, { busca: g.busca })).toBeNull();
    const parado = vi.fn(
      (_u: unknown, init?: RequestInit) =>
        new Promise<Response>((_, rejeitar) => init?.signal?.addEventListener("abort", () => rejeitar(new Error("abortado")))),
    ) as unknown as typeof fetch;
    const antes = Date.now();
    expect(await notaNoGoogle(PLACE_B, { busca: parado, prazoMs: 50 })).toBeNull();
    expect(Date.now() - antes).toBeLessThan(1000);
  });

  it("um place_id estranho não sai do servidor", async () => {
    const g = googleFingido({});
    expect(lerPlaceId("../../admin")).toBeNull();
    expect(lerPlaceId("abc")).toBeNull();
    expect(await notaNoGoogle("x/../y?key=1", { busca: g.busca })).toBeNull();
    expect(g.chamadas).toHaveLength(0);
  });

  it("a procura pede só id, nome, morada e link, em Portugal", async () => {
    let corpo: Record<string, unknown> = {};
    let campos: string | null = null;
    const busca = vi.fn(async (_u: unknown, init?: RequestInit) => {
      corpo = JSON.parse(String(init?.body));
      campos = new Headers(init?.headers).get("X-Goog-FieldMask");
      return new Response(
        JSON.stringify({
          places: [{ id: PLACE_A, displayName: { text: "Mudanças Exemplo" }, formattedAddress: "Rua C, Almada", googleMapsUri: "https://maps.google.com/?cid=1" }],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const r = await procurarFichasNoGoogle("Mudanças Exemplo", busca);
    expect(r).toEqual({ ok: true, fichas: [{ placeId: PLACE_A, nome: "Mudanças Exemplo", morada: "Rua C, Almada", mapsUri: "https://maps.google.com/?cid=1" }] });
    expect(campos).toBe("places.id,places.displayName,places.formattedAddress,places.googleMapsUri");
    expect(corpo).toMatchObject({ textQuery: "Mudanças Exemplo", regionCode: "PT" });
  });

  it("a Places API (New) desligada diz-se como tal", async () => {
    const busca = vi.fn(async () => new Response(JSON.stringify({ error: { status: "PERMISSION_DENIED", details: [{ reason: "SERVICE_DISABLED" }] } }), { status: 403 })) as unknown as typeof fetch;
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await procurarFichasNoGoogle("Mudanças", busca)).toEqual({ ok: false, motivo: "api_desligada" });
    aviso.mockRestore();
  });
});

describe("a lista com a nota do Google", () => {
  it("só os que têm ficha confirmada; falha ou < 5 avaliações: sem a linha; a nota da CLYON fica como estava", async () => {
    const g = googleFingido({
      [PLACE_A]: { rating: 4.6, userRatingCount: 230 },
      [PLACE_B]: { rating: 5, userRatingCount: 3 },
      ChIJCCCCCCCCCCCCCCCCCCCCCCC: 503,
    });
    const candidatos = [
      candidato(1, PLACE_A),
      candidato(2, PLACE_B),
      candidato(3, "ChIJCCCCCCCCCCCCCCCCCCCCCCC"),
      candidato(4, null),
    ];
    const r = await listaDosParceirosDaMudanca(pedido(), new Date("2026-11-11T10:00:00Z"), candidatos as never, {
      comNotaDoGoogle: true,
      busca: g.busca,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const porNome = Object.fromEntries(r.cartoes.map((c) => [c.nome, c]));
    expect(porNome["Parceiro 1"].notaGoogle?.texto).toBe("4,6 no Google (230 avaliações)");
    expect(porNome["Parceiro 1"].notaGoogle?.atribuicao).toBe("Google Maps");
    expect(porNome["Parceiro 2"].notaGoogle).toBeNull();
    expect(porNome["Parceiro 3"].notaGoogle).toBeNull();
    expect(porNome["Parceiro 4"].notaGoogle).toBeNull();
    // Nunca uma média das duas: a da CLYON é a das avaliações da CLYON.
    expect(porNome["Parceiro 1"].nota?.media).toBe(4.8);
    // Em paralelo, uma vez por ficha; o 4 (sem ficha confirmada) não pergunta nada.
    expect(g.chamadas).toHaveLength(3);
    // O cartão não leva o place_id nem um link do Google.
    const texto = JSON.stringify(r.cartoes);
    expect(texto).not.toContain(PLACE_A);
    expect(texto).not.toMatch(/googleapis|maps\.google|google\.com/);
  });

  it("sem a opção (a conferência do pedido), não pergunta ao Google", async () => {
    const g = googleFingido({ [PLACE_A]: { rating: 4.6, userRatingCount: 230 } });
    const r = await listaDosParceirosDaMudanca(pedido(), new Date("2026-11-11T10:00:00Z"), [candidato(1, PLACE_A)] as never, {
      busca: g.busca,
    });
    expect(r.ok && r.cartoes[0].notaGoogle).toBeNull();
    expect(g.chamadas).toHaveLength(0);
  });

  it("a rota pública da lista pede-a; a do pedido não", () => {
    expect(ler("src/app/api/mudancas/parceiros/route.ts")).toContain("comNotaDoGoogle: true");
    expect(ler("src/lib/mudanca-com-parceiros-escolhidos.ts")).not.toContain("comNotaDoGoogle");
  });

  it("a prova do pedido nunca guarda a nota do Google", () => {
    const cartao = { id: "x", nome: "P", notaGoogle: { media: 4.6, avaliacoes: 230, texto: "4,6 no Google (230 avaliações)", atribuicao: "Google Maps" } };
    const p = provaDaEscolha(
      {
        pedidoDaLista: pedido(),
        pessoas: 2,
        escolhidos: [],
        cartoesVistos: [cartao] as never,
        kmPercurso: 20,
        horas: 5.5,
        origemPonto: { lat: 0, lng: 0 },
        destinoPonto: { lat: 0, lng: 0 },
        procurarMais: false,
      } as never,
      new Date("2026-11-11T13:00:00Z"),
      new Date("2026-11-11T10:00:00Z"),
    );
    expect(JSON.stringify(p)).not.toContain("no Google");
    expect((p.cartoesVistos[0] as { notaGoogle: unknown }).notaGoogle).toBeNull();
  });
});

describe("na base, só o place_id — e só o confirmado conta", () => {
  const DB = ler("src/lib/db.ts");
  /** A nota ou as avaliações do Google (o `clientRating` da CLYON não conta). */
  const DO_GOOGLE = /userRatingCount|google\w*(rating|nota|avalia)|(rating|nota|avalia)\w*google/i;

  it("as colunas do Google em providers são só as quatro da ficha", () => {
    const colunas = [...DB.matchAll(/ALTER TABLE providers ADD COLUMN (\w+)/g)].map((m) => m[1]).filter((c) => /google/i.test(c));
    expect(colunas.sort()).toEqual(["googlePlaceConfirmadoEm", "googlePlaceConfirmadoPor", "googlePlaceId", "googlePlaceIdProposto"]);
  });

  it("nenhuma coluna nem escrita com a nota ou as avaliações do Google", () => {
    for (const m of DB.matchAll(/(?:ADD COLUMN|CREATE TABLE[^(]*\()([^;`]*)/g)) {
      expect(m[1]).not.toMatch(DO_GOOGLE);
    }
    for (const m of DB.matchAll(/`\s*(?:UPDATE|INSERT)[^`]*`/g)) expect(m[0]).not.toMatch(DO_GOOGLE);
  });

  it("a lista lê só a confirmada (com a data da confirmação), nunca a proposta", () => {
    const i = DB.indexOf("export async function candidatosDaListaDasMudancas");
    const corpo = DB.slice(i, DB.indexOf("\n}\n", i));
    expect(corpo).toContain("CASE WHEN p.googlePlaceConfirmadoEm IS NOT NULL THEN p.googlePlaceId END");
    expect(corpo).not.toContain("googlePlaceIdProposto");
  });

  it("confirmar regista quem e quando, e só a ficha que o administrador viu", () => {
    const i = DB.indexOf("export async function confirmarFichaDoGoogle");
    const corpo = DB.slice(i, DB.indexOf("\n}\n", i));
    expect(corpo).toContain("googlePlaceId = googlePlaceIdProposto");
    expect(corpo).toContain("googlePlaceConfirmadoEm = NOW()");
    expect(corpo).toContain("googlePlaceConfirmadoPor = ?");
    expect(corpo).toContain("AND googlePlaceIdProposto = ?");
  });

  it("o parceiro propor não mexe na confirmada", () => {
    const i = DB.indexOf("export async function proporFichaDoGoogle");
    const corpo = DB.slice(i, DB.indexOf("\n}\n", i));
    expect(corpo).toContain("SET googlePlaceIdProposto =");
    expect(corpo).not.toMatch(/SET googlePlaceId\s*=|googlePlaceConfirmadoEm\s*=/);
  });
});

describe("as rotas", () => {
  it("a procura e a proposta só com sessão de profissional, com limite por conta; o providerId vem da sessão", () => {
    for (const f of ["src/app/api/profissionais/ficha-google/procurar/route.ts", "src/app/api/profissionais/ficha-google/route.ts"]) {
      const s = ler(f);
      expect(s).toContain("sessaoActivaDoProfissional(tokenDoProfissional(req))");
      expect(s).toContain('{ status: 401 }');
      expect(s).toMatch(/limitarPorConta\("ficha-google-[a-z]+", `pro:\$\{sessao\.providerId\}`/);
      expect(s).not.toMatch(/corpo[^\n]*providerId/);
    }
    const procura = ler("src/app/api/profissionais/ficha-google/procurar/route.ts");
    expect(procura).toContain("limitarRotaPublica(req, \"ficha-google-procura\"");
    // A sessão antes do limite e antes do Google.
    expect(procura.indexOf("sessaoActivaDoProfissional")).toBeLessThan(procura.indexOf("limitarPorConta("));
    expect(procura.indexOf("limitarPorConta(")).toBeLessThan(procura.indexOf("procurarFichasNoGoogle(texto)"));
  });

  it("no backoffice: ver com a secção; confirmar, recusar e retirar só o administrador", () => {
    const s = ler("src/app/api/admin/profissionais/[id]/ficha-google/route.ts");
    const get = s.slice(s.indexOf("export async function GET"), s.indexOf("export async function POST"));
    const post = s.slice(s.indexOf("export async function POST"));
    expect(get).toContain("await requireAdmin(req)");
    expect(post).toContain("await requireAdminGeral(req)");
    expect(post).toContain("confirmarFichaDoGoogle(providerId, placeId, colab.nome)");
  });
});

describe("os ecrãs", () => {
  it("o cartão do simulador mostra a nota do Google com a atribuição, noutra linha", () => {
    const s = ler("src/app/simulador/components/ParceirosDaMudanca.tsx");
    expect(s).toContain("p.notaGoogle.texto");
    expect(s).toContain("p.notaGoogle.atribuicao");
  });

  it("o painel e a app Pro têm «A minha ficha no Google», com os mesmos textos", () => {
    expect(TEXTOS_DA_FICHA_NO_GOOGLE.titulo).toBe("A minha ficha no Google");
    expect(ler("src/app/profissionais/painel/PainelDoProfissional.tsx")).toContain('rotulo="A minha ficha no Google"');
    expect(ler("app-pro/src/app/(app)/conta.tsx")).toContain('titulo="A minha ficha no Google"');
    expect(ler("app-pro/src/app/_layout.tsx")).toContain('name="conta/google"');
    expect(ler("app-pro/src/app/conta/google.tsx")).toContain("estado-da-ficha-no-google");
    expect(ler("src/app/profissionais/painel/FichaNoGoogle.tsx")).toContain("TEXTOS_DA_FICHA_NO_GOOGLE");
  });

  it("o estado da ficha", () => {
    expect(estadoDaFicha(null)).toBe("sem_ficha");
    expect(estadoDaFicha({ placeId: null, proposto: PLACE_A })).toBe("a_espera");
    expect(estadoDaFicha({ placeId: PLACE_A, proposto: null })).toBe("confirmada");
    expect(estadoDaFicha({ placeId: PLACE_A, proposto: PLACE_B })).toBe("confirmada_e_nova_a_espera");
    expect(TEXTOS_DA_FICHA_NO_GOOGLE.estados.a_espera).toBe("À espera de confirmação da CLYON.");
  });
});
