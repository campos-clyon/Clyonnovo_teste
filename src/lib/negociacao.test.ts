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
  expiraEm,
  estaPrestesAExpirar,
  semSaida,
  MAX_PROPOSTAS_POR_LADO,
  MAX_PROPOSTAS_POR_EXTENSO,
  PRAZO_DA_PROPOSTA_HORAS,
  type Negociacao,
  type Proposta,
  type Lado,
} from "./negociacao";

const T0 = new Date("2026-08-16T10:00:00Z");
const horas = (n: number) => new Date(T0.getTime() + n * 3600_000);

/** Aplica uma acção e devolve a negociação, rebentando se falhar. */
function aplica(r: ReturnType<typeof propor>): Negociacao {
  if (!r.ok) throw new Error(`acção recusada: ${r.erro}`);
  return r.negociacao;
}

/**
 * A mesa como abria ANTES: com o valor do cliente já lá, pendente. As
 * negociações gravadas até 09-09-2026 têm esta forma, e o motor tem de
 * continuar a tratá-las — é sobre ela que as regras de alternância se testam.
 */
function abertaPeloCliente(valor: number, agora: Date): Negociacao {
  return {
    estado: "aberta",
    valorAcordado: null,
    propostas: [{ por: "cliente", valor, criadaEm: agora, estado: "pendente" }],
  };
}

describe("negociacaoNova", () => {
  it("abre VAZIA — o profissional propõe primeiro", () => {
    // "Não será o cliente a propor pela primeira vez, e sim o pro."
    const n = negociacaoNova(T0);
    expect(n.estado).toBe("aberta");
    expect(n.propostas).toHaveLength(0);
    expect(propostasRestantes(n, "cliente", T0)).toBe(MAX_PROPOSTAS_POR_LADO);
    expect(propostasRestantes(n, "profissional", T0)).toBe(MAX_PROPOSTAS_POR_LADO);
  });

  it("com a mesa vazia, o cliente só pode desistir; o profissional propõe", () => {
    const n = negociacaoNova(T0);
    expect(accoesDisponiveis(n, "cliente", T0)).toEqual(["desistir"]);
    expect(accoesDisponiveis(n, "profissional", T0)).toEqual(["propor", "desistir"]);
    expect(propor(n, "cliente", 80, T0).ok).toBe(false);
  });

  it("depois da primeira proposta do profissional, a negociação é a de sempre", () => {
    const n = aplica(propor(negociacaoNova(T0), "profissional", 96.6, T0));
    expect(propostaPendente(n, T0)).toMatchObject({ por: "profissional", valor: 96.6 });
    expect(accoesDisponiveis(n, "cliente", T0)).toEqual(
      expect.arrayContaining(["aceitar", "propor", "desistir"]),
    );
    expect(accoesDisponiveis(n, "profissional", T0)).toEqual(["desistir"]);
  });

  it("a abertura antiga, pelo cliente, gasta uma das dele", () => {
    const n = abertaPeloCliente(80, T0);
    expect(propostasRestantes(n, "cliente", T0)).toBe(MAX_PROPOSTAS_POR_LADO - 1);
    expect(propostasRestantes(n, "profissional", T0)).toBe(MAX_PROPOSTAS_POR_LADO);
  });
});

