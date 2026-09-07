/**
 * O contrato do assistente, escrito como teste.
 *
 * Se alguém alargar ou estreitar o que o assistente pode fazer, é aqui que
 * tem de o dizer primeiro — o middleware, o helper das rotas e o painel lêem
 * todos a mesma lista.
 */

import { describe, it, expect } from "vitest";
import {
  assistentePodeAbrirPagina,
  assistentePodeChamar,
  assistentePodeVerSeccao,
  paginaInicialDoPapel,
  papelPodeChamar,
  papelPodeVerSeccao,
  rotaDeApiDoPainel,
  SECCOES_DO_ASSISTENTE,
} from "./papel-do-painel";

describe("secções", () => {
  it("o assistente vê exactamente pedidos, profissionais, negociações, agenda e WhatsApp", () => {
    expect([...SECCOES_DO_ASSISTENTE].sort()).toEqual(
      ["agenda", "negociacoes_clyon", "pedidos", "profissionais", "whatsapp"].sort(),
    );
  });

  it("não vê leads, contas, suporte, configs, carteiras, levantamentos, testadores nem equipa", () => {
    for (const s of ["overview", "leads", "contas", "suporte", "configs", "site", "carteiras", "levantamentos", "testadores", "equipa", "app_clyon", "negociacoes"]) {
      expect(assistentePodeVerSeccao(s)).toBe(false);
    }
  });

  it("o administrador vê tudo", () => {
    expect(papelPodeVerSeccao("admin", "configs")).toBe(true);
    expect(papelPodeVerSeccao("assistente", "configs")).toBe(false);
    expect(papelPodeVerSeccao("assistente", "agenda")).toBe(true);
  });
});

describe("páginas", () => {
  it("o assistente só abre o painel dele e o login", () => {
    expect(assistentePodeAbrirPagina("/admin/assistente")).toBe(true);
    expect(assistentePodeAbrirPagina("/admin/assistente/")).toBe(true);
    expect(assistentePodeAbrirPagina("/admin/login")).toBe(true);
    expect(assistentePodeAbrirPagina("/admin")).toBe(false);
    expect(assistentePodeAbrirPagina("/admin/app-clyon/pedidos")).toBe(false);
    expect(assistentePodeAbrirPagina("/admin/imagens")).toBe(false);
    expect(assistentePodeAbrirPagina("/admin/assistentes")).toBe(false);
  });

  it("cada papel tem a sua página inicial", () => {
    expect(paginaInicialDoPapel("admin")).toBe("/admin");
    expect(paginaInicialDoPapel("assistente")).toBe("/admin/assistente");
  });
});

describe("chamadas de API", () => {
  it("passa o que as cinco secções precisam", () => {
    const permitidas: Array<[string, string]> = [
      ["GET", "/api/admin/pedidos"],
      ["GET", "/api/admin/pedidos/12"],
      ["PATCH", "/api/admin/pedidos/12"],
      ["POST", "/api/admin/pedidos/12/accept"],
      ["POST", "/api/admin/pedidos/12/reject"],
      ["POST", "/api/admin/pedidos/12/calendar"],
      ["GET", "/api/admin/pedidos/12/calendar/preview"],
      ["POST", "/api/admin/pedidos/criar"],
      ["POST", "/api/admin/pedidos/approve"],
      ["GET", "/api/admin/profissionais"],
      ["PATCH", "/api/admin/profissionais/3"],
      ["GET", "/api/admin/convites"],
      ["POST", "/api/admin/convites"],
      ["GET", "/api/admin/negociacoes"],
      ["POST", "/api/admin/negociacoes/agir"],
      ["POST", "/api/admin/negociacoes/promover"],
      ["POST", "/api/admin/negociacoes/valor"],
      ["GET", "/api/admin/negociacoes/alcance"],
      ["GET", "/api/admin/agenda"],
      ["POST", "/api/admin/agenda"],
      ["GET", "/api/admin/whatsapp"],
      ["POST", "/api/admin/whatsapp"],
      ["GET", "/api/admin/fotos"],
      ["POST", "/api/admin/sessao/sair"],
    ];
    for (const [m, p] of permitidas) {
      expect(assistentePodeChamar(p, m), `${m} ${p}`).toBe(true);
    }
  });

  it("recusa o que é do administrador", () => {
    const fechadas: Array<[string, string]> = [
      ["GET", "/api/admin/leads"],
      ["GET", "/api/admin/lead-events"],
      ["GET", "/api/admin/users"],
      ["GET", "/api/admin/suporte"],
      ["GET", "/api/admin/carteiras"],
      ["GET", "/api/admin/levantamentos"],
      ["GET", "/api/admin/testadores"],
      ["GET", "/api/admin/assistentes"],
      ["POST", "/api/admin/assistentes"],
      ["GET", "/api/admin/metricas"],
      ["GET", "/api/admin/app-clyon/pedidos"],
      ["POST", "/api/admin/settings/reseed"],
      ["POST", "/api/admin/seguranca/alterar-senha"],
      ["GET", "/api/colaboradores/admin/settings/simulador"],
      ["PUT", "/api/colaboradores/admin/settings/simulador"],
      ["GET", "/api/admin/pedidosx"],
      ["GET", "/api/admin/agendamentos"],
    ];
    for (const [m, p] of fechadas) {
      expect(assistentePodeChamar(p, m), `${m} ${p}`).toBe(false);
    }
  });

  it("nunca apaga", () => {
    expect(assistentePodeChamar("/api/admin/pedidos/12", "DELETE")).toBe(false);
    expect(assistentePodeChamar("/api/admin/profissionais/3", "DELETE")).toBe(false);
    expect(assistentePodeChamar("/api/admin/negociacoes/apagar", "POST")).toBe(false);
    expect(assistentePodeChamar("/api/admin/negociacoes/apagar/", "POST")).toBe(false);
  });

  it("o método não distingue maiúsculas", () => {
    expect(assistentePodeChamar("/api/admin/pedidos", "get")).toBe(true);
    expect(assistentePodeChamar("/api/admin/pedidos/1", "delete")).toBe(false);
  });

  it("o administrador chama tudo", () => {
    expect(papelPodeChamar("admin", "/api/admin/users", "DELETE")).toBe(true);
    expect(papelPodeChamar("assistente", "/api/admin/users", "GET")).toBe(false);
  });

  it("a verificação de papel só se aplica às rotas do painel", () => {
    expect(rotaDeApiDoPainel("/api/admin/pedidos")).toBe(true);
    expect(rotaDeApiDoPainel("/api/colaboradores/login")).toBe(true);
    expect(rotaDeApiDoPainel("/api/maps/distance")).toBe(false);
    expect(rotaDeApiDoPainel("/api/simulator/analyze")).toBe(false);
    expect(rotaDeApiDoPainel("/api/administracao")).toBe(false);
  });
});
