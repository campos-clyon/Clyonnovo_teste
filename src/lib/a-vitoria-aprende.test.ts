import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  casosDaConversa,
  licoesParaOModelo,
  motivoParaBloquear,
  numerosDaSemana,
  painelDaSemana,
  quandoSeUsarUmaLicao,
  respostaDoSiteOuDasLicoes,
  respostaPelasLicoes,
  semDadosDePessoas,
  usarLicoes,
  type MensagemDoFio,
  type MensagemDoPainel,
} from "./licoes-da-vitoria";
import { EUROS_DAS_FONTES, eurosNoTexto, oQueOSiteSabe } from "./o-que-o-site-sabe";
import { lerALicao, licaoDoCaso } from "./propor-licoes";
import { PERGUNTA_ANOTADA, O_QUE_ELA_FAZ } from "./voz-da-vitoria";
import { recolhaNova, responderComCompreensao, responderNaRecolha, type EstadoDaRecolha } from "./whatsapp-recolha";
import { respostaLivre } from "./whatsapp-compreensao";
import { PRECO_DA_MUDANCA_POR_EXTENSO } from "./tabela-das-mudancas";
import { QUEM_FAZ_O_TRABALHO, PROMESSA_DO_PRAZO } from "./promessas-publicas";
import { RESPOSTA_SOBRE_CONTENTORES } from "./sacos-de-entulho";
import { ACRESCIMO_POR_ITEM_EXTRA } from "./itens-a-mais";
import { PRECOS } from "./precos-publicos";

