import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  juntarLeituras,
  passoDaPergunta,
  recolhaPeloFio,
  type MensagemDoFio,
} from "./reler-a-conversa";
import { camposDaRecolha } from "./pedido-da-recolha";
import type { DadosDaRecolha } from "./whatsapp-recolha";

/**
 * RELER COM AS REGRAS DE HOJE — 11-10-2026.
 *
 * *«Eu reli e pedi para ele criar, e ele criou assim.»* — o formulário do
 * Gaspar abriu com o que o assistente da véspera tinha gravado. Aqui está a
 * conversa dele como ficou no fio — com as perguntas ANTIGAS, já passadas pelo
 * teclado (hífens em vez de travessões) — e o que a releitura tira dela.
 */

const PRIMEIRA = `Olá,tudo bem?

Gostaria de pedir um orçamento para uma pequena mudança dentro dos Olivais, em Lisboa, preferencialmente num sábado 31/10 ou domingo 01/11

Morada de origem: Rua das Romãzeiras, 23, cave saída para rua a porta ja e na calcada Olivais.
Morada de destino: Rua dos Jacarandás, 218, Olivais.

As duas moradas ficam a poucas ruas de distância e ambos os prédios têm elevador.

Preciso de um serviço que inclua embalagem dos meus pertences e transporte, pois não pretendo encaixotar tudo antecipadamente.

Os artigos a transportar incluem:

* 2 cadeiras;
* Duas televisões, uma de 65 polegadas e outra de 32 polegadas, que precisam de proteção adequada;

Procuro um serviço com carrinha e profissionais responsáveis pela embalagem, carga, transporte e descarga. Nao é necessário desembalar e arrumar
Obrigado`;

let minuto = 0;
const em = (direccao: "in" | "out", texto: string): MensagemDoFio => {
  minuto += 1;
  return { direccao, texto, criadoEm: new Date(Date.UTC(2026, 9, 10, 20, 59 + minuto)).toISOString() };
};

const FIO: MensagemDoFio[] = [
  em("in", PRIMEIRA),
  em("out", "Boa noite. Aqui é a CLYON.\n\nMudança - certo.\n\nCom quem estou a falar?"),
  em("in", "Gaspar teles"),
  em("out", "E o código postal, com a localidade?"),
  em("in", "1800-907 Lisboa olivais"),
  em("out", "Para onde é a mudança? Rua e número do destino."),
  em("in", "Rua dos jacarandás 218 olivais lisboa"),
  em("out", "E o código postal do destino, com a localidade?"),
  em("in", "1800-904 olivais lisboa"),
  em("out", "Dá para encostar a carrinha à porta, ou fica longe?"),
  em("in", "A porta de ambos"),
  em("out", "Desculpe, não percebi: a carrinha consegue parar perto da porta?"),
  em("in", "Sim"),
  em("out", "Quer a factura com o seu NIF? Há factura em todas as vendas, emitida pela Miragem Dourada, nossa parceira, e os preços já vêm com IVA incluído (23 %)."),
  em("in", "Sim"),
  em("out", "Qual é o NIF para a factura? Se não o tiver à mão, diga-me e pedimo-lo depois."),
  em("in", "Gostaria de saber o valor primeiro"),
  em("out", "Não consegui ler o NIF. São 9 algarismos - ou diga-me que o dá depois."),
  em("in", "Depois"),
  em("out", "Confirme, por favor:\n\nServiço: Mudança\nNome: Gaspar Teles\n\nEstá tudo certo? Responda SIM para registar, ou diga-me o que está errado."),
  em("in", "Data e para 31/10/2026"),
  em("out", "Confirme, por favor:\n\nServiço: Mudança\n\nEstá tudo certo? Responda SIM para registar, ou diga-me o que está errado."),
  em("in", "E quero que embale as roupas e a mudança"),
  em("out", 'Para registar responda SIM. Se houver algo errado, diga-me o quê. Ou escreva "recomeçar".'),
];

/** O que o assistente da véspera tinha gravado — e o formulário mostrou. */
const GRAVADO: DadosDaRecolha = {
  serviceType: "mudanca",
  contactName: "Gaspar Teles",
  address: "Rua das Romãzeiras, 23, cave saída para rua a porta ja e na calcada Olivais.",
  postalCode: "1800-907",
  city: "Lisboa olivais",
  moradaDestino: "Rua dos jacarandás 218 olivais lisboa",
  codigoPostalDestino: "1800-904",
  localidadeDestino: "olivais lisboa",
  floor: "-1",
  hasElevator: "yes",
  parkingDistance: "near",
  quandoTexto: "Data e para 31/10/2026",
  description: "* 2 cadeiras; * Duas televisões, uma de 65 polegadas e outra de 32 polegadas",
  precisaFatura: true,
  nifFactura: null,
};

