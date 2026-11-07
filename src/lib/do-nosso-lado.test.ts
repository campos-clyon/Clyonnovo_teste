import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  conversasDoNossoLado,
  datasPassadasDoNossoLado,
  doNossoLado,
  DUAS_HORAS_S,
  precosClyonDoNossoLado,
  propostasDoNossoLado,
  type PedidoParaOLado,
  type TrabalhoClyonParaOLado,
} from "./do-nosso-lado";

/**
 * «DO NOSSO LADO» — d14 (03-11-2026, aprovada pelo dono a 04-11). O cartão do
 * topo da Mesa diz o que espera pela CLYON: conversas com o cliente a falar por
 * último há mais de 2 h, Trabalhos CLYON aceites com o preço por enviar,
 * propostas por enviar e trabalhos com a data passada sem «Está feito». Cada
 * linha com o n.º do pedido e há quanto tempo, e abre o pedido. Só leitura.
 */

// Terça, 03-11-2026, às 15:00 em Lisboa (inverno: UTC+0).
const AGORA = new Date("2026-11-03T15:00:00Z");
const ha = (horas: number) => new Date(AGORA.getTime() - horas * 3_600_000).toISOString();

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

describe("1. as conversas em que o cliente falou por último há mais de 2 h", () => {
  const linhas = [
    { telefone: "+351900000001", estado: "por_responder", haSegundos: 3 * 3600, pedido: { id: 514, fechado: false } },
    { telefone: "+351900000002", estado: "por_responder", haSegundos: 30 * 60, pedido: null },
    { telefone: "+351900000003", estado: "por_responder", haSegundos: 26 * 3600, pedido: null },
    { telefone: "+351900000004", estado: "a_espera", haSegundos: 9 * 3600, pedido: null },
    { telefone: "+351900000005", estado: "resolvida", haSegundos: 9 * 3600, pedido: null },
  ];
  const l = conversasDoNossoLado(linhas);

  it("só o «Por responder», e só depois das 2 h", () => {
    expect(DUAS_HORAS_S).toBe(7200);
    expect(l.map((x) => x.pedidoId ?? x.telefone)).toEqual([514, "+351900000003"]);
  });

  it("com pedido leva o número; sem pedido, o telefone para abrir a conversa", () => {
    expect(l[0]).toMatchObject({ pedidoId: 514, telefone: null, esperaS: 3 * 3600 });
    expect(l[1]).toMatchObject({ pedidoId: null, telefone: "+351900000003" });
  });

  it("sem acesso às conversas (null), o grupo fica vazio e o resto continua", () => {
    const g = doNossoLado({ conversas: null, pedidos: [], trabalhosClyon: [], agora: AGORA });
    expect(g.map((x) => x.tipo)).toEqual(["conversa", "preco_clyon", "propostas", "data_passada"]);
    expect(g[0].linhas).toEqual([]);
  });

  it("as dos últimos 3 dias à frente das antigas, como no «Por responder»", () => {
    const g = doNossoLado({
      conversas: [
        { telefone: "a", estado: "por_responder", haSegundos: 8 * 86400, pedido: null },
        { telefone: "b", estado: "por_responder", haSegundos: 5 * 3600, pedido: null },
        { telefone: "c", estado: "por_responder", haSegundos: 30 * 3600, pedido: null },
      ],
      pedidos: [],
      trabalhosClyon: [],
      agora: AGORA,
    });
    expect(g[0].linhas.map((x) => x.telefone)).toEqual(["c", "b", "a"]);
  });
});

