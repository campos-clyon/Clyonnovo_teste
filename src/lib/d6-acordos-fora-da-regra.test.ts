import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { acordoPedeMotivo, avisoDaReserva, fraseDoAcordoAbaixoDoMinimo, minimoDoServico } from "./acordos-fora-da-regra";
import { contaDoNovoModelo } from "./conta-do-pagamento";

/*
 * d6 de 22/11/2026 — acordos fora da regra pedem motivo. Sem nomes nem dados de
 * pessoas: só números de pedido e valores.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("d6 (1) um acordo abaixo do preço mínimo pede motivo escrito", () => {
  it("os mínimos: recolha 60 € e mudança 3 h à referência", () => {
    expect(minimoDoServico("recolha_moveis")).toBe(60);
    expect(minimoDoServico("recolha_monos")).toBe(60);
    expect(minimoDoServico("mudanca")).toBe(120);
    expect(minimoDoServico("esvaziamento_casa")).toBeNull();
  });

  it("25 € numa recolha, sem motivo, recusa (o #651)", () => {
    const r = acordoPedeMotivo("recolha_moveis", 25, undefined);
    expect(r.pede).toBe(true);
    expect(r.pede && r.erro).toContain("mínimo");
    expect(acordoPedeMotivo("recolha_moveis", 25, "  ")).toMatchObject({ pede: true });
    expect(acordoPedeMotivo("recolha_moveis", 25, "ab")).toMatchObject({ pede: true });
  });

  it("com motivo escrito passa; a partir do mínimo não pede nada", () => {
    expect(acordoPedeMotivo("recolha_moveis", 25, "Só uma cadeira, ao lado de outro trabalho")).toEqual({ pede: false });
    expect(acordoPedeMotivo("recolha_moveis", 60, undefined)).toEqual({ pede: false });
    expect(acordoPedeMotivo("mudanca", 60, undefined)).toMatchObject({ pede: true });
    expect(acordoPedeMotivo("esvaziamento_casa", 10, undefined)).toEqual({ pede: false });
    expect(fraseDoAcordoAbaixoDoMinimo("recolha_moveis", 100)).toBeNull();
  });

  it("a rota de corrigir o valor pede o motivo antes de gravar", () => {
    const t = ler("src/app/api/admin/negociacoes/valor/route.ts");
    expect(t).toContain("acordoPedeMotivo(linha.serviceType, novo, motivo)");
    expect(t.indexOf("acordoPedeMotivo(")).toBeLessThan(t.indexOf('UPDATE negociacoes SET valorAcordado = ?'));
    expect(t).toContain("precisaMotivo: true");
  });
});

describe("d6 (2) no valor único, a parte da CLYON acima de metade avisa e propõe a d82", () => {
  const taxas = { cliente: 0, profissional: 0.1 };

  it("o #648: o parceiro recebe 174,09 € e teria de devolver mais de metade", () => {
    // Uma proposta de 100 € com uma reserva de 90 €: a parte da CLYON passa de metade do que o cliente paga.
    const conta = contaDoNovoModelo(100, taxas, "normal", false, 9000);
    const aviso = avisoDaReserva(conta);
    expect(aviso).not.toBeNull();
    expect(aviso!.percentagem).toBeGreaterThan(50);
    expect(aviso!.texto).toContain("O cliente paga à CLYON");
    expect(aviso!.aPassar / aviso!.total).toBeGreaterThan(0.5);
  });

  it("uma reserva pequena não avisa; sem reserva também não", () => {
    expect(avisoDaReserva(contaDoNovoModelo(100, taxas, "normal", false, 500))).toBeNull();
    expect(avisoDaReserva(contaDoNovoModelo(100, taxas, "normal", false, 0))).toBeNull();
    expect(avisoDaReserva(null)).toBeNull();
  });

  it("uma reserva negativa (o escolhido pediu mais) não é a que se avisa", () => {
    expect(avisoDaReserva(contaDoNovoModelo(300, taxas, "normal", false, -2000))).toBeNull();
  });

  it("o ecrã dos Pagamentos mostra o aviso por cima do caminho d82", () => {
    const t = ler("src/components/admin/AdminPagamentosPanel.tsx");
    expect(t).toContain("avisoDaReserva(t.conta)");
    expect(t.indexOf("avisoDaReserva(t.conta)")).toBeLessThan(t.indexOf("<ClientePagaAClyon"));
  });
});
