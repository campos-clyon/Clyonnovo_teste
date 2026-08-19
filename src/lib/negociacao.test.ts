import { describe, it, expect } from "vitest";
import {
  negociacaoNova,
  propor,
  aceitar,
  contratar,
  desistir,
  accoesDisponiveis,
  propostasRestantes,
  propostaPendente,
  estaPrestesAExpirar,
  semSaida,
  MAX_PROPOSTAS_POR_LADO,
  PRAZO_DA_PROPOSTA_HORAS,
  type Negociacao,
  type Lado,
} from "./negociacao";

const T0 = new Date("2026-08-16T10:00:00Z");
const horas = (n: number) => new Date(T0.getTime() + n * 3600_000);

/** Aplica uma acção e devolve a negociação, rebentando se falhar. */
function aplica(r: ReturnType<typeof propor>): Negociacao {
  if (!r.ok) throw new Error(`acção recusada: ${r.erro}`);
  return r.negociacao;
}

describe("negociacaoNova", () => {
  it("abre com o valor que o cliente pediu, pendente", () => {
    const n = negociacaoNova(80, T0);
    expect(n.estado).toBe("aberta");
    expect(n.propostas).toHaveLength(1);
    expect(n.propostas[0]).toMatchObject({ por: "cliente", valor: 80, estado: "pendente" });
  });

  it("gasta uma das cinco do cliente", () => {
    const n = negociacaoNova(80, T0);
    expect(propostasRestantes(n, "cliente", T0)).toBe(MAX_PROPOSTAS_POR_LADO - 1);
    expect(propostasRestantes(n, "profissional", T0)).toBe(MAX_PROPOSTAS_POR_LADO);
  });
});

