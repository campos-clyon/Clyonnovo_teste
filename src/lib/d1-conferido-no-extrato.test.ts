import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FILTRO_DA_ORIGEM_VAZIO,
  conferirRegistoAMao,
  contarPorConferir,
  eAlvoDoExtrato,
  origemDoPagamento,
  passaNoFiltroDaOrigem,
  porConferirNoExtrato,
  type RegistoDoDinheiro,
} from "./origem-do-pagamento";

/**
 * d1 (CEO e dono, 19-11-2026) — CONFERIR ANTES DE DAR POR PAGO.
 *
 * Marcar como pago o IVA ou a taxa de um parceiro por transferência ou
 * numerário pede o comprovativo (como o «Já recebemos»); e cada transferência
 * que entrou na CLYON ganha a marca «conferido no extrato» (quem e quando),
 * com o filtro «por conferir» nos Pagamentos. Nada existente se apaga ou muda.
 */

const raiz = join(__dirname, "..", "..");
const ler = (p: string) => readFileSync(join(raiz, p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) =>
  s
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");

function registo(p: Partial<RegistoDoDinheiro> & { metodo?: string }): RegistoDoDinheiro {
  const origem = origemDoPagamento({ metodo: p.metodo ?? "pro_transferencia", contaDeDestino: "Conta de exemplo" });
  const base = {
    alvo: p.alvo ?? "cobranca",
    alvoId: p.alvoId ?? 1,
    oQue: "",
    valor: 10,
    em: null,
    origem,
    comprovativos: [],
    semComprovativo: false,
    conferidoNoExtrato: p.conferidoNoExtrato ?? null,
  } as RegistoDoDinheiro;
  return { ...base, porConferir: porConferirNoExtrato(base) };
}

describe("«conferido no extrato»: só as transferências que entraram na CLYON", () => {
  it("uma transferência (do cliente ou do parceiro) fica por conferir até alguém a marcar", () => {
    expect(registo({ metodo: "pro_transferencia" }).porConferir).toBe(true);
    expect(registo({ metodo: "transferencia", alvo: "pagamento" }).porConferir).toBe(true);
    expect(registo({ metodo: "transferencia", conferidoNoExtrato: { em: "2026-11-19T12:00:00Z", por: "x" } }).porConferir).toBe(false);
  });

  it("o euPago, o numerário e o «Já pagámos» ao profissional não se conferem no extrato", () => {
    expect(registo({ metodo: "mbway", alvo: "pagamento" }).porConferir).toBe(false);
    expect(registo({ metodo: "multibanco", alvo: "pagamento" }).porConferir).toBe(false);
    expect(registo({ metodo: "pro_numerario" }).porConferir).toBe(false);
    expect(registo({ metodo: "transferencia", alvo: "pago_ao_profissional" }).porConferir).toBe(false);
  });

  it("o filtro «por conferir» deixa passar só os trabalhos com uma transferência por conferir", () => {
    const f = { ...FILTRO_DA_ORIGEM_VAZIO, soPorConferir: true };
    expect(passaNoFiltroDaOrigem([registo({ metodo: "pro_transferencia" })], f)).toBe(true);
    expect(passaNoFiltroDaOrigem([registo({ metodo: "mbway", alvo: "pagamento" })], f)).toBe(false);
    expect(passaNoFiltroDaOrigem(undefined, f)).toBe(false);
    // Sem o filtro, passa tudo como antes.
    expect(passaNoFiltroDaOrigem(undefined, FILTRO_DA_ORIGEM_VAZIO)).toBe(true);
    expect(FILTRO_DA_ORIGEM_VAZIO.soPorConferir).toBe(false);
  });

  it("conta quantas faltam conferir", () => {
    expect(
      contarPorConferir([[registo({}), registo({ metodo: "mbway", alvo: "pagamento" })], undefined, [registo({ alvoId: 2 })]]),
    ).toBe(2);
  });

  it("só se marca numa linha de pagamentos ou numa parte da cobrança", () => {
    expect(eAlvoDoExtrato("pagamento")).toBe(true);
    expect(eAlvoDoExtrato("cobranca")).toBe(true);
    expect(eAlvoDoExtrato("pago_ao_profissional")).toBe(false);
    expect(eAlvoDoExtrato("qualquer")).toBe(false);
  });
});

describe("marcar o IVA ou a taxa do parceiro pede o comprovativo", () => {
  const contas = [{ id: "c1", nome: "Conta de exemplo", ultimos4: null }];

  it("por transferência ou numerário, sem o ficheiro, não se grava", () => {
    for (const metodo of ["pro_transferencia", "pro_numerario"]) {
      const r = conferirRegistoAMao({ metodo, contaId: "c1", contas, temComprovativo: false, comprovativoObrigatorio: true });
      expect(r.ok).toBe(false);
    }
  });

  it("a rota de «A receber dos profissionais» exige-o, e o ecrã também", () => {
    const rota = semComentarios(ler("src/app/api/admin/pagamentos/a-receber-dos-profissionais/route.ts"));
    expect(rota).toContain("comprovativoObrigatorio: true");
    expect(rota).not.toContain("comprovativoObrigatorio: false");
    const ecra = ler("src/components/admin/AReceberDosProfissionais.tsx");
    expect(ecra).toContain("provaCompleta(metodo, conta, ficheiro, true)");
    expect(ecra).not.toContain("obrigatorio={false}");
  });
});

describe("a marca na base: colunas só a acrescentar, rota do administrador, registo permanente", () => {
  const base = ler("src/lib/rasto-do-pagamento-na-base.ts");
  const rota = ler("src/app/api/admin/pagamentos/conferido-no-extrato/route.ts");

  it("as quatro colunas nascem por ALTER TABLE … ADD COLUMN, nulas", () => {
    for (const t of ["pagamentos", "cobrancasAoProfissional"]) {
      expect(base).toContain(`ALTER TABLE ${t} ADD COLUMN conferidoNoExtratoEm DATETIME NULL DEFAULT NULL`);
      expect(base).toContain(`ALTER TABLE ${t} ADD COLUMN conferidoNoExtratoPor VARCHAR(120) NULL DEFAULT NULL`);
    }
  });

  it("marcar escreve só quem e quando, uma vez, e nunca apaga", () => {
    const i = base.indexOf("export async function marcarConferidoNoExtrato");
    const f = semComentarios(base.slice(i));
    expect(f).toMatch(/SET conferidoNoExtratoEm = \?, conferidoNoExtratoPor = \? WHERE id = \? AND conferidoNoExtratoEm IS NULL/);
    expect(f).not.toMatch(/\bDELETE\b/);
    expect(f).not.toMatch(/SET[^`]*\b(valor|estado|activa)\s*=/);
  });

  it("a rota é do administrador e fica no registo permanente", () => {
    const r = semComentarios(rota);
    expect(r).toContain("requireAdminGeral(req)");
    expect(r).not.toMatch(/\brequireAdmin\(req\)/);
    expect(r).toContain("registarSemFalhar(");
    expect(r).toContain('acontecimento: "pagamento_conferido_no_extrato"');
  });

  it("os Pagamentos mostram o filtro «por conferir», com o número", () => {
    const painel = ler("src/components/admin/AdminPagamentosPanel.tsx");
    expect(painel).toContain("quantosPorConferir={quantosPorConferir}");
    expect(ler("src/components/admin/RastoDoPagamento.tsx")).toContain("Por conferir no extrato (");
  });
});
