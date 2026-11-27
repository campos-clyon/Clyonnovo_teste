import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * d148 (27-11-2026, o CEO e o dono): o Início da app de cliente pergunta «Do que
 * precisa?» e responde com quatro grupos, cada um com um «desde» curto e o IVA
 * ao lado; a confiança diz só factos, e o «no fim do trabalho» é a frase da
 * adjudicação, lida da mesma fonte.
 */

vi.mock("@/lib/limite-rota-publica", () => ({ limitarRotaPublica: vi.fn(async () => ({ erro: null })) }));

import { GET as catalogo } from "@/app/api/cliente/catalogo/route";
import { SERVICOS_PUBLICOS } from "@/lib/service-categories";
import { ENTULHO_ATE_10_SACOS, minimoDe } from "@/lib/precos-publicos";
import { comIva, euros } from "@/lib/quanto-custa";
import { PRECO_POR_HORA_DUAS_PESSOAS } from "@/lib/tabela-das-mudancas";
import { AVALIACOES_NO_GOOGLE, MES_DAS_CONTAGENS } from "@/lib/avaliacoes-publicas";
import { FORA_DOS_GRUPOS, confiancaDoInicio, desdeCurto, gruposDoInicio, passosDoInicio } from "@/lib/grupos-da-app";
import { passosDeComoFunciona } from "@/lib/como-funciona";
import { PRAZO_DE_RESPOSTA } from "@/lib/seo-data";
import { NO_FIM_DO_TRABALHO, PAGA_AO_PARCEIRO_NO_FIM, SALVO_SE_COMBINAREM } from "@/lib/quando-se-paga";
import { blocoDoPagamentoAoParceiro } from "@/lib/mensagem-de-adjudicacao";
import { ANTES_DO_MODELO, DEPOIS_DO_MODELO, comORelogioEm } from "@/lib/relogio-dos-testes";

const PROIBIDO = /profissiona|contentor|big[\s_-]?bag|pr[óo]prio dia/i;

describe("d148 — os grupos do Início", () => {
  it("cada serviço do simulador (menos o «Outro serviço») está em exatamente um grupo", () => {
    const grupos = gruposDoInicio();
    const nosGrupos = grupos.flatMap((g) => g.servicos);
    expect(new Set(nosGrupos).size).toBe(nosGrupos.length);
    const esperados = SERVICOS_PUBLICOS.map((c) => c.id).filter((id) => !FORA_DOS_GRUPOS.includes(id));
    expect([...nosGrupos].sort()).toEqual([...esperados].sort());
  });

  it("o «desde» de cada grupo é o mais baixo dos seus serviços, sem o entulho (fora da divulgação)", () => {
    for (const g of gruposDoInicio()) {
      expect(g.servicos[0]).not.toBe("recolha_entulho");
      const candidatos = g.servicos.filter((s) => s !== "recolha_entulho" && s !== "mudanca" && minimoDe(s) != null);
      if (candidatos.length === 0) continue;
      const mais = candidatos.reduce((a, b) => (minimoDe(b)! < minimoDe(a)! ? b : a));
      expect(g.desde).toEqual(desdeCurto(mais));
    }
  });

  it("cada «desde» tem o sem IVA com «+ IVA» e o com IVA entre parênteses no fim, pelas fontes", () => {
    for (const s of SERVICOS_PUBLICOS) {
      const d = desdeCurto(s.id);
      const m = minimoDe(s.id);
      if (d) expect(d).toMatch(/\+ IVA.*\([^()]* com IVA\)$/);
      if (s.id === "mudanca") {
        expect(d).toBe(`desde ${euros(PRECO_POR_HORA_DUAS_PESSOAS)}/hora + IVA, com 2 pessoas (${euros(comIva(PRECO_POR_HORA_DUAS_PESSOAS))} com IVA)`);
      } else if (s.id === "recolha_entulho") {
        expect(d).toBe(`10 sacos desde ${euros(ENTULHO_ATE_10_SACOS.minimo)} + IVA (${euros(comIva(ENTULHO_ATE_10_SACOS.minimo))} com IVA)`);
      } else if (m == null) {
        expect(d).toBeNull();
      } else {
        expect(d).toBe(`desde ${euros(m)} + IVA (${euros(comIva(m))} com IVA)`);
      }
    }
  });

  it("a mudança com parceiros na lista diz o «desde» deles", () => {
    const d = desdeCurto("mudanca", { tipo: "parceiros", parceiros: 3, desde: { semIvaCent: 4250, comIvaCent: 5228 } });
    expect(d).toBe("desde 42,50 €/hora + IVA, com 2 pessoas (52,28 € com IVA)");
  });

  it("nada do que o cliente lê diz «profissional», contentores, big bags nem «próprio dia»", () => {
    expect(JSON.stringify(gruposDoInicio())).not.toMatch(PROIBIDO);
    expect(JSON.stringify(confiancaDoInicio(DEPOIS_DO_MODELO))).not.toMatch(PROIBIDO);
  });
});

