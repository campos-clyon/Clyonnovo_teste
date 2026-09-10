import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DIAS_DE_RETENCAO_DOS_PEDIDOS } from "./retencao";

/**
 * A PURGA DOS 60 DIAS — verificada, e construída.
 *
 * "Pode confirmar se os pedidos estão a ser excluídos automaticamente após 60
 * dias? Temos de ter o histórico completo do pedido para caso de processos
 * judiciais, mas temos que eliminar as imagens e os pedidos da base de dados."
 * — 10-09-2026.
 *
 * Não estavam. O código FALAVA da purga como se existisse — o acontecimento
 * `pedido_expurgado`, a opção "só a purga automática o usa", comentários a
 * dizer "os pedidos são expurgados aos 60 dias" — e não havia cron nenhum. E
 * apagar um pedido à mão deixava as fotografias no Blob para sempre.
 *
 * Este ficheiro guarda as três coisas que não podem voltar a partir-se: que a
 * purga CORRE, que NUNCA leva dinheiro por pagar, e que as imagens saem mesmo.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");
const ROTA = ler("src/app/api/cron/purgar-pedidos/route.ts");
const VERCEL = JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };

/**
 * O corpo de uma função de db.ts. Corta na PRÓXIMA declaração de topo, e não
 * numa chaveta: o ficheiro tem CRLF no Windows e LF na acção, e uma âncora
 * `"\n}\n"` só casava num dos dois. A última função do ficheiro vai até ao fim.
 */
const corpoDe = (nome: string) => {
  const i = DB.indexOf(`export async function ${nome}(`);
  expect(i, `${nome} não existe`).toBeGreaterThan(-1);
  const seguinte = DB.slice(i + 1).search(/\r?\n(export |\/\/ ──)/);
  return seguinte === -1 ? DB.slice(i) : DB.slice(i, i + 1 + seguinte);
};

describe("a purga corre", () => {
  it("tem cron, e é diário", () => {
    // Semanal, um pedido terminado a uma terça esperava até seis dias a mais.
    const cron = VERCEL.crons.find((c) => c.path === "/api/cron/purgar-pedidos");
    expect(cron).toBeDefined();
    const partes = cron!.schedule.split(" ");
    expect(partes[2]).toBe("*");
    expect(partes[4]).toBe("*");
  });

  it("falha fechada sem CRON_SECRET — aberta, era um endereço público que apaga pedidos", () => {
    expect(ROTA).toContain("process.env.CRON_SECRET");
    expect(ROTA).toContain("status: 503");
    expect(ROTA).toContain("status: 401");
  });

  it("o prazo é o da constante, e a constante são 60 dias", () => {
    expect(DIAS_DE_RETENCAO_DOS_PEDIDOS).toBe(60);
    expect(ROTA).toContain("purgarPedidosTerminados(DIAS_DE_RETENCAO_DOS_PEDIDOS)");
  });

  it("nunca em silêncio: o que ficou por fazer é dito", () => {
    // Um tecto que não se anuncia lê-se como "estava tudo feito".
    expect(ROTA).toContain("r.restantes > 0");
    const purga = corpoDe("purgarPedidosTerminados");
    expect(purga).toContain("restantes: Math.max(0, elegiveis - ids.length)");
  });
});

describe("o que conta como terminado, e o que nunca se purga", () => {
  const purga = corpoDe("purgarPedidosTerminados");

  it("só concluídos, cancelados e arquivados — nunca um pedido a andar", () => {
    expect(purga).toContain("o.status IN ('concluido', 'cancelado', 'arquivado')");
  });

  it("conta a partir de quando terminou, não de quando nasceu", () => {
    // `updatedAt` e não `createdAt`: qualquer edição atrasa a purga. É a
    // direcção certa de errar.
    expect(purga).toContain("o.updatedAt < NOW() - INTERVAL");
    expect(purga).not.toContain("o.createdAt <");
  });

  it("NUNCA leva um pedido com dinheiro por pagar ao profissional", () => {
    /*
     * O TESTE QUE IMPORTA. A carteira lê as negociações cruas para
     * sobreviver à purga; `deleteSimulatorOrder` apaga-as com o pedido. Sem
     * esta guarda, a dívida a um profissional desaparecia com a linha.
     * `acordada` sem `pagoEm` cobre o trabalho por confirmar E o confirmado
     * por pagar.
     */
    expect(purga).toContain("g.estado = 'acordada' AND g.pagoEm IS NULL");
    expect(purga).toContain("NOT EXISTS");
  });

  it("não desarma o guarda de dentro", () => {
    // A guarda está no SELECT; a de `deleteSimulatorOrder` fica por cima dela.
    expect(purga).not.toContain("mesmoComTrabalhoEmCurso");
  });

  it("um de cada vez, pela mesma porta do botão — é o que deixa o retrato", () => {
    expect(purga).toContain("await deleteSimulatorOrder(id, {");
    expect(purga).toContain('acontecimento: "pedido_expurgado"');
    expect(purga).toContain('autorTipo: "sistema"');
    // Um que falhe não pára os outros.
    expect(purga).toContain("falhados.push({ pedidoId: id");
  });
});

describe("as imagens saem mesmo — também quando se apaga à mão", () => {
  const apagar = corpoDe("deleteSimulatorOrder");

  it("recolhe as fotografias do pedido E as da prova de execução", () => {
    // Antes só as de conta apagada saíam, e só as do pedido. As provas —
    // fotografias de dentro de casa — ficavam no Blob para sempre.
    expect(apagar).toContain("filesJson");
    expect(apagar).toContain("n.provaJson");
    expect(apagar).toContain("prova.fotos");
  });

  it("apaga do Blob DEPOIS de a transacção fechar", () => {
    // Uma chamada de rede a meio dela prende a linha enquanto se espera pela
    // internet — a mesma regra do apagamento de conta.
    const commit = apagar.indexOf("await conn.commit();");
    const blob = apagar.indexOf("apagarFotosDoBlob(fotos)");
    expect(commit).toBeGreaterThan(-1);
    expect(blob).toBeGreaterThan(commit);
  });

  it("o registo guarda QUANTAS havia, não quais", () => {
    expect(apagar).toContain("fotografias: fotos.length");
    expect(apagar).not.toContain("fotos: fotos,");
  });

  it("o retrato distingue prazo de decisão", () => {
    expect(apagar).toContain('contexto.acontecimento ?? "pedido_apagado"');
  });
});
