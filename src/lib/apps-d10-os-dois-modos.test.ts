import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * D10, PASSO 5 — AS DUAS APPS NOS DOIS MODOS, PELO QUE O SERVIDOR DIZ (14-11-2026).
 *
 * As rotas do site correm com a data simulada (`NOVO_MODELO_DATA_SIMULADA`,
 * `relogio-do-modelo.ts`) e o que devolvem entra nas funções das apps, tal e
 * qual. A 15-11 às 00h30 de Lisboa (= UTC em Novembro) o modelo novo; a 14-11
 * às 23h30, o de hoje. As apps nunca olham para a data do telemóvel: mudar só
 * o relógio do servidor muda tudo.
 */

vi.mock("@/lib/sessao-activa-do-profissional", () => ({ sessaoActivaDoProfissional: vi.fn() }));
vi.mock("@/lib/profissional-auth", () => ({
  tokenDoProfissional: () => "x",
  sessaoVemDaApp: () => true,
  renovarSessaoSePreciso: vi.fn(),
  palavraPasseConfere: vi.fn(),
}));
vi.mock("@/lib/limite-rota-publica", () => ({ limitarRotaPublica: vi.fn(async () => ({})) }));
vi.mock("@/lib/geocodificar", () => ({ geocodificarLocalidade: vi.fn(async () => null) }));
vi.mock("@/lib/sugestao-para-o-profissional", () => ({ margemDeReferenciaPercent: vi.fn(async () => 40) }));
vi.mock("@/lib/db", () => ({
  perfilDoProfissional: vi.fn(),
  avaliacoesDoProfissional: vi.fn(async () => []),
  actualizarPerfilDoProfissional: vi.fn(async () => {}),
  apagarFotosDoBlob: vi.fn(async () => 0),
  fotosDaViatura: vi.fn(async () => []),
  urlDaFotoDaViatura: vi.fn(async () => null),
  invalidarVerificacaoDaGuia: vi.fn(async () => {}),
  custosFixosDeJson: () => null,
  trabalhosConcluidosDoProfissional: vi.fn(async () => 0),
  tarifaDasMudancasDe: vi.fn(async () => null),
  palavraPasseGuardada: vi.fn(),
  negociacoesDoProfissional: vi.fn(async () => []),
  levantamentosDoProfissional: vi.fn(async () => []),
}));
vi.mock("@/lib/carteira-do-profissional", async (original) => ({
  ...(await original<typeof import("@/lib/carteira-do-profissional")>()),
  trabalhosDaCarteira: vi.fn(),
}));
vi.mock("@/lib/pagamentos-na-base", () => ({ pagamentosDaNegociacao: vi.fn(async () => []) }));
vi.mock("@/lib/pagar-ao-parceiro-na-base", () => ({
  congelarRegimeDoProfissional: vi.fn(async (_id: number, regime: string) => regime),
  oQueONovoModeloGravou: vi.fn(async () => ({ pagarAoParceiroPor: "mbway" })),
  gravarComoPagarAoParceiro: vi.fn(async () => true),
}));
vi.mock("@/lib/faturas-do-trabalho-na-base", () => ({ faturasDaNegociacao: vi.fn(async () => []) }));

import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { perfilDoProfissional } from "@/lib/db";
import { trabalhosDaCarteira } from "@/lib/carteira-do-profissional";
import { GET as perfilGET } from "@/app/api/profissionais/perfil/route";
import { GET as carteiraGET } from "@/app/api/profissionais/carteira/route";
import { agoraDoModelo } from "./relogio-do-modelo";
import { novoModeloEmVigor } from "./novo-modelo";
import { rotulosDaCarteira } from "./rotulos-da-carteira";
import { novoModeloNaVista } from "./negociacao-na-vista";
import { oQueOClienteVeDoParceiro } from "./pagar-ao-parceiro-para-o-cliente";
import { totalAoCliente } from "./total-ao-cliente";
import type { TrabalhoNaCarteira } from "./carteira";
import * as pro from "../../app-pro/src/lib/novo-modelo";
import { linhaDaFaturaDoParceiro, vistoDaR5 } from "../../app-cliente/src/lib/pagar-ao-parceiro";
import { estadoDoPagar } from "../../app-cliente/src/lib/pagamento";
import type { Pagamento } from "../../app-cliente/src/lib/pedidos";

