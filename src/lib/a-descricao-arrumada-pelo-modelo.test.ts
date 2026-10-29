import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CABECA_DO_BLOCO,
  comAEscrita,
  comTextoDaEquipa,
  descricaoPelasRegras,
  equipaMexeu,
  fontesDeUmaDescricao,
  fontesVazias,
  frasesDoCliente,
  juntarAConversa,
  partirEmEquipaEBlocos,
  type FontesDaDescricao,
} from "./fontes-da-descricao";
import {
  comporADescricao,
  entradaDoModelo,
  escreverADescricao,
  INSTRUCAO_DA_DESCRICAO,
  lerResposta,
  validarAResposta,
  type PedidoParaADescricao,
  type RespostaDoModelo,
} from "./descricao-pelo-modelo";
import {
  mesmaSegundaMorada,
  separarASegundaMorada,
  segundaParagemPorExtenso,
  type SegundaMorada,
} from "./segunda-morada";
import { descricaoOrganizada, pormenoresDoCliente } from "./descricao-do-pedido";
import {
  AS_PROPOSTAS_CHEGAM_POR_AQUI,
  dadosDaConversaNoPedido,
  pedidoNaConversa,
  responderNoPedidoAberto,
  type ContextoDoPedidoAberto,
  type PedidoDaBase,
} from "./pedido-aberto-na-conversa";
import { primeiroPassoEmFalta, type DadosDaRecolha } from "./whatsapp-recolha";
import { PERGUNTA_ANOTADA } from "./voz-da-vitoria";
import { descricaoParaOAviso, eDescricaoArrumada } from "./aviso-de-pedido-ao-profissional";
import { MODELO_ACTUAL } from "./modelo-do-gemini";
import { NOME_DO_USO, USOS_DA_IA } from "./saude-da-ia";

/**
 * A DESCRIÇÃO QUE O PROFISSIONAL LÊ, ESCRITA A PARTIR DAS FONTES — 29-10-2026
 * (ordem do CEO, aprovada pelo dono: «automático + botão»).
 *
 * O caso, com o número do pedido, a morada e o nome INVENTADOS (o repositório
 * é público): um pedido de recolha com o texto da equipa e, por baixo, DOIS
 * blocos «Acrescentado pelo cliente no WhatsApp:», o segundo igual ao
 * primeiro com mais duas linhas. «Móveis» vago, a frase do cliente copiada tal
 * e qual, uma 2.ª morada de recolha perdida, e uma pergunta sem resposta.
 * *«Nem eu consigo entender, muito menos o profissional.»* — o dono.
 */

const anotadas: Array<{ uso: string; motivo: string | null }> = [];
vi.mock("./saude-da-ia-na-base", () => ({
  anotarSaudeDaIa: async (uso: string, motivo: string | null) => {
    anotadas.push({ uso, motivo });
  },
  falhasDaIa: async () => [],
}));

/** Como responde cada chamada ao modelo, pela ordem; o que sobra repete a última. */
let respostas: Array<{ erro?: string; texto?: string; nunca?: boolean }> = [];
const chamados: string[] = [];
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel({ model }: { model: string }) {
      return {
        generateContent: async () => {
          chamados.push(model);
          const r = respostas[Math.min(chamados.length - 1, respostas.length - 1)] ?? { erro: "sem resposta" };
          if (r.nunca) return new Promise(() => {});
          if (r.erro) throw new Error(r.erro);
          return { response: { text: () => r.texto ?? "" } };
        },
      };
    }
  },
}));

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const AGORA = new Date("2026-10-29T14:00:00Z");
const DEPOIS = new Date("2026-10-29T15:00:00Z");
const COM_TEMPO = 60_000;

/** A descrição como ficou no pedido (texto inventado com a mesma forma). */
const DESCRICAO_REPETIDA = [
  "Recolha de apartamento, 2 roupeiros, cama 3 sofás",
  "",
  CABECA_DO_BLOCO,
  "Para levar: móveis, 1 fogão, 1 máquina de lavar roupa.",
  "Pormenores (ditos pelo cliente): Além desses móveis, a recolha inclui um fogão e uma máquina de lavar de dimensões padrão.",
  "",
  CABECA_DO_BLOCO,
  "Para levar: móveis, 1 fogão, 1 máquina de lavar roupa.",
  "Quando (dito pelo cliente): De manhã",
  "Fotografias enviadas pelo cliente: 4.",
  "Pormenores (ditos pelo cliente): Além desses móveis, a recolha inclui um fogão e uma máquina de lavar de dimensões padrão.",
].join("\n");

