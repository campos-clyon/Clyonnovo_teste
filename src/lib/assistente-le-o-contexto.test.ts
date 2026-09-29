import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eAUltimaDaRajada, textoDaRajada, type MensagemComId } from "./rajada-do-whatsapp";
import { interpretarQuando, perguntaDo } from "./whatsapp-recolha";
import { lerQuantidadeDeEntulho } from "./sacos-de-entulho";
import { estaAPerderAPaciencia } from "./cliente-a-perder-a-paciencia";
import { aceitar, contratar, type Negociacao } from "./negociacao";

/**
 * *«Quero que corrija esse assistente para ser mais assertivo, inteligente, e
 * saiba o contexto da conversa, não repita pergunta e saiba interpretar
 * diferentes contextos.»* — 29-09-2026, com dezasseis capturas de ecrã.
 *
 * Cada bloco abaixo é UMA das conversas dessas capturas, com as frases tal e
 * qual foram escritas. Se algum destes erros voltar, é por aqui que se sabe.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** O que o relógio de Lisboa marca, seja onde for que o teste corra. */
function emLisboa(d: Date | null | undefined) {
  if (!d) return null;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Lisbon",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { dia: Number(p.day), hora: Number(p.hour), minuto: Number(p.minute) };
}

// ─── A Ana: cinco mensagens num minuto ──────────────────────────────────────

describe("a rajada — quem escreve em cinco mensagens disse uma coisa", () => {
  const ana: MensagemComId[] = [
    { id: 1, direccao: "in", texto: "Olá! Falámos agora mesmo. O meu nome é Ana Ferreira e aqui estão as fotos" },
    { id: 2, direccao: "in", texto: "[fotografia]" },
    { id: 3, direccao: "in", texto: "[fotografia]" },
    { id: 4, direccao: "in", texto: "E esta escada da cama" },
    { id: 5, direccao: "in", texto: "Rua Cidade da Horta, 26. 4o andar. Lisboa. Sem elevador" },
    { id: 6, direccao: "in", texto: "Sofá e estrutura de cama desmontada" },
  ];

  it("só a última responde — as outras calam-se", () => {
    expect(eAUltimaDaRajada(6, ana)).toBe(true);
    for (const id of [1, 4, 5]) expect(eAUltimaDaRajada(id, ana), `#${id}`).toBe(false);
  });

  it("e lê tudo junto, sem as fotografias", () => {
    const junto = textoDaRajada(ana);
    expect(junto).toContain("O meu nome é Ana Ferreira");
    expect(junto).toContain("Rua Cidade da Horta, 26. 4o andar");
    expect(junto).toContain("Sofá e estrutura de cama desmontada");
    expect(junto).not.toContain("[fotografia]");
  });

  /*
   * ⚠️ UMA FOTOGRAFIA SEM LEGENDA NÃO É «MAIS NOVA». Não põe o assistente a
   * correr — só a guarda no pedido. Se contasse, o texto que chegou antes
   * dela calava-se à espera de uma resposta que ninguém ia dar.
   */
  it("uma fotografia que chega depois não cala o texto", () => {
    const comFotoNoFim = [...ana, { id: 7, direccao: "in", texto: "[fotografia]" }];
    expect(eAUltimaDaRajada(6, comFotoNoFim)).toBe(true);
  });

  it("«Lisboa» e «1000-102», em duas mensagens, lêem-se juntos", () => {
    const fio: MensagemComId[] = [
      { id: 10, direccao: "out", texto: "E o código postal, com a localidade?" },
      { id: 11, direccao: "in", texto: "Lisboa" },
      { id: 12, direccao: "in", texto: "1000-102" },
    ];
    expect(textoDaRajada(fio)).toBe("Lisboa\n1000-102");
  });

  it("só o que chegou DEPOIS da nossa última resposta", () => {
    const fio: MensagemComId[] = [
      { id: 1, direccao: "in", texto: "já respondido" },
      { id: 2, direccao: "out", texto: "Com quem estou a falar?" },
      { id: 3, direccao: "in", texto: "Ana Ferreira" },
    ];
    expect(textoDaRajada(fio)).toBe("Ana Ferreira");
  });

  it("nada novo é nada — outra execução já respondeu enquanto esta esperava", () => {
    expect(textoDaRajada([{ id: 1, direccao: "in", texto: "x" }, { id: 2, direccao: "out", texto: "y" }])).toBe("");
  });
});

