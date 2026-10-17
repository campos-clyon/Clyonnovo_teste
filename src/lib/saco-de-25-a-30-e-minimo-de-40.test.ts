import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ENTULHO_ATE_10_SACOS } from "./precos-publicos";
import { MINIMO_DO_ENTULHO } from "./pricing-helper";
import { PESO_DO_SACO } from "./sacos-de-entulho";

/**
 * O SACO DE 25 A 30 KG E O MÍNIMO DE 40 € — 17-10-2026, escolhas do dono.
 *
 * Com os 10 sacos a 40–50 € sem IVA na grelha, o simulador ainda tinha um
 * mínimo de 90 € para o entulho: pedia mais do dobro do que a grelha promete.
 * E só a linha dos 10 sacos dizia «25 a 30 kg» — o resto do site dizia «até
 * 25 kg». Os dois passam a ler o mesmo sítio.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("o mínimo do entulho no simulador", () => {
  it("é o piso dos 10 sacos da grelha, 40 €", () => {
    expect(MINIMO_DO_ENTULHO).toBe(ENTULHO_ATE_10_SACOS.minimo);
    expect(MINIMO_DO_ENTULHO).toBe(40);
  });

  it("o motor e as instruções ao modelo lêem a constante, e o 90 não volta", () => {
    const motor = ler("src/lib/pricing-helper.ts");
    expect(motor).toContain("if (priceWithoutVat < MINIMO_DO_ENTULHO) {");
    const rota = ler("src/app/api/simulator/analyze/route.ts");
    expect(rota).toContain("Mínimo fixo de entulho: ${MINIMO_DO_ENTULHO} € s/IVA");
    for (const [nome, f] of [
      ["pricing-helper", motor],
      ["analyze", rota],
    ] as const) {
      expect(f, nome).not.toMatch(/[Mm]ínimo[^\n]{0,30}\b90 ?€/);
      expect(f, nome).not.toMatch(/[Ee]ntulho[^\n]{0,40}\b90 ?€/);
    }
  });
});

describe("o saco de 25 a 30 kg", () => {
  it("diz-se assim, e a linha dos 10 sacos lê o mesmo", () => {
    expect(PESO_DO_SACO).toBe("25 a 30 kg");
    expect(ENTULHO_ATE_10_SACOS.descricao).toContain(PESO_DO_SACO);
  });

  it("e o «até 25 kg» não fica em lado nenhum do código de produção", () => {
    const ficheiros: string[] = [];
    const andar = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) andar(p);
        else if (/\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n)) ficheiros.push(p);
      }
    };
    andar(join(process.cwd(), "src"));
    expect(ficheiros.length).toBeGreaterThan(300);
    const maus = ficheiros.filter((f) =>
      /(até|up to) 25 ?kg|sacos? de 25 kg/i.test(readFileSync(f, "utf8")),
    );
    expect(maus).toEqual([]);
  });
});
