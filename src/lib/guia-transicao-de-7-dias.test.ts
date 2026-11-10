import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A TRANSIÇÃO DE 7 DIAS DA GUIA — 04-11-2026 (d10 v2, escolha do dono).
 *
 * Até 18-11 (era 11-11; prolongada a 10-11), um parceiro aprovado ANTES de 04-11 com a guia por verificar pode
 * ser contratado e escolhido nos trabalhos que exigem a guia; quem foi aprovado
 * a 04-11 ou depois precisa dela verificada desde já; passado o prazo, a regra
 * volta para todos sem deploy; com a guia verificada, contrata-se sempre.
 *
 * As portas chamam `guiaImpedeANegociacao` / `guiaImpedeOProfissional`, que
 * lêem a linha na base. Aqui a base é falsa — devolve a linha que cada caso
 * pede —, e a função é chamada como as rotas a chamam.
 */

let linha: Record<string, unknown> | undefined;
const execute = vi.fn(async () => [linha ? [linha] : [], undefined]);
vi.mock("./db", () => ({
  getPool: async () => ({ execute }),
  ensureProvidersSchema: async () => {},
}));

import { guiaImpedeANegociacao, guiaImpedeOProfissional } from "./guia-na-base";
import { confiancaDasNegociacoes } from "./confianca-na-mesa";
import {
  APROVADOS_ANTES_DE,
  AVISO_DA_TRANSICAO,
  TRANSICAO_DA_GUIA_ATE,
  ULTIMO_DIA_DA_TRANSICAO,
  emTransicao,
  guiaImpedeContratar,
  guiaPassaPelaTransicao,
} from "./guia-antes-de-contratar";
import { negociacaoParaAVista } from "./negociacao-na-vista";
import { negociacaoParaAApp } from "./pedido-para-a-app";

const DENTRO = new Date("2026-11-08T12:00:00Z");
const NO_ULTIMO_MINUTO = new Date("2026-11-18T23:59:00Z");
const DEPOIS = new Date("2026-11-19T00:00:01Z");

const ENTULHO = { serviceType: "recolha_entulho", precisaGuiaTransporte: 0 };
const APROVADO_ANTES = { estado: "aprovado", aprovadoEm: null, emiteGuiaTransporte: 1, guiaVerificadaEm: null };
const APROVADO_DEPOIS = { ...APROVADO_ANTES, aprovadoEm: "2026-11-04T09:30:00Z" };
const VERIFICADA = { ...APROVADO_DEPOIS, guiaVerificadaEm: "2026-11-05T10:00:00Z" };

beforeEach(() => {
  linha = undefined;
  execute.mockClear();
});

describe("o interruptor é uma data", () => {
  it("18/11 em Lisboa (Novembro = UTC; prolongada a 10/11), para os aprovados antes de 04/11", () => {
    expect(TRANSICAO_DA_GUIA_ATE).toBe("2026-11-18T23:59:59Z");
    expect(APROVADOS_ANTES_DE).toBe("2026-11-04T00:00:00Z");
    expect(ULTIMO_DIA_DA_TRANSICAO).toBe("18/11");
    expect(AVISO_DA_TRANSICAO).toBe("guia por verificar — pode ser contratado até 18/11");
  });

  it("na dúvida, a regra: sem o estado, sem a coluna, ou com uma data estragada, não há transição", () => {
    expect(emTransicao({ estado: "aprovado", aprovadoEm: null }, DENTRO)).toBe(true);
    expect(emTransicao({ estado: "aprovado", aprovadoEm: "2026-10-01T10:00:00Z" }, DENTRO)).toBe(true);
    expect(emTransicao({ estado: "aprovado" }, DENTRO)).toBe(false);
    expect(emTransicao({ aprovadoEm: null }, DENTRO)).toBe(false);
    expect(emTransicao({ estado: "suspenso", aprovadoEm: null }, DENTRO)).toBe(false);
    expect(emTransicao({ estado: "aprovado", aprovadoEm: "nao-e-data" }, DENTRO)).toBe(false);
  });
});