describe("a rota da ponte espera, cede e tranca — por esta ordem", () => {
  const ROTA = semComentarios(ler("src/app/api/whatsapp/ponte/route.ts"));
  const corpo = ROTA.slice(ROTA.indexOf("async function responderARajada"));

  it("espera, depois vê se é a última, depois tranca", () => {
    const espera = corpo.indexOf("JANELA_DA_RAJADA_MS)");
    const cede = corpo.indexOf("eAUltimaDaRajada(");
    const tranca = corpo.indexOf("comTrancaDoNumeroWhatsApp(");
    expect(espera).toBeGreaterThan(-1);
    expect(espera).toBeLessThan(cede);
    expect(cede).toBeLessThan(tranca);
  });

  it("relê DENTRO da tranca — o que já teve resposta não se responde outra vez", () => {
    const dentro = corpo.slice(corpo.indexOf("comTrancaDoNumeroWhatsApp("));
    expect(dentro).toContain("textoDaRajada(");
  });

  it("as duas entradas de texto passam pela rajada", () => {
    expect(ROTA.match(/responderARajada\(telefone, id, texto\)/g)?.length).toBe(2);
    expect(ROTA).not.toMatch(/tratarMensagemDoCliente\(telefone, \{ tipo: "texto", texto \}\);\s*\n\s*\}\s*else/);
  });

  it("tem tempo para acabar mesmo que a ponte desista de esperar", () => {
    expect(ROTA).toContain("export const maxDuration = 60");
  });
});

// ─── A Ana outra vez: o nome que se perdeu ──────────────────────────────────

describe("o que já disse não se deita fora", () => {
  it("a primeira pergunta usa o nome quando ela o disse", () => {
    const p = perguntaDo("servico", { contactName: "Ana Ferreira" }, false);
    expect(p).toMatch(/, Ana! Aqui é a CLYON/);
  });

  it("sem serviço ainda, grava-se o que se percebeu — e não um objecto vazio", () => {
    const NEG = semComentarios(ler("src/lib/whatsapp-negociacao.ts"));
    expect(NEG).not.toContain('guardarRecolhaWhatsApp(telefone, "servico", {})');
    expect(NEG).toContain('guardarRecolhaWhatsApp(telefone, "servico", sabido)');
  });
});

// ─── A Catarina: «não é urgente» e «4m3» ────────────────────────────────────

describe("«não é urgente» não é «urgente»", () => {
  // Terça, 29-09-2026, 12:11 em Lisboa — a hora a que ela o escreveu.
  const AGORA = new Date("2026-09-29T12:11:00+01:00");

  it("o caso dela, tal e qual: esta semana, sem data nem hora inventadas", () => {
    const r = interpretarQuando("preferencialmente esta semana\nmas nao é urgente", AGORA);
    expect(r.data).toBeNull();
    expect(r.urgency).toBe("this_week");
  });

  it("e as outras maneiras de dizer o mesmo", () => {
    for (const f of ["não é urgente", "nada urgente", "sem urgência", "não há pressa", "não tenho pressa"]) {
      const r = interpretarQuando(f, AGORA);
      expect(r.data, f).toBeNull();
      expect(r.urgency, f).not.toBe("today");
    }
  });

  it("«urgente» sem «não» continua a ser hoje", () => {
    expect(interpretarQuando("é urgente", AGORA).urgency).toBe("today");
  });
});

describe("as horas são as de Lisboa, e não as do servidor", () => {
  /*
   * A Vercel corre em UTC. «Amanhã às 9» saía às 9 de Londres — 10 em Lisboa
   * no Verão. Estes testes passam em qualquer fuso, porque verificam o
   * relógio de Lisboa e não o da máquina.
   */
  const AGORA = new Date("2026-09-29T12:11:00+01:00");

  it("«amanhã às 9» é às 9 em Lisboa", () => {
    const r = interpretarQuando("amanhã às 9h", AGORA);
    expect(emLisboa(r.data)).toEqual({ dia: 30, hora: 9, minuto: 0 });
  });

  it("«hoje», sem hora, é daqui a uma hora EM LISBOA", () => {
    expect(emLisboa(interpretarQuando("hoje", AGORA).data)?.hora).toBe(13);
  });

  it("e no Inverno também — a mudança da hora é de Lisboa, não nossa", () => {
    const inverno = new Date("2026-12-10T10:00:00Z");
    expect(emLisboa(interpretarQuando("amanhã às 9h", inverno).data)).toEqual({ dia: 11, hora: 9, minuto: 0 });
  });
});

describe("«4m3» são metros cúbicos, e não 43 sacos", () => {
  it("o caso dela, tal e qual", () => {
    const r = lerQuantidadeDeEntulho("diria que 4m3 mas sem certeza");
    expect(r.sacos).toBe(160);
    expect(r.emMetrosCubicos).toBe(true);
    expect(r.dito).toBe("diria que 4m3 mas sem certeza");
  });

  it("todas as maneiras de escrever metros cúbicos", () => {
    for (const f of ["4m3", "4 m3", "4m³", "4 metros cúbicos", "4 m cubicos"]) {
      expect(lerQuantidadeDeEntulho(f).sacos, f).toBe(160);
    }
    expect(lerQuantidadeDeEntulho("2,5 m3").sacos).toBe(100);
  });

  it("sacos continuam a ser sacos", () => {
    expect(lerQuantidadeDeEntulho("30 sacos").sacos).toBe(30);
    expect(lerQuantidadeDeEntulho("30").sacos).toBe(30);
    expect(lerQuantidadeDeEntulho("30 sacos").emMetrosCubicos).toBe(false);
  });

  it("um intervalo conta pelo maior", () => {
    expect(lerQuantidadeDeEntulho("20 a 30 sacos").sacos).toBe(30);
  });

  it("sem número não se inventa quantidade", () => {
    expect(lerQuantidadeDeEntulho("não sei").sacos).toBeNull();
    expect(lerQuantidadeDeEntulho("uma carrinha cheia").sacos).toBeNull();
    expect(lerQuantidadeDeEntulho(null).sacos).toBeNull();
  });

  it("o formulário usa a leitura nova, e não tira só os dígitos", () => {
    const C = semComentarios(ler("src/lib/campos-do-servico.ts"));
    expect(C).toContain("lerQuantidadeDeEntulho(");
    expect(C).not.toContain('replace(/[^\\d]/g, "")');
  });

  it("e o profissional vê o que o cliente disse ao lado da conta", () => {
    const T = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(T).toContain("o cliente disse «{pedido.entulhoQuantidadeDita}»");
  });
});