/**
 * A VITÓRIA APRENDE COM O TEMPO — 27-10-2026 (decisão d11).
 *
 * Os nomes, os números e as moradas daqui são INVENTADOS (o repositório é
 * público): a Rosalina Teste, o 912 345 678, a Rua das Amendoeiras Inventadas.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

afterEach(() => {
  usarLicoes([]);
  quandoSeUsarUmaLicao(null);
});

describe("o que o site sabe — lido das fontes", () => {
  const texto = oQueOSiteSabe();

  it("traz as frases das constantes do site, e não cópias", () => {
    expect(texto).toContain(QUEM_FAZ_O_TRABALHO);
    expect(texto).toContain(PROMESSA_DO_PRAZO);
    expect(texto).toContain(RESPOSTA_SOBRE_CONTENTORES);
    expect(texto).toContain(PRECO_DA_MUDANCA_POR_EXTENSO);
    expect(texto).toContain(`${ACRESCIMO_POR_ITEM_EXTRA} € + IVA`);
  });

  it("cada preço sem IVA vai com o valor com IVA ao lado", () => {
    expect(texto).toMatch(/40 – 120 € sem IVA \(49,20 – 147,60 € com IVA\)/);
  });

  it("os euros das fontes têm os preços do site e o seu valor com IVA", () => {
    expect(EUROS_DAS_FONTES).toContain(PRECOS.recolha_moveis.minimo);
    expect(EUROS_DAS_FONTES).toContain(49.2);
    expect(EUROS_DAS_FONTES).toContain(ACRESCIMO_POR_ITEM_EXTRA);
    expect(EUROS_DAS_FONTES).toContain(39.36);
  });

  it("lê os euros de um texto, faixas incluídas", () => {
    expect(eurosNoTexto("de 40 – 120 € sem IVA, ou € 50, ou 39,36 euros")).toEqual([40, 120, 39.36, 50]);
  });

  it("entra no aviso ao modelo da compreensão, com as lições e a resposta livre", () => {
    const c = ler("src/lib/whatsapp-compreensao.ts");
    expect(c).toContain("${oQueOSiteSabe()}");
    expect(c).toContain("${licoesParaOModelo()}");
    expect(c).toContain('"resposta": "..."');
  });
});

describe("a guarda: uma lição nunca muda um preço, uma taxa ou uma promessa", () => {
  it("um preço que não bate com o site fica bloqueado, com o motivo", () => {
    expect(motivoParaBloquear("A recolha de um sofá fica em 35 € + IVA.")).toMatch(/35 €.*não bate com os preços do site/);
  });

  it("os preços do site, com o IVA ao lado, passam", () => {
    expect(motivoParaBloquear("A recolha de móveis fica entre 40 – 120 € sem IVA (49,20 – 147,60 € com IVA).")).toBeNull();
    expect(motivoParaBloquear("Cada item a mais acresce 32 € + IVA = 39,36 €.")).toBeNull();
  });

  it("«próprio dia», contentores e big bags ficam bloqueados — negados, não", () => {
    expect(motivoParaBloquear("Fazemos no próprio dia!")).toMatch(/próprio dia/);
    expect(motivoParaBloquear("Levamos um contentor ao local.")).toMatch(/contentores/);
    expect(motivoParaBloquear("Deixamos big bags para encher.")).toMatch(/big bags/);
    expect(motivoParaBloquear("A CLYON não fornece nem aluga contentores.")).toBeNull();
  });

  it("uma percentagem que não é o IVA fica bloqueada — não se mudam taxas", () => {
    expect(motivoParaBloquear("A plataforma fica com 15 %.")).toMatch(/15 %/);
    expect(motivoParaBloquear("O preço já vem com o IVA de 23 %.")).toBeNull();
  });

  it("nem IA, nem a CLYON a fazer o trabalho", () => {
    expect(motivoParaBloquear("Sou uma assistente virtual.")).toMatch(/assistente online/);
    expect(motivoParaBloquear("A nossa equipa vai lá buscar tudo.")).toMatch(/profissional escolhido/);
  });

  it("a resposta livre do modelo passa pela mesma guarda", () => {
    expect(respostaLivre("Pode, sim — as fotografias ajudam os profissionais a acertar o preço.")).toBeTruthy();
    expect(respostaLivre("Fica em 35 € no total.")).toBeNull();
    expect(respostaLivre("Fazemos no próprio dia.")).toBeNull();
  });
});

describe("sem dados de pessoas", () => {
  it("tira nomes, telefones, emails, moradas, códigos postais e números de pedido", () => {
    const t = semDadosDePessoas(
      "Olá, sou a Rosalina Teste, o meu número é 912 345 678 e o email rosalina@exemplo.pt. " +
        "Moro na Rua das Amendoeiras Inventadas, 12, 2845-000 Amora. Sobre o pedido #9123: posso pagar em dinheiro?",
      ["Rosalina Teste"],
    );
    expect(t).not.toMatch(/Rosalina|Teste|912|345 678|rosalina@|Amendoeiras|2845|9123/);
    expect(t).toContain("posso pagar em dinheiro?");
  });

  it("um nome só dito na conversa («Obrigado, Gervásio») também sai", () => {
    expect(semDadosDePessoas("Obrigado, Gervásio! Pode ser um vídeo?")).toBe("Obrigado, [nome]! Pode ser um vídeo?");
  });
});

/* ── A rotina: os casos de uma conversa ─────────────────────────────────── */

const AGORA = new Date("2026-10-27T12:00:00Z");
const ha = (h: number) => new Date(AGORA.getTime() - h * 3600_000);

function fio(linhas: Array<[number, "in" | "out", string]>): MensagemDoFio[] {
  return linhas.map(([h, direccao, texto], i) => ({ id: 100 + i, direccao, texto, criadoEm: ha(h) }));
}

