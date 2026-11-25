import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * d33 — A DATA DE CORTE DOS TRABALHOS CLYON EM TODOS OS SÍTIOS QUE DECIDEM O
 * DINHEIRO. Uma função só (`trabalhoClyonDoModeloAntigo`, pela criação do
 * pedido). Cada sítio prova-se dos dois lados do corte com o interruptor
 * DESLIGADO (simulado: `interruptorDosTrabalhosClyonParaOsTestes(false)`), e com
 * ele LIGADO (como está em produção) todos os Trabalhos CLYON ficam no antigo.
 * O dia de cada caso: relógio: datas explícitas (e o do modelo fingido, em baixo).
 */

const agoraFingido = vi.hoisted(() => ({ agora: new Date("2026-11-20T12:00:00Z") }));
vi.mock("./relogio-do-modelo", () => ({ agoraDoModelo: () => agoraFingido.agora }));

const daBase = vi.hoisted(() => ({
  mapa: new Map<number, { ofertaClyon: string | null; valorFixoClyon: string | null; pedidoCriadoEm: Date | string | null }>(),
  perguntados: [] as number[][],
}));
vi.mock("./trabalho-clyon-na-base", async (original) => {
  const real = await original<typeof import("./trabalho-clyon-na-base")>();
  return {
    ...real,
    trabalhosClyonDasNegociacoes: vi.fn(async (ids: ReadonlyArray<number | string | null | undefined>) => {
      const { trabalhosClyonTodosNoModeloAntigo } = await import("./novo-modelo");
      if (trabalhosClyonTodosNoModeloAntigo()) return new Map();
      const n = ids.map(Number);
      daBase.perguntados.push(n);
      return new Map([...daBase.mapa].filter(([id]) => n.includes(id)));
    }),
  };
});

vi.mock("./pagamentos-na-base", () => ({
  pagamentosDaNegociacao: vi.fn(async () => []),
  pagamentosDasNegociacoes: vi.fn(async () => new Map()),
  negociacoesPagas: vi.fn(async () => new Map()),
  negociacoesPagasComDetalhe: vi.fn(async () => new Map()),
}));

import {
  TRABALHOS_CLYON_NO_MODELO_ANTIGO,
  TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE,
  eDoNovoModelo,
  interruptorDosTrabalhosClyonParaOsTestes,
  trabalhoClyonDoModeloAntigo,
} from "./novo-modelo";
import { negociacaoNoNovoModelo } from "./taxa-a-passar-a-clyon";
import { novoModeloComTotais } from "./negociacao-na-vista";
import { negociacaoFechada, type NegociacaoParaRetencao } from "./regras-novas-da-retencao";
import { contratadasNoNovoModelo, negociacoesNoNovoModelo, segueONovoModelo } from "./novo-modelo-no-servidor";
import { trabalhosDaCarteira } from "./carteira-do-profissional";
import { trabalhosClyonDasNegociacoes } from "./trabalho-clyon-na-base";

const DEPOIS = new Date("2026-11-20T12:00:00Z");
/** Criado no último segundo do modelo antigo, e no primeiro do novo. */
const ANTES_DO_CORTE = new Date(TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE.getTime() - 1000);
const NO_CORTE = TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE;

afterEach(() => {
  interruptorDosTrabalhosClyonParaOsTestes(null);
  daBase.mapa.clear();
  daBase.perguntados = [];
});

const desligado = () => interruptorDosTrabalhosClyonParaOsTestes(false);
/** d54: em produção está desligado; os testes do «ligado» provam o lado antigo do interruptor. */
const ligado = () => interruptorDosTrabalhosClyonParaOsTestes(true);