const AGORA = new Date("2026-10-11T10:00:00+01:00");

describe("a releitura passa a conversa pelas regras de hoje", () => {
  it("cada mensagem da CLYON diz a pergunta a que o cliente respondeu", () => {
    expect(passoDaPergunta("Boa noite. Aqui é a CLYON.\n\nMudança - certo.\n\nCom quem estou a falar?")).toBe("nome");
    expect(passoDaPergunta("E o código postal do destino, com a localidade?")).toBe("codigoPostalDestino");
    expect(passoDaPergunta("E o código postal, com a localidade?")).toBe("codigoPostal");
    expect(passoDaPergunta("Desculpe, não percebi: a carrinha consegue parar perto da porta?")).toBe("estacionamento");
    expect(passoDaPergunta("Não consegui ler o NIF. São 9 algarismos - ou diga-me que o dá depois.")).toBe("nif");
    expect(passoDaPergunta("Quer a factura com o seu NIF? Há factura em todas as vendas")).toBe("fatura");
    expect(passoDaPergunta("Confirme, por favor:\n\nServiço: Mudança")).toBe("confirmar");
    expect(passoDaPergunta("E no destino, em que andar fica? Se houver elevador, diga-me também.")).toBe("andarDestino");
    expect(passoDaPergunta("Recebi a fotografia - ficou anexada ao pedido #12.")).toBeNull();
  });

  it("o Gaspar, relido: a morada sem o acesso, o destino com elevador e porta, e a embalagem", () => {
    const { dados, passo } = recolhaPeloFio(FIO, AGORA);
    expect(dados.address).toBe("Rua das Romãzeiras, 23, cave");
    expect(dados.acessoDito).toBe("saída para rua a porta ja e na calcada Olivais");
    expect(dados.elevadorDestino).toBe("yes");
    expect(dados.estacionamentoDestino).toBe("near");
    expect(dados.description).toContain("embalagem dos meus pertences");
    expect(dados.description).toContain("E quero que embale as roupas e a mudança");
    expect(dados.nifFactura).toBeNull();
    expect(new Date(dados.dataDesejada!).toISOString().slice(0, 10)).toBe("2026-10-31");
    // O que ninguém lhe perguntou é o que vem a seguir: o andar no destino.
    expect(passo).toBe("andarDestino");
  });

  it("o formulário abre com o que se releu por cima do que estava gravado", () => {
    const juntos = juntarLeituras(GRAVADO, recolhaPeloFio(FIO, AGORA).dados);
    const c = camposDaRecolha("351930000102", juntos);
    expect(c.address).toBe("Rua das Romãzeiras, 23, cave");
    expect(c.elevadorDestino).toBe("yes");
    expect(c.estacionamentoDestino).toBe("easy");
    expect(c.description).toContain("embalagem");
    expect(c.description).toContain("Acesso (dito pelo cliente): saída para rua a porta");
    // E o que a releitura não leu fica como estava.
    expect(c.contactName).toBe("Gaspar Teles");
    expect(c.postalCode).toBe("1800-907");
  });

  it("nunca mais pobre: um campo que a releitura não traz não se apaga", () => {
    expect(juntarLeituras({ contactName: "Ana", floor: "2" }, { floor: "3" })).toEqual({ contactName: "Ana", floor: "3" });
  });
});

describe("a rota usa a releitura — no «Reler» e no «Criar pedido»", () => {
  const ROTA = readFileSync(join(process.cwd(), "src/app/api/admin/whatsapp/route.ts"), "utf8");
  it("o «Criar pedido» abre relido, sem gravar nada", () => {
    expect(ROTA).toContain("recolha = { ...gravada, dados: juntarLeituras(gravada.dados as never, relida.dados) };");
  });
  it("o «Reler» parte da releitura e conta o que mudou contra o gravado", () => {
    expect(ROTA).toContain("const relida = juntarLeituras(gravado as never, recolhaPeloFio(fio).dados);");
    expect(ROTA).toContain("releituraDoFio({ gravado: relida, campos, fio })");
  });
});
