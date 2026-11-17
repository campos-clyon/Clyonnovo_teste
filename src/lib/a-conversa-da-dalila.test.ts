import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  faltaARua,
  HORAS_PARA_A_RUA,
  lerARua,
  motivoDaRuaSemResposta,
  oQueFazerComARua,
  perguntaDaRua,
  ruaAnotada,
  ruaJaDitaNaConversa,
  type EstadoDaRuaDoPedido,
} from "./rua-depois-do-aceite";
import { linhaDaRuaNaMesa } from "./rua-na-mesa";
import {
  jaRecebeuACandidatura,
  linkDaCandidatura,
  MOTIVO_DO_CANDIDATO,
  querSerParceiro,
  respostaAoCandidato,
  zonaDoCandidato,
} from "./candidato-a-parceiro";
import { naMesa, type FactosDaConversa } from "./mesa-das-conversas";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";

/**
 * A CONVERSA DA DALILA — 17-11-2026 (decisão d69).
 *
 * A Dalila pediu pelo WhatsApp a recolha de um sofá em Oeiras e, à pergunta da
 * morada, disse só a zona («Oeiras») — a Vitória registou o pedido #812 com a
 * zona e prometeu «a morada certa fica para quando aceitar uma proposta». Ela
 * aceitou a proposta, e nada lhe pediu a rua: o parceiro contratado ficava só
 * com a terra. E no mesmo dia escreveram três pessoas a querer ser parceiro,
 * motorista ou ajudante, que ficaram na fila dos clientes à espera de uma
 * pessoa.
 *
 * A pessoa, o número do pedido, a rua e o número da porta são INVENTADOS
 * (repositório público); a localidade fica. O dia é 17-11-2026 às 15h de Lisboa.
 */

const AGORA = new Date("2026-11-17T15:00:00Z");
const ACEITE = new Date("2026-11-17T14:00:00Z");
const PEDIDO = 812;

const ANTES: EstadoDaRuaDoPedido = {
  pedidoId: PEDIDO,
  aceiteEm: null,
  ruaPedidaEm: null,
  ruaRecebidaEm: null,
  ruaPassadaEm: null,
  podeFalar: true,
  trabalhoClyon: false,
  ruaNaConversa: null,
};

describe("o pedido só com a zona fica «falta a rua»", () => {
  it("a localidade sozinha, a rua por confirmar ou nada — falta a rua", () => {
    expect(faltaARua("Oeiras (rua por confirmar)")).toBe(true);
    expect(faltaARua("Rua por confirmar")).toBe(true);
    expect(faltaARua("")).toBe(true);
    expect(faltaARua(null)).toBe(true);
    expect(faltaARua("Oeiras")).toBe(true);
  });

  it("com a rua e o número, não falta", () => {
    expect(faltaARua("Rua das Gaivotas Mansas 3")).toBe(false);
    expect(faltaARua("Travessa dos Melros Azuis, 9")).toBe(false);
  });

  it("o cartão da Mesa diz em que pé está", () => {
    expect(linhaDaRuaNaMesa({ aceite: false, pedidaEm: null, passadaEm: null })).toMatch(/^Falta a rua — pede-se ao cliente quando aceitar/);
    expect(linhaDaRuaNaMesa({ aceite: true, pedidaEm: AGORA.toISOString(), passadaEm: null })).toMatch(/a Vitória já a pediu/);
    expect(linhaDaRuaNaMesa({ aceite: true, pedidaEm: AGORA.toISOString(), passadaEm: AGORA.toISOString() })).toMatch(/não respondeu/);
  });
});

