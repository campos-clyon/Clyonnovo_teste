import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contaDoValorFinal, mensagemDoValorFinal, totalEmPalavras } from "./valor-final-ao-cliente";
import { acertoDasHoras } from "./pagamento-para-o-cliente";
import { quantoOClientePaga } from "./eupago";
import { contaDoCliente } from "./taxas-plataforma";
import type { Pagamento } from "./pagamentos-na-base";

/**
 * d70 (19-11-2026) — O VALOR FINAL LÊ A ESCOLHA DE FATURA DO TRABALHO.
 *
 * Um Trabalho CLYON do modelo antigo, marcado «Sem fatura» no cartão, levava
 * no «Enviar o valor final ao cliente» o total com IVA (e geraria a referência
 * por esse valor), quando o cliente deve o sem IVA. A marca do trabalho
 * (`negociacoes.semFactura`, a mesma do cartão) passa a mandar; sem ela, tudo
 * como antes.
 */

const SEM_FATURA = { cliente: 0, profissional: 0.1 };
const trabalho = (p: Record<string, unknown> = {}) => ({
  acordado: 431.33,
  taxas: SEM_FATURA,
  modelo: "iva_incluido" as const,
  acrescimo: 0,
  formaDePagamento: "na_plataforma" as const,
  novoModelo: false,
  porHora: null,
  reservaCent: 0,
  ...p,
});
let id = 0;
const linha = (p: Partial<Pagamento>): Pagamento =>
  ({
    id: ++id,
    negociacaoId: 70,
    pedidoId: 700,
    providerId: 3,
    metodo: "multibanco",
    estado: "pendente",
    ambiente: "sandbox",
    valor: 100,
    comFactura: true,
    deTeste: false,
    valorPago: null,
    parte: "trabalho",
    ...p,
  }) as Pagamento;

const agora = new Date("2026-11-19T15:00:00Z");

describe("sem fatura no trabalho, sem pagamentos", () => {
  for (const modelo of ["iva_incluido", "sem_iva"] as const) {
    it(`modelo ${modelo}: o total é o sem IVA, iva 0, e é isso que se pede`, () => {
      // Uma referência antiga com fatura não muda nada: a marca do trabalho manda.
      const r = contaDoValorFinal(trabalho({ modelo, semFactura: true }), [linha({ valor: 530.54, estado: "cancelado" })], "normal");
      if (!r.ok || r.conta.modo !== "referencia") throw new Error(String(!r.ok && r.porque));
      expect(r.conta.total).toBe(431.33);
      expect(r.conta.semIva).toBe(431.33);
      expect(r.conta.iva).toBe(0);
      expect(r.conta.aPedir).toBe(431.33);
      expect(r.conta.comFactura).toBe(false);
      expect(r.conta.parte).toBe("trabalho");

      const m = mensagemDoValorFinal({ pedidoId: 700, cliente: null, conta: r.conta }, agora);
      expect(m).toContain("431,33 € (sem fatura)");
      expect(m).toContain("Para pagar 431,33 €");
      expect(m).not.toContain("com IVA");
      expect(m).not.toContain("530,54");
    });
  }
});

describe("com fatura (sem a marca): como antes", () => {
  it("modelo do IVA incluído: o total com IVA, com o sem IVA ao lado", () => {
    const T = { cliente: 0, profissional: 0.1 };
    const r = contaDoValorFinal(trabalho({ acordado: 400, taxas: T }), [], "normal");
    if (!r.ok || r.conta.modo !== "referencia") throw new Error("modo");
    expect(r.conta.total).toBe(quantoOClientePaga(400, T, "iva_incluido", true, 0));
    expect(r.conta.semIva).toBe(contaDoCliente(400, T, 0).semIva);
    expect(r.conta.iva).toBeGreaterThan(0);
    expect(r.conta.comFactura).toBe(true);
    expect(totalEmPalavras(r.conta)).toContain("com IVA");
  });

  it("semFactura falso explícito dá o mesmo que sem o campo", () => {
    const a = contaDoValorFinal(trabalho({ acordado: 400 }), [], "normal");
    const b = contaDoValorFinal(trabalho({ acordado: 400, semFactura: false }), [], "normal");
    expect(b).toEqual(a);
  });

  it("modelo antigo sem a marca: continua a seguir a última referência", () => {
    const r = contaDoValorFinal(trabalho({ acordado: 400, modelo: "sem_iva" }), [linha({ comFactura: false })], "normal");
    if (!r.ok || r.conta.modo !== "referencia") throw new Error("modo");
    expect(r.conta.comFactura).toBe(false);
    expect(r.conta.iva).toBe(0);
  });
});

describe("o acerto das horas com a marca «Sem fatura»", () => {
  it("o final é o sem IVA, mesmo que a referência paga dissesse «com fatura»", () => {
    const t = trabalho({ modelo: "sem_iva", semFactura: true, porHora: { horasConfirmadas: true, valorFinal: 431.33 } });
    const pagas = [linha({ estado: "pago", valor: 300, valorPago: 300, comFactura: true })];
    const a = acertoDasHoras(t, pagas);
    expect(a?.final).toBe(431.33);
    expect(a?.comFactura).toBe(false);
    const r = contaDoValorFinal(t, pagas, "normal");
    if (!r.ok || r.conta.modo !== "referencia") throw new Error(String(!r.ok && r.porque));
    expect(r.conta.parte).toBe("diferenca");
    expect(r.conta.total).toBe(431.33);
    expect(r.conta.iva).toBe(0);
    expect(r.conta.aPedir).toBe(131.33);
    const m = mensagemDoValorFinal({ pedidoId: 700, cliente: null, conta: r.conta }, agora);
    expect(m).toContain("Falta a diferença: 131,33 €.");
    expect(m).not.toContain("com IVA");
  });

  it("sem a marca, o acerto segue a referência paga (como antes)", () => {
    const t = trabalho({ acordado: 400, modelo: "sem_iva", porHora: { horasConfirmadas: true, valorFinal: 400 } });
    const a = acertoDasHoras(t, [linha({ estado: "pago", valor: 300, valorPago: 300, comFactura: true })]);
    expect(a?.comFactura).toBe(true);
    expect(a?.final).toBe(quantoOClientePaga(400, SEM_FATURA, "sem_iva", true));
  });
});

const fonte = (f: string) => readFileSync(join(__dirname, "..", f), "utf8").replace(/\r\n/g, "\n");

describe("a marca chega ao servidor e ao ecrã", () => {
  it("o trabalho a pagar leva a marca do próprio trabalho (a mesma do cartão)", () => {
    expect(fonte("lib/acesso-ao-pagamento.ts")).toMatch(/semFactura: eSemFactura\(linha\)/);
  });

  it("a folha final, fora do modelo de 15-11, mostra o total sem fatura", () => {
    expect(fonte("lib/folha-final-no-servidor.ts")).toMatch(/semFactura: eSemFactura\(\{ semFactura: linha\.semFactura \}\) && !\(acesso && acesso\.ok && acesso\.trabalho\.novoModelo\)/);
    const ecra = fonte("components/admin/FolhaFinalDaMudanca.tsx");
    expect(ecra).toMatch(/d\?\.semFactura \?/);
    expect(ecra).toContain("(sem fatura)");
  });

  it("o bloco do valor final não escreve «com IVA» sem IVA", () => {
    const ecra = fonte("components/admin/EnviarValorFinalAoCliente.tsx");
    expect(ecra).toContain("totalComOuSemFatura");
    expect(ecra).toMatch(/c\.iva > 0 \?/);
  });
});