describe("a rotina encontra onde a equipa teve de entrar", () => {
  const desde = ha(24);

  it("anotada, à mão, repetida e passagem — uma lição por caso", () => {
    const casos = casosDaConversa(
      fio([
        [30, "in", "Aceitam pagamento em cheque?"],
        [5, "in", "Vocês também vendem móveis usados?"],
        [5, "out", "Boa pergunta! Deixo-a anotada para os meus colegas lhe responderem."],
        [4, "out", "[à mão] Não, a CLYON não vende móveis — só liga a quem os recolhe."],
        [3, "in", "Aceitam pagamento em cheque??"],
        [2, "in", "Posso falar com alguém?"],
        [2, "out", "Com todo o gosto! Vou passar a conversa a uma pessoa da CLYON, que lhe responde por aqui assim que puder."],
      ]),
      desde,
    );
    const origens = casos.map((c) => c.origem).sort();
    expect(origens).toEqual(["anotada", "equipa_a_mao", "passagem", "repetida"]);
    const anotada = casos.find((c) => c.origem === "anotada")!;
    expect(anotada.pergunta).toBe("Vocês também vendem móveis usados?");
    expect(anotada.respostaDaEquipa).toMatch(/não vende móveis/);
  });

  it("o que aconteceu há mais de 24 horas não volta a dar lição", () => {
    const casos = casosDaConversa(
      fio([
        [40, "in", "Vocês também vendem móveis usados?"],
        [40, "out", "Boa pergunta! Deixo-a anotada para uma pessoa da CLYON lhe responder."],
      ]),
      desde,
    );
    expect(casos).toEqual([]);
  });

  it("a lição sai sem dados de pessoas, mesmo sem o modelo", () => {
    const [caso] = casosDaConversa(
      fio([
        [3, "in", "Sou a Rosalina Teste. Posso mandar um vídeo do sótão na Rua das Amendoeiras Inventadas, 12?"],
        [2, "out", "[à mão] Olá Rosalina! Pode sim, mande por aqui. Ligue-me para o 912 345 678 se precisar."],
      ]),
      desde,
    );
    const l = licaoDoCaso(caso, ["Rosalina Teste"], null);
    for (const t of [l.pergunta, l.respostaDaEquipa ?? "", l.respostaProposta]) {
      expect(t).not.toMatch(/Rosalina|Teste|Amendoeiras|912/);
    }
    expect(l.respostaProposta).toContain("Pode sim, mande por aqui.");
  });

  it("a lição do modelo lê-se e limpa-se igual", () => {
    const doModelo = lerALicao('{"pergunta":"A Rosalina pergunta se pode mandar vídeos?","resposta":"Pode, sim! Mande por aqui."}');
    expect(doModelo).not.toBeNull();
    const [caso] = casosDaConversa(fio([[3, "in", "Posso mandar vídeos?"], [2, "out", "[à mão] Pode sim, claro, mande por aqui."]]), desde);
    const l = licaoDoCaso(caso, ["Rosalina Teste"], doModelo);
    expect(l.pergunta).not.toMatch(/Rosalina/);
    expect(l.respostaProposta).toBe("Pode, sim! Mande por aqui.");
  });
});

/* ── Usadas logo: a lição aprovada muda a resposta seguinte ─────────────── */

const MENSAGENS = [
  "Uma cama de casal para levar",
  "Rosalina Teste",
  "Rua das Amendoeiras Inventadas 12 1.º Esq\n2845-000 Amora",
  "Sem elevador",
  "Vocês também vendem móveis em segunda mão?",
];

function conversa(): string[] {
  let estado: EstadoDaRecolha = recolhaNova();
  const disse: string[] = [];
  MENSAGENS.forEach((m, i) => {
    const r = responderNaRecolha(estado, m, AGORA, i > 0, false, { fotos: 1 });
    estado = r.estado;
    disse.push(r.resposta);
  });
  return disse;
}

const LICAO = {
  id: 7,
  pergunta: "Vocês vendem móveis em segunda mão?",
  respostaProposta: "A CLYON não vende móveis: liga quem precisa de os tirar de casa a profissionais verificados que os recolhem.",
};