const A_SEGUNDA_MORADA = "Haverá um segundo lugar de recolha intermédia: Rua das Flores 12, 6.º C, 1400-123 Lisboa";

/** O pedido para o gerador — com os dados do cliente, que só servem para verificar. */
const PEDIDO: PedidoParaADescricao = {
  serviceType: "recolha_moveis",
  city: "Lisboa",
  postalCode: "1100-321",
  floor: "3",
  hasElevator: "yes",
  parkingDistance: null,
  dataAgendada: "2026-10-31 09:00:00",
  fotos: 4,
  contactName: "Joana Prates",
  contactPhone: "912 345 678",
  contactEmail: "joana.prates@exemplo.pt",
  address: "Avenida dos Lírios 40",
};

function linhasRepetidas(texto: string): string[] {
  const vistas = new Set<string>();
  const repetidas: string[] = [];
  for (const l of texto.split("\n").map((x) => x.trim()).filter(Boolean)) {
    if (vistas.has(l)) repetidas.push(l);
    vistas.add(l);
  }
  return repetidas;
}

/* ──────────────────────────────────────────────────────────────────────── */

describe("1. sem blocos repetidos: a descrição escreve-se a partir das fontes", () => {
  it("a descrição com dois blocos volta a fontes uma vez cada: o texto da equipa, as frases, o «quando»", () => {
    const f = fontesDeUmaDescricao(DESCRICAO_REPETIDA);
    expect(f.equipa).toBe("Recolha de apartamento, 2 roupeiros, cama 3 sofás");
    expect(frasesDoCliente(f)).toEqual([
      "móveis, 1 fogão, 1 máquina de lavar roupa.",
      "Além desses móveis, a recolha inclui um fogão e uma máquina de lavar de dimensões padrão.",
    ]);
    expect(f.campos.quandoTexto?.v).toBe("De manhã");
  });

  it("pelas regras: o texto da equipa e UM bloco, sem uma linha repetida", () => {
    const regras = descricaoPelasRegras(fontesDeUmaDescricao(DESCRICAO_REPETIDA), "recolha_moveis");
    expect(regras.match(new RegExp(CABECA_DO_BLOCO, "g"))).toHaveLength(1);
    expect(regras.startsWith("Recolha de apartamento, 2 roupeiros, cama 3 sofás\n\n")).toBe(true);
    expect(linhasRepetidas(regras)).toEqual([]);
    expect(regras).toContain("Quando (dito pelo cliente): De manhã");
  });

  it("a mesma conversa outra vez não muda nada — e escrever outra vez dá o mesmo texto (sem deriva)", () => {
    const novos: DadosDaRecolha = { description: "Além desses móveis, levar também um fogão.", quandoTexto: "sábado de manhã" };
    const uma = juntarAConversa(fontesVazias(), novos, AGORA);
    const duas = juntarAConversa(uma, novos, DEPOIS);
    expect(JSON.stringify(duas)).toBe(JSON.stringify(uma));
    const texto = descricaoPelasRegras(uma, "recolha_moveis");
    const deNovo = descricaoPelasRegras(juntarAConversa(comAEscrita(uma, texto, "regras", AGORA), novos, DEPOIS), "recolha_moveis");
    expect(deNovo).toBe(texto);
  });

  it("a equipa editou à mão: o texto dela manda, e só o que o cliente disse DEPOIS volta ao bloco", () => {
    const comCliente = juntarAConversa(fontesDeUmaDescricao("Sofá velho."), { description: "É um sofá de 3 lugares." }, AGORA);
    const escrita = comAEscrita(comCliente, descricaoPelasRegras(comCliente, "recolha_moveis"), "regras", AGORA);
    expect(equipaMexeu(escrita, "Sofá de 3 lugares e uma mesa. Confirmar o elevador.")).toBe(true);
    expect(equipaMexeu(escrita, escrita.escrita)).toBe(false);
    const daEquipa = comTextoDaEquipa(escrita, "Sofá de 3 lugares e uma mesa. Confirmar o elevador.", DEPOIS);
    // O original nunca se perde — mas já não volta à descrição.
    expect(daEquipa.cliente.map((d) => d.t)).toContain("É um sofá de 3 lugares.");
    expect(descricaoPelasRegras(daEquipa, "recolha_moveis")).toBe("Sofá de 3 lugares e uma mesa. Confirmar o elevador.");
    // O que ele disser a seguir junta-se ao texto da equipa, num bloco só.
    const depois = juntarAConversa(daEquipa, { description: "É um sofá de 3 lugares.\nTambém há uma cómoda." }, new Date("2026-10-29T16:00:00Z"));
    const texto = descricaoPelasRegras(depois, "recolha_moveis");
    expect(texto.startsWith("Sofá de 3 lugares e uma mesa. Confirmar o elevador.\n\n")).toBe(true);
    expect(texto).toContain("cómoda");
    expect(texto.match(new RegExp(CABECA_DO_BLOCO, "g"))).toHaveLength(1);
  });

  it("uma linha que a equipa escreveu dentro de um bloco é da equipa, e fica", () => {
    const { equipa, blocos } = partirEmEquipaEBlocos(`Sofá velho.\n\n${CABECA_DO_BLOCO}\nPara levar: 1 sofá.\nLigar antes de ir.`);
    expect(equipa).toBe("Sofá velho.\n\nLigar antes de ir.");
    expect(blocos).toEqual(["Para levar: 1 sofá."]);
  });
});

