import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  dobrarLinha,
  eventoDoTrabalho,
  ficheiroIcs,
  ligacaoDoGoogle,
  podeIrParaAAgenda,
  textoIcs,
  type TrabalhoParaAAgenda,
} from "./evento-na-agenda-do-profissional";
import { diaMudouNaAgenda, TEXTOS_DA_AGENDA } from "./textos-da-agenda-do-profissional";
import {
  assinarLigacaoDaAgenda,
  assinarSessaoDoProfissional,
  verificarLigacaoDaAgenda,
  verificarSessaoDoProfissional,
} from "./profissional-auth";

/*
 * d144 (dono, 27-11-2026) — «Adicionar à minha agenda»: o trabalho vai para a
 * agenda DO PROFISSIONAL (Google Agenda e .ics), com a hora de Lisboa, só
 * depois de contratado, e com o «O dia mudou — actualize na sua agenda».
 * Dados de exemplo — nenhum é de ninguém.
 */

const raiz = path.resolve(__dirname, "../..");
const ler = (f: string) => readFileSync(path.join(raiz, f), "utf8").replace(/\r\n/g, "\n");

const exemplo: TrabalhoParaAAgenda = {
  negociacaoId: 4321,
  pedidoId: 987,
  serviceType: "mudanca",
  // Inverno: Lisboa = UTC.
  dataCombinada: "2026-12-01T09:00:00.000Z",
  duracaoMinutos: 180,
  morada: "Rua de Exemplo, 10, 1000-001 Lisboa",
  city: "Lisboa",
  moradaDestino: "Avenida de Teste, 5, 2700-001 Amadora",
  contactoNome: "Cliente Exemplo",
  contactoTelefone: "910 000 000",
  description: "Sofá; 3 caixas, e uma estante \\ grande\nCuidado com o vidro",
  floor: "3",
  hasElevator: "no",
  parkingDistance: "door",
  andarDestino: "0",
  elevadorDestino: "yes",
  estacionamentoDestino: "difficult",
};

