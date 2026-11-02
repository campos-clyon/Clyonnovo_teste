import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { quantoOClientePaga } from "./eupago";
import { comIva } from "./quanto-custa";
import { TAXA_IVA } from "./taxas-plataforma";
import { contaDaReferencia, referenciaDoPedido } from "./preco-de-referencia";
import { precoEmTresLinhas, precoEmTresLinhasValido, referenciaEmTresLinhas } from "./preco-em-tres-linhas";
import { ErroDaApi, mensagemDaResposta, REDE_LENTA, SEM_REDE, type Pedir } from "../../app-cliente/src/lib/erros";
import {
  FALHOU_O_PEDIDO,
  contagem,
  estadoDoPagar,
  pedirOPagamento,
  valorDoBotao,
} from "../../app-cliente/src/lib/pagamento";
import type { Pagamento, PendenteDoPagamento } from "../../app-cliente/src/lib/pedidos";
import {
  camposEmFaltaNoEcra,
  catalogoValido,
  ecraDaLinha,
  ecraDe,
  ecrasDoPedir,
  perguntaDoEcra,
  rascunhoValido,
  rascunhoVazio,
  referenciaValida,
  type Catalogo,
  type Rascunho,
} from "../../app-cliente/src/lib/novo-pedido";
import { catalogoDaApp } from "./catalogo-da-app";

/**
 * ECRÃS SIMPLES NA APP DE CLIENTE — ordem do CEO com o sim do dono,
 * 02-11-2026: «direto ao ponto», como a Vinted. E o #551: o MB WAY falhou e a
 * app ficou num ecrã morto, sem dizer nada nem deixar tentar de novo.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const centimos = (t: string) => Math.round(Number(t.replace(/[^\d,]/g, "").replace(",", ".")) * 100);

describe("o preço em três linhas (Serviço / IVA / Total), das contas do site", () => {
  it("o mesmo total que o banco pede, e Serviço + IVA = Total ao cêntimo", () => {
    const taxas = { cliente: 0, profissional: 11 } as never;
    const total = quantoOClientePaga(350, taxas, "iva_incluido", true);
    const semIva = quantoOClientePaga(350, taxas, "sem_iva", false);
    const t = precoEmTresLinhas(semIva, total, TAXA_IVA)!;
    expect(t.total).toBe(`${total.toFixed(2).replace(".", ",")} €`);
    expect(t.servico).toBe(`${semIva.toFixed(2).replace(".", ",")} €`);
    expect(t.ivaRotulo).toBe("IVA (23 %)");
    expect(centimos(t.servico) + centimos(t.iva)).toBe(centimos(t.total));
    expect(precoEmTresLinhas(100, 90, TAXA_IVA)).toBeNull();
  });

  it("a R5 manda as três linhas no pagamento e no preço da negociação (só com IVA incluído)", () => {
    const r5 = ler("src/lib/pedidos-do-cliente.ts");
    expect(r5).toContain("? precoEmTresLinhas(e.desdobramento.semIva, e.desdobramento.total, TAXA_IVA)");
    expect(r5).toContain(": precoEmTresLinhas(semIva, e.valores.comFactura, TAXA_IVA),");
    expect(ler("src/lib/pedido-para-a-app.ts")).toContain("conta: precoEmTresLinhas(conta.semIva, conta.aPagar, TAXA_IVA)");
  });

  it("a referência do Pedir: as mesmas faixas das linhas, e o IVA de cada ponta", () => {
    const r = referenciaDoPedido({ servico: "recolha_moveis" });
    expect(r.linhas[0].texto).toBe("40 – 120 € + IVA (49,20 – 147,60 € com IVA)");
    expect(r.conta).toEqual({ servico: "40 – 120 €", iva: "9,20 – 27,60 €", ivaRotulo: "IVA (23 %)", total: "49,20 – 147,60 €" });
    const itens = contaDaReferencia({ servico: "recolha_moveis", movelModo: "item", itens: { grande: 1 } });
    expect(itens?.total).toBe(`${comIva(80).toFixed(2).replace(".", ",")} €`);
    expect(contaDaReferencia({ servico: "mudanca" })).toBeNull(); // por hora: ficam as linhas
    expect(contaDaReferencia({ servico: "recolha_entulho" })).toBeNull();
    expect(referenciaEmTresLinhas(250, null, comIva, TAXA_IVA, true)?.total).toBe("desde 307,50 €");
    expect(ler("src/app/api/cliente/referencia/route.ts")).toContain("return NextResponse.json({ ok: true, linhas, nota, conta });");
  });

  it("a app lê-as sem confiar na forma, e sem elas fica como antes", () => {
    expect(precoEmTresLinhasValido({ servico: "1 €", iva: "0,23 €", total: "1,23 €" })).toEqual({ servico: "1 €", iva: "0,23 €", ivaRotulo: "IVA", total: "1,23 €" });
    expect(precoEmTresLinhasValido({ servico: "1 €" })).toBeNull();
    const v = referenciaValida({ linhas: [{ rotulo: "x", texto: "40 € + IVA (49,20 € com IVA)" }], nota: null, conta: { servico: "40 €", iva: "9,20 €", ivaRotulo: "IVA (23 %)", total: "49,20 €" } });
    expect(v?.conta?.total).toBe("49,20 €");
    // O ecrã: Serviço / IVA / Total quando há `conta`; o «principal» e o «detalhe» quando não há.
    const preco = ler("app-cliente/src/componentes/Preco.tsx");
    expect(preco).toContain("<Linha rotulo={ROTULO_DO_SERVICO} nota={ROTULO_SEM_IVA} valor={conta.servico} />");
    expect(preco).toContain("<Linha rotulo={conta.ivaRotulo} valor={conta.iva} />");
    expect(preco).toContain("<Linha rotulo={rotuloDoTotal} valor={conta.total} forte />");
  });
});

/* ─── O pagamento: as três falhas, com a rota simulada ──────────────────── */