/* ──────────────────────────────────────────────────────────────────────── */

describe("2. a 2.ª morada de recolha fica no pedido, sem a rua na descrição", () => {
  it("lê-se a morada: a rua, o código postal, a localidade, o andar e a porta", () => {
    const { segunda, resto } = separarASegundaMorada(A_SEGUNDA_MORADA);
    expect(segunda).toMatchObject({
      rua: "Rua das Flores 12",
      codigoPostal: "1400-123",
      localidade: "Lisboa",
      andar: "6",
      lado: "C",
      elevador: null,
    });
    expect(resto).toBe("");
    expect(segundaParagemPorExtenso(segunda!)).toBe("Lisboa (1400), 6.º andar C, elevador por confirmar");
  });

  it("as outras maneiras de o dizer — e as frases que parecem e não são", () => {
    expect(separarASegundaMorada("Também é preciso recolher na Rua do Sol 5, 2800-100 Almada, rés-do-chão").segunda).toMatchObject({
      localidade: "Almada",
      andar: "0",
    });
    expect(separarASegundaMorada("Há mais uma paragem pelo caminho, em Odivelas.").segunda).not.toBeNull();
    for (const nao of [
      "Em segundo lugar, o sofá é grande.",
      "A paragem do autocarro é mesmo à porta.",
      "Tem uma segunda casa de banho para remodelar.",
      "Também é preciso recolher na garagem.",
    ]) {
      expect(separarASegundaMorada(nao).segunda, nao).toBeNull();
    }
    // Numa mudança, «a segunda morada» é o destino.
    expect(separarASegundaMorada("A segunda morada é Rua Nova 3, 1000-001 Lisboa", "mudanca").segunda).toBeNull();
    expect(separarASegundaMorada("Há um segundo local de recolha: Rua Nova 3, 1000-001 Lisboa", "mudanca").segunda).not.toBeNull();
  });

  it("a descrição das regras diz a 2.ª paragem — sem a rua; e uma frase com morada não vai para os pormenores", () => {
    const { segunda } = separarASegundaMorada(A_SEGUNDA_MORADA);
    const d = descricaoOrganizada({ serviceType: "recolha_moveis", description: "2 roupeiros.", segundaMorada: segunda });
    expect(d).toContain("2.ª paragem: Lisboa (1400), 6.º andar C, elevador por confirmar.");
    expect(d).not.toMatch(/Flores|1400-123/);
    expect(pormenoresDoCliente([A_SEGUNDA_MORADA, "O roupeiro grande está desmontado."])).toEqual([
      "O roupeiro grande está desmontado.",
    ]);
  });

  const ABERTO: PedidoDaBase = {
    id: 930,
    status: "enviado",
    serviceType: "recolha_moveis",
    contactName: "Joana Prates",
    address: "Avenida dos Lírios 40",
    city: "Lisboa",
    postalCode: "1100-321",
    floor: "3",
    hasElevator: "yes",
    parkingDistance: null,
    description: "Recolha de apartamento, 2 roupeiros, cama 3 sofás",
    createdAt: "2026-10-29T09:00:00Z",
  };
  const ctx = (p: PedidoDaBase, extra: Partial<ContextoDoPedidoAberto> = {}): ContextoDoPedidoAberto => ({
    pedido: pedidoNaConversa(p),
    primeira: false,
    colegaJaFalou: true,
    jaSeApresentou: true,
    ...extra,
  });
  const estado = (p: PedidoDaBase) => {
    const dados = dadosDaConversaNoPedido(p);
    return { passo: primeiroPassoEmFalta(dados), dados };
  };

  it("a Vitória guarda-a, diz que ficou, e passa a uma pessoa — o preço muda", () => {
    const r = responderNoPedidoAberto(estado(ABERTO), A_SEGUNDA_MORADA, AGORA, ctx(ABERTO));
    expect(r.pedirPessoa).toBe(true);
    expect(r.segundaMoradaNova?.codigoPostal).toBe("1400-123");
    expect(r.motivoDaEntrega).toContain("2.ª morada de recolha no pedido #930");
    expect(r.motivoDaEntrega).toContain("o preço muda");
    expect(r.resposta).toContain("Fica anotada no seu pedido #930 a 2.ª morada de recolha, em Lisboa.");
    expect(r.resposta).toContain("uma pessoa da CLYON");
    expect(r.estado.dados.segundaMorada?.andar).toBe("6");
    // O 6.º andar é da 2.ª morada, e não da principal.
    expect(r.estado.dados.floor).toBe("3");
  });

  it("com o andar da morada principal por saber, o «6.º» também não vai para ela", () => {
    const semAndar = { ...ABERTO, floor: null, hasElevator: null };
    const r = responderNoPedidoAberto(estado(semAndar), A_SEGUNDA_MORADA, AGORA, ctx(semAndar));
    expect(r.segundaMoradaNova).toBeDefined();
    expect(r.estado.dados.floor ?? null).toBeNull();
  });

  it("dita outra vez, a mesma morada não volta a passar a conversa", () => {
    const { segunda } = separarASegundaMorada(A_SEGUNDA_MORADA);
    expect(mesmaSegundaMorada(segunda, separarASegundaMorada(`${A_SEGUNDA_MORADA}.`).segunda)).toBe(true);
    const e = estado(ABERTO);
    const r = responderNoPedidoAberto({ ...e, dados: { ...e.dados, segundaMorada: segunda } }, A_SEGUNDA_MORADA, AGORA, ctx(ABERTO));
    expect(r.pedirPessoa).not.toBe(true);
  });

  it("no pedido: a morada inteira nas notas e no histórico (só a equipa os vê); na descrição, só a localidade", () => {
    const NEG = ler("src/lib/whatsapp-negociacao.ts");
    const i = NEG.indexOf("async function completarOPedidoAberto(");
    const corpo = NEG.slice(i, NEG.indexOf("\n}", i));
    expect(corpo).toContain("if (r.segundaMoradaNova)");
    expect(corpo).toContain("notasInternas");
    expect(corpo).toMatch(/2\.ª morada de recolha: \$\{morada\}\. O preço muda/);
  });
});

