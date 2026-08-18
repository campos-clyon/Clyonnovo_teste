import { describe, it, expect } from "vitest";
import {
  faseDoTrabalho,
  podeEnviarProva,
  podeConfirmar,
  libertaSozinho,
  diasAteLibertar,
  estaLibertado,
  DIAS_ATE_LIBERTAR_SOZINHO,
} from "./trabalho";

const agora = new Date("2026-08-18T12:00:00Z");
const haDias = (d: number) => new Date(agora.getTime() - d * 86_400_000);

describe("faseDoTrabalho", () => {
  it("só há trabalho depois de acordado", () => {
    for (const estado of ["aberta", "aguarda_contratacao", "desistida", "morta"]) {
      expect(faseDoTrabalho({ estado })).toBe("a_negociar");
    }
  });

  it("acordado sem prova está por executar", () => {
    expect(faseDoTrabalho({ estado: "acordada" })).toBe("a_executar");
  });

  it("com prova espera a confirmação do cliente", () => {
    expect(faseDoTrabalho({ estado: "acordada", execucaoEnviadaEm: haDias(1) })).toBe(
      "a_confirmar",
    );
  });

  it("confirmado, e depois pago", () => {
    const t = { estado: "acordada", execucaoEnviadaEm: haDias(3), confirmadoEm: haDias(2) };
    expect(faseDoTrabalho(t)).toBe("confirmado");
    expect(faseDoTrabalho({ ...t, pagoEm: haDias(1) })).toBe("pago");
  });

  // As datas vêm do MySQL às vezes como texto, às vezes como Date, conforme o
  // caminho. Tratar só um dos casos dava uma fase errada sem erro nenhum.
  it("aceita datas em texto", () => {
    expect(faseDoTrabalho({ estado: "acordada", execucaoEnviadaEm: "2026-08-17 10:00:00" })).toBe(
      "a_confirmar",
    );
  });

  it("ignora datas impossíveis", () => {
    expect(faseDoTrabalho({ estado: "acordada", execucaoEnviadaEm: "nada disto" })).toBe(
      "a_executar",
    );
  });
});

describe("quem pode fazer o quê", () => {
  it("a prova envia-se uma vez", () => {
    expect(podeEnviarProva({ estado: "acordada" })).toBe(true);
    expect(podeEnviarProva({ estado: "acordada", execucaoEnviadaEm: haDias(1) })).toBe(false);
  });

  it("não se envia prova de um trabalho que não é nosso", () => {
    expect(podeEnviarProva({ estado: "aberta" })).toBe(false);
  });

  // Confirmar antes da prova era assinar um cheque em branco: o cliente perdia
  // a única alavanca que tem.
  it("o cliente só confirma o que já foi provado", () => {
    expect(podeConfirmar({ estado: "acordada" })).toBe(false);
    expect(podeConfirmar({ estado: "acordada", execucaoEnviadaEm: haDias(1) })).toBe(true);
    expect(
      podeConfirmar({ estado: "acordada", execucaoEnviadaEm: haDias(2), confirmadoEm: haDias(1) }),
    ).toBe(false);
  });
});

describe("libertação por prazo", () => {
  it("liberta ao fim do prazo, a contar da prova", () => {
    const quase = { estado: "acordada", execucaoEnviadaEm: haDias(DIAS_ATE_LIBERTAR_SOZINHO - 0.1) };
    const passou = { estado: "acordada", execucaoEnviadaEm: haDias(DIAS_ATE_LIBERTAR_SOZINHO) };
    expect(libertaSozinho(quase, agora)).toBe(false);
    expect(libertaSozinho(passou, agora)).toBe(true);
  });

  // O prazo é para o cliente reagir à prova. Sem prova não corre nada — senão
  // bastava fechar o negócio e esperar uma semana sem lá ir.
  it("sem prova o prazo não começa", () => {
    expect(libertaSozinho({ estado: "acordada" }, agora)).toBe(false);
    expect(diasAteLibertar({ estado: "acordada" }, agora)).toBeNull();
  });

  it("já confirmado não se liberta outra vez", () => {
    const t = { estado: "acordada", execucaoEnviadaEm: haDias(30), confirmadoEm: haDias(29) };
    expect(libertaSozinho(t, agora)).toBe(false);
    expect(estaLibertado(t, agora)).toBe(true);
  });

  it("os dias que faltam nunca são negativos", () => {
    const t = { estado: "acordada", execucaoEnviadaEm: haDias(90) };
    expect(diasAteLibertar(t, agora)).toBe(0);
  });

  it("conta os dias que faltam", () => {
    const t = { estado: "acordada", execucaoEnviadaEm: haDias(2) };
    expect(diasAteLibertar(t, agora)).toBeCloseTo(DIAS_ATE_LIBERTAR_SOZINHO - 2, 5);
  });
});

describe("estaLibertado", () => {
  it("preso enquanto não há prova nem confirmação", () => {
    expect(estaLibertado({ estado: "acordada" }, agora)).toBe(false);
    expect(estaLibertado({ estado: "acordada", execucaoEnviadaEm: haDias(1) }, agora)).toBe(false);
  });

  it("livre por confirmação, por pagamento ou por prazo", () => {
    expect(
      estaLibertado({ estado: "acordada", execucaoEnviadaEm: haDias(2), confirmadoEm: haDias(1) }, agora),
    ).toBe(true);
    expect(
      estaLibertado({ estado: "acordada", execucaoEnviadaEm: haDias(9), pagoEm: haDias(1) }, agora),
    ).toBe(true);
    expect(estaLibertado({ estado: "acordada", execucaoEnviadaEm: haDias(8) }, agora)).toBe(true);
  });
});
