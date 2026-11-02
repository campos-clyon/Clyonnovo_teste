import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  chaveDaNovidade,
  marcarComoVistas,
  podarVistas,
  quantasPorVer,
  vistasValidas,
  type PedidoNaLista,
} from "../../app-cliente/src/lib/pedidos";

/**
 * O SINO E O SELO DO INÍCIO (ordem do CEO com o sim do dono, 02-11-2026).
 * O número vinha de `quantosComNovidade`: contava a `novidade` que a lista da
 * API traz (o estado do pedido — «Por pagar» até se pagar) e nunca descia,
 * mesmo depois de abrir as Notificações e o pedido (#555). Agora conta só as
 * novidades por ver; abrir as Notificações vê todas as que lá estão, abrir o
 * pedido vê a dele; outra novidade no mesmo pedido volta a contar; o «visto»
 * fica no telemóvel, por conta, e apaga-se ao sair.
 */
const APP = join(process.cwd(), "app-cliente", "src");
const ler = (p: string) => readFileSync(join(APP, p), "utf8").replace(/\r\n/g, "\n");

const p = (id: number, novidade: string | null = null): PedidoNaLista => ({
  id,
  servico: "Recolha de móveis",
  cidade: "Lisboa",
  criadoEm: null,
  criadoEmTexto: null,
  estadoTexto: "Contratado",
  novidade,
  trabalhoClyon: false,
});

describe("as novidades vistas (regras)", () => {
  it("a chave é o pedido e o texto; sem novidade, nada", () => {
    expect(chaveDaNovidade(p(555, "Por pagar"))).toBe("555|Por pagar");
    expect(chaveDaNovidade(p(555))).toBeNull();
    expect(chaveDaNovidade(p(555, ""))).toBeNull();
  });

  it("«Por pagar» conta até ser vista; depois não, e o pedido continua com a novidade", () => {
    const lista = [p(555, "Por pagar"), p(554), p(553, "1 proposta nova")];
    const nada = new Set<string>();
    expect(quantasPorVer(lista, nada)).toBe(2);
    const vistas = marcarComoVistas(nada, [lista[0]]);
    expect(quantasPorVer(lista, vistas)).toBe(1);
    expect(lista[0].novidade).toBe("Por pagar");
    expect(quantasPorVer(lista, marcarComoVistas(vistas, lista))).toBe(0);
  });

  it("outra novidade no mesmo pedido volta a contar", () => {
    const vistas = marcarComoVistas(new Set(), [p(555, "Confirme o trabalho")]);
    expect(quantasPorVer([p(555, "Confirme o trabalho")], vistas)).toBe(0);
    expect(quantasPorVer([p(555, "Por pagar")], vistas)).toBe(1);
    expect(quantasPorVer([p(553, "2 propostas novas")], marcarComoVistas(new Set(), [p(553, "1 proposta nova")]))).toBe(1);
  });

  it("marcar o que já está visto devolve o mesmo conjunto (sem voltas de ecrã)", () => {
    const vistas = marcarComoVistas(new Set(), [p(1, "Por pagar")]);
    expect(marcarComoVistas(vistas, [p(1, "Por pagar"), p(2)])).toBe(vistas);
  });

  it("a poda esquece as que já não são a novidade do pedido, e guarda as das páginas por ler", () => {
    const vistas = new Set(["555|Confirme o trabalho", "555|Por pagar", "9|Por pagar"]);
    const podadas = podarVistas(vistas, [p(555, "Por pagar")]);
    expect([...podadas].sort()).toEqual(["555|Por pagar", "9|Por pagar"]);
    // Se a mesma novidade voltar depois de ter saído, conta outra vez.
    const semNada = podarVistas(podadas, [p(555)]);
    expect(quantasPorVer([p(555, "Por pagar")], semNada)).toBe(1);
    expect(podarVistas(semNada, [p(555)])).toBe(semNada);
  });

  it("o ficheiro guardado só aceita chaves com a forma certa", () => {
    expect([...vistasValidas({ vistas: ["555|Por pagar", 3, "x|y", "|Por pagar"] })]).toEqual(["555|Por pagar"]);
    expect(vistasValidas(null).size).toBe(0);
    expect(vistasValidas({ vistas: "555|Por pagar" }).size).toBe(0);
  });
});

describe("as novidades vistas (na app)", () => {
  it("o sino, o Início e o separador contam `porVer`, já não `quantosComNovidade`", () => {
    const inicio = ler("app/(app)/index.tsx");
    const barra = ler("app/(app)/_layout.tsx");
    expect(inicio).toContain("const novidades = ligado ? porVer : 0;");
    expect(barra).toContain("const { porVer: novidades } = usePedidos();");
    for (const t of [inicio, barra]) expect(t).not.toContain("quantosComNovidade(");
  });

  it("abrir as Notificações vê as que lá estão; abrir o pedido vê a dele", () => {
    const notif = ler("app/notificacoes.tsx");
    expect(notif).toContain("if (ligado) marcarVistas(pedidos);");
    const pedido = ler("componentes/VistaDoPedido.tsx");
    expect(pedido).toContain("marcarVistas([{ id: pedidoId, novidade: novidadeDaLista }])");
    // O convidado (link sem conta) não mexe nas vistas da conta.
    expect(pedido).toContain("const naLista = convidado ? undefined :");
  });

  it("o visto fica no telemóvel por conta (sem o email) e apaga-se ao sair", () => {
    const g = ler("lib/guardado.ts");
    expect(g).toContain('const VISTAS = "novidades-vistas.json";');
    expect(g).toContain("conta: marcaDaConta(conta)");
    expect(g.slice(g.indexOf("export function apagarTudoDaConta"))).toMatch(/^[^]*?apagar\(VISTAS\);[^]*?\n\}/);
    const estado = ler("estado/Pedidos.tsx");
    expect(estado).toContain("const vistasLidas = activo && !!conta && vistasDe === conta;");
    expect(estado).toContain("const porVer = vistasLidas ? quantasPorVer(pedidos, vistas) : 0;");
  });

  it("os avisos de push não põem número no ícone (o número é só o da app)", () => {
    expect(ler("lib/avisos.ts")).toContain("shouldSetBadge: false");
  });
});
