import { describe, it, expect } from "vitest";
import {
  gerarTokenDeAcesso,
  hashDeToken,
  verificarTokenDeAcesso,
  linkDoPedido,
  DIAS_DE_VALIDADE,
  type ResultadoDeAcesso,
} from "./pedido-acesso";

/** O resultado é uma união discriminada: sem estreitar, `motivo` não existe. */
function motivo(r: ResultadoDeAcesso): string {
  expect(r.valido).toBe(false);
  return r.valido ? "" : r.motivo;
}

describe("gerarTokenDeAcesso", () => {
  it("gera tokens diferentes de cada vez", () => {
    const vistos = new Set(Array.from({ length: 200 }, () => gerarTokenDeAcesso().token));
    expect(vistos.size).toBe(200);
  });

  it("gera um token longo e seguro para URL", () => {
    const { token } = gerarTokenDeAcesso();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(token)).toBe(token);
  });

  // O ponto todo: quem leia a tabela não pode abrir pedido nenhum.
  it("o que se guarda não é o token", () => {
    const { token, hash } = gerarTokenDeAcesso();
    expect(hash).not.toBe(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
  });

  it("expira daqui a trinta dias", () => {
    const agora = new Date("2026-08-16T12:00:00Z");
    const { expiraEm } = gerarTokenDeAcesso(agora);
    const dias = (expiraEm.getTime() - agora.getTime()) / (24 * 60 * 60 * 1000);
    expect(dias).toBe(DIAS_DE_VALIDADE);
  });
});

describe("verificarTokenDeAcesso", () => {
  const agora = new Date("2026-08-16T12:00:00Z");
  const daquiAUmaHora = new Date(agora.getTime() + 3600_000);
  const ontem = new Date(agora.getTime() - 86_400_000);

  it("aceita o token certo dentro da validade", () => {
    const { token, hash, expiraEm } = gerarTokenDeAcesso(agora);
    expect(verificarTokenDeAcesso(token, hash, expiraEm, agora)).toEqual({ valido: true });
  });

  it("recusa um token trocado", () => {
    const { hash, expiraEm } = gerarTokenDeAcesso(agora);
    const outro = gerarTokenDeAcesso(agora);
    const r = verificarTokenDeAcesso(outro.token, hash, expiraEm, agora);
    expect(r).toEqual({ valido: false, motivo: "nao_corresponde" });
  });

  it("recusa um token expirado", () => {
    const { token, hash } = gerarTokenDeAcesso(agora);
    expect(motivo(verificarTokenDeAcesso(token, hash, ontem, agora))).toBe("expirado");
  });

  it("recusa quando não há validade guardada", () => {
    const { token, hash } = gerarTokenDeAcesso(agora);
    expect(verificarTokenDeAcesso(token, hash, null, agora).valido).toBe(false);
  });

  it("aceita a validade vinda da base como string", () => {
    const { token, hash } = gerarTokenDeAcesso(agora);
    const r = verificarTokenDeAcesso(token, hash, daquiAUmaHora.toISOString(), agora);
    expect(r).toEqual({ valido: true });
  });

  it("recusa token ausente, vazio ou do tipo errado", () => {
    const { hash, expiraEm } = gerarTokenDeAcesso(agora);
    expect(motivo(verificarTokenDeAcesso(undefined, hash, expiraEm, agora))).toBe("ausente");
    expect(motivo(verificarTokenDeAcesso("", hash, expiraEm, agora))).toBe("ausente");
    expect(motivo(verificarTokenDeAcesso(42, hash, expiraEm, agora))).toBe("ausente");
  });

  it("recusa quando não há hash guardado", () => {
    const { token, expiraEm } = gerarTokenDeAcesso(agora);
    expect(verificarTokenDeAcesso(token, null, expiraEm, agora).valido).toBe(false);
  });

  it("recusa lixo sem rebentar", () => {
    const { hash, expiraEm } = gerarTokenDeAcesso(agora);
    for (const lixo of ["../../etc/passwd", "a".repeat(5000), "tem espaço", "%00", "'; DROP TABLE"]) {
      expect(verificarTokenDeAcesso(lixo, hash, expiraEm, agora).valido).toBe(false);
    }
  });

  it("recusa sem rebentar se o hash guardado estiver corrompido", () => {
    const { token, expiraEm } = gerarTokenDeAcesso(agora);
    for (const mau of ["", "nao-e-hex", "abc"]) {
      expect(verificarTokenDeAcesso(token, mau, expiraEm, agora).valido).toBe(false);
    }
  });

  // Um token errado e um token certo-mas-expirado não podem dar respostas
  // distinguíveis a quem tenta à sorte: "expirado" confirmava que o token
  // estava certo.
  it("não distingue token errado de token errado-e-expirado", () => {
    const { hash } = gerarTokenDeAcesso(agora);
    const outro = gerarTokenDeAcesso(agora);
    expect(motivo(verificarTokenDeAcesso(outro.token, hash, ontem, agora))).toBe("nao_corresponde");
  });

  it("recusa exactamente no instante em que expira", () => {
    const { token, hash, expiraEm } = gerarTokenDeAcesso(agora);
    expect(motivo(verificarTokenDeAcesso(token, hash, expiraEm, expiraEm))).toBe("expirado");
  });
});

describe("hashDeToken", () => {
  it("é determinístico", () => {
    expect(hashDeToken("abc")).toBe(hashDeToken("abc"));
  });
  it("muda por completo com um caractere de diferença", () => {
    expect(hashDeToken("abc")).not.toBe(hashDeToken("abd"));
  });
});

describe("linkDoPedido", () => {
  it("monta o endereço do pedido", () => {
    expect(linkDoPedido("https://clyon.pt", "abc123")).toBe("https://clyon.pt/pedido/abc123");
  });
  it("não duplica a barra final", () => {
    expect(linkDoPedido("https://clyon.pt/", "abc123")).toBe("https://clyon.pt/pedido/abc123");
  });
});
