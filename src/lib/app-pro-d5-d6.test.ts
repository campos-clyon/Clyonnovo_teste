import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marcouComoFeito, TRABALHO_COM_PRECO_FECHADO } from "../../app-pro/src/lib/trabalhos";
import { SERVICOS_DA_INSCRICAO, servicosParaEscolher } from "../../app-pro/src/lib/conta";
import { versaoDaApp } from "../../app-pro/src/lib/erro-da-app";
import { caminhoDe, destinoDoAviso } from "../../app-pro/src/lib/destino";
import { dataEHora } from "./historico-negociacao";
import { CABECALHOS_DA_VERSAO, versaoDoCabecalho } from "./app-pro-no-telemovel";
import { SERVICE_CATEGORIES, SERVICOS_PUBLICOS, FORA_DO_PLANO } from "./service-categories";

/**
 * A PARTE DA APP DAS DECISÕES d5 E d6 — 27-10-2026 (EAS Update sobre a build 13).
 *
 * d6: a app manda a versão no cabeçalho `x-app-versao` em todos os pedidos
 * (e por isso no da sessão, que a grava). d5: «Marcou como feito a …» à hora
 * de Lisboa por baixo da espera, e os avisos novos («Trabalho confirmado»,
 * «Pagamento feito») abrem o trabalho pelo `negociacaoId`. E, da auditoria da
 * orquestra: os serviços do perfil e do registo são os da inscrição do site, e
 * os textos do trabalho CLYON dizem a frase-padrão 5.
 */

const cru = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const semNotas = (f: string) =>
  cru(f)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s+/g, " ");

describe("d6 — a versão da app em cada pedido", () => {
  const API = semNotas("app-pro/src/lib/api.ts");

  it("o cabeçalho é um dos que a rota da sessão lê, e o valor passa a validação do site", () => {
    expect(API).toContain('export const CABECALHO_DA_VERSAO = "x-app-versao";');
    expect(CABECALHOS_DA_VERSAO).toContain("x-app-versao");
    const v = versaoDaApp("0.1.0", "01a1782e-1234-4abc-9def-000000000000");
    expect(v).toBe("0.1.0 (01a1782e)");
    expect(versaoDoCabecalho(v)).toBe(v);
    expect(versaoDoCabecalho(versaoDaApp("0.1.0", null))).toBe("0.1.0 (base)");
  });

  it("vai nos pedidos JSON (sessão incluída) e nos ficheiros", () => {
    expect(API.split("[CABECALHO_DA_VERSAO]: versaoDestaApp()").length - 1).toBe(2);
    expect(API).toContain("versaoDaApp(Constants.expoConfig?.version, Updates.updateId)");
    // A sessão renova-se por `pedir`, que leva o cabeçalho.
    expect(semNotas("app-pro/src/estado/Sessao.tsx")).toContain(
      'pedir<{ nome: string; token: string }>("/api/profissionais/sessao", { metodo: "POST" })',
    );
  });
});