/* ──────────────────────────────────────────────────────────────────────── */

describe("3. a pergunta que também respondeu tem resposta — e a que fica anotada vai para a equipa", () => {
  const SEM_ANDAR: PedidoDaBase = {
    id: 931,
    status: "enviado",
    serviceType: "recolha_moveis",
    contactName: "Joana Prates",
    address: "Avenida dos Lírios 40",
    city: "Lisboa",
    postalCode: "1100-321",
    floor: null,
    hasElevator: null,
    description: "Sofá e mesa.",
    createdAt: "2026-10-29T09:00:00Z",
  };
  const ctx: ContextoDoPedidoAberto = {
    pedido: pedidoNaConversa(SEM_ANDAR),
    primeira: false,
    colegaJaFalou: true,
    jaSeApresentou: true,
  };

  it("«Podem enviar proposta para sábado de manhã?» — fica o sábado de manhã, e responde-se à pergunta", () => {
    const dados = dadosDaConversaNoPedido(SEM_ANDAR);
    const e = { passo: primeiroPassoEmFalta(dados), dados };
    expect(e.passo).toBe("andar");
    const r = responderNoPedidoAberto(e, "Podem enviar proposta para sábado de manhã?", AGORA, ctx);
    expect(r.resposta).toContain(AS_PROPOSTAS_CHEGAM_POR_AQUI);
    expect(r.estado.dados.quandoTexto).toMatch(/s[áa]bado/i);
    expect(r.perguntaParaAEquipa).toBeUndefined();
  });

  it("sem nada por perguntar, a pergunta que ninguém sabe responder fica anotada — e a equipa sabe", () => {
    const completo = { ...SEM_ANDAR, floor: "2", hasElevator: "yes" };
    const dados = dadosDaConversaNoPedido(completo);
    const r = responderNoPedidoAberto({ passo: primeiroPassoEmFalta(dados), dados }, "Passam recibo em nome da empresa?", AGORA, {
      ...ctx,
      pedido: pedidoNaConversa(completo),
    });
    expect(r.resposta).toContain(PERGUNTA_ANOTADA);
    expect(r.perguntaParaAEquipa).toBe("Passam recibo em nome da empresa?");
    const NEG = ler("src/lib/whatsapp-negociacao.ts");
    expect(NEG).toContain("Pergunta do cliente no WhatsApp, por responder:");
  });
});