describe("a pergunta única — trabalhoClyonDoModeloAntigo", () => {
  it("em produção o interruptor está desligado desde a d54 (17-11-2026)", () => {
    expect(TRABALHOS_CLYON_NO_MODELO_ANTIGO).toBe(false);
  });

  it("ligado: todo o Trabalho CLYON é do antigo, seja de quando for", () => {
    ligado();
    expect(trabalhoClyonDoModeloAntigo({ ofertaClyon: "directa", pedidoCriadoEm: NO_CORTE }, DEPOIS)).toBe(true);
    expect(trabalhoClyonDoModeloAntigo({ valorFixoClyon: "350.00", pedidoCriadoEm: NO_CORTE }, DEPOIS)).toBe(true);
    expect(eDoNovoModelo({ ofertaClyon: "directa", pedidoCriadoEm: NO_CORTE }, DEPOIS)).toBe(false);
  });

  // d122 (25-11-2026): o de antes do corte por pagar também passa ao novo; só o que já andou fica no antigo.
  it("desligado: antes do corte, por pagar → novo (d122); já andou → antigo; a partir do corte → novo", () => {
    desligado();
    expect(trabalhoClyonDoModeloAntigo({ ofertaClyon: "directa", pedidoCriadoEm: ANTES_DO_CORTE }, DEPOIS)).toBe(false);
    expect(trabalhoClyonDoModeloAntigo({ ofertaClyon: "directa", pedidoCriadoEm: ANTES_DO_CORTE, confirmadoEm: ANTES_DO_CORTE }, DEPOIS)).toBe(true);
    expect(trabalhoClyonDoModeloAntigo({ ofertaClyon: "directa", pedidoCriadoEm: NO_CORTE }, DEPOIS)).toBe(false);
    // O texto sem fuso da base lê-se em UTC.
    expect(trabalhoClyonDoModeloAntigo({ ofertaClyon: "distribuida", pedidoCriadoEm: "2026-11-14 23:59:59", pagoAoProfissionalEm: "2026-11-16 10:00:00" }, DEPOIS)).toBe(true);
    expect(trabalhoClyonDoModeloAntigo({ ofertaClyon: "distribuida", pedidoCriadoEm: "2026-11-15 00:00:00", pagoAoProfissionalEm: "2026-11-16 10:00:00" }, DEPOIS)).toBe(false);
    expect(eDoNovoModelo({ ofertaClyon: "directa", pedidoCriadoEm: ANTES_DO_CORTE }, DEPOIS)).toBe(true);
    expect(eDoNovoModelo({ ofertaClyon: "directa", pedidoCriadoEm: NO_CORTE }, DEPOIS)).toBe(true);
  });

  it("desligado, sem data do pedido: fica no antigo", () => {
    desligado();
    expect(trabalhoClyonDoModeloAntigo({ ofertaClyon: "directa" }, DEPOIS)).toBe(true);
    expect(trabalhoClyonDoModeloAntigo({ ofertaClyon: "directa", pedidoCriadoEm: null }, DEPOIS)).toBe(true);
    expect(eDoNovoModelo({ ofertaClyon: "directa" }, DEPOIS)).toBe(false);
  });

  it("o que não é Trabalho CLYON nunca é «Trabalho CLYON do antigo»", () => {
    expect(trabalhoClyonDoModeloAntigo({ ofertaClyon: null, pedidoCriadoEm: ANTES_DO_CORTE }, DEPOIS)).toBe(false);
    desligado();
    expect(trabalhoClyonDoModeloAntigo({ ofertaClyon: "", valorFixoClyon: null }, DEPOIS)).toBe(false);
  });

  it("um pagamento à CLYON antes de 15-11 continua a deixar no antigo, mesmo criado depois", () => {
    desligado();
    const pago = [{ estado: "pago", pagoEm: new Date("2026-11-14T10:00:00Z"), metodo: "multibanco" }];
    expect(
      negociacaoNoNovoModelo({ ofertaClyon: "directa", pedidoCriadoEm: NO_CORTE }, pago as never, DEPOIS),
    ).toBe(false);
    expect(negociacaoNoNovoModelo({ ofertaClyon: "directa", pedidoCriadoEm: NO_CORTE }, [], DEPOIS)).toBe(true);
    // d122: o de antes do corte, por pagar, passa ao novo.
    expect(negociacaoNoNovoModelo({ ofertaClyon: "directa", pedidoCriadoEm: ANTES_DO_CORTE }, [], DEPOIS)).toBe(true);
  });
});

