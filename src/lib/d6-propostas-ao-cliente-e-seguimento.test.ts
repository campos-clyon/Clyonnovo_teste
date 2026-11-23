import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  devidoDasPropostas,
  estadoDoEnvio,
  MINUTOS_DEPOIS_DA_PRIMEIRA,
  NOVA_REGRA_DESDE,
  PROPOSTAS_PARA_IR_LOGO,
  type PedidoParaOEnvio,
} from "./envio-das-propostas-ao-cliente";
import {
  passoDoSeguimento,
  primeiraPropostaEm,
  propostasPorVer,
  temOSeloDasPropostas,
  textoDoSeguimento24h,
  textoDoSeguimento72h,
  type PedidoParaOSeguimento,
} from "./seguimento-das-propostas";

/*
 * d6 (23-11-2026): a 1.ª proposta já vai ao cliente; o selo da Mesa e o botão
 * «Seguimento» (que só abre o WhatsApp). Este ficheiro guarda a regra, o selo,
 * os textos e o facto de nada sair sozinho.
 */

const depois = new Date(NOVA_REGRA_DESDE.getTime() + 3_600_000); // 17h00 UTC
const min = (t: Date, m: number) => new Date(t.getTime() + m * 60_000);

const envio = (o: Partial<PedidoParaOEnvio> = {}): PedidoParaOEnvio => ({
  pedidoId: 9201,
  parceiros: 1,
  primeiraEm: depois,
  ultimaMudancaEm: depois,
  jaEnviado: false,
  base: "total",
  melhorComIva: 135.3,
  temTelemovel: true,
  ...o,
});

describe("a regra do momento", () => {
  it("é a 1.ª proposta, sem espera além dos 10 min de assentar", () => {
    expect(PROPOSTAS_PARA_IR_LOGO).toBe(1);
    expect(MINUTOS_DEPOIS_DA_PRIMEIRA).toBe(0);
    expect(devidoDasPropostas(envio()).toISOString()).toBe(min(depois, 10).toISOString());
    expect(estadoDoEnvio(envio(), min(depois, 11))).toMatchObject({ tipo: "sai", agora: true });
    expect(estadoDoEnvio(envio(), min(depois, 5))).toMatchObject({ tipo: "sai", agora: false, porqueEspera: "mudou" });
  });

  it("as propostas que já esperavam seguem a regra de antes (3 ou 3 h): nada sai por causa da mudança", () => {
    const antes = new Date(NOVA_REGRA_DESDE.getTime() - 3_600_000);
    const velha = envio({ primeiraEm: antes, ultimaMudancaEm: antes });
    expect(devidoDasPropostas(velha).toISOString()).toBe(new Date(antes.getTime() + 3 * 3_600_000).toISOString());
    expect(estadoDoEnvio(velha, min(antes, 90))).toMatchObject({ tipo: "sai", agora: false });
  });
});

const comProposta = (criadaEm: string, extra: Partial<PedidoParaOSeguimento["negociacoes"][number]> = {}): PedidoParaOSeguimento["negociacoes"][number] => ({
  estado: "aberta",
  propostasJson: JSON.stringify([{ por: "profissional", valor: 100, criadaEm, estado: "pendente" }]),
  vistoPeloClienteEm: null,
  ...extra,
});

const AGORA = new Date("2026-11-24T12:00:00Z");

