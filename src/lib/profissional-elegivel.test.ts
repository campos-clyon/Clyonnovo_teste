import { describe, it, expect } from "vitest";
import {
  avaliarElegibilidade,
  profissionaisParaNotificar,
  motivosAgregados,
  guiaEstaVerificada,
  type PedidoParaDistribuir,
  type ProfissionalParaAvaliar,
} from "./profissional-elegivel";

const pedidoBase: PedidoParaDistribuir = {
  serviceType: "recolha_moveis",
  precisaFatura: false,
  precisaGuiaTransporte: false,
  distanciaKm: 10,
  city: "Amadora",
};

const proBase: ProfissionalParaAvaliar = {
  id: 1,
  isActive: true,
  estado: "aprovado",
  categorias: ["recolha_moveis", "recolha_monos"],
  raioKm: 30,
  zonas: ["amadora", "lisboa"],
  emiteFatura: true,
  emiteGuiaTransporte: false,
  guiaVerificadaEm: null,
};

const pedido = (p: Partial<PedidoParaDistribuir> = {}) => ({ ...pedidoBase, ...p });
const pro = (p: Partial<ProfissionalParaAvaliar> = {}) => ({ ...proBase, ...p });

function motivos(r: ReturnType<typeof avaliarElegibilidade>) {
  return r.elegivel ? [] : r.motivos;
}

