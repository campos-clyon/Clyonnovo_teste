import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A MARGEM DE REFERÊNCIA VEM DAS CONFIGS — 28-10-2026 (d11).
 *
 * O painel mostrava «40» escrito à mão como a margem que entra quando o
 * profissional não pôs a dele; a sugestão usa a de `parametrosDoMapa` (a
 * `margem_lucro` das Configs). A rota do perfil passa a mandá-la em
 * percentagem, e o painel mostra essa. Este teste compara o número que a rota
 * dá — o que o ecrã mostra — com `parametrosDoMapa`.
 */

vi.mock("@/lib/sessao-activa-do-profissional", () => ({ sessaoActivaDoProfissional: vi.fn() }));
vi.mock("@/lib/profissional-auth", () => ({
  tokenDoProfissional: () => "x",
  sessaoVemDaApp: () => true,
  renovarSessaoSePreciso: vi.fn(async () => {}),
}));
vi.mock("@/lib/db", () => ({
  perfilDoProfissional: vi.fn(async () => ({ name: "Rui Silva", email: "rui@exemplo.pt", margemPercent: null })),
  avaliacoesDoProfissional: vi.fn(async () => []),
  trabalhosConcluidosDoProfissional: vi.fn(async () => 0),
  fotosDaViatura: vi.fn(async () => []),
  custosFixosDeJson: () => null,
  actualizarPerfilDoProfissional: vi.fn(),
  apagarFotosDoBlob: vi.fn(),
  urlDaFotoDaViatura: vi.fn(),
  invalidarVerificacaoDaGuia: vi.fn(),
}));
vi.mock("@/lib/pricing-helper", async (original) => ({
  ...(await original<typeof import("./pricing-helper")>()),
  getActivePricingMap: vi.fn(),
}));

import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { getActivePricingMap } from "@/lib/pricing-helper";
import { GET } from "@/app/api/profissionais/perfil/route";
import { margemDeReferenciaPercent, margemEmPercentagem, parametrosDoMapa } from "./sugestao-para-o-profissional";
import type { SimulatorSettingsMap } from "./simulator-settings";

const comMargem = (m: number | undefined) => (m === undefined ? {} : { margem_lucro: m }) as unknown as SimulatorSettingsMap;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sessaoActivaDoProfissional).mockResolvedValue({ providerId: 7, nome: "Rui Silva" } as never);
});

describe("a margem de referência em percentagem", () => {
  it("é a de parametrosDoMapa, arredondada", () => {
    expect(margemEmPercentagem(parametrosDoMapa(comMargem(0.4)))).toBe(40);
    expect(margemEmPercentagem(parametrosDoMapa(comMargem(0.35)))).toBe(35);
    expect(margemEmPercentagem(parametrosDoMapa(comMargem(0.125)))).toBe(13);
    // Sem a chave nas Configs, a de omissão de parametrosDoMapa.
    expect(margemEmPercentagem(parametrosDoMapa(comMargem(undefined)))).toBe(
      Math.round(parametrosDoMapa({}).margem * 100),
    );
  });

  it("lê as Configs de agora, e muda com elas", async () => {
    for (const m of [0.4, 0.45, 0.3]) {
      vi.mocked(getActivePricingMap).mockResolvedValueOnce(comMargem(m));
      expect(await margemDeReferenciaPercent()).toBe(Math.round(parametrosDoMapa(comMargem(m)).margem * 100));
    }
  });
});

describe("a rota do perfil manda-a, e o painel mostra-a", () => {
  it("o número na resposta é o de parametrosDoMapa", async () => {
    for (const m of [0.4, 0.45]) {
      vi.mocked(getActivePricingMap).mockResolvedValueOnce(comMargem(m));
      const r = await GET(new NextRequest("https://clyon.pt/api/profissionais/perfil"));
      expect(r.status).toBe(200);
      const { perfil } = await r.json();
      expect(perfil.margemDeReferenciaPercent).toBe(margemEmPercentagem(parametrosDoMapa(comMargem(m))));
      // A dele continua a sua: vazia quer dizer «a de referência».
      expect(perfil.margemPercent).toBeNull();
    }
  });

  it("o painel mostra o número da rota, e já não escreve «40»", () => {
    const P = readFileSync(join(process.cwd(), "src/app/profissionais/painel/Perfil.tsx"), "utf8");
    expect(P).toContain("perfil.margemDeReferenciaPercent");
    expect(P).toContain("{(dados.margemPercent ?? margemDeReferencia) != null");
    expect(P).toContain("value={dados.margemPercent ?? margemDeReferencia ?? 0}");
    expect(P).not.toMatch(/margemPercent \?\? 40/);
    expect(P).not.toMatch(/nos 40 % de referência/);
  });
});