describe("o selo «propostas há mais de 1 h e o cliente ainda não as viu»", () => {
  it("aparece passada 1 h sem o cliente abrir", () => {
    const p = { status: "novo", negociacoes: [comProposta("2026-11-24T10:30:00Z")] };
    expect(temOSeloDasPropostas(p, AGORA)).toBe(true);
  });
  it("não aparece com menos de 1 h", () => {
    expect(temOSeloDasPropostas({ status: "novo", negociacoes: [comProposta("2026-11-24T11:30:00Z")] }, AGORA)).toBe(false);
  });
  it("não aparece se o cliente abriu depois de a proposta chegar; volta se a proposta chegou depois de ele abrir", () => {
    expect(temOSeloDasPropostas({ status: "novo", negociacoes: [comProposta("2026-11-24T08:00:00Z", { vistoPeloClienteEm: "2026-11-24T09:00:00Z" })] }, AGORA)).toBe(false);
    expect(temOSeloDasPropostas({ status: "novo", negociacoes: [comProposta("2026-11-24T08:00:00Z", { vistoPeloClienteEm: "2026-11-24T07:00:00Z" })] }, AGORA)).toBe(true);
  });
  it("não aparece onde o cliente não vê propostas: valor único, Trabalho CLYON, parceiro contratado, pedido fechado, negociação morta", () => {
    const n = [comProposta("2026-11-24T08:00:00Z")];
    expect(propostasPorVer({ status: "novo", valorUnicoCliente: 120, negociacoes: n })).toEqual([]);
    expect(propostasPorVer({ status: "novo", valorFixoClyon: 120, negociacoes: n })).toEqual([]);
    expect(propostasPorVer({ status: "novo", negociacoes: [...n, { estado: "acordada" }] })).toEqual([]);
    expect(propostasPorVer({ status: "cancelado", negociacoes: n })).toEqual([]);
    expect(propostasPorVer({ status: "novo", negociacoes: [comProposta("2026-11-24T08:00:00Z", { estado: "morta" })] })).toEqual([]);
  });
});

describe("o botão «Seguimento»: 24 h e 72 h depois das propostas", () => {
  it("o passo pelo tempo", () => {
    const t = new Date("2026-11-21T12:00:00Z");
    expect(passoDoSeguimento(t, new Date("2026-11-22T11:00:00Z"))).toBeNull();
    expect(passoDoSeguimento(t, new Date("2026-11-22T12:00:00Z"))).toBe("24h");
    expect(passoDoSeguimento(t, new Date("2026-11-24T11:59:00Z"))).toBe("24h");
    expect(passoDoSeguimento(t, new Date("2026-11-24T12:00:00Z"))).toBe("72h");
    expect(passoDoSeguimento(null, AGORA)).toBeNull();
  });
  it("a 1.ª proposta de um parceiro", () => {
    expect(primeiraPropostaEm({ negociacoes: [comProposta("2026-11-24T10:00:00Z"), comProposta("2026-11-24T08:00:00Z")] })?.toISOString()).toBe("2026-11-24T08:00:00.000Z");
  });
});

const dados = { pedidoId: 9201, nome: "ana silva", servico: "recolha de monos", propostas: 3, semIva: 105, total: 129.15 };

describe("os textos do seguimento", () => {
  for (const [nome, texto] of [
    ["24 h", textoDoSeguimento24h(dados)],
    ["72 h", textoDoSeguimento72h(dados)],
  ] as const) {
    it(`${nome}: parceiro (sem «verificado» a toda a gente: regra q), o valor com e sem IVA, a conta, sem emoji nem promessas proibidas`, () => {
      expect(texto).toContain("Olá, Ana!");
      expect(texto).toContain("#9201");
      expect(texto).toContain("105 € + IVA (129,15 € com IVA)");
      expect(texto).toContain("clyon.pt/conta");
      expect(texto).toMatch(/parceiros?/);
      expect(texto).not.toMatch(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u);
      expect(texto).not.toMatch(/próprio dia|contentor|big ?bag|nós fazemos|fazemos o trabalho|profissional/i);
    });
  }
  it("uma proposta diz-se no singular", () => {
    const um = { ...dados, propostas: 1 };
    expect(textoDoSeguimento24h(um)).toContain("uma proposta de um parceiro, de 105 €");
    expect(textoDoSeguimento72h(um)).toContain("a proposta continua");
  });
  it("sem IVA a acrescer, só o total", () => {
    expect(textoDoSeguimento24h({ ...dados, semIva: 86.96, total: 86.96 })).toContain("86,96 €");
  });
});

describe("nada sai sozinho", () => {
  it("a lib do seguimento não envia, e o botão da Mesa é só o que abre o WhatsApp (MensagemDaFase)", () => {
    const lib = readFileSync("src/lib/seguimento-das-propostas.ts", "utf8");
    expect(lib).not.toMatch(/fetch\(|enviarTexto|getPool|execute\(/);
    const painel = readFileSync("src/components/admin/AdminNegociacoesPanel.tsx", "utf8").replace(/\r\n/g, "\n");
    const i = painel.indexOf("textoDoSeguimentoDasPropostas(passo");
    const bloco = painel.slice(i, i + 900);
    expect(bloco).toContain("<MensagemDaFase");
    expect(bloco).not.toMatch(/fetch\(|enviar_pela_clyon/);
  });
});
