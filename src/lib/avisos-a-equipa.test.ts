import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  anunciarAEntrega,
  avisoDaEntrega,
  avisosDoNossoLado,
  correrOsAvisosDaEquipa,
  emHorarioDaEquipa,
  eUmaEsperaNova,
  type AvisoAEquipa,
  type DependenciasDosAvisos,
} from "./avisos-a-equipa";
import { recebeOAviso } from "./avisos-a-equipa-na-base";
import type { LinhaDoNossoLado } from "./do-nosso-lado";
import { naMesa, deixouAnotadoParaUmaPessoa, type FactosDaConversa } from "./mesa-das-conversas";
import { PERGUNTA_ANOTADA } from "./voz-da-vitoria";

/**
 * OS AVISOS À EQUIPA — d23, 10-11-2026. *«A equipa passa a ser avisada do que
 * está parado. Hoje não há aviso nenhum.»* Os critérios da ordem, um a um.
 *
 * As horas escrevem-se em UTC com o fuso de Lisboa à vista: a 10 de Novembro
 * Lisboa está em UTC+0, e esta máquina não está em Lisboa (os testes não
 * podem depender do relógio dela).
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/** Uma loja em memória, com a mesma regra da tabela: a mesma espera não avisa duas vezes. */
function loja(dados: { doNossoLado?: LinhaDoNossoLado[]; porDecidir?: { id: number; criadoEm: Date | null }[] } = {}) {
  const guardados = new Map<string, { desde: Date; enviado: boolean; aviso: AvisoAEquipa; como?: string }>();
  const enviados: AvisoAEquipa[] = [];
  const entregues = new Set<string>();
  const deps: DependenciasDosAvisos = {
    lerDoNossoLado: async () => dados.doNossoLado ?? [],
    lerPorDecidir: async () => dados.porDecidir ?? [],
    reservar: async (a, enviado) => {
      const g = guardados.get(a.chave);
      if (g && !eUmaEsperaNova(g.desde, a.desde)) return false;
      guardados.set(a.chave, { desde: a.desde, enviado, aviso: a });
      return true;
    },
    entregasPorEnviar: async () =>
      [...guardados.values()].filter((g) => g.aviso.tipo === "entregue" && !g.enviado && !g.como).map((g) => g.aviso),
    aindaEntregue: async (t) => entregues.has(t),
    marcarEnviado: async (chave, como) => {
      const g = guardados.get(chave);
      if (g) {
        g.enviado = como === "enviado";
        g.como = como;
      }
    },
    enviar: async (a) => {
      enviados.push(a);
      return 1;
    },
  };
  return { deps, enviados, guardados, entregues };
}

const linha = (esperaS: number, pedidoId = 512): LinhaDoNossoLado => ({
  tipo: "propostas",
  pedidoId,
  telefone: null,
  esperaS,
  oQue: "1 proposta de parceiros por enviar ao cliente",
});

describe("o horário: 08h–21h em Lisboa", () => {
  it("às 22h não, às 08h sim — pela hora de Lisboa, também no Verão", () => {
    expect(emHorarioDaEquipa(new Date("2026-11-10T22:00:00Z"))).toBe(false);
    expect(emHorarioDaEquipa(new Date("2026-11-11T07:59:00Z"))).toBe(false);
    expect(emHorarioDaEquipa(new Date("2026-11-11T08:00:00Z"))).toBe(true);
    expect(emHorarioDaEquipa(new Date("2026-11-10T20:59:00Z"))).toBe(true);
    expect(emHorarioDaEquipa(new Date("2026-11-10T21:00:00Z"))).toBe(false);
    // Em Julho, Lisboa é UTC+1: 07:30 UTC já são 08:30 lá.
    expect(emHorarioDaEquipa(new Date("2026-07-10T07:30:00Z"))).toBe(true);
    expect(emHorarioDaEquipa(new Date("2026-07-10T20:30:00Z"))).toBe(false);
  });
});

