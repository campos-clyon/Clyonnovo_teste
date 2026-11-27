import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { descricaoPelasRegras, fontesDeUmaDescricao, juntarAConversa, type FontesDaDescricao } from "./fontes-da-descricao";
import {
  camposQueOProfissionalVe,
  comporADescricao,
  sugestoesDaDescricao,
  validarAResposta,
  type PedidoParaADescricao,
  type RespostaDoModelo,
} from "./descricao-pelo-modelo";
import { descricaoOrganizada } from "./descricao-do-pedido";
import {
  diasDitos,
  estacionamentoDaConversa,
  ESTACIONAMENTO_NO_FORMULARIO,
  oQueOQuandoAcrescenta,
  soRepeteOsCampos,
  sugestoesDosCampos,
} from "./campos-na-descricao";
import { instanteEmLisboa } from "./hora-de-lisboa";
import { camposDaRecolha } from "./pedido-da-recolha";

/**
 * A DESCRIÇÃO JÁ NÃO REPETE O QUE OS CAMPOS DIZEM — decisão d84, 22-11-2026
 * (aprovada pelo CEO e pelo dono).
 *
 * O caso (com os dados INVENTADOS — o repositório é público): uma recolha de
 * monos numa cave sem elevador. O «Arrumar a descrição» escreveu «Serviço»,
 * «Morada», «Quando», «Estacionamento: à porta» e «Fotografias: 4» — tudo o
 * que a app Pro e o painel já mostram à parte —, com o campo «Dá para
 * estacionar à porta?» em «não perguntei», e uma nota a repetir a morada.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/** Domingo, 22 de novembro de 2026, ao meio-dia em Lisboa. */
const AGORA = new Date("2026-11-22T12:00:00Z");

const PEDIDO: PedidoParaADescricao = {
  serviceType: "recolha_monos",
  city: "Lisboa",
  postalCode: "1900-000",
  floor: "-1",
  hasElevator: "no",
  // «não perguntei»
  parkingDistance: "",
  dataAgendada: instanteEmLisboa("2026-11-23T00:00"),
  fotos: 4,
  contactName: "Cliente Exemplo",
  address: "Rua Inventada 1",
};

function fontesDoCaso(): FontesDaDescricao {
  return juntarAConversa(
    fontesDeUmaDescricao(""),
    {
      description:
        "Tenho um colchão de 140x200, dois caixões de 110x40, caixas pequenas e uma cesta de roupa.\n" +
        "Nas imagens: uma ventoinha, um cesto alto, uma caixa grande de colchão e peças de móveis",
      quandoTexto: "segunda-feira, 23 de novembro, ou ao fim de semana",
    },
    AGORA,
  );
}

const RESPOSTA: RespostaDoModelo = {
  paraLevar: ["1 colchão (140×200 cm)", "2 caixões (110×40 cm)", "caixas pequenas", "1 cesta de roupa"],
  confirmarSeTambemVai: ["1 ventoinha", "1 cesto alto", "1 caixa grande de colchão", "peças de móveis"],
  quando: "segunda-feira, 23 de novembro, ou ao fim de semana",
  estacionamento: "à porta",
  notas: ["Serviço localizado numa cave sem elevador."],
  porConfirmar: [],
};

