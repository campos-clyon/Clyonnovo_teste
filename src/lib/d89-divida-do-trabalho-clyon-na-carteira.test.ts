import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIVIDAS_DOS_TRABALHOS_CLYON_CONTAM_DESDE,
  aPagarAClyonDe,
  dividasDe,
  eValorAPassarAClyon,
  prazoDaDividaDoTrabalhoClyon,
  type TrabalhoNaCarteira,
} from "./carteira";
import { bloqueioEmDinheiro, standByDoNovoModelo } from "./bloqueio-por-divida";
import { camposDoPagamento, eTrabalhoClyonDaLinha } from "./carteira-do-profissional";
import { prazoDoValorEmAtraso } from "./valor-em-atraso";
import { estadoDoValorEmAtraso } from "./estado-do-valor-em-atraso";
import { faixaDoValorAPassar } from "./como-recebe-no-novo-modelo";
import { mensagemDaDividaAoProfissional, referenciaVivaDaDivida } from "./referencia-da-divida-no-backoffice";
import { tridDoAbatimentoAParte } from "./pago-em-mao";

/*
 * d89 (CEO e dono, 23-11-2026): a dívida de um Trabalho CLYON que o cliente pagou
 * ao profissional aparece na carteira dele como o valor a passar à CLYON — o
 * mesmo número do backoffice, paga-se pela referência, e o prazo dos 4 dias só
 * conta a partir do deploy. Valores inventados (o repositório é público), com a
 * forma do caso que a ordem descreve: um trabalho do modelo de 15-11 de 15,99 €
 * e um Trabalho CLYON de 370 € a 15 %, sem fatura.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");
const soma = (vs: number[]) => Math.round(vs.reduce((s, v) => s + v, 0) * 100) / 100;

/** Do modelo de 15-11: o cliente pagou-lhe 100 €; passa à CLYON a taxa (13 €) e o IVA dela (2,99 €). */
function doModeloNovo(extra: Partial<TrabalhoNaCarteira> = {}): TrabalhoNaCarteira {
  return {
    negociacaoId: 901,
    pedidoId: 9001,
    noNovoModelo: true,
    estado: "acordada",
    valorAcordado: 100,
    taxaCliente: 0,
    taxaProfissional: 0.13,
    formaDePagamento: null,
    execucaoEnviadaEm: "2026-11-21T15:00:00Z",
    confirmadoEm: "2026-11-21T15:53:03Z",
    pagoEm: null,
    negociacaoCriadaEm: "2026-11-18T09:00:00Z",
    ...extra,
  } as TrabalhoNaCarteira;
}

/** Um Trabalho CLYON de 370 € (sem IVA) a 15 %, que o cliente pagou ao profissional. Sem fatura. */
function trabalhoClyon(extra: Partial<TrabalhoNaCarteira> = {}): TrabalhoNaCarteira {
  return {
    negociacaoId: 902,
    pedidoId: 9002,
    trabalhoClyon: true,
    pagoPelaClyon: true,
    estado: "acordada",
    valorAcordado: 370,
    taxaCliente: 0,
    taxaProfissional: 0.15,
    formaDePagamento: null,
    comoEntrou: "ao_profissional",
    valorQueEntrou: 370,
    execucaoEnviadaEm: "2026-11-21T12:00:00Z",
    confirmadoEm: "2026-11-21T12:18:15Z",
    pagoEm: null,
    clientePagouEm: "2026-11-23T13:16:24Z",
    negociacaoCriadaEm: "2026-11-19T09:00:00Z",
    ...extra,
  } as TrabalhoNaCarteira;
}

const hoje = new Date("2026-11-23T17:00:00Z");

/** Os valores da caixa de cima da carteira, como a rota os escolhe. */
const valoresDaCarteira = (ts: TrabalhoNaCarteira[], agora: Date) =>
  dividasDe(ts, agora).filter((d) => eValorAPassarAClyon(d) && !d.paga);

/** O que o backoffice soma em «A receber dos profissionais» (a rota: porPagar de cada dívida). */
const devidoNoBackoffice = (ts: TrabalhoNaCarteira[], agora: Date) =>
  soma(dividasDe(ts, agora).map((d) => (d.paga ? 0 : d.porPagar)));