describe("d148 — a confiança e o «no fim do trabalho»", () => {
  it("no modelo de 15-11: aprovados pela equipa, pagar ao parceiro no fim (com a ressalva) e duas faturas", () => {
    const c = confiancaDoInicio(DEPOIS_DO_MODELO);
    expect(c.map((f) => f.titulo)).toEqual(["Parceiros aprovados pela equipa", PAGA_AO_PARCEIRO_NO_FIM, "Duas faturas, juntas ao pedido"]);
    expect(c[1].titulo).toBe("Paga ao parceiro no fim do trabalho");
    expect(c[1].texto.toLowerCase()).toContain(SALVO_SE_COMBINAREM);
  });

  it("antes do modelo, só os parceiros aprovados (o pagamento era outro)", () => {
    expect(confiancaDoInicio(ANTES_DO_MODELO).map((f) => f.titulo)).toEqual(["Parceiros aprovados pela equipa"]);
  });

  it("a adjudicação diz o mesmo, da mesma fonte", () => {
    const m = blocoDoPagamentoAoParceiro({ total: 123, semIva: 100, formas: [] }, "Teste", null);
    expect(m).toContain(`Paga diretamente à empresa Teste, ${NO_FIM_DO_TRABALHO} (${SALVO_SE_COMBINAREM})`);
  });
});

describe("d148 — os três passos do Início", () => {
  it("os títulos são os de «Como funciona» e o prazo é o da promessa", () => {
    const p = passosDoInicio(DEPOIS_DO_MODELO);
    expect(p.map((x) => x.titulo)).toEqual(passosDeComoFunciona(DEPOIS_DO_MODELO).slice(0, 3).map((x) => x.titulo));
    expect(p[1].texto).toBe(`Em menos de ${PRAZO_DE_RESPOSTA.porExtenso}`);
  });
});

describe("d148 — o catálogo da app (R7)", () => {
  comORelogioEm(DEPOIS_DO_MODELO);

  it("manda os grupos, o «desde» curto de cada serviço, a confiança e as partes das avaliações", async () => {
    const r = await catalogo(new NextRequest("https://clyon.pt/api/cliente/catalogo"));
    const j = await r.json();
    expect(j.grupos.map((g: { id: string }) => g.id)).toEqual(["levar", "esvaziar", "mudar", "reparar"]);
    for (const s of j.servicos) expect(s.desdeCurto ?? null).toEqual(desdeCurto(s.id));
    expect(j.textos.confianca).toEqual(confiancaDoInicio(DEPOIS_DO_MODELO));
    expect(j.textos.passosDoInicio).toEqual(passosDoInicio(DEPOIS_DO_MODELO));
    expect(j.avaliacoes).toMatchObject({ nota: AVALIACOES_NO_GOOGLE.nota, numero: AVALIACOES_NO_GOOGLE.numero, mes: MES_DAS_CONTAGENS });
  });
});

describe("d148 — a app de cliente lê o catálogo com tolerância", () => {
  comORelogioEm(DEPOIS_DO_MODELO);

  it("os grupos, os «desde», a confiança, os passos e as partes das avaliações chegam à app tal como o site os escreve", async () => {
    const { catalogoValido } = await import("../../app-cliente/src/lib/novo-pedido");
    const r = await catalogo(new NextRequest("https://clyon.pt/api/cliente/catalogo"));
    const c = catalogoValido(await r.json());
    expect(c).not.toBeNull();
    expect(c!.info.grupos.map((g) => g.id)).toEqual(["levar", "esvaziar", "mudar", "reparar"]);
    expect(c!.info.grupos[0].desde).toBe(desdeCurto("recolha_moveis"));
    expect(c!.servicos.find((s) => s.id === "esvaziamento_empresa")?.desdeCurto).toBeNull();
    expect(c!.textos.confianca.map((l) => l.titulo)).toContain(PAGA_AO_PARCEIRO_NO_FIM);
    expect(c!.textos.passosDoInicio).toHaveLength(3);
    expect(c!.info.avaliacoes).toMatchObject({ nota: AVALIACOES_NO_GOOGLE.nota, numero: AVALIACOES_NO_GOOGLE.numero });
  });

  it("numa R7 antiga, sem grupos nem «desde», a app fica com listas vazias (o Início mostra a grelha de antes)", async () => {
    const { catalogoValido } = await import("../../app-cliente/src/lib/novo-pedido");
    const c = catalogoValido({ servicos: [{ id: "recolha_moveis", nome: "Recolha de móveis", detalhes: "moveis" }], textos: { fraseUnica: "x" } });
    expect(c!.info.grupos).toEqual([]);
    expect(c!.servicos[0].desdeCurto).toBeNull();
    expect(c!.textos.confianca).toEqual([]);
    expect(c!.textos.passosDoInicio).toEqual([]);
  });

  it("um «desde» sem a parte com o IVA entre parênteses não se mostra", async () => {
    const { desdeValido } = await import("../../app-cliente/src/lib/catalogo");
    expect(desdeValido("desde 60 € + IVA")).toBeNull();
    expect(desdeValido("desde 60 € + IVA (73,80 € com IVA)")).toBe("desde 60 € + IVA (73,80 € com IVA)");
  });
});