describe("alternância", () => {
  // Sem isto, um lado enterrava o outro em propostas e a negociação passava a
  // ser quem escreve mais depressa.
  it("quem tem proposta pendente não pode fazer outra", () => {
    const n = abertaPeloCliente(80, T0);
    expect(accoesDisponiveis(n, "cliente", T0)).not.toContain("propor");
    const r = propor(n, "cliente", 90, T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("à espera de resposta");
  });

  it("o outro lado pode aceitar ou contrapropor", () => {
    const n = abertaPeloCliente(80, T0);
    expect(accoesDisponiveis(n, "profissional", T0)).toEqual(
      expect.arrayContaining(["aceitar", "propor"]),
    );
  });

  it("contrapropor recusa a que estava em cima da mesa", () => {
    const n = aplica(propor(abertaPeloCliente(80, T0), "profissional", 120, horas(1)));
    expect(n.propostas[0].estado).toBe("recusada");
    expect(n.propostas[1]).toMatchObject({ por: "profissional", valor: 120, estado: "pendente" });
    expect(propostaPendente(n, horas(1))?.valor).toBe(120);
  });

  it("as propostas vão e voltam", () => {
    let n = abertaPeloCliente(80, T0);
    n = aplica(propor(n, "profissional", 120, horas(1)));
    n = aplica(propor(n, "cliente", 95, horas(2)));
    n = aplica(propor(n, "profissional", 110, horas(3)));
    expect(propostaPendente(n, horas(3))?.valor).toBe(110);
    // Duas gastas de cada lado: o que sobra vem da constante, e não de um «3»
    // escrito à mão — esse mentia no dia em que o limite passou de cinco a sete.
    expect(propostasRestantes(n, "cliente", horas(3))).toBe(MAX_PROPOSTAS_POR_LADO - 2);
    expect(propostasRestantes(n, "profissional", horas(3))).toBe(MAX_PROPOSTAS_POR_LADO - 2);
  });
});

describe("as propostas de cada lado", () => {
  /** Faz o cliente e o profissional alternarem até um deles as gastar todas. */
  function ateEsgotar(lado: Lado): Negociacao {
    let n = abertaPeloCliente(80, T0);
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

  it("esgotadas, só resta aceitar ou desistir", () => {
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
    // A palavra vem da constante: com o limite em sete, a frase diz "sete".
    if (!r.ok) expect(r.erro).toContain(`${MAX_PROPOSTAS_POR_EXTENSO} propostas`);
  });
});

/**
 * AS PROPOSTAS DEIXARAM DE MORRER SOZINHAS — 20-09-2026.
 *
 * "Remova o tempo, já que os pedidos vão ser apagados em 60 dias."
 *
 * Este bloco chamava-se «prazo de 48 horas» e guardava o contrário do que
 * guarda agora. A regra existia para impedir que uma proposta ficasse viva
 * para sempre — e já havia quem tratasse disso: a purga apaga o pedido aos 60
 * dias, e com ele a negociação inteira. Eram duas regras para o mesmo
 * problema, e a mais curta estava a fazer mal:
 *
 *   o #320 tinha três valores em cima da mesa — 322 €, 350 € e 329 € — e dois
 *   deles já não se podiam aceitar. O cliente demorou quatro dias a decidir,
 *   como as pessoas demoram, e a plataforma respondeu-lhe que as propostas
 *   tinham caducado. Ninguém desistiu do negócio: foi o relógio.
 *
 * A mecânica fica toda de pé atrás de `AS_PROPOSTAS_EXPIRAM`, e estes testes
 * passam a guardar o que ela faz DESLIGADA — que é o estado em que está.
 */
describe("as propostas não morrem sozinhas", () => {
  it("uma proposta de há meses continua de pé", () => {
    const n = abertaPeloCliente(80, T0);
    expect(propostaPendente(n, horas(PRAZO_DA_PROPOSTA_HORAS - 1))).not.toBeNull();
    expect(propostaPendente(n, horas(PRAZO_DA_PROPOSTA_HORAS))).not.toBeNull();
    // Cinquenta dias depois — já perto da purga — e ainda lá está.
    expect(propostaPendente(n, horas(24 * 50))).not.toBeNull();
  });

  it("e aceita-se, por mais tempo que tenha passado", () => {
    /*
     * Era isto que dava 409 na mesa: «Não há proposta para aceitar» sobre um
     * valor que estava à frente dos olhos de quem carregava no botão.
     */
    const n = abertaPeloCliente(80, T0);
    const muitoDepois = horas(24 * 50);
    expect(accoesDisponiveis(n, "profissional", muitoDepois)).toContain("aceitar");
    expect(aceitar(n, "profissional", muitoDepois).ok).toBe(true);
  });

  it("a chance continua gasta — o tempo já não a devolve", () => {
    /*
     * Mudou com a regra, e é a consequência que vale a pena ter escrita: a
     * chance voltava porque a proposta morria. Sem morte, a proposta continua
     * em cima da mesa a ocupar a vez de quem a fez — que é o que ela é.
     */
    const n = abertaPeloCliente(80, T0);
    expect(propostasRestantes(n, "cliente", T0)).toBe(MAX_PROPOSTAS_POR_LADO - 1);
    expect(propostasRestantes(n, "cliente", horas(24 * 50))).toBe(MAX_PROPOSTAS_POR_LADO - 1);
  });

  it("e quem propôs continua à espera, em vez de poder propor outra vez", () => {
    // Com prazo, o silêncio do outro lado devolvia-lhe a vez. Agora a vez é
    // de quem ainda não respondeu, e é assim que fica.
    const n = abertaPeloCliente(80, T0);
    expect(accoesDisponiveis(n, "cliente", horas(24 * 50))).not.toContain("propor");
  });

  it("ninguém é avisado de um prazo que não existe", () => {
    const n = abertaPeloCliente(80, T0);
    const p = n.propostas[0];
    for (const h of [1, 40, PRAZO_DA_PROPOSTA_HORAS + 1, 24 * 50]) {
      expect(estaPrestesAExpirar(p, horas(h)), `${h} h`).toBe(false);
    }
  });

  it("mas uma proposta JÁ MARCADA como expirada continua morta", () => {
    /*
     * As que o prazo apanhou antes de 20-09-2026 têm `estado: "expirada"`
     * gravado, e já foi dito às pessoas que tinham caducado. Ressuscitá-las
     * seria pôr em cima da mesa um valor que os dois lados dão por encerrado.
     */
    const n = abertaPeloCliente(80, T0);
    const morta = {
      ...n,
      propostas: [{ ...n.propostas[0], estado: "expirada" as const }],
    };
    expect(propostaPendente(morta, horas(1))).toBeNull();
  });
});

describe("aperto de mão duplo", () => {
  // Vários profissionais podem estar a negociar o mesmo pedido. Sem o segundo
  // passo, o primeiro a aceitar ficava com o trabalho sem o cliente ter
  // escolhido quem lhe entra em casa.
  it("o profissional aceitar NÃO fecha o negócio", () => {
    const n = aplica(aceitar(abertaPeloCliente(80, T0), "profissional", horas(1)));
    expect(n.estado).toBe("aguarda_contratacao");
    expect(n.valorAcordado).toBe(80);
  });

  it("depois disso, só o cliente decide", () => {
    const n = aplica(aceitar(abertaPeloCliente(80, T0), "profissional", horas(1)));
    expect(accoesDisponiveis(n, "cliente", horas(2))).toEqual(["contratar", "desistir"]);
    expect(accoesDisponiveis(n, "profissional", horas(2))).toEqual(["desistir"]);
  });

  it("contratar fecha", () => {
    let n = aplica(aceitar(abertaPeloCliente(80, T0), "profissional", horas(1)));
    n = aplica(contratar(n, horas(2)));
    expect(n.estado).toBe("acordada");
    expect(n.valorAcordado).toBe(80);
  });

  // A assimetria: quando o cliente aceita, a escolha já está feita.
  it("o cliente aceitar fecha logo", () => {
    let n = abertaPeloCliente(80, T0);
    n = aplica(propor(n, "profissional", 120, horas(1)));
    n = aplica(aceitar(n, "cliente", horas(2)));
    expect(n.estado).toBe("acordada");
    expect(n.valorAcordado).toBe(120);
  });

  it("não se contrata o que ninguém aceitou", () => {
    expect(contratar(abertaPeloCliente(80, T0), horas(1)).ok).toBe(false);
  });
});

describe("fim da negociação", () => {
  it("uma negociação acordada não aceita mais nada", () => {
    let n = abertaPeloCliente(80, T0);
    n = aplica(propor(n, "profissional", 120, horas(1)));
    n = aplica(aceitar(n, "cliente", horas(2)));
    expect(accoesDisponiveis(n, "cliente", horas(3))).toEqual([]);
    expect(accoesDisponiveis(n, "profissional", horas(3))).toEqual([]);
    expect(propor(n, "profissional", 130, horas(3)).ok).toBe(false);
  });

  it("desistir termina", () => {
    const n = aplica(desistir(abertaPeloCliente(80, T0), "profissional", horas(1)));
    expect(n.estado).toBe("desistida");
    expect(accoesDisponiveis(n, "cliente", horas(2))).toEqual([]);
  });

  it("desistir duas vezes não faz nada", () => {
    const n = aplica(desistir(abertaPeloCliente(80, T0), "cliente", horas(1)));
    expect(desistir(n, "cliente", horas(2)).ok).toBe(false);
  });
});

describe("semSaida", () => {
  it("é falso enquanto houver propostas por gastar", () => {
    expect(semSaida(abertaPeloCliente(80, T0), T0)).toBe(false);
  });

  it("é falso quando há proposta em cima da mesa", () => {
    const n = abertaPeloCliente(80, T0);
    expect(semSaida(n, horas(1))).toBe(false);
  });
});

describe("valores", () => {
  it("recusa valores inválidos", () => {
    const n = abertaPeloCliente(80, T0);
    for (const v of [0, -10, NaN, Infinity]) {
      expect(propor(n, "profissional", v, horas(1)).ok).toBe(false);
    }
  });

  it("arredonda aos cêntimos", () => {
    const n = aplica(propor(abertaPeloCliente(80, T0), "profissional", 99.999, horas(1)));
    expect(n.propostas[1].valor).toBe(100);
  });
});

describe("datas vindas da base como texto", () => {
  /*
   * O `criadaEm` chega do MySQL como texto e do código como `Date`, e o motor
   * faz contas de datas sobre ele. Este teste apanhava isso pelo prazo — uma
   * proposta em ISO expirava à mesma hora que uma com `Date`. Desde 20-09-2026
   * as propostas não expiram (ver `AS_PROPOSTAS_EXPIRAM`), pelo que a conta
   * passa a ser lida onde ainda vive: em `expiraEm`, que é o que voltaria a
   * mandar no dia em que o prazo voltasse.
   */
  it("o criadaEm em ISO dá as mesmas contas que um Date", () => {
    const texto: Proposta = { por: "cliente", valor: 80, criadaEm: T0.toISOString(), estado: "pendente" };
    const objecto: Proposta = { por: "cliente", valor: 80, criadaEm: T0, estado: "pendente" };
    expect(expiraEm(texto).getTime()).toBe(expiraEm(objecto).getTime());
    expect(expiraEm(texto).getTime()).toBe(horas(PRAZO_DA_PROPOSTA_HORAS).getTime());
  });

  it("e uma proposta em ISO está em cima da mesa como qualquer outra", () => {
    const n: Negociacao = {
      estado: "aberta",
      valorAcordado: null,
      propostas: [
        { por: "cliente", valor: 80, criadaEm: T0.toISOString(), estado: "pendente" },
      ],
    };
    expect(propostaPendente(n, horas(1))?.valor).toBe(80);
    expect(propostaPendente(n, horas(PRAZO_DA_PROPOSTA_HORAS + 1))?.valor).toBe(80);
  });
});