/** O site de mentira: responde como `POST /api/pagamentos`, e o `pedir` faz o que o da app faz (`api.ts`). */
function rotaSimulada(resposta: { estado: number; corpo?: Record<string, unknown> } | "sem-rede" | "tempo-esgotado"): Pedir {
  return (async () => {
    if (resposta === "sem-rede") throw new ErroDaApi(SEM_REDE, 0);
    if (resposta === "tempo-esgotado") throw new ErroDaApi(REDE_LENTA, 0);
    const corpo = resposta.corpo ?? {};
    if (resposta.estado < 200 || resposta.estado >= 300) throw new ErroDaApi(mensagemDaResposta(resposta.estado, corpo), resposta.estado, corpo);
    return corpo;
  }) as Pedir;
}
const CORPO = { pedidoId: 551, negociacaoId: 9, metodo: "mbway", comFactura: true, telemovel: "910000000" };

describe("(a) qualquer falha ao pedir o pagamento diz o porquê e deixa tentar", () => {
  it("o euPago recusou (502), o tecto (429), o convidado (403), já pago (409): a frase do servidor", async () => {
    for (const [estado, error] of [
      [502, "O MB WAY não respondeu. Tente outra vez ou pague por Multibanco."],
      [429, "Já pediu vários MB WAY. Pague por Multibanco."],
      [403, "Para pagar, crie a conta."],
      [409, "Este trabalho já está pago."],
    ] as const) {
      const r = await pedirOPagamento(rotaSimulada({ estado, corpo: { ok: false, error, sugereOutroMetodo: true } }), CORPO);
      expect(r).toEqual({ ok: false, mensagem: error });
    }
  });

  it("sem frase do servidor, sem rede, tempo esgotado, ou 200 com ok:false: a frase de reserva", async () => {
    for (const s of [
      rotaSimulada({ estado: 500 }),
      rotaSimulada({ estado: 200, corpo: { ok: false } }),
      rotaSimulada({ estado: 200, corpo: {} }),
      rotaSimulada("sem-rede"),
      rotaSimulada("tempo-esgotado"),
    ]) {
      expect(await pedirOPagamento(s, CORPO)).toEqual({ ok: false, mensagem: FALHOU_O_PEDIDO });
    }
    expect(FALHOU_O_PEDIDO).toBe("Não foi possível pedir o pagamento. Tente de novo ou pague por Multibanco.");
  });

  it("só conta como pedido um 200 com o pagamento", async () => {
    const ok = rotaSimulada({ estado: 200, corpo: { ok: true, pagamento: { id: 1, metodo: "mbway", estado: "pendente" } } });
    expect(await pedirOPagamento(ok, CORPO)).toEqual({ ok: true });
  });

  it("o ecrã mostra a falha com «Tentar de novo» e «Pagar por Multibanco»", () => {
    const p = ler("app-cliente/src/componentes/Pagar.tsx");
    expect(p).toContain("setFalha({ mensagem: res.mensagem, metodo: m });");
    expect(p).toContain('<Botao titulo="Tentar de novo"');
    expect(p).toContain('<Botao titulo="Pagar por Multibanco"');
  });
});