describe("a vista da negociação — novoModeloComTotais", () => {
  const linha = (pedidoCriadoEm: Date) => ({
    id: 1,
    estado: "acordada",
    ofertaClyon: "directa",
    pedidoCriadoEm,
    valorAcordado: "350.00",
    taxaCliente: "0",
    taxaProfissional: "0.15",
    regimeIva: "normal",
    regimeIvaConfirmadoEm: new Date("2026-11-10T10:00:00Z"),
    propostasJson: "[]",
  });

  it("ligado: um Trabalho CLYON não tem o bloco do modelo novo — nem com o servidor a dizer o contrário", () => {
    ligado();
    expect(novoModeloComTotais(linha(NO_CORTE) as never, 350, DEPOIS)).toBeNull();
    const totais = { porValor: new Map() } as never;
    expect(novoModeloComTotais(linha(NO_CORTE) as never, 350, DEPOIS, { segue: true, totais })).toBeNull();
  });

  it("desligado: o de antes do corte por pagar também tem (d122); o de depois tem", () => {
    desligado();
    expect(novoModeloComTotais(linha(ANTES_DO_CORTE) as never, 350, DEPOIS)).not.toBeNull();
    expect(novoModeloComTotais(linha(NO_CORTE) as never, 350, DEPOIS)).not.toBeNull();
  });

  it("com a resposta do servidor, vale a dele", () => {
    desligado();
    const totais = { porValor: new Map() } as never;
    expect(novoModeloComTotais(linha(NO_CORTE) as never, 350, DEPOIS, { segue: false, totais })).toBeNull();
  });
});

describe("a retenção — negociacaoFechada", () => {
  const n = (pedidoCriadoEm: Date): NegociacaoParaRetencao => ({
    id: 1,
    estado: "acordada",
    valorAcordado: 350,
    execucaoEnviadaEm: new Date("2026-11-18T10:00:00Z"),
    confirmadoEm: new Date("2026-11-18T12:00:00Z"),
    pagoEm: null,
    formaDePagamento: "na_plataforma",
    ofertaClyon: "directa",
    negociacaoCriadaEm: new Date("2026-11-17T10:00:00Z"),
    pedidoCriadoEm,
    clientePagouEm: null,
    comoEntrou: null,
    referenciasVivas: 0,
    pagamentosRecebidos: 0,
    pagamentosDevolvidos: 0,
    movimentos: 0,
  });

  it("ligado: um Trabalho CLYON confirmado fecha (a CLYON recebeu e pagou)", () => {
    ligado();
    expect(negociacaoFechada(n(NO_CORTE))).toBe(true);
  });

  it("desligado: o de antes fecha; o de depois fica aberto enquanto a taxa não entrar", () => {
    desligado();
    expect(negociacaoFechada(n(ANTES_DO_CORTE))).toBe(true);
    expect(negociacaoFechada(n(NO_CORTE))).toBe(false);
    expect(negociacaoFechada({ ...n(NO_CORTE), pagamentosRecebidos: 1 })).toBe(true);
  });

  it("a consulta lê a criação do pedido", () => {
    const sql = readFileSync(join(process.cwd(), "src/lib/regras-novas-na-base.ts"), "utf8");
    expect(sql).toMatch(/SELECT o\.createdAt FROM simulatorOrders o WHERE o\.id = n\.pedidoId\) AS pedidoCriadoEm/);
  });
});

describe("o servidor — negociacoesNoNovoModelo, segueONovoModelo, contratadasNoNovoModelo", () => {
  it("ligado: nenhum Trabalho CLYON passa, e não se vai à base pela data", async () => {
    ligado();
    const s = await negociacoesNoNovoModelo([{ id: 7, estado: "aberta", ofertaClyon: "distribuida" }], DEPOIS);
    expect(s.has(7)).toBe(false);
    expect(daBase.perguntados).toEqual([]);
  });

  // d122: o de antes do corte, por pagar, também segue o novo.
  it("desligado: a data do pedido vem da base — e o de antes, por pagar, também é do novo (d122)", async () => {
    desligado();
    daBase.mapa.set(7, { ofertaClyon: "distribuida", valorFixoClyon: "350.00", pedidoCriadoEm: ANTES_DO_CORTE });
    daBase.mapa.set(8, { ofertaClyon: "distribuida", valorFixoClyon: "350.00", pedidoCriadoEm: NO_CORTE });
    const abertas = await negociacoesNoNovoModelo(
      [
        { id: 7, estado: "aberta", ofertaClyon: "distribuida" },
        { id: 8, estado: "aberta", ofertaClyon: "distribuida" },
      ],
      DEPOIS,
    );
    expect([...abertas].sort()).toEqual([7, 8]);
    // Só com o id (como o «agir como cliente» pergunta): a marca e a data vêm da base.
    expect(await segueONovoModelo({ id: 7, estado: "acordada" }, DEPOIS)).toBe(true);
    expect(await segueONovoModelo({ id: 8, estado: "acordada" }, DEPOIS)).toBe(true);
    const contratadas = await contratadasNoNovoModelo([{ id: 7 }, { id: 8 }], DEPOIS);
    expect([...contratadas].sort()).toEqual([7, 8]);
  });
});