// ─── A Ema: «Aceitar 60€» cinco vezes ───────────────────────────────────────

describe("aceitar pelo WhatsApp fecha mesmo", () => {
  const agora = new Date("2026-09-29T12:08:00Z");
  const comProposta: Negociacao = {
    estado: "aberta",
    valorAcordado: null,
    propostas: [
      { por: "profissional", valor: 60, estado: "pendente", criadaEm: "2026-09-28T19:30:00Z" },
    ],
  } as unknown as Negociacao;

  /*
   * O porquê do erro, provado no motor: aceitar do lado do cliente JÁ FECHA,
   * e contratar por cima de um fecho não tem acção disponível — é daí que
   * vinha «Não há nada para contratar».
   */
  it("aceitar do lado do cliente fecha logo, e contratar por cima falha", () => {
    const r = aceitar(comProposta, "cliente", agora);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.negociacao.estado).toBe("acordada");
    expect(contratar(r.negociacao, agora).ok).toBe(false);
  });

  it("por isso o WhatsApp só contrata quando ainda não está fechado", () => {
    const NEG = semComentarios(ler("src/lib/whatsapp-negociacao.ts"));
    const i = NEG.indexOf("async function fecharPeloCliente");
    const corpo = NEG.slice(i, NEG.indexOf("async function recusarUmaNaBase", i));
    expect(corpo).toContain('if (estado.estado !== "acordada")');
    const guarda = corpo.indexOf('if (estado.estado !== "acordada")');
    expect(guarda).toBeLessThan(corpo.indexOf("contratar(estado, agora)"));
  });
});

// ─── A Lourdes: «ainda sem valores» quatro minutos depois de uma proposta ──

describe("o que lhe dissemos e já não está de pé diz-se", () => {
  const NEG = semComentarios(ler("src/lib/whatsapp-negociacao.ts"));

  it("as propostas retiradas entram no ponto de situação", () => {
    expect(NEG).toContain("function avisoDasRetiradas(");
    const i = NEG.indexOf("async function ecraDoPedido");
    const corpo = NEG.slice(i, NEG.indexOf("function avisoDasRetiradas", i));
    // Nos dois caminhos: sem nada vivo, e com a mesa.
    expect(corpo.match(/avisoDasRetiradas\(linhas\)/g)?.length).toBe(2);
  });

  it("e a frase não acusa ninguém — não se sabe quem a fechou", () => {
    expect(NEG).toContain("já não está disponível.");
    expect(NEG).not.toContain("retirada pelo profissional");
  });
});

// ─── O Afonso: «vou ter de avançar com outra empresa» ───────────────────────

describe("quem está a perder a paciência vai para uma pessoa", () => {
  it("o caso dele, tal e qual", () => {
    expect(
      estaAPerderAPaciencia(
        "Tentei lhe ligar várias vezes, se tiverem ocupados vou ter de avançar com outra empresa",
      ),
    ).toBe(true);
  });

  it("e as maneiras parecidas de o dizer", () => {
    for (const f of [
      "já liguei e ninguém atende",
      "Liguei várias vezes",
      "não me respondem",
      "vamos procurar outra empresa",
      "vou avançar com outros",
    ]) {
      expect(estaAPerderAPaciencia(f), f).toBe(true);
    }
  });

  /*
   * «Urgente» sozinho não conta: muita gente o escreve num pedido normal, e o
   * assistente sabe tratar de um pedido urgente. Passar todos a uma pessoa
   * ensinava a equipa a ignorar a etiqueta.
   */
  it("um pedido normal, mesmo urgente, não conta", () => {
    for (const f of [
      "Nos temos muito entulho que precisa de sair hoje urgentemente",
      "É urgente",
      "Olá, queria um orçamento",
      "Tentei o formulário mas preferi escrever",
    ]) {
      expect(estaAPerderAPaciencia(f), f).toBe(false);
    }
  });

  it("vem antes de tudo o resto na conversa", () => {
    const NEG = semComentarios(ler("src/lib/whatsapp-negociacao.ts"));
    const i = NEG.indexOf("export async function tratarMensagemDoCliente");
    const corpo = NEG.slice(i);
    expect(corpo.indexOf("estaAPerderAPaciencia(")).toBeGreaterThan(-1);
    expect(corpo.indexOf("estaAPerderAPaciencia(")).toBeLessThan(corpo.indexOf("pedidosDoTelefone("));
  });
});
