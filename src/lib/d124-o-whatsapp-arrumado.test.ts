import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PORQUE_DESCARTADA,
  SAI_DA_VISTA_S,
  deQuemEAVez,
  inicioDoTexto,
  porqueDescartarSozinha,
  quemNaLinha,
  resumoDoTopo,
  vivoEUltimo,
} from "./arrumar-o-whatsapp";
import { PRAZO_PARA_DESCARTAR_S } from "./fila-do-cliente";
import { naMesa, type FactosDaConversa } from "./mesa-das-conversas";

/**
 * d124 (25-11-2026) — a secção WhatsApp arrumada: o que sai da vista, a fila
 * que se descarta sozinha (só nesses casos) e o número que não se mostra.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const DIA = 86400;

function factos(extra: Partial<FactosDaConversa>): FactosDaConversa {
  return {
    telefone: "351912345678",
    ultimaEntrada: null,
    ultimaSaida: null,
    bloqueada: false,
    entregue: false,
    fecho: null,
    recolha: null,
    pedidoVivo: null,
    ultimoPedido: null,
    guardada: null,
    ...extra,
  };
}

const entrada = (haSegundos: number, texto = "Então, já há novidades?") => ({
  id: 10,
  direccao: "in" as const,
  texto,
  haSegundos,
  quando: "2026-11-01T10:00:00.000Z",
});

describe("a conversa de um pedido fechado sai da vista ao fim de 3 dias", () => {
  it("são 3 dias", () => {
    expect(SAI_DA_VISTA_S).toBe(3 * DIA);
  });

  for (const status of ["concluido", "arquivado", "cancelado", "rejeitado"]) {
    it(`pedido ${status}, o cliente calado há 11 dias → Resolvidas (pelo pedido)`, () => {
      const c = naMesa(factos({ ultimaEntrada: entrada(11 * DIA), ultimoPedido: { id: 501, status } }));
      expect(c.estado).toBe("resolvida");
      expect(c.fechadaPor).toBe("pedido");
      expect(c.porque).toContain("#501");
    });
  }

  it("com mensagem nova do cliente (menos de 3 dias) fica no «Por responder»", () => {
    const c = naMesa(factos({ ultimaEntrada: entrada(2 * DIA), ultimoPedido: { id: 501, status: "concluido" } }));
    expect(c.estado).toBe("por_responder");
  });

  it("com um pedido vivo, nunca sai — mesmo que o último esteja fechado", () => {
    const c = naMesa(
      factos({
        ultimaEntrada: entrada(20 * DIA),
        pedidoVivo: { id: 600, status: "enviado" },
        ultimoPedido: { id: 601, status: "cancelado" },
      }),
    );
    expect(c.estado).not.toBe("resolvida");
  });

  it("sem pedido nenhum, uma conversa antiga continua por responder (o bloco «Há mais de 3 dias»)", () => {
    const c = naMesa(factos({ ultimaEntrada: entrada(20 * DIA) }));
    expect(c.estado).toBe("por_responder");
  });

  it("não grava nada: é a mesa que decide, e não há fecho escrito", () => {
    const BASE = ler("src/lib/mesa-das-conversas-na-base.ts");
    expect(BASE).not.toMatch(/arquivarConversaWhatsApp/);
  });
});

describe("as atrasadas descartam-se sozinhas — só nestes casos", () => {
  const base = { atrasada: true, idadeS: 3 * 3600, vivo: null, ultimo: null };

  it("pedido com parceiro contratado (pelo estado do pedido)", () => {
    for (const status of ["confirmado", "agendado", "em_execucao", "em_curso"]) {
      expect(porqueDescartarSozinha({ ...base, vivo: { id: 1, status }, ultimo: { id: 1, status } })).toBe(
        PORQUE_DESCARTADA.contratado,
      );
    }
  });

  it("pedido com parceiro contratado (por uma negociação acordada)", () => {
    const vivo = { id: 1, status: "em_negociacao", negociacaoContratada: true };
    expect(porqueDescartarSozinha({ ...base, vivo, ultimo: vivo })).toBe(PORQUE_DESCARTADA.contratado);
  });

  it("pedido fechado (cancelado, arquivado, concluído) e nenhum vivo", () => {
    for (const status of ["cancelado", "arquivado", "concluido"]) {
      expect(porqueDescartarSozinha({ ...base, ultimo: { id: 2, status } })).toBe(PORQUE_DESCARTADA.fechado);
    }
    expect(PORQUE_DESCARTADA.fechado).toBe("descartada sozinha: pedido já fechado");
  });

  it("mais de 48 h na fila", () => {
    expect(porqueDescartarSozinha({ ...base, idadeS: PRAZO_PARA_DESCARTAR_S + 1 })).toBe(PORQUE_DESCARTADA.velha);
  });

  it("fica para a equipa: pedido ainda sem parceiro, dentro das 48 h", () => {
    const vivo = { id: 3, status: "enviado" };
    expect(porqueDescartarSozinha({ ...base, vivo, ultimo: vivo })).toBeNull();
    expect(porqueDescartarSozinha({ ...base, vivo: { id: 4, status: "em_negociacao" }, ultimo: { id: 5, status: "cancelado" } })).toBeNull();
    expect(porqueDescartarSozinha(base)).toBeNull();
  });

  it("o que ainda não está atrasado nunca se descarta", () => {
    expect(porqueDescartarSozinha({ ...base, atrasada: false, ultimo: { id: 2, status: "cancelado" } })).toBeNull();
  });

  it("o vivo e o último saem pela mesma regra da mesa", () => {
    const r = vivoEUltimo([
      { id: 7, status: "cancelado" },
      { id: 9, status: "concluido" },
      { id: 8, status: "agendado" },
    ]);
    expect(r.ultimo?.id).toBe(9);
    expect(r.vivo?.id).toBe(8);
  });

  it("a base descarta com quem e porquê, sem apagar (riscada, não DELETE)", () => {
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("async function descartarAtrasadasDePedidosArrumados(");
    expect(i).toBeGreaterThan(-1);
    const corpo = DB.slice(i, DB.indexOf("export async function descartarDaFilaWhatsApp", i));
    expect(corpo).toContain("porqueDescartarSozinha(");
    expect(corpo).toContain("descartadaPor = ?, descartadaPorque = ?");
    expect(corpo).toContain("AND atrasadaEm IS NOT NULL");
    expect(semComentarios(corpo)).not.toContain("DELETE");
    expect(DB).toContain("ALTER TABLE whatsappFila ADD COLUMN descartadaPorque VARCHAR(160)");
    // O «Descartar» da equipa também fica escrito, com o nome de quem carregou.
    expect(ler("src/app/api/admin/whatsapp/route.ts")).toContain(
      'await descartarDaFilaWhatsApp(mensagem.id, colab?.nome ?? null, "descartada pela equipa");',
    );
  });
});

describe("o número não se mostra", () => {
  const telefone = "351912345678";

  it("a linha diz o nome, o profissional ou o pedido — nunca o número", () => {
    expect(quemNaLinha({ telefone, nome: "Ana Silva" })).toBe("Ana Silva");
    expect(quemNaLinha({ telefone, nome: "Ana", profissional: { nome: "Rui Transportes" } })).toBe("Rui Transportes");
    expect(quemNaLinha({ telefone, nome: null, pedido: { id: 512 } })).toBe("Pedido #512");
    const semNada = quemNaLinha({ telefone });
    expect(semNada).not.toMatch(/912\s?345/);
    expect(semNada.replace(/\D/g, "").length).toBeLessThanOrEqual(3);
  });

  it("um «nome» que é o número não passa por nome", () => {
    expect(quemNaLinha({ telefone, nome: "+351 912 345 678", pedido: { id: 7 } })).toBe("Pedido #7");
  });

  it("no painel, o telefone só aparece dentro do «Ver número»", () => {
    const P = semComentarios(ler("src/components/admin/AdminWhatsAppPanel.tsx"));
    expect(P).toContain("function VerNumero(");
    // Fora do «Ver número», nenhum número de cliente é escrito por extenso…
    expect(P).not.toMatch(/formatarTelefone\((l|m|f)\.telefone\)/);
    expect(P).not.toMatch(/formatarTelefone\(telefones\[0\]\)/);
    // …e a lista, a fila e as atrasadas mostram quem é.
    expect(P).toContain("const quem = quemNaLinha(l);");
    expect(P.match(/\{quemE\(m\.telefone\)\}/g)?.length).toBeGreaterThanOrEqual(3);
    expect(P.match(/<VerNumero telefone=\{(l|m)\.telefone\} \/>/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe("o ecrã arrumado", () => {
  const P = ler("src/components/admin/AdminWhatsAppPanel.tsx");

  it("o topo diz quantas por responder, a mais antiga e as que pedem uma pessoa", () => {
    const r = resumoDoTopo([
      { estado: "por_responder", dono: "assistente", porque: "Escreveu há 2 h", haSegundos: 7200 },
      { estado: "por_responder", dono: "equipa", porque: "Escreveu há 5 h", haSegundos: 18000 },
      { estado: "por_responder", dono: "assistente", porque: "A Vitória deixou uma pergunta anotada para uma pessoa há 1 h", haSegundos: 3600 },
      { estado: "por_responder", dono: "assistente", porque: "Escreveu há 9 dias", haSegundos: 9 * DIA },
      { estado: "a_espera", dono: "equipa", porque: "", haSegundos: 60 },
    ]);
    expect(r.porResponder).toBe(4);
    expect(r.maisAntigaHaSegundos).toBe(18000);
    expect(r.pedemUmaPessoa).toBe(2);
    expect(P).toContain("const resumo = resumoDoTopo(linhas);");
  });

  it("de quem é a vez, numa palavra", () => {
    expect(deQuemEAVez({ estado: "por_responder", dono: "equipa" }).nossa).toBe(true);
    expect(deQuemEAVez({ estado: "a_espera", dono: "assistente" }).texto).toBe("Vez do cliente");
  });

  it("a fila recolhida: uma linha por mensagem", () => {
    const longo = "Olá! ".repeat(60);
    expect(inicioDoTexto(longo).length).toBeLessThanOrEqual(90);
    expect(inicioDoTexto("curto")).toBe("curto");
    expect(P).toContain("{inicioDoTexto(m.texto)}");
  });

  it("os separadores do dia-a-dia à vista e o resto no «Mais», e o raro no «⋯»", () => {
    expect(P).toContain("...SEPARADORES_A_VISTA,");
    expect(P).toContain("SEPARADORES_NO_MAIS.filter((id) => maisAberto || id === separador)");
    expect(P).toContain('aria-label="Mais opções do WhatsApp"');
    expect(P).toContain("{menuAberto && (");
  });

  it("nada deixou de ser alcançável", () => {
    for (const accao of [
      'agir("interromper", l.telefone',
      'agir("retomar", l.telefone)',
      'agir("desfazerRespondida", l.telefone)',
      'agir("bloquear", l.telefone)',
      'agir("desbloquear", l.telefone)',
      'agir("recomecarRecolha", l.telefone)',
      'agir("apagarConversa", l.telefone)',
      'agir("guardar", l.telefone',
      'agir("desguardar", l.telefone)',
      "void pedirLeitura()",
      "void pedirLeitura(l.telefone)",
      'agirNaFila("limparFila")',
      'agirNaFila("descartar", m.id)',
      'agirNaFila("enviada", m.id)',
      "<AvisosDaEquipa token={token} />",
      "<AdminAssistenteAutoPanel />",
    ]) {
      expect(P, accao).toContain(accao);
    }
  });

  it("os selos continuam: o separador mostra a contagem, e o selo da secção soma as atrasadas", () => {
    expect(P).toContain("{contagens[s.id] > 0 && (");
    expect(ler("src/lib/db.ts")).toMatch(/saida\.whatsapp = \(saida\.whatsapp \?\? 0\) \+/);
  });

  it("o cabeçalho da secção numa linha, sem a etiqueta por cima do título", () => {
    const ADMIN = ler("src/components/admin/LegacyAdminClient.tsx");
    const i = ADMIN.indexOf("WhatsApp da plataforma</h2>");
    expect(i).toBeGreaterThan(-1);
    expect(ADMIN.slice(Math.max(0, i - 400), i)).not.toContain("Plataforma\n");
    expect(ADMIN.slice(i, i + 400)).not.toContain("O cérebro que fala com os clientes");
  });
});
