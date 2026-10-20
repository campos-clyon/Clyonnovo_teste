import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { guiaMudouDeFacto } from "./guia-mudou";

/**
 * GRAVAR A FATURAÇÃO NÃO TIRA O SELO DA GUIA — 20-10-2026.
 *
 * O painel manda a guia e o número em cada gravação da Faturação, e a ficha do
 * backoffice em cada gravação; antes, isso bastava para a verificação voltar a
 * «por fazer». Agora só cai quando a guia muda mesmo.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const VERIFICADA = { emiteGuiaTransporte: 1, numeroTransportador: "TR-12345" };

describe("a guia mudou mesmo?", () => {
  it("o mesmo número e a guia ligada, mandados outra vez, não contam", () => {
    expect(guiaMudouDeFacto(VERIFICADA, { emiteGuiaTransporte: 1, numeroTransportador: "TR-12345" })).toBe(false);
    expect(guiaMudouDeFacto(VERIFICADA, { emiteGuiaTransporte: true, numeroTransportador: " TR-12345 " })).toBe(false);
    // Uma gravação que nem fala da guia também não.
    expect(guiaMudouDeFacto(VERIFICADA, {})).toBe(false);
  });

  it("um número novo, ou desligar a guia, contam", () => {
    expect(guiaMudouDeFacto(VERIFICADA, { numeroTransportador: "TR-99999" })).toBe(true);
    expect(guiaMudouDeFacto(VERIFICADA, { emiteGuiaTransporte: 0 })).toBe(true);
    expect(guiaMudouDeFacto({ emiteGuiaTransporte: 0, numeroTransportador: null }, { emiteGuiaTransporte: 1 })).toBe(true);
  });

  it("sem saber o que estava na base, verifica-se outra vez", () => {
    expect(guiaMudouDeFacto(undefined, { numeroTransportador: "TR-12345" })).toBe(true);
  });

  it("o painel e o backoffice decidem pela mesma regra, antes de gravar", () => {
    const ROTA = ler("src/app/api/profissionais/perfil/route.ts");
    expect(ROTA).toContain("guiaMudouDeFacto(await perfilDoProfissional(sessao.providerId), mudancas)");
    // Ler o «antes» tem de vir antes do UPDATE — depois já é o «depois».
    expect(ROTA.indexOf("guiaMudouDeFacto(await")).toBeLessThan(
      ROTA.indexOf("await actualizarPerfilDoProfissional(sessao.providerId, mudancas)"),
    );
    expect(ROTA).not.toMatch(/guiaMudou = true/);

    const DB = ler("src/lib/db.ts");
    const ficha = DB.slice(DB.indexOf("export async function actualizarProfissional("));
    expect(ficha.slice(0, 4000)).toContain("guiaMudouDeFacto(guiaAntes, { numeroTransportador: alteracoes.numeroTransportador })");
  });
});
