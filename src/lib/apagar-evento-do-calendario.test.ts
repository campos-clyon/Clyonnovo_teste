import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  agendaDaClyon,
  eEventoASerio,
  apagarEventoDoCalendario,
} from "./apagar-evento-do-calendario";

/**
 * O EVENTO NA AGENDA TEM DE SE IR COM O PEDIDO.
 *
 * Verificado a 14-09-2026: não havia um único `events.delete` no repositório.
 * Apagava-se um pedido — à mão ou pela purga — e ficava, na agenda partilhada
 * da CLYON, um evento com o nome do cliente, o telefone, a morada e o andar.
 * Pior, o `calendarEventId` era a única forma de lá chegar e ia-se com a
 * linha: o evento ficava sem ninguém saber que existia.
 *
 * Este ficheiro guarda quatro coisas: que se apaga, que se apaga na agenda
 * CERTA, que falhar não desfaz o apagar do pedido, e que o ponteiro fica
 * escrito no registo antes de a linha se ir.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");

/** O corpo de uma função de db.ts — a mesma âncora da purga, e pela mesma razão (CRLF). */
const corpoDe = (nome: string) => {
  const i = DB.indexOf(`export async function ${nome}(`);
  expect(i, `${nome} não existe`).toBeGreaterThan(-1);
  const seguinte = DB.slice(i + 1).search(/\r?\n(export |\/\/ ──)/);
  return seguinte === -1 ? DB.slice(i) : DB.slice(i, i + 1 + seguinte);
};

const ANTES = { ...process.env };
afterEach(() => {
  process.env.CLYON_GOOGLE_CALENDAR_ID = ANTES.CLYON_GOOGLE_CALENDAR_ID;
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = ANTES.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  process.env.GOOGLE_PRIVATE_KEY = ANTES.GOOGLE_PRIVATE_KEY;
});

describe("que evento é a sério", () => {
  it("um id vazio não é evento nenhum", () => {
    expect(eEventoASerio(null)).toBe(false);
    expect(eEventoASerio(undefined)).toBe(false);
    expect(eEventoASerio("")).toBe(false);
    expect(eEventoASerio("   ")).toBe(false);
  });

  it("clyon-order-... é marca nossa, não é evento da Google", () => {
    // A própria rota o trata como "ainda não existe evento". Pedir à Google
    // que o apague é uma chamada de rede para receber um 404.
    expect(eEventoASerio("clyon-order-311")).toBe(false);
    expect(eEventoASerio("abc123def456")).toBe(true);
  });
});

describe("a agenda certa", () => {
  it("a que o pedido guardou manda sobre a variável de hoje", () => {
    // A variável pode ter mudado depois de o evento ser criado. Apagar na
    // agenda de hoje um evento que ficou na de ontem não apaga nada.
    process.env.CLYON_GOOGLE_CALENDAR_ID = "nova@clyon.pt";
    expect(agendaDaClyon("antiga@clyon.pt")).toBe("antiga@clyon.pt");
  });

  it("sem a do pedido, a da variável", () => {
    process.env.CLYON_GOOGLE_CALENDAR_ID = "nova@clyon.pt";
    expect(agendaDaClyon(null)).toBe("nova@clyon.pt");
    expect(agendaDaClyon("")).toBe("nova@clyon.pt");
  });

  it("um id de exemplo por substituir não conta, venha de onde vier", () => {
    process.env.CLYON_GOOGLE_CALENDAR_ID = "<id real da agenda>";
    expect(agendaDaClyon(null)).toBe("geral@clyon.pt");
    expect(agendaDaClyon("<por preencher>")).toBe("geral@clyon.pt");
  });

  it("sem variável nenhuma, a agenda conhecida", () => {
    delete process.env.CLYON_GOOGLE_CALENDAR_ID;
    expect(agendaDaClyon(null)).toBe("geral@clyon.pt");
  });

  it("aspas e quebras de linha à volta do valor não estragam o id", () => {
    // É como ele chega da Vercel quando alguém o cola com aspas.
    process.env.CLYON_GOOGLE_CALENDAR_ID = '"geral@clyon.pt"\n';
    expect(agendaDaClyon(null)).toBe("geral@clyon.pt");
  });
});

