import { describe, it, expect } from "vitest";
import { descricaoOrganizada, itensDitos, pormenoresDoCliente, O_CLIENTE_CARREGA } from "./descricao-do-pedido";
import { descricaoParaOPedido, camposDaRecolha } from "./pedido-da-recolha";
import { DESCRICAO_DAS_FOTOS } from "./leitor-da-recolha";

/**
 * A DESCRIÇÃO QUE O PROFISSIONAL LÊ — 26-10-2026 (decisão d30).
 *
 * «A descrição não pode pegar de maneira vaga no que o cliente fala; tem de
 * analisar o que ele já disse e criar a descrição para que o profissional
 * trabalhe de forma excepcional.» — o dono. Nomes, moradas e telefones destes
 * testes são inventados; as frases são as verdadeiras.
 */

describe("o que é para levar, e quantos", () => {
  it("«Trata-se da recolha de um sofá. Deste sofá.» é UM sofá — e não a frase dela", () => {
    expect(itensDitos("Trata-se da recolha de um sofá. Deste sofá.")).toEqual(["1 sofá"]);
    expect(pormenoresDoCliente(["Trata-se da recolha de um sofá. Deste sofá."])).toEqual([]);
  });

  it("as quantidades ditas por extenso, com o que ele diz de cada coisa", () => {
    expect(
      itensDitos("Tenho um sofá de 3 lugares velho, duas cadeiras e uma mesa de cabeceira."),
    ).toEqual(["1 sofá de 3 lugares velho", "2 cadeiras", "1 mesa de cabeceira"]);
    expect(itensDitos("um frigorífico avariado e meia dúzia de cadeiras")).toEqual(["1 frigorífico avariado", "6 cadeiras"]);
    expect(itensDitos("uns 20 sacos de entulho e uma sanita partida")).toEqual([
      "cerca de 20 sacos de entulho",
      "1 sanita partida",
    ]);
  });

  it("sem número dito, não se inventa um: «armários», «lavatório»", () => {
    expect(itensDitos("seria estes armarios de madeira, a bancada, lavatorio e lavaloiça")).toEqual([
      "armários de madeira",
      "1 bancada",
      "lavatório",
      "lava-loiça",
    ]);
  });

  it("os materiais não se contam, e o serviço dito não é uma coisa", () => {
    expect(
      itensDitos(
        "Preciso de recolha de resíduos de embalagens (cartão, plástico bolha, película, esferovite e um colchão insuflável; não é entulho de obras)",
      ),
    ).toEqual(["embalagens", "cartão", "plástico bolha", "película", "esferovite", "1 colchão insuflável"]);
    expect(itensDitos("Preciso de uma recolha de móveis")).toEqual([]);
    // «à porta» não é uma porta; «roupa de cama» não é uma cama.
    expect(itensDitos("A carrinha pode parar à porta")).toEqual([]);
    expect(itensDitos("sacos com roupa de cama")).toEqual(["roupa de cama"]);
  });

  it("«o sofá é de 3 lugares» — o verbo não passa por qualificador, e a frase fica nos pormenores", () => {
    expect(itensDitos("O sofá é de 3 lugares e tem chaise longue")).toEqual(["1 sofá", "chaise longue"]);
    expect(pormenoresDoCliente(["O sofá é de 3 lugares e tem chaise longue"])).toEqual([
      "O sofá é de 3 lugares e tem chaise longue.",
    ]);
  });
});

describe("os pormenores: só o que diz alguma coisa, e sem contactos", () => {
  it("a frase que acrescenta fica, com as palavras dele", () => {
    expect(pormenoresDoCliente(["Tenho um sofá velho. O sofá está na garagem."])).toEqual(["O sofá está na garagem."]);
  });

  it("o que fala do pedido, e não do trabalho, sai", () => {
    expect(
      pormenoresDoCliente(["Consulte o pedido de orçamento. Está lá tudo. Fotos também.", "Está a falar com a pessoa que pediu o orçamento!"]),
    ).toEqual([]);
  });

  it("um telefone ou um email levam a frase inteira; o nome sai", () => {
    expect(pormenoresDoCliente(["Liguem para 912 345 678 antes de vir. O portão é verde."])).toEqual(["O portão é verde."]);
    expect(pormenoresDoCliente(["Escrevam para cliente@exemplo.pt. O portão é verde."])).toEqual(["O portão é verde."]);
    const p = pormenoresDoCliente(["A Graciete Lopes deixa a chave na vizinha."], "Graciete Lopes");
    expect(p.join(" ")).not.toContain("Graciete");
    expect(p.join(" ")).toContain("deixa a chave na vizinha");
  });
});