describe("1. o exemplo do pedido da cave: sem as linhas que os campos já dizem", () => {
  it("a resposta passa nas regras, e sai só o que os campos não dizem — a alternativa do dia nas notas", () => {
    const f = fontesDoCaso();
    expect(validarAResposta(RESPOSTA, f, PEDIDO)).toEqual({ ok: true });
    const texto = comporADescricao(RESPOSTA, f, PEDIDO, { modo: "sugestao", agora: AGORA });
    expect(texto.split("\n")).toEqual([
      "Para levar: 1 colchão (140×200 cm), 2 caixões (110×40 cm), caixas pequenas, 1 cesta de roupa.",
      "Confirmar se também vai: 1 ventoinha, 1 cesto alto, 1 caixa grande de colchão, peças de móveis.",
      "Notas: Também pode ao fim de semana.",
    ]);
    expect(texto).not.toMatch(/^(Serviço|Morada|Quando|Estacionamento|Fotografias|Origem|Destino):/m);
    expect(texto).not.toMatch(/cave|elevador|à porta|1900/);
  });

  it("o estacionamento dito, com o campo em «não perguntei», vira uma sugestão para preencher — e não vai para o texto", () => {
    expect(sugestoesDaDescricao(RESPOSTA, fontesDoCaso(), PEDIDO, AGORA)).toEqual([
      { campo: "parkingDistance", tipo: "preencher", texto: "Estacionamento: à porta (dito pelo cliente)", valor: "door" },
    ]);
    // O valor é uma das opções do formulário.
    expect(ESTACIONAMENTO_NO_FORMULARIO.map((o) => o.valor)).toContain("door");
  });

  it("quando ninguém está a ver o formulário (a Vitória reescreve sozinha), o que o campo não tem fica dito pelo cliente", () => {
    const texto = comporADescricao(RESPOSTA, fontesDoCaso(), PEDIDO, { agora: AGORA });
    expect(texto).toContain("Estacionamento (dito pelo cliente): à porta.");
    // Com o campo preenchido, manda o campo: não se repete.
    const comCampo = comporADescricao(RESPOSTA, fontesDoCaso(), { ...PEDIDO, parkingDistance: "door" }, { agora: AGORA });
    expect(comCampo).not.toMatch(/Estacionamento/);
  });

  it("um «por confirmar» sobre um campo que já tem valor sai; sobre um vazio, fica", () => {
    const r = { ...RESPOSTA, estacionamento: "", porConfirmar: ["se dá para estacionar à porta", "o andar", "o peso do colchão"] };
    const texto = comporADescricao(r, fontesDoCaso(), { ...PEDIDO, parkingDistance: "difficult" }, { modo: "sugestao", agora: AGORA });
    expect(texto).toContain("Por confirmar: o peso do colchão.");
    const semCampo = comporADescricao(r, fontesDoCaso(), PEDIDO, { modo: "sugestao", agora: AGORA });
    // d141: o mesmo assunto uma vez só — «o estacionamento» e «se dá para estacionar à porta» são um.
    expect(semCampo).toMatch(/Por confirmar: o estacionamento; o peso do colchão\./);
  });
});

describe("2. as notas nunca repetem os campos", () => {
  it("«Serviço localizado numa cave sem elevador.» só diz o que os campos dizem — sai", () => {
    for (const so of [
      "Serviço localizado numa cave sem elevador.",
      "Fica no rés-do-chão, em Lisboa.",
      "Recolha na segunda-feira, 23 de novembro.",
      "Estaciona-se à porta.",
      "3.º andar, com elevador.",
    ]) {
      expect(soRepeteOsCampos(so, "Lisboa"), so).toBe(true);
    }
    for (const diz of [
      "As escadas da cave são estreitas.",
      "O frigorífico fica — não é para levar.",
      "Também pode ao fim de semana.",
      "O cliente carrega para a viatura.",
      "O sofá tem de ser desmontado.",
    ]) {
      expect(soRepeteOsCampos(diz, "Lisboa"), diz).toBe(false);
    }
  });

  it("na composição do modelo e nas regras: a nota repetida sai, a que diz alguma coisa fica", () => {
    const r = { ...RESPOSTA, notas: ["Serviço localizado numa cave sem elevador.", "As escadas da cave são estreitas."] };
    const texto = comporADescricao(r, fontesDoCaso(), PEDIDO, { modo: "sugestao", agora: AGORA });
    expect(texto).toContain("Notas: As escadas da cave são estreitas. Também pode ao fim de semana.");
    expect(texto).not.toContain("localizado");
    const regras = descricaoOrganizada(
      { serviceType: "recolha_monos", city: "Lisboa", description: "Um sofá velho.", notas: ["Fica na cave, sem elevador", "O sofá não passa na porta"] },
      { agora: AGORA },
    );
    expect(regras).toContain("Notas (ditas pelo cliente): O sofá não passa na porta.");
    expect(regras).not.toContain("Fica na cave");
  });
});

