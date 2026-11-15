import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * GRAVAR O NIF NÃO MUDA O REGIME DE IVA — d27, 15-11-2026.
 *
 * A app CLYON Pro instalada (atualização de 13-11, anterior à d19) manda sempre
 * `regimeIva` no ecrã da Faturação, sem `confirmarRegime`, com «isento» por
 * omissão quando o regime está por confirmar. O PUT gravava-o: quem só mudava o
 * NIF ou a morada ficava com o regime guardado reescrito para «isento».
 */

vi.mock("@/lib/sessao-activa-do-profissional", () => ({ sessaoActivaDoProfissional: vi.fn() }));
vi.mock("@/lib/profissional-auth", () => ({
  tokenDoProfissional: () => "x",
  sessaoVemDaApp: () => true,
  renovarSessaoSePreciso: vi.fn(),
  palavraPasseConfere: vi.fn(),
}));
vi.mock("@/lib/limite-rota-publica", () => ({ limitarRotaPublica: vi.fn(async () => ({})) }));
vi.mock("@/lib/geocodificar", () => ({ geocodificarLocalidade: vi.fn(async () => null) }));
vi.mock("@/lib/sugestao-para-o-profissional", () => ({ margemDeReferenciaPercent: vi.fn(async () => 40) }));
vi.mock("@/lib/email-dados-de-pagamento-do-profissional", async (original) => ({
  ...(await original<typeof import("@/lib/email-dados-de-pagamento-do-profissional")>()),
  enviarEmailDosDadosDePagamento: vi.fn(async () => true),
}));
vi.mock("@/lib/db", () => ({
  perfilDoProfissional: vi.fn(),
  avaliacoesDoProfissional: vi.fn(async () => []),
  actualizarPerfilDoProfissional: vi.fn(async () => {}),
  apagarFotosDoBlob: vi.fn(async () => 0),
  fotosDaViatura: vi.fn(async () => []),
  urlDaFotoDaViatura: vi.fn(async () => null),
  invalidarVerificacaoDaGuia: vi.fn(async () => {}),
  custosFixosDeJson: () => null,
  trabalhosConcluidosDoProfissional: vi.fn(async () => 0),
  tarifaDasMudancasDe: vi.fn(async () => null),
  palavraPasseGuardada: vi.fn(),
}));

import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { actualizarPerfilDoProfissional, perfilDoProfissional } from "@/lib/db";
import { PUT } from "@/app/api/profissionais/perfil/route";
import { regimeQueSeGrava } from "./regime-sem-confirmar";
import { DEPOIS_DO_MODELO, comORelogioEm } from "./relogio-dos-testes";

const NIF_NOVO = "501442600";

const pedido = (corpo: unknown) =>
  new NextRequest("https://clyon.pt/api/profissionais/perfil", {
    method: "PUT",
    body: JSON.stringify(corpo),
    headers: { "Content-Type": "application/json" },
  });

/** O que a app instalada manda ao gravar a Faturação (ver app-pro, faturacao.tsx de 13-11). */
const daAppAntiga = (regimeIva: "isento" | "normal") => ({
  emiteFatura: true,
  nif: NIF_NOVO,
  moradaFiscal: "Rua das Oliveiras 14",
  codigoPostalFiscal: "2700-123",
  localidadeFiscal: "Amadora",
  regimeIva,
});

const guardado = (regimeIva: "isento" | "normal", confirmado: boolean) => ({
  id: 7,
  name: "Transportes Silva",
  email: "pro@exemplo.pt",
  nif: "123456789",
  regimeIva,
  regimeIvaConfirmadoEm: confirmado ? new Date("2026-11-13T10:00:00Z") : null,
  iban: null,
  ibanTitular: null,
  mbway: null,
  responsavel: null,
  ibanMudadoEm: null,
});

const gravado = () => {
  const chamadas = vi.mocked(actualizarPerfilDoProfissional).mock.calls;
  expect(chamadas).toHaveLength(1);
  const [, dados, opcoes] = chamadas[0] as unknown as [number, Record<string, unknown>, { confirmarRegime?: boolean }];
  return { dados, confirmarRegime: opcoes?.confirmarRegime === true };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sessaoActivaDoProfissional).mockResolvedValue({ providerId: 7 } as never);
});

