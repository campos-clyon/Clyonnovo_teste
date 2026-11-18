import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  conversasDoNossoLado,
  doNossoLado,
  type PedidoParaOLado,
  type TrabalhoClyonParaOLado,
} from "./do-nosso-lado";
import { ESTADOS_DE_PEDIDO_FECHADO, pedidoArrumado, pedidoFechado } from "./pedido-arrumado";
import { blocoDoClyonNaMesa } from "./trabalho-clyon-na-mesa";

/**
 * «MESA-SO-PEDIDOS-VIVOS» — 18-11-2026, aprovada pelo CEO e pelo dono.
 *
 * Na Mesa só o que ainda pede a nossa atenção: um pedido cancelado, arquivado,
 * rejeitado (ou apagado, que já não está na base) não aparece no «Do nosso
 * lado» nem nos blocos da lista. Os blocos abrem-se por opção, nascem
 * fechados, e o que se abre fica lembrado no navegador.
 */

const AGORA = new Date("2026-11-18T15:00:00Z");
const ha = (horas: number) => new Date(AGORA.getTime() - horas * 3_600_000).toISOString();
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

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

describe("uma só lista dos estados fechados", () => {
  it("cancelado, arquivado, rejeitado e concluído — e mais nenhum", () => {
    expect([...ESTADOS_DE_PEDIDO_FECHADO].sort()).toEqual(["arquivado", "cancelado", "concluido", "rejeitado"]);
    for (const e of ["cancelado", "arquivado", "rejeitado", "concluido"]) expect(pedidoFechado(e), e).toBe(true);
    for (const e of ["pendente", "enviado", "em_negociacao", "aprovado", null]) expect(pedidoFechado(e), String(e)).toBe(false);
  });

  it("o «Do nosso lado», a mesa das conversas, o fecho e os pedidos por telefone lêem-na, sem listas à mão", () => {
    const LADO = ler("src/lib/do-nosso-lado.ts");
    expect(LADO).toContain('import { pedidoFechado } from "./pedido-arrumado";');
    expect(LADO).not.toMatch(/new Set\(\["cancelado"/);
    expect(ler("src/lib/fecho-do-modelo-novo.ts")).not.toMatch(/new Set\(\["cancelado"/);
    expect(ler("src/lib/mesa-das-conversas.ts")).toContain("const PEDIDO_FECHADO: readonly string[] = ESTADOS_DE_PEDIDO_FECHADO;");
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function pedidosPorTelefoneWhatsApp");
    expect(DB.slice(i, DB.indexOf("O RETRATO DO TELEMÓVEL", i))).toContain("const FECHADOS: readonly string[] = ESTADOS_DE_PEDIDO_FECHADO;");
    // O «Orçamentos novos» também deixa de fora o rejeitado.
    const j = DB.indexOf("export async function pedidosPorPromover");
    expect(DB.slice(j, DB.indexOf("LIMIT ?", j))).toContain("o.status NOT IN ${ESTADOS_DE_PEDIDO_FECHADO_SQL}");
  });
});

describe("1. o «Do nosso lado» só com pedidos vivos", () => {
  it("um pedido arquivado com a conversa por responder não aparece (era o caso do #510)", () => {
    const l = conversasDoNossoLado([
      { telefone: "+351900000001", estado: "por_responder", haSegundos: 5 * 3600, pedido: { id: 510, fechado: true } },
      { telefone: "+351900000002", estado: "por_responder", haSegundos: 5 * 3600, pedido: { id: 511, fechado: false } },
      { telefone: "+351900000003", estado: "por_responder", haSegundos: 5 * 3600, pedido: null },
    ]);
    expect(l.map((x) => x.pedidoId ?? x.telefone)).toEqual([511, "+351900000003"]);
    // A conversa sem pedido continua, com a nota de sempre.
    expect(l[1].oQue).toContain("(sem pedido)");
  });

  it("nenhum bloco conta um pedido fechado", () => {
    const aceite = { estado: "aguarda_contratacao", dataCombinada: null, execucaoEnviadaEm: null, confirmadoEm: null, actualizadaEm: ha(5) };
    const acordadaPassada = { estado: "acordada", dataCombinada: ha(72), execucaoEnviadaEm: null, confirmadoEm: null };
    const pendente = JSON.stringify([{ por: "profissional", estado: "pendente", criadaEm: ha(4), valor: 100 }]);
    for (const estado of ["cancelado", "arquivado", "rejeitado", "concluido"]) {
      const g = doNossoLado({
        conversas: [{ telefone: "+351900000009", estado: "por_responder", haSegundos: 9 * 3600, pedido: { id: 600, fechado: pedidoFechado(estado) } }],
        pedidos: [
          pedido({ id: 601, status: estado, negociacoes: [{ estado: "aberta", propostasJson: pendente }] }),
          pedido({ id: 602, status: estado, negociacoes: [{ estado: "acordada", propostasJson: null, dataCombinada: ha(72) }] }),
          pedido({
            id: 603,
            status: estado,
            negociacoes: [{ estado: "aberta", propostasJson: null, escolhidoPeloCliente: 1, prazoRespostaEm: ha(5) }],
          }),
        ],
        trabalhosClyon: [
          trabalho({ pedidoId: 604, estadoDoPedido: estado, resumo: { fase: "escolher" }, negociacoes: [aceite] }),
          trabalho({ pedidoId: 605, estadoDoPedido: estado, resumo: { fase: "atribuida" }, negociacoes: [acordadaPassada] }),
        ],
        agora: AGORA,
      });
      expect(g.flatMap((x) => x.linhas), estado).toEqual([]);
    }
  });

  it("os mesmos pedidos, vivos, aparecem — a regra não esconde o que pede atenção", () => {
    const pendente = JSON.stringify([{ por: "profissional", estado: "pendente", criadaEm: ha(4), valor: 100 }]);
    const g = doNossoLado({
      conversas: null,
      pedidos: [pedido({ id: 601, negociacoes: [{ estado: "aberta", propostasJson: pendente }] })],
      trabalhosClyon: [
        trabalho({
          pedidoId: 604,
          resumo: { fase: "escolher" },
          negociacoes: [{ estado: "aguarda_contratacao", dataCombinada: null, execucaoEnviadaEm: null, confirmadoEm: null, actualizadaEm: ha(5) }],
        }),
      ],
      agora: AGORA,
    });
    expect(g.flatMap((x) => x.linhas.map((l) => l.pedidoId)).sort()).toEqual([601, 604]);
  });
});

describe("2. e 3. a lista da Mesa sem os arrumados", () => {
  const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");

  it("cancelado, arquivado e rejeitado saem dos blocos vivos — o arquivado já não cai em «À espera de propostas»", () => {
    expect(MESA).toContain("const cancelados = ordenados.filter((p) => pedidoArrumado(p.status));");
    expect(MESA).toContain("(p) => !pedidoArrumado(p.status) && !pedidoConcluido(p),");
    for (const e of ["cancelado", "arquivado", "rejeitado"]) expect(pedidoArrumado(e), e).toBe(true);
  });

  it("um Trabalho CLYON de um pedido arrumado vai aos cancelados, antes de qualquer outra regra", () => {
    // Desde 18-11-2026 pela regra única (trabalho-clyon-na-mesa.ts), com `arrumado` = `pedidoArrumado`.
    expect(MESA).toContain("arrumado: pedidoArrumado(t.estadoDoPedido),");
    expect(
      blocoDoClyonNaMesa({ arrumado: true, bloco: "precisa", fase: "escolher", clienteRespondeu: true, propostaEnviadaEm: ha(5) }),
    ).toBe("cancelados");
  });

  it("o bloco dos cancelados não se desenha na Mesa — só a procurar, para encontrar e reabrir", () => {
    expect(MESA).toContain(
      'const blocosDoModo = BLOCOS.filter((b) => b.visivelEm(mostrar) && (b.chave !== "cancelados" || aProcurar));',
    );
    // O «Geral» e os cartões de cima saem de `blocosDoModo`: não o contam.
    expect(MESA).toContain("blocosDoModo.reduce((soma, b) => soma + quantosNoBloco(b.chave), 0)");
  });
});

describe("4. os blocos abrem-se por opção", () => {
  const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
  const LADO = ler("src/components/admin/DoNossoLado.tsx");
  const MOTIVOS = ler("src/components/admin/MotivosDaSemana.tsx");
  const GANCHO = ler("src/components/admin/useAbertosLembrados.ts");

  it("todos os blocos da lista nascem fechados, e o que se abre fica lembrado", () => {
    expect(MESA).toContain('useAbertosLembrados("clyon.mesa.blocos")');
    expect(MESA).not.toContain("BLOCOS.filter((b) => b.fechadoPorOmissao)");
  });

  it("o «Do nosso lado» e cada grupo dele são um botão, fechado por omissão, com o título e o número", () => {
    expect(LADO).toContain('useAbertosLembrados("clyon.mesa.do-nosso-lado")');
    expect(LADO).toContain('const fechado = !estaAberto("cartao");');
    expect(LADO).toContain("onClick={() => alternar(g.tipo)}");
    expect(LADO).toContain("aria-expanded={grupoAberto}");
    expect(LADO).toContain("{g.titulo}");
    expect(LADO).toContain("· {g.linhas.length}");
  });

  it("os «Fechados nos últimos 7 dias» também", () => {
    expect(MOTIVOS).toContain('useAbertosLembrados("clyon.mesa.motivos-da-semana")');
    expect(MOTIVOS).toContain("{abertoAgora && (");
  });

  it("o navegador lembra com try/catch — sem localStorage, abre e fecha na mesma", () => {
    expect(GANCHO.match(/try \{/g)?.length).toBe(2);
    expect(GANCHO).toContain("window.localStorage.getItem(chaveDoNavegador)");
    expect(GANCHO).toContain("window.localStorage.setItem(chaveDoNavegador");
    expect(GANCHO).toContain("useState<ReadonlySet<string>>(() => new Set())");
  });
});