/* ──────────────────────────────────────────────────────────────────────── */

/** As fontes do caso, já com a conversa: o texto da equipa, o cliente, a 2.ª morada. */
function fontesDoCaso(): FontesDaDescricao {
  const segunda = separarASegundaMorada(A_SEGUNDA_MORADA).segunda as SegundaMorada;
  return juntarAConversa(
    fontesDeUmaDescricao("Recolha de apartamento, 2 roupeiros, cama 3 sofás"),
    {
      description:
        "Para levar: móveis, 1 fogão, 1 máquina de lavar roupa.\n" +
        "Além desses móveis, a recolha inclui um fogão e uma máquina de lavar de dimensões padrão.\n" +
        "Nas imagens: um colchão encostado à parede",
      quandoTexto: "sábado de manhã",
      segundaMorada: segunda,
      fotosRecebidas: 4,
    },
    AGORA,
  );
}

const BOA: RespostaDoModelo = {
  paraLevar: ["2 roupeiros", "1 cama", "3 sofás", "1 fogão", "1 máquina de lavar roupa"],
  confirmarSeTambemVai: ["1 colchão"],
  quando: "sábado, 31 de outubro, de manhã",
  estacionamento: "",
  notas: [],
  porConfirmar: ["as medidas dos roupeiros"],
};

