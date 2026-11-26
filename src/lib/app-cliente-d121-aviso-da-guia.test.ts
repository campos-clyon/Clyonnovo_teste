import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AVISO_DA_GUIA_NO_ENTULHO } from "./guia-no-entulho";
import { GUIA_POR_VERIFICAR_FRASE } from "./guia-antes-de-contratar";
import { avisoDaGuiaDe, corpoDeContratar, porqueNaoSeContrata } from "../../app-cliente/src/lib/pedidos";

/**
 * O ENTULHO SEM GUIA NA APP DE CLIENTE — d121 (25-11-2026), parte das apps.
 *
 * O site manda `avisoDaGuia` (a frase do Jurídico, `AVISO_DA_GUIA_NO_ENTULHO`)
 * na negociação de um parceiro de entulho sem guia verificada. Como a página
 * do pedido (`PropostasRecebidas.tsx`): a frase por cima do «Contratar», o
 * botão activo, e contratar manda `semGuiaConfirmado: true` — sem a marca, o
 * servidor recusa com a frase (`agir-como-cliente.ts`, 409).
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const AVISO = AVISO_DA_GUIA_NO_ENTULHO;

describe("o contrato com o site", () => {
  it("a API da app manda a frase do Jurídico em avisoDaGuia", () => {
    expect(ler("src/lib/pedido-para-a-app.ts")).toContain(
      "avisoDaGuia: n.guiaPorVerificar === true ? AVISO_DA_GUIA_NO_ENTULHO : null",
    );
    expect(AVISO.startsWith("Este parceiro compromete-se a entregar o entulho num centro de resíduos autorizado, mas não emite guia de resíduos (e-GAR).")).toBe(true);
  });

  it("a rota das acções da app passa o corpo inteiro a agirComoCliente, que exige semGuiaConfirmado", () => {
    expect(ler("app-cliente/src/lib/pedidos.ts")).toContain('export const ROTA_DAS_ACCOES = "/api/users/me/negociacao";');
    const rota = ler("src/app/api/users/me/negociacao/route.ts");
    expect(rota).toMatch(/agirComoCliente/);
    expect(rota).toMatch(/\n\s+corpo,\n/);
    expect(ler("src/lib/agir-como-cliente.ts")).toContain(
      "(a.corpo as { semGuiaConfirmado?: unknown } | undefined)?.semGuiaConfirmado !== true",
    );
  });

  it("o site faz o mesmo na página do pedido", () => {
    const site = ler("src/app/pedido/[token]/PropostasRecebidas.tsx");
    expect(site).toContain("? { semGuiaConfirmado: true }");
    expect(site).toContain("disabled={soParaVer || aEnviar === n.id || (!!n.naoSeContrata && !avisoDaGuiaDe(n))}");
  });
});

describe("a app lê avisoDaGuia", () => {
  const comAviso = { id: 7, accoes: ["aceitar", "desistir"], naoSeContrata: GUIA_POR_VERIFICAR_FRASE, avisoDaGuia: AVISO };

  it("mostra a frase tal e qual quando há o que contratar", () => {
    expect(avisoDaGuiaDe(comAviso)).toBe(AVISO);
    expect(avisoDaGuiaDe({ accoes: ["contratar"], avisoDaGuia: AVISO })).toBe(AVISO);
  });

  it("sem aviso, ou sem nada para contratar, não diz nada", () => {
    expect(avisoDaGuiaDe({ accoes: ["aceitar"], avisoDaGuia: null })).toBeNull();
    expect(avisoDaGuiaDe({ accoes: ["aceitar"], avisoDaGuia: "  " })).toBeNull();
    expect(avisoDaGuiaDe({ accoes: ["aceitar"] })).toBeNull();
    expect(avisoDaGuiaDe({ accoes: ["desistir"], avisoDaGuia: AVISO })).toBeNull();
  });

  it("com o aviso, o «Contratar» já não fica parado; sem ele, a guia trava como antes (site antigo)", () => {
    expect(porqueNaoSeContrata(comAviso)).toBeNull();
    expect(porqueNaoSeContrata({ ...comAviso, avisoDaGuia: null })).not.toBeNull();
  });

  it("contratar com o aviso leva semGuiaConfirmado: true; sem o aviso, não", () => {
    expect(corpoDeContratar(3, comAviso)).toEqual({ pedidoId: 3, negociacaoId: 7, accao: "aceitar", semGuiaConfirmado: true });
    expect(corpoDeContratar(3, { id: 7, accoes: ["contratar"] })).toEqual({ pedidoId: 3, negociacaoId: 7, accao: "contratar" });
    expect(corpoDeContratar(3, { id: 7, accoes: ["desistir"], avisoDaGuia: AVISO })).toBeNull();
  });
});

describe("os ecrãs", () => {
  it("a proposta mostra a frase por cima do «Contratar»", () => {
    const p = ler("app-cliente/src/componentes/Proposta.tsx");
    expect(p).toContain("const avisoDaGuia = avisoDaGuiaDe(n);");
    const aviso = p.indexOf('{avisoDaGuia ? <Aviso tom="aviso" texto={avisoDaGuia} /> : null}');
    expect(aviso).toBeGreaterThan(-1);
    expect(p.indexOf('<Botao titulo="Contratar"')).toBeGreaterThan(aviso);
  });

  it("o pedido contrata com o corpo de corpoDeContratar", () => {
    const v = ler("app-cliente/src/componentes/VistaDoPedido.tsx");
    expect(v).toContain("const corpo = corpoDeContratar(pedidoId, n);");
    expect(v).toContain('await pedir(ROTA_DAS_ACCOES, { metodo: "POST", corpo });');
  });
});
