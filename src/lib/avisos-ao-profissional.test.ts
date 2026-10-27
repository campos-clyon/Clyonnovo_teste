import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIAS_ATE_AO_ALERTA,
  atrasadosPrimeiro,
  diasAEsperarConfirmacao,
  haQuantosDias,
  passouDoPrazo,
} from "./feitos-por-confirmar";

/*
 * AVISOS AO PROFISSIONAL — 27-10-2026.
 *
 * Trabalho confirmado e «Já pagámos» chegam ao telemóvel dele (push "pro"),
 * depois de gravado e sem nunca lançar. Na Mesa, os feitos por confirmar
 * dizem há quantos dias, em hora de Lisboa; com dois dias ou mais sobem ao
 * topo e o selo passa a alerta.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("as funções do aviso", () => {
  const PUSH = ler("src/lib/avisar-por-push.ts");

  it("as duas novas mandam ao telemóvel do profissional e engolem os erros", () => {
    for (const nome of ["avisarProfissionalConfirmadoPorPush", "avisarProfissionalPagoPorPush"]) {
      const i = PUSH.indexOf(`export async function ${nome}`);
      expect(i, nome).toBeGreaterThan(-1);
      const corpo = PUSH.slice(i, PUSH.indexOf("\nexport ", i + 10));
      expect(corpo, nome).toMatch(/sendPushToUser\([\s\S]*?"pro"\)/);
      expect(corpo, nome).toContain("negociacaoId");
      expect(corpo, nome).toMatch(/try \{[\s\S]*\} catch/);
    }
  });

  it("«Já pagámos» diz quanto e porquê, como a CLYON que paga", () => {
    expect(PUSH).toContain("A CLYON pagou-lhe ${euros(dados.valor)}");
    expect(PUSH).toContain("pelo #${dados.pedidoId}");
  });
});

describe("as três rotas chamam o aviso com \"pro\"", () => {
  it("a confirmação de qualquer caminho manda o push (avisar-confirmacao.ts)", () => {
    const s = ler("src/lib/avisar-confirmacao.ts");
    expect(s).toContain("await avisarProfissionalConfirmadoPorPush(");
  });

  it("os Trabalhos CLYON, ao confirmar, mandam o email e o push — depois de gravar", () => {
    const s = ler("src/app/api/admin/trabalhos-clyon/confirmar/route.ts");
    const gravou = s.indexOf("await confirmarExecucao(");
    const aviso = s.indexOf("await avisarProfissionalTrabalhoConfirmado(");
    expect(gravou).toBeGreaterThan(-1);
    expect(aviso).toBeGreaterThan(gravou);
  });

  it("«Já pagámos» nos Pagamentos, depois do UPDATE, com o valor de quantoOProfissionalRecebe", () => {
    const s = ler("src/app/api/admin/pagamentos/pago-ao-profissional/route.ts");
    const update = s.indexOf("UPDATE negociacoes SET pagoEm");
    const aviso = s.indexOf("await avisarProfissionalPagoPorPush(");
    expect(update).toBeGreaterThan(-1);
    expect(aviso).toBeGreaterThan(update);
    expect(s).toMatch(/quantoOProfissionalRecebe\(Number\(l\.valorAcordado\), taxasDaNegociacao\(l\)\)/);
    expect(s.slice(aviso, aviso + 300)).toContain("valor: recebe");
  });

  it("e ao marcar um levantamento como pago", () => {
    const s = ler("src/app/api/admin/levantamentos/route.ts");
    const marcou = s.indexOf("await marcarLevantamento(");
    const aviso = s.indexOf("await avisarProfissionalPagoPorPush(");
    expect(marcou).toBeGreaterThan(-1);
    expect(aviso).toBeGreaterThan(marcou);
    expect(s.slice(s.lastIndexOf('if (estado === "pago")', aviso), aviso)).toContain("abaterDividasNoSaldo");
  });

  it("o push sai sempre como \"pro\" (o envio está na função, e as rotas só a chamam)", () => {
    const PUSH = ler("src/lib/avisar-por-push.ts");
    const chamadas = [...PUSH.matchAll(/\}, "(pro|cliente)"\);/g)].map((m) => m[1]);
    expect(chamadas.filter((c) => c === "pro").length).toBeGreaterThanOrEqual(4);
  });
});

describe("há quantos dias está feito", () => {
  // 23:30 de Lisboa no Inverno (UTC+0) a 25/10, e 00:30 a 27/10.
  const feito = new Date("2026-10-25T23:30:00Z");

  it("conta em dias de calendário de Lisboa", () => {
    expect(diasAEsperarConfirmacao(feito, new Date("2026-10-26T00:10:00Z"))).toBe(1);
    expect(diasAEsperarConfirmacao(feito, new Date("2026-10-27T00:30:00Z"))).toBe(2);
    expect(diasAEsperarConfirmacao(null)).toBeNull();
  });

  it("diz-se «hoje», «há 1 dia», «há N dias»", () => {
    expect(haQuantosDias(0)).toBe("hoje");
    expect(haQuantosDias(1)).toBe("há 1 dia");
    expect(haQuantosDias(3)).toBe("há 3 dias");
  });

  it("com dois dias passa a alerta e sobe ao topo, sem baralhar o resto", () => {
    expect(DIAS_ATE_AO_ALERTA).toBe(2);
    expect(passouDoPrazo(1)).toBe(false);
    expect(passouDoPrazo(2)).toBe(true);
    const lista = [
      { id: 9, d: 0 },
      { id: 8, d: 3 },
      { id: 7, d: 1 },
      { id: 6, d: 2 },
    ];
    expect(atrasadosPrimeiro(lista, (x) => x.d).map((x) => x.id)).toEqual([8, 6, 9, 7]);
  });

  it("a Mesa usa-o no bloco dos feitos e no selo", () => {
    const s = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(s).toMatch(/const porConfirmar = atrasadosPrimeiro\(/);
    expect(s).toMatch(/b\.chave === "porConfirmar" && feitosAtrasados > 0/);
    expect(s).toContain("haQuantosDias(f.dias)");
    expect(s).toContain('from "@/lib/feitos-por-confirmar"');
  });
});