describe("4. o texto gerado: sem preços, sem contactos, sem moradas — e nada inventado", () => {
  it("o modelo nunca vê o nome, o telefone, o email, a rua nem o código postal", () => {
    const f = juntarAConversa(fontesDoCaso(), {
      description: "Pode falar com a Joana pelo 912 345 678 ou joana.prates@exemplo.pt. Fica na Avenida dos Lírios 40, 1100-321.",
    }, DEPOIS);
    const entrada = entradaDoModelo(f, PEDIDO);
    expect(entrada).not.toMatch(/Joana|Prates|912 345 678|exemplo\.pt|L[íi]rios|1100-321|1400-123|Flores/);
    expect(entrada).toContain("Localidade: Lisboa (1100)");
    expect(entrada).toContain("2.ª paragem de recolha: Lisboa (1400), 6.º andar C");
  });

  it("a resposta boa passa, e sai no formato fixo do profissional", () => {
    const f = fontesDoCaso();
    expect(validarAResposta(BOA, f, PEDIDO)).toEqual({ ok: true });
    const texto = comporADescricao(BOA, f, PEDIDO);
    expect(texto.split("\n")).toEqual([
      "Serviço: Recolha de móveis",
      "Para levar: 2 roupeiros, 1 cama, 3 sofás, 1 fogão, 1 máquina de lavar roupa.",
      "Confirmar se também vai: 1 colchão.",
      "Morada: Lisboa (1100), 3.º andar, com elevador.",
      "2.ª paragem: Lisboa (1400), 6.º andar C, elevador por confirmar.",
      "Quando: sábado, 31 de outubro, de manhã.",
      "Estacionamento: por confirmar.",
      "Fotografias: 4, enviadas pelo cliente.",
      "Por confirmar: o elevador da 2.ª paragem; o estacionamento; as medidas dos roupeiros.",
    ]);
    expect(texto).not.toMatch(/€|euro|pre[cç]o|Joana|912|@|Flores|L[íi]rios|\d{4}-\d{3}/i);
    expect(linhasRepetidas(texto)).toEqual([]);
  });

  it("chumba: preços, contactos, o nome, a rua, o código postal, o Brasil, promessas — e o que foi inventado", () => {
    const f = fontesDoCaso();
    const casos: Array<[Partial<RespostaDoModelo>, RegExp]> = [
      [{ notas: ["Cerca de 120 € pelo serviço."] }, /preços/],
      [{ notas: ["O preço depende do andar."] }, /preços/],
      [{ notas: ["Ligar para 912 345 678."] }, /contacto/],
      [{ notas: ["Escrever para joana.prates@exemplo.pt."] }, /contacto/],
      [{ notas: ["Falar com a Joana à chegada."] }, /nome/],
      [{ notas: ["A 2.ª paragem é na Rua das Flores 12."] }, /morada/],
      [{ notas: ["Código postal 1400-123."] }, /morada/],
      [{ notas: ["Você confirma o elevador."] }, /Portugal/],
      [{ quando: "no próprio dia" }, /promessa/],
      [{ paraLevar: ["1 piano de cauda"] }, /inventou/],
      [{ confirmarSeTambemVai: ["uma bicicleta"] }, /inventou/],
    ];
    for (const [mudanca, motivo] of casos) {
      const v = validarAResposta({ ...BOA, ...mudanca }, f, PEDIDO);
      expect(v.ok, JSON.stringify(mudanca)).toBe(false);
      if (!v.ok) expect(v.motivo, JSON.stringify(mudanca)).toMatch(motivo);
    }
  });

  it("o que o cliente disse que NÃO é para levar não se pode perder", () => {
    const f = juntarAConversa(fontesDoCaso(), { notas: ["Só não é preciso tirar o frigorífico"] }, DEPOIS);
    expect(validarAResposta(BOA, f, PEDIDO).ok).toBe(false);
    expect(validarAResposta({ ...BOA, notas: ["O frigorífico fica — não é para levar."] }, f, PEDIDO).ok).toBe(true);
  });

  it("o JSON do modelo lê-se sem confiar nele", () => {
    expect(lerResposta("isto não é JSON")).toBeNull();
    expect(lerResposta(JSON.stringify({ paraLevar: "1 sofá" }))).toBeNull();
    expect(lerResposta("```json\n" + JSON.stringify(BOA) + "\n```")).toEqual(BOA);
  });

  it("o aviso ao modelo pede o formato, as regras, e o português de Portugal", () => {
    expect(INSTRUCAO_DA_DESCRICAO).toContain("Sem preços, sem valores, sem euros.");
    expect(INSTRUCAO_DA_DESCRICAO).toContain("Sem nomes, telefones, emails nem moradas");
    expect(INSTRUCAO_DA_DESCRICAO).toContain("confirmarSeTambemVai");
    expect(INSTRUCAO_DA_DESCRICAO).toContain("Português de Portugal");
  });
});

/* ──────────────────────────────────────────────────────────────────────── */