describe("3. o dia: o campo manda, e o que o dia dito acrescenta vai para as notas", () => {
  const SEGUNDA = instanteEmLisboa("2026-11-23T00:00");
  const SABADO_9H = instanteEmLisboa("2026-11-28T09:00");

  it("os dias ditos lêem-se em Lisboa: por extenso, com barras, o dia da semana, amanhã", () => {
    expect(diasDitos("segunda-feira, 23 de novembro, ou ao fim de semana", AGORA).map((d) => d.dia)).toEqual(["2026-11-23"]);
    expect(diasDitos("sábado ou domingo", AGORA).map((d) => d.dia)).toEqual(["2026-11-28", "2026-11-29"]);
    expect(diasDitos("sexta 4/12 ou sábado 5/12", AGORA).map((d) => d.dia)).toEqual(["2026-12-04", "2026-12-05"]);
    expect(diasDitos("amanhã de manhã", AGORA).map((d) => d.dia)).toEqual(["2026-11-23"]);
    // Um dia que já passou é o do ano seguinte.
    expect(diasDitos("3 de janeiro", AGORA).map((d) => d.dia)).toEqual(["2027-01-03"]);
  });

  it("só o que acrescenta: a alternativa, a parte do dia que a hora do campo não diz", () => {
    expect(oQueOQuandoAcrescenta("segunda-feira, 23 de novembro, ou ao fim de semana", SEGUNDA)).toBe("Também pode ao fim de semana.");
    expect(oQueOQuandoAcrescenta("segunda-feira, 23 de novembro", SEGUNDA)).toBeNull();
    expect(oQueOQuandoAcrescenta("sábado de manhã", SABADO_9H)).toBeNull();
    expect(oQueOQuandoAcrescenta("sábado de manhã", instanteEmLisboa("2026-11-28T00:00"))).toBe("De manhã.");
    expect(oQueOQuandoAcrescenta("sexta 4/12 ou sábado 5/12", instanteEmLisboa("2026-12-04T00:00"))).toBe("Também pode sábado 5/12.");
    // Outro dia que não o do campo: manda o campo, e o «Arrumar» avisa.
    expect(oQueOQuandoAcrescenta("sábado", SEGUNDA)).toBeNull();
  });

  it("o campo vazio e um dia dito: sugestão para preencher; o campo com outro dia: só o aviso", () => {
    const semDia = sugestoesDosCampos({ quando: "sábado de manhã" }, { parkingDistance: "door", dataAgendada: null }, AGORA);
    expect(semDia).toEqual([
      { campo: "dataDesejada", tipo: "preencher", texto: "Dia: sábado, 28 de novembro (dito pelo cliente)", valor: "2026-11-28T09:00" },
    ]);
    const outro = sugestoesDosCampos({ quando: "sábado" }, { dataAgendada: SEGUNDA }, AGORA);
    expect(outro).toEqual([
      { campo: "dataDesejada", tipo: "contradiz", texto: "A conversa diz «sábado», o campo diz «segunda-feira, 23 de novembro».", valor: null },
    ]);
    expect(sugestoesDosCampos({ quando: "segunda ou ao fim de semana" }, { dataAgendada: SEGUNDA }, AGORA)).toEqual([]);
  });
});

describe("4. o estacionamento: preencher quando o campo está vazio, avisar quando diz outra coisa", () => {
  it("o que se lê do que foi dito, dos metros e do que a Vitória apurou", () => {
    expect(estacionamentoDaConversa("à porta")).toEqual({ valor: "door", texto: "à porta" });
    expect(estacionamentoDaConversa("não há lugar na rua")).toEqual({ valor: "difficult", texto: "não há lugar na rua" });
    expect(estacionamentoDaConversa(null, 15)).toEqual({ valor: "under_20m", texto: "a carrinha fica a cerca de 15 m da porta" });
    expect(estacionamentoDaConversa(null, null, "far")).toEqual({ valor: "difficult", texto: "longe da porta" });
    expect(estacionamentoDaConversa("por confirmar")).toBeNull();
  });

  it("«não sabe» conta como vazio; o mesmo lado da porta não é contradição; o outro é", () => {
    expect(sugestoesDosCampos({ estacionamento: "à porta" }, { parkingDistance: "unknown" }, AGORA)[0]?.tipo).toBe("preencher");
    expect(sugestoesDosCampos({ estacionamento: "à porta" }, { parkingDistance: "under_20m" }, AGORA)).toEqual([]);
    expect(sugestoesDosCampos({ estacionamento: "à porta" }, { parkingDistance: "difficult" }, AGORA)).toEqual([
      { campo: "parkingDistance", tipo: "contradiz", texto: "A conversa diz «à porta», o campo diz «Longe ou complicado».", valor: null },
    ]);
  });
});