const MODELO_NOVO = "2026-11-15T00:30:00Z"; // 00h30 de 15-11 em Lisboa
const MODELO_ANTIGO = "2026-11-14T23:30:00Z"; // 23h30 de 14-11 em Lisboa

const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const dia = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

/** Um profissional aprovado antes de 15-11, com IBAN e MB WAY, mas sem o regime confirmado. */
const PERFIL = {
  id: 7,
  name: "Profissional de Teste",
  email: "pro@exemplo.pt",
  iban: "PT50000201231234567890154",
  ibanTitular: "Profissional de Teste",
  mbway: "912345678",
  regimeIva: "normal",
  regimeIvaConfirmadoEm: null,
  responsavel: null,
  ibanMudadoEm: null,
  estado: "aprovado",
  aprovadoEm: "2026-10-20T10:00:00Z",
};

/** Um trabalho fechado a 15-11, sem nada pago à CLYON: entra no modelo novo. */
function trabalho(noNovoModelo: boolean): TrabalhoNaCarteira {
  return {
    negociacaoId: 900,
    estado: "acordada",
    valorAcordado: 350,
    taxaCliente: 0,
    taxaProfissional: 0.1,
    formaDePagamento: "na_plataforma",
    confirmadoEm: "2026-11-15T00:10:00Z",
    execucaoEnviadaEm: "2026-11-15T00:05:00Z",
    negociacaoCriadaEm: "2026-11-14T12:00:00Z",
    clientePagouEm: null,
    noNovoModelo,
  } as TrabalhoNaCarteira;
}

const pedido = (rota: string) => new NextRequest(`https://clyon.pt${rota}`);

function relogio(iso: string) {
  delete process.env.VERCEL_ENV;
  process.env.NOVO_MODELO_DATA_SIMULADA = iso;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sessaoActivaDoProfissional).mockResolvedValue({ providerId: 7 } as never);
  vi.mocked(perfilDoProfissional).mockResolvedValue({ ...PERFIL } as never);
});

afterEach(() => {
  delete process.env.NOVO_MODELO_DATA_SIMULADA;
});

describe("o relógio do servidor: 15-11 às 00h30 de Lisboa", () => {
  it("a data simulada muda o modelo; em produção é ignorada", () => {
    relogio(MODELO_NOVO);
    expect(novoModeloEmVigor(agoraDoModelo())).toBe(true);
    relogio(MODELO_ANTIGO);
    expect(novoModeloEmVigor(agoraDoModelo())).toBe(false);
    process.env.VERCEL_ENV = "production";
    process.env.NOVO_MODELO_DATA_SIMULADA = "2030-01-01T00:00:00Z";
    expect(agoraDoModelo().getFullYear()).not.toBe(2030);
    delete process.env.VERCEL_ENV;
  });
});