describe("o «Do nosso lado» há mais de 2 h", () => {
  it("um pedido há 2h01 gera um aviso, uma vez", async () => {
    const agora = new Date("2026-11-10T15:00:00Z");
    const l = loja({ doNossoLado: [linha(2 * 3600 + 60)] });
    const r1 = await correrOsAvisosDaEquipa(l.deps, agora);
    expect(r1.enviados).toBe(1);
    expect(l.enviados[0].pedidoId).toBe(512);
    expect(l.enviados[0].corpo).toContain("Pedido #512");
    expect(l.enviados[0].seccao).toBe("mesa");

    // Dez minutos depois, a mesma espera (esperaS cresceu dez minutos): nada.
    const l2 = { ...l.deps, lerDoNossoLado: async () => [linha(2 * 3600 + 60 + 600)] };
    const r2 = await correrOsAvisosDaEquipa(l2, new Date(agora.getTime() + 600_000));
    expect(r2.enviados).toBe(0);
    expect(l.enviados).toHaveLength(1);
  });

  it("há 1h59 ainda não avisa", async () => {
    const l = loja({ doNossoLado: [linha(2 * 3600 - 60)] });
    const r = await correrOsAvisosDaEquipa(l.deps, new Date("2026-11-10T15:00:00Z"));
    expect(r.enviados).toBe(0);
  });

  it("uma espera nova do mesmo pedido (começou depois) volta a avisar", async () => {
    const agora = new Date("2026-11-10T15:00:00Z");
    const l = loja({ doNossoLado: [linha(3 * 3600)] });
    await correrOsAvisosDaEquipa(l.deps, agora);
    const depois = new Date(agora.getTime() + 5 * 3600_000);
    await correrOsAvisosDaEquipa({ ...l.deps, lerDoNossoLado: async () => [linha(2 * 3600 + 120)] }, depois);
    expect(l.enviados).toHaveLength(2);
  });

  it("as conversas vão à equipa do WhatsApp, e sem o telefone no endereço", () => {
    const [a] = avisosDoNossoLado(
      [{ tipo: "conversa", pedidoId: null, telefone: "912345678", esperaS: 3 * 3600, oQue: "o cliente escreveu e ninguém respondeu (sem pedido)" }],
      new Date("2026-11-10T15:00:00Z"),
    );
    expect(a.seccao).toBe("whatsapp");
    expect(a.url).toBe("/admin?section=whatsapp");
    expect(a.url).not.toContain("912");
  });

  it("a conta é a do cartão da Mesa (d14), não uma nova", () => {
    const BASE = ler("src/lib/avisos-a-equipa-na-base.ts");
    expect(BASE).toContain("doNossoLado({");
    expect(BASE).toContain("db.pedidosComNegociacoes(60)");
    expect(BASE).toContain("mesaComOTelemovelWhatsApp()");
    expect(BASE).toContain("db.pedidosPorPromover(100)");
  });
});

describe("o «Por decidir» há mais de 1 h", () => {
  it("avisa uma vez o que não foi a ninguém há mais de uma hora", async () => {
    const agora = new Date("2026-11-10T15:00:00Z");
    const l = loja({
      porDecidir: [
        { id: 601, criadoEm: new Date(agora.getTime() - 61 * 60_000) },
        { id: 602, criadoEm: new Date(agora.getTime() - 30 * 60_000) },
      ],
    });
    const r = await correrOsAvisosDaEquipa(l.deps, agora);
    expect(r.acimaDosPrazos).toBe(1);
    expect(l.enviados.map((a) => a.pedidoId)).toEqual([601]);
    expect((await correrOsAvisosDaEquipa(l.deps, new Date(agora.getTime() + 600_000))).enviados).toBe(0);
  });
});

describe("fora de horas não sai nada, e às 08h sai", () => {
  it("às 22h de Lisboa nada; às 08h o que continua parado avisa", async () => {
    const l = loja({ doNossoLado: [linha(5 * 3600)] });
    const noite = await correrOsAvisosDaEquipa(l.deps, new Date("2026-11-10T22:00:00Z"));
    expect(noite.emHorario).toBe(false);
    expect(l.enviados).toHaveLength(0);
    const manha = await correrOsAvisosDaEquipa(l.deps, new Date("2026-11-11T08:00:00Z"));
    expect(manha.enviados).toBe(1);
  });

  it("uma entrega às 22h fica guardada e sai às 08h — se ainda estiver entregue", async () => {
    const l = loja();
    const noite = new Date("2026-11-10T22:00:00Z");
    l.entregues.add("912345678");
    const r = await anunciarAEntrega(l.deps, avisoDaEntrega({ telefone: "912345678", pedidoId: 700, motivo: "Pediu para falar com uma pessoa", agora: noite }), noite);
    expect(r).toBe("guardado");
    expect(l.enviados).toHaveLength(0);
    const manha = await correrOsAvisosDaEquipa(l.deps, new Date("2026-11-11T08:00:00Z"));
    expect(manha.entregasEnviadas).toBe(1);
    expect(l.enviados[0].corpo).toContain("Pedido #700");
    // E não volta a sair.
    expect((await correrOsAvisosDaEquipa(l.deps, new Date("2026-11-11T08:10:00Z"))).entregasEnviadas).toBe(0);
  });

  it("uma entrega já devolvida de madrugada não se anuncia", async () => {
    const l = loja();
    const noite = new Date("2026-11-10T23:00:00Z");
    await anunciarAEntrega(l.deps, avisoDaEntrega({ telefone: "912345678", pedidoId: null, motivo: null, agora: noite }), noite);
    const manha = await correrOsAvisosDaEquipa(l.deps, new Date("2026-11-11T08:00:00Z"));
    expect(manha.entregasEnviadas).toBe(0);
  });
});