describe("a rota do perfil: gravar o NIF não muda o regime", () => {
  comORelogioEm(DEPOIS_DO_MODELO);

  it("regime «normal» por confirmar + a app antiga manda «isento» de omissão: grava o NIF, o regime fica", async () => {
    vi.mocked(perfilDoProfissional).mockResolvedValue(guardado("normal", false) as never);
    const r = await PUT(pedido(daAppAntiga("isento")));
    expect(r.status).toBe(200);
    const g = gravado();
    expect(g.dados.nif).toBe(NIF_NOVO);
    expect(g.dados).not.toHaveProperty("regimeIva");
    expect(g.confirmarRegime).toBe(false);
  });

  it("regime confirmado e reenviado igual: nada muda no regime", async () => {
    for (const regime of ["isento", "normal"] as const) {
      vi.clearAllMocks();
      vi.mocked(sessaoActivaDoProfissional).mockResolvedValue({ providerId: 7 } as never);
      vi.mocked(perfilDoProfissional).mockResolvedValue(guardado(regime, true) as never);
      expect((await PUT(pedido(daAppAntiga(regime)))).status).toBe(200);
      const g = gravado();
      expect(g.dados).not.toHaveProperty("regimeIva");
      expect(g.confirmarRegime).toBe(false);
    }
  });

  it("na app antiga, tocar noutro regime é escolha: grava-o e confirma-o", async () => {
    vi.mocked(perfilDoProfissional).mockResolvedValue(guardado("isento", false) as never);
    await PUT(pedido(daAppAntiga("normal")));
    expect(gravado()).toEqual({ dados: expect.objectContaining({ regimeIva: "normal" }), confirmarRegime: true });

    vi.clearAllMocks();
    vi.mocked(sessaoActivaDoProfissional).mockResolvedValue({ providerId: 7 } as never);
    vi.mocked(perfilDoProfissional).mockResolvedValue(guardado("normal", true) as never);
    await PUT(pedido(daAppAntiga("isento")));
    expect(gravado()).toEqual({ dados: expect.objectContaining({ regimeIva: "isento" }), confirmarRegime: true });
  });

  it("com confirmarRegime (o painel e a app nova): grava e confirma, como na d19", async () => {
    vi.mocked(perfilDoProfissional).mockResolvedValue(guardado("normal", false) as never);
    await PUT(pedido({ regimeIva: "isento", confirmarRegime: true }));
    expect(gravado()).toEqual({ dados: expect.objectContaining({ regimeIva: "isento" }), confirmarRegime: true });
  });

  it("o painel e a app nova, sem tocar no regime, não o mandam: o NIF grava-se sozinho", async () => {
    vi.mocked(perfilDoProfissional).mockResolvedValue(guardado("normal", false) as never);
    await PUT(pedido({ nif: NIF_NOVO }));
    const g = gravado();
    expect(g.dados).toEqual({ nif: NIF_NOVO });
    expect(g.confirmarRegime).toBe(false);
  });
});

describe("regimeQueSeGrava", () => {
  it("as três saídas", () => {
    expect(regimeQueSeGrava("isento", { regimeIva: "normal", regimeIvaConfirmadoEm: null }, true)).toEqual({ grava: true, confirma: true });
    expect(regimeQueSeGrava("isento", { regimeIva: "normal", regimeIvaConfirmadoEm: null }, false)).toEqual({ grava: false, confirma: false });
    expect(regimeQueSeGrava("normal", { regimeIva: "isento", regimeIvaConfirmadoEm: null }, false)).toEqual({ grava: true, confirma: true });
    expect(regimeQueSeGrava("normal", { regimeIva: "normal", regimeIvaConfirmadoEm: "2026-11-13T10:00:00Z" }, false)).toEqual({ grava: false, confirma: false });
    expect(regimeQueSeGrava("isento", null, false)).toEqual({ grava: false, confirma: false });
  });

  it("a rota só põe o regime em `mudancas` com confirmarRegime, ou pela regra", () => {
    const rota = readFileSync(join(process.cwd(), "src/app/api/profissionais/perfil/route.ts"), "utf8").replace(/\r\n/g, "\n");
    const atribuicoes = rota.match(/mudancas\.regimeIva = /g) ?? [];
    expect(atribuicoes).toHaveLength(2);
    expect(rota).toContain("} else if (corpo.confirmarRegime === true) {\n      mudancas.regimeIva = corpo.regimeIva;");
    expect(rota).toContain("const r = regimeQueSeGrava(regimeSemConfirmacao, guardado, false);");
  });
});
