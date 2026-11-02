import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  IVA_DO_PAGAMENTO,
  O_VALOR_FICA_COM_A_CLYON,
  pagarOValor,
  servicoEParceiro,
} from "./frases-do-pagamento";
import { contaDoCliente } from "./taxas-plataforma";
import { quantoOClientePaga } from "./eupago";

/**
 * O ECRÃ DE PAGAR SIMPLES — 02-11-2026 (ordem do CEO e do dono, «como a
 * Vinted»). As frases são as de `frases-do-pagamento.ts`, à letra, e os
 * números do bloco são os do servidor: o total do desdobramento é o mesmo
 * número que se pede ao banco.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const ECRA = ler("src/components/PagarTrabalho.tsx");
const PROPOSTAS = ler("src/app/pedido/[token]/PropostasRecebidas.tsx");

describe("as frases do bloco de pagar", () => {
  it("dizem-se à letra", () => {
    expect(IVA_DO_PAGAMENTO).toBe("IVA (23 %)");
    expect(pagarOValor(140)).toBe("Pagar 140,00 €");
    expect(servicoEParceiro("Recolha de móveis", "Fred Teste")).toBe("Recolha de móveis · Fred Teste");
    expect(servicoEParceiro(null, "Fred Teste")).toBe("Fred Teste");
    expect(O_VALOR_FICA_COM_A_CLYON).toBe(
      "O valor fica com a CLYON e só chega ao parceiro depois de confirmar que o trabalho está feito.",
    );
  });

  it("o site usa-as pelo ficheiro partilhado, e o botão é «Pagar X €»", () => {
    expect(ECRA).toContain('from "@/lib/frases-do-pagamento"');
    for (const nome of ["PRECO", "SERVICO", "SEM_IVA", "IVA_DO_PAGAMENTO", "TOTAL_A_PAGAR", "COMO_PAGA", "MB_WAY", "REFERENCIA_MULTIBANCO", "O_VALOR_FICA_COM_A_CLYON"]) {
      expect((ECRA.match(new RegExp(`\\b${nome}\\b`, "g")) ?? []).length, nome).toBeGreaterThanOrEqual(2);
    }
    // O botão do trabalho (a diferença das horas, mais abaixo, tem os seus).
    expect(ECRA).toContain('{aPedir ? "A pedir…" : pagarOValor(valor)}');
  });

  it("o ficheiro das frases não depende do servidor (a app importa-o)", () => {
    const F = ler("src/lib/frases-do-pagamento.ts");
    const imports = F.match(/^import .* from "(.+)";$/gm) ?? [];
    expect(imports).toEqual(['import { TAXA_IVA } from "./taxas-plataforma";']);
    expect(ler("src/lib/taxas-plataforma.ts")).not.toMatch(/^import /m);
  });

  it("a página do pedido tira o cartão do preço quando o bloco de pagar está à vista", () => {
    expect(PROPOSTAS).toContain("aoDecidir={setBlocoDePagar}");
    expect(PROPOSTAS).toContain("titulo={servicoEParceiro(servico, nome)}");
    expect(PROPOSTAS).toContain("{!comBloco && (");
    expect(PROPOSTAS).toContain("Sobre o preço");
  });
});

describe("o desdobramento é a mesma conta do valor pedido", () => {
  it("serviço sem IVA + IVA = total = o que se pede ao banco", () => {
    for (const acordado of [101.3, 250.98, 87.22, 306, 0.5]) {
      const c = contaDoCliente(acordado);
      expect(Math.round((c.semIva + c.iva) * 100) / 100).toBe(c.total);
      expect(quantoOClientePaga(acordado, undefined, "iva_incluido", true)).toBe(c.total);
    }
  });

  it("o servidor manda-o no estado do pagamento, só com IVA incluído", () => {
    const E = ler("src/lib/pagamento-para-o-cliente.ts");
    expect(E).toContain("desdobramento:");
    expect(E).toContain("contaDoCliente(trabalho.acordado, trabalho.taxas)");
  });
});
