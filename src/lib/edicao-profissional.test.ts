import { describe, it, expect } from "vitest";
import {
  validarEdicao,
  afectaDistribuicao,
  estadoValido,
  ESTADOS_DO_PROFISSIONAL,
} from "./edicao-profissional";
import { RAIO_MAXIMO_KM } from "./inscricao-profissional";

function erros(r: ReturnType<typeof validarEdicao>) {
  return r.ok ? [] : r.erros.map((e) => e.campo);
}

describe("validarEdicao", () => {
  // A regra que evita o pior acidente deste painel: mudar o raio não pode
  // apagar as categorias só porque não vinham no pedido.
  it("só devolve os campos que vieram", () => {
    const r = validarEdicao({ raioKm: 60 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.alteracoes).toEqual({ raioKm: 60 });
      expect(r.alteracoes.categorias).toBeUndefined();
      expect(r.alteracoes.zonas).toBeUndefined();
    }
  });

  it("recusa um pedido sem nada para alterar", () => {
    expect(validarEdicao({}).ok).toBe(false);
    expect(validarEdicao(null).ok).toBe(false);
  });

  describe("categorias", () => {
    it("aceita e remove duplicados", () => {
      const r = validarEdicao({
        categorias: ["recolha_moveis", "recolha_moveis", "jardinagem"],
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.alteracoes.categorias).toEqual(["recolha_moveis", "jardinagem"]);
    });

    it("ignora categorias que não existem", () => {
      const r = validarEdicao({ categorias: ["voar", "recolha_monos"] });
      if (r.ok) expect(r.alteracoes.categorias).toEqual(["recolha_monos"]);
    });

    // Um profissional sem categorias nunca recebe pedido nenhum. Deixar
    // esvaziar a lista era desactivá-lo sem o dizer.
    it("recusa deixar o profissional sem categorias", () => {
      expect(erros(validarEdicao({ categorias: [] }))).toContain("categorias");
      expect(erros(validarEdicao({ categorias: ["inventada"] }))).toContain("categorias");
    });
  });

  describe("zonas — já não se editam", () => {
    /*
     * Editá-las dava a quem mexe no painel a ideia de estar a alterar quem
     * recebe pedidos — e mostrava-lhe até o aviso de redistribuição — sobre
     * uma alteração que o motor nunca leu. A coluna segue a cidade de base.
     *
     * O `if (r.ok)` do teste anterior escondia isto: quando `zonas` deixou de
     * ser um campo válido, o pedido passou a ser recusado, o bloco deixou de
     * correr, e o teste continuou verde sem afirmar nada.
     */
    it("um pedido só com zonas não tem nada para alterar", () => {
      expect(validarEdicao({ zonas: ["Lisboa", "Sintra"] }).ok).toBe(false);
    });

    it("vindas ao lado de um campo real, são ignoradas em silêncio", () => {
      // Recusar partia o botão de guardar de quem tivesse a versão antiga do
      // painel aberta no browser, e que continua a mandá-las.
      const r = validarEdicao({ raioKm: 40, zonas: ["Lisboa"] });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.alteracoes).toEqual({ raioKm: 40 });
        expect(r.alteracoes.zonas).toBeUndefined();
      }
    });
  });

  describe("raio", () => {
    it("aceita texto do formulário", () => {
      const r = validarEdicao({ raioKm: "45" });
      if (r.ok) expect(r.alteracoes.raioKm).toBe(45);
    });

    it("recusa fora dos limites", () => {
      expect(erros(validarEdicao({ raioKm: 0 }))).toContain("raioKm");
      expect(erros(validarEdicao({ raioKm: RAIO_MAXIMO_KM + 1 }))).toContain("raioKm");
      expect(erros(validarEdicao({ raioKm: "muito" }))).toContain("raioKm");
    });
  });

  describe("guia de transporte", () => {
    it("exige número quando se liga a guia", () => {
      expect(
        erros(validarEdicao({ emiteGuiaTransporte: true, numeroTransportador: "" })),
      ).toContain("numeroTransportador");
    });

    it("aceita com número", () => {
      const r = validarEdicao({
        emiteGuiaTransporte: true,
        numeroTransportador: "APA-99887",
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.alteracoes.numeroTransportador).toBe("APA-99887");
    });

    // Um número órfão é o género de coisa que volta a aparecer numa consulta e
    // engana quem a lê.
    it("desligar a guia limpa o número", () => {
      const r = validarEdicao({
        emiteGuiaTransporte: false,
        numeroTransportador: "APA-99887",
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.alteracoes.emiteGuiaTransporte).toBe(false);
        expect(r.alteracoes.numeroTransportador).toBeNull();
      }
    });
  });

  it("a fatura é booleana e nada mais", () => {
    const sim = validarEdicao({ emiteFatura: true });
    const nao = validarEdicao({ emiteFatura: "sim" });
    if (sim.ok) expect(sim.alteracoes.emiteFatura).toBe(true);
    if (nao.ok) expect(nao.alteracoes.emiteFatura).toBe(false);
  });

  it("acumula erros de campos diferentes", () => {
    const r = validarEdicao({ categorias: [], raioKm: 9999 });
    expect(erros(r)).toEqual(expect.arrayContaining(["categorias", "raioKm"]));
  });
});

describe("estadoValido", () => {
  it("aceita os quatro estados", () => {
    for (const e of ESTADOS_DO_PROFISSIONAL) expect(estadoValido(e)).toBe(true);
  });
  it("recusa qualquer outra coisa", () => {
    for (const e of ["activo", "APROVADO", "", null, 1]) expect(estadoValido(e)).toBe(false);
  });
});

describe("afectaDistribuicao", () => {
  it("diz quando a alteração muda quem recebe pedidos", () => {
    expect(afectaDistribuicao({ raioKm: 50 })).toBe(true);
    expect(afectaDistribuicao({ categorias: ["recolha_moveis"] })).toBe(true);
    expect(afectaDistribuicao({ emiteFatura: true })).toBe(true);
    expect(afectaDistribuicao({ emiteGuiaTransporte: false })).toBe(true);
  });

  it("as zonas NÃO mudam quem recebe — e por isso não avisam", () => {
    /*
     * O aviso diz «afecta quem recebe os pedidos NOVOS». Dizê-lo por causa de
     * uma lista que o motor não lê era ensinar a ignorar o aviso — no ecrã
     * onde ele às vezes é verdade.
     */
    expect(afectaDistribuicao({ zonas: ["Lisboa"] })).toBe(false);
  });

  it("mudar só o número de transportador não muda a distribuição", () => {
    expect(afectaDistribuicao({ numeroTransportador: "APA-1" })).toBe(false);
  });
});
