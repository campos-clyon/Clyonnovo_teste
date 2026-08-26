import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  sinaisDoTrabalho,
  pesoDoTrabalho,
  porQuilometro,
  porKmPorExtenso,
  corDaBarra,
  RAIO_QUENTE_KM,
  BOM_POR_KM,
} from "./sinais-do-trabalho";

/**
 * Os sinais no painel do profissional.
 *
 * "Pedidos que estão a menos de 10 km, por exemplo, devem ter o emoji do
 * foguinho — tente criar algo interativo, inteligente e moderno."
 *
 * A lista dizia o serviço, a cidade, a distância e o dinheiro, e cada linha
 * parecia igual à de cima. Quem lê vinte cartões não compara números: procura
 * um motivo para parar.
 *
 * Nenhum sinal pede dados novos — distância, urgência, valor e fotografias já
 * chegavam ao painel. O que não existia era a conta.
 */

const TRABALHOS = readFileSync(
  join(process.cwd(), "src/app/profissionais/painel/Trabalhos.tsx"),
  "utf8",
);

describe("o foguinho", () => {
  it("acende a menos de 10 km, e não acima", () => {
    expect(sinaisDoTrabalho({ distanciaKm: 6 }).map((s) => s.chave)).toContain("perto");
    expect(sinaisDoTrabalho({ distanciaKm: RAIO_QUENTE_KM }).map((s) => s.chave)).toContain("perto");
    expect(sinaisDoTrabalho({ distanciaKm: 11 }).map((s) => s.chave)).not.toContain("perto");
  });

  it("sem distância medida não inventa proximidade", () => {
    // Um pedido cuja morada não foi localizada tem distanciaKm nulo. Dizer
    // "a 0 km" seria a pior mentira possível: manda-o lá.
    expect(sinaisDoTrabalho({ distanciaKm: null }).map((s) => s.chave)).not.toContain("perto");
    expect(sinaisDoTrabalho({}).map((s) => s.chave)).not.toContain("perto");
  });

  it("diz os quilómetros no próprio distintivo", () => {
    expect(sinaisDoTrabalho({ distanciaKm: 6 })[0].texto).toBe("A 6 km");
    expect(sinaisDoTrabalho({ distanciaKm: 6 })[0].emoji).toBe("🔥");
  });
});

describe("os outros sinais", () => {
  it("urgente é hoje ou amanhã, no vocabulário do formulário e no do site", () => {
    for (const u of ["today", "tomorrow", "hoje", "amanhã"]) {
      expect(sinaisDoTrabalho({ urgency: u }).map((s) => s.chave)).toContain("urgente");
    }
    expect(sinaisDoTrabalho({ urgency: "flexible" }).map((s) => s.chave)).not.toContain("urgente");
  });

  it("bem pago é por quilómetro, e não pelo total", () => {
    // É este o ponto todo: 304 € a 39 km rendem menos do que 123 € a 6 km.
    const grande = { recebeSeAceitar: 304, distanciaKm: 39 };   // 7,8 €/km
    const pequeno = { recebeSeAceitar: 123.5, distanciaKm: 6 }; // 20,6 €/km
    expect(porQuilometro(grande)!).toBeLessThan(porQuilometro(pequeno)!);
    expect(sinaisDoTrabalho(pequeno).map((s) => s.chave)).toContain("bem_pago");
    expect(sinaisDoTrabalho(grande).map((s) => s.chave)).not.toContain("bem_pago");
  });

  it("o limiar está acima do típico — senão marcava metade da lista", () => {
    /*
     * A mediana real dos 19 trabalhos fechados é 6,3 €/km. Um limiar em 6
     * punha o distintivo em metade dos cartões, e um sinal que está em
     * metade das linhas não é um sinal.
     *
     * Este teste é o que impede alguém de o baixar sem reparar porquê.
     */
    const MEDIANA_REAL = 6.3;
    expect(BOM_POR_KM).toBeGreaterThan(MEDIANA_REAL * 1.5);

    // O trabalho típico do meio da tabela NÃO leva distintivo.
    expect(sinaisDoTrabalho({ recebeSeAceitar: 63, distanciaKm: 10 }).map((s) => s.chave))
      .not.toContain("bem_pago");
  });

  it("não divide por zero nem por distância que não existe", () => {
    expect(porQuilometro({ recebeSeAceitar: 100, distanciaKm: 0 })).toBeNull();
    expect(porQuilometro({ recebeSeAceitar: 100, distanciaKm: null })).toBeNull();
    expect(porQuilometro({ recebeSeAceitar: null, distanciaKm: 10 })).toBeNull();
    expect(porKmPorExtenso({ recebeSeAceitar: 100 })).toBeNull();
  });

  it("as fotografias contam-se em número, para caber na linha", () => {
    expect(sinaisDoTrabalho({ quantasFotos: 3 }).map((s) => s.texto)).toContain("3 fotos");
    expect(sinaisDoTrabalho({ quantasFotos: 2 }).map((s) => s.chave)).not.toContain("com_fotos");
  });

  it("o €/km escreve-se em português", () => {
    expect(porKmPorExtenso({ recebeSeAceitar: 123.5, distanciaKm: 6 })).toBe("20,6 €/km");
  });
});

