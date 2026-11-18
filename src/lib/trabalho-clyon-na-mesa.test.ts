import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blocoDoClyonNaMesa, mostraOClienteRespondeu, type TrabalhoClyonParaAMesa } from "./trabalho-clyon-na-mesa";
import { clienteEscreveuDepoisDoPreco, clienteRespondeu, oClienteRespondeuNaMesa } from "./prazo-do-cliente-clyon";

/*
 * A CORRECÇÃO DA d55 — 18-11-2026. Na Mesa, Trabalhos CLYON já oferecidos
 * apareciam no fim do «Por decidir» (agora «Orçamentos novos») com a etiqueta
 * «O cliente respondeu — escolher parceiro», sem o cliente ter escrito. Dados
 * inventados.
 */
const ENVIO = "2026-11-17T10:00:00.000Z";
const mesa = (extra: Partial<TrabalhoClyonParaAMesa>): TrabalhoClyonParaAMesa => ({
  arrumado: false,
  bloco: "precisa",
  fase: "escolher",
  propostaEnviadaEm: null,
  precoAceiteEm: null,
  clienteRespondeu: false,
  ...extra,
});

describe("um Trabalho CLYON oferecido nunca fica nos «Orçamentos novos»", () => {
  it("oferecido a 10 e ninguém aceitou → «À espera de propostas», sem etiqueta", () => {
    const t = mesa({ bloco: "espera", fase: "a_espera", propostaEnviadaEm: ENVIO });
    expect(blocoDoClyonNaMesa(t)).toBe("n2");
    expect(mostraOClienteRespondeu(t)).toBe(false);
    // Mesmo que o cliente tenha escrito: sem quem aceitou, não há parceiro a escolher.
    expect(mostraOClienteRespondeu({ ...t, clienteRespondeu: true })).toBe(false);
    expect(blocoDoClyonNaMesa({ ...t, clienteRespondeu: true })).toBe("n2");
  });

  it("um aceitou e a proposta foi ao cliente, que não respondeu → «A aguardar cliente»", () => {
    const t = mesa({ propostaEnviadaEm: ENVIO });
    expect(blocoDoClyonNaMesa(t)).toBe("aguardaCliente");
    expect(mostraOClienteRespondeu(t)).toBe(false);
  });

  it("três aceitaram e a proposta ainda não foi ao cliente → «Precisa de si», sem etiqueta", () => {
    const t = mesa({});
    expect(blocoDoClyonNaMesa(t)).toBe("n1");
    expect(mostraOClienteRespondeu(t)).toBe(false);
  });

  it("o cliente escreveu depois do preço (ou aceitou-o) → «Precisa de si», com a etiqueta", () => {
    const t = mesa({ propostaEnviadaEm: ENVIO, clienteRespondeu: true });
    expect(blocoDoClyonNaMesa(t)).toBe("n1");
    expect(mostraOClienteRespondeu(t)).toBe(true);
    const aceite = mesa({ propostaEnviadaEm: ENVIO, precoAceiteEm: "2026-11-17T12:00:00.000Z" });
    expect(blocoDoClyonNaMesa(aceite)).toBe("n1");
    expect(mostraOClienteRespondeu(aceite)).toBe(true);
  });

  it("arrumado vai aos cancelados; nenhum caso dá o bloco dos orçamentos novos", () => {
    expect(blocoDoClyonNaMesa(mesa({ arrumado: true, clienteRespondeu: true }))).toBe("cancelados");
    const fases: Array<Partial<TrabalhoClyonParaAMesa>> = [
      { bloco: "feito", fase: "por_confirmar" },
      { bloco: "espera", fase: "a_espera" },
      { bloco: "precisa", fase: "sem_ninguem" },
      { bloco: "atribuidos", fase: "atribuida" },
      { bloco: "concluidos", fase: "paga" },
    ];
    for (const f of fases) {
      for (const clienteRespondeu of [true, false]) {
        expect(blocoDoClyonNaMesa(mesa({ ...f, clienteRespondeu, propostaEnviadaEm: ENVIO }))).not.toBe("porEnviar");
      }
    }
  });
});

describe("a etiqueta só quando o cliente escreveu mesmo", () => {
  const base = {
    valorFixoClyon: 120,
    estadoDoPedido: "sem_assistente",
    propostaEnviadaEm: ENVIO,
    negociacoes: [{ estado: "aguarda_contratacao" }],
  };

  it("a equipa mandou a proposta à mão pelo WhatsApp (a conversa passou a uma pessoa): não é resposta do cliente", () => {
    const t = { ...base, passadaAUmaPessoaEm: "2026-11-17T10:00:40.000Z" };
    expect(clienteEscreveuDepoisDoPreco(t)).toBe(false);
    expect(oClienteRespondeuNaMesa(t)).toBe(false);
    // A rotina das 72 horas continua prudente: na dúvida, não arquiva.
    expect(clienteRespondeu(t)).toBe(true);
  });

  it("uma mensagem dele depois do envio conta; uma de antes não", () => {
    expect(oClienteRespondeuNaMesa({ ...base, ultimaMensagemDoClienteEm: "2026-11-17T15:00:00.000Z" })).toBe(true);
    expect(oClienteRespondeuNaMesa({ ...base, ultimaMensagemDoClienteEm: "2026-11-17T09:00:00.000Z" })).toBe(false);
  });

  it("a Mesa usa a regra única e já não desenha Trabalhos CLYON no bloco dos orçamentos novos", () => {
    const MESA = readFileSync(join(process.cwd(), "src/components/admin/AdminNegociacoesPanel.tsx"), "utf8");
    expect(MESA).toContain("blocoDoClyonNaMesa(paraAMesa(t))");
    expect(MESA).toContain('b.chave === "n1" && mostraOClienteRespondeu(paraAMesa(t))');
    expect(MESA).not.toContain('clyonDoBloco("porEnviar")');
    expect(MESA).toContain('titulo: "Orçamentos novos",');
    const ROTA = readFileSync(join(process.cwd(), "src/app/api/admin/trabalhos-clyon/route.ts"), "utf8");
    expect(ROTA).toContain("clienteRespondeu: oClienteRespondeuNaMesa({");
  });
});
