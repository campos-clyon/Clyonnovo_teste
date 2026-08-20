import { describe, it, expect } from "vitest";
import { historicoDaNegociacao, haQuantoTempo } from "./historico-negociacao";
import type { Proposta } from "./negociacao";

const p = (
  por: "cliente" | "profissional",
  valor: number,
  criadaEm: string,
  estado: Proposta["estado"] = "pendente",
): Proposta => ({ por, valor, criadaEm, estado });

describe("historicoDaNegociacao", () => {
  it("põe tudo por ordem de tempo", () => {
    const h = historicoDaNegociacao([
      p("cliente", 340, "2026-08-20T10:00:00Z", "recusada"),
      p("profissional", 400, "2026-08-20T11:00:00Z", "aceite"),
    ]);
    expect(h.map((e) => e.valor)).toEqual([340, 400]);
    expect(h[0].quem).toBe("cliente");
  });

  // Era o caso que não aparecia de todo: o ecrã só mostrava histórico com mais
  // do que uma proposta, e uma negociação começa sempre com uma.
  it("uma proposta só também é histórico", () => {
    const h = historicoDaNegociacao([p("cliente", 340, "2026-08-20T10:00:00Z")]);
    expect(h).toHaveLength(1);
    expect(h[0].texto).toBe("O cliente propôs");
  });

  it("cada um vê-se a si próprio como 'Você'", () => {
    const props = [p("profissional", 400, "2026-08-20T11:00:00Z")];
    expect(historicoDaNegociacao(props, {}, "profissional")[0].texto).toBe("Você propôs");
    expect(historicoDaNegociacao(props, {}, "cliente")[0].texto).toBe("O profissional propôs");
  });

  it("diz o que aconteceu a cada proposta", () => {
    const h = historicoDaNegociacao([
      p("cliente", 340, "2026-08-20T10:00:00Z", "expirada"),
      p("cliente", 350, "2026-08-21T10:00:00Z", "recusada"),
      p("cliente", 360, "2026-08-22T10:00:00Z", "aceite"),
    ]);
    expect(h[0].texto).toContain("expirou sem resposta");
    expect(h[1].texto).toContain("recusada");
    expect(h[2].texto).toContain("aceite");
  });

  it("as marcas do fim entram na mesma linha do tempo", () => {
    const h = historicoDaNegociacao(
      [p("cliente", 340, "2026-08-20T10:00:00Z", "aceite")],
      {
        execucaoEnviadaEm: "2026-08-22T09:00:00Z",
        confirmadoEm: "2026-08-22T18:00:00Z",
        pagoEm: "2026-08-25T09:00:00Z",
        avaliadoEm: "2026-08-22T18:05:00Z",
        estrelas: 5,
        valorAcordado: 340,
      },
    );
    expect(h.map((e) => e.texto)).toEqual([
      "O cliente propôs — aceite",
      "Trabalho marcado como feito, à espera do cliente",
      "O cliente confirmou. O valor ficou disponível",
      "O cliente avaliou com 5 de 5 estrelas",
      "Transferido",
    ]);
  });

  // Uma linha estragada na base não pode fazer desaparecer o resto do
  // histórico — nem aparecer como "Invalid Date" no ecrã de alguém.
  it("salta o que não tem data utilizável e não rebenta com lixo", () => {
    const h = historicoDaNegociacao([
      p("cliente", 340, "não é uma data"),
      p("cliente", 350, "2026-08-20T10:00:00Z"),
    ]);
    expect(h).toHaveLength(1);
    expect(h[0].valor).toBe(350);
    expect(historicoDaNegociacao([])).toEqual([]);
    expect(historicoDaNegociacao(undefined as never)).toEqual([]);
  });

  it("uma avaliação sem estrelas não inventa uma linha", () => {
    const h = historicoDaNegociacao([], { avaliadoEm: "2026-08-22T18:00:00Z", estrelas: null });
    expect(h).toEqual([]);
  });
});

describe("haQuantoTempo", () => {
  const agora = new Date("2026-08-20T12:00:00Z");
  it("conta em minutos, horas, dias e meses", () => {
    expect(haQuantoTempo("2026-08-20T11:59:40Z", agora)).toBe("agora mesmo");
    expect(haQuantoTempo("2026-08-20T11:30:00Z", agora)).toBe("há 30 min");
    expect(haQuantoTempo("2026-08-20T09:00:00Z", agora)).toBe("há 3 h");
    expect(haQuantoTempo("2026-08-19T09:00:00Z", agora)).toBe("ontem");
    expect(haQuantoTempo("2026-08-10T12:00:00Z", agora)).toBe("há 10 dias");
    expect(haQuantoTempo("2026-06-20T12:00:00Z", agora)).toBe("há 2 meses");
  });
});