describe("uma lição aprovada muda a resposta da conversa seguinte", () => {
  it("antes: a pergunta fica anotada para uma pessoa da CLYON", () => {
    expect(conversa()[4]).toContain(PERGUNTA_ANOTADA);
  });

  it("depois de aprovada: a Vitória responde com a lição, e conta o uso", () => {
    const usos: number[] = [];
    usarLicoes([LICAO]);
    quandoSeUsarUmaLicao((id) => usos.push(id));
    const disse = conversa()[4];
    expect(disse).toContain(LICAO.respostaProposta);
    expect(disse).not.toContain(PERGUNTA_ANOTADA);
    expect(usos).toEqual([7]);
  });

  it("uma lição com um preço que não bate com o site nunca chega à conversa", () => {
    usarLicoes([{ ...LICAO, respostaProposta: "Não vendemos, mas a recolha fica em 35 €." }]);
    expect(conversa()[4]).toContain(PERGUNTA_ANOTADA);
  });

  it("só responde à mesma pergunta — outra continua anotada", () => {
    usarLicoes([LICAO]);
    expect(respostaPelasLicoes("Aceitam pagamento em cheque?")).toBeNull();
    expect(respostaPelasLicoes("vendem moveis de segunda mao?")?.id).toBe(7);
  });

  it("o que o site responde vem antes da lição", () => {
    usarLicoes([{ id: 9, pergunta: "Posso mandar um vídeo?", respostaProposta: "Pode, claro." }]);
    expect(respostaDoSiteOuDasLicoes("Posso mandar um vídeo?")).toMatch(/fotografias ou os vídeos/);
  });

  it("a lição entra também no aviso ao modelo", () => {
    usarLicoes([LICAO]);
    expect(licoesParaOModelo()).toContain(LICAO.respostaProposta);
  });

  it("e a resposta livre do modelo responde antes de anotar", () => {
    let estado: EstadoDaRecolha = recolhaNova();
    for (const [i, m] of MENSAGENS.slice(0, 4).entries()) {
      estado = responderNaRecolha(estado, m, AGORA, i > 0, false, { fotos: 1 }).estado;
    }
    const livre = "Não, a CLYON não vende móveis — liga-o a profissionais verificados que os recolhem.";
    const r = responderComCompreensao(
      estado,
      { intencao: "informar", campos: {}, resposta: livre },
      AGORA,
      { texto: "Vocês também vendem cadeiras?", jaCumprimentou: true, fotos: 1 },
    );
    expect(r.resposta).toContain(livre);
    expect(r.resposta).not.toContain(PERGUNTA_ANOTADA);
  });
});

/* ── O painel da semana ─────────────────────────────────────────────────── */

describe("o painel conta bem, em hora de Lisboa", () => {
  // Terça, 27-10-2026 às 12:00 UTC (12:00 em Lisboa, já no horário de Inverno).
  // A semana começa na segunda 26-10 à meia-noite de Lisboa (00:00 UTC).
  const m = (telefone: string, quando: string, direccao: "in" | "out", texto: string): MensagemDoPainel => ({
    telefone,
    direccao,
    texto,
    criadoEm: new Date(quando),
  });

  const MENSAGENS_DO_PAINEL: MensagemDoPainel[] = [
    // Esta semana — A: chegou a pedido sozinha.
    m("351910000001", "2026-10-26T09:00:00Z", "in", "Quero tirar um sofá"),
    m("351910000001", "2026-10-26T09:30:00Z", "out", "Pedido #901 registado! Muito obrigada."),
    // B: chegou a pedido, mas a equipa respondeu à mão.
    m("351910000002", "2026-10-26T10:00:00Z", "in", "Preciso de esvaziar um T2"),
    m("351910000002", "2026-10-26T10:05:00Z", "out", "[à mão] Bom dia, já vejo isso."),
    m("351910000002", "2026-10-26T10:30:00Z", "out", "Pedido #902 registado! Muito obrigada."),
    // C: pergunta anotada e repetida, sem pedido.
    m("351910000003", "2026-10-27T08:00:00Z", "in", "Aceitam pagamento em cheque?"),
    m("351910000003", "2026-10-27T08:01:00Z", "out", "Boa pergunta! Deixo-a anotada para uma pessoa da CLYON lhe responder."),
    m("351910000003", "2026-10-27T09:00:00Z", "in", "Aceitam pagamento em cheque??"),
    // Domingo 25-10 às 23:30 UTC — ainda é domingo em Lisboa: semana anterior.
    m("351910000004", "2026-10-25T23:30:00Z", "in", "Quero uma mudança"),
    m("351910000004", "2026-10-25T23:40:00Z", "out", "Pedido #899 registado! Muito obrigada."),
    // Semana anterior: uma passagem a uma pessoa.
    m("351910000005", "2026-10-21T10:00:00Z", "in", "Quero falar com alguém"),
    m("351910000005", "2026-10-21T10:01:00Z", "out", "Com todo o gosto! Vou passar a conversa a uma pessoa da CLYON, que lhe responde por aqui assim que puder."),
  ];

  const LICOES = [
    { estado: "aprovada" as const, revistaEm: new Date("2026-10-26T15:00:00Z") },
    { estado: "corrigida" as const, revistaEm: new Date("2026-10-27T08:00:00Z") },
    { estado: "recusada" as const, revistaEm: new Date("2026-10-27T08:00:00Z") },
    { estado: "aprovada" as const, revistaEm: new Date("2026-10-20T08:00:00Z") },
  ];

  it("esta semana contra a anterior", () => {
    const p = painelDaSemana(MENSAGENS_DO_PAINEL, LICOES, new Date("2026-10-27T12:00:00Z"));
    expect(p.desde).toBe("2026-10-26");
    expect(p.actual).toEqual({
      conversas: 3,
      pedidosSemEquipa: 1,
      percentagem: 33,
      anotadas: 1,
      repetidas: 1,
      licoesAprovadas: 2,
    });
    expect(p.anterior).toEqual({
      conversas: 2,
      pedidosSemEquipa: 1,
      percentagem: 50,
      anotadas: 0,
      repetidas: 0,
      licoesAprovadas: 1,
    });
  });

  it("sem conversas, a percentagem fica vazia em vez de 0 %", () => {
    expect(numerosDaSemana([], [], new Date("2026-10-26T00:00:00Z"), new Date("2026-11-02T00:00:00Z")).percentagem).toBeNull();
  });
});

