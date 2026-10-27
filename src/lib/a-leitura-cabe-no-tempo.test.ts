import { describe, it, expect } from "vitest";
import { CONVERSAS_POR_PASSAGEM } from "./ler-as-conversas";
import { CONVERSAS_POR_LOTE, SEGUNDOS_PARA_COMECAR_LOTES, emLotesComPrazo } from "./ler-as-conversas";

/**
 * A LEITURA DAS CONVERSAS CABE NO TEMPO — 27-10-2026 (decisão d7).
 *
 * A rota tem 120 s. Vinte conversas, quatro de cada vez, com o modelo lento
 * (20 + 12 s por lote), eram 160 s: a função era cortada e a passagem nem
 * ficava carimbada. Aos 90 s não se começa lote novo.
 */

/** Um relógio de mentira: cada lote «demora» \`porLote\` segundos. */
function relogioSimulado(porLote: number) {
  let agora = 0;
  return {
    relogio: () => agora,
    lote: async () => {
      agora += porLote * 1000;
    },
  };
}

describe("lotes com prazo, com tempos simulados", () => {
  it("o pior caso (32 s por lote): três lotes começam, o quarto fica — e acaba antes dos 120 s", async () => {
    const r = relogioSimulado(32);
    const itens = Array.from({ length: CONVERSAS_POR_PASSAGEM }, (_, i) => i);
    const vistos: number[] = [];
    let ultimoLote = -1;
    const feito = await emLotesComPrazo(
      itens,
      async (i) => {
        vistos.push(i);
        const lote = Math.floor(i / CONVERSAS_POR_LOTE);
        if (lote !== ultimoLote) {
          ultimoLote = lote;
          await r.lote();
        }
      },
      { relogio: r.relogio },
    );
    expect(feito).toEqual({ feitas: 12, deixadas: 8 });
    expect(vistos).toHaveLength(12);
    // Três lotes de 32 s: 96 s — dentro dos 120 da rota.
    expect(r.relogio()).toBeLessThanOrEqual(120_000);
    expect(SEGUNDOS_PARA_COMECAR_LOTES).toBe(90);
  });

  it("com o modelo rápido lê as vinte", async () => {
    const r = relogioSimulado(3);
    let ultimoLote = -1;
    const feito = await emLotesComPrazo(
      Array.from({ length: 20 }, (_, i) => i),
      async (i) => {
        const lote = Math.floor(i / 4);
        if (lote !== ultimoLote) {
          ultimoLote = lote;
          await r.lote();
        }
      },
      { relogio: r.relogio },
    );
    expect(feito).toEqual({ feitas: 20, deixadas: 0 });
  });

  it("o primeiro lote começa sempre, mesmo com o relógio já gasto", async () => {
    let t = 0;
    const feito = await emLotesComPrazo([1, 2, 3, 4, 5], async () => {
      t += 500_000;
    }, { relogio: () => t, tamanho: 4 });
    expect(feito).toEqual({ feitas: 4, deixadas: 1 });
  });
});