describe("d89 — a dívida de um Trabalho CLYON pago ao profissional, na carteira", () => {
  it("o caso: backoffice e carteira dão o mesmo total, 71,49 €, e as duas na caixa de cima", () => {
    const ts = [doModeloNovo(), trabalhoClyon()];
    const valores = valoresDaCarteira(ts, hoje);
    expect(valores.map((v) => v.negociacaoId).sort()).toEqual([901, 902]);
    expect(soma(valores.map((v) => v.total))).toBe(71.49);
    expect(aPagarAClyonDe(ts, hoje)).toBe(71.49);
    expect(devidoNoBackoffice(ts, hoje)).toBe(71.49);
    const [mn] = valores.filter((v) => v.negociacaoId === 901);
    expect(mn).toMatchObject({ total: 15.99, iva: 2.99, comissao: 13 });
  });

  it("sem fatura, sem IVA: só a taxa da plataforma, as mesmas partes do backoffice", () => {
    const [d] = dividasDe([trabalhoClyon()], hoje);
    expect(d).toMatchObject({ total: 55.5, iva: 0, comissao: 55.5, trabalhoClyonEmMao: true, aParte: true, paga: false });
    expect(d.partes.filter((p) => !p.paga).map((p) => [p.parte, p.valor])).toEqual([["taxa", 55.5]]);
    expect(d.tridAParte).toBe(tridDoAbatimentoAParte(902));
  });

  it("com fatura, com IVA: o IVA que o cliente lhe pagou com o preço e a taxa — as duas partes", () => {
    const [d] = dividasDe([trabalhoClyon({ valorQueEntrou: 455.1 })], hoje);
    expect(d).toMatchObject({ total: 140.6, iva: 85.1, comissao: 55.5, trabalhoClyonEmMao: true });
    expect(d.partes.map((p) => [p.parte, p.valor]).sort()).toEqual([["iva", 85.1], ["taxa", 55.5]]);
    expect(devidoNoBackoffice([trabalhoClyon({ valorQueEntrou: 455.1 })], hoje)).toBe(aPagarAClyonDe([trabalhoClyon({ valorQueEntrou: 455.1 })], hoje));
  });

  it("nasce quando o trabalho está feito; um Trabalho CLYON por fazer não deve nada", () => {
    expect(dividasDe([trabalhoClyon({ confirmadoEm: null, execucaoEnviadaEm: null })], hoje)).toEqual([]);
    // Confirmado e já pago ao profissional pela CLYON: continua a dever (o estaLibertado não a esconde).
    expect(dividasDe([trabalhoClyon({ pagoEm: "2026-11-23T14:00:00Z" })], hoje)[0]?.total).toBe(55.5);
  });

  it("um trabalho da plataforma pago em mão, que não é Trabalho CLYON, fica como estava (os 7 dias do dinheiro)", () => {
    const outro = trabalhoClyon({ trabalhoClyon: false, pagoPelaClyon: false, negociacaoId: 903 });
    const [d] = dividasDe([outro], hoje);
    expect(d.trabalhoClyonEmMao).toBeUndefined();
    expect(eValorAPassarAClyon(d)).toBe(false);
    expect(bloqueioEmDinheiro([outro], new Date("2026-11-29T12:00:00Z")).bloqueado).toBe(true);
  });

  it("o prazo dos 4 dias só conta a partir do deploy — sem stand-by para trás", () => {
    const [d] = dividasDe([trabalhoClyon()], hoje);
    expect(d.nasceuEm?.toISOString()).toBe("2026-11-21T12:18:15.000Z");
    expect(d.prazoDesde?.getTime()).toBe(DIVIDAS_DOS_TRABALHOS_CLYON_CONTAM_DESDE.getTime());
    const fim = prazoDoValorEmAtraso(d)!;
    expect(fim.getTime()).toBe(DIVIDAS_DOS_TRABALHOS_CLYON_CONTAM_DESDE.getTime() + 4 * 86_400_000);
    // No 4.º dia depois do deploy ainda está no prazo; no instante a seguir, stand-by.
    expect(standByDoNovoModelo([trabalhoClyon()], new Date(fim.getTime() - 60_000)).emStandBy).toBe(false);
    expect(standByDoNovoModelo([trabalhoClyon()], new Date(fim.getTime() + 60_000))).toMatchObject({ emStandBy: true, total: 55.5 });
    // O backoffice diz o mesmo prazo.
    expect(estadoDoValorEmAtraso({ paga: false, porPagar: 55.5, nasceuEm: d.nasceuEm, prazoDesde: d.prazoDesde }, hoje).estado).toBe("no_prazo");
    // E já não conta para o bloqueio dos 7 dias do dinheiro (uma regra só, a do stand-by).
    expect(bloqueioEmDinheiro([trabalhoClyon()], new Date("2026-12-10T12:00:00Z")).bloqueado).toBe(false);
  });

  it("uma dívida que nasce depois do deploy conta do dia em que nasceu", () => {
    const depois = new Date(DIVIDAS_DOS_TRABALHOS_CLYON_CONTAM_DESDE.getTime() + 2 * 86_400_000);
    expect(prazoDaDividaDoTrabalhoClyon(depois)?.getTime()).toBe(depois.getTime());
    expect(prazoDaDividaDoTrabalhoClyon(null)).toBeNull();
  });

  it("paga pela referência (o webhook fecha a linha à parte): sai da carteira e do backoffice", () => {
    const pagos = new Map([
      [
        902,
        {
          pagoEm: new Date("2026-11-23T13:16:24Z"),
          metodo: "ao_profissional",
          valor: 370,
          levantamentoId: null,
          abatimentoAParte: { valor: 55.5, em: new Date("2026-11-24T10:00:00Z"), levantamentoId: null, metodo: "multibanco" },
        },
      ],
    ]);
    const campos = camposDoPagamento({ id: 902, formaDePagamento: null }, pagos as never);
    expect(campos.dividaPagaEm).toEqual(new Date("2026-11-24T10:00:00Z"));
    expect(campos.dividaAbatida).toBeNull();
    const ts = [doModeloNovo(), trabalhoClyon(campos)];
    expect(valoresDaCarteira(ts, hoje).map((v) => v.negociacaoId)).toEqual([901]);
    expect(aPagarAClyonDe(ts, hoje)).toBe(15.99);
    expect(devidoNoBackoffice(ts, hoje)).toBe(15.99);
  });

  it("um Trabalho CLYON reconhece-se pela negociação, pelo pedido ou pela leitura da base", () => {
    expect(eTrabalhoClyonDaLinha({ ofertaClyon: "1" })).toBe(true);
    expect(eTrabalhoClyonDaLinha({ ofertaClyon: null, valorFixoClyon: "370.00" })).toBe(true);
    expect(eTrabalhoClyonDaLinha({ ofertaClyon: 0, valorFixoClyon: null })).toBe(false);
    expect(eTrabalhoClyonDaLinha({}, true)).toBe(true);
    expect(semComentarios(ler("src/lib/carteira-do-profissional.ts"))).toContain(
      "trabalhoClyon: eTrabalhoClyonDaLinha(l, clyon.has(Number(l.id))),",
    );
  });

  it("a faixa do Início: só sem IVA diz só a taxa; com uma com IVA, a frase de sempre", () => {
    const so = faixaDoValorAPassar([{ total: 55.5, prazoAte: "2026-11-27T16:00:00Z", semIva: true }], hoje);
    expect(so?.texto.startsWith("A taxa da plataforma de 1 trabalho")).toBe(true);
    const duas = faixaDoValorAPassar(
      [
        { total: 55.5, prazoAte: "2026-11-27T16:00:00Z", semIva: true },
        { total: 15.99, prazoAte: "2026-11-25T15:53:03Z", semIva: false },
      ],
      hoje,
    );
    expect(duas?.total).toBe(71.49);
    expect(duas?.texto).toContain("A taxa da plataforma e o IVA dela de 2 trabalhos");
  });
});

