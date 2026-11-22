import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  doNossoLado,
  GRUPOS_QUE_O_SEGUIMENTO_TIRA,
  semOsEmSeguimento,
  type LinhaDoNossoLado,
  type PedidoParaOLado,
  type TrabalhoClyonParaOLado,
} from "./do-nosso-lado";
import { esperaEDoCliente, mapaDoSeguimento, seguimentoEmCurso } from "./seguimento-do-cliente";

/**
 * d83 v2 (CEO e dono, 22-11-2026) — O SEGUIMENTO SAI DE TODA A ESPERA.
 *
 * A d83 tirou da conta do «Precisa de si» os pedidos com o seguimento do
 * cliente a correr. Ficavam a contar no «Do nosso lado» (as conversas por
 * responder, os preços e as propostas por enviar), nos atalhos «Salte para um
 * e a negociação abre já», nos avisos à equipa e no «à espera de si» do
 * Início. Agora todos dizem o mesmo número, pela mesma fonte: o `emCurso` do
 * servidor (`pedidosEmSeguimentoActivo`). Se o cliente escrever depois da
 * marcação, ou o ciclo parar, voltam a contar.
 */

// Domingo, 22-11-2026, às 15:00 em Lisboa (inverno: UTC+0).
const AGORA = new Date("2026-11-22T15:00:00Z");
const ha = (horas: number) => new Date(AGORA.getTime() - horas * 3_600_000).toISOString();

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/** Sem as linhas de comentário (a regra ancorada ao início da linha). */
const semComentarios = (s: string) => s.replace(/^[ \t]*(\*|\/\/|\/\*).*$/gm, "");

const pedido = (o: Partial<PedidoParaOLado> & { id: number }): PedidoParaOLado => ({
  status: "em_negociacao",
  origem: "backoffice",
  contactEmail: null,
  propostaEnviadaEm: null,
  dataAgendada: null,
  negociacoes: [],
  ...o,
});

const trabalho = (o: Partial<TrabalhoClyonParaOLado> & { pedidoId: number }): TrabalhoClyonParaOLado => ({
  estadoDoPedido: "enviado",
  dataAgendada: null,
  propostaEnviadaEm: null,
  negociacoes: [],
  resumo: { fase: "a_espera" },
  ...o,
});

const proposta = (horas: number) => JSON.stringify([{ por: "profissional", valor: 120, criadaEm: ha(horas), estado: "pendente" }]);
const aceite = (horas: number) => ({
  estado: "aguarda_contratacao",
  dataCombinada: null,
  execucaoEnviadaEm: null,
  confirmadoEm: null,
  actualizadaEm: ha(horas),
});

/* As fontes de uma Mesa: o #655 e o #649 com propostas por enviar, o #660 Trabalho CLYON aceite, e as conversas deles. */
const fontes = (emSeguimento: Array<{ pedidoId: number; marcadoEm: string }> | null) =>
  doNossoLado({
    conversas: [
      // O cliente do #655 escreveu há 5 h — ANTES da marcação (há 3 h).
      { telefone: "+351900000655", estado: "por_responder", haSegundos: 5 * 3600, pedido: { id: 655, fechado: false } },
      // O cliente do #649 escreveu há 3 h — DEPOIS da marcação (há 4 h): respondeu.
      { telefone: "+351900000649", estado: "por_responder", haSegundos: 3 * 3600, pedido: { id: 649, fechado: false } },
      { telefone: "+351900000700", estado: "por_responder", haSegundos: 4 * 3600, pedido: { id: 700, fechado: false } },
    ],
    pedidos: [
      pedido({ id: 655, negociacoes: [{ estado: "aberta", propostasJson: proposta(10) }] }),
      pedido({ id: 649, negociacoes: [{ estado: "aberta", propostasJson: proposta(8) }] }),
      pedido({ id: 700, negociacoes: [{ estado: "aberta", propostasJson: proposta(6) }] }),
      // Contratado com a data passada: não é espera do cliente, fica sempre.
      pedido({ id: 640, negociacoes: [{ estado: "acordada", propostasJson: null, dataCombinada: "2026-11-18T09:00:00.000Z" }] }),
    ],
    trabalhosClyon: [trabalho({ pedidoId: 660, resumo: { fase: "escolher" }, negociacoes: [aceite(7)] })],
    emSeguimento,
    agora: AGORA,
  });

const porTipo = (g: ReturnType<typeof doNossoLado>) =>
  Object.fromEntries(g.map((x) => [x.tipo, x.linhas.map((l) => l.pedidoId)]));