describe("o evento do trabalho", () => {
  const e = eventoDoTrabalho(exemplo)!;

  it("título «CLYON #N · Serviço», morada completa e o fim previsto pela duração", () => {
    expect(e.titulo).toMatch(/^CLYON #987 · /);
    expect(e.titulo).not.toContain("mudanca");
    expect(e.local).toBe(exemplo.morada);
    expect(e.fim.getTime() - e.inicio.getTime()).toBe(180 * 60_000);
  });

  it("a descrição leva o cliente, o telefone, o que fazer, o acesso e a ligação do pedido", () => {
    for (const parte of [
      "Cliente: Cliente Exemplo",
      "Telefone: 910 000 000",
      "Destino: Avenida de Teste",
      "Sofá; 3 caixas",
      "3.º andar · sem elevador · estacionar à porta",
      "Acesso no destino: rés-do-chão · com elevador · estacionar longe da porta",
      "Duração prevista: 3 h",
      "https://clyon.pt/profissionais/painel?ecra=trabalhos&trabalho=4321",
    ]) {
      expect(e.descricao).toContain(parte);
    }
  });

  it("sem duração gravada, as duas horas do costume; sem dia, não há evento", () => {
    const sem = eventoDoTrabalho({ ...exemplo, duracaoMinutos: null })!;
    expect(sem.fim.getTime() - sem.inicio.getTime()).toBe(120 * 60_000);
    expect(eventoDoTrabalho({ ...exemplo, dataCombinada: null })).toBeNull();
  });
});

describe("o ficheiro .ics", () => {
  const agora = new Date("2026-11-27T10:00:00.000Z");
  const ics = ficheiroIcs(eventoDoTrabalho(exemplo)!, agora);
  const linhas = ics.split("\r\n");

  it("fuso Europe/Lisbon, com as regras da hora de Verão, e as horas no relógio de Lisboa", () => {
    expect(ics).toContain("BEGIN:VTIMEZONE\r\nTZID:Europe/Lisbon");
    expect(ics).toContain("RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU");
    expect(ics).toContain("RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU");
    expect(ics).toContain("DTSTART;TZID=Europe/Lisbon:20261201T090000");
    expect(ics).toContain("DTEND;TZID=Europe/Lisbon:20261201T120000");
    expect(ics).toContain("DTSTAMP:20261127T100000Z");
  });

  it("no Verão, 08:00 UTC são as 09:00 de Lisboa", () => {
    const verao = ficheiroIcs(eventoDoTrabalho({ ...exemplo, dataCombinada: "2026-07-01T08:00:00.000Z" })!, agora);
    expect(verao).toContain("DTSTART;TZID=Europe/Lisbon:20260701T090000");
  });

  it("um UID por trabalho: importar outra vez actualiza o evento (SEQUENCE maior)", () => {
    expect(ics).toContain("UID:clyon-trabalho-4321@clyon.pt");
    const depois = ficheiroIcs(eventoDoTrabalho(exemplo)!, new Date(agora.getTime() + 3_600_000));
    const seq = (t: string) => Number(/SEQUENCE:(\d+)/.exec(t)![1]);
    expect(seq(depois)).toBeGreaterThan(seq(ics));
  });

  it("escapes: barra, ponto e vírgula, vírgula e mudanças de linha", () => {
    expect(textoIcs("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
    const desdobrado = ics.replace(/\r\n /g, "");
    expect(desdobrado).toContain("Sofá\\; 3 caixas\\, e uma estante \\\\ grande\\nCuidado com o vidro");
    expect(desdobrado).toContain("LOCATION:Rua de Exemplo\\, 10\\, 1000-001 Lisboa");
  });

  it("linhas CRLF de no máximo 75 octetos, sem partir um carácter a meio", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    for (const l of linhas) expect(Buffer.byteLength(l, "utf8")).toBeLessThanOrEqual(75);
    const longa = dobrarLinha(`DESCRIPTION:${"ção".repeat(60)}`);
    for (const l of longa.split("\r\n")) expect(Buffer.byteLength(l, "utf8")).toBeLessThanOrEqual(75);
    expect(longa.replace(/\r\n /g, "")).toBe(`DESCRIPTION:${"ção".repeat(60)}`);
  });
});

describe("a ligação do Google Agenda", () => {
  const url = new URL(ligacaoDoGoogle(eventoDoTrabalho(exemplo)!));

  it("calendar.google.com, TEMPLATE, hora de Lisboa com ctz", () => {
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("ctz")).toBe("Europe/Lisbon");
    expect(url.searchParams.get("dates")).toBe("20261201T090000/20261201T120000");
    expect(url.searchParams.get("text")).toMatch(/^CLYON #987 · /);
    expect(url.searchParams.get("location")).toBe(exemplo.morada);
    expect(url.searchParams.get("details")).toContain("Telefone: 910 000 000");
  });

  it("uma descrição enorme corta-se, mas a ligação do pedido fica", () => {
    const longo = ligacaoDoGoogle(eventoDoTrabalho({ ...exemplo, description: "x".repeat(5000) })!);
    const d = new URL(longo).searchParams.get("details")!;
    expect(d.length).toBeLessThanOrEqual(1500);
    expect(d).toContain("trabalho=4321");
  });
});

describe("só depois de contratado, por fazer e com o dia marcado", () => {
  const base = { estado: "acordada", fase: "a_executar" as const, arquivadoEm: null, dataCombinada: "2026-12-01T09:00:00Z" };
  it.each([
    ["aberta (ainda não contratado)", { estado: "aberta", fase: "a_negociar" as const }],
    ["à espera da contratação", { estado: "aguarda_contratacao", fase: "a_negociar" as const }],
    ["já marcado como feito", { fase: "a_confirmar" as const }],
    ["confirmado", { fase: "confirmado" as const }],
    ["pago", { fase: "pago" as const }],
    ["arquivado", { arquivadoEm: "2026-11-20T10:00:00Z" }],
    ["sem dia marcado", { dataCombinada: null }],
  ])("não: %s", (_n, mudar) => {
    expect(podeIrParaAAgenda({ ...base, ...mudar })).toBe(false);
  });
  it("sim: contratado, por fazer, com o dia", () => expect(podeIrParaAAgenda(base)).toBe(true));
});

describe("«O dia mudou — atualize na sua agenda»", () => {
  it("só quando o dia de agora é outro que o posto na agenda", () => {
    expect(diaMudouNaAgenda("2026-12-01T09:00:00.000Z", null)).toBe(false);
    expect(diaMudouNaAgenda(null, "2026-12-01T09:00:00.000Z")).toBe(false);
    expect(diaMudouNaAgenda("2026-12-01T09:00:00.000Z", new Date("2026-12-01T09:00:00Z"))).toBe(false);
    // A base devolve sem fuso, em UTC.
    expect(diaMudouNaAgenda("2026-12-01T09:00:00.000Z", "2026-12-01 09:00:00")).toBe(false);
    expect(diaMudouNaAgenda("2026-12-02T09:00:00.000Z", "2026-12-01 09:00:00")).toBe(true);
    expect(TEXTOS_DA_AGENDA.diaMudou).toBe("O dia mudou — atualize na sua agenda.");
  });
});

describe("a ligação assinada do .ics", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "segredo-so-dos-testes-da-agenda-d144";
  });

  it("serve para um trabalho só, e não é uma sessão", async () => {
    const t = await assinarLigacaoDaAgenda(7, 4321);
    expect((await verificarLigacaoDaAgenda(t, 4321))?.providerId).toBe(7);
    expect(await verificarLigacaoDaAgenda(t, 4322)).toBeNull();
    expect(await verificarSessaoDoProfissional(t)).toBeNull();
    // E uma sessão não serve de ligação.
    const sessao = await assinarSessaoDoProfissional(7, "Exemplo");
    expect(await verificarLigacaoDaAgenda(sessao, 4321)).toBeNull();
  });
});

