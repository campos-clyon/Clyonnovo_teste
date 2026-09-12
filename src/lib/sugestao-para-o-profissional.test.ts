import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parametrosDoMapa,
  sugerirParaOProfissional,
  type ParametrosDeCusto,
} from "./sugestao-para-o-profissional";
import {
  sugestaoComOutroTempo,
  horasValidas,
  pessoasValidas,
  HORAS_MINIMAS,
  HORAS_MAXIMAS,
  PESSOAS_MINIMAS,
  PESSOAS_MAXIMAS,
} from "./sugestao-ajustada";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * A sugestão calculada para o profissional que está a ver o pedido.
 *
 * "Vamos usar dados reais do profissional que está a ver o pedido para
 * calcular individualmente esses valores." Os quilómetros são os dele, e os
 * custos, se os tiver definido, também.
 */

const CLYON: ParametrosDeCusto = {
  custoKm: 0.5,
  custoHoraPessoa: 9,
  numPessoas: 3,
  overhead: 17,
  margem: 0.4,
};

const recolha = {
  serviceType: "recolha_moveis",
  description: "Um sofá",
  floor: "0",
  hasElevator: "yes",
  parkingDistance: "near",
};

describe("a conta, com os números da CLYON", () => {
  it("segue a fórmula do simulador: combustível + pessoal + fixos, × (1 + margem)", () => {
    // 25 km só ida → 50 km ida e volta × 0,50 = 25 €; 1 h × 3 × 9 = 27 €; 17 € fixos.
    // 69 € × 1,4 = 96,60 € — o mesmo exemplo que o backoffice mostra.
    const s = sugerirParaOProfissional(recolha, 25, CLYON);
    expect(s.horas).toBe(1);
    expect(s.kmDeCarro).toBe(50);
    expect(s.custoCombustivel).toBe(25);
    expect(s.custoPessoal).toBe(27);
    expect(s.custosFixos).toBe(17);
    expect(s.custoMinimo).toBe(69);
    expect(s.precoSugerido).toBe(96.6);
    expect(s.comOsSeusCustos).toBe(false);
    expect(s.semDistancia).toBe(false);
  });

  it("o que ele recebe é o preço sugerido já sem a taxa, e o lucro é sobre isso", () => {
    const s = sugerirParaOProfissional(recolha, 25, CLYON);
    // 96,60 − 6 % = 90,80; 90,80 − 69 = 21,80.
    expect(s.recebeSePropuser).toBe(90.8);
    expect(s.lucroEstimado).toBe(21.8);
  });

  it("sem distância, o combustível fica a zero e diz-se", () => {
    const s = sugerirParaOProfissional(recolha, null, CLYON);
    expect(s.kmDeCarro).toBeNull();
    expect(s.custoCombustivel).toBe(0);
    expect(s.semDistancia).toBe(true);
    expect(s.pressupostos.join(" ")).toContain("sem distância conhecida");
  });

  it("numa mudança conta o percurso entre as moradas, não a ida e volta à base", () => {
    const s = sugerirParaOProfissional(
      { serviceType: "mudanca", percursoKm: 12, floor: "1", hasElevator: "yes" },
      40,
      CLYON,
    );
    expect(s.kmDeCarro).toBe(12);
    expect(s.custoCombustivel).toBe(6);
  });

  it("a etiqueta «por carga» acompanha o pedido", () => {
    expect(sugerirParaOProfissional({ ...recolha, baseDoPreco: "carga" }, 10, CLYON).porCarga).toBe(true);
    expect(sugerirParaOProfissional({ ...recolha, baseDoPreco: "total" }, 10, CLYON).porCarga).toBe(false);
  });
});

