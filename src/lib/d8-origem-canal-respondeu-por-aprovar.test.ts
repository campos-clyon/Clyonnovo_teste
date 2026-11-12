import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gclidValido, origemParaGravar } from "./origem-para-gravar";
import { SEM_ORIGEM, canalCurtoDoPedido, trabalhosPagosPorCanal } from "./canal-do-pedido";
import { profissionalRespondeu } from "./profissional-respondeu";
import { ONDE_POR_APROVAR, ONDE_PROFISSIONAIS_DO_PAINEL } from "./profissionais-do-painel";

/*
 * d8, 12-11-2026 — uma regra, um teste:
 *  (b) o pedido do formulário guarda o gclid quando existe (e só com consentimento);
 *  (c) as Finanças mostram os trabalhos pagos por canal;
 *  (d) «Respondeu» conta a primeira proposta do profissional, ou a aceitação;
 *  (e) o «Por aprovar» do Início usa o filtro do separador dos Profissionais.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const GCLID = "Cj0KCQiA_abc-123XYZ";

describe("(b) o gclid vai para o pedido quando existe", () => {
  it("guarda o gclid e as UTM da origem da visita", () => {
    expect(origemParaGravar({ utm_source: "google", utm_medium: "cpc", gclid: GCLID, quando: "2026-11-12T10:00:00Z" })).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      gclid: GCLID,
      quando: "2026-11-12T10:00:00Z",
    });
  });

  it("um gclid que não tem a forma de um (um email, um telefone) não passa", () => {
    expect(gclidValido("alguem@exemplo.pt")).toBeNull();
    expect(gclidValido("+351 912 345 678")).toBeNull();
    expect(origemParaGravar({ gclid: "alguem@exemplo.pt" })).toBeNull();
    expect(origemParaGravar("lixo")).toBeNull();
  });

  it("as duas portas do formulário passam a origem por aqui; e o browser só manda o gclid com consentimento", () => {
    const simulador = ler("src/app/api/simulador/pedido/route.ts");
    expect(simulador).toContain("origemParaGravar(order.origemDaVisita)");
    const hero = ler("src/app/api/hero-quote/route.ts");
    expect(hero).toContain("origemParaGravar(origemDaVisita)");
    expect(hero).toContain("gclidValido(gclid)");
    const browser = ler("src/lib/origem-da-visita.ts");
    expect(browser).toMatch(/valida\.gclid && !lerConsentimentoGuardado\(\)\.marketing/);
  });
});

describe("(c) trabalhos pagos por canal", () => {
  it("o anúncio pelo site e o anúncio pelo WhatsApp são o mesmo canal", () => {
    expect(canalCurtoDoPedido({ origemDaVisita: { utm_source: "google", utm_medium: "cpc", utm_campaign: "recolhas", gclid: GCLID } })).toBe("Google Ads");
    expect(canalCurtoDoPedido({ origemDaVisita: JSON.stringify({ gclid: GCLID }) })).toBe("Google Ads");
    expect(canalCurtoDoPedido({ codigoDeOrigem: "A1", origemPedido: "whatsapp" })).toBe("Google Ads");
    expect(canalCurtoDoPedido({ codigoDeOrigem: "F2" })).toBe("Facebook");
    expect(canalCurtoDoPedido({ origemPedido: "whatsapp" })).toBe("WhatsApp sem código");
    expect(canalCurtoDoPedido({ origemPedido: "backoffice" })).toBe("Registado pela equipa");
    expect(canalCurtoDoPedido(null)).toBe(SEM_ORIGEM);
  });

  it("conta pedidos distintos, sem os acertos nem a parte da CLYON passada depois", () => {
    const linhas = trabalhosPagosPorCanal(
      [
        { pedidoId: 1, valor: 100 },
        { pedidoId: 1, valor: 20 },
        { pedidoId: 2, valor: 50 },
        { pedidoId: 3, valor: 80, natureza: "em_mao" },
        { pedidoId: 3, valor: 8, daParteDaClyon: true },
        { pedidoId: 4, valor: 30, natureza: "acerto_no_saldo" },
        { pedidoId: 5, valor: 10 },
      ],
      { "1": "Google Ads", "2": "Google Ads", "3": "WhatsApp sem código" },
    );
    expect(linhas).toEqual([
      { canal: "Google Ads", trabalhos: 2, valor: 170 },
      { canal: "WhatsApp sem código", trabalhos: 1, valor: 80 },
      { canal: SEM_ORIGEM, trabalhos: 1, valor: 10 },
    ]);
  });

  it("as Finanças recebem os canais e mostram a linha", () => {
    expect(ler("src/app/api/admin/financas/route.ts")).toContain("canaisDosPedidosPagos()");
    const ecra = ler("src/components/admin/financas/ResumoDasFinancas.tsx");
    expect(ecra).toContain("<PorCanal c={c} canais={dados.canais ?? null} />");
    expect(ecra).toContain("Trabalhos pagos por canal");
    expect(ler("src/components/admin/financas/GestoraDeContas.tsx")).toContain("canais: dados.canais");
  });
});

describe("(d) «Respondeu» conta a primeira proposta", () => {
  it("uma proposta do profissional numa negociação que nasceu vazia conta", () => {
    const uma = JSON.stringify([{ por: "profissional", valor: 40, estado: "pendente", criadaEm: "2026-11-12T10:00:00Z" }]);
    expect(profissionalRespondeu(uma, "aberta")).toBe(true);
  });

  it("aceitar o valor que lhe puseram conta; nada, ou só a oferta por responder, não", () => {
    const oferta = (estado: string) => JSON.stringify([{ por: "cliente", valor: 60, estado, criadaEm: "2026-11-12T10:00:00Z" }]);
    expect(profissionalRespondeu(oferta("aceite"), "aberta")).toBe(true);
    expect(profissionalRespondeu(oferta("pendente"), "aguarda_contratacao")).toBe(true);
    expect(profissionalRespondeu(oferta("pendente"), "aberta")).toBe(false);
    expect(profissionalRespondeu("[]", "aberta")).toBe(false);
    expect(profissionalRespondeu("{", "aberta")).toBe(false);
  });

  it("a actividade dos profissionais conta por esta regra, e não pelo JSON_LENGTH > 1", () => {
    const db = ler("src/lib/db.ts");
    const i = db.indexOf("export async function actividadeDosProfissionais(");
    expect(i).toBeGreaterThan(-1);
    const corpo = db.slice(i, db.indexOf("\n}\n", i));
    expect(corpo).toContain("profissionalRespondeu(r.propostasJson, r.estado)");
    expect(corpo).not.toMatch(/SUM\(JSON_LENGTH/);
  });
});

describe("(e) o «Por aprovar» do Início é o do separador dos Profissionais", () => {
  it("as duas contagens usam a mesma condição, sem as contas da CLYON", () => {
    expect(ONDE_POR_APROVAR.startsWith(ONDE_PROFISSIONAIS_DO_PAINEL)).toBe(true);
    expect(ONDE_POR_APROVAR).toContain("isClyon = 0");
    expect(ONDE_POR_APROVAR).toContain("estado = 'pendente'");
    expect(ler("src/lib/db.ts")).toContain("FROM providers WHERE ${ONDE_POR_APROVAR}");
    expect(ler("src/app/api/admin/profissionais/route.ts")).toContain("WHERE ${ONDE_PROFISSIONAIS_DO_PAINEL}");
  });
});
