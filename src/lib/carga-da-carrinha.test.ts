import { describe, it, expect } from "vitest";
import { TIPOS_DE_VEICULO } from "./convite-profissional";
import {
  cargaParaEste,
  IDS_DE_VEICULO,
  VEICULOS_SEM_CARGA,
  cargasPorExtenso,
  porCargaNesta,
  quantasCargas,
  tamanhoDaCarrinha,
  PARTES_QUE_CABEM,
  CARRINHA_DE_REFERENCIA,
} from "./carga-da-carrinha";

/**
 * O EXEMPLO DO DONO, NÚMERO A NÚMERO.
 *
 * "Se colocarmos o valor de partida de 350 por carga, o sistema deve entender
 * que me refiro a carga grande: logo, os que têm carrinha pequena devem ver
 * 150 por carga, mais ou menos 2 cargas e meia para recolher tudo; para a
 * carrinha média, 250, mais ou menos 1 carga e meia." — 29-09-2026.
 *
 * É o teste que manda no ficheiro inteiro. A proporção 3:5:7 foi escolhida
 * porque reproduz estes seis números exactamente, e não ao contrário.
 */

describe("o exemplo dos 350 €", () => {
  it("a carrinha grande vê o que a CLYON escreveu, numa viagem", () => {
    const c = cargaParaEste(350, "carrinha_grande")!;
    expect(c.porCarga).toBe(350);
    expect(c.cargasEmPalavras).toBe("1 carga");
    expect(c.diferente).toBe(false);
  });

  it("a média vê 250, em cerca de 1 carga e meia", () => {
    const c = cargaParaEste(350, "carrinha_media")!;
    expect(c.porCarga).toBe(250);
    expect(c.cargasEmPalavras).toBe("1 carga e meia");
    expect(c.diferente).toBe(true);
  });

  it("a pequena vê 150, em cerca de 2 cargas e meia", () => {
    const c = cargaParaEste(350, "carrinha_pequena")!;
    expect(c.porCarga).toBe(150);
    expect(c.cargasEmPalavras).toBe("2 cargas e meia");
    expect(c.diferente).toBe(true);
  });
});

describe("o que a proporção garante para além do exemplo", () => {
  it("quem tem carrinha maior vê sempre mais por carga, e faz menos viagens", () => {
    for (const valor of [80, 120, 350, 500, 1000]) {
      const p = cargaParaEste(valor, "carrinha_pequena")!;
      const m = cargaParaEste(valor, "carrinha_media")!;
      const g = cargaParaEste(valor, "carrinha_grande")!;
      expect(p.porCarga, String(valor)).toBeLessThan(m.porCarga);
      expect(m.porCarga, String(valor)).toBeLessThan(g.porCarga);
      expect(p.cargas, String(valor)).toBeGreaterThan(m.cargas);
      expect(m.cargas, String(valor)).toBeGreaterThan(g.cargas);
    }
  });

  it("ninguém fica a perder muito pelo trabalho todo", () => {
    /*
     * A RAZÃO DE SER DA PROPORÇÃO, e o que ela tem de continuar a garantir:
     * dividir uma carga em duas não pode transformar o trabalho num negócio
     * pior. Multiplicado pelas viagens, o total de cada carrinha tem de andar
     * à volta do valor de referência — nunca abaixo dele.
     *
     * Acima pode ficar, e fica: quem faz duas viagens e meia gasta mais
     * combustível e mais tempo do que quem faz uma, e é justo que isso se
     * pague. O tecto de 30 % é o que separa «o arredondamento das meias
     * cargas» de «a proporção está errada».
     */
    for (const valor of [80, 120, 350, 500, 1000]) {
      for (const tipo of ["carrinha_pequena", "carrinha_media", "carrinha_grande"]) {
        const c = cargaParaEste(valor, tipo)!;
        const total = c.porCarga * c.cargas;
        expect(total, `${tipo} a ${valor}`).toBeGreaterThanOrEqual(valor);
        expect(total, `${tipo} a ${valor}`).toBeLessThanOrEqual(valor * 1.3);
      }
    }
  });

  it("a carrinha de referência é a grande, e vê o valor intacto", () => {
    expect(CARRINHA_DE_REFERENCIA).toBe("grande");
    for (const valor of [80, 137.5, 350, 999.99]) {
      expect(porCargaNesta(valor, "grande")).toBe(Math.round(valor * 100) / 100);
      expect(quantasCargas("grande")).toBe(1);
    }
  });

  it("e cabe mais numa maior do que numa menor — é daqui que tudo sai", () => {
    expect(PARTES_QUE_CABEM.pequena).toBeLessThan(PARTES_QUE_CABEM.media);
    expect(PARTES_QUE_CABEM.media).toBeLessThan(PARTES_QUE_CABEM.grande);
  });
});

