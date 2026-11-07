import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * D13 — A TRANSFERÊNCIA À ESPERA DIZ-SE IGUAL NO SITE, NA APP E NO PAINEL
 * (07-11-2026). Achado das Apps a 03-11: o painel do profissional dizia «O
 * pagamento vem a caminho, por transferência» e a app Pro «Pode ir fazer o
 * trabalho»; e a R5 não passava `transferencia` nem `aEsperaDaTransferencia`,
 * pelo que a app de cliente oferecia MB WAY e Multibanco com uma transferência
 * à espera — o cliente podia pagar duas vezes. Dados de teste.
 */

const EMAIL = "cliente.teste@exemplo.pt";
const CONTA = { iban: "PT50000201231234567890154", titular: "Empresa de Teste" };
type Linha = Record<string, unknown>;
let linhas: Linha[] = [];
let acordado = 700;

vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  contaDaTransferencia: vi.fn(async () => CONTA),
  registarSemFalhar: vi.fn(async () => {}),
}));
vi.mock("@/lib/pagamentos-na-base", async (original) => ({
  ...(await original<typeof import("@/lib/pagamentos-na-base")>()),
  pagamentosDaNegociacao: vi.fn(async () => linhas.map((l) => ({ ...l }))),
}));
vi.mock("@/lib/acesso-ao-pagamento", () => ({
  trabalhoQueSePodePagar: vi.fn(async (pedidoId: number, negociacaoId: number) => ({
    ok: true,
    trabalho: {
      pedidoId,
      negociacaoId,
      providerId: 31,
      profissionalNome: "Parceiro de Teste",
      acordado,
      regime: "normal",
      taxas: { cliente: 0, profissional: 11 },
      formaDePagamento: "na_plataforma",
      acrescimo: 0,
      modelo: "iva_incluido",
      libertado: false,
      porHora: null,
      telefoneDoCliente: null,
      telefoneDoProfissional: null,
      nomeDoCliente: null,
      emailDoCliente: EMAIL,
    },
  })),
}));
vi.mock("@/lib/cliente-auth", () => ({ sessaoDoCliente: vi.fn(async () => null) }));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));

import { GET as estadoDoSite } from "@/app/api/pagamentos/route";
import { pagamentoParaAApp } from "./pedidos-do-cliente";
import { oQueEstaAEspera, METODO_TRANSFERENCIA } from "./transferencia-bancaria";
import { O_PAGAMENTO_VEM_A_CAMINHO_POR_TRANSFERENCIA, TRANSFERENCIA_BANCARIA } from "./palavras-do-pagamento";

const DIA = 86_400_000;
const linha = (extra: Linha): Linha => ({
  id: 1,
  negociacaoId: 900,
  pedidoId: 800,
  providerId: 31,
  metodo: "multibanco",
  estado: "pendente",
  ambiente: "producao",
  valor: 861,
  comFactura: true,
  deTeste: false,
  valorPago: null,
  comissaoEupago: null,
  referencia: null,
  entidade: null,
  transacaoId: null,
  trid: null,
  telemovel: null,
  expiraEm: new Date(Date.now() + 10 * DIA),
  pagoEm: null,
  faturaEmitidaEm: null,
  parte: "trabalho",
  erro: null,
  criadoEm: new Date(),
  actualizadoEm: new Date(),
  ...extra,
});
const transferencia = (extra: Linha = {}) => linha({ metodo: METODO_TRANSFERENCIA, ...extra });

async function osDois() {
  const r = await estadoDoSite(
    new NextRequest("https://clyon.pt/api/pagamentos?pedidoId=800&negociacaoId=900&token=t"),
  );
  expect(r.status).toBe(200);
  const site = await r.json();
  const app = await pagamentoParaAApp(800, { id: 900, estado: "acordada", fase: "a_executar" } as never, EMAIL);
  expect(app).not.toBeNull();
  return { site, app: JSON.parse(JSON.stringify(app)) };
}