describe("app Pro — o perfil (perfil fiscal, IBAN e MB WAY) pelo GET do servidor", () => {
  it("modelo novo: o aviso do regime leva à Faturação, e a linha fiscal é a que o cliente lê", async () => {
    relogio(MODELO_NOVO);
    const corpo = await (await perfilGET(pedido("/api/profissionais/perfil"))).json();
    const nm = corpo.novoModelo as pro.NovoModeloDoPerfil;
    expect(nm).not.toBeNull();
    expect(nm.regimeIvaConfirmado).toBe(false);
    const aviso = pro.avisoDosDadosParaReceber(nm.dadosParaReceber);
    expect(aviso).toMatchObject({ impede: false, destino: "/conta/faturacao" });
    expect(pro.linhaDoPerfilFiscal(nm.perfilFiscal)).toBe(nm.perfilFiscal.fatura);
    expect(nm.perfilFiscal.tipoDeFatura).toBe("a_confirmar");
  });

  it("modelo novo, sem IBAN nem MB WAY: o aviso leva aos dados para receber", async () => {
    relogio(MODELO_NOVO);
    vi.mocked(perfilDoProfissional).mockResolvedValue({ ...PERFIL, iban: null, mbway: null, regimeIvaConfirmadoEm: "2026-11-14T10:00:00Z" } as never);
    const corpo = await (await perfilGET(pedido("/api/profissionais/perfil"))).json();
    const aviso = pro.avisoDosDadosParaReceber((corpo.novoModelo as pro.NovoModeloDoPerfil).dadosParaReceber);
    expect(aviso?.destino).toBe("/conta/banco");
    expect((corpo.novoModelo as pro.NovoModeloDoPerfil).perfilFiscal.tipoDeFatura).toBe("com_iva");
  });

  it("modelo antigo: o servidor não manda nada novo, e a app não avisa", async () => {
    relogio(MODELO_ANTIGO);
    const corpo = await (await perfilGET(pedido("/api/profissionais/perfil"))).json();
    expect(corpo.novoModelo).toBeNull();
    expect(pro.avisoDosDadosParaReceber(corpo.novoModelo?.dadosParaReceber)).toBeNull();
  });
});

describe("app Pro — a carteira (valor em atraso, stand-by) pelo GET do servidor", () => {
  it("modelo novo: a taxa e o IVA dela em atraso, «Pagar o valor em atraso» e o prazo dos 4 dias", async () => {
    relogio(MODELO_NOVO);
    vi.mocked(trabalhosDaCarteira).mockResolvedValue([trabalho(true)]);
    const corpo = await (await carteiraGET(pedido("/api/profissionais/carteira"))).json();
    const nm = corpo.novoModelo as pro.NovoModeloDaCarteira;
    expect(nm?.emVigor).toBe(true);
    expect(nm.standBy).toBeNull();
    expect(nm.valores).toHaveLength(1);
    const v = nm.valores[0];
    // 350 € a 10 %: taxa 35 € + IVA 8,05 € = 43,05 € (o mesmo do euPago).
    expect(v.total).toBe(43.05);
    expect(pro.partesDoValorEmAtraso(v, euros)).toBe("Taxa da plataforma 35,00 € + IVA 8,05 €");
    expect(dia(v.prazoAte)).toBe("2026-11-19");
    expect(pro.passouDoPrazo(v.prazoAte, Date.parse(MODELO_NOVO))).toBe(false);
    const faixa = pro.faixaDoValorEmAtraso(nm, euros, dia);
    expect(faixa).toMatchObject({ standBy: false, botao: "Pagar o valor em atraso" });
    expect(faixa?.titulo).toContain("43,05 €");
    // Sai da lista antiga das dívidas; e as notas da carteira são as do painel no modelo novo.
    expect(pro.negociacoesDoValorEmAtraso(nm).has(900)).toBe(true);
    expect(rotulosDaCarteira(nm != null)).toEqual(rotulosDaCarteira(true));
  });

  it("modelo novo, passados os 4 dias: stand-by com a frase do servidor e o mesmo botão", async () => {
    relogio("2026-11-20T10:00:00Z");
    vi.mocked(trabalhosDaCarteira).mockResolvedValue([trabalho(true)]);
    const corpo = await (await carteiraGET(pedido("/api/profissionais/carteira"))).json();
    const nm = corpo.novoModelo as pro.NovoModeloDaCarteira;
    expect(nm.standBy).not.toBeNull();
    const faixa = pro.faixaDoValorEmAtraso(nm, euros, dia);
    expect(faixa).toMatchObject({ standBy: true, texto: nm.standBy?.explicacao, botao: "Pagar o valor em atraso" });
    // O 403 que o servidor dá ao aceitar ou propor leva à carteira.
    expect(pro.impedimentoDoErro({ standBy: true, accao: nm.standBy?.accao })).toEqual({ botao: "Pagar o valor em atraso", destino: "/carteira" });
  });

  it("modelo antigo: sem novoModelo, sem faixa, as notas de sempre", async () => {
    relogio(MODELO_ANTIGO);
    vi.mocked(trabalhosDaCarteira).mockResolvedValue([trabalho(false)]);
    const corpo = await (await carteiraGET(pedido("/api/profissionais/carteira"))).json();
    expect(corpo.novoModelo).toBeNull();
    expect(pro.faixaDoValorEmAtraso(corpo.novoModelo, euros, dia)).toBeNull();
    expect(pro.negociacoesDoValorEmAtraso(corpo.novoModelo).size).toBe(0);
    expect(rotulosDaCarteira(corpo.novoModelo != null)).toEqual(rotulosDaCarteira(false));
  });
});

