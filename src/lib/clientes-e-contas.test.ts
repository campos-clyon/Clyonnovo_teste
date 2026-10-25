import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clientesDosPedidos, telefoneDoCliente } from "./clientes-dos-pedidos";

/**
 * «50 CONTAS ME PARECE POUCO» — 17-10-2026.
 *
 * O dono escolheu duas coisas: contar os clientes a sério (por email ou
 * telefone, nos pedidos), e uma caixa opcional «Guardar os meus dados» no fim
 * do pedido, que cria a conta com o consentimento de quem a marca.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("os clientes dos pedidos", () => {
  it("uma pessoa é um email ou um telefone — e quem tem os dois junta os outros", () => {
    const r = clientesDosPedidos(
      [
        { id: 1, email: "Ana@Mail.pt", telefone: null, criadoEm: "2026-09-01T10:00:00Z" },
        { id: 2, email: null, telefone: "+351 912 345 678", criadoEm: "2026-09-10T10:00:00Z" },
        // O mesmo telefone com o email da Ana: os três são a Ana.
        { id: 3, email: "ana@mail.pt", telefone: "912345678", criadoEm: "2026-08-20T10:00:00Z" },
        { id: 4, email: null, telefone: "930 000 111", criadoEm: "2026-10-01T10:00:00Z" },
        { id: 5, email: "rui@x.com", telefone: null, criadoEm: "2026-10-02T10:00:00Z" },
        // Sem nada por onde a identificar: não é ninguém.
        { id: 6, email: "sem-arroba", telefone: "12", criadoEm: null },
      ],
      ["rui@x.com", "outro@y.pt"],
    );
    expect(r).toEqual({
      pedidos: 6,
      clientes: 3,
      comConta: 1,
      soTelefone: 1,
      desde: "2026-08-20T10:00:00.000Z",
    });
  });

  it("o telefone conta pelos últimos nove algarismos", () => {
    expect(telefoneDoCliente("+351 912-345-678")).toBe("912345678");
    expect(telefoneDoCliente("912 345 678")).toBe("912345678");
    expect(telefoneDoCliente("1234")).toBeNull();
  });

  it("a rota devolve-os, e o painel diz desde quando e porquê", () => {
    const rota = ler("src/app/api/admin/users/route.ts");
    expect(rota).toContain("clientesDosPedidos(pedidos, emailsComConta)");
    expect(rota).toContain('"SELECT MAX(id) AS n FROM simulatorOrders"');
    const painel = ler("src/components/admin/ContasPanel.tsx");
    expect(painel).toContain("pedidos guardados");
    expect(painel).toContain("Pedir não exige conta.");
    expect(painel).toContain('u.loginMethod === "pedido" ? "Ainda não entrou"');
  });
});

describe("«Guardar os meus dados»", () => {
  const SIM = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
  const ROTA = ler("src/app/api/simulador/pedido/route.ts");
  const CONTA = ler("src/lib/conta-server.ts");

  it("é uma caixa desmarcada, só para quem não entrou, e pede o email", () => {
    expect(SIM).toContain("checked={formData.guardarDados === true}");
    const caixa = SIM.slice(SIM.indexOf('id="sim-guardar-dados"') - 600, SIM.indexOf('id="sim-guardar-dados"'));
    expect(caixa).toContain("{!isLoggedIn && (");
    expect(SIM).toContain("Para guardar os dados, escreva o email");
    expect(SIM).not.toMatch(/guardarDados:\s*true/);
  });

  it("o servidor só cria a conta com a caixa marcada, sem sessão e com email", () => {
    expect(ROTA).toContain('order?.guardarDados === true && !sessionEmail && formEmail && formEmail.includes("@")');
    expect(ROTA).toContain("await guardarDadosDoCliente({");
    expect(ROTA).toContain("      contaGuardada,");
  });

  it("a conta nasce «pelo pedido», sem entrada, e não escreve por cima do que já lá está", () => {
    const i = CONTA.indexOf("export async function guardarDadosDoCliente(");
    const f = CONTA.slice(i, CONTA.indexOf("export async function", i + 10));
    expect(f).toContain("'${CONTA_DO_PEDIDO}', 'user', NULL, NOW(), NOW()");
    expect(f).toContain("phone = IF(phone IS NULL OR phone = '', VALUES(phone), phone)");
    expect(f).not.toContain("lastSignedIn = NOW()");
    // Ao entrar pela primeira vez, passa ao método normal.
    expect(CONTA).toContain("loginMethod = IF(loginMethod = '${CONTA_DO_PEDIDO}', VALUES(loginMethod), loginMethod)");
  });

  it("o ecrã de sucesso diz que guardou, e só se guardou", () => {
    expect(SIM).toContain('contaGuardada: typeof saved.contaGuardada === "string" ? saved.contaGuardada : null');
    expect(SIM).toContain("{contaGuardada && (");
  });
});
