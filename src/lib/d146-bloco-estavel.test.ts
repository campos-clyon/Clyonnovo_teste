import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validadeDoPedidoNaMesa } from "./validade-do-orcamento";

/**
 * d146 — UM PEDIDO SÓ MUDA DE BLOCO POR UM ACONTECIMENTO CONCRETO (dono,
 * 27-11-2026). O caso: orçamento enviado, o cliente respondeu e a Vitória
 * respondeu-lhe a cada minuto — o pedido saltava entre «Precisa de si» e «A
 * aguardar cliente» a cada mensagem. Horas e números inventados.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const ENVIO = new Date("2026-11-27T17:32:57Z");
const em = (hhmmss: string) => new Date(`2026-11-27T${hhmmss}Z`);
const ciclo = (o: Record<string, unknown> = {}) => ({
  desde: ENVIO,
  lembrete1Em: null,
  ultimoAvisoEm: null,
  fechadoEm: null,
  paradoEm: null,
  ...o,
});

describe("o cliente respondeu ao orçamento: fica connosco, mensagem a mensagem", () => {
  it("a conversa com a Vitória a seguir não muda o bloco nem a linha", () => {
    // Cada passo: a última mensagem do cliente até ali. As da Vitória (15 s depois) não entram.
    const conversa = ["17:34:28", "17:34:28", "17:35:40", "17:35:40", "17:36:33", "17:36:33", "17:37:12", "17:37:12"];
    const lidas = conversa.map((h) => validadeDoPedidoNaMesa(ciclo(), em(h), true, em("17:40:00")));
    expect(lidas.every((l) => l.parado)).toBe(true);
    expect(new Set(lidas.map((l) => l.linha)).size).toBe(1);
    expect(lidas[0].linha).toBe("orçamento enviado 27/11 · o cliente respondeu a 27/11 — contagem parada, é connosco");
    expect(lidas.every((l) => l.lembrar === null)).toBe(true);
  });

  it("a mesma base lida duas vezes dá o mesmo resultado", () => {
    const a = validadeDoPedidoNaMesa(ciclo(), em("17:34:28"), true, em("17:40:00"));
    const b = validadeDoPedidoNaMesa(ciclo(), em("17:34:28"), true, em("17:40:30"));
    expect(b).toEqual(a);
  });

  it("com a paragem gravada, uma leitura das mensagens que falha não o tira de «Precisa de si»", () => {
    const gravado = ciclo({ paradoEm: em("17:45:00") });
    expect(validadeDoPedidoNaMesa(gravado, undefined, true, em("18:00:00")).parado).toBe(true);
    expect(validadeDoPedidoNaMesa(gravado, em("17:59:00"), true, em("18:00:00")).parado).toBe(true);
  });

  it("sem resposta do cliente depois do envio, continua à espera dele", () => {
    const r = validadeDoPedidoNaMesa(ciclo(), em("17:20:00"), true, em("17:40:00"));
    expect(r.parado).toBe(false);
    expect(r.linha).toContain("fecha a");
    expect(validadeDoPedidoNaMesa(ciclo(), null, true, em("17:40:00")).parado).toBe(false);
  });
});

describe("a Mesa lê o bloco de uma regra só, sem a última da Vitória", () => {
  const BASE = semComentarios(ler("src/lib/validade-do-orcamento-na-base.ts"));
  const f = BASE.slice(BASE.indexOf("export async function validadeNaMesa("), BASE.indexOf("export type CicloComLembrete"));

  it("validadeNaMesa decide pelo validadeDoPedidoNaMesa e não pela resposta da Vitória", () => {
    expect(f).toContain("validadeDoPedidoNaMesa(c, resp?.ultimaMensagemEm, ligado, agora)");
    expect(f).not.toContain("respostaEConnosco");
    expect(f).not.toContain("ultimaDaVitoriaEm");
    expect(f).not.toContain("vitoriaRespondeu");
  });

  it("o painel guarda a última validade lida: uma leitura falhada não muda o bloco", () => {
    const MESA = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
    expect(MESA).toContain("let daValidade: Record<number, ValidadeNaMesa> = ultimaValidade.current?.pedidos ?? {};");
    expect(MESA).toContain("let validadeLigada = ultimaValidade.current?.ligado ?? false;");
    expect(MESA).toContain("ultimaValidade.current = { ligado: validadeLigada, pedidos: daValidade };");
  });

  it("os em seguimento saem da conta do «Precisa de si» (não contam duas vezes)", () => {
    const MESA = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
    const i = MESA.indexOf("function quantosNoBloco(");
    const contas = MESA.slice(i, MESA.indexOf("\n  }\n", i)).replace(/\s+/g, " ");
    expect(contas).toContain('(chave === "n1" ? outrosSemPropostas.length : 0) - (chave === "n1" ? emSeguimentoNoN1.length : 0)');
  });
});