describe("depois do aceite, a Vitória pede a rua — uma vez só", () => {
  it("antes de aceitar, nada", () => {
    expect(oQueFazerComARua(ANTES, false, AGORA)).toBeNull();
  });

  it("aceitou: pede a rua, o número da porta e o andar, com o número do pedido", () => {
    const d = oQueFazerComARua({ ...ANTES, aceiteEm: ACEITE }, false, AGORA);
    expect(d).toEqual({ tipo: "pedir", pergunta: perguntaDaRua(PEDIDO, false) });
    expect(perguntaDaRua(PEDIDO, false)).toBe(
      "Falta-me só a morada certa do pedido #812: a rua, o número da porta e o andar, por favor. É o que o parceiro recebe para chegar até si.",
    );
  });

  it("com o andar já no pedido, só a rua e o número", () => {
    expect(perguntaDaRua(PEDIDO, true)).toContain("a rua e o número da porta, por favor");
    expect(perguntaDaRua(PEDIDO, true)).not.toContain("andar");
  });

  it("já pedida: não pergunta outra vez (nem uma hora depois)", () => {
    const pedida = { ...ANTES, aceiteEm: ACEITE, ruaPedidaEm: new Date(AGORA.getTime() - 60 * 60_000) };
    expect(oQueFazerComARua(pedida, false, AGORA)).toBeNull();
  });

  it("relê a conversa antes de perguntar: se ela já escreveu a rua, grava-a sem perguntar", () => {
    const fio = [
      { direccao: "out", texto: "O seu pedido #812 ficou registado.", haSegundos: 7200 },
      { direccao: "in", texto: "Obrigada! A morada é Rua das Gaivotas Mansas 3, 2º Dto", haSegundos: 5400 },
    ];
    const rua = ruaJaDitaNaConversa(fio, new Date(AGORA.getTime() - 7300_000), AGORA);
    expect(rua?.morada).toBe("Rua das Gaivotas Mansas 3");
    const d = oQueFazerComARua({ ...ANTES, aceiteEm: ACEITE, ruaNaConversa: rua }, false, AGORA);
    expect(d?.tipo).toBe("gravar");
  });

  it("o que ela disse ANTES do registo não conta (era a recolha)", () => {
    const fio = [{ direccao: "in", texto: "Rua das Gaivotas Mansas 3", haSegundos: 90_000 }];
    expect(ruaJaDitaNaConversa(fio, new Date(AGORA.getTime() - 3600_000), AGORA)).toBeNull();
  });

  it("aceites de antes da d69 não levam a pergunta", () => {
    expect(oQueFazerComARua({ ...ANTES, aceiteEm: new Date("2026-11-10T10:00:00Z") }, false, AGORA)).toBeNull();
  });

  it("um trabalho CLYON, ou a conversa já com a equipa: passa à equipa sem mensagem e sem mexer na entrega", () => {
    const clyon = oQueFazerComARua({ ...ANTES, aceiteEm: ACEITE, trabalhoClyon: true }, false, AGORA);
    expect(clyon).toMatchObject({ tipo: "passar", interromper: false });
    const entregue = oQueFazerComARua({ ...ANTES, aceiteEm: ACEITE, podeFalar: false }, false, AGORA);
    expect(entregue).toMatchObject({ tipo: "passar", interromper: false });
  });
});

describe("a resposta entra no pedido", () => {
  it("«Rua das Gaivotas Mansas 3, 2º Dto» — a rua, o número e o andar com o lado", () => {
    const r = lerARua("Rua das Gaivotas Mansas 3, 2º Dto");
    expect(r).toMatchObject({ morada: "Rua das Gaivotas Mansas 3", andar: "2º Dto" });
  });

  it("o andar na linha de baixo também conta", () => {
    const r = lerARua("Rua das Gaivotas Mansas 3\n2º esq");
    expect(r?.morada).toBe("Rua das Gaivotas Mansas 3");
    expect(r?.andar).toMatch(/^2º Esq/i);
  });

  it("com o código postal, fica também", () => {
    const r = lerARua("Travessa dos Melros Azuis 9, 2780-000 Oeiras");
    expect(r?.morada).toBe("Travessa dos Melros Azuis 9");
    expect(r?.codigoPostal).toBe("2780-000");
  });

  it("o que não é uma morada não se grava — a conversa segue", () => {
    for (const t of ["ok", "Obrigada", "Amanhã às 10h", "Qual é o parceiro?", "Sim", "Oeiras"]) expect(lerARua(t), t).toBeNull();
  });

  it("e agradece com o que ficou", () => {
    expect(ruaAnotada(PEDIDO, "Rua das Gaivotas Mansas 3, 2º Dto")).toBe(
      "Obrigada! Fica anotado no pedido #812: Rua das Gaivotas Mansas 3, 2º Dto. O parceiro recebe-a com o trabalho.",
    );
  });
});

