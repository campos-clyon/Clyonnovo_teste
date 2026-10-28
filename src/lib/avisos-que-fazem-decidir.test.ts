import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * OS AVISOS AO PROFISSIONAL DIZEM O QUE FAZ DECIDIR — 28-10-2026 (d5).
 *
 * (a) O pedido novo no telemóvel leva o serviço, quando, os km, as
 *     fotografias e o que ele recebe — os números do email.
 * (b) O cliente responder com outro valor toca no telemóvel.
 * (c) Quem fica sem o trabalho (ficou com outro, ou o cliente desistiu) é
 *     avisado, sem preços dos outros.
 * (d) A lista de Profissionais do backoffice diz em quanto tempo cada um
 *     responde.
 */

vi.mock("@/lib/db", () => ({
  negociacoesDoPedido: vi.fn(async () => []),
  perfilDoProfissional: vi.fn(async (id: number) => ({ email: `pro${id}@exemplo.pt` })),
}));
vi.mock("@/lib/avisar-por-push", () => ({
  avisarProfissionalSemOTrabalhoPorPush: vi.fn(async () => {}),
}));

import * as db from "@/lib/db";
import { avisarProfissionalSemOTrabalhoPorPush } from "@/lib/avisar-por-push";
import {
  NEGOCIACAO_TERMINADA,
  PORQUE_A_NEGOCIACAO_TERMINOU,
  avisoDaContraproposta,
  avisoDePedidoNovo,
  avisoSemOTrabalho,
  porqueTerminou,
} from "./textos-dos-avisos-ao-profissional";
import { avisarQuemFicouSemOTrabalho, quemFicaSemOTrabalho, quemVaiFicarSemOTrabalho } from "./avisar-quem-perdeu";
import { mediana, primeiraPropostaDoProfissional, tempoEmPalavras, temposDeResposta } from "./tempo-de-resposta";

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

beforeEach(() => vi.clearAllMocks());

describe("(a) o pedido novo diz o que decide", () => {
  it("numa negociação: serviço, quando, km, fotografias e a sugestão CLYON no que recebe", () => {
    expect(
      avisoDePedidoNovo({
        servico: "Recolha de móveis",
        cidade: "Almada",
        urgencia: "tomorrow",
        distanciaKm: 12.4,
        fotografias: 3,
        recebe: 89,
      }),
    ).toEqual({
      title: "Pedido novo · Almada",
      body: "Recolha de móveis · amanhã · 12 km · 3 fotografias. Sugestão CLYON: recebe 89,00 €.",
    });
  });

  it("sem valor de partida, a proposta é dele; por carga, o valor leva a unidade", () => {
    expect(avisoDePedidoNovo({ servico: "Esvaziamento", cidade: "Seixal", fotografias: 0 }).body).toBe(
      "Esvaziamento · sem fotografias. A proposta é sua.",
    );
    expect(avisoDePedidoNovo({ servico: "Recolha de entulho", cidade: "Setúbal", recebe: 150, base: "carga" }).body).toBe(
      "Recolha de entulho. Sugestão CLYON: recebe 150,00 € por carga.",
    );
  });

  it("num Trabalho CLYON: o valor fixo, e aceitar ou recusar", () => {
    expect(
      avisoDePedidoNovo({
        servico: "Recolha de móveis",
        cidade: "Lisboa",
        urgencia: "today",
        distanciaKm: 7,
        recebe: 120,
        trabalhoClyon: true,
      }),
    ).toEqual({
      title: "Trabalho CLYON · Lisboa",
      body: "Recolha de móveis · hoje · 7 km. Valor fixo: recebe 120,00 €. Aceite ou recuse.",
    });
  });

  it("o distribuir passa os dados, depois do email, com o número do email", () => {
    const D = ler("src/lib/distribuir-pedido.ts");
    const i = D.indexOf("await avisarProfissionalDePedidoPorPush({");
    expect(i).toBeGreaterThan(D.indexOf("await avisarProfissional({"));
    const chamada = D.slice(i, D.indexOf("});", i));
    for (const campo of [
      "urgencia: pedido.urgency",
      "distanciaKm: c.distanciaKm",
      "fotografias: pedido.quantidadeDeFotos",
      "recebe,",
      "trabalhoClyon: Boolean(oferta)",
    ]) {
      expect(chamada, campo).toContain(campo);
    }
    // O mesmo «recebe» que vai ao email (recebeLiquido).
    expect(D).toContain("recebeLiquido: recebe,");
    expect(ler("src/lib/avisar-por-push.ts")).toContain("avisoDePedidoNovo({");
  });
});