describe("apagar, e nunca atirar", () => {
  it("sem id, não há chamada nenhuma à Google", async () => {
    const r = await apagarEventoDoCalendario(null);
    expect(r.apagado).toBe(false);
    expect(r.naoExistia).toBe(true);
    expect(r.erro).toBeUndefined();
  });

  it("um marcador clyon-order- também não sai da máquina", async () => {
    const r = await apagarEventoDoCalendario("clyon-order-311");
    expect(r.naoExistia).toBe(true);
  });

  it("sem credenciais devolve o motivo em vez de estoirar", async () => {
    // Quem chama está a acabar de apagar um pedido. Uma excepção aqui subia
    // por cima de uma transacção já fechada e fazia parecer que o apagar
    // falhou, quando o pedido já se foi.
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
    const r = await apagarEventoDoCalendario("abc123def456");
    expect(r.apagado).toBe(false);
    expect(r.erro).toBeTruthy();
    expect(r.naoExistia).toBeFalsy();
  });
});

describe("o pedido leva o evento consigo", () => {
  const apagar = corpoDe("deleteSimulatorOrder");

  it("lê o id do evento ANTES do DELETE — depois não há a quem perguntar", () => {
    expect(apagar).toContain("calendarEventId, calendarTargetId");
    const leitura = apagar.indexOf("calendarEventId, calendarTargetId");
    const morte = apagar.indexOf("DELETE FROM simulatorOrders");
    expect(leitura).toBeGreaterThan(-1);
    expect(morte).toBeGreaterThan(leitura);
  });

  it("apaga o evento DEPOIS da transacção fechar", () => {
    // A mesma ordem das fotografias no Blob: uma chamada de rede a meio da
    // transacção prende a linha na base enquanto se espera pela internet.
    const commit = apagar.indexOf("conn.commit()");
    const evento = apagar.indexOf("apagarEventoDoCalendario(");
    expect(commit).toBeGreaterThan(-1);
    expect(evento).toBeGreaterThan(commit);
  });

  it("o ponteiro fica no registo antes de a linha se ir", () => {
    // Se a Google estiver em baixo, é isto que permite apagar o evento à mão.
    // Sem ele, o id desaparecia com o pedido.
    const registo = apagar.indexOf("calendarEventId: (pedido?.calendarEventId");
    const morte = apagar.indexOf("DELETE FROM simulatorOrders");
    expect(registo).toBeGreaterThan(-1);
    expect(morte).toBeGreaterThan(registo);
  });
});

describe("a purga conta os eventos", () => {
  const purga = corpoDe("purgarPedidosTerminados");

  it("diz quantos saíram da agenda", () => {
    expect(purga).toContain("eventosApagados");
  });

  it("nunca em silêncio: um evento que ficou é dado pessoal que sobreviveu", () => {
    expect(purga).toContain("eventosQueFicaram");
    const rota = ler("src/app/api/cron/purgar-pedidos/route.ts");
    expect(rota).toContain("r.eventosQueFicaram");
  });

  it("o modo seco conta-os sem lhes tocar", () => {
    // O número que se quer ver ANTES de armar: quantos eventos com nome,
    // telefone e morada saem da agenda na primeira passagem a sério.
    expect(DB).toContain("async function contarEventosDe(");
    expect(purga).toContain("await contarEventosDe(ids)");
    const conta = DB.slice(DB.indexOf("async function contarEventosDe("));
    expect(conta.slice(0, 900)).toContain("SELECT COUNT(*)");
    // Uma contagem que apagasse alguma coisa deixava de ser modo seco.
    expect(conta.slice(0, 900)).not.toContain("DELETE");
  });
});
