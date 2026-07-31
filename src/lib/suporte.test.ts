import { describe, it, expect } from "vitest";
import {
  ESTADOS_TICKET,
  ESTADOS_POR_TRATAR,
  ehEstadoValido,
  resolvedAtPara,
  rotuloCategoria,
  rotuloQuemEscreve,
  haQuantoTempo,
  etiquetaAutor,
} from "./suporte";

/**
 * A app mostra o `status` em bruto, em maiúsculas. Um valor fora da lista
 * combinada não dá erro nenhum — aparece escrito no ecrã do cliente. Estes
 * testes são o que impede isso de acontecer sem ninguém dar por ela.
 */
describe("estados do ticket", () => {
  it("são exactamente os quatro combinados com a app", () => {
    expect([...ESTADOS_TICKET]).toEqual(["open", "in_progress", "waiting_customer", "closed"]);
  });

  it("aceita os combinados e recusa tudo o resto", () => {
    for (const e of ESTADOS_TICKET) expect(ehEstadoValido(e)).toBe(true);
    for (const mau of ["OPEN", "aberto", "pending", "resolvido", "", null, 3, undefined]) {
      expect(ehEstadoValido(mau)).toBe(false);
    }
  });

  it("o que conta para o aviso é tudo menos fechado", () => {
    expect(ESTADOS_POR_TRATAR).not.toContain("closed");
    expect(ESTADOS_POR_TRATAR).toHaveLength(ESTADOS_TICKET.length - 1);
  });
});

describe("resolvedAtPara", () => {
  const agora = "2026-07-31T10:00:00.000Z";

  it("só fechar marca a data de resolução", () => {
    expect(resolvedAtPara("closed", agora)).toBe(agora);
  });

  it("reabrir limpa a data — senão o tempo de resolução passa a mentir", () => {
    expect(resolvedAtPara("open", agora)).toBeNull();
    expect(resolvedAtPara("in_progress", agora)).toBeNull();
    expect(resolvedAtPara("waiting_customer", agora)).toBeNull();
  });
});

describe("rótulos", () => {
  it("traduz as categorias que a app escreve", () => {
    expect(rotuloCategoria("payment")).toBe("Pagamentos");
    expect(rotuloCategoria("partner")).toBe("Profissional");
  });

  it("uma categoria desconhecida aparece como está, em vez de desaparecer", () => {
    expect(rotuloCategoria("faturacao_b2b")).toBe("faturacao_b2b");
    expect(rotuloCategoria(null)).toBe("—");
  });

  it("distingue quem escreveu", () => {
    expect(rotuloQuemEscreve("customer")).toBe("Cliente");
    expect(rotuloQuemEscreve("partner")).toBe("Profissional");
    expect(rotuloQuemEscreve(null)).toBe("—");
  });
});

describe("haQuantoTempo", () => {
  const agora = new Date("2026-07-31T12:00:00Z");
  const menos = (ms: number) => new Date(agora.getTime() - ms).toISOString();

  it("minutos, horas, dias e meses", () => {
    expect(haQuantoTempo(menos(30 * 1000), agora)).toBe("agora");
    expect(haQuantoTempo(menos(5 * 60_000), agora)).toBe("há 5 min");
    expect(haQuantoTempo(menos(3 * 3_600_000), agora)).toBe("há 3 h");
    expect(haQuantoTempo(menos(24 * 3_600_000), agora)).toBe("há 1 dia");
    expect(haQuantoTempo(menos(6 * 24 * 3_600_000), agora)).toBe("há 6 dias");
    expect(haQuantoTempo(menos(45 * 24 * 3_600_000), agora)).toBe("há 1 mês");
  });

  // Os dois tickets que ninguém leu, de 13 e 25 de julho
  it("os dois por ler dizem quanto tempo esperaram", () => {
    expect(haQuantoTempo("2026-07-13T09:00:00Z", agora)).toBe("há 18 dias");
    expect(haQuantoTempo("2026-07-25T09:00:00Z", agora)).toBe("há 6 dias");
  });

  it("uma data inválida ou no futuro não inventa um número", () => {
    expect(haQuantoTempo("nao-e-uma-data", agora)).toBe("—");
    expect(haQuantoTempo(new Date(agora.getTime() + 60_000), agora)).toBe("—");
  });
});

describe("etiquetaAutor", () => {
  it("nome e id, porque não há uuid do colaborador para pôr no author_id", () => {
    expect(etiquetaAutor({ id: 1, nome: "WANDERSON" })).toBe("WANDERSON (#1)");
  });
});