describe("a ordem e a cor", () => {
  it("perto pesa mais do que urgente, e urgente mais do que bem pago", () => {
    const perto = pesoDoTrabalho({ distanciaKm: 5 });
    const urgente = pesoDoTrabalho({ urgency: "today" });
    const bem = pesoDoTrabalho({ recebeSeAceitar: 100, distanciaKm: 5.1 });
    expect(perto).toBeGreaterThan(urgente);
    expect(urgente).toBeGreaterThan(pesoDoTrabalho({ quantasFotos: 4 }));
    expect(bem).toBeGreaterThan(0);
  });

  it("um trabalho sem sinal nenhum não pesa nada — e isso é informação", () => {
    expect(pesoDoTrabalho({ distanciaKm: 90, urgency: "flexible" })).toBe(0);
  });

  it("só o perto pinta o cartão de laranja", () => {
    expect(corDaBarra({ distanciaKm: 5 }, false)).toContain("orange");
    expect(corDaBarra({ urgency: "today" }, false)).toContain("amber");
    // Sem sinal, volta ao ciano da marca quando é novo.
    expect(corDaBarra({ distanciaKm: 90 }, true)).toContain("00B4CC");
  });
});

describe("o cartão no painel", () => {
  it("mostra os distintivos e o €/km", () => {
    expect(TRABALHOS).toContain("sinaisDoTrabalho({ ...p, quantasFotos: fotos.length })");
    expect(TRABALHOS).toContain("porKmPorExtenso(p)");
    expect(TRABALHOS).toContain("{sinal.emoji}");
  });

  it("nenhum distintivo parte a meio no telemóvel", () => {
    // Ele mandou-me a fotografia com «Pouca concorrência» na linha de baixo.
    expect(TRABALHOS).toContain("whitespace-nowrap rounded-full border px-2 py-0.5");
  });

  it("os sinais só aparecem onde ele ainda decide", () => {
    // Num trabalho contratado, «bem pago» é história — e ruído por cima do
    // que interessa, que é a morada e o contacto.
    expect(TRABALHOS).toContain('const aDecidir = separador === "novos" || separador === "negociacao";');
    expect(TRABALHOS).toContain("aDecidir ? sinaisDoTrabalho(");
  });

  it("o quente muda o cartão inteiro, e é o único que o faz", () => {
    expect(TRABALHOS).toContain("border-l-orange-500");
    expect(TRABALHOS).toContain("ring-1 ring-orange-100");
  });

  it("a lista dos que ele decide passa a estar ordenada por sinal", () => {
    expect(TRABALHOS).toContain("pesoDoTrabalho({ ...b, quantasFotos: fotos(b) })");
    // E os separadores de trabalho feito NÃO se reordenam: ali a pergunta é
    // "o que aconteceu quando".
    expect(TRABALHOS).toContain('if (separador !== "novos" && separador !== "negociacao") return lista;');
  });
});