describe("app de cliente — escolher, pagar ao parceiro e as duas faturas, pelo servidor", () => {
  const linha = {
    id: 1,
    estado: "aberta",
    regimeIva: "isento",
    regimeIvaConfirmadoEm: "2026-11-13T00:00:00Z",
    propostasJson: JSON.stringify([{ por: "profissional", valor: 350, criadaEm: "x", estado: "activa" }]),
    taxaCliente: 0,
    taxaProfissional: 0.1,
  };

  it("ao escolher: o tipo de fatura de cada parceiro só no modelo novo", () => {
    const novo = novoModeloNaVista(linha, null, new Date(MODELO_NOVO));
    expect(linhaDaFaturaDoParceiro(novo)).toBe("Fatura com isenção de IVA (art. 53.º)");
    expect(linhaDaFaturaDoParceiro(novoModeloNaVista(linha, null, new Date(MODELO_ANTIGO)))).toBeNull();
  });

  it("depois de contratar: o bloco do servidor desenha-se tal e qual — IBAN, MB WAY, como pagar, duas faturas e o mesmo total", async () => {
    vi.mocked(perfilDoProfissional).mockResolvedValue({ ...PERFIL, regimeIva: "isento", regimeIvaConfirmadoEm: "2026-11-13T00:00:00Z" } as never);
    const visto = vistoDaR5(
      await oQueOClienteVeDoParceiro({ pedidoId: 5, negociacaoId: 1, providerId: 7, acordado: 350, taxas: { cliente: 0, profissional: 0.1 }, profissionalNome: "Parceiro" } as never),
    );
    expect(visto).not.toBeNull();
    expect(visto?.paraPagar).toEqual({ iban: PERFIL.iban, titular: PERFIL.ibanTitular, mbway: PERFIL.mbway });
    expect(visto?.perfilFiscal?.fatura).toBe("Fatura com isenção de IVA (art. 53.º)");
    expect(visto?.opcoes?.map((o) => o.id)).toEqual(expect.arrayContaining(["transferencia", "mbway"]));
    expect(visto?.opcoes?.every((o) => o.curta && o.cliente)).toBe(true);
    expect(visto?.comoPagar).toBe("mbway");
    expect(visto?.faturas?.frase).toBeTruthy();
    expect(visto?.faturas).toMatchObject({ daTaxa: null, doTrabalho: null });
    // O total é o do site (total-ao-cliente.ts): 358,05 € com o parceiro isento.
    const site = totalAoCliente(350, { cliente: 0, profissional: 0.1 }, "isento");
    expect(visto?.conta?.total).toBe(site?.total);
    expect(visto?.conta?.total).toBe(358.05);
    expect(visto?.totalEmTexto).toContain("358,05 €");
  });

  it("sem caução no modelo novo; no antigo o pagamento de sempre", () => {
    const base = { pago: false, pendentes: [], disponivel: true, emDinheiroAoProfissional: false } as unknown as Pagamento;
    expect(estadoDoPagar({ ...base, pagaAoParceiro: true }, Date.parse(MODELO_NOVO)).tipo).toBe("ao-parceiro");
    expect(estadoDoPagar({ ...base, pagaAoParceiro: false }, Date.parse(MODELO_ANTIGO)).tipo).toBe("por-pagar");
    // A rota no modelo antigo diz só { pagaAoParceiro: false }: o bloco não desenha nada.
    expect(vistoDaR5({ pagaAoParceiro: false })).toBeNull();
  });
});
