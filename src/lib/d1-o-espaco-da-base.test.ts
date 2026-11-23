// relógio: datas explícitas em todas as chamadas — nada aqui lê o dia de hoje.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALARME_DO_ESPACO, VOLUME_DA_BASE_MB, estadoDoEspaco } from "./espaco-da-base";

/**
 * D1 (CEO e dono, 23-11-2026) — A BASE NÃO PODE ENCHER. O volume do Railway é de
 * 500 MB e sem cópias agendadas: o painel Rotinas mostra o espaço e acende o
 * alarme aos 85 %, e o selo vermelho das Configs também.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const t = (tabela: string, dadosMb: number, indicesMb = 0, livreMb = 0) => ({ tabela, dadosMb, indicesMb, livreMb, linhas: 10 });

describe("d1 — o alarme dos 85 %", () => {
  it("o volume é de 500 MB e o alarme acende aos 85 %", () => {
    expect(VOLUME_DA_BASE_MB).toBe(500);
    expect(ALARME_DO_ESPACO).toBe(0.85);
  });

  it("abaixo dos 85 % não há alarme; a partir dos 425 MB há", () => {
    const abaixo = estadoDoEspaco([t("pedidos", 200, 100, 24)]);
    expect(abaixo.usadoMb).toBe(324);
    expect(abaixo.percentagem).toBe(64.8);
    expect(abaixo.alarme).toBe(false);
    const acima = estadoDoEspaco([t("pedidos", 300, 100, 25.5)]);
    expect(acima.usadoMb).toBe(425.5);
    expect(acima.alarme).toBe(true);
    expect(acima.frase).toContain("Se encher, deixa de gravar pedidos e pagamentos");
  });

  it("a sobra do motor (o que o Railway conta e as tabelas não) entra na conta", () => {
    expect(estadoDoEspaco([t("a", 300)], { sobraMb: 130 }).alarme).toBe(true);
    expect(estadoDoEspaco([t("a", 300)], { sobraMb: 0 }).alarme).toBe(false);
  });

  it("devolve as cinco maiores, da maior para a menor", () => {
    const e = estadoDoEspaco([t("a", 1), t("b", 50), t("c", 20), t("d", 5), t("e", 30), t("f", 2), t("g", 10)]);
    expect(e.maiores.map((m) => m.tabela)).toEqual(["b", "e", "c", "g", "d"]);
  });
});

describe("d1 — onde está", () => {
  it("o painel Rotinas mostra o espaço e o selo das Configs conta o alarme", () => {
    const rota = ler("src/app/api/admin/rotinas/route.ts");
    expect(rota).toContain("medirOEspaco");
    expect(rota).toContain("espaco?.alarme");
    expect(ler("src/components/admin/AdminRotinasPanel.tsx")).toContain("espaco.frase");
    expect(ler("src/lib/licoes-da-vitoria-na-base.ts")).toContain("espaco?.alarme");
  });

  it("a medição é só de leitura: nenhuma escrita nem apagar", () => {
    const base = ler("src/lib/espaco-da-base-na-base.ts");
    expect(base).toContain("information_schema.tables");
    expect(base).not.toMatch(/\b(DELETE|UPDATE|INSERT|DROP|TRUNCATE|ALTER)\b/);
    const rota = ler("src/app/api/admin/rotinas/espaco/route.ts");
    expect(rota).toContain("requireAdminGeral");
    expect(rota).toContain("export async function GET");
    expect(rota).not.toContain("export async function POST");
  });
});
