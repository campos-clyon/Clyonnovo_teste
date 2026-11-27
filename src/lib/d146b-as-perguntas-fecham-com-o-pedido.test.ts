import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * d146b — AS PERGUNTAS AOS PARCEIROS FECHAM COM O PEDIDO (27-11-2026).
 * Pedidos e parceiros inventados (o repositório é público).
 *
 * Num pedido, a ronda das datas (d136) continuou depois de o cliente contratar:
 * meia hora depois, o prazo juntou numa nota à equipa as respostas de
 * parceiros já encerrados. Agora, contratado (ou cancelado, arquivado,
 * concluído, rejeitado, apagado), as perguntas da d97/d136 desse pedido
 * fecham-se logo; quem responde depois lê um obrigado curto, uma vez; e nada
 * segue para a equipa nem para o cliente.
 */

import { obrigadoDepoisDoFecho, oPedidoJaFechou, ESTADOS_DO_PEDIDO_FECHADO } from "./vitoria-agente/disponibilidade";
import { pedidoDaPergunta } from "./vitoria-agente/pergunta-ao-parceiro";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const BASE = ler("src/lib/vitoria-agente/pergunta-ao-parceiro-na-base.ts");

/** O corpo de uma função do ficheiro da base (até à função seguinte). */
function corpo(nome: string): string {
  const i = BASE.indexOf(`function ${nome}(`);
  expect(i).toBeGreaterThan(-1);
  const resto = BASE.slice(i + 10);
  const fim = resto.search(/\n(?:export )?(?:async )?function /);
  return fim === -1 ? resto : resto.slice(0, fim);
}

describe("o pedido já fechou?", () => {
  it("contratado (uma negociação acordada) fecha, seja qual for o estado do pedido", () => {
    expect(oPedidoJaFechou({ existe: true, status: "pendente", contratada: 12 })).toBe("contratado");
    expect(oPedidoJaFechou({ existe: true, status: null, contratada: 12 })).toBe("contratado");
  });

  it("cancelado, arquivado, concluído, rejeitado ou apagado fecha", () => {
    for (const s of ESTADOS_DO_PEDIDO_FECHADO) expect(oPedidoJaFechou({ existe: true, status: s, contratada: null })).toBe("fechado");
    expect(oPedidoJaFechou({ existe: true, status: " Cancelado ", contratada: null })).toBe("fechado");
    expect(oPedidoJaFechou({ existe: false, status: null, contratada: null })).toBe("fechado");
  });

  it("um pedido vivo, sem contratado, não fecha", () => {
    for (const s of ["pendente", "em_negociacao", "", null, undefined]) {
      expect(oPedidoJaFechou({ existe: true, status: s, contratada: null })).toBeNull();
      expect(oPedidoJaFechou({ existe: true, status: s, contratada: 0 })).toBeNull();
    }
  });
});

