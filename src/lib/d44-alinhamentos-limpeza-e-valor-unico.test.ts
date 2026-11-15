/**
 * Alinhamentos de 15-11-2026 (decisões já aprovadas):
 * - a limpeza e a lavagem depois de um esvaziamento FAZEM-SE (dono, 14-11; a
 *   página do anúncio da d42 já o dizia) — nenhuma página diz o contrário;
 * - um pedido com o valor único (d39) está «Orçamento por aceitar», e o link do
 *   convidado recebe o valor único como a conta.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ESTADO_DO_VALOR_UNICO, estadoDoPedidoParaOCliente } from "@/lib/pedido-para-a-app";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("a limpeza depois do esvaziamento faz-se, em todo o lado", () => {
  const PAGINAS = [
    "src/app/esvaziamento-de-casas/page.tsx",
    "src/app/esvaziamento-de-casas-amadora/page.tsx",
    "src/lib/city-content.ts",
    "src/lib/perguntas-frequentes.ts",
  ];

  it("nenhuma diz que a limpeza não é serviço nem manda para uma empresa de limpezas", () => {
    for (const p of PAGINAS) {
      const s = ler(p);
      expect(s, p).not.toContain("A limpeza não é um serviço da CLYON");
      expect(s, p).not.toContain("limpezas a fundo");
      expect(s, p).not.toContain("conte com uma empresa de limpezas");
    }
  });

  it("a pergunta frequente do esvaziamento responde que sim, feita pelo parceiro escolhido", () => {
    for (const p of PAGINAS.slice(0, 2)) {
      const s = ler(p);
      const i = s.indexOf('question: "Também fazem limpeza após o esvaziamento?"');
      expect(i, p).toBeGreaterThan(-1);
      const resposta = s.slice(i, s.indexOf("},", i));
      expect(resposta, p).toContain("Sim, se a pedir.");
      expect(resposta, p).toContain("lavagem do pavimento");
      expect(resposta, p).toContain("parceiro escolhido");
    }
  });
});

describe("o valor único na app de cliente", () => {
  const base = {
    status: "pendente",
    trabalhoClyon: false,
    contratado: null,
    comPropostas: 2,
    enviado: true,
  };

  it("com o valor único é «Orçamento por aceitar», mesmo com propostas por baixo", () => {
    expect(ESTADO_DO_VALOR_UNICO).toBe("Orçamento por aceitar");
    expect(estadoDoPedidoParaOCliente({ ...base, valorUnico: true })).toBe("Orçamento por aceitar");
    expect(estadoDoPedidoParaOCliente({ ...base, comPropostas: 0, valorUnico: true })).toBe("Orçamento por aceitar");
  });

  it("sem ele, fica como estava", () => {
    expect(estadoDoPedidoParaOCliente(base)).toBe("Tem propostas");
    expect(estadoDoPedidoParaOCliente({ ...base, comPropostas: 0 })).toBe("À espera de propostas");
  });

  it("cancelado, concluído ou Trabalho CLYON não mudam por causa dele", () => {
    expect(estadoDoPedidoParaOCliente({ ...base, status: "cancelado", valorUnico: true })).toBe("Cancelado");
    expect(estadoDoPedidoParaOCliente({ ...base, status: "concluido", valorUnico: true })).toBe("Concluído");
    expect(estadoDoPedidoParaOCliente({ ...base, trabalhoClyon: true, valorUnico: true })).toBe("A ser revisto pela CLYON");
  });

  it("o resumo do pedido passa a marca, e o convidado recebe o valor único", () => {
    const s = ler("src/lib/pedidos-do-cliente.ts");
    expect(s).toContain("valorUnico: temValorUnico(r.valorUnico),");
    const i = s.indexOf("export async function pedidoDoConvidadoParaAApp(");
    const corpo = s.slice(i, s.indexOf("\n}\n", i));
    expect(corpo).toContain("valorUnico: p.valorUnico,");
  });
});