describe("5. a mudança: o destino com campo sai do texto; a 2.ª paragem, sem campo, fica", () => {
  const MUDANCA: PedidoParaADescricao = {
    ...PEDIDO,
    serviceType: "mudanca",
    floor: "2",
    hasElevator: "yes",
    parkingDistance: "door",
    destino: { localidade: "Almada", codigoPostal: "2800-000", andar: "3", elevador: "no", estacionamento: "easy" },
  };
  const R: RespostaDoModelo = { ...RESPOSTA, paraLevar: ["1 colchão (140×200 cm)"], confirmarSeTambemVai: [], estacionamento: "", notas: [], quando: "" };

  it("sem «Origem:» nem «Destino:» — o profissional vê o destino, o andar e o elevador de lá à parte", () => {
    const texto = comporADescricao(R, fontesDoCaso(), MUDANCA, { modo: "sugestao", agora: AGORA });
    expect(texto).not.toMatch(/Origem|Destino|Almada|2800/);
    expect(texto.split("\n")[0]).toBe("Para transportar: 1 colchão (140×200 cm)");
  });

  it("sem destino, fica no «por confirmar»; e a 2.ª paragem continua no texto", () => {
    const f = juntarAConversa(fontesDoCaso(), {
      segundaMorada: { rua: null, codigoPostal: "1400-000", localidade: "Lisboa", andar: "1", lado: null, elevador: "yes", dita: "Há outra recolha em Lisboa, 1.º andar com elevador." },
    }, AGORA);
    const texto = comporADescricao(R, f, { ...MUDANCA, destino: null }, { modo: "sugestao", agora: AGORA });
    expect(texto).toContain("2.ª paragem: Lisboa (1400), 1.º andar, com elevador.");
    expect(texto).toContain("Por confirmar: o destino.");
  });

  it("as regras: o destino e o acesso que os campos têm não se repetem; o que não têm, fica dito pelo cliente", () => {
    const d = { serviceType: "mudanca", description: "Um sofá e duas camas.", floor: "2", hasElevator: "yes", andarDestino: "3", elevadorDestino: "no" };
    const comCampos = descricaoOrganizada(d, { campos: camposQueOProfissionalVe(MUDANCA), agora: AGORA })!;
    expect(comCampos).not.toMatch(/Origem|Destino|andar|elevador/);
    const semCampos = descricaoOrganizada(d, { campos: {}, agora: AGORA })!;
    expect(semCampos).toContain("Origem (dito pelo cliente): 2.º andar, com elevador.");
    expect(semCampos).toContain("Destino (dito pelo cliente): 3.º andar, sem elevador.");
  });
});