describe("avaliarElegibilidade", () => {
  it("aceita quem faz a categoria, está perto e está aprovado", () => {
    expect(avaliarElegibilidade(pedido(), pro()).elegivel).toBe(true);
  });

  it("exclui inactivos e não aprovados", () => {
    expect(motivos(avaliarElegibilidade(pedido(), pro({ isActive: false })))).toContain("inactivo");
    expect(motivos(avaliarElegibilidade(pedido(), pro({ estado: "pendente" })))).toContain(
      "nao_aprovado",
    );
    expect(motivos(avaliarElegibilidade(pedido(), pro({ estado: "suspenso" })))).toContain(
      "nao_aprovado",
    );
  });

  it("exclui quem não faz a categoria", () => {
    expect(motivos(avaliarElegibilidade(pedido({ serviceType: "jardinagem" }), pro()))).toContain(
      "categoria_diferente",
    );
  });

  // Sem categoria não se adivinha. Mandar a todos "porque não sabemos" é
  // exactamente o ruído que faz o profissional cancelar a subscrição.
  it("não manda a ninguém um pedido sem categoria", () => {
    expect(motivos(avaliarElegibilidade(pedido({ serviceType: null }), pro()))).toContain(
      "categoria_diferente",
    );
  });

  it("uma lista de categorias vazia não significa todas", () => {
    expect(motivos(avaliarElegibilidade(pedido(), pro({ categorias: [] })))).toContain(
      "categoria_diferente",
    );
  });

  describe("distância", () => {
    it("aceita dentro do raio e recusa fora", () => {
      expect(avaliarElegibilidade(pedido({ distanciaKm: 29 }), pro()).elegivel).toBe(true);
      expect(avaliarElegibilidade(pedido({ distanciaKm: 30 }), pro()).elegivel).toBe(true);
      expect(motivos(avaliarElegibilidade(pedido({ distanciaKm: 31 }), pro()))).toContain(
        "fora_de_alcance",
      );
    });

    it("sem raio definido não recebe nada por distância", () => {
      expect(motivos(avaliarElegibilidade(pedido(), pro({ raioKm: null })))).toContain(
        "fora_de_alcance",
      );
    });

    it("sem morada localizada, ninguém é excluído por «fora de alcance»", () => {
      /*
       * As ZONAS saíram da regra — eram uma lista escrita à mão que tentava
       * dizer o mesmo que o raio, e pior: um acento trocado bastava para um
       * trabalho ao lado não chegar a ninguém.
       *
       * Sem distância medida não se diz "fora de alcance", porque ninguém
       * mediu nada e isso seria mentira. Diz-se o que é: falta a morada. É
       * um problema do PEDIDO, não do profissional, e é assim que aparece no
       * painel da distribuição — onde tem conserto.
       */
      const semDistancia = pedido({ distanciaKm: null, city: "Lisboa" });
      const r = avaliarElegibilidade(semDistancia, pro());
      expect(motivos(r)).toContain("sem_morada");
      expect(motivos(r)).not.toContain("fora_de_alcance");
    });

    it("e a cidade escrita já não muda nada — só as coordenadas contam", () => {
      // O mesmo pedido com cidades diferentes dá o mesmo resultado: o texto
      // deixou de ter voto.
      const lisboa = avaliarElegibilidade(pedido({ distanciaKm: null, city: "Lisboa" }), pro());
      const faro = avaliarElegibilidade(pedido({ distanciaKm: null, city: "Faro" }), pro());
      const nenhuma = avaliarElegibilidade(pedido({ distanciaKm: null, city: null }), pro());
      expect(motivos(lisboa)).toEqual(motivos(faro));
      expect(motivos(lisboa)).toEqual(motivos(nenhuma));
    });

    it("com distância medida, quem manda é o raio", () => {
      const perto = pedido({ distanciaKm: 20 });
      const longe = pedido({ distanciaKm: 400 });
      expect(avaliarElegibilidade(perto, pro({ raioKm: 50 })).elegivel).toBe(true);
      expect(motivos(avaliarElegibilidade(longe, pro({ raioKm: 50 })))).toContain(
        "fora_de_alcance",
      );
    });
  });

  describe("fatura", () => {
    it("um pedido que exige fatura não chega a quem não a emite", () => {
      const p = pedido({ precisaFatura: true });
      expect(motivos(avaliarElegibilidade(p, pro({ emiteFatura: false })))).toContain(
        "nao_emite_fatura",
      );
      expect(avaliarElegibilidade(p, pro({ emiteFatura: true })).elegivel).toBe(true);
    });

    it("quem emite fatura continua a receber pedidos que não a exigem", () => {
      expect(avaliarElegibilidade(pedido({ precisaFatura: false }), pro()).elegivel).toBe(true);
    });
  });

  describe("guia de transporte", () => {
    const pedidoComGuia = pedido({ precisaGuiaTransporte: true });

    // A regra central: declarar não chega. Um distintivo que qualquer um liga
    // sozinho vale menos que nenhum, porque o cliente confia nele.
    it("declarar a guia sem verificação não basta", () => {
      const declarouSoznho = pro({ emiteGuiaTransporte: true, guiaVerificadaEm: null });
      expect(motivos(avaliarElegibilidade(pedidoComGuia, declarouSoznho))).toContain(
        "nao_emite_guia",
      );
    });

    it("aceita quem tem a guia verificada", () => {
      const verificado = pro({
        emiteGuiaTransporte: true,
        guiaVerificadaEm: new Date("2026-08-01"),
      });
      expect(avaliarElegibilidade(pedidoComGuia, verificado).elegivel).toBe(true);
    });

    it("aceita a data de verificação vinda da base como string", () => {
      const verificado = pro({
        emiteGuiaTransporte: true,
        guiaVerificadaEm: "2026-08-01T10:00:00Z",
      });
      expect(avaliarElegibilidade(pedidoComGuia, verificado).elegivel).toBe(true);
    });

    it("uma data corrompida não conta como verificação", () => {
      const mau = pro({ emiteGuiaTransporte: true, guiaVerificadaEm: "isto-nao-e-uma-data" });
      expect(motivos(avaliarElegibilidade(pedidoComGuia, mau))).toContain("nao_emite_guia");
    });

    it("verificação sem declaração também não chega", () => {
      const incoerente = pro({
        emiteGuiaTransporte: false,
        guiaVerificadaEm: new Date("2026-08-01"),
      });
      expect(motivos(avaliarElegibilidade(pedidoComGuia, incoerente))).toContain("nao_emite_guia");
    });

    it("um pedido sem guia não exclui ninguém por causa dela", () => {
      expect(avaliarElegibilidade(pedido(), pro({ emiteGuiaTransporte: false })).elegivel).toBe(
        true,
      );
    });
  });

  it("acumula todos os motivos, não pára no primeiro", () => {
    const mau = pro({
      isActive: false,
      estado: "pendente",
      categorias: [],
      raioKm: 1,
      emiteFatura: false,
    });
    const r = motivos(avaliarElegibilidade(pedido({ precisaFatura: true }), mau));
    expect(r).toEqual(
      expect.arrayContaining([
        "inactivo",
        "nao_aprovado",
        "categoria_diferente",
        "fora_de_alcance",
        "nao_emite_fatura",
      ]),
    );
  });
});