describe("a conta, com os números DELE", () => {
  it("o custo por km, a hora e a equipa do perfil mandam sobre a referência", () => {
    const s = sugerirParaOProfissional(recolha, 25, CLYON, {
      custoKm: 0.4,
      custoHoraPessoa: 10,
      pessoasNaEquipa: 2,
    });
    expect(s.custoCombustivel).toBe(20); // 50 × 0,40
    expect(s.custoPessoal).toBe(20); // 1 h × 2 × 10
    expect(s.pessoas).toBe(2);
    expect(s.comOsSeusCustos).toBe(true);
    expect(s.pressupostos.join(" ")).toContain("que definiu no seu perfil");
  });

  it("um campo a null no perfil cai na referência da CLYON, campo a campo", () => {
    const s = sugerirParaOProfissional(recolha, 25, CLYON, { custoKm: null, pessoasNaEquipa: 2 });
    expect(s.custoKm).toBe(0.5);
    expect(s.pessoas).toBe(2);
    expect(s.comOsSeusCustos).toBe(true);
  });

  it("os custos fixos anuais dividem-se pelos trabalhos do ano, rubrica a rubrica", () => {
    // 600 + 1 200 + 150 + 50 + 400 = 2 400 €/ano; 20 por mês × 12 = 240 → 10 € por trabalho.
    const s = sugerirParaOProfissional(recolha, 25, CLYON, {
      custosFixosAnuais: { viaVerde: 600, manutencao: 1200, iuc: 150, inspecao: 50, seguro: 400 },
      trabalhosPorMes: 20,
    });
    expect(s.custosFixos).toBe(10);
    expect(s.custoMinimo).toBe(62); // 25 + 27 + 10
    expect(s.pressupostos.join(" ")).toContain("2400,00 €/ano ÷ 240 trabalhos");
  });

  it("sem trabalhos por mês, os anuais não chegam para uma conta por trabalho — vale a referência", () => {
    const s = sugerirParaOProfissional(recolha, 25, CLYON, {
      custosFixosAnuais: { seguro: 900 },
      trabalhosPorMes: null,
    });
    expect(s.custosFixos).toBe(17);
    expect(s.comOsSeusCustos).toBe(false);
  });

  it("a margem é a que ele pôs na barra", () => {
    const s = sugerirParaOProfissional(recolha, 25, CLYON, { margemPercent: 25 });
    expect(s.margem).toBe(0.25);
    expect(s.precoSugerido).toBe(86.25); // 69 × 1,25
    expect(s.pressupostos.join(" ")).toContain("Margem: 25 %");
    expect(s.comOsSeusCustos).toBe(true);
  });

  it("o tempo por trabalho é o dele, não o estimado — deslocação e recolha incluídas", () => {
    // 2,5 h × 3 pessoas × 9 €/h = 67,50 €.
    const s = sugerirParaOProfissional(recolha, 25, CLYON, { horasPorTrabalho: 2.5 });
    expect(s.horas).toBe(2.5);
    expect(s.custoPessoal).toBe(67.5);
    expect(s.comOsSeusCustos).toBe(true);
    expect(s.pressupostos.join(" ")).toContain("2,5 h × 3 pessoas");
    expect(s.pressupostos.join(" ")).toContain("o seu tempo médio");
  });

  it("sem tempo dele (ou a zero), as horas voltam a ser as estimadas", () => {
    expect(sugerirParaOProfissional(recolha, 25, CLYON, { horasPorTrabalho: 0 }).horas).toBe(1);
    expect(sugerirParaOProfissional(recolha, 25, CLYON, { horasPorTrabalho: null }).horas).toBe(1);
    expect(sugerirParaOProfissional(recolha, 25, CLYON).pressupostos.join(" ")).toContain("estimado pela CLYON");
  });

  it("o seguro de risco é uma percentagem do combustível e do pessoal, antes da margem", () => {
    // 25 + 27 = 52 € directos; 5 % = 2,60 €; custo mínimo 69 + 2,60 = 71,60.
    const s = sugerirParaOProfissional(recolha, 25, CLYON, { riscoPercent: 5 });
    expect(s.seguroDeRisco).toBe(2.6);
    expect(s.custoMinimo).toBe(71.6);
    expect(s.precoSugerido).toBe(100.24); // 71,60 × 1,4
    expect(s.pressupostos.join(" ")).toContain("Seguro de risco: 5 % de 52,00 € = 2,60 €");
    expect(s.comOsSeusCustos).toBe(true);
  });

  it("sem seguro de risco, nada muda e a linha não aparece", () => {
    const s = sugerirParaOProfissional(recolha, 25, CLYON, { riscoPercent: null });
    expect(s.seguroDeRisco).toBe(0);
    expect(s.custoMinimo).toBe(69);
    expect(s.pressupostos.join(" ")).not.toContain("Seguro de risco");
  });

  it("aceita vírgula decimal, que é o que um teclado português escreve", () => {
    const s = sugerirParaOProfissional(recolha, 25, CLYON, { custoKm: Number("0,45".replace(",", ".")) });
    expect(s.custoKm).toBe(0.45);
  });
});