describe("os quatro casos da ordem, como as rotas os chamam", () => {
  it("aprovado antes, dentro do prazo → contrata (até ao último minuto de 18/11)", async () => {
    linha = { ...ENTULHO, ...APROVADO_ANTES };
    expect(await guiaImpedeANegociacao(42, DENTRO)).toBe(false);
    expect(await guiaImpedeANegociacao(42, NO_ULTIMO_MINUTO)).toBe(false);
    expect(await guiaImpedeOProfissional(7, 11, DENTRO)).toBe(false);
    // A consulta traz o estado e quando foi aprovado.
    const sql = String((execute.mock.calls[0] as unknown[])[0]);
    expect(sql).toContain("p.estado");
    expect(sql).toContain("p.aprovadoEm");
  });

  it("aprovado antes, depois do prazo → recusa, sem deploy nenhum", async () => {
    linha = { ...ENTULHO, ...APROVADO_ANTES };
    expect(await guiaImpedeANegociacao(42, DEPOIS)).toBe(true);
    expect(await guiaImpedeOProfissional(7, 11, DEPOIS)).toBe(true);
  });

  it("aprovado a 04/11 ou depois → recusa já", async () => {
    linha = { ...ENTULHO, ...APROVADO_DEPOIS };
    expect(await guiaImpedeANegociacao(42, DENTRO)).toBe(true);
    expect(await guiaImpedeOProfissional(7, 11, DENTRO)).toBe(true);
  });

  it("guia verificada → contrata sempre", async () => {
    linha = { ...ENTULHO, ...VERIFICADA };
    for (const agora of [DENTRO, DEPOIS]) {
      expect(await guiaImpedeANegociacao(42, agora)).toBe(false);
      expect(await guiaImpedeOProfissional(7, 11, agora)).toBe(false);
    }
  });

  it("sem guia exigida, nada muda", () => {
    expect(guiaImpedeContratar({ serviceType: "recolha_moveis" }, APROVADO_DEPOIS, DENTRO)).toBe(false);
    expect(guiaPassaPelaTransicao({ serviceType: "recolha_moveis" }, APROVADO_ANTES, DENTRO)).toBe(false);
  });
});

describe("quem vê o quê durante a transição", () => {
  it("a Mesa e os Trabalhos CLYON: não trava, e acende o aviso âmbar", async () => {
    // `estado` é o da negociação; o do parceiro vem como `profissionalEstado`, como na consulta.
    linha = { id: 9, ...ENTULHO, ...APROVADO_ANTES, estado: "aguarda_contratacao", profissionalEstado: "aprovado" };
    const dentro = (await confiancaDasNegociacoes([9], DENTRO)).get(9)!;
    expect(dentro.guiaPorVerificar).toBe(false);
    expect(dentro.guiaEmTransicao).toBe(true);
    const depois = (await confiancaDasNegociacoes([9], DEPOIS)).get(9)!;
    expect(depois.guiaPorVerificar).toBe(true);
    expect(depois.guiaEmTransicao).toBe(false);
  });

  it("o cliente: nenhum aviso, e o naoSeContrata vazio; passado o prazo, volta", () => {
    const n = {
      id: 7,
      estado: "aberta",
      propostasJson: JSON.stringify([{ por: "profissional", valor: 100, criadaEm: "2026-11-08T09:00:00Z", estado: "pendente" }]),
      profissionalNome: "Parceiro",
      guiaVerificadaEm: null,
      profissionalEstado: "aprovado",
      aprovadoEm: null,
      createdAt: "2026-11-08T08:00:00Z",
    };
    const dentro = negociacaoParaAVista(n, { porCarga: false, agora: DENTRO, exigeGuia: true });
    expect(dentro.guiaPorVerificar).toBe(false);
    expect(negociacaoParaAApp(dentro, "total", DENTRO).naoSeContrata).toBeNull();
    const depois = negociacaoParaAVista(n, { porCarga: false, agora: DEPOIS, exigeGuia: true });
    expect(depois.guiaPorVerificar).toBe(true);
    expect(negociacaoParaAApp(depois, "total", DEPOIS).naoSeContrata).not.toBeNull();
    // Aprovado depois de 04/11: o cliente vê porquê desde já.
    const novo = negociacaoParaAVista({ ...n, aprovadoEm: "2026-11-05T10:00:00Z" }, { porCarga: false, agora: DENTRO, exigeGuia: true });
    expect(novo.guiaPorVerificar).toBe(true);
  });
});
