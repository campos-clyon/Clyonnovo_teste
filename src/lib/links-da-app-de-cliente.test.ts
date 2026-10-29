import { describe, it, expect } from "vitest";
import {
  assetLinks,
  associacaoDaApple,
  CAMINHOS_DA_APP_CLIENTE,
  CAMINHOS_DA_APP_PRO,
  ID_DA_APP_CLIENTE,
  ID_DA_APP_PRO,
  IMPRESSOES_DA_APP_CLIENTE,
  IMPRESSOES_DA_APP_PRO,
  impressoesDaAppDeCliente,
} from "@/lib/links-da-app";

/**
 * OS LINKS QUE ABREM A APP DE CLIENTE — R9 v2 (d8 fase 2, S2, 28-10-2026).
 *
 * `/entrar/app` e `/pedido/` abrem a app de cliente; `/profissionais/…` a
 * CLYON Pro. Os caminhos das duas apps não se cruzam, e o `/entrar/link` do
 * site não é de nenhuma: um link de entrada pedido no site abre sempre o site.
 */

const SHA = "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89";

describe("S2 — R9 v2", () => {
  it("os caminhos das duas apps não se cruzam", () => {
    expect([...CAMINHOS_DA_APP_CLIENTE]).toEqual(["/entrar/app", "/pedido/"]);
    for (const c of CAMINHOS_DA_APP_CLIENTE) {
      expect(c).not.toContain("/entrar/link");
      expect(c).not.toMatch(/^\/profissionais\//);
    }
    for (const c of CAMINHOS_DA_APP_PRO) {
      expect(c).not.toMatch(/^\/pedido\//);
      expect(c).not.toMatch(/^\/entrar\//);
    }
  });

  it("com a impressão da app de cliente, o assetlinks.json mostra os dois pacotes", () => {
    const l = assetLinks({ APP_CLIENTE_ANDROID_SHA256: SHA.toLowerCase() });
    expect(l.map((x) => x.target.package_name)).toEqual([ID_DA_APP_PRO, ID_DA_APP_CLIENTE]);
    const cliente = l[1];
    expect(cliente.target.sha256_cert_fingerprints).toEqual([...IMPRESSOES_DA_APP_CLIENTE, SHA]);
    // Só abre links — as palavras-passe guardadas são da Pro.
    expect(cliente.relation).toEqual(["delegate_permission/common.handle_all_urls"]);
  });

  it("a chave da EAS da app de cliente (1.º APK, 29-10-2026) já sai sem variável — e não é a da Pro", () => {
    expect(IMPRESSOES_DA_APP_CLIENTE).toEqual([
      "C5:F0:B9:CA:0A:BB:C1:08:6C:8A:16:1B:19:4E:D8:F7:FE:17:A1:12:9C:55:1E:E9:EA:40:5D:EE:EB:80:6B:55",
    ]);
    const l = assetLinks({});
    expect(l.map((x) => x.target.package_name)).toEqual([ID_DA_APP_PRO, ID_DA_APP_CLIENTE]);
    expect(l[1].target.sha256_cert_fingerprints).toEqual([...IMPRESSOES_DA_APP_CLIENTE]);
    // A Pro fica igual: nenhuma impressão de uma app abre os links da outra.
    expect(l[0].target.sha256_cert_fingerprints).toEqual([...IMPRESSOES_DA_APP_PRO]);
    for (const i of IMPRESSOES_DA_APP_CLIENTE) expect(IMPRESSOES_DA_APP_PRO as readonly string[]).not.toContain(i);
  });

  it("uma impressão mal escrita na variável fica de fora", () => {
    expect(impressoesDaAppDeCliente({ APP_CLIENTE_ANDROID_SHA256: "mal-escrita" })).toEqual([...IMPRESSOES_DA_APP_CLIENTE]);
  });

  it("no iPhone (com Team ID): a app de cliente com /entrar/app* e /pedido/*", () => {
    const a = associacaoDaApple({ APP_PRO_APPLE_TEAM_ID: "abcde12345" });
    const cliente = a.applinks.details.find((d) => d.appIDs[0] === "ABCDE12345.pt.clyon.cliente")!;
    expect(cliente.components).toEqual([{ "/": "/entrar/app*" }, { "/": "/pedido/*" }]);
    // E a Pro continua igual.
    expect(a.applinks.details[0].appIDs).toEqual(["ABCDE12345.pt.clyon.pro"]);
  });
});
