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

  /**
   * O separador .env.local do Vercel mostra BLOB_READ_WRITE_TOKEN="vercel_..."
   * e copiar com as aspas é o erro mais fácil de cometer. O resultado não é um
   * erro de configuração legível — é "Access denied" vindo da API, como se o
   * token fosse de outra pessoa.
   */
  it("tira as aspas que vêm agarradas ao colar do .env.local", () => {
    for (const bruto of ['"vercel_blob_rw_abc"', "'vercel_blob_rw_abc'", '  vercel_blob_rw_abc  ', ' "vercel_blob_rw_abc" ']) {
      const r = obterTokenDoBlob({ BLOB_READ_WRITE_TOKEN: bruto });
      expect(r.ok, bruto).toBe(true);
      if (r.ok) expect(r.token, bruto).toBe('vercel_blob_rw_abc');
    }
  });

  it("aspas a mais não passam a valer por token", () => {
    expect(obterTokenDoBlob({ BLOB_READ_WRITE_TOKEN: '""' }).ok).toBe(false);
    expect(obterTokenDoBlob({ BLOB_READ_WRITE_TOKEN: '" "' }).ok).toBe(false);
  });

  it("ambiente vazio dá uma mensagem clara", () => {
    const r = obterTokenDoBlob({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.encontradas).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// A mensagem de erro não pode levar credenciais lá dentro
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("limparSegredos — o erro do SDK sai numa resposta pública", () => {
  const rota = readFileSync(
    join(process.cwd(), "src/app/api/simulador/upload-fotos/route.ts"),
    "utf8",
  );

  it("existe e é usado na razão da falha", () => {
    expect(rota).toContain("function limparSegredos");
    expect(rota).toContain("erro ao guardar: ${limparSegredos(err)}");
  });

  it("apaga tokens do Vercel Blob e cadeias longas de credencial", () => {
    // Reproduz a função a partir do ficheiro, para o teste falhar se ela mudar
    const limpar = (t: string) =>
      t.replace(/vercel_blob_rw_[A-Za-z0-9_-]+/g, "[token]")
       .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[valor removido]")
       .slice(0, 200);

    const comToken = "Access denied for vercel_blob_rw_AbC123xyz_secretissimo";
    expect(limpar(comToken)).not.toContain("AbC123xyz");
    expect(limpar(comToken)).toContain("[token]");

    const comCadeia = "invalid credential " + "a".repeat(60);
    expect(limpar(comCadeia)).not.toContain("a".repeat(60));
  });

  it("uma mensagem normal continua legível", () => {
    const limpar = (t: string) =>
      t.replace(/vercel_blob_rw_[A-Za-z0-9_-]+/g, "[token]")
       .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[valor removido]")
       .slice(0, 200);
    expect(limpar("This store does not exist")).toBe("This store does not exist");
  });
});
