import { describe, it, expect } from "vitest";
import { pareceUmToken, porqueRecusa, MINUTOS_DE_VALIDADE } from "./entrada-por-link";
import { gerarLigacaoDeEntrada, hashDaLigacao } from "./entrada-por-link-segredo";

const agora = new Date("2026-08-21T12:00:00Z");
const daqui = (min: number) => new Date(agora.getTime() + min * 60 * 1000);

describe("gerarLigacaoDeEntrada", () => {
  it("dá 256 bits em base64url", () => {
    const l = gerarLigacaoDeEntrada(agora);
    expect(l.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("nunca repete", () => {
    const vistos = new Set(
      Array.from({ length: 200 }, () => gerarLigacaoDeEntrada(agora).token),
    );
    expect(vistos.size).toBe(200);
  });

  // O que se grava é o hash. Uma cópia de segurança que se perca não pode
  // entregar a conta de ninguém.
  it("o hash não é o token, e é sempre o mesmo para o mesmo token", () => {
    const l = gerarLigacaoDeEntrada(agora);
    expect(l.hash).not.toBe(l.token);
    expect(l.hash).toBe(hashDaLigacao(l.token));
    expect(l.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("expira em quinze minutos, não em dias", () => {
    const l = gerarLigacaoDeEntrada(agora);
    expect(l.expiraEm.getTime() - agora.getTime()).toBe(MINUTOS_DE_VALIDADE * 60 * 1000);
  });
});

describe("pareceUmToken", () => {
  it("aceita o formato certo e recusa tudo o resto", () => {
    expect(pareceUmToken(gerarLigacaoDeEntrada(agora).token)).toBe(true);
    for (const lixo of ["", "curto", "a".repeat(44), "a".repeat(42), "a/b+c", null, 42, {}, []]) {
      expect(pareceUmToken(lixo)).toBe(false);
    }
  });

  // Sem esta barreira, qualquer coisa escrita no endereço ia dar à base — e
  // uma consulta por tentativa é uma consulta que alguém dispara aos milhares.
  it("não deixa passar tentativas de injecção", () => {
    expect(pareceUmToken("' OR 1=1 --")).toBe(false);
    expect(pareceUmToken("../../etc/passwd")).toBe(false);
  });
});

describe("porqueRecusa", () => {
  const boa = { email: "a@b.pt", expiraEm: daqui(10), usadoEm: null };
  const token = gerarLigacaoDeEntrada(agora).token;

  it("deixa passar uma ligação válida", () => {
    expect(porqueRecusa(token, boa, agora)).toBeNull();
  });

  it("recusa o que não existe na base", () => {
    expect(porqueRecusa(token, null, agora)).toBe("desconhecido");
    expect(porqueRecusa(token, undefined, agora)).toBe("desconhecido");
  });

  it("recusa depois dos quinze minutos", () => {
    expect(porqueRecusa(token, { ...boa, expiraEm: daqui(-1) }, agora)).toBe("expirado");
    // No instante exacto já não vale: o limite é fechado.
    expect(porqueRecusa(token, { ...boa, expiraEm: agora }, agora)).toBe("expirado");
  });

  // Um email reencaminhado, um histórico partilhado, um telemóvel emprestado:
  // o segundo a usar o link não entra.
  it("recusa um link já usado, mesmo dentro do prazo", () => {
    expect(porqueRecusa(token, { ...boa, usadoEm: daqui(-2) }, agora)).toBe("usado");
  });

  it("usado ganha a expirado — é a razão mais grave", () => {
    expect(
      porqueRecusa(token, { expiraEm: daqui(-30), usadoEm: daqui(-31), email: "a@b.pt" }, agora),
    ).toBe("usado");
  });

  // Sem data de validade não se assume que é eterno. Assume-se o pior.
  it("uma ligação sem validade não abre", () => {
    expect(porqueRecusa(token, { ...boa, expiraEm: null }, agora)).toBe("expirado");
    expect(porqueRecusa(token, { ...boa, expiraEm: "não é data" }, agora)).toBe("expirado");
  });

  it("recusa antes de ir à base quando o token nem tem forma", () => {
    expect(porqueRecusa("", boa, agora)).toBe("ausente");
    expect(porqueRecusa(null, boa, agora)).toBe("ausente");
    expect(porqueRecusa("xpto", boa, agora)).toBe("malformado");
  });
});
