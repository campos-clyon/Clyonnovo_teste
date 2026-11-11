import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * O PERCURSO DA MUDANÇA SÓ ENQUANTO HÁ TRABALHO — 11-11-2026.
 *
 * Ao lado de `contacto-so-enquanto-ha-trabalho.test.ts` (d3, 28-10-2026): a
 * mesma regra, agora no mapa do percurso e no «Abrir no Google Maps». Com o
 * trabalho confirmado, pago, arquivado ou com a negociação morta, o parceiro
 * volta a receber só as localidades — sem moradas de porta a porta, sem
 * traçado e sem coordenadas. Lê-se a RESPOSTA das duas rotas.
 */

const estado = vi.hoisted(() => ({
  negociacao: null as Record<string, unknown> | null,
  pedidosAoGoogle: [] as string[],
  tracados: 0,
}));

vi.mock("@/lib/sessao-activa-do-profissional", () => ({
  sessaoActivaDoProfissional: vi.fn(async () => ({ providerId: 7, nome: "Profissional de exemplo" })),
}));
vi.mock("@/lib/profissional-auth", () => ({ tokenDoProfissional: vi.fn(() => "token") }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/maps-config", () => ({ getMapsApiKey: vi.fn(() => "CHAVE-DE-TESTE") }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, count: 1, limit: 60 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));
vi.mock("@/lib/percurso-do-pedido", () => ({
  percursoDoPedido: vi.fn(async () => {
    estado.tracados += 1;
    return { versao: 1, km: 14, minutos: 22, polyline: "_p~iF~ps|U", em: "2026-11-11T10:00:00.000Z" };
  }),
}));
vi.mock("@/lib/db", () => ({
  negociacoesDoProfissional: vi.fn(async () => []),
  getPool: vi.fn(async () => null),
  custosEBaseDoProfissional: vi.fn(async () => null),
  mudancasEscolhidasDoProfissional: vi.fn(async () => new Map()),
  percursoDaNegociacao: vi.fn(async () => estado.negociacao),
}));
vi.mock("@/lib/pricing-helper", () => ({
  getActivePricingMap: vi.fn(async () => {
    throw new Error("sem parâmetros no teste");
  }),
}));
vi.mock("@/lib/distancia-rodoviaria", () => ({ distanciasRodoviarias: vi.fn(async () => []) }));
vi.mock("@/lib/carteira-do-profissional", () => ({ pagamentosAVerificar: vi.fn(async () => new Map()) }));

import * as db from "@/lib/db";
import { GET as meusPedidos } from "@/app/api/profissionais/meus-pedidos/route";
import { GET as mapa } from "@/app/api/mapa/route";
import { caminhoDoMapaDoPercurso, percursoParaOParceiro, podeVerAMoradaExacta } from "./mapa-do-percurso";
import { contactoJaNaoServe } from "./contacto-so-enquanto-ha-trabalho";
import type { FaseDoTrabalho } from "./trabalho";

const ACORDO = new Date("2026-11-08T10:00:00Z");
const FEITO = new Date("2026-11-09T10:00:00Z");
const CONFIRMADO = new Date("2026-11-10T10:00:00Z");
const PAGO = new Date("2026-11-11T10:00:00Z");

/** As moradas (inventadas) nunca podem aparecer depois do fim. */
const ORIGEM = "Rua de Exemplo, 10, Amora";
const DESTINO = "Rua de Exemplo, 2, Barreiro";

function linha(n: Record<string, unknown> = {}) {
  return {
    id: 501,
    pedidoId: 9001,
    providerId: 7,
    estado: "acordada",
    valorAcordado: "50.00",
    propostasJson: null,
    createdAt: ACORDO,
    updatedAt: ACORDO,
    taxaCliente: "0",
    taxaProfissional: "0.10",
    formaDePagamento: "na_plataforma",
    ofertaClyon: null,
    valorFixoClyon: null,
    ajustesJson: null,
    execucaoEnviadaEm: null,
    confirmadoEm: null,
    pagoEm: null,
    avaliadoEm: null,
    arquivadoProfissionalEm: null,
    abertoProfissionalEm: ACORDO,
    estrelas: null,
    serviceType: "mudanca",
    city: "Amora",
    address: ORIGEM,
    moradaDestino: DESTINO,
    localidadeDestino: "Barreiro",
    contactName: "Cliente de exemplo",
    contactPhone: "+351 912 345 678",
    contactEmail: "cliente@example.com",
    estadoDoPedido: "em_curso",
    concorrentes: 0,
    ...n,
  };
}

const ESCOLHIDA = {
  tarifaCongeladaJson: "{}",
  pessoasEscolhidas: 2,
  prazoRespostaEm: null,
  horas: "7",
  km: "14",
  folhaJson: null,
  folhaHistoricoJson: null,
  folhaNaMesaEm: null,
  percursoJson: JSON.stringify({ versao: 1, km: 14, minutos: 22, polyline: "_p~iF~ps|U", em: "2026-11-11T10:00:00.000Z" }),
  cidadeOrigem: "Amora",
  cidadeDestino: "Barreiro",
};

type Percurso = { texto: string; mapa: string; direccoes: string | null; exacto: boolean; deOndeParaOnde: string | null };

async function percursoDe(n: Record<string, unknown>) {
  vi.mocked(db.negociacoesDoProfissional).mockResolvedValueOnce([linha(n)] as never);
  vi.mocked(db.mudancasEscolhidasDoProfissional).mockResolvedValueOnce(new Map([[501, ESCOLHIDA]]) as never);
  const r = await meusPedidos(new NextRequest("https://clyon.pt/api/profissionais/meus-pedidos"));
  expect(r.status).toBe(200);
  const corpo = (await r.json()) as { pedidos: Array<Record<string, unknown>> };
  expect(corpo.pedidos).toHaveLength(1);
  const t = corpo.pedidos[0];
  expect(t.percurso, "o bloco do percurso tem de vir").toBeTruthy();
  return { t, p: t.percurso as Percurso };
}

beforeEach(() => {
  vi.clearAllMocks();
  estado.negociacao = null;
  estado.pedidosAoGoogle = [];
  estado.tracados = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      estado.pedidosAoGoogle.push(String(url));
      return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { "content-type": "image/png" } });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("o bloco «percurso» de /api/profissionais/meus-pedidos", () => {
  const ACABADOS: Array<[string, Record<string, unknown>]> = [
    ["confirmado", { execucaoEnviadaEm: FEITO, confirmadoEm: CONFIRMADO }],
    ["pago", { execucaoEnviadaEm: FEITO, confirmadoEm: CONFIRMADO, pagoEm: PAGO }],
    ["arquivado pelo parceiro", { arquivadoProfissionalEm: PAGO }],
    ["com a negociação morta", { estado: "morta" }],
  ];

  for (const [nome, n] of ACABADOS) {
    it(`trabalho ${nome}: só as localidades — sem moradas nem ligação de porta a porta`, async () => {
      const { t, p } = await percursoDe(n);
      expect(p.exacto).toBe(false);
      expect(p.deOndeParaOnde).toBe("Amora → Barreiro");
      expect(p.mapa).toBe(caminhoDoMapaDoPercurso(501, false));
      expect(p.mapa).not.toContain("e=1");
      const direccoes = decodeURIComponent(p.direccoes ?? "");
      expect(direccoes).toContain("Amora, Portugal");
      expect(direccoes).toContain("Barreiro, Portugal");
      // Nada das moradas em sítio nenhum do trabalho que sai para o parceiro.
      const tudo = decodeURIComponent(JSON.stringify(t));
      expect(tudo).not.toContain("Rua de Exemplo");
      // Os km e o tempo continuam lá: não dizem onde é a porta.
      expect(p.texto).toBe("14 km · cerca de 22 min");
    });
  }

  it("por fazer, tem o percurso de porta a porta para fazer o trabalho", async () => {
    const { t, p } = await percursoDe({});
    expect(t.fase).toBe("a_executar");
    expect(p.exacto).toBe(true);
    expect(p.mapa).toBe(caminhoDoMapaDoPercurso(501, true));
    expect(decodeURIComponent(p.direccoes ?? "")).toContain(ORIGEM);
    expect(decodeURIComponent(p.direccoes ?? "")).toContain(DESTINO);
  });

  it("feito e à espera da confirmação, ainda o tem", async () => {
    const { p } = await percursoDe({ execucaoEnviadaEm: FEITO });
    expect(p.exacto).toBe(true);
  });
});

describe("a rota do mapa do percurso (/api/mapa?percurso=)", () => {
  const RAW = JSON.stringify({
    originAddress: { lat: 38.6291, lng: -9.1167, formattedAddress: ORIGEM, city: "Amora" },
    destinationAddress: { lat: 38.6631, lng: -9.0724, formattedAddress: DESTINO, city: "Barreiro" },
  });
  const negociacao = (n: Record<string, unknown> = {}) => ({
    negociacaoId: 501,
    pedidoId: 9001,
    providerId: 7,
    estado: "acordada",
    execucaoEnviadaEm: null,
    confirmadoEm: null,
    pagoEm: null,
    arquivadoProfissionalEm: null,
    rawOrderJson: RAW,
    percursoJson: null,
    ...n,
  });

  async function pedirOMapa(n: Record<string, unknown>) {
    estado.negociacao = negociacao(n);
    // `e=1` vem de propósito: um parâmetro nunca decide a morada.
    const r = await mapa(new NextRequest("https://clyon.pt/api/mapa?percurso=501&w=640&h=240&e=1"));
    expect(r.status).toBe(200);
    expect(estado.pedidosAoGoogle).toHaveLength(1);
    return decodeURIComponent(estado.pedidosAoGoogle[0]);
  }

  const ACABADOS: Array<[string, Record<string, unknown>]> = [
    ["confirmado", { execucaoEnviadaEm: FEITO, confirmadoEm: CONFIRMADO }],
    ["pago", { execucaoEnviadaEm: FEITO, confirmadoEm: CONFIRMADO, pagoEm: PAGO }],
    ["arquivado pelo parceiro", { arquivadoProfissionalEm: PAGO }],
    ["com a negociação morta", { estado: "morta" }],
  ];

  for (const [nome, n] of ACABADOS) {
    it(`trabalho ${nome}: só as duas localidades — sem coordenadas, sem moradas, sem traçado`, async () => {
      const url = await pedirOMapa(n);
      expect(url).toContain("Amora, Portugal");
      expect(url).toContain("Barreiro, Portugal");
      expect(url).not.toContain("38.6291");
      expect(url).not.toContain("38.6631");
      expect(url).not.toContain("Rua de Exemplo");
      expect(url).not.toContain("path=");
      // O traçado nem se pede (nem se paga) quando não se pode mostrar.
      expect(estado.tracados).toBe(0);
    });
  }

  it("por fazer: os dois pontos e o traçado", async () => {
    const url = await pedirOMapa({});
    expect(url).toContain("38.6291,-9.1167");
    expect(url).toContain("enc:_p~iF~ps|U");
    expect(estado.tracados).toBe(1);
  });

  it("de outro parceiro (a base não a devolve): 404, e nada se pede ao Google", async () => {
    estado.negociacao = null;
    const r = await mapa(new NextRequest("https://clyon.pt/api/mapa?percurso=501"));
    expect(r.status).toBe(404);
    expect(estado.pedidosAoGoogle).toHaveLength(0);
  });
});

describe("a regra, numa função só — a do contacto", () => {
  it("a morada exacta é o contrário de «o contacto já não serve», em todas as fases", () => {
    const fases: FaseDoTrabalho[] = ["a_negociar", "a_executar", "a_confirmar", "confirmado", "pago"];
    for (const estadoDaNegociacao of ["acordada", "aberta", "morta", "recusada"]) {
      for (const fase of fases) {
        for (const arquivadoEm of [null, "2026-11-11"]) {
          const t = { estado: estadoDaNegociacao, fase, arquivadoEm };
          expect(podeVerAMoradaExacta(t), JSON.stringify(t)).toBe(!contactoJaNaoServe(t));
        }
      }
    }
  });

  it("mesmo que alguém lhe passe as moradas, o bloco não as usa num trabalho acabado", () => {
    const p = percursoParaOParceiro({
      negociacaoId: 7,
      estado: "acordada",
      fase: "pago",
      percurso: null,
      kmDoPercurso: 14,
      cidadeOrigem: "Amora",
      cidadeDestino: "Barreiro",
      moradaOrigem: ORIGEM,
      moradaDestino: DESTINO,
    })!;
    expect(p.exacto).toBe(false);
    expect(decodeURIComponent(JSON.stringify(p))).not.toContain("Rua de Exemplo");
  });
});