describe("5. o modelo a falhar: fica a descrição das regras, e a falha fica à vista", () => {
  const antes = { ...process.env };
  beforeEach(() => {
    anotadas.length = 0;
    chamados.length = 0;
    respostas = [];
    process.env.GEMINI_API_KEY = "chave-de-teste";
    delete process.env.WHATSAPP_GEMINI_MODEL;
    delete process.env.GEMINI_MODEL;
  });
  afterEach(() => {
    process.env = { ...antes };
    vi.useRealTimers();
  });

  it("o termómetro do painel tem o uso «Descrição dos pedidos»", () => {
    expect(USOS_DA_IA).toContain("descricao");
    expect(NOME_DO_USO.descricao).toBe("Descrição dos pedidos");
  });

  it("a escrever bem: o texto sai no formato, e o termómetro limpa", async () => {
    respostas = [{ texto: JSON.stringify(BOA) }];
    const r = await escreverADescricao(fontesDoCaso(), PEDIDO);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.texto.startsWith("Serviço: Recolha de móveis\nPara levar: 2 roupeiros")).toBe(true);
    expect(chamados).toEqual([MODELO_ACTUAL]);
    expect(anotadas).toEqual([{ uso: "descricao", motivo: null }]);
  }, COM_TEMPO);

  it("sem quota (429): diz porquê, e fica anotado no termómetro", async () => {
    respostas = [{ erro: "[429 Too Many Requests] You exceeded your current quota" }];
    const r = await escreverADescricao(fontesDoCaso(), PEDIDO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("429");
    expect(anotadas.at(-1)?.uso).toBe("descricao");
    expect(anotadas.at(-1)?.motivo).toContain("ficou a descrição das regras");
  }, COM_TEMPO);

  it("uma resposta fora das regras não se usa — nem se pergunta a outro modelo", async () => {
    respostas = [{ texto: JSON.stringify({ ...BOA, notas: ["Fica por cerca de 90 euros."] }) }];
    const r = await escreverADescricao(fontesDoCaso(), PEDIDO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/fora das regras \(falou de preços/);
    expect(chamados).toHaveLength(1);
    respostas = [{ texto: "Aqui está a descrição: sofá e mesa." }];
    const fora = await escreverADescricao(fontesDoCaso(), PEDIDO);
    expect(!fora.ok && fora.motivo).toMatch(/fora do formato/);
  }, COM_TEMPO);

  it("o tempo esgotado também é uma falha: não fica à espera para sempre", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    respostas = [{ nunca: true }];
    let fim: Awaited<ReturnType<typeof escreverADescricao>> | null = null;
    const p = escreverADescricao(fontesDoCaso(), PEDIDO).then((r) => {
      fim = r;
    });
    for (let i = 0; i < 200 && fim == null; i++) {
      await new Promise((ok) => setImmediate(ok));
      await vi.advanceTimersByTimeAsync(1000);
    }
    await p;
    expect(fim).not.toBeNull();
    expect((fim as unknown as { ok: boolean }).ok).toBe(false);
    expect((fim as unknown as { motivo: string }).motivo).toMatch(/demorou mais de/);
    expect(anotadas.at(-1)?.uso).toBe("descricao");
  }, COM_TEMPO);

  it("sem chave: diz que ficou a das regras", async () => {
    delete process.env.GEMINI_API_KEY;
    const r = await escreverADescricao(fontesDoCaso(), PEDIDO);
    expect(r.ok).toBe(false);
    expect(anotadas).toEqual([{ uso: "descricao", motivo: "sem GEMINI_API_KEY — ficou a descrição das regras" }]);
  });

  it("na base: falhou, grava a das regras (que não repete blocos) e diz no histórico do pedido", () => {
    const BASE = semComentarios(ler("src/lib/descricao-do-pedido-na-base.ts"));
    const i = BASE.indexOf("export async function reescreverADescricao(");
    const corpo = BASE.slice(i, BASE.indexOf("\n}", i));
    expect(corpo).toContain("const r = await escreverADescricao(fontes, pedidoParaADescricao(p));");
    expect(corpo).toContain("const regras = descricaoPelasRegras(fontes, p.serviceType);");
    expect(corpo).toContain("A descrição ficou arrumada pelas regras: o modelo não a escreveu");
    // Só grava se a descrição ainda for a que se leu: quem escreveu entretanto, ganha.
    expect(corpo.match(/gravarDescricaoEFontes\([^;]*?,\s*lida,?\s*\)/g)?.length).toBe(2);
  });
});

/* ──────────────────────────────────────────────────────────────────────── */

