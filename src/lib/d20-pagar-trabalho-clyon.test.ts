import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fimDoTrabalhoClyonParaOCliente, O_PARCEIRO_COMBINA_O_DIA, type LinhaDoTrabalhoClyon } from "./fim-do-trabalho-clyon";
import { notaDoPrecoParaOCliente, avisoDosItens, contaPelaTabelaDasPecas } from "./itens-a-mais";
import { precoClyonParaOCliente } from "./preco-clyon-para-o-cliente";
import { comOLink, linkParaPagar, mensagemDosValoresParaPagamento, LINK_POR_GERAR } from "./valores-para-pagamento";

/**
 * D20 — O LINK DO «ENVIAR VALORES PARA PAGAMENTO» ABRE NUM ECRÃ QUE SE PAGA
 * (05-11-2026). Visto pelo dono num Trabalho CLYON de valor fixo, uma mudança,
 * com o parceiro escolhido e por pagar: o ecrã pedia «Aceito este preço»,
 * mostrava «Ainda sem propostas», «A CLYON combina o dia consigo» com o dia
 * marcado, e a nota da tabela das peças numa mudança.
 *
 * v2 (o dono): *«Não deve ter aceitar, pois já foi acordado anteriormente.»*
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const VISTA = semComentarios(ler("src/app/pedido/[token]/VistaDoPedido.tsx"));
const PAGINA = semComentarios(ler("src/app/pedido/[token]/page.tsx"));
const FIM = semComentarios(ler("src/components/FimDoTrabalhoClyon.tsx"));
const CONTA = semComentarios(ler("src/app/conta/components/OrderDetailModal.tsx"));
const DA_CONTA = semComentarios(ler("src/lib/pedidos-da-conta.ts"));
const ROTA = semComentarios(ler("src/app/api/admin/trabalhos-clyon/route.ts"));

const PEDIDO = { valorFixoClyon: 725, taxaClyon: 0.15, dataAgendada: null as Date | string | null };
const linha = (extra: Partial<LinhaDoTrabalhoClyon> = {}): LinhaDoTrabalhoClyon => ({
  id: 9001,
  estado: "acordada",
  valorAcordado: 725,
  profissionalNome: "Empresa Inventada",
  parceiroVerificado: 1,
  dataCombinada: null,
  execucaoEnviadaEm: null,
  confirmadoEm: null,
  pagoEm: null,
  estrelas: null,
  avaliadoEm: null,
  ...extra,
});

describe("1 — com o parceiro escolhido, o preço já foi acordado: sem «Aceito», e logo as formas de pagar", () => {
  it("o link não desenha o cartão do «Aceito» quando o Trabalho CLYON tem parceiro", () => {
    expect(VISTA).toMatch(/\{!fimClyon && \(\(\) => \{\s*const preco = precoClyonParaOCliente/);
  });

  it("o fim do Trabalho CLYON mostra o preço só para ler, nunca com «Aceito»", () => {
    expect(FIM).not.toMatch(/Aceito/);
    expect(FIM).toContain("<PrecoDaClyon preco={preco} enviarPara={null} podeAceitar={false} />");
    // O cartão do preço sai quando o bloco de pagar (preço, IVA, total e formas de pagar) está à vista.
    expect(FIM).toContain("{preco && !blocoAVista && <PrecoDaClyon");
    expect(FIM).toContain("aoDecidir={aoDecidir}");
  });

  it("as formas de pagar ficam à vista também depois de feito, enquanto não estiver pago", () => {
    const i = FIM.indexOf("<PagarTrabalho");
    const bloco = FIM.slice(i, FIM.indexOf("/>", i));
    expect(bloco).not.toContain("soSePago");
    expect(bloco).toContain("soParaVer={soParaVer}");
    expect(bloco).not.toContain("!token");
  });

  it("um Trabalho CLYON confirmado tem um pagamento à espera: podePagar no modelo com taxa", () => {
    const f = fimDoTrabalhoClyonParaOCliente(PEDIDO, [
      linha({ execucaoEnviadaEm: "2026-11-05T15:00:00Z", confirmadoEm: "2026-11-05T17:53:00Z" }),
    ])!;
    expect(f.fase).toBe("confirmado");
    expect(f.podePagar).toBe(true);
  });

  it("na conta é o mesmo: o fim com o pagamento, e o «Aceito» só sem parceiro", () => {
    expect(CONTA).toMatch(/\{order\.fimClyon && \(\s*<FimDoTrabalhoClyon/);
    expect(CONTA).toContain("{order.precoClyon && !order.fimClyon && (");
    expect(DA_CONTA).toContain("fimDoTrabalhoClyonParaOCliente(");
  });

  it("o «Aceito este preço» continua onde o preço ainda não foi acordado (sem parceiro)", () => {
    const P = semComentarios(ler("src/components/PrecoDaClyon.tsx"));
    expect(P).toContain("Aceito este preço");
    // A app (R5) só recebe a acção sem parceiro contratado.
    const R5 = semComentarios(ler("src/lib/pedidos-do-cliente.ts"));
    expect(R5).toMatch(/trabalhoClyon && enviadoEm && !o\.precoAceiteEm && !contratado && !cancelado\s*\? \["aceitar_preco_clyon"\]/);
  });

  it("o ?pagar=1 abre o ecrã no pagamento", () => {
    expect(PAGINA).toContain("searchParams");
    expect(PAGINA).toMatch(/=== "1"/);
    expect(PAGINA).toContain("focarNoPagamento={focarNoPagamento}");
    expect(VISTA).toContain("focarNoPagamento={focarNoPagamento}");
    expect(FIM).toContain('id="pagar"');
    expect(FIM).toContain("scrollIntoView");
  });
});

describe("2 — o bloco «Propostas» não aparece num Trabalho CLYON", () => {
  it("o link só desenha as propostas fora dos Trabalhos CLYON", () => {
    expect(VISTA).toMatch(/\{pedido\.valorFixoClyon == null && \(\s*<PropostasRecebidas/);
  });

  it("e na conta só com propostas (um pedido com parceiro escolhido não diz «Ainda sem propostas»)", () => {
    expect(CONTA).toMatch(/\{propostas\.length > 0 && \(\s*<PropostasRecebidas/);
  });
});

describe("3 — o dia marcado, em hora de Lisboa", () => {
  it("o dia combinado com o parceiro", () => {
    const f = fimDoTrabalhoClyonParaOCliente(PEDIDO, [linha({ dataCombinada: "2026-11-05T10:00:00Z" })])!;
    expect(f.textos.dia).toBe("Dia marcado: quinta-feira, 5 de novembro, às 10:00");
    expect(f.textos.dia).not.toBe(O_PARCEIRO_COMBINA_O_DIA);
  });

  it("sem dia na negociação, o dia do pedido — o mesmo das mensagens da equipa", () => {
    const f = fimDoTrabalhoClyonParaOCliente({ ...PEDIDO, dataAgendada: "2026-11-05T10:00:00Z" }, [linha()])!;
    expect(f.textos.dia).toBe("Dia marcado: quinta-feira, 5 de novembro, às 10:00");
  });

  it("no Verão, a hora de Lisboa (UTC+1)", () => {
    const f = fimDoTrabalhoClyonParaOCliente(PEDIDO, [linha({ dataCombinada: "2026-07-09T08:30:00Z" })])!;
    expect(f.textos.dia).toBe("Dia marcado: quinta-feira, 9 de julho, às 09:30");
  });

  it("sem dia nenhum, a CLYON combina-o", () => {
    const f = fimDoTrabalhoClyonParaOCliente(PEDIDO, [linha()])!;
    expect(f.textos.dia).toBe(O_PARCEIRO_COMBINA_O_DIA);
  });
});

describe("4 — a avaliação só depois de o trabalho estar feito e confirmado", () => {
  it("por fazer, ou com o «Está feito» do parceiro ainda por confirmar: sem avaliação", () => {
    expect(fimDoTrabalhoClyonParaOCliente(PEDIDO, [linha()])!.podeAvaliar).toBe(false);
    expect(
      fimDoTrabalhoClyonParaOCliente(PEDIDO, [linha({ execucaoEnviadaEm: "2026-11-05T15:00:00Z" })])!.podeAvaliar,
    ).toBe(false);
  });

  it("confirmado como feito: pode avaliar", () => {
    const f = fimDoTrabalhoClyonParaOCliente(PEDIDO, [
      linha({ execucaoEnviadaEm: "2026-11-05T15:00:00Z", confirmadoEm: "2026-11-05T17:53:00Z" }),
    ])!;
    expect(f.podeAvaliar).toBe(true);
  });

  it("o ecrã só pergunta «Como correu» com o trabalho confirmado", () => {
    expect(FIM).toMatch(/\{confirmado && \(\s*<div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-left">/);
    expect(FIM).toContain("fim.podeAvaliar ?");
  });
});

describe("5 — a tabela das peças só na recolha de móveis", () => {
  it("numa mudança fica a nota do serviço", () => {
    const n = notaDoPrecoParaOCliente("total", "clyon", "mudanca");
    expect(n).not.toContain("tabela das peças");
    expect(n).toContain("mudança");
    expect(avisoDosItens("total", "cliente", "mudanca")).not.toContain("15 €");
  });

  it("nos outros serviços também", () => {
    for (const s of ["esvaziamento_casa", "recolha_entulho", "manutencao_casa", null]) {
      expect(notaDoPrecoParaOCliente("total", "clyon", s)).not.toContain("tabela das peças");
    }
  });

  it("na recolha de móveis, a tabela das peças", () => {
    expect(contaPelaTabelaDasPecas("recolha_moveis")).toBe(true);
    expect(notaDoPrecoParaOCliente("total", "clyon", "recolha_moveis")).toContain("tabela das peças");
  });

  it("o preço de um Trabalho CLYON de mudança, no ecrã, sem a tabela das peças", () => {
    const p = precoClyonParaOCliente({
      valorFixoClyon: 725,
      taxaClyon: 0.15,
      propostaEnviadaEm: "2026-11-04T10:00:00Z",
      baseDoPreco: "total",
      serviceType: "mudanca",
    })!;
    expect(p.nota).not.toContain("tabela das peças");
    expect(p.principal).toContain("891,75");
  });

  it("o link e a app passam o serviço", () => {
    expect(VISTA).toContain('avisoDosItens(base, "cliente", pedido.serviceType ?? null)');
    const R5 = semComentarios(ler("src/lib/pedidos-do-cliente.ts"));
    expect(R5).toContain('notaDoPrecoParaOCliente(base, "clyon", pedido.serviceType ?? null)');
    expect(R5).toContain('avisoDosItens(base, "cliente", pedido.serviceType ?? null)');
  });
});

describe("7 — a mensagem da d19 leva o link com ?pagar=1", () => {
  const LINK = "https://clyon.pt/pedido/abc123";

  it("o link do pedido ganha o ?pagar=1; a /conta e um link que já o tem ficam como estão", () => {
    expect(linkParaPagar(LINK)).toBe(`${LINK}?pagar=1`);
    expect(linkParaPagar(`${LINK}?pagar=1`)).toBe(`${LINK}?pagar=1`);
    expect(linkParaPagar("https://clyon.pt/conta")).toBe("https://clyon.pt/conta");
  });

  it("a mensagem final sai com o link de pagar", () => {
    const texto = mensagemDosValoresParaPagamento(
      {
        pedidoId: 9001,
        cliente: null,
        servico: "mudanca",
        localidade: "Lisboa",
        quando: "2026-11-05T10:00:00Z",
        base: "total",
        conta: { semIva: 725, iva: 166.75, total: 891.75 },
      },
      new Date("2026-11-05T18:00:00Z"),
    );
    expect(texto).toContain(LINK_POR_GERAR);
    const final = comOLink(texto, linkParaPagar(LINK));
    expect(final).toContain(`${LINK}?pagar=1`);
    expect(final).not.toContain(LINK_POR_GERAR);
    expect(final).toContain("Pode pagar por MB WAY, por Multibanco ou por transferência");
  });

  it("a rota troca o marcador pelo link de pagar", () => {
    expect(ROTA).toContain("comOLink(texto, linkParaPagar(link))");
  });
});