/* ── A voz de plataforma, nos ficheiros da Vitória ──────────────────────── */

/** O código sem os comentários — só as linhas que começam por comentário (regra ancorada). */
function semComentarios(codigo: string): string {
  return codigo
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join("\n");
}

const FICHEIROS_DA_VITORIA = [
  "src/lib/voz-da-vitoria.ts",
  "src/lib/whatsapp-recolha.ts",
  "src/lib/whatsapp-negociacao.ts",
  "src/lib/pedido-aberto-na-conversa.ts",
  "src/lib/perguntas-frequentes-da-vitoria.ts",
  "src/lib/aviso-de-data-ao-cliente.ts",
  "src/lib/cliente-a-perder-a-paciencia.ts",
  "src/lib/whatsapp-compreensao.ts",
  "src/lib/leitura-das-conversas.ts",
  "src/lib/whatsapp-imagem.ts",
  "src/lib/calendar-helpers.ts",
  "src/lib/prompt-do-orcamento.ts",
];

const VOZ_DE_EMPRESA = [
  /alguém da nossa equipa/i,
  /a nossa equipa (vai|está|trata)/i,
  /meus colegas/i,
  /vamos buscar/i,
  /\blevamos\b(?!\s*\?)/i,
  /empresa portuguesa de/i,
  /empresa de mudanças e serviços/i,
];

describe("a voz de plataforma nas frases da Vitória", () => {
  it.each(FICHEIROS_DA_VITORIA)("%s não fala como empresa que faz o trabalho", (f) => {
    const codigo = semComentarios(ler(f));
    for (const r of VOZ_DE_EMPRESA) {
      // «nós levamos» só é permitido no leitor, a ler o que o CLIENTE diz.
      expect(codigo, `${f}: ${r}`).not.toMatch(r);
    }
  });

  it("a apresentação diz que o pedido vai aos profissionais verificados, que dão o preço deles", () => {
    expect(O_QUE_ELA_FAZ).toBe(
      "Vou anotar o seu pedido e enviá-lo aos profissionais verificados da sua zona, que lhe respondem com o preço deles.",
    );
    expect(PERGUNTA_ANOTADA).toBe("Boa pergunta! Deixo-a anotada para uma pessoa da CLYON lhe responder.");
  });
});
