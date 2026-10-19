import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A CLYON PRO, PARA A VERSÃO SEGUINTE DA LOJA — 19-10-2026.
 *
 * A primeira versão enviada à Google Play (a 9, 0.1.0) levava duas coisas que
 * não devia: uma permissão que a app não usa e um texto que prometia o que
 * nenhum ecrã faz.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const ficheirosEm = (pasta: string): string[] =>
  readdirSync(join(process.cwd(), pasta)).flatMap((nome) => {
    const caminho = `${pasta}/${nome}`;
    if (statSync(join(process.cwd(), caminho)).isDirectory()) return ficheirosEm(caminho);
    return /\.tsx?$/.test(nome) ? [caminho] : [];
  });

describe("as permissões que a loja vê", () => {
  const CONFIG = JSON.parse(ler("app-pro/app.json")) as {
    expo: { android: { blockedPermissions?: string[] }; plugins: unknown[] };
  };
  const bloqueadas = CONFIG.expo.android.blockedPermissions ?? [];

  it("sem a de aparecer por cima das outras apps", () => {
    /*
     * A SYSTEM_ALERT_WINDOW vem do modelo do Expo (o AndroidManifest do
     * prebuild), e a app não desenha por cima de nada. O nome vai inteiro: é
     * com ele que o Expo a tira do manifesto final (tools:node="remove").
     */
    expect(bloqueadas).toContain("android.permission.SYSTEM_ALERT_WINDOW");
  });

  it("o armazenamento fica: o seletor de fotografias usa-o até ao Android 12", () => {
    expect(bloqueadas.filter((p) => /STORAGE/.test(p))).toEqual([]);
    expect(CONFIG.expo.plugins.some((x) => (Array.isArray(x) ? x[0] : x) === "expo-image-picker")).toBe(true);
  });
});

describe("as fotografias da viatura dizem a verdade", () => {
  /*
   * A ajuda do painel dizia «o cliente vê quem lhe chega à porta. A primeira
   * é a que o representa», e a app «A primeira fotografia é a que o cliente
   * vê». Nenhum ecrã do cliente as mostra. Os textos da app são os do painel,
   * por isso os dois mudaram juntos e ficam iguais.
   */
  const ajudaDoPainel = () => {
    const m = ler("src/app/profissionais/painel/Perfil.tsx").match(/etiqueta="As suas viaturas"\s+ajuda="([^"]+)"/);
    expect(m, "a ajuda «As suas viaturas» no painel").not.toBeNull();
    return m![1];
  };
  const textoDaApp = () => {
    const app = ler("app-pro/src/app/conta/perfil.tsx");
    const i = app.indexOf("<TituloDaCaixa>As suas viaturas</TituloDaCaixa>");
    expect(i, "o título «As suas viaturas» na app").toBeGreaterThan(-1);
    const m = app.slice(i).match(/<Text[^>]*>([^<{]+)<\/Text>/);
    expect(m, "o texto por baixo do título").not.toBeNull();
    return m![1].replace(/\s+/g, " ").trim();
  };

  it("o painel e a app dizem o mesmo, palavra por palavra", () => {
    expect(textoDaApp()).toBe(ajudaDoPainel());
  });

  it("nenhum dos dois promete que o cliente as vê", () => {
    for (const texto of [ajudaDoPainel(), textoDaApp()]) {
      expect(texto).toContain("O cliente não as vê.");
      expect(texto).not.toMatch(/cliente vê|chega à porta|o representa/);
    }
  });

  it("e é verdade: nada do que o cliente abre lê as fotografias da viatura", () => {
    /*
     * Se um ecrã do cliente as passar a mostrar, este teste chumba — e o
     * texto do painel e da app tem de mudar com ele.
     */
    const COLUNAS = /fotoViatura|fotosViatura/;
    const doCliente = [
      ...ficheirosEm("src/app/pedido"),
      ...ficheirosEm("src/app/profissionais/[slug]"),
      "src/lib/perfil-publico-do-profissional.ts",
    ];
    expect(doCliente.length).toBeGreaterThanOrEqual(6);
    expect(doCliente.filter((f) => COLUNAS.test(ler(f)))).toEqual([]);

    // O profissional que o cliente vê nas propostas sai de `negociacoesDoPedido`.
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function negociacoesDoPedido(");
    expect(i).toBeGreaterThan(-1);
    const fim = DB.slice(i + 1).search(/\r?\nexport /);
    expect(fim).toBeGreaterThan(-1);
    expect(DB.slice(i, i + 1 + fim)).not.toMatch(COLUNAS);
  });
});
