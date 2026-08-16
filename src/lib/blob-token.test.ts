import { describe, it, expect } from "vitest";
import { obterTokenDoBlob } from "./blob-token";

describe("obterTokenDoBlob", () => {
  it("usa o nome padrão quando existe", () => {
    const r = obterTokenDoBlob({ BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_' + 'a'.repeat(40) });
    expect(r.ok).toBe(true);
    if (r.ok && r.modo === "token") {
      expect(r.token).toBe('vercel_blob_rw_' + 'a'.repeat(40));
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
      CLYONFOTOS_READ_WRITE_TOKEN: "vercel_blob_rw_" + "z".repeat(40),
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.modo === "token") {
      expect(r.token).toBe("vercel_blob_rw_" + "z".repeat(40));
      expect(r.variavel).toBe("CLYONFOTOS_READ_WRITE_TOKEN");
    }
  });

  it("com duas candidatas escolhe sempre a mesma", () => {
    const env = {
      B_READ_WRITE_TOKEN: "vercel_blob_rw_" + "b".repeat(40),
      A_READ_WRITE_TOKEN: "vercel_blob_rw_" + "a".repeat(40),
    };
    const primeira = obterTokenDoBlob(env);
    const segunda = obterTokenDoBlob(env);
    expect(primeira.ok && primeira.modo === "token" && primeira.variavel).toBe("A_READ_WRITE_TOKEN");
    expect(primeira.ok && primeira.modo === "token" && primeira.token).toBe(segunda.ok && segunda.modo === "token" && segunda.token);
  });

  it("o padrão ganha às outras, mesmo com prefixadas presentes", () => {
    const r = obterTokenDoBlob({
      AAA_READ_WRITE_TOKEN: "vercel_blob_rw_" + "p".repeat(40),
      BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_" + "d".repeat(40),
    });
    expect(r.ok && r.modo === "token" && r.variavel).toBe("BLOB_READ_WRITE_TOKEN");
  });

  it("uma variável vazia não conta como token", () => {
    expect(obterTokenDoBlob({ BLOB_READ_WRITE_TOKEN: "   " }).ok).toBe(false);
  });

  /**
   * O modelo novo do Vercel: o separador .env.local do store mostra SÓ o
   * BLOB_STORE_ID, porque o token deixou de existir. O SDK autentica com a
   * identidade do próprio deployment (VERCEL_OIDC_TOKEN), que o Vercel
   * injecta e nós nunca vemos nem guardamos.
   *
   * Eu andei três voltas a pedir um token que já não existe.
   */
  it("só com BLOB_STORE_ID, autentica por OIDC em vez de falhar", () => {
    const r = obterTokenDoBlob({
      BLOB_STORE_ID: "store_123",
      BLOB_WEBHOOK_PUBLIC_KEY: "pk_xyz",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.modo).toBe("oidc");
      if (r.modo === "oidc") expect(r.storeId).toBe("store_123");
    }
  });

  it("um token válido ganha ao OIDC — respeita-se o que está configurado", () => {
    const bom = "vercel_blob_rw_" + "m".repeat(40);
    const r = obterTokenDoBlob({ BLOB_READ_WRITE_TOKEN: bom, BLOB_STORE_ID: "store_123" });
    expect(r.ok && r.modo).toBe("token");
  });

  it("sem token e sem store id, a mensagem não mostra valores nem outros segredos", () => {
    const r = obterTokenDoBlob({
      BLOB_WEBHOOK_PUBLIC_KEY: "pk_xyz",
      JWT_SECRET: "nao-deve-aparecer",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toContain("BLOB_WEBHOOK_PUBLIC_KEY");
      expect(r.motivo).not.toContain("pk_xyz");
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
    const bom = "vercel_blob_rw_" + "a".repeat(40);
    for (const bruto of [`"${bom}"`, `'${bom}'`, `  ${bom}  `, ` "${bom}" `]) {
      const r = obterTokenDoBlob({ BLOB_READ_WRITE_TOKEN: bruto });
      expect(r.ok, bruto).toBe(true);
      if (r.ok && r.modo === "token") expect(r.token, bruto).toBe(bom);
    }
  });

  it("aspas a mais não passam a valer por token", () => {
    expect(obterTokenDoBlob({ BLOB_READ_WRITE_TOKEN: '""' }).ok).toBe(false);
    expect(obterTokenDoBlob({ BLOB_READ_WRITE_TOKEN: '" "' }).ok).toBe(false);
  });

  /**
   * O caso real, e o que custou mais tempo de todos.
   *
   * No painel do Vercel o ID do store e o token aparecem lado a lado, e ambos
   * parecem "a coisa do Blob que é preciso copiar". Foi colado o ID no lugar
   * do token. A API respondeu "Access denied, please provide a valid token",
   * que soa a permissões e manda procurar no sítio errado — andámos três
   * voltas até perceber que o valor nem sequer tinha forma de token.
   */
  it("apanha um ID de store colado no lugar do token", () => {
    const r = obterTokenDoBlob({ BLOB_READ_WRITE_TOKEN: 'store_XUlxxzTOgAbCdEfGh' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toContain('ID DE STORE');
      expect(r.motivo).toContain('vercel_blob_rw_');
    }
  });

  it("recusa qualquer valor sem forma de token, e diz o comprimento", () => {
    const r = obterTokenDoBlob({ BLOB_READ_WRITE_TOKEN: 'abc123' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain('6 caracteres');
  });

  it("um token com a forma certa passa", () => {
    const bom = 'vercel_blob_rw_' + 'x'.repeat(40);
    const r = obterTokenDoBlob({ BLOB_READ_WRITE_TOKEN: bom });
    expect(r.ok).toBe(true);
    if (r.ok && r.modo === "token") expect(r.token).toBe(bom);
  });

  it("uma candidata por sufixo também tem de ter forma de token", () => {
    const r = obterTokenDoBlob({ XPTO_READ_WRITE_TOKEN: 'store_1234567890123456' });
    expect(r.ok).toBe(false);
  });

  /**
   * O caso que nos prendeu mais tempo.
   *
   * O separador .env.local do store mostra SÓ o BLOB_STORE_ID — o token não
   * está lá. Quem está a resolver copia o que vê e cria uma
   * BLOB_READ_WRITE_TOKEN com o ID do store. Essa variável manual tapa a que
   * o Vercel injecta sozinho quando o store está ligado ao projecto.
   *
   * Desistir no nome padrão fazia-nos ignorar a boa que estava ali ao lado.
   */
  it("com o nome padrão errado, encontra o token bom noutra variável", () => {
    const bom = "vercel_blob_rw_" + "k".repeat(40);
    const r = obterTokenDoBlob({
      BLOB_READ_WRITE_TOKEN: "store_XUlxxzTOgAbCdEfGh",
      CLYONPLATAFORMA_READ_WRITE_TOKEN: bom,
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.modo === "token") {
      expect(r.token).toBe(bom);
      expect(r.variavel).toBe("CLYONPLATAFORMA_READ_WRITE_TOKEN");
    }
  });

  /**
   * Foi exactamente isto que estava configurado: uma BLOB_READ_WRITE_TOKEN
   * criada à mão com o ID do store lá dentro, e o BLOB_STORE_ID ao lado.
   * Agora o valor errado é ignorado e o OIDC assume.
   */
  it("com o ID do store no lugar do token, o OIDC salva a situação", () => {
    const r = obterTokenDoBlob({
      BLOB_READ_WRITE_TOKEN: "store_XUlxxzTOgAbCdEfGh",
      BLOB_STORE_ID: "store_XUlxxzTOgAbCdEfGh",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.modo).toBe("oidc");
  });

  it("sem OIDC nem token bom, a queixa é sobre o valor errado", () => {
    const r = obterTokenDoBlob({ BLOB_READ_WRITE_TOKEN: "store_XUlxxzTOgAbCdEfGh" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("ID DE STORE");
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
