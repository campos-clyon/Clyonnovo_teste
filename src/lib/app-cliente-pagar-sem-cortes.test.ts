import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { estadoDoPagar, linhaDoPagar, quantidadeCurta, soAReferencia } from "../../app-cliente/src/lib/pagamento";
import type { Pagamento, PendenteDoPagamento } from "../../app-cliente/src/lib/pedidos";
import { paraCopiar } from "../../app-cliente/src/lib/pedidos";

/*
 * O ECRÃ DE PAGAR SEM CORTES — 02-11-2026 (ordem do CEO com o sim do dono;
 * captura com o Multibanco de 1,23 €): a linha debaixo do título curta, o
 * «Valor» da referência só com o total, sem o botão grande quando já há uma
 * referência válida, e nada com reticências a 360 px com a letra grande.
 */

const ler = (f: string) => readFileSync(join(__dirname, "..", "..", f), "utf8");
const AGORA = Date.parse("2026-11-02T15:00:00Z");

describe("a linha debaixo do título: o dia e a quantidade em curto", () => {
  it("a da captura: «04/11/2026 · 1 carga», sem «Quantidade estimada:»", () => {
    const d = "Quantidade estimada: Enche uma carrinha (poucos itens).\nSofá de 3 lugares, uma mesa e 4 cadeiras.";
    expect(linhaDoPagar("04/11/2026", d)).toBe("04/11/2026 · 1 carga");
    expect(linhaDoPagar("13/11/2026, às 10h30", d)).toBe("13/11/2026, às 10h30 · 1 carga");
  });

  it("itens, sacos, camião e casa", () => {
    expect(quantidadeCurta("Itens: 2 grandes, 1 pequenos.")).toBe("3 itens");
    expect(quantidadeCurta("Itens: 1 médios.")).toBe("1 item");
    expect(quantidadeCurta("Quantidade estimada: Enche uma carrinha.\nQuantidade exacta: 5.")).toBe("5 itens");
    expect(quantidadeCurta("Entulho: Misto.\nSacos: 4 em sacos e 6 por ensacar.")).toBe("10 sacos");
    expect(quantidadeCurta("Quantidade estimada: Enche a caixa de um camião (volume médio).")).toBe("Caixa de camião");
    expect(quantidadeCurta("Quantidade estimada: Enche um camião.")).toBe("1 camião");
    expect(quantidadeCurta("Casa: T2.")).toBe("T2");
  });

  it("sem quantidade conhecida não se inventa nem se copia a descrição", () => {
    expect(quantidadeCurta("Quantidade estimada: Não tenho a certeza.")).toBeNull();
    expect(linhaDoPagar("04/11/2026", "Um sofá velho na garagem.")).toBe("04/11/2026");
    expect(linhaDoPagar(null, null)).toBeNull();
  });

  it("o ecrã usa a linha curta e não a corta", () => {
    const p = ler("app-cliente/src/componentes/Pagar.tsx");
    expect(p).toContain("const linhaCurta = linhaDoPagar(dia, p.descricao);");
    expect(p).not.toContain('p.descricao?.split("\\n")');
  });
});

const ref = (expiraEm: string | null): PendenteDoPagamento => ({
  metodo: "multibanco",
  metodoTexto: "Multibanco",
  entidade: "12345",
  referencia: "123 456 789",
  valorTexto: "1,23 € (1,00 € sem IVA)",
  expiraEm,
  expiraEmTexto: "05/11/2026 às 23:59",
});
const pagamento = (pendentes: PendenteDoPagamento[]): Pagamento => ({
  disponivel: true,
  pago: false,
  pagoEmTexto: null,
  emDinheiroAoProfissional: false,
  pendentes,
  ivaIncluido: true,
  valoresTexto: { comFactura: "1,23 € (1,00 € sem IVA)", semFactura: "1,00 €" },
});

describe("a referência Multibanco", () => {
  it("o «Valor» mostra só o total e o «Copiar» só o número", () => {
    const p = ler("app-cliente/src/componentes/Pagar.tsx");
    expect(p).toContain('<Copiavel rotulo="Valor" valor={valorDoBotao(p.valorTexto)} />');
    expect(paraCopiar("1,23 €")).toBe("1,23");
    expect(paraCopiar("123 456 789")).toBe("123456789");
  });

  it("válida: só a referência, sem o botão grande; expirada: volta o bloco inteiro", () => {
    expect(soAReferencia(estadoDoPagar(pagamento([ref("2026-11-05T23:59:00Z")]), AGORA))).toBe(true);
    expect(soAReferencia(estadoDoPagar(pagamento([ref("2026-11-02T14:00:00Z")]), AGORA))).toBe(false);
    expect(soAReferencia(estadoDoPagar(pagamento([]), AGORA))).toBe(false);
    const p = ler("app-cliente/src/componentes/Pagar.tsx");
    const bloco = p.slice(p.indexOf(") : referencia && estado.multibanco ? ("), p.indexOf("estado.mbwayNaoConfirmado && !falha"));
    expect(bloco).toContain('<Ligacao titulo="Pagar por MB WAY"');
    expect(bloco).not.toContain("<Botao");
  });

  it("no ecrã do pedido, com a referência, o botão é «Ver a referência Multibanco»", () => {
    expect(ler("app-cliente/src/componentes/Pagar.tsx")).toContain('<Botao titulo="Ver a referência Multibanco" tipo="secundario" aoCarregar={irPagar} />');
  });
});

describe("sem reticências no pagar e no pedido", () => {
  it("nenhum numberOfLines no pagar, no preço, nas propostas, na vista do pedido nem nos botões", () => {
    for (const f of ["Pagar.tsx", "Preco.tsx", "Proposta.tsx", "VistaDoPedido.tsx"]) {
      expect(ler(`app-cliente/src/componentes/${f}`), f).not.toContain("numberOfLines");
    }
    const ui = ler("app-cliente/src/componentes/ui.tsx");
    const botao = ui.slice(ui.indexOf("export function Botao("), ui.indexOf("export function Ligacao("));
    expect(botao).not.toContain("numberOfLines");
  });

  it("nas linhas de valores o rótulo encolhe e o valor não", () => {
    const p = ler("app-cliente/src/componentes/Preco.tsx");
    expect(p).toContain("flexShrink: 1, color: forte ? CORES.tinta : CORES.suave");
    expect(p).toContain("flexShrink: 0, color: CORES.tinta");
  });
});