describe("o obrigado curto a quem responde depois", () => {
  it("ao parceiro encerrado: o trabalho já foi atribuído", () => {
    expect(obrigadoDepoisDoFecho(692, "contratado", false)).toBe(
      "Obrigada pela resposta! O trabalho do pedido #692 já foi atribuído — não precisa de fazer mais nada.",
    );
  });

  it("ao contratado: o dia combina-se com o cliente; num pedido fechado: já foi fechado", () => {
    expect(obrigadoDepoisDoFecho(692, "contratado", true)).toMatch(/contratado consigo/);
    expect(obrigadoDepoisDoFecho(692, "fechado", false)).toMatch(/pedido #692 já foi fechado/);
  });

  it("o obrigado nunca se confunde com uma pergunta (a resposta seguinte não volta a entrar aqui)", () => {
    for (const t of [obrigadoDepoisDoFecho(692, "contratado", false), obrigadoDepoisDoFecho(692, "contratado", true), obrigadoDepoisDoFecho(692, "fechado", false)]) {
      expect(pedidoDaPergunta(t)).toBeNull();
      expect(t).not.toMatch(/€|\d{9}/);
    }
  });
});

describe("na base: fecham logo, e nada segue", () => {
  it("fecharAsPerguntasDoPedido fecha só as abertas desse pedido (módulo leve, sem o agente)", () => {
    const f = ler("src/lib/vitoria-agente/perguntas-fecham-com-o-pedido.ts");
    expect(f).not.toMatch(/from "\.\/(?:cliente|ferramentas|ao-vivo|pergunta-ao-parceiro-na-base)"/);
    expect(BASE).toContain('import { fecharAsPerguntasDoPedido } from "./perguntas-fecham-com-o-pedido";');
    expect(f).toContain("UPDATE vitoriaPerguntasAoParceiro SET estado = 'encerrada' WHERE pedidoId = ? AND estado = 'aberta'");
  });

  it("contratar, atribuir o trabalho CLYON e o fim do pedido fecham-nas logo", () => {
    const db = ler("src/lib/db.ts");
    expect(db).toContain('if (r.ok && seAinda && dados.estado === "acordada") {');
    expect(db).toContain('m.fecharAsPerguntasDoPedido(seAinda.pedidoId, "contratado")');
    expect(db).toContain('m.fecharAsPerguntasDoPedido(pedidoId, "contratado")');
    expect(ler("src/lib/fim-do-pedido-na-base.ts")).toContain('m.fecharAsPerguntasDoPedido(pedidoId, "fechado")');
  });

  it("a passagem de 10 em 10 min fecha primeiro as dos pedidos fechados, e só depois corre os prazos", () => {
    const f = corpo("correrOsPrazosDasPerguntas");
    const fecha = f.indexOf("fecharAsPerguntasDoPedido(Number(v.pedidoId), f.fecho)");
    const prazos = f.indexOf("estado = 'aberta' AND prazoEm <= UTC_TIMESTAMP()");
    expect(fecha).toBeGreaterThan(-1);
    expect(prazos).toBeGreaterThan(fecha);
  });

  it("a ronda que acaba com o pedido já fechado não escreve à equipa nem ao cliente (o caso do #692)", () => {
    const f = corpo("responderAoClienteDaRonda");
    const guarda = f.indexOf("if (await fecharSeOPedidoFechou(Number(rows[0].pedidoId))) {");
    expect(guarda).toBeGreaterThan(-1);
    for (const depois of ["interromperNumeroWhatsApp", "uma pessoa tem a conversa", "enviarTextoWhatsApp"]) {
      expect(f.indexOf(depois)).toBeGreaterThan(guarda);
    }
    // Antes de «ainda há abertas»: as encerradas não contam como fim da ronda.
    expect(f.indexOf('rows.some((r) => String(r.estado) === "aberta")')).toBeGreaterThan(guarda);
  });

  it("a resposta no WhatsApp de um pedido fechado: um obrigado, uma vez, e mais nada", () => {
    const f = corpo("respostaDoParceiroPeloWhatsApp");
    expect(f).toContain("estado IN ('aberta', 'encerrada')");
    const guarda = f.indexOf("const fechou = await fecharSeOPedidoFechou(p.pedidoId);");
    expect(guarda).toBeGreaterThan(-1);
    expect(f).toContain("SET estado = 'encerrada_avisada'");
    expect(f).toContain("WHERE id = ? AND estado = 'encerrada'");
    expect(f).toContain("Number(m.affectedRows ?? 0) === 1 && !opcoes.interrompido");
    expect(f).toContain("obrigadoDepoisDoFecho(");
    // A resposta normal (ao cliente, à equipa) só vem depois da guarda.
    expect(f.indexOf("responderComARespostaDoParceiro(p, texto")).toBeGreaterThan(guarda);
  });

  it("no painel e no caminho da d97 a mesma guarda", () => {
    expect(corpo("respostaDoParceiroPeloPainel")).toContain("fecharSeOPedidoFechou(Number(linha.pedidoId))");
    expect(corpo("responderComARespostaDoParceiro")).toContain('if (await fecharSeOPedidoFechou(p.pedidoId)) return "ja_respondida";');
  });

  it("o estado novo cabe na coluna (VARCHAR(20))", () => {
    expect("encerrada_avisada".length).toBeLessThanOrEqual(20);
    expect(BASE).toContain("estado            VARCHAR(20)");
  });
});