describe("2. os Trabalhos CLYON aceites, com o preço por enviar", () => {
  const aceite = (horas: number) => ({
    estado: "aguarda_contratacao",
    dataCombinada: null,
    execucaoEnviadaEm: null,
    confirmadoEm: null,
    actualizadaEm: ha(horas),
  });

  it("fase «escolher» sem proposta enviada: entra, desde o primeiro «aceitou»", () => {
    const l = precosClyonDoNossoLado(
      [trabalho({ pedidoId: 514, resumo: { fase: "escolher" }, negociacoes: [aceite(144), aceite(120), aceite(130)] })],
      AGORA,
    );
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ pedidoId: 514, esperaS: 144 * 3600 });
    expect(l[0].oQue).toContain("3 parceiros aceitaram");
  });

  it("com o preço já enviado, ou ainda à espera de quem aceite, não entra", () => {
    expect(
      precosClyonDoNossoLado(
        [
          trabalho({ pedidoId: 1, resumo: { fase: "escolher" }, propostaEnviadaEm: ha(2), negociacoes: [aceite(5)] }),
          trabalho({ pedidoId: 2, resumo: { fase: "a_espera" } }),
          trabalho({ pedidoId: 3, resumo: { fase: "escolher" }, estadoDoPedido: "arquivado", negociacoes: [aceite(5)] }),
        ],
        AGORA,
      ),
    ).toEqual([]);
  });
});

describe("3. as propostas de parceiros por enviar ao cliente", () => {
  const proposta = (horas: number, estado = "pendente") =>
    JSON.stringify([{ por: "profissional", valor: 120, criadaEm: ha(horas), estado }]);

  it("um pedido que a CLYON negoceia, com proposta pendente e o orçamento por enviar", () => {
    const l = propostasDoNossoLado(
      [
        pedido({
          id: 552,
          negociacoes: [
            { estado: "aberta", propostasJson: proposta(10) },
            { estado: "aberta", propostasJson: proposta(4) },
          ],
        }),
      ],
      AGORA,
    );
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ pedidoId: 552, esperaS: 10 * 3600 });
    expect(l[0].oQue).toContain("2 propostas");
  });

  it("com o orçamento enviado depois das propostas, já não espera por nós; uma proposta nova volta a pôr", () => {
    const enviado = pedido({ id: 1, propostaEnviadaEm: ha(3), negociacoes: [{ estado: "aberta", propostasJson: proposta(10) }] });
    expect(propostasDoNossoLado([enviado], AGORA)).toEqual([]);
    const nova = pedido({ id: 2, propostaEnviadaEm: ha(3), negociacoes: [{ estado: "aberta", propostasJson: proposta(1) }] });
    expect(propostasDoNossoLado([nova], AGORA).map((x) => x.pedidoId)).toEqual([2]);
  });

  it("o cliente que negoceia sozinho (com email) recebe pelo link: não é por enviar", () => {
    const sozinho = pedido({
      id: 3,
      origem: "hero_quote_form",
      contactEmail: "cliente@exemplo.pt",
      negociacoes: [{ estado: "aberta", propostasJson: proposta(10) }],
    });
    expect(propostasDoNossoLado([sozinho], AGORA)).toEqual([]);
  });

  it("um parceiro que aceitou o valor e falta contratar também espera por nós", () => {
    const l = propostasDoNossoLado(
      [pedido({ id: 4, negociacoes: [{ estado: "aguarda_contratacao", propostasJson: proposta(6, "aceite") }] })],
      AGORA,
    );
    expect(l.map((x) => x.pedidoId)).toEqual([4]);
  });

  it("cancelados, concluídos e feitos por confirmar ficam de fora", () => {
    expect(
      propostasDoNossoLado(
        [
          pedido({ id: 5, status: "cancelado", negociacoes: [{ estado: "aberta", propostasJson: proposta(10) }] }),
          pedido({
            id: 6,
            negociacoes: [
              { estado: "acordada", propostasJson: null, execucaoEnviadaEm: ha(5) },
              { estado: "aberta", propostasJson: proposta(10) },
            ],
          }),
        ],
        AGORA,
      ),
    ).toEqual([]);
  });
});