describe("a linha do pedido vira campos da conta", () => {
  it("lê as colunas e, do JSON do formulário, os campos que só alguns serviços têm", async () => {
    const { pedidoParaSugestaoDaLinha } = await import("./sugestao-para-o-profissional");
    const p = pedidoParaSugestaoDaLinha({
      serviceType: "mudanca",
      floor: "2",
      hasElevator: "no",
      parkingDistance: "near",
      description: "Casa T2",
      baseDoPreco: "total",
      rawOrderJson: JSON.stringify({
        entulhoState: "chao",
        entulhoQuantidade: "30",
        movingDistance: { distanceKm: 18.4 },
        destinationAccess: { floor: "3", hasElevator: "yes", parkingDistance: "far" },
      }),
    });
    expect(p.serviceType).toBe("mudanca");
    expect(p.entulhoEstado).toBe("chao");
    expect(p.entulhoQuantidade).toBe("30");
    expect(p.percursoKm).toBe(18.4);
    expect(p.andarDestino).toBe("3");
    expect(p.elevadorDestino).toBe("yes");
    expect(p.estacionamentoDestino).toBe("far");
    expect(p.baseDoPreco).toBe("total");
  });

  it("um JSON estragado não impede a conta — sai só com as colunas", async () => {
    const { pedidoParaSugestaoDaLinha } = await import("./sugestao-para-o-profissional");
    const p = pedidoParaSugestaoDaLinha({ serviceType: "recolha_moveis", rawOrderJson: "{nope" });
    expect(p.serviceType).toBe("recolha_moveis");
    expect(p.percursoKm).toBeNull();
    expect(p.entulhoQuantidade).toBeNull();
  });
});

describe("os parâmetros vêm do mapa do simulador", () => {
  it("lê as chaves certas e cai nos valores de referência quando faltam", () => {
    const p = parametrosDoMapa({
      custo_km: 0.55,
      custo_hora_pessoa: 10,
      num_pessoas_equipa: 2,
      overhead_por_servico: 20,
      margem_lucro: 0.5,
    });
    expect(p).toEqual({ custoKm: 0.55, custoHoraPessoa: 10, numPessoas: 2, overhead: 20, margem: 0.5 });
    expect(parametrosDoMapa({})).toEqual({ custoKm: 0.5, custoHoraPessoa: 9, numPessoas: 3, overhead: 17, margem: 0.4 });
  });
});

