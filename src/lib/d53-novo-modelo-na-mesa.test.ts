import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROMESSA_POR_FORMA, promessaDaForma } from "./pagamento-na-plataforma";
import { backofficeAConfirmarNoNovoModelo } from "@/components/admin/frase-do-novo-modelo";
import { aPassarAClyonDaConta, contaDoNovoModelo, contaFecha } from "./conta-do-pagamento";
import { DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO } from "./novo-modelo";

/*
 * d53 (16-11-2026, dono) — UM TRABALHO DO MODELO DE 15-11 NA MESA não fala como
 * o modelo antigo: o bloco «deu o trabalho por feito», a conta do «Confirmar
 * como CLYON» e o botão «Gerar referência de pagamento» do cliente.
 * Valores inventados (repositório público).
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");
const mesa = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));

describe("1. o bloco «deu o trabalho por feito» no modelo novo", () => {
  it("diz que o cliente paga ao profissional, o valor a passar à CLYON e o prazo — nada de «pago pela plataforma»", () => {
    const t = backofficeAConfirmarNoNovoModelo(12.3);
    expect(t).toBe(
      "O cliente paga diretamente ao profissional. Quando o trabalho fica confirmado, o profissional recebe a " +
        `referência para passar à CLYON a taxa da plataforma e o IVA dela (12,30 €), e tem ${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias para pagar.`,
    );
    expect(t).not.toMatch(/pela plataforma|recebe da CLYON|parceiro/i);
    expect(backofficeAConfirmarNoNovoModelo(null)).not.toContain("€");
  });

  it("o valor é o da «Conta do pagamento»: o degrau final da conta do modelo novo (a taxa e o IVA dela)", () => {
    const conta = contaDoNovoModelo(300, { cliente: 0, profissional: 0.1 }, "normal", false);
    if (!conta) throw new Error("conta");
    expect(contaFecha(conta)).toBe(true);
    expect(aPassarAClyonDaConta(conta)).toBeCloseTo(conta.iva + conta.clyon, 2);
    expect(aPassarAClyonDaConta(null)).toBeNull();
  });

  it("o modelo antigo continua com a frase dele", () => {
    expect(promessaDaForma("na_plataforma", "iva_incluido", false).backofficeAConfirmar).toBe(
      PROMESSA_POR_FORMA.na_plataforma.backofficeAConfirmar,
    );
    expect(PROMESSA_POR_FORMA.na_plataforma.backofficeAConfirmar).toContain("Pago pela plataforma");
  });

  it("a Mesa escolhe a frase pela marca do servidor (noNovoModelo)", () => {
    expect(mesa).toMatch(
      /\(feito as \{ noNovoModelo\?: boolean \}\)\.noNovoModelo === true \? \(\s*<AConfirmarNoNovoModelo negociacaoId=\{Number\(feito\.id\)\} token=\{token\} \/>\s*\) : \(\s*promessaDaForma\(feito\.formaDePagamento, modeloDaNegociacao\(feito\.criadaEm\)\)\.backofficeAConfirmar/,
    );
    const comp = semComentarios(ler("src/components/admin/NovoModeloNaMesa.tsx"));
    expect(comp).toContain("backofficeAConfirmarNoNovoModelo(aPassarAClyonDaConta(conta))");
    expect(comp).toContain("/api/admin/negociacoes/fatura?negociacaoId=");
  });
});

describe("1b. o «Confirmar como CLYON» no modelo novo usa a mesma conta e as mesmas palavras", () => {
  it("as três chamadas levam a marca, e no modelo novo a conta é a ContaDoPagamento do modelo novo", () => {
    expect(mesa.match(/<ConfirmarPelaClyon[\s\S]*?\/>/g)?.length).toBe(3);
    for (const chamada of mesa.match(/<ConfirmarPelaClyon[\s\S]*?\/>/g) ?? []) {
      expect(chamada).toMatch(/novoModelo=\{\(\w+ as \{ noNovoModelo\?: boolean \}\)\.noNovoModelo === true\}/);
    }
    expect(mesa).toMatch(/\{novoModelo \? \(\s*<ContaDoNovoModeloAoConfirmar negociacaoId=\{negociacaoId\}/);
    const comp = semComentarios(ler("src/components/admin/NovoModeloNaMesa.tsx"));
    expect(comp).toContain("<ContaDoPagamento conta={conta} />");
  });
});

describe("2. o «Gerar referência de pagamento» do cliente não aparece no modelo novo", () => {
  it("a Mesa não o monta num trabalho do modelo novo", () => {
    const antes = mesa.slice(0, mesa.indexOf("<GerarReferencia"));
    const bloco = antes.slice(antes.lastIndexOf("{(() => {"));
    expect(bloco).toContain("if ((acordada as { noNovoModelo?: boolean }).noNovoModelo === true) return null;");
  });

  it("os Trabalhos CLYON ficam no modelo antigo (o servidor nunca os marca como do modelo novo)", () => {
    const novo = ler("src/lib/novo-modelo.ts");
    expect(novo).toContain("export function trabalhoClyonDoModeloAntigo(");
    const rota = ler("src/app/api/admin/negociacoes/route.ts");
    expect(rota).toContain("noNovoModelo: true");
  });

  it("a confirmação em lote não diz a todos que «liberta o dinheiro»", () => {
    expect(mesa).not.toContain("\"Fecha o trabalho e liberta o dinheiro de cada profissional; não tem volta. \"");
    expect(mesa).toContain("nos do modelo de 15/11, o profissional recebe a referência da taxa da plataforma e do IVA dela.");
  });
});
