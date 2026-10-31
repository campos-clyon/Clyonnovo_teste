import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HORAS_ATE_VOLTAR_AO_POR_DECIDIR, outroSemPropostas, type NegociacaoParaContar } from "./outro-servico";
import { regraDoEnvio } from "./regra-do-envio";

/**
 * O «OUTRO SERVIÇO» — d6 de 30-10-2026, aprovada pelo dono e pelo CEO.
 *
 * Chega também a quem tem «Manutenção da casa» (o motor está guardado em
 * categorias-uma-so-lista.test.ts) e, se ficar um dia sem nenhuma proposta,
 * volta à Mesa, ao «Por decidir».
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

describe("o «Outro serviço» sem propostas volta ao «Por decidir»", () => {
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
    // Nunca foi a ninguém: está no «Por decidir» pela outra porta (sem negociações).
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

describe("a Mesa põe-nos no «Por decidir», com o cartão de negociação", () => {
  const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");

  it("saem de «À espera de propostas» pela regra, e só com o «Por decidir» à vista", () => {
    expect(MESA).toContain('import { HORAS_ATE_VOLTAR_AO_POR_DECIDIR, outroSemPropostas } from "@/lib/outro-servico";');
    expect(MESA).toContain(
      'mostrar !== "clyon" && tipo === "todos" && !aFiltrarProfissional && lidoEm != null ? new Date(lidoEm) : null;',
    );
    expect(MESA).toContain('if (nivel === "n2" && relogioDoPorDecidir && outroSemPropostas(e.pedido, relogioDoPorDecidir)) {');
    expect(MESA).toContain("voltamAoPorDecidir.push(e.pedido);");
  });

  it("o número do bloco conta-os, e o bloco desenha-os com o cartão de sempre", () => {
    expect(MESA).toContain("? porPromoverNaMesa.length + voltamAoPorDecidir.length");
    expect(MESA).toContain("{voltamAoPorDecidir.map((p) => cartaoDoPedido(p, b.corDoCartao))}");
    const i = MESA.indexOf('chave: "porEnviar",');
    const bloco = MESA.slice(i, MESA.indexOf("visivelEm", i));
    expect(bloco).toContain("«Outro serviço» que já foi aos profissionais e ficou um dia sem propostas");
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