describe("6. a mesma regra em todo o lado", () => {
  it("o pedido do WhatsApp no formulário: os campos preenchidos, a descrição sem os repetir", () => {
    const c = camposDaRecolha("351910000000", {
      serviceType: "recolha_monos",
      description: "Um colchão e uma cesta de roupa.",
      floor: "-1",
      hasElevator: "no",
      metrosAtePorta: 10,
      dataDesejada: "2026-11-23T09:00:00Z",
      quandoTexto: "segunda de manhã ou ao fim de semana",
    });
    expect(c.parkingDistance).toBe("under_20m");
    expect(c.description).toBeDefined();
    expect(c.description).not.toMatch(/^(Acesso|Estacionamento|Quando|Fotografias)/m);
    expect(c.description).toContain("Também pode ao fim de semana.");
  });

  it("as regras com os campos do pedido não repetem o dia nem o acesso; sem eles, ficam ditos pelo cliente", () => {
    const f = juntarAConversa(fontesDeUmaDescricao("Recolha de um sofá."), { quandoTexto: "sábado de manhã", floor: "3", hasElevator: "yes" }, AGORA);
    const comCampos = descricaoPelasRegras(f, "recolha_moveis", camposQueOProfissionalVe({ ...PEDIDO, floor: "3", hasElevator: "yes", dataAgendada: instanteEmLisboa("2026-11-28T09:00") }), { agora: AGORA });
    expect(comCampos).not.toMatch(/Quando|andar|elevador/);
    const semCampos = descricaoPelasRegras(f, "recolha_moveis", {}, { agora: AGORA });
    expect(semCampos).toContain("Quando (dito pelo cliente): sábado de manhã");
    expect(semCampos).toContain("Andar (dito pelo cliente): 3.º andar, com elevador.");
  });

  it("o «Arrumar» pede o modo das sugestões, e as regras e o modelo levam os campos do pedido", () => {
    const ROTA = ler("src/app/api/admin/pedidos/arrumar-descricao/route.ts");
    expect(ROTA).toContain('escreverADescricao(fontes, pedido, { modo: "sugestao", agora })');
    expect(ROTA).toContain('descricaoPelasRegras(fontes, doFormulario.serviceType, camposQueOProfissionalVe(pedido), { modo: "sugestao", agora })');
    expect(ROTA).toContain("sugestoes: sugestoesDaDescricao(null, fontes, pedido, agora)");
    const BASE = ler("src/lib/descricao-do-pedido-na-base.ts");
    expect(BASE.match(/descricaoPelasRegras\(fontes, p\.serviceType, camposQueOProfissionalVe\(pedidoParaADescricao\(p\)\)\)/g)).toHaveLength(2);
    expect(ler("src/lib/registar-pedido-por-whatsapp.ts")).toMatch(/descricaoParaOPedido\(d, \{[\s\S]*?campos: \{/);
  });

  it("o formulário mostra as sugestões com «Preencher», que só muda o campo — não grava", () => {
    const FORM = ler("src/components/admin/RegistarPedido.tsx");
    expect(FORM).toContain("setSugestoesDaArrumacao(Array.isArray(d.sugestoes) ? d.sugestoes : [])");
    const i = FORM.indexOf("{sugestoesDaArrumacao.length > 0");
    const bloco = FORM.slice(i, FORM.indexOf("</ul>", i));
    expect(bloco).toContain("Preencher");
    expect(bloco).toContain("muda(s.campo, s.valor");
    expect(bloco).not.toMatch(/fetch\(|gravar|\/editar/);
    // As opções do estacionamento são as mesmas de que as sugestões falam.
    for (const o of ESTACIONAMENTO_NO_FORMULARIO) expect(FORM).toContain(`<option value="${o.valor}">${o.rotulo}</option>`);
  });
});

describe("7. onde o profissional vê os campos que saíram da descrição", () => {
  it("a app Pro: o dia, o andar, o elevador, o estacionamento, o destino e as fotografias", () => {
    const APP = ler("app-pro/src/app/trabalho/[id].tsx");
    for (const r of ['rotulo="Quando"', 'rotulo="Onde"', 'rotulo="Andar"', 'rotulo="Elevador"', 'rotulo="Estacionar"', 'rotulo="Para onde vai"', 'rotulo="Andar no destino"', 'rotulo="Elevador no destino"', 'rotulo="Estacionar no destino"']) {
      expect(APP, r).toContain(r);
    }
    expect(APP).toContain("imagensDe(t.filesJson)");
  });

  it("o painel: o andar por extenso, e o destino também só com a localidade", () => {
    const PAINEL = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(PAINEL).toContain("andarPorExtenso(pedido.floor) ?? pedido.floor");
    expect(PAINEL).toContain("(pedido.moradaDestino || pedido.localidadeDestino || pedido.andarDestino) && (");
    expect(PAINEL).toContain("emPortugues(ESTACIONAMENTO, pedido.parkingDistance)");
    expect(PAINEL).toContain("{quandoDoPedido.dia}");
  });

  it("a página do pedido (o link do aviso): o dia e o acesso em palavras, e o destino sem a morada", () => {
    const PAGINA = ler("src/app/profissionais/pedidos/[token]/page.tsx");
    for (const r of ['["Quando"', '["Andar"', '["Elevador"', '["Estacionar"', '["Para onde vai"', '["Estacionar no destino"']) {
      expect(PAGINA, r).toContain(r);
    }
    expect(PAGINA).not.toContain("Elevador: {String(vista.hasElevator)}");
    const i = PAGINA.indexOf("function destinoDaMudanca(");
    expect(PAGINA.slice(i, PAGINA.indexOf("\n}", i))).not.toContain("formattedAddress");
  });
});