describe("a conta refeita com outro tempo e outra equipa", () => {
  /**
   * "O tempo estimado e a quantidade de pessoas vamos deixar editável, pois é
   * uma variável." — 12-09-2026.
   *
   * E é mesmo: o mesmo esvaziamento leva duas horas com três pessoas ou quatro
   * com uma. O que este bloco guarda é que a conta refeita NO ECRÃ dá o mesmo
   * número que a conta feita no servidor — uma segunda fórmula seria uma
   * segunda verdade.
   */
  const meusCustos = {
    custoKm: 0.5,
    custoHoraPessoa: 8,
    pessoasNaEquipa: 2,
    horasPorTrabalho: 2,
    riscoPercent: 25,
    margemPercent: 100,
  };
  const base = sugerirParaOProfissional(recolha, 20, CLYON, meusCustos);

  it("mais horas custam mais, e o preço sobe com elas", () => {
    const maisTempo = sugestaoComOutroTempo(base, { horas: 4 });
    expect(maisTempo.horas).toBe(4);
    expect(maisTempo.custoPessoal).toBeGreaterThan(base.custoPessoal);
    expect(maisTempo.custoMinimo).toBeGreaterThan(base.custoMinimo);
    expect(maisTempo.precoSugerido).toBeGreaterThan(base.precoSugerido);
  });

  it("dá o MESMO que o servidor daria com esses números", () => {
    /*
     * É a asserção que sustenta a decisão de não voltar ao servidor enquanto
     * ele escreve. Se as duas contas divergirem um cêntimo, o ecrã passa a
     * prometer um valor que a proposta não confirma.
     */
    const noEcra = sugestaoComOutroTempo(base, { horas: 3.5, pessoas: 3 });
    const noServidor = sugerirParaOProfissional(recolha, 20, CLYON, {
      ...meusCustos,
      pessoasNaEquipa: 3,
      horasPorTrabalho: 3.5,
    });
    expect(noEcra.custoPessoal).toBe(noServidor.custoPessoal);
    expect(noEcra.seguroDeRisco).toBe(noServidor.seguroDeRisco);
    expect(noEcra.custoMinimo).toBe(noServidor.custoMinimo);
    expect(noEcra.precoSugerido).toBe(noServidor.precoSugerido);
    expect(noEcra.recebeSePropuser).toBe(noServidor.recebeSePropuser);
    expect(noEcra.lucroEstimado).toBe(noServidor.lucroEstimado);
  });

  it("as parcelas por extenso reescrevem-se no sítio", () => {
    // Acrescentá-las ao fim deixava duas linhas de pessoal a contradizerem-se.
    const outra = sugestaoComOutroTempo(base, { horas: 3, pessoas: 1 });
    expect(outra.pressupostos).toHaveLength(base.pressupostos.length);
    const linha = outra.pressupostos.find((l) => l.startsWith("Pessoal:"))!;
    expect(linha).toContain("3 h");
    expect(linha).toContain("1 pessoa");
    expect(linha).not.toContain("pessoas");
  });

  it("não deixa escrever um disparate", () => {
    // Meia hora a um dia, uma a seis pessoas. Ninguém orçamenta a dez minutos,
    // e vinte pessoas numa recolha é um dedo que escorregou no teclado.
    expect(horasValidas(0.1)).toBe(HORAS_MINIMAS);
    expect(horasValidas(500)).toBe(HORAS_MAXIMAS);
    expect(horasValidas(Number.NaN)).toBe(HORAS_MINIMAS);
    expect(pessoasValidas(0)).toBe(PESSOAS_MINIMAS);
    expect(pessoasValidas(99)).toBe(PESSOAS_MAXIMAS);
    // E o passo é de meia hora: 2,3 h não é uma coisa que alguém queira dizer.
    expect(horasValidas(2.3)).toBe(2.5);
  });

  it("sem mexer em nada, devolve exactamente a mesma sugestão", () => {
    expect(sugestaoComOutroTempo(base, {})).toBe(base);
  });

  it("a conta refeita NÃO arrasta a base de dados para o browser", () => {
    /*
     * `sugestao-para-o-profissional` importa o `pricing-helper`, que importa o
     * `db`, que importa o mysql2. Enquanto o ecrã só lhe pedia o TIPO isso não
     * custava nada — um `import type` desaparece na compilação. No instante em
     * que passou a CHAMAR a função, o `next build` rebentou, e os testes não
     * apanharam nada: o vitest corre em node, onde o mysql2 existe.
     *
     * Por isso a conta refeita vive num ficheiro sem dependências de servidor,
     * e é dele que o módulo do servidor importa os formatadores — a
     * dependência aponta para o lado seguro.
     */
    const AJUSTADA = ler("src/lib/sugestao-ajustada.ts");
    expect(AJUSTADA).not.toContain("pricing-helper");
    expect(AJUSTADA).not.toContain('from "./db"');
    expect(AJUSTADA).toContain("import type { SugestaoParaOProfissional }");
    const ECRA = ler("src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx");
    expect(ECRA).toContain('} from "@/lib/sugestao-ajustada"');
    expect(ECRA).toContain(
      'import type { SugestaoParaOProfissional } from "@/lib/sugestao-para-o-profissional"',
    );
  });
});