const AGORA = Date.parse("2026-11-02T15:00:00Z");
const mbway = (expiraEm: string | null): PendenteDoPagamento => ({
  metodo: "mbway",
  metodoTexto: "MB WAY",
  entidade: null,
  referencia: null,
  valorTexto: "452,03 € (367,50 € sem IVA)",
  expiraEm,
  expiraEmTexto: null,
});
const pagamento = (p: Partial<Pagamento> = {}): Pagamento => ({
  disponivel: true,
  pago: false,
  pagoEmTexto: null,
  emDinheiroAoProfissional: false,
  pendentes: [],
  ivaIncluido: true,
  valoresTexto: { comFactura: "452,03 € (367,50 € sem IVA)", semFactura: "367,50 €" },
  ...p,
});

describe("(b) o MB WAY tem prazo; depois volta a «por pagar» com o bloco inteiro", () => {
  it("dentro do prazo: a contagem", () => {
    const e = estadoDoPagar(pagamento({ pendentes: [mbway("2026-11-02T15:04:30Z")] }), AGORA);
    expect(e).toEqual({ tipo: "a-confirmar-mbway", fimEm: Date.parse("2026-11-02T15:04:30Z"), valorTexto: "452,03 € (367,50 € sem IVA)" });
    expect(contagem(270_000)).toBe("4:30");
    expect(contagem(-5)).toBe("0:00");
    expect(valorDoBotao("452,03 € (367,50 € sem IVA)")).toBe("452,03 €");
  });

  it("o #551: o MB WAY ainda «pendente» na base mas fora do prazo — por pagar, e diz que não foi confirmado", () => {
    expect(estadoDoPagar(pagamento({ pendentes: [mbway("2026-11-02T14:58:00Z")] }), AGORA)).toEqual({
      tipo: "por-pagar",
      multibanco: null,
      mbwayNaoConfirmado: true,
    });
  });

  it("recusado ou expirado no servidor (sai dos pendentes): por pagar; com o aviso se a app estava à espera", () => {
    expect(estadoDoPagar(pagamento(), AGORA, { esperavaMbway: true })).toMatchObject({ tipo: "por-pagar", mbwayNaoConfirmado: true });
    expect(estadoDoPagar(pagamento(), AGORA)).toMatchObject({ tipo: "por-pagar", mbwayNaoConfirmado: false });
  });

  it("um site antigo sem prazo: cinco minutos desde que a app o viu", () => {
    const pg = pagamento({ pendentes: [mbway(null)] });
    expect(estadoDoPagar(pg, AGORA, { mbwayVistoEm: AGORA - 60_000 }).tipo).toBe("a-confirmar-mbway");
    expect(estadoDoPagar(pg, AGORA, { mbwayVistoEm: AGORA - 6 * 60_000 }).tipo).toBe("por-pagar");
    expect(estadoDoPagar(pg, AGORA).tipo).toBe("por-pagar");
  });

  it("com uma referência Multibanco por pagar: mostra-a, e o bloco continua lá", () => {
    const ref: PendenteDoPagamento = { ...mbway("2026-11-05T23:59:00Z"), metodo: "multibanco", entidade: "12345", referencia: "123 456 789" };
    expect(estadoDoPagar(pagamento({ pendentes: [ref] }), AGORA)).toEqual({ tipo: "por-pagar", multibanco: ref, mbwayNaoConfirmado: false });
  });

  it("«por pagar» tem sempre MB WAY, Referência Multibanco e «Pagar Z €» no ecrã", () => {
    const p = ler("app-cliente/src/componentes/Pagar.tsx");
    const bloco = p.slice(p.indexOf("estado.mbwayNaoConfirmado && !falha"), p.indexOf("/* ─── No ecrã do pedido"));
    // As frases do site à letra (`frases-do-pagamento.ts`).
    expect(bloco).toContain("<Opcao titulo={MB_WAY}");
    expect(bloco).toContain("<Opcao titulo={REFERENCIA_MULTIBANCO}");
    expect(bloco).toContain("<Subtitulo>{COMO_PAGA}</Subtitulo>");
    expect(bloco).toContain("titulo={`Pagar ${total}`}");
    expect(bloco).toContain("{SO_DEPOIS_DE_FEITO}");
    // Enquanto espera pelo MB WAY lê o pedido de 5 em 5 s, e quando a espera acaba lê-o mais uma vez.
    expect(p).toContain('if (antes.current === "a-confirmar-mbway" && tipo !== "a-confirmar-mbway") void carregar();');
  });
});