describe(`sem resposta em ${HORAS_PARA_A_RUA} h, passa à equipa`, () => {
  const pedida = { ...ANTES, aceiteEm: ACEITE, ruaPedidaEm: new Date(AGORA.getTime() - HORAS_PARA_A_RUA * 3600_000) };

  it("às 2 h: passa, com o motivo na Mesa das conversas", () => {
    expect(oQueFazerComARua(pedida, false, AGORA)).toEqual({ tipo: "passar", motivo: motivoDaRuaSemResposta(PEDIDO), interromper: true });
    expect(motivoDaRuaSemResposta(PEDIDO)).toMatch(/^Falta a rua do pedido #812 — o cliente aceitou e não respondeu em 2 h/);
  });

  it("uma vez só; e com a rua recebida, nada", () => {
    expect(oQueFazerComARua({ ...pedida, ruaPassadaEm: AGORA }, false, AGORA)).toBeNull();
    expect(oQueFazerComARua({ ...pedida, ruaRecebidaEm: AGORA }, false, AGORA)).toBeNull();
  });

  it("aos 119 minutos ainda não", () => {
    expect(oQueFazerComARua({ ...pedida, ruaPedidaEm: new Date(AGORA.getTime() - 119 * 60_000) }, false, AGORA)).toBeNull();
  });
});

describe("quem quer ser parceiro, motorista ou ajudante recebe o caminho da candidatura", () => {
  const CANDIDATOS = [
    "Boa tarde, gostaria de trabalhar convosco, tenho carrinha",
    "Olá, quero ser parceiro da CLYON",
    "Boa noite. Estão a contratar motoristas?",
    "Procuro trabalho como ajudante",
    "Gostava de me candidatar como motorista",
    "Tenho uma carrinha e queria colaborar com vocês nos serviços",
    "Hello, I would like to work with you as a driver",
    "Are you hiring?",
  ];
  const CLIENTES = [
    "Preciso de um ajudante para carregar um sofá",
    "Quanto custa a recolha de um frigorífico?",
    "Queria um orçamento para uma mudança",
    "Tenho uma carrinha cheia de entulho para levar",
    "Bom dia",
    "Sim",
  ];

  it("os candidatos são lidos como candidatos", () => {
    for (const t of CANDIDATOS) expect(querSerParceiro(t), t).toBe(true);
  });

  it("os clientes não", () => {
    for (const t of CLIENTES) expect(querSerParceiro(t), t).toBe(false);
  });

  it("a página de candidatura, com a zona quando se sabe, e as fotografias da carrinha obrigatórias", () => {
    expect(zonaDoCandidato(["Gostaria de trabalhar convosco, sou de Almada"])).toBe("almada");
    expect(zonaDoCandidato(["quero ser parceiro"])).toBeNull();
    const r = respostaAoCandidato("almada");
    expect(r).toContain("https://clyon.pt/quero-ser-parceiro?zona=almada");
    expect(r).toMatch(/fotografias da carrinha, que são obrigatórias/);
    expect(r).not.toMatch(/entulho/i);
    expect(linkDaCandidatura(null)).toBe("https://clyon.pt/quero-ser-parceiro");
  });

  it("sai da fila dos clientes por responder: a conversa fica resolvida, fechada pela Vitória", () => {
    const factos: FactosDaConversa = {
      telefone: "000000000",
      ultimaEntrada: { id: 1, texto: CANDIDATOS[0], haSegundos: 120, quando: AGORA.toISOString() } as FactosDaConversa["ultimaEntrada"],
      ultimaSaida: { id: 2, texto: respostaAoCandidato(null), haSegundos: 90, quando: AGORA.toISOString() } as FactosDaConversa["ultimaSaida"],
      bloqueada: false,
      entregue: false,
      fecho: { haSegundos: 60, quando: AGORA.toISOString(), motivo: MOTIVO_DO_CANDIDATO, porQuem: "vitoria" },
      recolha: null,
      pedidoVivo: null,
      ultimoPedido: null,
      guardada: null,
    };
    const linha = naMesa(factos);
    expect(linha.estado).toBe("resolvida");
    expect(linha.porque).toContain("Candidato a parceiro");
  });

  it("uma vez: quem já recebeu o link não o recebe outra vez", () => {
    expect(jaRecebeuACandidatura([{ direccao: "out", texto: respostaAoCandidato(null) }])).toBe(true);
    expect(jaRecebeuACandidatura([{ direccao: "in", texto: "https://clyon.pt/quero-ser-parceiro" }])).toBe(false);
  });
});

describe("as frases novas têm tradução fixa", () => {
  const FRASES = [
    perguntaDaRua(PEDIDO, false),
    perguntaDaRua(PEDIDO, true),
    ruaAnotada(PEDIDO, "Rua das Gaivotas Mansas 3, 2º Dto"),
    respostaAoCandidato("almada"),
    respostaAoCandidato(null),
  ];
  for (const lingua of ["en", "fr", "es"] as const) {
    it(`em ${lingua}`, () => {
      for (const f of FRASES) expect(traducaoFixa(f, lingua), f).not.toBeNull();
    });
  }
  it("o que é dela (a morada) e o link passam tal e qual", () => {
    expect(traducaoFixa(ruaAnotada(PEDIDO, "Rua das Gaivotas Mansas 3"), "en")).toContain("Rua das Gaivotas Mansas 3");
    expect(traducaoFixa(respostaAoCandidato("almada"), "en")).toContain("https://clyon.pt/quero-ser-parceiro?zona=almada");
  });
});

describe("as peças estão ligadas", () => {
  const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

  it("o registo marca a falta da rua", () => {
    expect(ler("src/lib/registar-pedido-por-whatsapp.ts")).toContain("marcarSeFaltarARua(id, address)");
  });

  it("o fecho pelo WhatsApp e o valor único pedem a rua depois do aceite", () => {
    const n = ler("src/lib/whatsapp-negociacao.ts");
    expect(n.match(/pedirARuaDepoisDoAceite\(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(n).toContain("O parceiro recebeu a zona e o seu contacto.");
  });

  it("a resposta lê-se no cérebro e, com a conversa entregue, na ponte (em silêncio)", () => {
    expect(ler("src/lib/whatsapp-negociacao.ts")).toContain("lerARespostaDaRua(telefone, conteudo.texto)");
    expect(ler("src/app/api/whatsapp/ponte/route.ts")).toContain("lerARespostaDaRua(telefone, texto)");
  });

  it("a passagem de 10 em 10 minutos pergunta aos outros aceites e passa à equipa às 2 h", () => {
    expect(ler("src/app/api/cron/assistente/route.ts")).toContain("correrARuaDepoisDoAceite()");
  });

  it("o candidato é encaminhado antes da recolha e a conversa fecha-se", () => {
    const n = ler("src/lib/whatsapp-negociacao.ts");
    const i = n.indexOf("cand.querSerParceiro(texto)");
    expect(i).toBeGreaterThan(0);
    expect(n.indexOf("arquivarConversaWhatsApp(telefone, true, { motivo: cand.MOTIVO_DO_CANDIDATO", i)).toBeGreaterThan(i);
    // Antes da recolha de um pedido novo.
    const chamada = n.indexOf("await aoCandidato(telefone, conteudo.texto)");
    expect(chamada).toBeGreaterThan(0);
    expect(n.indexOf("await recolherPedidoPorWhatsApp(telefone, conteudo.texto, conteudo.imagens, conteudo.visto);", chamada)).toBeGreaterThan(chamada);
  });

  it("o selo na Mesa e a contagem no Início", () => {
    expect(ler("src/app/api/admin/negociacoes/route.ts")).toContain("faltaARua: semRua.get(Number(p.id))");
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain("linhaDaRuaNaMesa(p.faltaARua)");
    expect(ler("src/components/admin/AdminInicioPanel.tsx")).toContain('titulo: "aceites sem rua"');
    expect(ler("src/lib/db.ts")).toContain("contarAceitesSemRua()");
  });
});
