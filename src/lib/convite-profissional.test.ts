import { describe, it, expect } from "vitest";
import {
  validarConvite,
  tipoDeVeiculoValido,
  etiquetaDoVeiculo,
  TIPOS_DE_VEICULO,
} from "./convite-profissional";

const erros = (r: ReturnType<typeof validarConvite>) =>
  r.ok ? [] : r.erros.map((e) => e.campo);

describe("validarConvite", () => {
  it("nome e email chegam", () => {
    const r = validarConvite({ nome: "Fred", email: "fred@exemplo.pt" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dados.telefone).toBeNull();
      expect(r.dados.tipoVeiculo).toBeNull();
    }
  });

  it("exige nome e email", () => {
    expect(erros(validarConvite({ email: "fred@exemplo.pt" }))).toContain("nome");
    expect(erros(validarConvite({ nome: "Fred" }))).toContain("email");
    expect(erros(validarConvite({ nome: "Fred", email: "não-é-email" }))).toContain("email");
  });

  // O email é a identidade dele em todo o sistema. Sem normalizar, convidava-se
  // duas vezes o mesmo homem e ele ficava com duas contas — e dois saldos.
  it("normaliza o email para minúsculas", () => {
    const r = validarConvite({ nome: "Fred", email: " Fred@Exemplo.PT " });
    if (r.ok) expect(r.dados.email).toBe("fred@exemplo.pt");
  });

  it("aceita telefone e veículo, e valida-os quando vêm", () => {
    const r = validarConvite({
      nome: "Fred",
      email: "f@e.pt",
      telefone: "912345678",
      tipoVeiculo: "carrinha_grande",
    });
    expect(r.ok).toBe(true);
    expect(erros(validarConvite({ nome: "Fred", email: "f@e.pt", telefone: "123" }))).toContain(
      "telefone",
    );
    expect(
      erros(validarConvite({ nome: "Fred", email: "f@e.pt", tipoVeiculo: "helicoptero" })),
    ).toContain("tipoVeiculo");
  });

  it("campos opcionais vazios não são erro", () => {
    const r = validarConvite({ nome: "Fred", email: "f@e.pt", telefone: "", tipoVeiculo: "" });
    expect(r.ok).toBe(true);
  });

  it("corta a nota interna em vez de a recusar", () => {
    const r = validarConvite({ nome: "Fred", email: "f@e.pt", nota: "x".repeat(900) });
    if (r.ok) expect(r.dados.nota?.length).toBe(500);
  });

  it("não rebenta com lixo", () => {
    for (const lixo of [null, undefined, "texto", 42, [], {}]) {
      expect(validarConvite(lixo).ok).toBe(false);
    }
  });
});

describe("tipos de veículo", () => {
  it("aceita os da lista e recusa o resto", () => {
    for (const v of TIPOS_DE_VEICULO) expect(tipoDeVeiculoValido(v.id)).toBe(true);
    expect(tipoDeVeiculoValido("trotinete")).toBe(false);
    expect(tipoDeVeiculoValido(null)).toBe(false);
  });

  // Um veículo que já não esteja na lista continua a ter de aparecer: a ficha
  // de quem se inscreveu no ano passado não pode ficar com um espaço em branco.
  it("mostra o valor cru quando não conhece o id", () => {
    expect(etiquetaDoVeiculo("carrinha_grande")).toContain("Carrinha grande");
    expect(etiquetaDoVeiculo("inventado")).toBe("inventado");
    expect(etiquetaDoVeiculo(null)).toBe("—");
  });
});
