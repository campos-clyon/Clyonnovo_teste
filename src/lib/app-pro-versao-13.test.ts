import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listaValida } from "../../app-pro/src/lib/trabalhos";

/**
 * A VERSÃO 13 DA CLYON PRO — a app aguenta-se sozinha, 21-10-2026.
 *
 * Do relatório «próximas versões»: correcções sem passar pela loja (EAS
 * Update), a última lista para abrir sem rede, e um ecrã de erro em vez de
 * a app fechar. O registo de erros (Sentry) fica à espera da conta do dono.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const lerJson = (f: string) => JSON.parse(ler(f));

describe("correcções sem passar pela loja (EAS Update)", () => {
  it("a app procura actualizações no projecto dela, e só aceita as feitas para a mesma parte nativa", () => {
    const app = lerJson("app-pro/app.json").expo;
    expect(app.updates.url).toBe(`https://u.expo.dev/${app.extra.eas.projectId}`);
    expect(app.updates.checkAutomatically).toBe("ON_LOAD");
    // «fingerprint»: uma actualização feita com outra parte nativa nunca entra
    // — e é isso que impede uma correcção de partir uma instalação antiga.
    expect(app.runtimeVersion).toEqual({ policy: "fingerprint" });
    const pacote = lerJson("app-pro/package.json");
    expect(pacote.dependencies["expo-updates"]).toMatch(/^~57\./);
  });

  it("cada build sai num canal: a da loja no «production», os APK de teste no «preview»", () => {
    const eas = lerJson("app-pro/eas.json");
    expect(eas.build.production.channel).toBe("production");
    expect(eas.build.preview.channel).toBe("preview");
  });

  it("a lista avisa que há uma versão nova e reinicia num toque; no navegador não existe", () => {
    const FAIXA = ler("app-pro/src/componentes/VersaoNova.tsx");
    expect(FAIXA).toContain("Updates.useUpdates()");
    expect(FAIXA).toContain("isUpdatePending");
    expect(FAIXA).toContain("Updates.reloadAsync()");
    expect(FAIXA).toContain('Platform.OS === "web" || !Updates.isEnabled');
    expect(ler("app-pro/src/app/(app)/index.tsx")).toContain("<VersaoNova />");
  });
});

describe("abrir sem rede com a última lista", () => {
  it("só aceita a forma que se guardou", () => {
    const boa = { trabalhos: [{ negociacaoId: 1 }], lidaEm: "2026-10-21T10:00:00.000Z" };
    expect(listaValida(boa)).toEqual(boa);
    expect(listaValida(null)).toBeNull();
    expect(listaValida({ trabalhos: "x", lidaEm: boa.lidaEm })).toBeNull();
    expect(listaValida({ trabalhos: [], lidaEm: "ontem" })).toBeNull();
  });

  it("guarda a lista que veio do site, mostra-a sem rede, e apaga-a ao sair da conta", () => {
    const ESTADO = ler("app-pro/src/estado/Trabalhos.tsx");
    expect(ESTADO).toContain("guardarLista(r.pedidos ?? [])");
    expect(ESTADO).toContain("lerListaGuardada()");
    // A guardada nunca passa por cima do que o site já respondeu.
    expect(ESTADO).toContain("if (!vivo || !guardada || doSite.current) return;");
    // Sem sessão, os dados dos clientes não ficam no telemóvel.
    expect(ESTADO.slice(ESTADO.indexOf("if (!activo) {"), ESTADO.indexOf("let vivo = true;"))).toContain(
      "apagarListaGuardada();",
    );
    const GUARDADA = ler("app-pro/src/lib/lista-guardada.ts");
    expect(GUARDADA).toContain("new File(Paths.document,");
    expect(ler("app-pro/src/app/(app)/index.tsx")).toContain("Sem ligação. Esta é a lista de");
  });
});

describe("um ecrã que rebenta não fecha a app", () => {
  it("a raiz tem o ecrã de erro do Expo Router, com «Tentar outra vez»", () => {
    const RAIZ = ler("app-pro/src/app/_layout.tsx");
    expect(RAIZ).toContain("export function ErrorBoundary({ error, retry }: ErrorBoundaryProps)");
    expect(RAIZ).toContain("Tentar outra vez");
    expect(RAIZ).toContain("void retry()");
  });
});