describe("6. o botão «Arrumar a descrição» só preenche o campo — quem grava é a equipa", () => {
  const FORM = ler("src/components/admin/RegistarPedido.tsx");
  const ROTA = semComentarios(ler("src/app/api/admin/pedidos/arrumar-descricao/route.ts"));

  it("o botão está no «Editar pedido», chama o gerador e põe o texto no campo", () => {
    expect(FORM).toContain("Arrumar a descrição");
    const i = FORM.indexOf("async function arrumarADescricao(");
    expect(i).toBeGreaterThan(-1);
    const corpo = FORM.slice(i, FORM.indexOf("\n  }\n", i));
    expect(corpo).toContain('fetch("/api/admin/pedidos/arrumar-descricao"');
    expect(corpo).toContain('muda("description", d.texto)');
    // Não grava: nem a rota de editar, nem a de criar, nem o «calcular».
    expect(corpo).not.toMatch(/\/editar|pedidos\/criar|calcular\(|enviar\(/);
    // E diz que gravar recomeça o pedido e acaba com as propostas.
    expect(corpo).toContain("Ao gravar, o pedido recomeça e as propostas actuais acabam.");
    expect(FORM).toContain("Repor o texto anterior");
  });

  it("a rota é só para a equipa, usa o mesmo gerador, e não grava nada", () => {
    expect(ROTA).toContain("await requireAdmin(req)");
    expect(ROTA).toContain("escreverADescricao(fontes, pedidoParaADescricao(doFormulario))");
    expect(ROTA).toContain("descricaoPelasRegras(fontes, doFormulario.serviceType)");
    expect(ROTA).not.toMatch(/updateSimulatorOrder|gravarDescricaoEFontes|appendOrderHistory|guardarOTextoDaEquipa/);
  });

  it("gravar no «Editar pedido» faz do texto gravado a fonte da equipa", () => {
    const EDITAR = ler("src/app/api/admin/pedidos/[id]/editar/route.ts");
    expect(EDITAR).toContain("await guardarOTextoDaEquipa(");
  });
});

/* ──────────────────────────────────────────────────────────────────────── */

describe("7. onde o profissional a lê", () => {
  const TEXTO = comporADescricao(BOA, fontesDoCaso(), PEDIDO);

  it("o aviso por WhatsApp junta as linhas com «·», sem a do serviço, e chama-lhe «O pedido»", () => {
    expect(eDescricaoArrumada(TEXTO)).toBe(true);
    const aviso = descricaoParaOAviso(TEXTO)!;
    expect(aviso.startsWith("Para levar: 2 roupeiros, 1 cama, 3 sofás, 1 fogão, 1 máquina de lavar roupa · Confirmar se também vai")).toBe(true);
    expect(aviso).not.toContain("Serviço:");
    expect(aviso.length).toBeLessThanOrEqual(321);
    const fonte = ler("src/lib/aviso-de-pedido-ao-profissional.ts");
    expect(fonte).toContain('eDescricaoArrumada(p.descricao) ? "O pedido" : "O cliente escreveu"');
  });

  it("o painel, a página do pedido, a app e o email guardam as mudanças de linha", () => {
    expect(ler("src/app/profissionais/painel/Trabalhos.tsx")).toMatch(/whitespace-pre-line[^"]*"[^>]*>\s*\{pedido\.description\}/);
    expect(ler("src/app/profissionais/pedidos/[token]/page.tsx")).toMatch(/whitespace-pre-line[^"]*">\s*\{String\(vista\.description\)\}/);
    expect(ler("src/lib/email-profissional.ts")).toMatch(/white-space:pre-line;">\$\{e\(\s*p\.descricao/);
    // Na app (React Native) o <Text> respeita o «\n» sozinho.
    expect(ler("app-pro/src/app/trabalho/[id].tsx")).toContain("<DescricaoDoPedido texto={t.description} />");
    // E no backoffice também (a ficha do pedido).
    expect(ler("src/components/admin/PedidoDetailModal.tsx")).toContain("whitespace-pre-line break-words text-sm leading-relaxed text-slate-700\">{order.description}");
    expect(ler("src/app/admin/pedidos/[id]/AdminPedidoDetalheClient.tsx")).toContain(
      "whitespace-pre-line break-words text-sm leading-relaxed text-slate-300\">{order.description}",
    );
  });

  it("uma descrição livre continua como era: uma frase, cortada na palavra", () => {
    expect(eDescricaoArrumada("Sofá velho na garagem.\nTem 3 lugares.")).toBe(false);
    expect(descricaoParaOAviso("uma\n\n\ncoisa\n  e outra")).toBe("uma coisa e outra");
  });
});
