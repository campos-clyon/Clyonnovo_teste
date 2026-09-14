import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIAS_PARA_AS_RECOLHAS_DO_WHATSAPP,
  DIAS_PARA_OS_ABANDONADOS,
} from "./retencao";

/**
 * O BLOCO DE NOTAS DO ASSISTENTE TAMBÉM TEM PRAZO.
 *
 * `whatsappRecolhas` guarda, por número, o que a pessoa já respondeu ao
 * assistente: nome, morada, código postal, o que tem para levar. Só se apagava
 * por telefone — nunca pela idade. Verificado a 14-09-2026: uma conversa
 * abandonada a meio guardava a morada de alguém para sempre.
 *
 * E havia uma fuga que a própria purga abria: expurgava-se o pedido aos 60
 * dias, com fotografias e tudo, e a linha da recolha ficava a apontar para ele
 * com os dados lá dentro. Ninguém a voltava a ver.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");
const ROTA = ler("src/app/api/cron/purgar-pedidos/route.ts");

/** O corpo de uma função de db.ts — a mesma âncora da purga (CRLF na máquina, LF na acção). */
const corpoDe = (nome: string) => {
  const i = DB.indexOf(`export async function ${nome}(`);
  expect(i, `${nome} não existe`).toBeGreaterThan(-1);
  const seguinte = DB.slice(i + 1).search(/\r?\n(export |\/\/ ──)/);
  return seguinte === -1 ? DB.slice(i) : DB.slice(i, i + 1 + seguinte);
};

describe("o prazo das recolhas", () => {
  it("é o dos abandonados — uma conversa a meio é exactamente isso", () => {
    expect(DIAS_PARA_AS_RECOLHAS_DO_WHATSAPP).toBe(DIAS_PARA_OS_ABANDONADOS);
  });

  it("vive na retenção, e não escrito à mão no SQL", () => {
    // Um número enterrado numa query é um número que ninguém encontra para
    // mudar. Este é uma decisão do dono e tem de se ver onde as outras estão.
    const recolhas = corpoDe("purgarRecolhasDoWhatsApp");
    expect(recolhas).not.toMatch(/INTERVAL \d+ DAY/);
    expect(ROTA).toContain("DIAS_PARA_AS_RECOLHAS_DO_WHATSAPP");
  });
});

describe("as duas que saem", () => {
  const recolhas = corpoDe("purgarRecolhasDoWhatsApp");

  it("as abandonadas: sem pedido e paradas há mais do que o prazo", () => {
    expect(recolhas).toContain("r.pedidoId IS NULL");
    expect(recolhas).toContain("r.actualizadoEm < NOW() - INTERVAL");
  });

  it("as órfãs: o pedido já não existe, e a cópia com a morada tinha ficado", () => {
    expect(recolhas).toContain("r.pedidoId IS NOT NULL AND o.id IS NULL");
    expect(recolhas).toContain("LEFT JOIN simulatorOrders o ON o.id = r.pedidoId");
  });

  it("as órfãs não esperam prazo nenhum", () => {
    // Assim que o pedido deixa de existir, a cópia deixa de ter razão de ser.
    // Um prazo aqui era tempo a mais com dados que já não pertencem a nada.
    const orfa = recolhas.slice(recolhas.indexOf("const orfa ="));
    expect(orfa.slice(0, 120)).not.toContain("INTERVAL");
  });

  it("uma condição só, escrita uma vez, para contar e para apagar", () => {
    // Duas cópias podiam divergir — e a divergência que interessa é a pior:
    // o modo seco a dizer um número e a passagem a sério a apagar outro.
    expect(recolhas).toContain("const abandonada =");
    expect(recolhas).toContain("const orfa =");
    expect(recolhas.match(/\$\{abandonada\}/g)?.length).toBeGreaterThanOrEqual(2);
    expect(recolhas.match(/\$\{orfa\}/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("o modo seco continua seco", () => {
  const recolhas = corpoDe("purgarRecolhasDoWhatsApp");

  it("conta e sai antes de qualquer DELETE", () => {
    // Por regex, e não por texto com \n: CRLF na máquina, LF na acção.
    const fim = recolhas.search(/aSerio: false,\r?\n\s*\};/);
    expect(fim, "o retorno do modo seco não foi encontrado").toBeGreaterThan(-1);
    expect(recolhas.slice(0, fim)).not.toContain("DELETE");
  });

  it("a mesma trava dos pedidos — `aSerio` vem de fora e por omissão é sim", () => {
    // A rota é que decide, a partir de PURGA_ARMADA. A função não inventa.
    expect(recolhas).toContain("opcoes.aSerio !== false");
    expect(ROTA).toContain("purgarRecolhasDoWhatsApp(DIAS_PARA_AS_RECOLHAS_DO_WHATSAPP, {");
    expect(ROTA).toContain("aSerio: armada");
  });
});

describe("na mesma passagem, e a seguir", () => {
  it("corre DEPOIS da purga dos pedidos", () => {
    // A purga acabou de apagar pedidos; cada um deles pode ter deixado uma
    // recolha órfã. Corrê-la antes deixava essas para a noite seguinte.
    const pedidos = ROTA.indexOf("purgarPedidosTerminados(");
    const recolhas = ROTA.indexOf("purgarRecolhasDoWhatsApp(");
    expect(pedidos).toBeGreaterThan(-1);
    expect(recolhas).toBeGreaterThan(pedidos);
  });

  it("uma falha nas recolhas não estraga o relatório da purga", () => {
    // O relatório é o que decide se a purga se arma. Não pode depender da
    // parte menor da passagem.
    const bloco = ROTA.slice(ROTA.indexOf("purgarRecolhasDoWhatsApp("));
    expect(bloco.slice(0, 400)).toContain(".catch(");
  });

  it("o que saiu fica escrito no registo", () => {
    expect(ROTA).toContain("recolhasAbandonadas: recolhas.abandonadas");
    expect(ROTA).toContain("recolhasOrfas: recolhas.orfas");
  });

  it("escreve-se o registo mesmo quando não houve pedido nenhum a apagar", () => {
    // Uma passagem que só levou recolhas é trabalho feito, e tem de aparecer.
    // A âncora é por regex e não por texto com \n: o ficheiro tem CRLF na
    // máquina e LF na acção, e um indexOf dava -1 num dos dois — com slice(-1)
    // a devolver uma linha em branco que passava por "não contém" sem razão.
    const i = ROTA.search(/if \(\r?\n\s*r\.expurgados > 0/);
    expect(i, "a guarda do registo não foi encontrada").toBeGreaterThan(-1);
    const guarda = ROTA.slice(i, i + 300);
    expect(guarda).toContain("recolhas.abandonadas > 0");
    expect(guarda).toContain("recolhas.orfas > 0");
  });
});

describe("o backoffice vê-as antes de armar", () => {
  it("a rota da retenção conta-as sem tocar", () => {
    const rota = ler("src/app/api/admin/retencao/route.ts");
    expect(rota).toContain("purgarRecolhasDoWhatsApp(DIAS_PARA_AS_RECOLHAS_DO_WHATSAPP, { aSerio: false })");
    expect(rota).toContain("recolhasAbandonadas: recolhas.abandonadas");
    expect(rota).toContain("recolhasOrfas: recolhas.orfas");
  });

  it("e o painel mostra-as", () => {
    const painel = ler("src/components/admin/AdminRetencaoPanel.tsx");
    expect(painel).toContain("estado.recolhasAbandonadas");
    expect(painel).toContain("estado.recolhasOrfas");
  });
});
