/**
 * d65 (17-11-2026) — o cartão do trabalho e o sino dizem o que a carteira diz.
 *
 *  1. Num Trabalho CLYON (d31) o cartão perguntava «o cliente já pagou?» e
 *     respondia `null` — que se lê «disponível na sua carteira» — enquanto a
 *     carteira e o backoffice diziam «à espera do cliente».
 *  2. No modelo de 15-11 o sino anunciava «disponível na carteira» e
 *     «Transferência processada»: o que lá fica é a taxa a passar à CLYON.
 *  3. Os textos do modelo novo deixam o «já com a taxa descontada».
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clientePagouNoCartao, oClientePagou, type TrabalhoNaCarteira } from "./carteira";
import { fasesDosTrabalhos, oQueMudou, type TrabalhoParaOsAvisos } from "./avisos-do-profissional";

const RAIZ = join(__dirname, "..", "..");
const ler = (f: string) => readFileSync(join(RAIZ, f), "utf8").replace(/\r\n/g, "\n");

const DEPOIS_DO_CORTE = "2026-11-10T10:00:00Z";
const ANTES_DO_CORTE = "2026-09-15T10:00:00Z";

describe("1 — o cliente já pagou? O cartão responde como a carteira", () => {
  const base = { negociacaoCriadaEm: DEPOIS_DO_CORTE, trabalhoClyon: true, clientePagouEm: null, pagoEm: null };

  it("um Trabalho CLYON confirmado sem o pagamento do cliente: «não» (era null = «disponível»)", () => {
    expect(clientePagouNoCartao(base)).toBe(false);
    // A carteira diz o mesmo — por cobrar, à espera do cliente.
    expect(oClientePagou({ ...base, pagoPelaClyon: true } as unknown as TrabalhoNaCarteira)).toBe(false);
  });

  it("um Trabalho CLYON com o pagamento entrado, ou já transferido pela CLYON: «sim»", () => {
    expect(clientePagouNoCartao({ ...base, clientePagouEm: "2026-11-12T10:00:00Z" })).toBe(true);
    expect(clientePagouNoCartao({ ...base, pagoEm: "2026-11-13T10:00:00Z" })).toBe(true);
  });

  it("um trabalho da plataforma: só o pagamento do cliente conta", () => {
    const p = { ...base, trabalhoClyon: false };
    expect(clientePagouNoCartao(p)).toBe(false);
    expect(clientePagouNoCartao({ ...p, pagoEm: "2026-11-13T10:00:00Z" })).toBe(false);
    expect(clientePagouNoCartao({ ...p, clientePagouEm: "2026-11-12T10:00:00Z" })).toBe(true);
  });

  it("a pergunta não existe: antes do corte, em dinheiro, ou no modelo de 15-11", () => {
    expect(clientePagouNoCartao({ ...base, negociacaoCriadaEm: ANTES_DO_CORTE })).toBeNull();
    expect(clientePagouNoCartao({ ...base, formaDePagamento: "dinheiro" })).toBeNull();
    expect(clientePagouNoCartao({ ...base, noNovoModelo: true })).toBeNull();
  });

  it("a lista dos trabalhos usa esta regra — e já não dá null a todos os Trabalhos CLYON", () => {
    const rota = ler("src/app/api/profissionais/meus-pedidos/route.ts");
    expect(rota).toContain("clientePagou: clientePagouNoCartao({");
    expect(rota).toContain("trabalhoClyon: modoDaOferta(l.ofertaClyon) != null,");
    expect(rota).toContain("clientePagouEm: pagos.get(l.id) ?? null,");
    expect(rota).not.toMatch(/!modoDaOferta\(l\.ofertaClyon\) &&\s*\n\s*verificaOPagamento/);
    expect(rota).toContain("aPassarAClyon:");
  });
});

describe("2 — o sino no modelo de 15-11", () => {
  const T = (o: Partial<TrabalhoParaOsAvisos>): TrabalhoParaOsAvisos => ({
    negociacaoId: 1,
    pedidoId: 101,
    fase: "a_confirmar",
    recebeSeFechado: 180,
    ...o,
  });
  const mudou = (antes: TrabalhoParaOsAvisos[], depois: TrabalhoParaOsAvisos[]) =>
    oQueMudou(fasesDosTrabalhos(antes), depois, new Date("2026-11-17T10:00:00Z")).avisos.map((a) => a.texto);

  it("confirmado: pede para passar a taxa, nunca «disponível na carteira»", () => {
    const [texto] = mudou([T({ noNovoModelo: true })], [T({ fase: "confirmado", noNovoModelo: true, aPassarAClyon: 24.6 })]);
    expect(texto).toBe(
      "Trabalho #101 confirmado — passe à CLYON a taxa da plataforma e o IVA dela: 24,60 €, com a referência na carteira.",
    );
    expect(texto).not.toContain("disponíve");
  });

  it("confirmado sem o valor: manda ver a taxa na carteira; com zero a passar, só «confirmado»", () => {
    expect(mudou([T({ noNovoModelo: true })], [T({ fase: "confirmado", noNovoModelo: true })])).toEqual([
      "Trabalho #101 confirmado — veja na carteira a taxa da plataforma a passar à CLYON.",
    ]);
    expect(mudou([T({ noNovoModelo: true })], [T({ fase: "confirmado", noNovoModelo: true, aPassarAClyon: 0 })])).toEqual([
      "Trabalho #101 confirmado.",
    ]);
  });

  it("pago: nada de «Transferência processada» — a CLYON não lhe transfere nada", () => {
    const [texto] = mudou([T({ fase: "confirmado", noNovoModelo: true })], [T({ fase: "pago", noNovoModelo: true })]);
    expect(texto).toBe("Trabalho #101 fechado.");
  });

  it("o modelo antigo fica como estava; com o cliente por pagar, diz o que a carteira diz", () => {
    expect(mudou([T({})], [T({ fase: "confirmado" })])).toEqual([
      "Trabalho #101 confirmado — 180,00 € já estão disponíveis na carteira.",
    ]);
    expect(mudou([T({})], [T({ fase: "confirmado", clientePagou: false })])).toEqual([
      "Trabalho #101 confirmado — os 180,00 € ficam na carteira quando o cliente pagar.",
    ]);
    expect(mudou([T({ fase: "confirmado" })], [T({ fase: "pago" })])).toEqual(["Transferência do trabalho #101 processada."]);
  });
});

describe("3 — «já com a taxa descontada» só no modelo antigo", () => {
  it("/profissionais: o líquido e a nota do «Recebe» no modelo novo", () => {
    const f = ler("src/app/profissionais/page.tsx");
    expect(f).toContain("fica consigo esse valor e a taxa da plataforma passa-a à CLYON");
    expect(f).toContain("novoModeloEmVigor(agoraDoModelo()) ? NOTA_DO_RECEBE_NO_NOVO_MODELO :");
    expect(f).toContain("v.icon === HandCoins && novoModeloEmVigor(agora)");
  });

  it("o email da contraproposta: «fica consigo X; a taxa passa-a à CLYON» no modelo novo", () => {
    const f = ler("src/lib/email-proposta.ts");
    expect(f).toMatch(/p\.noNovoModelo\s*\n\s*\? `— fica consigo <strong>[^`]*<\/strong>; a taxa da plataforma passa-a à CLYON\.`/);
    expect(ler("src/lib/avisar-da-proposta.ts")).toMatch(/baseUrl: dados\.baseUrl,\s*\n\s*\/\/ d65[^\n]*\n\s*noNovoModelo: eDoNovoModelo\(/);
  });

  it("o cartão do painel", () => {
    const f = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(f).toMatch(
      /pedido\.noNovoModelo === true\s*\n\s*\? "fica consigo; a taxa da plataforma passa-a à CLYON · o valor é sem IVA"\s*\n\s*: "já com a taxa da plataforma descontada · o valor é sem IVA"/,
    );
  });
});
