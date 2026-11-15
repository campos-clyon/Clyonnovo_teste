import { describe, it, expect } from "vitest";
import {
  NOVO_MODELO_DESDE,
  TRABALHOS_CLYON_NO_MODELO_ANTIGO,
  TRABALHOS_CLYON_NO_MODELO_ANTIGO_ATE_POR_EXTENSO,
  TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE,
  TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE_POR_EXTENSO,
  eDoNovoModelo,
} from "./novo-modelo";
import { trabalhoClyonNoNovoModelo } from "./trabalho-clyon-no-novo-modelo";

/*
 * d33 — os Trabalhos CLYON criados a partir de 16-11-2026 00:00 de Lisboa
 * seguem o modelo de 15-11; os de antes, o antigo. relógio: datas explícitas.
 */

const DEPOIS = new Date("2026-11-20T12:00:00Z");

describe("a data de corte dos Trabalhos CLYON — d33", () => {
  it("é a meia-noite de 16-11-2026 em Lisboa, um dia depois do modelo", () => {
    expect(TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE.toISOString()).toBe("2026-11-16T00:00:00.000Z");
    expect(TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE.getTime() - NOVO_MODELO_DESDE.getTime()).toBe(86_400_000);
    // Lisboa em Novembro está em UTC: a meia-noite de lá é a meia-noite UTC.
    expect(
      new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
        TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE,
      ),
    ).toBe("00:00");
  });

  it("os textos por extenso batem com a data", () => {
    expect(TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE_POR_EXTENSO).toBe("16 de novembro de 2026");
    expect(TRABALHOS_CLYON_NO_MODELO_ANTIGO_ATE_POR_EXTENSO).toBe("15 de novembro de 2026");
    const lisboa = (d: Date) =>
      new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", day: "numeric", month: "long", year: "numeric" }).format(d);
    expect(lisboa(TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE)).toBe(TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE_POR_EXTENSO);
    expect(lisboa(new Date(TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE.getTime() - 1))).toBe(TRABALHOS_CLYON_NO_MODELO_ANTIGO_ATE_POR_EXTENSO);
  });

  it("criado a 15-11 às 23:59 de Lisboa → antigo; a 16-11 às 00:00 → novo", () => {
    expect(trabalhoClyonNoNovoModelo(new Date("2026-11-15T23:59:59Z"), DEPOIS)).toBe(false);
    expect(trabalhoClyonNoNovoModelo(new Date("2026-11-16T00:00:00Z"), DEPOIS)).toBe(true);
    // O texto sem fuso que a base devolve lê-se em UTC (memória «a base é lida em UTC»).
    expect(trabalhoClyonNoNovoModelo("2026-11-15 23:59:00", DEPOIS)).toBe(false);
    expect(trabalhoClyonNoNovoModelo("2026-11-16 00:00:00", DEPOIS)).toBe(true);
  });

  it("sem data de criação, ou antes de o modelo valer, fica no antigo", () => {
    expect(trabalhoClyonNoNovoModelo(null, DEPOIS)).toBe(false);
    expect(trabalhoClyonNoNovoModelo("", DEPOIS)).toBe(false);
    expect(trabalhoClyonNoNovoModelo(new Date("2026-11-16T10:00:00Z"), new Date("2026-11-14T12:00:00Z"))).toBe(false);
  });

  it("enquanto o interruptor estiver ligado, um Trabalho CLYON continua no antigo em todo o lado", () => {
    expect(TRABALHOS_CLYON_NO_MODELO_ANTIGO).toBe(true);
    expect(eDoNovoModelo({ ofertaClyon: "valor_fixo" }, DEPOIS)).toBe(false);
  });
});