describe("que veículo é este", () => {
  it("lê os nomes que já vivem na coluna", () => {
    expect(tamanhoDaCarrinha("carrinha_pequena")).toBe("pequena");
    expect(tamanhoDaCarrinha("carrinha_media")).toBe("media");
    expect(tamanhoDaCarrinha("carrinha_grande")).toBe("grande");
  });

  it("o camião conta como grande, e nunca como mais", () => {
    /*
     * Cabe-lhe mais, e mesmo assim não vê um valor POR CARGA maior do que o
     * escrito: o número da CLYON é o de uma carga grande, e dar-lhe mais era
     * cobrar ao cliente acima do combinado. Ele ganha em viagens, não em
     * preço por viagem.
     */
    expect(tamanhoDaCarrinha("camiao")).toBe("grande");
    expect(cargaParaEste(350, "camiao")!.porCarga).toBe(350);
  });

  it("sem saber o veículo, não se inventa tamanho nenhum", () => {
    /*
     * Devolver `null` e não um valor igual ao escrito é deliberado: quem
     * chama tem de poder distinguir «não se aplica» de «aplica-se e dá o
     * mesmo». Sem isso, o ecrã anunciaria uma conta que não fez.
     */
    for (const v of [null, undefined, "", "sem_veiculo", "carrinha", "bicicleta", 7, {}]) {
      expect(tamanhoDaCarrinha(v), String(v)).toBeNull();
      expect(cargaParaEste(350, v), String(v)).toBeNull();
    }
  });
});

describe("quando não há conta para fazer", () => {
  it("sem valor, ou com um valor que não é um valor", () => {
    for (const v of [null, undefined, 0, -50, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(cargaParaEste(v as number, "carrinha_pequena"), String(v)).toBeNull();
    }
  });
});

describe("as viagens ditas como quem fala", () => {
  it("uma, uma e meia, duas e meia", () => {
    expect(cargasPorExtenso("grande")).toBe("1 carga");
    expect(cargasPorExtenso("media")).toBe("1 carga e meia");
    expect(cargasPorExtenso("pequena")).toBe("2 cargas e meia");
  });

  it("arredonda PARA CIMA — meia viagem não existe para quem conduz", () => {
    /*
     * 7/3 = 2,33 viagens. Quem precisa de 2,33 faz três, e a última vai a
     * meio. Arredondar para baixo prometia um trabalho em duas viagens que
     * não cabe em duas.
     */
    expect(quantasCargas("pequena")).toBe(2.5);
    expect(quantasCargas("media")).toBe(1.5);
    expect(quantasCargas("grande")).toBe(1);
  });
});

describe("o mapa nao pode ficar atras da lista dos veiculos", () => {
  it("cada veículo da lista canónica está decidido — com tamanho, ou sem nenhum", () => {
    /*
     * O ERRO QUE ISTO APANHA não dá erro nenhum em produção: um veículo novo
     * em `TIPOS_DE_VEICULO` que ninguém mapeie aqui faz o profissional ver o
     * valor da carrinha grande em silêncio, e ele não tem como saber.
     *
     * Foi assim que a lista curta que eu escrevi deixou de fora o
     * `camiao_grua` e o `varios`.
     */
    for (const id of IDS_DE_VEICULO) {
      const t = tamanhoDaCarrinha(id);
      if (VEICULOS_SEM_CARGA.includes(id)) {
        expect(t, id).toBeNull();
      } else {
        expect(t, `${id} nao esta no mapa de tamanhos`).not.toBeNull();
      }
    }
  });

  it("e a lista que ele percorre é mesmo a canónica, e não uma cópia", () => {
    expect(IDS_DE_VEICULO).toEqual(TIPOS_DE_VEICULO.map((v) => v.id));
    expect(IDS_DE_VEICULO).toContain("camiao_grua");
    expect(IDS_DE_VEICULO).toContain("varios");
  });

  it("o camião-grua e os «vários veículos» contam como grande", () => {
    expect(tamanhoDaCarrinha("camiao_grua")).toBe("grande");
    expect(tamanhoDaCarrinha("varios")).toBe("grande");
    expect(cargaParaEste(350, "camiao_grua")!.porCarga).toBe(350);
  });
});