describe("a carteira do profissional — pagoPelaClyon e noNovoModelo", () => {
  const linha = (id: number) => ({
    id,
    pedidoId: 100 + id,
    estado: "acordada",
    valorAcordado: "350.00",
    taxaCliente: "0",
    taxaProfissional: "0.15",
    formaDePagamento: "na_plataforma",
    execucaoEnviadaEm: null,
    confirmadoEm: null,
    pagoEm: null,
    createdAt: new Date("2026-11-17T10:00:00Z"),
    ofertaClyon: "directa",
  });

  it("ligado: a CLYON paga todos os Trabalhos CLYON", async () => {
    ligado();
    const [t] = await trabalhosDaCarteira([linha(8)]);
    expect(t.pagoPelaClyon).toBe(true);
    expect(t.noNovoModelo).toBe(false);
  });

  // d122: o de antes do corte, por pagar, também é do parceiro; só o que já andou a CLYON paga.
  it("desligado: o de antes, por pagar, é do parceiro (d122); o de depois também", async () => {
    desligado();
    daBase.mapa.set(7, { ofertaClyon: "directa", valorFixoClyon: "350.00", pedidoCriadoEm: ANTES_DO_CORTE });
    daBase.mapa.set(8, { ofertaClyon: "directa", valorFixoClyon: "350.00", pedidoCriadoEm: NO_CORTE });
    const [antes, depois] = await trabalhosDaCarteira([linha(7), linha(8)]);
    expect(antes.pagoPelaClyon).toBe(false);
    expect(antes.noNovoModelo).toBe(true);
    expect(depois.pagoPelaClyon).toBe(false);
    expect(depois.noNovoModelo).toBe(true);
  });
});

describe("a leitura da base — trabalhosClyonDasNegociacoes", () => {
  it("com o interruptor ligado devolve vazio sem ir à base", async () => {
    ligado();
    const real = await vi.importActual<typeof import("./trabalho-clyon-na-base")>("./trabalho-clyon-na-base");
    expect((await real.trabalhosClyonDasNegociacoes([1, 2])).size).toBe(0);
    expect(trabalhosClyonDasNegociacoes).toBeDefined();
  });

  it("lê a criação do PEDIDO, e só das negociações de Trabalhos CLYON", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/trabalho-clyon-na-base.ts"), "utf8");
    expect(src).toMatch(/o\.createdAt AS pedidoCriadoEm/);
    expect(src).toMatch(/n\.ofertaClyon IS NOT NULL OR o\.valorFixoClyon IS NOT NULL/);
  });
});

describe("os sítios que decidem o dinheiro passam pela pergunta única", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
  it("as Carteiras do backoffice, a carteira do profissional, a vista e a retenção", () => {
    expect(ler("src/app/api/admin/carteiras/route.ts")).toMatch(/trabalhoClyonDoModeloAntigo\(/);
    expect(ler("src/app/api/admin/carteiras/route.ts")).toMatch(/o\.createdAt AS pedidoCriadoEm/);
    expect(ler("src/lib/carteira-do-profissional.ts")).toMatch(/pagoPelaClyon: trabalhoClyonDoModeloAntigo\(/);
    expect(ler("src/lib/negociacao-na-vista.ts")).not.toMatch(/TRABALHOS_CLYON_NO_MODELO_ANTIGO/);
    expect(ler("src/lib/regras-novas-da-retencao.ts")).toMatch(/trabalhoClyonDoModeloAntigo\(/);
  });
  it("os Pagamentos e o acesso ao pagamento passam a criação do pedido", () => {
    expect(ler("src/lib/trabalhos-para-gerir.ts")).toMatch(/pedidoCriadoEm: \(l\.pedidoCriadoEm/);
    expect(ler("src/lib/acesso-ao-pagamento.ts")).toMatch(/pedidoCriadoEm: \(pedido as/);
    expect(ler("src/lib/avisar-da-proposta.ts")).toMatch(/pedidoCriadoEm: \(pedido as/);
  });
});
