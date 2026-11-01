import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_PEDIDOS_MBWAY,
  MAX_TELEMOVEIS_MBWAY,
  MENSAGEM_DO_TECTO_MBWAY,
  porqueNaoPodePedirMaisMbway,
  telemovelComparavel,
} from "./tecto-do-mbway";

/** O tecto do MB WAY por trabalho (Segurança, 01-11-2026). Números inventados. */
const AGORA = Date.parse("2026-11-01T12:00:00Z");
const haMinutos = (m: number) => new Date(AGORA - m * 60_000);
const mbway = (telemovel: string, minutos = 10) => ({ metodo: "mbway", telemovel, criadoEm: haMinutos(minutos) });

describe("o tecto do MB WAY por trabalho", () => {
  it("é de 6 pedidos e 3 telemóveis", () => {
    expect(MAX_PEDIDOS_MBWAY).toBe(6);
    expect(MAX_TELEMOVEIS_MBWAY).toBe(3);
  });

  it("deixa pedir enquanto está abaixo", () => {
    const cinco = Array.from({ length: 5 }, () => mbway("910000001"));
    expect(porqueNaoPodePedirMaisMbway(cinco, "910000001", AGORA)).toBeNull();
  });

  it("trava o sétimo pedido em 24 horas", () => {
    const seis = Array.from({ length: 6 }, () => mbway("910000001"));
    expect(porqueNaoPodePedirMaisMbway(seis, "910000001", AGORA)).toBe(MENSAGEM_DO_TECTO_MBWAY);
  });

  it("os de há mais de 24 horas e os Multibanco não contam", () => {
    const antigos = Array.from({ length: 6 }, () => mbway("910000001", 25 * 60));
    const multibanco = Array.from({ length: 6 }, () => ({ metodo: "multibanco", telemovel: null, criadoEm: haMinutos(5) }));
    expect(porqueNaoPodePedirMaisMbway([...antigos, ...multibanco], "910000001", AGORA)).toBeNull();
  });

  it("trava um quarto telemóvel, mas deixa repetir um dos três", () => {
    const tres = [mbway("910000001"), mbway("+351 910 000 002"), mbway("910000003")];
    expect(porqueNaoPodePedirMaisMbway(tres, "910000004", AGORA)).toBe(MENSAGEM_DO_TECTO_MBWAY);
    expect(porqueNaoPodePedirMaisMbway(tres, "351910000002", AGORA)).toBeNull();
  });

  it("compara os números pelos 9 algarismos", () => {
    expect(telemovelComparavel("+351 910 000 002")).toBe("910000002");
    expect(telemovelComparavel(null)).toBe("");
  });

  it("a mensagem fala com o cliente e dá a saída", () => {
    expect(MENSAGEM_DO_TECTO_MBWAY).toContain("Multibanco");
    expect(MENSAGEM_DO_TECTO_MBWAY).toContain("fale connosco");
  });

  it("a rota do cliente aplica o tecto antes de pedir ao euPago", () => {
    const rota = readFileSync(join(process.cwd(), "src/app/api/pagamentos/route.ts"), "utf8").replace(/\r\n/g, "\n");
    const i = rota.indexOf("porqueNaoPodePedirMaisMbway(todos, telemovel)");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(rota.indexOf("await abrirPagamento("));
    expect(i).toBeLessThan(rota.indexOf("await fecharSemPagar("));
  });
});
