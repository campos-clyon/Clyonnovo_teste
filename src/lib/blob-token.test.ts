import { describe, it, expect } from "vitest";
import { obterTokenDoBlob } from "./blob-token";

describe("obterTokenDoBlob", () => {
  it("usa o nome padrão quando existe", () => {
    const r = obterTokenDoBlob({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_abc" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.token).toBe("vercel_blob_rw_abc");
      expect(r.variavel).toBe("BLOB_READ_WRITE_TOKEN");
    }
  });

  /**
   * O caso real que custou todas as fotos do simulador.
   *
   * O store estava ligado — havia BLOB_STORE_ID e BLOB_WEBHOOK_PUBLIC_KEY —
   * mas o token tinha o prefixo do store no nome, e o código só procurava
   * BLOB_READ_WRITE_TOKEN. Devolvia "não configurado" com o store ali ao lado.
   */
  it("encontra o token quando o store tem prefixo próprio", () => {
    const r = obterTokenDoBlob({
      BLOB_STORE_ID: "store_123",
      BLOB_WEBHOOK_PUBLIC_KEY: "pk_xyz",
      CLYONFOTOS_READ_WRITE_TOKEN: "vercel_blob_rw_zzz",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.token).toBe("vercel_blob_rw_zzz");
      expect(r.variavel).toBe("CLYONFOTOS_READ_WRITE_TOKEN");
    }
  });

  it("com duas candidatas escolhe sempre a mesma", () => {
    const env = { B_READ_WRITE_TOKEN: "dois", A_READ_WRITE_TOKEN: "um" };
    const primeira = obterTokenDoBlob(env);
    const segunda = obterTokenDoBlob(env);
    expect(primeira.ok && primeira.variavel).toBe("A_READ_WRITE_TOKEN");
    expect(primeira.ok && primeira.token).toBe(segunda.ok && segunda.token);
  });

  it("o padrão ganha às outras, mesmo com prefixadas presentes", () => {
    const r = obterTokenDoBlob({
      AAA_READ_WRITE_TOKEN: "prefixada",
      BLOB_READ_WRITE_TOKEN: "padrao",
    });
    expect(r.ok && r.variavel).toBe("BLOB_READ_WRITE_TOKEN");
  });

  it("uma variável vazia não conta como token", () => {
    expect(obterTokenDoBlob({ BLOB_READ_WRITE_TOKEN: "   " }).ok).toBe(false);
  });

  it("sem token, diz que variáveis do store existem — sem mostrar valores", () => {
    const r = obterTokenDoBlob({
      BLOB_STORE_ID: "store_123",
      BLOB_WEBHOOK_PUBLIC_KEY: "pk_xyz",
      JWT_SECRET: "nao-deve-aparecer",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toContain("BLOB_STORE_ID");
      expect(r.motivo).toContain("BLOB_WEBHOOK_PUBLIC_KEY");
      expect(r.motivo).not.toContain("store_123");
      expect(r.motivo).not.toContain("nao-deve-aparecer");
      expect(r.motivo).not.toContain("JWT_SECRET");
    }
  });

  it("ambiente vazio dá uma mensagem clara", () => {
    const r = obterTokenDoBlob({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.encontradas).toEqual([]);
  });
});