describe("as rotas, o painel e a app", () => {
  const post = ler("src/app/api/profissionais/pedidos/[id]/agenda/route.ts");
  const ics = ler("src/app/api/profissionais/pedidos/[id]/agenda.ics/route.ts");
  const servidor = ler("src/lib/agenda-do-profissional-no-servidor.ts");

  it("o POST pede a sessão, guarda o dia e devolve as duas ligações", () => {
    expect(post).toContain("sessaoActivaDoProfissional(tokenDoProfissional(req))");
    expect(post).toContain("status: 401");
    expect(post).toContain("marcarAgendaAdicionada(");
    expect(post).toContain("assinarLigacaoDaAgenda(sessao.providerId, negociacaoId)");
  });

  it("o .ics abre com a sessão ou com a ligação assinada, text/calendar e sem cache", () => {
    expect(ics).toContain("profissionalDaLigacaoDaAgenda(assinatura, negociacaoId)");
    expect(ics).toContain("sessaoActivaDoProfissional(tokenDoProfissional(req))");
    expect(ics).toContain('"Content-Type": "text/calendar; charset=utf-8"');
    expect(ics).toContain("no-store");
  });

  it("o trabalho é lido pelo providerId e passa pela vista do contratado e pela regra", () => {
    expect(servidor).toContain("negociacoesDoProfissional(providerId)");
    expect(servidor).toContain("vistaParaOEstado(");
    expect(servidor).toContain("podeIrParaAAgenda(");
    expect(servidor).toContain("WHERE id = ? AND providerId = ?");
  });

  it("o painel e a app usam a rota, sem data: URI, e a app abre pelo Linking", () => {
    const painel = ler("src/app/profissionais/painel/AdicionarAAgenda.tsx");
    const app = ler("app-pro/src/componentes/AdicionarAAgenda.tsx");
    for (const f of [painel, app]) {
      expect(f).toContain("/api/profissionais/pedidos/${");
      expect(f).toContain("TEXTOS_DA_AGENDA.diaMudou");
      expect(f).not.toMatch(/data:text\/calendar/);
    }
    expect(app).toContain("Linking.openURL(");
    expect(ler("app-pro/src/componentes/TrabalhoContratado.tsx")).toContain("<AdicionarAAgenda t={t} />");
    expect(ler("src/app/profissionais/painel/Trabalhos.tsx")).toContain("<AdicionarAAgenda");
    expect(ler("src/app/api/profissionais/meus-pedidos/route.ts")).toContain("agendaDiaMudou: diaMudouNaAgenda(");
    expect(ler("src/lib/db.ts")).toContain("ALTER TABLE negociacoes ADD COLUMN agendaAdicionadaPara DATETIME NULL DEFAULT NULL");
  });
});