describe("a entrega a uma pessoa gera um push", () => {
  it("em horário, sai logo, com o n.º do pedido ou o contacto", async () => {
    const l = loja();
    const agora = new Date("2026-11-10T15:00:00Z");
    expect(await anunciarAEntrega(l.deps, avisoDaEntrega({ telefone: "912345678", pedidoId: 700, motivo: "Não sei responder", agora }), agora)).toBe("enviado");
    expect(await anunciarAEntrega(l.deps, avisoDaEntrega({ telefone: "+351 935 000 111", pedidoId: null, motivo: null, agora }), agora)).toBe("enviado");
    expect(l.enviados).toHaveLength(2);
    expect(l.enviados[0].corpo).toContain("Pedido #700");
    expect(l.enviados[1].corpo).toContain("935 000 111");
    expect(l.enviados.every((a) => a.seccao === "whatsapp")).toBe(true);
  });

  it("todas as portas da Vitória avisam; as de uma pessoa não", () => {
    const DB = ler("src/lib/db.ts");
    const corpo = DB.slice(DB.indexOf("export async function interromperNumeroWhatsApp("));
    const fim = corpo.indexOf("\n}\n");
    const fn = corpo.slice(0, fim);
    expect(fn).toContain('quem: "vitoria" | "pessoa" = "vitoria"');
    expect(fn).toContain('if (quem === "vitoria" && !jaEstava)');
    expect(fn).toContain("avisarAEquipaDaEntrega(");
    // As três portas de uma pessoa dizem-no.
    expect(ler("src/app/api/whatsapp/ponte/route.ts")).toContain('"Respondeu à mão no WhatsApp", "pessoa")');
    expect(ler("src/app/api/admin/whatsapp/route.ts")).toContain('nota ?? "Pelo backoffice", "pessoa")');
    expect(DB).toContain('"Fecho desfeito - fale com o cliente", "pessoa")');
  });
});

describe("«Deixo anotado» marca a conversa como à espera de nós", () => {
  const base: FactosDaConversa = {
    telefone: "912345678",
    entregue: false,
    bloqueada: false,
    ultimaEntrada: { id: 1, direccao: "in", texto: "Vocês também vendem?", haSegundos: 3 * 3600 + 60, quando: "" },
    ultimaSaida: { id: 2, direccao: "out", texto: PERGUNTA_ANOTADA, haSegundos: 3 * 3600, quando: "" },
    fecho: null,
    recolha: null,
    pedidoVivo: null,
    ultimoPedido: null,
    guardada: null,
  } as unknown as FactosDaConversa;

  it("a frase da Vitória tem a marca", () => {
    expect(deixouAnotadoParaUmaPessoa(PERGUNTA_ANOTADA)).toBe(true);
    expect(deixouAnotadoParaUmaPessoa("Obrigada, fica anotado.")).toBe(false);
  });

  it("vai para «Por responder», e entra no «Do nosso lado» passadas 2 h", () => {
    const l = naMesa(base);
    expect(l.estado).toBe("por_responder");
    expect(l.porque).toContain("anotada para uma pessoa");
  });

  it("um «Já respondi» depois dela tira-a de lá", () => {
    const l = naMesa({ ...base, respondida: { haSegundos: 600, quando: "" } } as FactosDaConversa);
    expect(l.estado).not.toBe("por_responder");
  });
});

describe("quem recebe", () => {
  it("o administrador tudo; a assistente só a secção que tem; desactivada nada", () => {
    const admin = { id: 1, isAdmin: 1, funcao: "admin", active: 1, seccoesJson: null };
    const mesa = { id: 2, isAdmin: 0, funcao: "assistente", active: 1, seccoesJson: JSON.stringify(["negociacoes_clyon"]) };
    const wpp = { id: 3, isAdmin: 0, funcao: "assistente", active: 1, seccoesJson: JSON.stringify(["whatsapp"]) };
    expect(recebeOAviso(admin, "mesa") && recebeOAviso(admin, "whatsapp")).toBe(true);
    expect(recebeOAviso(mesa, "mesa")).toBe(true);
    expect(recebeOAviso(mesa, "whatsapp")).toBe(false);
    expect(recebeOAviso(wpp, "whatsapp")).toBe(true);
    expect(recebeOAviso(wpp, "mesa")).toBe(false);
    expect(recebeOAviso({ ...admin, active: 0 }, "mesa")).toBe(false);
  });

  it("só para dentro: a passagem não fala com clientes nem com profissionais", () => {
    const BASE = ler("src/lib/avisos-a-equipa-na-base.ts");
    expect(BASE).not.toContain("enviarTextoWhatsApp");
    expect(BASE).not.toMatch(/enviarEmail|sendEmail/);
    // A subscrição da equipa nunca é a de um email.
    expect(BASE).toContain("`equipa:${colabId}`");
  });

  it("a passagem corre no cron do assistente, sem cron novo na Vercel", () => {
    expect(ler("src/app/api/cron/assistente/route.ts")).toContain("correrOsAvisosDaEquipaNaBase()");
    expect(ler("vercel.json")).not.toContain("avisos");
  });
});
