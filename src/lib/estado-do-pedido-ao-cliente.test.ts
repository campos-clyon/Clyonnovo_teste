import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FRASE_DO_ESTADO, estadoDoPedidoAoCliente, valorUnicoAceiteValido } from "./estado-do-pedido-ao-cliente";
import { AINDA_SEM_PROPOSTAS, PEDIDO_A_CONFERIR, VALOR_UNICO_ACEITE, VALOR_UNICO_EM_PREPARACAO } from "./promessas-publicas";

/* d53, 16-11-2026: o pedido na mão depois de enviar, e o estado verdadeiro na página. */

const raiz = path.resolve(__dirname, "..", "..");
const ler = (f: string) => readFileSync(path.join(raiz, f), "utf8").replace(/\r\n/g, "\n");

const comEmail = { contactEmail: "cliente@exemplo.pt", rawOrderJson: JSON.stringify({ origemPedido: "simulador" }) };
const semEmail = { contactEmail: null, rawOrderJson: JSON.stringify({ origemPedido: "simulador" }) };

describe("o estado do pedido sem propostas", () => {
  it("sem negociações é «a conferir» (o portão da Mesa)", () => {
    expect(estadoDoPedidoAoCliente(comEmail, [])).toBe("a_conferir");
    expect(estadoDoPedidoAoCliente(semEmail, [])).toBe("a_conferir");
  });

  it("com negociações, «enviado» — ou o valor em preparação quando é a CLYON que responde", () => {
    expect(estadoDoPedidoAoCliente(comEmail, [{ estado: "aberta" }])).toBe("enviado");
    expect(estadoDoPedidoAoCliente(semEmail, [{ estado: "aberta" }])).toBe("valor_unico_em_preparacao");
    const daEquipa = { contactEmail: "x@y.pt", rawOrderJson: JSON.stringify({ origemPedido: "backoffice" }) };
    expect(estadoDoPedidoAoCliente(daEquipa, [{ estado: "aberta" }])).toBe("valor_unico_em_preparacao");
  });

  it("o valor único aceite depois do último envio é «aceite»; antes dele, ainda por aceitar", () => {
    const enviado = { ...comEmail, valorUnicoCliente: "120.00", valorUnicoEm: "2026-11-16 10:00:00" };
    expect(estadoDoPedidoAoCliente(enviado, [{ estado: "aberta" }])).toBeNull();
    expect(estadoDoPedidoAoCliente({ ...enviado, valorUnicoAceiteEm: "2026-11-16 10:05:00" }, [{ estado: "aberta" }])).toBe(
      "valor_unico_aceite",
    );
    // Reenviado depois do «sim»: o aceite antigo já não conta.
    expect(estadoDoPedidoAoCliente({ ...enviado, valorUnicoAceiteEm: "2026-11-16 09:00:00" }, [{ estado: "aberta" }])).toBeNull();
    expect(valorUnicoAceiteValido(null, null)).toBe(false);
    expect(valorUnicoAceiteValido("2026-11-16 09:00:00", null)).toBe(true);
  });

  it("com o parceiro escolhido não se diz nada", () => {
    expect(estadoDoPedidoAoCliente({ ...comEmail, valorUnicoCliente: 100, valorUnicoAceiteEm: "2026-11-16 09:00:00" }, [{ estado: "acordada" }])).toBeNull();
  });

  it("as quatro frases", () => {
    expect(FRASE_DO_ESTADO).toEqual({
      a_conferir: PEDIDO_A_CONFERIR,
      enviado: AINDA_SEM_PROPOSTAS,
      valor_unico_em_preparacao: VALOR_UNICO_EM_PREPARACAO,
      valor_unico_aceite: VALOR_UNICO_ACEITE,
    });
    expect(PEDIDO_A_CONFERIR).toBe(
      "A CLYON está a conferir o seu pedido. Quando seguir para os parceiros da sua zona, avisamos por aqui e por WhatsApp.",
    );
    expect(VALOR_UNICO_EM_PREPARACAO).toBe("A CLYON está a preparar o valor para o seu pedido.");
    expect(VALOR_UNICO_ACEITE).toBe("Aceitou o valor. A CLYON está a escolher o parceiro.");
  });
});

describe("a página e a app dizem o mesmo", () => {
  it("o /pedido/[token] escolhe a frase pelas negociações todas e deixa de pedir o SIM a quem aceitou", () => {
    const v = ler("src/app/pedido/[token]/VistaDoPedido.tsx");
    expect(v).toContain("estadoDoPedidoAoCliente(pedido, await negociacoesDoPedido(pedido.id))");
    expect(v).toContain("semPropostas={estado ? FRASE_DO_ESTADO[estado] : undefined}");
    expect(v).toMatch(/estado === "valor_unico_aceite" \? \([\s\S]*FRASE_DO_ESTADO\.valor_unico_aceite[\s\S]*\) : \([\s\S]*responda SIM/);
  });

  it("a rota da app devolve o estado e a frase", () => {
    const r = ler("src/lib/pedidos-do-cliente.ts");
    expect(r).toContain("estado: estadoDoPedido,");
    expect(r).toContain("fraseDoEstado: estadoDoPedido ? FRASE_DO_ESTADO[estadoDoPedido] : null,");
  });
});

describe("o pedido na mão depois de enviar", () => {
  it("a rota devolve sempre o acesso ao próprio, e só na resposta da criação", () => {
    const r = ler("src/app/api/simulador/pedido/route.ts");
    expect(r).toContain("acessoToken: acesso.token,");
    expect(r).not.toMatch(/acessoToken:\s*clienteIndicouValores/);
    expect(r).toContain('headers: { "Cache-Control": "no-store" },');
  });

  it("o «Pedido enviado» abre o pedido, guarda o link sem wa.me a quem não deu email, e o Google passa a secundário", () => {
    const f = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
    expect(f).toContain("Abrir o meu pedido");
    // Revisão da Segurança: nunca um wa.me com o token — partilhar ou copiar, só do lado dele.
    expect(f).toContain("{!emailParaMaisTarde && <GuardarOLink url={linkDoPedido} />}");
    expect(f).toContain("navigator.share({ title: \"O meu pedido na CLYON\", url })");
    expect(f).toContain("navigator.clipboard.writeText(url)");
    expect(f).not.toContain("Guardar o link no WhatsApp");
    expect(f).not.toMatch(/WHATSAPP_DA_CLYON[^\n]*linkDoPedido/);
    expect(f).not.toMatch(/wa\.me[^\n]*(tokenDoPedido|linkDoPedido)/);
    expect(f).toContain("Quando chegar a 1.ª proposta, enviamos-lhe um link novo por email.");
    expect(f).toContain('`${linkDoPedido ? "site-btn-secondary" : "site-btn-primary"} mt-4 flex');
    expect(f).toContain("`${window.location.origin}/pedido/${tokenDoPedido}`");
  });
});
