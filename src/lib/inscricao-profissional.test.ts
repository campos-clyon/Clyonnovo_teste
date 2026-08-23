import { describe, it, expect } from "vitest";
import {
  validarInscricao,
  nifValido,
  emailValido,
  codigoPostalValido,
  normalizarCodigoPostal,
  telefoneValido,
  pareceMorada,
  RAIO_MAXIMO_KM,
} from "./inscricao-profissional";

const valida = {
  nome: "Transportes Silva Lda",
  email: "geral@silva.pt",
  telefone: "912345678",
  nif: "501442600",
  cidade: "Amadora",
  moradaFiscal: "Rua das Oliveiras 14, 2.º Dto.",
  codigoPostalFiscal: "2700-123",
  localidadeFiscal: "Amadora",
  tipoVeiculo: "carrinha_grande",
  categorias: ["recolha_moveis", "recolha_monos"],
  zonas: ["Lisboa", "Sintra"],
  raioKm: 30,
  emiteFatura: true,
  regimeIva: "isento",
  emiteGuiaTransporte: false,
  numeroTransportador: "",
};

const com = (p: Record<string, unknown>) => validarInscricao({ ...valida, ...p });

function erros(r: ReturnType<typeof validarInscricao>) {
  return r.ok ? [] : r.erros.map((e) => e.campo);
}

describe("nifValido", () => {
  // Dígito de controlo — apanha o engano de digitação quando ainda é barato
  // de corrigir, em vez de estragar uma fatura meses depois.
  it("aceita NIF com dígito de controlo certo", () => {
    expect(nifValido("501442600")).toBe(true);
    expect(nifValido("500 100 144")).toBe(true);
  });

  it("recusa NIF com dígito de controlo errado", () => {
    expect(nifValido("501442601")).toBe(false);
    expect(nifValido("111111111")).toBe(false);
    // 123456789 tem o dígito de controlo CERTO (soma 156, resto 2, controlo 9).
    // Parece inventado e passa — é por isso que o teste usa outro.
    expect(nifValido("123456789")).toBe(true);
  });

  it("recusa o que não tem nove dígitos", () => {
    expect(nifValido("50144260")).toBe(false);
    expect(nifValido("5014426000")).toBe(false);
    expect(nifValido("abcdefghi")).toBe(false);
    expect(nifValido("")).toBe(false);
  });
});

describe("telefoneValido", () => {
  it("aceita telemóvel e fixo, com e sem indicativo", () => {
    for (const t of ["912345678", "+351912345678", "00351912345678", "912 345 678", "213456789"]) {
      expect(telefoneValido(t)).toBe(true);
    }
  });

  it("recusa números que não existem em Portugal", () => {
    for (const t of ["12345678", "812345678", "91234567", "9123456789", ""]) {
      expect(telefoneValido(t)).toBe(false);
    }
  });
});

describe("emailValido", () => {
  it("aceita e recusa o óbvio", () => {
    expect(emailValido("a@b.pt")).toBe(true);
    expect(emailValido("sem-arroba.pt")).toBe(false);
    expect(emailValido("a@b")).toBe(false);
    expect(emailValido("")).toBe(false);
  });
});

