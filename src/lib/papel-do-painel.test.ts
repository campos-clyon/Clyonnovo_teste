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
  assistenteComSeccoesPodeChamar,
  normalizarSeccoes,
  seccoesQueAbrem,
  SECCOES_DAS_CONTAS_ANTIGAS,
} from "./papel-do-painel";

describe("secções", () => {
  it("pode dar-se ao assistente todo o menu menos «Assistentes»", () => {
    /*
     * 03-10-2026, decisão do dono. Eram seis (pedidos, profissionais,
     * negociações, agenda, WhatsApp e, desde 21-09-2026, suporte). A lista
     * fica escrita à mão de propósito — quem acrescenta uma secção ao
     * assistente tem de vir cá dizer que o fez, porque é uma porta que se
     * abre. Que é igual ao menu, confirma-o seccoes-do-assistente.test.ts.
     */
    expect([...SECCOES_DO_ASSISTENTE]).toEqual([
      "overview", "pedidos", "app_clyon", "profissionais", "negociacoes_clyon",
      "trabalhos_clyon", "agenda", "whatsapp", "carteiras", "pagamentos",
      "levantamentos", "leads", "contas", "suporte", "configs",
    ]);
  });

  it("nunca a gestão de assistentes, nem os ids antigos, nem o que não é do menu", () => {
    for (const s of ["equipa", "site", "negociacoes", "testadores"]) {
      expect(assistentePodeVerSeccao(s), s).toBe(false);
    }
  });

  it("as contas antigas (NULL) ficam com as seis de sempre", () => {
    expect([...SECCOES_DAS_CONTAS_ANTIGAS].sort()).toEqual(
      ["agenda", "negociacoes_clyon", "pedidos", "profissionais", "whatsapp", "suporte"].sort(),
    );
  });

  it("o administrador vê tudo", () => {
    expect(papelPodeVerSeccao("admin", "configs")).toBe(true);
    expect(papelPodeVerSeccao("admin", "equipa")).toBe(true);
    expect(papelPodeVerSeccao("assistente", "configs")).toBe(true);
    expect(papelPodeVerSeccao("assistente", "equipa")).toBe(false);
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
  it("passa o que as secções precisam", () => {
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
      ["GET", "/api/admin/sessao/eu"],
      // O suporte, desde 21-09-2026 — a secção existia e as rotas davam 403.
      ["GET", "/api/admin/suporte"],
      ["GET", "/api/admin/suporte/conversas"],
      ["POST", "/api/admin/suporte/conversas"],
      ["PATCH", "/api/admin/suporte/7"],
      ["POST", "/api/admin/suporte/7/mensagens"],
      // As secções que se podem dar desde 03-10-2026.
      ["GET", "/api/admin/resumo"],
      ["GET", "/api/admin/app-clyon/visao-geral"],
      ["POST", "/api/admin/app-pedidos/x/advance"],
      ["GET", "/api/admin/trabalhos-clyon"],
      ["GET", "/api/admin/carteiras"],
      ["POST", "/api/admin/carteiras"],
      ["GET", "/api/admin/pagamentos"],
      ["POST", "/api/admin/pagamentos/recebido"],
      ["POST", "/api/admin/pagamentos/pago-ao-profissional"],
      ["GET", "/api/admin/levantamentos"],
      ["POST", "/api/admin/levantamentos"],
      ["GET", "/api/admin/leads"],
      ["PATCH", "/api/admin/leads"],
      ["GET", "/api/admin/lead-events"],
      ["GET", "/api/admin/users"],
      ["PATCH", "/api/admin/users"],
      ["GET", "/api/admin/ajuda"],
      ["GET", "/api/admin/taxas"],
      ["PUT", "/api/admin/taxas"],
      ["GET", "/api/admin/retencao"],
      ["GET", "/api/admin/arquivo/3"],
      ["GET", "/api/media/gallery"],
      ["PUT", "/api/media/gallery/3"],
    ];
    for (const [m, p] of permitidas) {
      expect(assistentePodeChamar(p, m), `${m} ${p}`).toBe(true);
    }
  });

  it("a secção do suporte abre as rotas do suporte, e só a quem a tem", () => {
    expect(assistenteComSeccoesPodeChamar(["suporte"], "/api/admin/suporte/conversas", "GET")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(["pedidos"], "/api/admin/suporte/conversas", "GET")).toBe(false);
    // E apagar conversas continua a ser do administrador.
    expect(assistenteComSeccoesPodeChamar(["suporte"], "/api/admin/suporte/conversas", "DELETE")).toBe(false);
  });

  it("recusa o que é do administrador", () => {
    /*
     * 03-10-2026: leads, contas, carteiras e levantamentos saíram desta lista
     * — passaram a secções que o administrador pode dar. O que fica aqui não
     * se dá a ninguém.
     */
    const fechadas: Array<[string, string]> = [
      ["GET", "/api/admin/testadores"],
      ["POST", "/api/admin/pagamentos/criar"],
      ["POST", "/api/admin/pagamentos/conferir"],
      ["POST", "/api/admin/pagamentos/excluir"],
      ["POST", "/api/admin/pagamentos/testar"],
      ["GET", "/api/admin/livro"],
      ["POST", "/api/admin/livro"],
      ["GET", "/api/admin/assistentes"],
      ["POST", "/api/admin/assistentes"],
      ["GET", "/api/admin/metricas"],
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
    expect(papelPodeChamar("assistente", "/api/admin/users", "DELETE")).toBe(false);
    expect(papelPodeChamar("assistente", "/api/admin/assistentes", "GET")).toBe(false);
  });

  it("a verificação de papel só se aplica às rotas do painel", () => {
    expect(rotaDeApiDoPainel("/api/admin/pedidos")).toBe(true);
    expect(rotaDeApiDoPainel("/api/colaboradores/login")).toBe(true);
    expect(rotaDeApiDoPainel("/api/maps/distance")).toBe(false);
    expect(rotaDeApiDoPainel("/api/simulator/analyze")).toBe(false);
    expect(rotaDeApiDoPainel("/api/administracao")).toBe(false);
  });
});

describe("secções por assistente", () => {
  it("normaliza a lista: só o que existe, na ordem do menu, e vazio quer dizer NENHUMA", () => {
    // Vazio queria dizer «todas» até 03-10-2026. Com o menu inteiro na lista,
    // um esquecimento não pode dar carteiras e configurações.
    expect(normalizarSeccoes(["whatsapp", "pedidos", "inventada", "pedidos"])).toEqual(["pedidos", "whatsapp"]);
    expect(normalizarSeccoes([])).toEqual([]);
    expect(normalizarSeccoes(null)).toEqual([]);
    expect(normalizarSeccoes(["leads"])).toEqual(["leads"]);
    expect(normalizarSeccoes(["configs", "equipa", "overview"])).toEqual(["overview", "configs"]);
  });

  it("diz que secções abrem cada rota", () => {
    expect(seccoesQueAbrem("/api/admin/agenda")).toEqual(["agenda"]);
    expect(seccoesQueAbrem("/api/admin/whatsapp")).toEqual(["whatsapp"]);
    expect(seccoesQueAbrem("/api/admin/suporte")).toEqual(["suporte"]);
    expect(seccoesQueAbrem("/api/admin/convites")).toEqual(["profissionais"]);
    expect(seccoesQueAbrem("/api/admin/negociacoes/agir")).toEqual(["negociacoes_clyon"]);
    expect(seccoesQueAbrem("/api/admin/negociacoes/valor")).toEqual(["negociacoes_clyon", "agenda", "carteiras", "pagamentos"]);
    expect(seccoesQueAbrem("/api/admin/pedidos/3")).toEqual(["pedidos", "negociacoes_clyon", "agenda", "trabalhos_clyon"]);
    expect(seccoesQueAbrem("/api/admin/pedidos/3/accept")).toEqual(["pedidos", "negociacoes_clyon", "agenda"]);
    expect(seccoesQueAbrem("/api/admin/profissionais")).toEqual(["profissionais", "trabalhos_clyon"]);
    expect(seccoesQueAbrem("/api/admin/profissionais/3")).toEqual(["profissionais"]);
    expect(seccoesQueAbrem("/api/admin/pagamentos")).toEqual(["pagamentos"]);
    expect(seccoesQueAbrem("/api/admin/taxas")).toEqual(["configs"]);
    expect(seccoesQueAbrem("/api/media/gallery/9")).toEqual(["configs"]);
    // A sessão não é de secção nenhuma: é de todos (ver rotaDeTodosOsAssistentes).
    expect(seccoesQueAbrem("/api/admin/sessao/eu")).toEqual([]);
    // E o que não tem entrada fica fechado — desde 03-10-2026.
    expect(seccoesQueAbrem("/api/admin/pagamentos/criar")).toEqual([]);
  });

  it("um assistente só com agenda agenda, corrige valores e abre pedidos, mas não fala no WhatsApp", () => {
    const so = ["agenda"];
    expect(assistenteComSeccoesPodeChamar(so, "/api/admin/agenda", "POST")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(so, "/api/admin/negociacoes/valor", "POST")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(so, "/api/admin/pedidos/9", "GET")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(so, "/api/admin/whatsapp", "GET")).toBe(false);
    expect(assistenteComSeccoesPodeChamar(so, "/api/admin/negociacoes", "GET")).toBe(false);
    expect(assistenteComSeccoesPodeChamar(so, "/api/admin/profissionais", "GET")).toBe(false);
    expect(assistenteComSeccoesPodeChamar(so, "/api/admin/sessao/eu", "GET")).toBe(true);
  });

  it("as secções nunca abrem o que o papel fecha", () => {
    const todas = [...SECCOES_DO_ASSISTENTE];
    expect(assistenteComSeccoesPodeChamar(todas, "/api/admin/pedidos/9", "DELETE")).toBe(false);
    expect(assistenteComSeccoesPodeChamar(todas, "/api/admin/negociacoes/apagar", "POST")).toBe(false);
    expect(assistenteComSeccoesPodeChamar(todas, "/api/admin/assistentes", "GET")).toBe(false);
    expect(assistenteComSeccoesPodeChamar(todas, "/api/admin/users", "DELETE")).toBe(false);
    expect(assistenteComSeccoesPodeChamar(todas, "/api/media/gallery/3", "DELETE")).toBe(false);
    expect(assistenteComSeccoesPodeChamar(todas, "/api/admin/pagamentos/excluir", "POST")).toBe(false);
  });

  it("uma secção nova não abre as outras", () => {
    expect(assistenteComSeccoesPodeChamar(["carteiras"], "/api/admin/carteiras", "POST")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(["carteiras"], "/api/admin/levantamentos", "POST")).toBe(false);
    expect(assistenteComSeccoesPodeChamar(["carteiras"], "/api/admin/pagamentos", "GET")).toBe(false);
    expect(assistenteComSeccoesPodeChamar(["configs"], "/api/admin/taxas", "PUT")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(["leads"], "/api/admin/taxas", "PUT")).toBe(false);
    expect(assistenteComSeccoesPodeChamar(["trabalhos_clyon"], "/api/admin/profissionais", "GET")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(["trabalhos_clyon"], "/api/admin/profissionais/3", "PATCH")).toBe(false);
  });

  it("as seis de sempre (uma conta antiga com NULL) não chegam às secções novas", () => {
    const antigas = [...SECCOES_DAS_CONTAS_ANTIGAS];
    for (const p of ["/api/admin/carteiras", "/api/admin/pagamentos", "/api/admin/levantamentos", "/api/admin/leads", "/api/admin/users", "/api/admin/taxas", "/api/admin/resumo", "/api/admin/app-clyon/creditos", "/api/media/gallery", "/api/admin/trabalhos-clyon"]) {
      expect(assistenteComSeccoesPodeChamar(antigas, p, "GET"), p).toBe(false);
    }
    expect(assistenteComSeccoesPodeChamar(antigas, "/api/admin/pedidos", "GET")).toBe(true);
  });
});