describe("(b) a resposta do cliente toca no telemóvel", () => {
  it("o valor e o que recebe, como no email", () => {
    expect(avisoDaContraproposta({ pedidoId: 512, valor: 300, recebe: 267 })).toEqual({
      title: "O cliente respondeu — #512",
      body: "Propõe 300,00 € — recebe 267,00 €. Toque para responder.",
    });
  });

  it("sai depois do email, com as taxas da negociação", () => {
    const A = ler("src/lib/avisar-da-proposta.ts");
    const email = A.indexOf("await avisarProfissionalDaProposta({");
    const push = A.indexOf("await avisarProfissionalDaContrapropostaPorPush({");
    expect(email).toBeGreaterThan(-1);
    expect(push).toBeGreaterThan(email);
    expect(A.slice(push, push + 400)).toContain("recebe: quantoOProfissionalRecebe(dados.valor, taxas)");
  });
});

describe("(c) quem fica sem o trabalho é avisado, sem preços dos outros", () => {
  it("as frases", () => {
    const outro = avisoSemOTrabalho({ pedidoId: 77, porque: "outro" });
    expect(outro.title).toBe(NEGOCIACAO_TERMINADA);
    expect(outro.body).toBe(
      "O #77 ficou com outro profissional. Obrigado por ter respondido — os pedidos novos da sua zona estão em Novos.",
    );
    expect(avisoSemOTrabalho({ pedidoId: 77, porque: "desistiu" }).body).toBe(
      "O cliente não seguiu com a sua proposta para o #77.",
    );
    for (const p of ["outro", "desistiu"] as const) expect(avisoSemOTrabalho({ pedidoId: 1, porque: p }).body).not.toContain("€");
  });

  it("quem perde: as outras em aberto, nunca a que fechou nem as já terminadas", () => {
    const todas = [
      { id: 1, estado: "acordada", providerId: 10 },
      { id: 2, estado: "aberta", providerId: 20 },
      { id: 3, estado: "aguarda_contratacao", providerId: 30 },
      { id: 4, estado: "desistida", providerId: 40 },
      { id: 5, estado: "morta", providerId: 50 },
    ];
    expect(quemFicaSemOTrabalho(todas, 1)).toEqual([
      { negociacaoId: 2, providerId: 20 },
      { negociacaoId: 3, providerId: 30 },
    ]);
  });

  it("avisa cada um no telemóvel dele, e uma falha não para os outros", async () => {
    vi.mocked(db.perfilDoProfissional).mockImplementationOnce(async () => {
      throw new Error("base em baixo");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await avisarQuemFicouSemOTrabalho({
      pedidoId: 77,
      quem: [
        { negociacaoId: 2, providerId: 20 },
        { negociacaoId: 3, providerId: 30 },
      ],
      porque: "outro",
    });
    expect(avisarProfissionalSemOTrabalhoPorPush).toHaveBeenCalledTimes(1);
    expect(vi.mocked(avisarProfissionalSemOTrabalhoPorPush).mock.calls[0][0]).toMatchObject({
      pedidoId: 77,
      porque: "outro",
    });
  });

  it("ler a lista nunca lança", async () => {
    vi.mocked(db.negociacoesDoPedido).mockRejectedValueOnce(new Error("x"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await quemVaiFicarSemOTrabalho(9, 1)).toEqual([]);
  });

  it("os quatro sítios que fecham lêem quem perde ANTES de encerrar, e avisam DEPOIS", () => {
    const sitios = [
      "src/lib/agir-como-cliente.ts",
      "src/app/api/profissionais/negociacao/route.ts",
      "src/app/api/admin/negociacoes/agir/route.ts",
      "src/lib/whatsapp-negociacao.ts",
    ];
    for (const f of sitios) {
      const s = ler(f);
      const encerra = s.indexOf("await encerrarOutrasNegociacoes(");
      const le = s.search(/quemFicaSemOTrabalho\(|quemVaiFicarSemOTrabalho\(/);
      const avisa = s.indexOf("avisarQuemFicouSemOTrabalho({", encerra);
      expect(encerra, f).toBeGreaterThan(-1);
      expect(le, f).toBeGreaterThan(-1);
      expect(le, f).toBeLessThan(encerra);
      expect(avisa, f).toBeGreaterThan(encerra);
    }
  });

  it("o cliente desistir avisa o profissional — pelas portas do cliente e pela Mesa", () => {
    for (const f of ["src/lib/agir-como-cliente.ts", "src/app/api/admin/negociacoes/agir/route.ts"]) {
      expect(ler(f), f).toMatch(
        /accao === "desistir" && nova\.estado === "desistida"\) \{\s*await avisarQuemFicouSemOTrabalho\(\{[\s\S]*?porque: "desistiu"/,
      );
    }
  });

  it("o ecrã «Negociação terminada» da app tem as frases do painel", () => {
    expect(PORQUE_A_NEGOCIACAO_TERMINOU).toEqual({
      outro: "Ficou com outro profissional.",
      desistida: "Um dos lados desistiu da negociação.",
      cancelado: "O pedido foi cancelado.",
    });
    expect(porqueTerminou({ estado: "morta" })).toBe("outro");
    expect(porqueTerminou({ estado: "morta", pedidoCancelado: true })).toBe("cancelado");
    expect(porqueTerminou({ estado: "desistida" })).toBe("desistida");
    expect(porqueTerminou({ estado: "aberta" })).toBeNull();
  });
});

describe("(d) «Responde em», na lista de Profissionais", () => {
  const AGORA = new Date("2026-10-28T12:00:00Z");
  const prop = (por: string, criadaEm: string) => ({ por, valor: 100, criadaEm, estado: "pendente" });

  it("a primeira proposta é a DELE", () => {
    const j = JSON.stringify([
      prop("cliente", "2026-10-27T09:00:00Z"),
      prop("profissional", "2026-10-27T10:30:00Z"),
      prop("profissional", "2026-10-27T10:10:00Z"),
    ]);
    expect(primeiraPropostaDoProfissional(j)?.toISOString()).toBe("2026-10-27T10:10:00.000Z");
    expect(primeiraPropostaDoProfissional("lixo")).toBeNull();
  });

  it("a mediana dos últimos 30 dias, sem Trabalhos CLYON nem os antigos", () => {
    const n = (createdAt: string, propostaEm: string | null, extra: Record<string, unknown> = {}) => ({
      providerId: 7,
      createdAt,
      abertoProfissionalEm: null,
      propostasJson: propostaEm ? JSON.stringify([prop("profissional", propostaEm)]) : "[]",
      ...extra,
    });
    const t = temposDeResposta(
      [
        n("2026-10-27T10:00:00Z", "2026-10-27T10:10:00Z"), // 10 min
        n("2026-10-26T10:00:00Z", "2026-10-26T10:30:00Z"), // 30 min
        n("2026-10-25T10:00:00Z", "2026-10-25T14:00:00Z"), // 240 min
        n("2026-10-24T10:00:00Z", null), // sem proposta
        n("2026-09-01T10:00:00Z", "2026-09-01T10:01:00Z"), // fora dos 30 dias
        n("2026-10-27T10:00:00Z", "2026-10-27T10:01:00Z", { ofertaClyon: "distribuida" }),
      ],
      AGORA,
    ).get(7);
    expect(t).toEqual({ minutosAtePropor: 30, minutosAteAbrir: null, pedidos: 3 });
  });

  it("em palavras", () => {
    expect(mediana([])).toBeNull();
    expect(tempoEmPalavras(null)).toBe("—");
    expect(tempoEmPalavras(0.4)).toBe("1 min");
    expect(tempoEmPalavras(25)).toBe("25 min");
    expect(tempoEmPalavras(80)).toBe("1 h 20 min");
    expect(tempoEmPalavras(300)).toBe("5 h");
    expect(tempoEmPalavras(60 * 50)).toBe("2 dias");
  });

  it("a rota dá-a a cada profissional, e o painel mostra-a, só de leitura", () => {
    const R = ler("src/app/api/admin/profissionais/route.ts");
    expect(R).toContain("respondeEm: rapidez.get(Number(p.id)) ?? null,");
    expect(R).toContain("negociacoesParaMedirARapidez(");
    expect(R).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    const P = ler("src/components/admin/AdminProfissionaisPanel.tsx");
    expect(P).toContain("tempoEmPalavras(p.respondeEm?.minutosAtePropor ?? null)");
    expect(P).toContain("responde em");
    const DB = ler("src/lib/db.ts");
    const ini = DB.indexOf("export async function negociacoesParaMedirARapidez");
    expect(ini).toBeGreaterThan(-1);
    const f = DB.slice(ini, DB.indexOf("export async function", ini + 10));
    expect(f).toMatch(/SELECT n\.providerId, n\.createdAt, n\.abertoProfissionalEm, n\.propostasJson, n\.ofertaClyon/);
    expect(f).not.toMatch(/UPDATE|INSERT|DELETE/);
  });
});

describe("a lista fechada dos avisos", () => {
  it("as funções novas mandam ao telemóvel do profissional e engolem os erros", () => {
    const PUSH = ler("src/lib/avisar-por-push.ts");
    for (const nome of ["avisarProfissionalDaContrapropostaPorPush", "avisarProfissionalSemOTrabalhoPorPush"]) {
      const i = PUSH.indexOf(`export async function ${nome}`);
      expect(i, nome).toBeGreaterThan(-1);
      const corpo = PUSH.slice(i, PUSH.indexOf("\nexport ", i + 10));
      expect(corpo, nome).toMatch(/sendPushToUser\([\s\S]*?"pro"\)/);
      expect(corpo, nome).toContain("negociacaoId");
      expect(corpo, nome).toMatch(/try \{[\s\S]*\} catch/);
    }
  });
});