describe("validarInscricao", () => {
  it("aceita uma inscrição completa", () => {
    const r = validarInscricao(valida);
    expect(r.ok).toBe(true);
  });

  it("exige nome, email, telefone e cidade", () => {
    expect(erros(com({ nome: "" }))).toContain("nome");
    expect(erros(com({ email: "xx" }))).toContain("email");
    expect(erros(com({ telefone: "123" }))).toContain("telefone");
    expect(erros(com({ cidade: "" }))).toContain("cidade");
  });

  it("exige pelo menos uma categoria", () => {
    expect(erros(com({ categorias: [] }))).toContain("categorias");
  });

  // Sem isto, alguém inscrevia-se com uma categoria inventada e ficava com um
  // perfil que nunca casava com pedido nenhum.
  it("ignora categorias que não existem", () => {
    expect(erros(com({ categorias: ["voar", "recolha_moveis"] }))).toEqual([]);
    const r = com({ categorias: ["voar", "recolha_moveis"] });
    if (r.ok) expect(r.dados.categorias).toEqual(["recolha_moveis"]);
  });

  it("recusa uma inscrição só com categorias inventadas", () => {
    expect(erros(com({ categorias: ["voar"] }))).toContain("categorias");
  });

  describe("raio", () => {
    it("recusa raios absurdos ou em falta", () => {
      expect(erros(com({ raioKm: 0 }))).toContain("raioKm");
      expect(erros(com({ raioKm: RAIO_MAXIMO_KM + 1 }))).toContain("raioKm");
      expect(erros(com({ raioKm: "muitos" }))).toContain("raioKm");
      expect(erros(com({ raioKm: undefined }))).toContain("raioKm");
    });

    it("aceita raio vindo como texto do formulário", () => {
      const r = com({ raioKm: "45" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.dados.raioKm).toBe(45);
    });
  });

  describe("fatura", () => {
    it("quem emite fatura tem de dar NIF", () => {
      expect(erros(com({ emiteFatura: true, nif: "" }))).toContain("nif");
    });

    // O IVA é do regime DELE. Assumi-lo por nós mostrava 23% a quem contrata
    // um isento — um imposto que não é devido e que ninguém pode entregar.
    it("quem emite fatura tem de dizer o regime de IVA", () => {
      expect(erros(com({ emiteFatura: true, regimeIva: undefined }))).toContain("regimeIva");
      expect(erros(com({ emiteFatura: true, regimeIva: "inventado" }))).toContain("regimeIva");
    });

    it("aceita os dois regimes", () => {
      for (const r of ["isento", "normal"]) {
        const x = com({ emiteFatura: true, regimeIva: r });
        expect(x.ok).toBe(true);
        if (x.ok) expect(x.dados.regimeIva).toBe(r);
      }
    });

    // Quem não emite fatura não tem regime nenhum a declarar. Fica isento por
    // omissão, que é o que não mostra imposto ao cliente.
    it("quem não emite fatura não precisa de regime, e fica isento", () => {
      const x = com({ emiteFatura: false, nif: "", regimeIva: undefined });
      expect(x.ok).toBe(true);
      if (x.ok) expect(x.dados.regimeIva).toBe("isento");
    });

    it("quem não emite fatura pode não dar NIF", () => {
      expect(erros(com({ emiteFatura: false, nif: "" }))).toEqual([]);
    });

    it("um NIF errado é recusado mesmo sem emitir fatura", () => {
      expect(erros(com({ emiteFatura: false, nif: "111111111" }))).toContain("nif");
    });
  });

  describe("guia de transporte", () => {
    // Sem número não há nada para verificar, e sem verificação a declaração
    // não vale — não se liga um cliente a quem talvez não possa transportar.
    it("quem declara emitir guia tem de dar o número de registo", () => {
      expect(erros(com({ emiteGuiaTransporte: true, numeroTransportador: "" }))).toContain(
        "numeroTransportador",
      );
      expect(erros(com({ emiteGuiaTransporte: true, numeroTransportador: "ab" }))).toContain(
        "numeroTransportador",
      );
    });

    it("aceita com número", () => {
      const r = com({ emiteGuiaTransporte: true, numeroTransportador: "APA-123456" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.dados.numeroTransportador).toBe("APA-123456");
    });

    it("quem não declara guia não precisa de número", () => {
      const r = com({ emiteGuiaTransporte: false, numeroTransportador: "" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.dados.numeroTransportador).toBeNull();
    });
  });

  describe("zonas", () => {
    // Quem não escrevesse zonas nenhumas não recebia nada, nem sequer da sua
    // própria cidade.
    it("a cidade de base entra sempre nas zonas", () => {
      const r = com({ zonas: [] });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.dados.zonas).toEqual(["Amadora"]);
    });

    it("não duplica a cidade quando ela já vem nas zonas", () => {
      const r = com({ zonas: ["Amadora", "Lisboa"] });
      if (r.ok) expect(r.dados.zonas).toEqual(["Amadora", "Lisboa"]);
    });
  });

  it("normaliza o email para minúsculas", () => {
    const r = com({ email: "Geral@Silva.PT" });
    if (r.ok) expect(r.dados.email).toBe("geral@silva.pt");
  });

  it("não rebenta com lixo à entrada", () => {
    for (const lixo of [null, undefined, "texto", 42, [], {}]) {
      expect(validarInscricao(lixo).ok).toBe(false);
    }
  });

  it("acumula os erros todos em vez de parar no primeiro", () => {
    const r = validarInscricao({});
    expect(erros(r).length).toBeGreaterThanOrEqual(5);
  });
});

describe("código postal", () => {
  it("aceita com e sem traço", () => {
    expect(codigoPostalValido("2700-123")).toBe(true);
    expect(codigoPostalValido("2700123")).toBe(true);
    expect(codigoPostalValido(" 2700 - 123 ")).toBe(true);
  });

  it("recusa o que não é um código postal português", () => {
    for (const cp of ["270-123", "27000-123", "2700-12", "abcd-efg", ""]) {
      expect(codigoPostalValido(cp)).toBe(false);
    }
  });

  it("normaliza para 0000-000", () => {
    expect(normalizarCodigoPostal("2700123")).toBe("2700-123");
    expect(normalizarCodigoPostal("2700-123")).toBe("2700-123");
  });
});

describe("morada fiscal", () => {
  // Uma fatura sem morada do emitente não é uma fatura. Aceitar a inscrição
  // sem ela era deixá-lo emitir documentos que não servem ao cliente.
  it("quem emite fatura tem de a dar inteira", () => {
    expect(erros(com({ moradaFiscal: "" }))).toContain("moradaFiscal");
    expect(erros(com({ codigoPostalFiscal: "" }))).toContain("codigoPostalFiscal");
    expect(erros(com({ localidadeFiscal: "" }))).toContain("localidadeFiscal");
  });

  it("recusa código postal mal escrito", () => {
    expect(erros(com({ codigoPostalFiscal: "27-123" }))).toContain("codigoPostalFiscal");
  });

  it("guarda o código postal normalizado", () => {
    const r = com({ codigoPostalFiscal: "2700123" });
    if (r.ok) expect(r.dados.codigoPostalFiscal).toBe("2700-123");
  });

  // Quem não emite fatura não é obrigado a declarar morada nenhuma — mas se
  // começar a escrevê-la, tem de a acabar. Meia morada não serve para nada.
  it("quem não emite fatura pode não a dar", () => {
    const r = com({
      emiteFatura: false,
      nif: "",
      regimeIva: undefined,
      moradaFiscal: "",
      codigoPostalFiscal: "",
      localidadeFiscal: "",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dados.moradaFiscal).toBeNull();
  });

  it("meia morada é recusada mesmo sem emitir fatura", () => {
    const e = erros(
      com({
        emiteFatura: false,
        nif: "",
        regimeIva: undefined,
        moradaFiscal: "Rua sem fim 3",
        codigoPostalFiscal: "",
        localidadeFiscal: "",
      }),
    );
    expect(e).toContain("codigoPostalFiscal");
    expect(e).toContain("localidadeFiscal");
  });
});

describe("veículo", () => {
  // Um sofá de três lugares não entra numa carrinha pequena. Sem este campo,
  // mandávamos-lhe o pedido e ele perdia a viagem — e o cliente, o dia.
  it("é obrigatório", () => {
    expect(erros(com({ tipoVeiculo: "" }))).toContain("tipoVeiculo");
    expect(erros(com({ tipoVeiculo: undefined }))).toContain("tipoVeiculo");
  });

  it("recusa um tipo que não existe", () => {
    expect(erros(com({ tipoVeiculo: "helicoptero" }))).toContain("tipoVeiculo");
  });

  it("aceita quem não tem veículo próprio", () => {
    const r = com({ tipoVeiculo: "sem_veiculo" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dados.tipoVeiculo).toBe("sem_veiculo");
  });
});

describe("o nome não pode ser uma morada", () => {
  /*
   * O primeiro profissional a inscrever-se ficou com "Rua Capitão Salgueiro
   * Maia 23" no campo do nome. A causa foi o browser — o formulário tem
   * morada, código postal e localidade, e sem `autoComplete` no campo do nome
   * o Chrome classificou-o como parte da morada e ofereceu a rua guardada.
   *
   * O buraco foi tapado no formulário, que é onde se resolve de verdade. Isto
   * é a rede por baixo: o nome é o que o CLIENTE vê ao escolher quem lhe entra
   * em casa, e uma morada ali não lhe diz com quem está a falar.
   */
  it("apanha o caso real que aconteceu", () => {
    expect(pareceMorada("Rua Capitão Salgueiro Maia 23")).toBe(true);
    expect(pareceMorada("Rua Da Liberdade 61 Parque Verde Fernão Ferro")).toBe(true);
  });

  it("apanha as abreviaturas e outros tipos de via", () => {
    expect(pareceMorada("Av. da República 45")).toBe(true);
    expect(pareceMorada("Travessa do Forno 12")).toBe(true);
    expect(pareceMorada("PRACETA DAS FLORES 3")).toBe(true);
    expect(pareceMorada("Estrada Nacional 10")).toBe(true);
  });

  it("apanha um código postal, que num nome de empresa não tem explicação", () => {
    expect(pareceMorada("Transportes Silva 2845-513")).toBe(true);
  });

  /*
   * Reconhece-se pouco de propósito. Recusar uma inscrição legítima é pior do
   * que deixar passar um nome estranho: quem escreve o nome ao contrário
   * corrige-se com um telefonema, quem é recusado vai-se embora.
   */
  it("NÃO recusa nomes de empresa legítimos", () => {
    expect(pareceMorada("Transportes Silva Lda")).toBe(false);
    expect(pareceMorada("Mudanças Rápidas")).toBe(false);
    expect(pareceMorada("João Pereira")).toBe(false);
    // Tipo de via sem número de porta: pode ser um nome de sítio.
    expect(pareceMorada("Largo Mudanças")).toBe(false);
    expect(pareceMorada("Quinta do Anjo Transportes")).toBe(false);
    // Um número sozinho também não chega — há empresas com números no nome.
    expect(pareceMorada("Transportes 24h")).toBe(false);
    expect(pareceMorada("Grupo 4 Logística")).toBe(false);
  });

  it("não confunde palavras que começam como um tipo de via", () => {
    // Sem a fronteira de palavra no regex, "Lote" apanhava "Lotearte".
    expect(pareceMorada("Lotearte 2000")).toBe(false);
    expect(pareceMorada("Becolândia 7")).toBe(false);
  });

  it("recusa a inscrição inteira quando o nome é uma morada", () => {
    const r = com({ nome: "Rua Capitão Salgueiro Maia 23" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erros.some((e) => e.campo === "nome")).toBe(true);
      expect(r.erros.find((e) => e.campo === "nome")?.mensagem).toContain("morada");
    }
  });
});
