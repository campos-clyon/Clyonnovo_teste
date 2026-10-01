import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataEHora, diaEMes, historicoDaNegociacao, haQuantoTempo } from "./historico-negociacao";
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

  it("cada um vê a sua proposta como 'A sua proposta', sem 'Você'", () => {
    const props = [p("profissional", 400, "2026-08-20T11:00:00Z")];
    expect(historicoDaNegociacao(props, {}, "profissional")[0].texto).toBe("A sua proposta");
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

/*
 * O DIA E A HORA EXACTOS — 01-10-2026.
 *
 * «Na conta do pro não mostra data e hora que o trabalho foi concluído.» A
 * hora vivia só num `title`, que num telemóvel não aparece.
 */
describe("dataEHora", () => {
  it("à hora de Lisboa no Verão — uma hora à frente de UTC", () => {
    expect(dataEHora("2026-09-28T13:32:00Z")).toBe("28/09/2026, às 14:32");
  });

  it("e no Inverno, à hora de UTC", () => {
    expect(dataEHora("2026-12-10T13:32:00Z")).toBe("10/12/2026, às 13:32");
  });

  it("o dia é o de Lisboa, mesmo quando em UTC ainda é o anterior", () => {
    expect(dataEHora("2026-09-28T23:30:00Z")).toBe("29/09/2026, às 00:30");
  });

  it("sem data, nada — nunca um «Invalid Date»", () => {
    expect(dataEHora(null)).toBe("");
    expect(dataEHora("isto não é uma data")).toBe("");
  });

  it("e o dia sozinho, para o cartão da lista, também à hora de Lisboa", () => {
    expect(diaEMes("2026-09-28T23:30:00Z")).toBe("29/09");
    expect(diaEMes(null)).toBe("");
  });
});

describe("o ecrã mostra-os, e não só no title", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const semNotas = (s: string) =>
    s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

  it("o histórico escreve o dia e a hora ao lado do «há quanto tempo»", () => {
    const HIST = semNotas(ler("src/components/HistoricoDaNegociacao.tsx"));
    expect(HIST).toContain("{haQuantoTempo(e.quando, agora)} · {dataEHora(e.quando)}");
  });

  it("o trabalho terminado diz quando foi concluído, e quando foi transferido", () => {
    const ECRA = semNotas(ler("src/app/profissionais/painel/Trabalhos.tsx"));
    expect(ECRA).toContain("dataEHora(pedido.execucaoEnviadaEm ?? pedido.confirmadoEm)");
    expect(ECRA).toContain("Concluído a");
    expect(ECRA).toContain("transferido a <strong>{dataEHora(pedido.pagoEm)}</strong>");
    expect(ECRA).toContain("Marcou como feito a <strong>{dataEHora(pedido.execucaoEnviadaEm)}</strong>");
  });

  it("e na lista, o cartão terminado diz o dia em que acabou", () => {
    const ECRA = semNotas(ler("src/app/profissionais/painel/Trabalhos.tsx"));
    expect(ECRA).toContain('separadorDe(p) === "terminados"');
    expect(ECRA).toContain("`concluído ${diaEMes(p.execucaoEnviadaEm ?? p.confirmadoEm)}`");
  });
});