describe("alternância", () => {
  // Sem isto, um lado enterrava o outro em propostas e a negociação passava a
  // ser quem escreve mais depressa.
  it("quem tem proposta pendente não pode fazer outra", () => {
    const n = negociacaoNova(80, T0);
    expect(accoesDisponiveis(n, "cliente", T0)).not.toContain("propor");
    const r = propor(n, "cliente", 90, T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("à espera de resposta");
  });

  it("o outro lado pode aceitar ou contrapropor", () => {
    const n = negociacaoNova(80, T0);
    expect(accoesDisponiveis(n, "profissional", T0)).toEqual(
      expect.arrayContaining(["aceitar", "propor"]),
    );
  });

  it("contrapropor recusa a que estava em cima da mesa", () => {
    const n = aplica(propor(negociacaoNova(80, T0), "profissional", 120, horas(1)));
    expect(n.propostas[0].estado).toBe("recusada");
    expect(n.propostas[1]).toMatchObject({ por: "profissional", valor: 120, estado: "pendente" });
    expect(propostaPendente(n, horas(1))?.valor).toBe(120);
  });

  it("as propostas vão e voltam", () => {
    let n = negociacaoNova(80, T0);
    n = aplica(propor(n, "profissional", 120, horas(1)));
    n = aplica(propor(n, "cliente", 95, horas(2)));
    n = aplica(propor(n, "profissional", 110, horas(3)));
    expect(propostaPendente(n, horas(3))?.valor).toBe(110);
    expect(propostasRestantes(n, "cliente", horas(3))).toBe(3);
    expect(propostasRestantes(n, "profissional", horas(3))).toBe(3);
  });
});

describe("as cinco propostas", () => {
  /** Faz o cliente e o profissional alternarem até o cliente gastar as cinco. */
  function ateEsgotar(lado: Lado): Negociacao {
    let n = negociacaoNova(80, T0);
    let t = 1;
    while (propostasRestantes(n, lado, horas(t)) > 0) {
      const outro: Lado = lado === "cliente" ? "profissional" : "cliente";
      if (propostaPendente(n, horas(t))?.por === lado) {
        n = aplica(propor(n, outro, 100 + t, horas(t++)));
      }
      n = aplica(propor(n, lado, 90 + t, horas(t++)));
    }
    return n;
  }

  it("esgotadas as cinco, só resta aceitar ou desistir", () => {
    const n = ateEsgotar("cliente");
    expect(propostasRestantes(n, "cliente", horas(50))).toBe(0);
    const accoes = accoesDisponiveis(n, "cliente", horas(11));
    expect(accoes).not.toContain("propor");
    expect(accoes).toContain("desistir");
  });

  it("a mensagem de recusa explica porquê", () => {
    const n = ateEsgotar("cliente");
    const r = propor(n, "cliente", 999, horas(11));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("cinco propostas");
  });
});

describe("prazo de 48 horas", () => {
  it("uma proposta expira ao fim do prazo", () => {
    const n = negociacaoNova(80, T0);
    expect(propostaPendente(n, horas(PRAZO_DA_PROPOSTA_HORAS - 1))).not.toBeNull();
    expect(propostaPendente(n, horas(PRAZO_DA_PROPOSTA_HORAS))).toBeNull();
  });

  // A regra que impede o silêncio de ser a melhor jogada: se expirar gastasse
  // chance de quem propôs, bastava ao outro lado calar-se para ganhar.
  it("expirar NÃO gasta chance de quem propôs", () => {
    const n = negociacaoNova(80, T0);
    expect(propostasRestantes(n, "cliente", T0)).toBe(4);
    expect(propostasRestantes(n, "cliente", horas(PRAZO_DA_PROPOSTA_HORAS + 1))).toBe(5);
  });

  it("depois de expirar, quem propôs pode propor de novo", () => {
    const n = negociacaoNova(80, T0);
    const depois = horas(PRAZO_DA_PROPOSTA_HORAS + 1);
    expect(accoesDisponiveis(n, "cliente", depois)).toContain("propor");
    expect(propor(n, "cliente", 85, depois).ok).toBe(true);
  });

  it("uma proposta expirada já não se aceita", () => {
    const n = negociacaoNova(80, T0);
    const depois = horas(PRAZO_DA_PROPOSTA_HORAS + 1);
    expect(accoesDisponiveis(n, "profissional", depois)).not.toContain("aceitar");
    expect(aceitar(n, "profissional", depois).ok).toBe(false);
  });

  it("avisa antes de expirar", () => {
    const n = negociacaoNova(80, T0);
    const p = n.propostas[0];
    expect(estaPrestesAExpirar(p, horas(1))).toBe(false);
    expect(estaPrestesAExpirar(p, horas(40))).toBe(true);
    expect(estaPrestesAExpirar(p, horas(PRAZO_DA_PROPOSTA_HORAS + 1))).toBe(false);
  });
});

describe("aperto de mão duplo", () => {
  // Vários profissionais podem estar a negociar o mesmo pedido. Sem o segundo
  // passo, o primeiro a aceitar ficava com o trabalho sem o cliente ter
  // escolhido quem lhe entra em casa.
  it("o profissional aceitar NÃO fecha o negócio", () => {
    const n = aplica(aceitar(negociacaoNova(80, T0), "profissional", horas(1)));
    expect(n.estado).toBe("aguarda_contratacao");
    expect(n.valorAcordado).toBe(80);
  });

  it("depois disso, só o cliente decide", () => {
    const n = aplica(aceitar(negociacaoNova(80, T0), "profissional", horas(1)));
    expect(accoesDisponiveis(n, "cliente", horas(2))).toEqual(["contratar", "desistir"]);
    expect(accoesDisponiveis(n, "profissional", horas(2))).toEqual(["desistir"]);
  });

  it("contratar fecha", () => {
    let n = aplica(aceitar(negociacaoNova(80, T0), "profissional", horas(1)));
    n = aplica(contratar(n, horas(2)));
    expect(n.estado).toBe("acordada");
    expect(n.valorAcordado).toBe(80);
  });

  // A assimetria: quando o cliente aceita, a escolha já está feita.
  it("o cliente aceitar fecha logo", () => {
    let n = negociacaoNova(80, T0);
    n = aplica(propor(n, "profissional", 120, horas(1)));
    n = aplica(aceitar(n, "cliente", horas(2)));
    expect(n.estado).toBe("acordada");
    expect(n.valorAcordado).toBe(120);
  });

  it("não se contrata o que ninguém aceitou", () => {
    expect(contratar(negociacaoNova(80, T0), horas(1)).ok).toBe(false);
  });
});

describe("fim da negociação", () => {
  it("uma negociação acordada não aceita mais nada", () => {
    let n = negociacaoNova(80, T0);
    n = aplica(propor(n, "profissional", 120, horas(1)));
    n = aplica(aceitar(n, "cliente", horas(2)));
    expect(accoesDisponiveis(n, "cliente", horas(3))).toEqual([]);
    expect(accoesDisponiveis(n, "profissional", horas(3))).toEqual([]);
    expect(propor(n, "profissional", 130, horas(3)).ok).toBe(false);
  });

  it("desistir termina", () => {
    const n = aplica(desistir(negociacaoNova(80, T0), "profissional", horas(1)));
    expect(n.estado).toBe("desistida");
    expect(accoesDisponiveis(n, "cliente", horas(2))).toEqual([]);
  });

  it("desistir duas vezes não faz nada", () => {
    const n = aplica(desistir(negociacaoNova(80, T0), "cliente", horas(1)));
    expect(desistir(n, "cliente", horas(2)).ok).toBe(false);
  });
});

describe("semSaida", () => {
  it("é falso enquanto houver propostas por gastar", () => {
    expect(semSaida(negociacaoNova(80, T0), T0)).toBe(false);
  });

  it("é falso quando há proposta em cima da mesa", () => {
    const n = negociacaoNova(80, T0);
    expect(semSaida(n, horas(1))).toBe(false);
  });
});

describe("valores", () => {
  it("recusa valores inválidos", () => {
    const n = negociacaoNova(80, T0);
    for (const v of [0, -10, NaN, Infinity]) {
      expect(propor(n, "profissional", v, horas(1)).ok).toBe(false);
    }
  });

  it("arredonda aos cêntimos", () => {
    const n = aplica(propor(negociacaoNova(80, T0), "profissional", 99.999, horas(1)));
    expect(n.propostas[1].valor).toBe(100);
  });
});

describe("datas vindas da base como texto", () => {
  it("uma proposta com criadaEm em ISO comporta-se igual", () => {
    const n: Negociacao = {
      estado: "aberta",
      valorAcordado: null,
      propostas: [
        { por: "cliente", valor: 80, criadaEm: T0.toISOString(), estado: "pendente" },
      ],
    };
    expect(propostaPendente(n, horas(1))?.valor).toBe(80);
    expect(propostaPendente(n, horas(PRAZO_DA_PROPOSTA_HORAS + 1))).toBeNull();
  });
});
