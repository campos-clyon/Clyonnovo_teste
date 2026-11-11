import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEIXAR_A_CLYON_ESCOLHER as DO_SITE, PRAZO_DA_LISTA_MS as PRAZO_DO_SITE } from "./lista-de-parceiros-da-mudanca";
import {
  comPrazoDaLista,
  DEIXAR_A_CLYON_ESCOLHER,
  PRAZO_DA_LISTA_MS,
} from "../../app-cliente/src/lib/parceiros-da-mudanca";

/** A app de cliente tem a mesma saída da lista que o site (11-11-2026). */
describe("app de cliente: a lista das mudanças não prende o pedido", () => {
  it("o mesmo botão e o mesmo prazo do site", () => {
    expect(DEIXAR_A_CLYON_ESCOLHER).toBe(DO_SITE);
    expect(PRAZO_DA_LISTA_MS).toBe(PRAZO_DO_SITE);
  });

  it("aos 8 s a lista desiste", async () => {
    await expect(comPrazoDaLista(new Promise(() => {}), 20)).rejects.toThrow("PRAZO_DA_LISTA");
    await expect(comPrazoDaLista(Promise.resolve(1), 20)).resolves.toBe(1);
  });

  it("o ecrã mostra o botão e o Pedir corta a lista pelo prazo", () => {
    const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    expect(ler("app-cliente/src/componentes/ParceirosDaMudanca.tsx")).toContain("aoCarregar={aoDeixarEscolher}");
    const novo = ler("app-cliente/src/componentes/NovoPedido.tsx");
    expect(novo).toContain("comPrazoDaLista(pedir<unknown>(ROTA_DOS_PARCEIROS");
    expect(novo).toContain("aoDeixarEscolher={() => {");
  });
});