describe("1. o «Do nosso lado» sem os pedidos em seguimento", () => {
  it("sem seguimento, conta tudo como antes", () => {
    const g = porTipo(fontes(null));
    expect(g.conversa).toEqual(expect.arrayContaining([655, 649, 700]));
    expect(g.propostas).toEqual(expect.arrayContaining([655, 649, 700]));
    expect(g.preco_clyon).toEqual([660]);
    expect(g.data_passada).toEqual([640]);
  });

  it("os em seguimento saem das propostas e do preço por enviar", () => {
    const g = porTipo(
      fontes([
        { pedidoId: 655, marcadoEm: ha(3) },
        { pedidoId: 649, marcadoEm: ha(4) },
        { pedidoId: 660, marcadoEm: ha(2) },
      ]),
    );
    expect(g.propostas).toEqual([700]);
    expect(g.preco_clyon).toEqual([]);
  });

  it("a conversa sai enquanto o cliente não escreve depois da marcação; se escreveu, volta a contar", () => {
    const g = porTipo(
      fontes([
        { pedidoId: 655, marcadoEm: ha(3) },
        { pedidoId: 649, marcadoEm: ha(4) },
      ]),
    );
    expect(g.conversa).not.toContain(655);
    expect(g.conversa).toEqual(expect.arrayContaining([649, 700]));
  });

  it("a data passada e o fecho ficam: são trabalhos contratados, à espera do parceiro", () => {
    expect(GRUPOS_QUE_O_SEGUIMENTO_TIRA).toEqual(["conversa", "preco_clyon", "propostas", "sem_resposta"]);
    const g = porTipo(fontes([{ pedidoId: 640, marcadoEm: ha(1) }]));
    expect(g.data_passada).toEqual([640]);
  });

  it("uma marcação sem data não tira nada (fica a contar, como antes)", () => {
    const linhas: LinhaDoNossoLado[] = [{ tipo: "propostas", pedidoId: 655, telefone: null, esperaS: 3600, oQue: "" }];
    expect(semOsEmSeguimento(linhas, [{ pedidoId: 655, marcadoEm: "" }], AGORA)).toEqual(linhas);
    expect(semOsEmSeguimento(linhas, [], AGORA)).toEqual(linhas);
  });
});

describe("2. um ciclo parado volta a contar", () => {
  it("parado, arquivado ou cancelado não está em curso — e a lista do servidor deixa-o de fora", () => {
    const base = { voltarEm: new Date(ha(-20)), canal: "whatsapp" as const };
    expect(seguimentoEmCurso(base)).toBe(true);
    expect(seguimentoEmCurso({ ...base, paradoEm: new Date(ha(1)) })).toBe(false);
    expect(seguimentoEmCurso({ ...base, arquivadoEm: new Date(ha(1)) })).toBe(false);
    expect(seguimentoEmCurso({ ...base, canceladoEm: new Date(ha(1)) })).toBe(false);
    // Sem canal (conta de teste, sem contacto): não envia, e conta como sempre.
    expect(seguimentoEmCurso({ ...base, canal: null })).toBe(false);
  });

  it("fora da lista, o pedido volta a todos os grupos", () => {
    const g = porTipo(fontes([]));
    expect(g.propostas).toEqual(expect.arrayContaining([655, 649, 700]));
    expect(g.preco_clyon).toEqual([660]);
  });

  it("esperaEDoCliente: só com o ciclo na lista e sem mensagem do cliente depois da marcação", () => {
    const m = mapaDoSeguimento([{ pedidoId: 655, marcadoEm: ha(3) }]);
    expect(esperaEDoCliente(m, 655)).toBe(true);
    expect(esperaEDoCliente(m, 655, new Date(ha(5)))).toBe(true);
    expect(esperaEDoCliente(m, 655, new Date(ha(1)))).toBe(false);
    expect(esperaEDoCliente(m, 700)).toBe(false);
    expect(esperaEDoCliente(m, null)).toBe(false);
  });
});

describe("3. uma só fonte, em todos os sítios", () => {
  const BASE = semComentarios(ler("src/lib/seguimento-do-cliente-na-base.ts"));
  const PAINEL = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
  const CARTAO = semComentarios(ler("src/components/admin/DoNossoLado.tsx"));
  const AVISOS = semComentarios(ler("src/lib/avisos-a-equipa-na-base.ts"));
  const DB = semComentarios(ler("src/lib/db.ts"));

  it("a lista do servidor sai do mesmo `emCurso` da Mesa", () => {
    expect(BASE).toMatch(/export async function pedidosEmSeguimentoActivo\(\)[^]*?await seguimentoNaMesa\(\)[^]*?\.filter\(\(p\) => p\.emCurso\)/);
    expect(BASE).toContain("marcadoEm: c.marcadoEm.toISOString(),");
  });

  it("os atalhos «Salte para um» não levam os em seguimento", () => {
    expect(PAINEL).toContain("const atalhosDoN1 = aEsperar.filter((p) => !emSeguimento(p.id));");
    expect(PAINEL).toContain('const atalhosClyonDoN1 = clyonDoBloco("n1").filter((t) => !emSeguimento(t.pedidoId));');
    expect(PAINEL).toContain("{atalhosDoN1.map((p) => {");
    expect(PAINEL).toContain("{atalhosClyonDoN1.map((t) => (");
    expect(PAINEL).not.toMatch(/\{aEsperar\.map\(/);
    expect(PAINEL).not.toMatch(/\{clyonDoBloco\("n1"\)\.map\(/);
  });

  it("o cartão do topo recebe os em seguimento da Mesa", () => {
    expect(PAINEL).toContain("emSeguimento={pedidosEmSeguimento}");
    expect(PAINEL).toMatch(/const pedidosEmSeguimento = Object\.values\(seguimentos\)\s*\.filter\(\(s\) => s\.emCurso\)/);
    expect(CARTAO).toMatch(/doNossoLado\(\{[^}]*emSeguimento[^}]*\}\)/);
  });

  it("os avisos à equipa e o «à espera de si» do Início usam a mesma lista", () => {
    expect(AVISOS).toContain("pedidosEmSeguimentoActivo");
    expect(AVISOS).toMatch(/doNossoLado\(\{[^}]*emSeguimento,[^}]*\}\)/);
    expect(DB).toMatch(/m\.pedidosEmSeguimentoActivo\(\)/);
    expect(DB).toContain("AND o.id NOT IN (");
  });
});