describe("d89 — a referência: a mesma porta, nunca duas vivas", () => {
  const d = { aParte: true, total: 55.5 };
  const agora = new Date("2026-11-23T17:00:00Z");
  const linha = (x: Record<string, unknown>) => ({
    estado: "pendente",
    metodo: "multibanco",
    valor: 55.5,
    parte: "divida",
    referencia: "123 456 789",
    entidade: "12345",
    expiraEm: new Date("2026-11-30T00:00:00Z"),
    ...x,
  });

  it("a referência viva da dívida à parte é a da parte «divida» e do valor que falta", () => {
    expect(referenciaVivaDaDivida(d, [linha({})], agora)?.referencia).toBe("123 456 789");
    // A do cliente (parte «trabalho»), uma de outro valor, uma expirada ou uma cancelada não contam.
    expect(referenciaVivaDaDivida(d, [linha({ parte: "trabalho" })], agora)).toBeNull();
    expect(referenciaVivaDaDivida(d, [linha({ valor: 68.27 })], agora)).toBeNull();
    expect(referenciaVivaDaDivida(d, [linha({ expiraEm: new Date("2026-11-22T00:00:00Z") })], agora)).toBeNull();
    expect(referenciaVivaDaDivida(d, [linha({ estado: "cancelado" })], agora)).toBeNull();
  });

  it("a mensagem ao profissional diz o que paga: sem fatura, só a taxa", () => {
    const m = mensagemDaDividaAoProfissional({
      pedidoId: 9002,
      pagamento: { metodo: "multibanco", valor: 55.5, entidade: "12345", referencia: "123 456 789", expiraEm: "2026-11-30T00:00:00Z" },
      divida: { iva: 0 },
      nome: "Exemplo Teste",
    });
    expect(m).toContain("Boa tarde, Exemplo!");
    expect(m).toContain("a taxa da plataforma do pedido #9002, que o cliente lhe pagou diretamente");
    expect(m).not.toContain("o IVA e a taxa");
    expect(m).toContain("Valor: 55,50 €");
    const comIva = mensagemDaDividaAoProfissional({
      pedidoId: 9002,
      pagamento: { metodo: "multibanco", valor: 140.6, entidade: "12345", referencia: "1", expiraEm: null },
      divida: { iva: 85.1 },
      nome: null,
    });
    expect(comIva).toContain("o IVA e a taxa da plataforma do pedido #9002");
  });

  it("o botão do backoffice: só o administrador, só nestas dívidas, pela porta da carteira", () => {
    const rota = semComentarios(ler("src/app/api/admin/pagamentos/a-receber-dos-profissionais/route.ts"));
    const post = rota.slice(rota.indexOf("export async function POST"));
    expect(post).toContain("const { err, colab } = await requireAdminGeral(req);");
    expect(post).toContain('if (corpo.accao === "gerar_referencia") {');
    expect(post).toContain('await gerarReferenciaDaDivida(negociacaoId, { metodo, autor: { tipo: "clyon", nome: quem } });');
    // O GET mostra a referência viva destas dívidas, e o estado do prazo com o deploy.
    expect(rota).toContain("if (!eValorAPassarAClyon(d)) continue;");
    expect(rota).toContain("prazoDesde: d.prazoDesde ?? null");
    const ecra = semComentarios(ler("src/components/admin/AReceberDosProfissionais.tsx"));
    expect(ecra).toContain("{eAdministrador && t.trabalhoClyonEmMao && t.porPagar > 0 && (");
    expect(ecra).toContain('body: JSON.stringify({ accao: "gerar_referencia", negociacaoId, metodo }),');
    expect(ecra).toContain("linkDoWhatsApp(feito.telefone, feito.mensagem)");
  });

  it("a carteira (painel e app CLYON Pro) põe-nas na caixa de cima, pela mesma pergunta", () => {
    const rota = semComentarios(ler("src/app/api/profissionais/carteira/route.ts"));
    expect(rota).toContain(".filter((d) => eValorAPassarAClyon(d) && !d.paga)");
    expect(semComentarios(ler("src/lib/bloqueio-por-divida.ts"))).toContain(".filter(eValorAPassarAClyon)");
    expect(semComentarios(ler("src/lib/vitoria-aos-profissionais-na-base.ts"))).toContain(".filter(eValorAPassarAClyon);");
    // A app tira da lista de baixo o que está na caixa de cima — não precisa de mudar.
    expect(ler("app-pro/src/app/(app)/carteira.tsx")).toContain("!doValorEmAtraso.has(d.negociacaoId)");
    // O painel mostra as partes do backoffice nesta dívida.
    expect(semComentarios(ler("src/app/profissionais/painel/Carteira.tsx"))).toContain("{d.trabalhoClyonEmMao ? (");
  });
});