describe("(c) «pago» só quando o servidor o diz", () => {
  it("sem `pago: true` nunca é pago — nem depois de um MB WAY pedido", () => {
    expect(estadoDoPagar(pagamento(), AGORA, { esperavaMbway: true }).tipo).not.toBe("pago");
    expect(estadoDoPagar(pagamento({ pago: true, pagoEmTexto: "segunda-feira, 2 de novembro, às 15:10" }), AGORA)).toEqual({
      tipo: "pago",
      quando: "segunda-feira, 2 de novembro, às 15:10",
    });
  });
  it("o ecrã não tem outro caminho para «pago»", () => {
    const p = ler("app-cliente/src/componentes/Pagar.tsx");
    expect(p.match(/pagoNaData\(/g)?.length).toBe(2);
    expect(p).not.toMatch(/tipo: "pago"/);
  });
});

/* ─── Pedir: uma pergunta por ecrã ──────────────────────────────────────── */

const c = catalogoValido({
  ...catalogoDaApp(),
  servicos: [
    { id: "recolha_moveis", nome: "Recolha de móveis", detalhes: "moveis" },
    { id: "mudanca", nome: "Mudança", detalhes: "mudanca" },
  ],
}) as Catalogo;
const base = (extra: Partial<Rascunho>): Rascunho => ({ ...rascunhoVazio(), ...extra });

describe("Pedir, uma pergunta por ecrã", () => {
  it("a ordem: onde → o que → fotografias → andar → quando → contacto → resumo; na mudança, «Para onde vai?»", () => {
    expect(ecrasDoPedir(base({ servico: "recolha_moveis" }), c)).toEqual(["onde", "oque", "fotos", "acesso", "quando", "contacto", "resumo"]);
    expect(ecrasDoPedir(base({ servico: "mudanca" }), c)).toEqual(["onde", "oque", "destino", "fotos", "acesso", "quando", "contacto", "resumo"]);
    expect(perguntaDoEcra("onde", "moveis")).toBe("Onde é?");
    expect(perguntaDoEcra("acesso", "moveis")).toBe("Andar e elevador");
    expect(perguntaDoEcra("acesso", null, true)).toBe("A carrinha fica perto?");
  });

  it("cada ecrã só pede o que é seu; o resumo confere tudo", () => {
    const r = base({});
    expect(camposEmFaltaNoEcra(r, "onde", c).map((x) => x.campo)).toEqual(["morada"]);
    expect(camposEmFaltaNoEcra(r, "oque", c).map((x) => x.campo)).toEqual(["servico"]);
    expect(camposEmFaltaNoEcra(base({ servico: "recolha_moveis" }), "acesso", c).map((x) => x.campo)).toEqual(["acesso"]);
    expect(camposEmFaltaNoEcra(r, "quando", c).map((x) => x.campo)).toEqual(["quando"]);
    expect(camposEmFaltaNoEcra(r, "contacto", c).map((x) => x.campo)).toEqual(["nome", "telefone"]);
    expect(camposEmFaltaNoEcra(r, "fotos", c)).toEqual([]);
    expect(camposEmFaltaNoEcra(base({ servico: "recolha_moveis" }), "resumo", c).map((x) => x.campo)).toEqual(
      expect.arrayContaining(["movelModo", "descricao", "morada", "acesso", "quando", "nome", "telefone"]),
    );
  });

  it("o rascunho guarda o ecrã; um rascunho antigo começa na primeira pergunta do passo", () => {
    expect(ecraDe(base({ ecra: "fotos", servico: "recolha_moveis" }), c)).toBe("fotos");
    expect(ecraDe(base({ ecra: "destino", servico: "recolha_moveis" }), c)).toBe("onde");
    expect(ecraDe(base({ passo: 3 }), c)).toBe("quando");
    expect(rascunhoValido({ ...rascunhoVazio(), ecra: "contacto" })?.ecra).toBe("contacto");
  });

  it("«Alterar» no resumo leva ao ecrã certo", () => {
    expect(ecraDaLinha({ rotulo: "Serviço", passo: 1 })).toBe("oque");
    expect(ecraDaLinha({ rotulo: "Fotografias", passo: 1 })).toBe("fotos");
    expect(ecraDaLinha({ rotulo: "Morada", passo: 2 })).toBe("onde");
    expect(ecraDaLinha({ rotulo: "Para", passo: 2 })).toBe("destino");
    expect(ecraDaLinha({ rotulo: "Acesso", passo: 2 })).toBe("acesso");
    expect(ecraDaLinha({ rotulo: "Quando", passo: 3 })).toBe("quando");
  });

  it("o resumo mostra o preço como o pagamento (Serviço / IVA / Total), e cada ecrã tem «Continuar» e a barra", () => {
    const novo = ler("app-cliente/src/componentes/NovoPedido.tsx");
    expect(novo).toContain("<PrecoEmLinhas conta={referencia.conta} rotuloDoTotal={ROTULO_DO_TOTAL_DE_REFERENCIA} />");
    expect(novo).toContain('<Botao titulo={ultimo ? "Enviar pedido" : "Continuar"}');
    expect(novo).toContain("<Progresso indice={indice} total={ecras.length} />");
  });
});

describe("as frases do pagar: as do site, à letra", () => {
  it("a app usa as palavras que o site reexporta (sem importar o IVA)", async () => {
    const site = await import("./frases-do-pagamento");
    const palavras = await import("./palavras-do-pagamento");
    for (const k of ["PRECO", "SERVICO", "SEM_IVA", "TOTAL_A_PAGAR", "COMO_PAGA", "MB_WAY", "REFERENCIA_MULTIBANCO", "O_VALOR_FICA_COM_A_CLYON"] as const) {
      expect(site[k]).toBe(palavras[k]);
    }
    expect(ler("src/lib/palavras-do-pagamento.ts")).not.toMatch(/^import /m);
    expect(ler("app-cliente/src/componentes/Pagar.tsx")).toContain('from "../../../src/lib/palavras-do-pagamento";');
    expect(ler("app-cliente/src/lib/pagamento.ts")).toContain("export const SO_DEPOIS_DE_FEITO = O_VALOR_FICA_COM_A_CLYON;");
  });
});

describe("o ecrã do pedido: menos texto, o resto recolhido", () => {
  it("parceiro, preço e próximo passo à vista; o valor, o que pediu e a ajuda em secções recolhidas", () => {
    const v = ler("app-cliente/src/componentes/VistaDoPedido.tsx");
    for (const t of ['<Recolhido titulo="O valor e os itens a mais">', '<Recolhido titulo="O que pediu">', '<Recolhido titulo="Ajuda e alterações">']) expect(v).toContain(t);
    expect(v).toContain("<ResumoDoPagamento");
    expect(v).toContain("<Acompanhar pedidoId={pedidoId} n={contratada} agir={agir} recolhida />");
    expect(ler("app-cliente/src/app/_layout.tsx")).toContain('<Stack.Screen name="pagar/[id]" options={{ headerShown: true, title: "Pagamento" }} />');
  });
});