describe("guiaEstaVerificada", () => {
  it("distingue verificado de por verificar", () => {
    expect(guiaEstaVerificada(pro({ guiaVerificadaEm: null }))).toBe(false);
    expect(guiaEstaVerificada(pro({ guiaVerificadaEm: new Date() }))).toBe(true);
  });
});

describe("profissionaisParaNotificar", () => {
  it("devolve só os elegíveis", () => {
    const lista = [
      pro({ id: 1 }),
      pro({ id: 2, categorias: ["jardinagem"] }),
      pro({ id: 3, raioKm: 2 }),
      pro({ id: 4 }),
    ];
    expect(profissionaisParaNotificar(pedido(), lista).map((p) => p.id)).toEqual([1, 4]);
  });

  it("devolve lista vazia sem rebentar quando não há ninguém", () => {
    expect(profissionaisParaNotificar(pedido(), [])).toEqual([]);
  });
});

describe("motivosAgregados", () => {
  // Um pedido que não chega a ninguém fica publicado e sem propostas, sem
  // erro nenhum — igual a um que ninguém quis. Isto dá a diferença.
  it("diz porque é que um pedido não chegou a ninguém", () => {
    const lista = [
      { profissional: pro({ id: 1, categorias: ["jardinagem"] }), distanciaKm: 10 },
      { profissional: pro({ id: 2, categorias: ["jardinagem"] }), distanciaKm: 10 },
      { profissional: pro({ id: 3, raioKm: 1 }), distanciaKm: 10 },
    ];
    const c = motivosAgregados(pedido(), lista);
    expect(c.categoria_diferente).toBe(2);
    expect(c.fora_de_alcance).toBe(1);
    expect(c.nao_emite_fatura).toBe(0);
    // A morada ESTÁ localizada — ninguém pode ser contado como se não
    // estivesse. Era o que acontecia: os dois sítios que chamavam isto
    // passavam a distância a null e toda a gente saía "sem morada", com o
    // painel a dizer "Localizada" três linhas acima.
    expect(c.sem_morada).toBe(0);
  });

  it("a distância é de cada um, não do pedido", () => {
    // Um perto e um longe, contra o MESMO pedido: só o longe é excluído.
    const c = motivosAgregados(pedido(), [
      { profissional: pro({ id: 1, raioKm: 30 }), distanciaKm: 8 },
      { profissional: pro({ id: 2, raioKm: 30 }), distanciaKm: 90 },
    ]);
    expect(c.fora_de_alcance).toBe(1);
    expect(c.sem_morada).toBe(0);
  });

  it("sem morada é só quando a morada falta mesmo", () => {
    const c = motivosAgregados(pedido(), [
      { profissional: pro({ id: 1 }), distanciaKm: null },
    ]);
    expect(c.sem_morada).toBe(1);
    expect(c.fora_de_alcance).toBe(0);
  });

  it("não conta quem passou", () => {
    const c = motivosAgregados(pedido(), [{ profissional: pro(), distanciaKm: 10 }]);
    expect(Object.values(c).every((n) => n === 0)).toBe(true);
  });
});
