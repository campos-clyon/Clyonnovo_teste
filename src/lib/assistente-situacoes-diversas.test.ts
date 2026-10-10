import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COMO_CHEGA_O_PRECO,
  fundirCampos,
  lerMensagemLivre,
  recolhaNova,
  responderComCompreensao,
  responderNaRecolha,
  resumo,
  type EstadoDaRecolha,
} from "./whatsapp-recolha";
import { DESCRICAO_DAS_FOTOS } from "./leitor-da-recolha";
import { paraTeclado } from "./whatsapp-cloud";

/**
 * SITUAÇÕES DIVERSAS — o treino para lá das três conversas de outubro.
 *
 * *«Treine-o para situações diversas.»* — 10-10-2026. As três conversas
 * (`as-conversas-de-outubro.test.ts`) são os erros que aconteceram; estas são
 * as variações deles que ainda não aconteceram, e os dois caminhos — com o
 * Gemini e sem ele — têm de dar a mesma resposta certa.
 */

const AGORA = new Date("2026-10-12T10:00:00+01:00"); // segunda-feira de manhã
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const meio = (dados: EstadoDaRecolha["dados"], passo: EstadoDaRecolha["passo"]): EstadoDaRecolha => ({
  passo,
  dados: { serviceType: "recolha_moveis", contactName: "Rita", ...dados },
});

describe("sem o Gemini — mensagens que dizem muito de uma vez", () => {
  it("tudo numa mensagem: serviço, nome, morada com código, andar, elevador e data", () => {
    const r = responderNaRecolha(
      recolhaNova(),
      "Bom dia, tenho uma cama de casal e um roupeiro para levar.\nRua das Flores 12, 3º Dto\n2845-513 Amora\nNão tem elevador. Pode ser na sexta de manhã?\nObrigada, Rita Gomes",
      AGORA,
    );
    const d = r.estado.dados;
    expect(d.serviceType).toBe("recolha_moveis");
    expect(d.contactName).toBe("Rita Gomes");
    expect(d.address).toBe("Rua das Flores 12, 3º Dto");
    expect(d.postalCode).toBe("2845-513");
    expect(d.city).toBe("Amora");
    expect(d.floor).toBe("3");
    expect(d.hasElevator).toBe("no");
    expect(d.quandoTexto).toContain("sexta de manhã");
    expect(d.description).toContain("roupeiro");
    // Só falta o estacionamento — e é isso que se pergunta.
    expect(r.estado.passo).toBe("estacionamento");
    expect(r.resposta).toContain("Bom dia, Rita.");
  });

  it("uma mudança: a primeira mensagem não confunde a origem com o destino", () => {
    const r = responderNaRecolha(recolhaNova(), "Preciso de uma mudança de um T1 em Almada para Lisboa", AGORA);
    expect(r.estado.dados.serviceType).toBe("mudanca");
    expect(r.estado.passo).toBe("nome");
    expect(r.estado.dados.moradaDestino).toBeUndefined();
  });

  it("a morada em duas linhas, com o código postal em baixo", () => {
    const r = responderNaRecolha(meio({}, "morada"), "Av. da República 45, 2.º esq\n1050-187 Lisboa", AGORA, true);
    expect(r.estado.dados).toMatchObject({
      address: "Av. da República 45, 2.º esq",
      postalCode: "1050-187",
      city: "Lisboa",
      floor: "2",
    });
    expect(r.estado.passo).toBe("elevador");
  });

  it("o código postal escrito com espaço também é código postal", () => {
    const r = responderNaRecolha(meio({}, "morada"), "Rua do Sol 3, 1300 316 Lisboa", AGORA, true);
    expect(r.estado.dados.postalCode).toBe("1300-316");
    expect(r.estado.dados.city).toBe("Lisboa");
  });
});

describe("sem o Gemini — respostas fora de ordem", () => {
  it("o preço perguntado a meio tem resposta, e a pergunta repete-se sem «não percebi»", () => {
    const r = responderNaRecolha(meio({ address: "Rua X 1", postalCode: "1000-001", city: "Lisboa", floor: "2" }, "elevador"), "Quanto custa mais ou menos?", AGORA, true);
    expect(r.resposta.startsWith(COMO_CHEGA_O_PRECO)).toBe(true);
    expect(r.resposta).toContain("elevador");
    expect(r.resposta).not.toContain("não percebi");
    expect(r.estado.passo).toBe("elevador");
  });

  it("«não sei» ao estacionamento segue em frente, a confirmar", () => {
    const r = responderNaRecolha(meio({ floor: "1", hasElevator: "no" }, "estacionamento"), "Não sei bem, às vezes há lugar", AGORA, true);
    expect(r.estado.dados.parkingDistance).toBeNull();
    expect(r.estado.passo).toBe("quando");
  });

  it("um «Não» à pergunta da data quer dizer sem pressa", () => {
    const r = responderNaRecolha(meio({ floor: "1", hasElevator: "no", parkingDistance: "near" }, "quando"), "Não", AGORA, true);
    expect(r.estado.dados.urgency).toBe("flexible");
    expect(r.estado.passo).toBe("descricao");
  });

  it("a mesma pergunta não se repete uma terceira vez — à segunda segue-se", () => {
    let e = meio({ address: "Rua X 1", postalCode: "1000-001", city: "Lisboa" }, "andar");
    const um = responderNaRecolha(e, "humm", AGORA, true);
    expect(um.estado.passo).toBe("andar");
    e = um.estado;
    const dois = responderNaRecolha(e, "o último", AGORA, true);
    expect(dois.estado.passo).not.toBe("andar");
    expect(dois.estado.dados.floor).toBe("o último");
  });

  it("o NIF escrito logo na resposta da factura poupa a pergunta", () => {
    const r = responderNaRecolha(
      meio({ floor: "1", hasElevator: "no", parkingDistance: "near", quandoTexto: "amanhã", description: "Sofá" }, "fatura"),
      "Sim, o NIF é 123 456 789",
      AGORA,
      true,
    );
    expect(r.estado.dados.nifFactura).toBe("123456789");
    expect(r.estado.passo).toBe("confirmar");
    expect(resumo(r.estado.dados)).toContain("NIF na factura: 123456789");
  });

  it("no resumo, «sim, mas o andar é o 2º» corrige antes de registar", () => {
    const e = meio(
      { address: "Rua X 1", postalCode: "1000-001", city: "Lisboa", floor: "1", hasElevator: "no", parkingDistance: "near", quandoTexto: "amanhã", description: "Sofá", precisaFatura: false },
      "confirmar",
    );
    const r = responderNaRecolha(e, "Sim, mas o andar é o 2º", AGORA, true);
    expect(r.registar).toBeFalsy();
    expect(r.estado.dados.floor).toBe("2");
    expect(r.resposta).toContain("Confirme, por favor");
  });
});