beforeEach(() => {
  linhas = [];
  acordado = 700;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("2 — a R5 passa a transferência com o mesmo estado do GET /api/pagamentos", () => {
  it("transferência escolhida e dentro do prazo: à espera nos dois, com os mesmos dados", async () => {
    linhas = [transferencia()];
    const { site, app } = await osDois();
    expect(site.aEsperaDaTransferencia).toBe(true);
    expect(app.aEsperaDaTransferencia).toBe(site.aEsperaDaTransferencia);
    expect(site.transferencia).not.toBeNull();
    expect(app.transferencia).toEqual(site.transferencia);
    expect(app.transferencia.descritivo).toBe("Pedido #800");
  });

  it("e na lista das pendentes da app chama-se «Transferência bancária», nunca o nome da coluna", async () => {
    linhas = [transferencia()];
    const { app } = await osDois();
    expect(app.pendentes).toHaveLength(1);
    expect(app.pendentes[0].metodoTexto).toBe(TRANSFERENCIA_BANCARIA);
  });

  it("ainda sem escolher: a transferência oferece-se nos dois, e não está à espera", async () => {
    const { site, app } = await osDois();
    expect(site.aEsperaDaTransferencia).toBe(false);
    expect(app.aEsperaDaTransferencia).toBe(false);
    expect(app.transferencia).toEqual(site.transferencia);
    expect(site.transferencia).not.toBeNull();
  });

  it("passado o prazo: já não está à espera, em nenhum dos dois", async () => {
    linhas = [transferencia({ expiraEm: new Date(Date.now() - DIA) })];
    const { site, app } = await osDois();
    expect(site.aEsperaDaTransferencia).toBe(false);
    expect(app.aEsperaDaTransferencia).toBe(false);
    expect(app.transferencia).toEqual(site.transferencia);
  });

  it("pago: sem transferência e sem espera, nos dois", async () => {
    linhas = [transferencia({ estado: "pago", pagoEm: new Date(), valorPago: 861 })];
    const { site, app } = await osDois();
    expect(site.pago).toBe(true);
    expect(site.transferencia).toBeNull();
    expect(app.transferencia).toBeNull();
    expect(site.aEsperaDaTransferencia).toBe(false);
    expect(app.aEsperaDaTransferencia).toBe(false);
  });

  it("abaixo do limite: a transferência não se oferece, nos dois", async () => {
    acordado = 200;
    const { site, app } = await osDois();
    expect(site.transferencia).toBeNull();
    expect(app.transferencia).toBeNull();
    expect(app.aEsperaDaTransferencia).toBe(site.aEsperaDaTransferencia);
  });
});

describe("3 — o site (o /pedido/[token] e a /conta) mostra «À espera da transferência», e não as formas de pagar", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
  const semComentarios = (s: string) =>
    s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
  const PAGAR = semComentarios(ler("src/components/PagarTrabalho.tsx"));

  it("com uma transferência à espera, o bloco é o da transferência e não há referência a mostrar", () => {
    const e = oQueEstaAEspera({ pagamentos: [transferencia()] as never, aEsperaDaTransferencia: true });
    expect(e.transferencia).not.toBeNull();
    expect(e.referencia).toBeNull();
  });

  it("passado o prazo (o servidor diz que já não espera): nem transferência, nem referência", () => {
    const e = oQueEstaAEspera({ pagamentos: [transferencia()] as never, aEsperaDaTransferencia: false });
    expect(e).toEqual({ transferencia: null, referencia: null });
  });

  it("se o cliente escolheu depois o MB WAY, é esse (o mais recente) que se mostra", () => {
    const mbway = linha({ id: 2, metodo: "mbway" });
    const e = oQueEstaAEspera({ pagamentos: [mbway, transferencia()] as never, aEsperaDaTransferencia: true });
    expect(e.referencia).toBe(mbway);
    expect(e.transferencia).toBeNull();
  });

  it("o ecrã lê o estado do servidor, e o bloco da transferência vem antes das formas de pagar", () => {
    expect(PAGAR).toContain("oQueEstaAEspera(estado)");
    const espera = PAGAR.indexOf("if (transferenciaPendente && !outroMetodo) {");
    const formas = PAGAR.indexOf("{ qual: \"mbway\", nome: MB_WAY, Icone: Smartphone }");
    expect(espera).toBeGreaterThan(0);
    expect(formas).toBeGreaterThan(espera);
    const bloco = PAGAR.slice(espera, PAGAR.indexOf("if (!aberto && !estado.disponivel) return null;"));
    expect(bloco).toContain("{A_ESPERA_DA_TRANSFERENCIA}");
    expect(bloco).toContain("<DadosDaTransferencia");
    // O MB WAY e o Multibanco só por escolha do cliente, num botão; nunca à vista como se nada estivesse pago.
    expect(bloco).toContain("{OUTRO_METODO}");
    expect(bloco).toContain("setOutroMetodo(true)");
    expect(bloco).not.toContain("MB_WAY,");
    expect(bloco).not.toContain("REFERENCIA_MULTIBANCO");
    expect(PAGAR).toContain("const [outroMetodo, setOutroMetodo] = useState(false);");
    // Com a transferência à espera, ela não volta a aparecer como forma de pagar.
    expect(PAGAR).toContain("estado.transferencia && !transferenciaPendente");
  });

  it("o /pedido/[token] e a /conta pagam pelo mesmo bloco (com a d20, também no Trabalho CLYON)", () => {
    const FIM = semComentarios(ler("src/components/FimDoTrabalhoClyon.tsx"));
    const PROPOSTAS = semComentarios(ler("src/app/pedido/[token]/PropostasRecebidas.tsx"));
    const VISTA = semComentarios(ler("src/app/pedido/[token]/VistaDoPedido.tsx"));
    const CONTA = semComentarios(ler("src/app/conta/components/OrderDetailModal.tsx"));
    expect(FIM).toContain("<PagarTrabalho");
    expect(PROPOSTAS).toContain("<PagarTrabalho");
    for (const ecra of [VISTA, CONTA]) {
      expect(ecra).toContain("<FimDoTrabalhoClyon");
      expect(ecra).toContain("<PropostasRecebidas");
    }
    expect(ler("src/components/PagarTrabalho.tsx")).toContain("fetch(`/api/pagamentos?${params.current}`");
  });
});

describe("1 — a frase do painel é uma só, para o painel e para a app Pro", () => {
  it("a constante tem as duas partes, e a inteira é a soma delas", () => {
    const f = O_PAGAMENTO_VEM_A_CAMINHO_POR_TRANSFERENCIA;
    expect(f.titulo).toBe("O pagamento vem a caminho, por transferência bancária.");
    expect(f.texto).toBe("Não comece o trabalho antes de a CLYON confirmar que recebeu — avisamos assim que entrar.");
    expect(f.inteira).toBe(`${f.titulo} ${f.texto}`);
  });

  it("o painel lê-a, e não tem a frase escrita à mão", () => {
    const PAINEL = readFileSync(join(process.cwd(), "src/app/profissionais/painel/Trabalhos.tsx"), "utf8");
    expect(PAINEL).toContain("{O_PAGAMENTO_VEM_A_CAMINHO_POR_TRANSFERENCIA.titulo}");
    expect(PAINEL).toContain("{O_PAGAMENTO_VEM_A_CAMINHO_POR_TRANSFERENCIA.texto}");
    expect(PAINEL).not.toContain(">O pagamento vem a caminho, por transferência bancária.<");
  });
});
