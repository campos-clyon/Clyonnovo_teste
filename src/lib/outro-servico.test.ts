import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HORAS_ATE_VOLTAR_AO_POR_DECIDIR, OUTRO_SERVICO_SEM_PROPOSTAS, outroSemPropostas, type NegociacaoParaContar } from "./outro-servico";
import { regraDoEnvio } from "./regra-do-envio";

/**
 * O «OUTRO SERVIÇO» — d6 de 30-10-2026, aprovada pelo dono e pelo CEO.
 *
 * Chega também a quem tem «Manutenção da casa» (o motor está guardado em
 * categorias-uma-so-lista.test.ts) e, se ficar um dia sem nenhuma proposta,
 * volta à Mesa, ao «Orçamentos novos».
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const AGORA = new Date("2026-10-31T12:00:00Z");
const horasAntes = (h: number) => new Date(AGORA.getTime() - h * 3600 * 1000).toISOString();
const neg = (n: Partial<NegociacaoParaContar> = {}): NegociacaoParaContar => ({
  estado: "aberta",
  propostasJson: "[]",
  criadaEm: horasAntes(30),
  ...n,
});
const PROPOSTA = JSON.stringify([{ por: "profissional", valor: 80, criadaEm: horasAntes(20), estado: "pendente" }]);

describe("o «Outro serviço» sem propostas volta ao «Orçamentos novos»", () => {
  it("foi aos profissionais, passou um dia, e ninguém propôs", () => {
    expect(HORAS_ATE_VOLTAR_AO_POR_DECIDIR).toBe(24);
    expect(outroSemPropostas({ serviceType: "outro", negociacoes: [neg(), neg()] }, AGORA)).toBe(true);
    // Exactamente 24 horas já conta; 23 ainda não.
    expect(outroSemPropostas({ serviceType: "outro", negociacoes: [neg({ criadaEm: horasAntes(24) })] }, AGORA)).toBe(true);
    expect(outroSemPropostas({ serviceType: "outro", negociacoes: [neg({ criadaEm: horasAntes(23) })] }, AGORA)).toBe(false);
  });

  it("só o «Outro serviço»: os outros serviços ficam em «À espera de propostas»", () => {
    expect(outroSemPropostas({ serviceType: "recolha_moveis", negociacoes: [neg()] }, AGORA)).toBe(false);
    expect(outroSemPropostas({ serviceType: "manutencao_casa", negociacoes: [neg()] }, AGORA)).toBe(false);
    expect(outroSemPropostas({ serviceType: null, negociacoes: [neg()] }, AGORA)).toBe(false);
  });

  it("uma proposta de um profissional, ou um aceite, chega para não voltar", () => {
    expect(outroSemPropostas({ serviceType: "outro", negociacoes: [neg(), neg({ propostasJson: PROPOSTA })] }, AGORA)).toBe(false);
    expect(outroSemPropostas({ serviceType: "outro", negociacoes: [neg({ estado: "aguarda_contratacao" })] }, AGORA)).toBe(false);
    expect(outroSemPropostas({ serviceType: "outro", negociacoes: [neg({ estado: "acordada" })] }, AGORA)).toBe(false);
  });

  it("a abertura do cliente (pedidos antigos) não é uma proposta de profissional", () => {
    const doCliente = JSON.stringify([{ por: "cliente", valor: 60, criadaEm: horasAntes(30), estado: "pendente" }]);
    expect(outroSemPropostas({ serviceType: "outro", negociacoes: [neg({ propostasJson: doCliente })] }, AGORA)).toBe(true);
  });

  it("quem disse que não conta como enviado e sem proposta; as mortas não contam", () => {
    expect(outroSemPropostas({ serviceType: "outro", negociacoes: [neg({ estado: "desistida", propostasJson: PROPOSTA })] }, AGORA)).toBe(true);
    expect(outroSemPropostas({ serviceType: "outro", negociacoes: [neg({ estado: "morta" })] }, AGORA)).toBe(false);
    // Nunca foi a ninguém: está no «Orçamentos novos» pela outra porta (sem negociações).
    expect(outroSemPropostas({ serviceType: "outro", negociacoes: [] }, AGORA)).toBe(false);
  });

  it("redistribuir dá-lhe outro dia: conta a última vez que chegou a alguém", () => {
    const negociacoes = [neg({ criadaEm: horasAntes(40) }), neg({ criadaEm: horasAntes(2) })];
    expect(outroSemPropostas({ serviceType: "outro", negociacoes }, AGORA)).toBe(false);
  });

  it("um JSON estragado ou uma data ilegível não rebentam a Mesa", () => {
    expect(outroSemPropostas({ serviceType: "outro", negociacoes: [neg({ propostasJson: "{" })] }, AGORA)).toBe(true);
    expect(outroSemPropostas({ serviceType: "outro", negociacoes: [neg({ criadaEm: "ontem" })] }, AGORA)).toBe(false);
  });
});

describe("a Mesa põe-nos em «Precisa de si», com a nota e o cartão de negociação (dono, 18-11-2026)", () => {
  const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");

  it("saem de «À espera de propostas» pela regra — e já não vão aos «Orçamentos novos»", () => {
    expect(MESA).toContain('import { OUTRO_SERVICO_SEM_PROPOSTAS, outroSemPropostas } from "@/lib/outro-servico";');
    expect(MESA).toContain("const relogioDoOutro = lidoEm != null ? new Date(lidoEm) : null;");
    expect(MESA).toContain('if (nivel === "n2" && relogioDoOutro && outroSemPropostas(e.pedido, relogioDoOutro)) {');
    expect(MESA).toContain("outrosSemPropostas.push(e.pedido);");
    expect(MESA).not.toContain("voltamAoPorDecidir");
  });

  it("o «Precisa de si» conta-os e desenha-os por cima, com a nota de decidir", () => {
    expect(OUTRO_SERVICO_SEM_PROPOSTAS).toBe(
      "Outro serviço há mais de 24 h sem propostas — decida: reenviar, passar a valor fixo ou falar com o cliente.",
    );
    expect(MESA).toContain('(chave === "n1" ? outrosSemPropostas.length : 0)');
    expect(MESA).toContain('{b.chave === "n1" && outrosSemPropostas.length > 0 && (');
    expect(MESA).toContain("{outrosSemPropostas.map((p) => cartaoDoPedido(p, b.corDoCartao))}");
    expect(MESA).toContain("{OUTRO_SERVICO_SEM_PROPOSTAS}");
    // Os «Orçamentos novos» contam só o que ainda não foi a ninguém.
    expect(MESA).toMatch(/\? porPromoverNaMesa\.length\s*\n\s*:/);
    const i = MESA.indexOf('chave: "porEnviar",');
    const bloco = MESA.slice(i, MESA.indexOf("visivelEm", i));
    expect(bloco).not.toContain("Outro serviço");
  });
});

describe("o backoffice diz a regra como o motor a faz", () => {
  it("quem tem Manutenção da casa recebe também o «Outro serviço»", () => {
    expect(regraDoEnvio({ categorias: ["Recolhas", "Manutenção da casa"], raioKm: 30, temPontoDaBase: true })).toBe(
      "Recebe pedidos destas categorias até 30 km da base: Recolhas, Manutenção da casa e Outro serviço.",
    );
    // Quem já o tinha gravado não o vê duas vezes.
    expect(
      regraDoEnvio({ categorias: ["Manutenção da casa", "Outro serviço"], raioKm: 30, temPontoDaBase: true }),
    ).toBe("Recebe pedidos destas categorias até 30 km da base: Manutenção da casa e Outro serviço.");
    expect(regraDoEnvio({ categorias: ["Recolhas"], raioKm: 30, temPontoDaBase: true })).toBe(
      "Recebe pedidos destas categorias até 30 km da base: Recolhas.",
    );
  });
});