describe("a descrição inteira, arrumada para o profissional", () => {
  const DADOS = {
    serviceType: "recolha_monos",
    contactName: "Graciete Lopes",
    description: "Trata-se da recolha de um sofá. Deste sofá.\nO sofá está na garagem.",
    floor: "3",
    lado: "Esq",
    hasElevator: "small",
    parkingDistance: "near",
    clienteCarrega: false,
    quandoTexto: "sábado de manhã",
    dataDesejada: "2026-10-31T09:00:00.000Z",
  };

  it("cada facto numa linha curta: o que levar, o acesso, o estacionamento, quando, as fotografias", () => {
    expect(descricaoOrganizada(DADOS, { fotos: 2 })).toBe(
      [
        "Para levar: 1 sofá.",
        "Acesso: 3.º andar Esq, com elevador pequeno.",
        "Estacionamento: à porta.",
        "Quando: sábado, 31 de outubro, de manhã.",
        "Fotografias enviadas pelo cliente: 2.",
        "Pormenores (ditos pelo cliente): O sofá está na garagem.",
      ].join("\n"),
    );
  });

  it("sem invenções nem contactos: o nome e o telefone não vão para a descrição", () => {
    const d = descricaoOrganizada({ ...DADOS, description: `${DADOS.description}\nO meu número é 912 345 678.` }, { fotos: 2 })!;
    expect(d).not.toMatch(/912|Graciete|Lopes/);
    // Nada que ele não disse: sem andar dito não há linha de acesso; sem data, sem «Quando».
    const so = descricaoOrganizada({ serviceType: "recolha_monos", description: "um sofá" })!;
    expect(so).toBe("Para levar: 1 sofá.");
  });

  it("quem carrega, o volume, e o que se viu nas imagens", () => {
    const d = descricaoOrganizada({
      serviceType: "recolha_monos",
      description: `Nas imagens: um sofá cinzento de três lugares.`,
      volumeDito: "0,5 a 0,7 m³",
      clienteCarrega: true,
      fotosDitas: true,
    })!;
    expect(d).toContain("Volume (dito pelo cliente): 0,5 a 0,7 m³.");
    expect(d).toContain(O_CLIENTE_CARREGA);
    expect(d).toContain("Nas imagens: um sofá cinzento de três lugares.");
    expect(d).toContain("Fotografias: o cliente diz que as enviou.");
  });

  it("numa mudança, as duas pontas", () => {
    const d = descricaoOrganizada({
      serviceType: "mudanca",
      description: "2 cadeiras e duas televisões",
      floor: "-1",
      hasElevator: "yes",
      parkingDistance: "near",
      andarDestino: "2",
      elevadorDestino: "yes",
      estacionamentoDestino: null,
    })!;
    expect(d).toContain("Para transportar: 2 cadeiras, 2 televisões.");
    expect(d).toContain("Origem: cave, com elevador; estacionamento à porta.");
    expect(d).toContain("Destino: 2.º andar, com elevador; estacionamento a confirmar.");
  });

  it("a marca das fotografias não é descrição", () => {
    expect(descricaoOrganizada({ description: DESCRICAO_DAS_FOTOS })).toBe("Fotografias: o cliente diz que as enviou.");
  });
});

describe("o formulário «Criar pedido desta conversa» usa a mesma descrição", () => {
  it("o registo automático e o formulário dizem o mesmo", () => {
    const d = {
      serviceType: "recolha_monos",
      description: "Trata-se da recolha de um sofá. Deste sofá.",
      floor: "0",
      parkingDistance: "far",
    };
    expect(descricaoParaOPedido(d)).toBe("Para levar: 1 sofá.\nAcesso: rés-do-chão.\nEstacionamento: longe da porta.");
    expect(camposDaRecolha("912345678", d).description).toBe(descricaoParaOPedido(d));
  });
});