describe("d5 — «Marcou como feito a …», à hora de Lisboa", () => {
  it("a mesma data e hora do painel, no Verão e no Inverno", () => {
    // 20-10-2026 ainda era Verão (UTC+1); 27-10 já é Inverno (UTC+0).
    expect(marcouComoFeito("2026-10-20 13:05:00")).toBe("Marcou como feito a 20/10/2026, às 14:05.");
    expect(marcouComoFeito("2026-10-27T14:05:00.000Z")).toBe("Marcou como feito a 27/10/2026, às 14:05.");
    for (const q of ["2026-10-20T13:05:00.000Z", "2026-10-20T23:30:00.000Z", "2026-12-31T23:59:00Z"]) {
      expect(marcouComoFeito(q)).toBe(`Marcou como feito a ${dataEHora(q)}.`);
    }
    expect(marcouComoFeito(null)).toBeNull();
    expect(marcouComoFeito("")).toBeNull();
    expect(marcouComoFeito("isto não é data")).toBeNull();
  });

  it("aparece no fim do trabalho, por baixo da espera, a partir do execucaoEnviadaEm", () => {
    const C = semNotas("app-pro/src/componentes/TrabalhoContratado.tsx");
    const espera = C.indexOf("{A_AGUARDAR_A_CLYON}");
    const linha = C.indexOf("marcouComoFeito(t.execucaoEnviadaEm)");
    expect(espera).toBeGreaterThan(0);
    expect(linha).toBeGreaterThan(espera);
    expect(semNotas("src/app/api/profissionais/meus-pedidos/route.ts")).toContain(
      "execucaoEnviadaEm: l.execucaoEnviadaEm ?? null",
    );
  });

  it("os avisos «Trabalho confirmado» e «Pagamento feito» levam o negociacaoId e abrem o trabalho", () => {
    const PUSH = semNotas("src/lib/avisar-por-push.ts");
    expect(PUSH).toContain("tag: `confirmado-${dados.pedidoId}`, negociacaoId: dados.negociacaoId ?? undefined");
    expect(PUSH).toContain("tag: dados.pedidoId ? `pago-${dados.pedidoId}`");
    expect(PUSH.split("negociacaoId: dados.negociacaoId ?? undefined").length - 1).toBeGreaterThanOrEqual(2);
    expect(semNotas("src/lib/push-nativo.ts")).toContain("negociacaoId: aviso.negociacaoId");
    expect(caminhoDe(destinoDoAviso({ url: "x", tag: "confirmado-470", negociacaoId: 812 }))).toBe("/trabalho/812");
    expect(caminhoDe(destinoDoAviso({ url: "x", tag: "pago-470", negociacaoId: "812" }))).toBe("/trabalho/812");
    // Um levantamento não é de um trabalho: abre a lista.
    expect(caminhoDe(destinoDoAviso({ url: "x", tag: "levantamento-9" }))).toBe("/");
  });
});

describe("os serviços do perfil e do registo são os da inscrição do site", () => {
  it("os do plano, sem «Outro serviço» — como o InscricaoForm", () => {
    expect(semNotas("src/app/profissionais/InscricaoForm.tsx")).toContain(
      'SERVICOS_PUBLICOS.filter((c) => c.id !== "outro")',
    );
    expect(SERVICOS_DA_INSCRICAO.map((c) => c.id)).toEqual(
      SERVICOS_PUBLICOS.map((c) => c.id).filter((id) => id !== "outro"),
    );
    for (const id of [...FORA_DO_PLANO, "outro"]) expect(SERVICOS_DA_INSCRICAO.some((c) => c.id === id), id).toBe(false);
  });

  it("o perfil não oferece montagem nem jardinagem, mas mostra a que ele já tenha, para a tirar", () => {
    const ids = (activos: string[]) => servicosParaEscolher(SERVICE_CATEGORIES, activos).map((c) => c.id);
    expect(ids([])).toEqual(SERVICOS_DA_INSCRICAO.map((c) => c.id));
    expect(ids(["jardinagem"])).toContain("jardinagem");
    expect(ids(["jardinagem"])).not.toContain("montagem_moveis");
    const S = semNotas("app-pro/src/app/conta/servicos.tsx");
    expect(S).toContain("servicosParaEscolher(SERVICE_CATEGORIES, perfil.categorias)");
    expect(S).not.toContain("SERVICE_CATEGORIES.map(");
  });
});

describe("o trabalho CLYON com a frase-padrão 5", () => {
  // Sem «você» desde 28-10-2026 (d8): a regra a) da orquestra passou a ver o «ê».
  it("a frase, igual à do Produto, em português de Portugal", () => {
    expect(TRABALHO_COM_PRECO_FECHADO).toBe(
      "Trabalho com preço fechado pela CLYON. O trabalho é seu; a CLYON fala com o cliente e paga-lhe depois de o trabalho estar confirmado.",
    );
  });

  it("no cartão do valor fixo e no do trabalho que é dele, e sem «a CLYON trata do cliente»", () => {
    expect(semNotas("app-pro/src/app/trabalho/[id].tsx")).toContain("{TRABALHO_COM_PRECO_FECHADO}");
    const C = semNotas("app-pro/src/componentes/TrabalhoContratado.tsx");
    expect(C).toContain("{t.ofertaClyon ? ( <Text");
    expect(C).toContain("{TRABALHO_COM_PRECO_FECHADO}</Text>");
    expect(C).not.toContain("trata do cliente");
    expect(C).not.toContain("Num trabalho CLYON o cliente");
    expect(C).not.toContain("num trabalho CLYON, quem responde");
    expect(C).toContain("num trabalho com preço fechado pela CLYON, quem responde é a CLYON, que fala com o cliente.");
  });
});
