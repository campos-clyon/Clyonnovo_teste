import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * d121 — NO BACKOFFICE TAMBÉM SE ATRIBUI O ENTULHO SEM GUIA, COM O SIM
 * EXPLÍCITO (25-11-2026), o #679.
 */

import {
  AVISO_SEM_GUIA_NO_BACKOFFICE,
  confirmouSemGuia,
  notaSemGuia,
  RECUSA_SEM_A_CONFIRMACAO_DA_GUIA,
  SELO_SEM_GUIA,
} from "./guia-no-backoffice";
import { AVISO_DA_GUIA_NO_ENTULHO } from "./guia-no-entulho";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("a regra", () => {
  it("o aviso, a recusa sem a marca, o histórico e o selo", () => {
    expect(AVISO_SEM_GUIA_NO_BACKOFFICE).toBe("Este parceiro não emite guia de resíduos (e-GAR). Confirme que o cliente sabe.");
    expect(RECUSA_SEM_A_CONFIRMACAO_DA_GUIA).toMatchObject({ error: AVISO_SEM_GUIA_NO_BACKOFFICE, pedeConfirmacaoDaGuia: true });
    expect(notaSemGuia("Ana")).toBe("Atribuído sem guia de resíduos — o cliente foi avisado (por Ana)");
    expect(SELO_SEM_GUIA).toBe("Sem guia (e-GAR)");
    expect(confirmouSemGuia({ semGuiaConfirmado: true })).toBe(true);
    for (const c of [{}, { semGuiaConfirmado: "true" }, { semGuiaConfirmado: 1 }, null]) expect(confirmouSemGuia(c)).toBe(false);
  });
});

describe("cada rota aceita com a marca e recusa sem ela (409, com a frase nova)", () => {
  const rotas: Array<[string, string]> = [
    ["src/app/api/admin/trabalhos-clyon/escolher/route.ts", "if (semGuia && !confirmouSemGuia(corpo))"],
    ["src/app/api/admin/negociacoes/agir/route.ts", "if (semGuia && !confirmouSemGuia(corpo))"],
    ["src/app/api/admin/negociacoes/trocar-profissional/route.ts", "if (semGuia && !confirmouSemGuia(corpo))"],
    ["src/app/api/admin/trabalhos-clyon/route.ts", "&& !confirmouSemGuia(corpo)"],
  ];
  for (const [rota, guarda] of rotas) {
    it(rota, () => {
      const f = ler(rota);
      const i = f.indexOf(guarda);
      expect(i, rota).toBeGreaterThan(-1);
      expect(f.slice(i, i + 200)).toContain("RECUSA_SEM_A_CONFIRMACAO_DA_GUIA, { status: 409 }");
      expect(f).not.toContain("{ error: GUIA_POR_VERIFICAR_FRASE, guiaPorVerificar: true }");
    });
  }

  it("o atribuir directamente: a marca passa das duas portas, e o histórico diz-o", () => {
    const A = ler("src/lib/atribuir-directamente.ts");
    expect(A).toContain("if (semGuia && a.semGuiaConfirmado !== true) {");
    expect(A).toContain("notaSemGuia(a.quem)");
    expect((ler("src/app/api/admin/trabalhos-clyon/route.ts").match(/semGuiaConfirmado: \(corpo as \{ semGuiaConfirmado\?: unknown \}\)\.semGuiaConfirmado === true/g) ?? []).length).toBe(2);
    expect(ler("src/app/api/admin/trabalhos-clyon/escolher/route.ts")).toContain("notaSemGuia(quem)");
    expect(ler("src/app/api/admin/negociacoes/agir/route.ts")).toContain("notaSemGuia(colab?.nome ?? null)");
  });
});

describe("o painel: o botão activo com o aviso, e o sim pedido", () => {
  it("o «Escolher» e o «Aceitar/Contratar» já não ficam desligados pela guia", () => {
    const TC = ler("src/components/admin/TrabalhoClyon.tsx");
    expect(TC).not.toContain("disabled={ocupado != null || n.guiaPorVerificar === true}");
    expect(TC).toContain("{AVISO_SEM_GUIA_NO_BACKOFFICE}");
    const AN = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(AN).not.toContain('disabled={aEnviar !== "" || negociacao.guiaPorVerificar === true}');
    expect(AN).toContain("{SELO_SEM_GUIA}");
  });

  it("os pedidos do painel perguntam e repetem com a marca", () => {
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toContain("fetchComAConfirmacaoDaGuia(");
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain('fetchComAConfirmacaoDaGuia("/api/admin/negociacoes/agir"');
    expect(ler("src/components/admin/TrocarProfissional.tsx")).toContain('fetchComAConfirmacaoDaGuia("/api/admin/negociacoes/trocar-profissional"');
    const G = ler("src/lib/guia-no-backoffice.ts");
    expect(G).toContain("window.confirm(");
    expect(G).toContain("semGuiaConfirmado: true");
  });
});

describe("o cliente: a frase do Jurídico antes de aceitar, e aceitar vale como a confirmação", () => {
  it("a app e o link recebem a frase; o link manda a marca ao aceitar", () => {
    expect(ler("src/lib/pedido-para-a-app.ts")).toContain("avisoDaGuia: n.guiaPorVerificar === true ? AVISO_DA_GUIA_NO_ENTULHO : null,");
    const PR = ler("src/app/pedido/[token]/PropostasRecebidas.tsx");
    expect(PR).toContain("{ semGuiaConfirmado: true }");
    expect(PR).toContain("avisoDaGuiaDe(n)");
    expect(AVISO_DA_GUIA_NO_ENTULHO).toContain("não emite guia de resíduos (e-GAR)");
  });

  it("sem a marca (uma app que ainda não mostra a frase), recusa com a frase do Jurídico", () => {
    const AC = ler("src/lib/agir-como-cliente.ts");
    expect(AC).toContain("return falha(409, AVISO_DA_GUIA_NO_ENTULHO, { guiaPorVerificar: true, pedeConfirmacaoDaGuia: true });");
  });

  it("a verificação da guia no perfil do parceiro não muda", () => {
    expect(ler("src/lib/guia-antes-de-contratar.ts")).toContain("export function guiaVerificada(");
  });
});