describe("4. os trabalhos com a data passada e sem «Está feito»", () => {
  it("o dia passou e ninguém disse «Está feito» — a regra do «atrasado» da Agenda", () => {
    const l = datasPassadasDoNossoLado(
      [
        pedido({ id: 515, negociacoes: [{ estado: "acordada", propostasJson: null, dataCombinada: "2026-10-29T13:00:00.000Z" }] }),
        pedido({ id: 7, negociacoes: [{ estado: "acordada", propostasJson: null, dataCombinada: "2026-11-05T09:00:00.000Z" }] }),
        pedido({
          id: 8,
          negociacoes: [{ estado: "acordada", propostasJson: null, dataCombinada: "2026-10-30T09:00:00.000Z", execucaoEnviadaEm: ha(90) }],
        }),
      ],
      [],
      AGORA,
    );
    expect(l.map((x) => x.pedidoId)).toEqual([515]);
    expect(l[0].oQue).toContain("há 5 dias");
  });

  it("hoje, 3 h depois da hora marcada; antes disso, ainda pode estar a decorrer", () => {
    const hoje = (hora: string) =>
      pedido({ id: Number(hora.slice(0, 2)), negociacoes: [{ estado: "acordada", propostasJson: null, dataCombinada: `2026-11-03T${hora}:00.000Z` }] });
    expect(datasPassadasDoNossoLado([hoje("11:00"), hoje("13:00")], [], AGORA).map((x) => x.pedidoId)).toEqual([11]);
  });

  it("nos Trabalhos CLYON atribuídos também, pelo dia do pedido quando não há dia combinado", () => {
    const l = datasPassadasDoNossoLado(
      [],
      [
        trabalho({
          pedidoId: 474,
          resumo: { fase: "atribuida" },
          dataAgendada: "2026-11-01T10:00:00.000Z",
          negociacoes: [{ estado: "acordada", dataCombinada: null, execucaoEnviadaEm: null, confirmadoEm: null }],
        }),
        trabalho({
          pedidoId: 475,
          resumo: { fase: "por_confirmar" },
          dataAgendada: "2026-11-01T10:00:00.000Z",
          negociacoes: [{ estado: "acordada", dataCombinada: null, execucaoEnviadaEm: ha(40), confirmadoEm: null }],
        }),
      ],
      AGORA,
    );
    expect(l.map((x) => x.pedidoId)).toEqual([474]);
  });
});

describe("o cartão na Mesa", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
  const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
  const CARTAO = ler("src/components/admin/DoNossoLado.tsx");
  const ROTA = ler("src/app/api/admin/whatsapp/route.ts");

  it("fica no topo da Mesa, antes da procura e dos blocos, com a mesa inteira que está carregada", () => {
    const i = MESA.indexOf("<DoNossoLado");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(MESA.indexOf('aria-label="Procurar em toda a mesa"'));
    const bloco = MESA.slice(i, MESA.indexOf("/>", MESA.indexOf("}}", i)) + 2);
    expect(bloco).toContain("pedidos={pedidos}");
    expect(bloco).toContain("trabalhosClyon={trabalhosClyon}");
    // Cada linha abre o pedido: procura-o pelo número.
    expect(bloco).toContain("setBusca(`#${id}`)");
  });

  it("é só leitura: não escreve nada (sem POST, PATCH nem DELETE)", () => {
    expect(CARTAO).not.toMatch(/method:\s*"(POST|PATCH|PUT|DELETE)"/);
    expect(CARTAO).toContain('fetch("/api/admin/whatsapp?so=mesa"');
  });

  it("cada linha mostra o n.º do pedido e há quanto tempo espera", () => {
    expect(CARTAO).toContain("`#${l.pedidoId}`");
    expect(CARTAO).toContain("haQuantoEspera(l.esperaS)");
  });

  it("a mesa das conversas lê-se sozinha, pela mesma regra, sem o texto das mensagens", () => {
    const i = ROTA.indexOf('searchParams.get("so") === "mesa"');
    expect(i).toBeGreaterThan(-1);
    const bloco = ROTA.slice(i, ROTA.indexOf("const { saudeDaCompreensao", i));
    expect(bloco).toContain("mesaComOTelemovelWhatsApp()");
    expect(bloco).not.toContain("ultimaMensagem");
  });
});