describe("com o Gemini — as mesmas guardas", () => {
  it("«Obrigado Marco» que o modelo devolva como nome fica «Marco»", () => {
    const d = fundirCampos({}, { nome: "Obrigado Marco" }, AGORA);
    expect(d.contactName).toBe("Marco");
    expect(fundirCampos({}, { nome: "Já mandei as fotos" }, AGORA).contactName).toBeUndefined();
  });

  it("a morada do modelo sai partida, com o andar lá de dentro", () => {
    const d = fundirCampos({}, { morada: "Travessa João Alves, 7, R/C Esq. 1300-316 Lisboa" }, AGORA);
    expect(d).toMatchObject({ address: "Travessa João Alves, 7, R/C Esq", postalCode: "1300-316", city: "Lisboa", floor: "0" });
  });

  it("«Sou o Marco» devolvido como andar não é um andar", () => {
    expect(fundirCampos({}, { andar: "Sou o Marco" }, AGORA).floor).toBeUndefined();
  });

  it("quem desiste a meio passa a uma pessoa, em vez de «Responda SIM para deitar fora»", () => {
    const r = responderComCompreensao(
      meio({ address: "Rua X 1" }, "confirmar"),
      { intencao: "cancelar", campos: {} },
      AGORA,
      { texto: "Obrigado, está muito complicado. Prefiro desistir." },
    );
    expect(r.pedirPessoa).toBe(true);
    expect(r.desistir).toBeFalsy();
    expect(r.resposta).not.toContain("deitar fora");
  });

  it("a pergunta pelo preço tem resposta, e não um «não apanhei»", () => {
    const e = meio({ address: "Rua X 1", postalCode: "1000-001", city: "Lisboa", floor: "2" }, "elevador");
    const r = responderComCompreensao(e, { intencao: "informar", campos: {} }, AGORA, {
      texto: "Primeiro quero saber o valor",
    });
    expect(r.resposta).toContain(COMO_CHEGA_O_PRECO);
    expect(r.resposta).not.toContain("não apanhei");
  });

  it("com fotografias e sem descrição, não se pergunta o que é para levar", () => {
    const e = meio({ address: "Rua X 1", postalCode: "1000-001", city: "Lisboa", floor: "0", parkingDistance: "near" }, "quando");
    const r = responderComCompreensao(e, { intencao: "informar", campos: { quando: "amanhã" } }, AGORA, {
      texto: "amanhã",
      fotos: 5,
    });
    expect(r.estado.dados.description).toBe(DESCRICAO_DAS_FOTOS);
    expect(r.estado.passo).toBe("fatura");
  });
});

describe("o modelo aprende com as conversas, e a falha dele vê-se", () => {
  const COMPREENSAO = ler("src/lib/whatsapp-compreensao.ts");

  it("as lições e os exemplos verdadeiros vão no aviso ao modelo — nos dois", () => {
    expect(COMPREENSAO.split("${LICOES_DAS_CONVERSAS}").length - 1).toBe(2);
    expect(COMPREENSAO).toContain("${EXEMPLOS_DAS_CONVERSAS}");
    expect(COMPREENSAO).toContain("«Obrigado Marco» → \"Marco\"");
    expect(COMPREENSAO).toContain("«Sim» NUNCA é \"quando\"");
  });

  it("a leitura dos clientes novos usa a escada, e escreve a falha no painel", () => {
    const i = COMPREENSAO.indexOf("export async function compreender(");
    const corpo = COMPREENSAO.slice(i, COMPREENSAO.indexOf("function instrucoesDoFio", i));
    expect(corpo).toContain("await escadaDeModelos(modelName)");
    expect(corpo).toContain("await anotar(null);");
    expect(corpo).toContain("await porDeCastigo(modelo, r.motivo);");
    expect(corpo).toContain("Recolha de pedidos (clientes novos)");
  });

  it("o envio não cola linhas do resumo", () => {
    expect(paraTeclado("estacionar à porta: —\nQuando: amanhã")).toBe("estacionar à porta: -\nQuando: amanhã");
  });

  it("a leitura livre é a mesma para qualquer frase", () => {
    expect(lerMensagemLivre("Sou a Ana, moro na Rua do Sol 3, 1º esq")).toMatchObject({
      nome: "Ana",
      morada: "Rua do Sol 3, 1º esq",
      andar: "1º",
    });
  });
});
