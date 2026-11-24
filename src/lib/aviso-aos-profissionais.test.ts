import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  blocosDoTexto,
  comONome,
  contarDestinatarios,
  corpoEmHtml,
  dentroDaJanelaDoWhatsApp,
  eDestinatarioDoAviso,
  intervaloAoAcaso,
  ligaAoSaberMais,
  rascunhoDoAviso,
  telemovelDoAviso,
  validarConteudo,
  type Canal,
  type ProfissionalParaOAviso,
} from "./aviso-aos-profissionais";
import {
  avancarOAviso,
  type ContactoNoMomento,
  type PortasDoAviso,
  type RepositorioDoAviso,
} from "./aviso-aos-profissionais-motor";

/*
 * O AVISO A TODOS OS PROFISSIONAIS — d11 (15-11-2026): quem recebe, a janela
 * das 9h às 20h de Lisboa, o intervalo de 20–45 s, uma vez por canal, e «Parar».
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const pro = (o: Partial<ProfissionalParaOAviso> & { id: number }): ProfissionalParaOAviso => ({
  nome: "Ana Silva",
  email: "ana@exemplo.pt",
  telefone: "912345678",
  estado: "aprovado",
  isActive: 1,
  isClyon: 0,
  contaDeTeste: 0,
  ...o,
});

describe("quem recebe o aviso", () => {
  it("só aprovados e activos, sem contas de teste nem a conta da casa", () => {
    expect(eDestinatarioDoAviso(pro({ id: 1 }))).toBe(true);
    expect(eDestinatarioDoAviso(pro({ id: 2, estado: "pendente" }))).toBe(false);
    expect(eDestinatarioDoAviso(pro({ id: 3, estado: "suspenso" }))).toBe(false);
    expect(eDestinatarioDoAviso(pro({ id: 4, isActive: 0 }))).toBe(false);
    expect(eDestinatarioDoAviso(pro({ id: 5, contaDeTeste: 1 }))).toBe(false);
    expect(eDestinatarioDoAviso(pro({ id: 6, nome: "Fred Teste" }))).toBe(false);
    expect(eDestinatarioDoAviso(pro({ id: 7, isClyon: 1 }))).toBe(false);
  });

  it("conta por canal: email válido e telemóvel português (nunca um fixo)", () => {
    const c = contarDestinatarios([
      pro({ id: 10 }),
      pro({ id: 11, email: null }),
      pro({ id: 12, telefone: "213456789" }),
      pro({ id: 13, email: "sem-arroba", telefone: null }),
      pro({ id: 14, nome: "Conta de teste" }),
    ]);
    expect(c).toEqual({ total: 4, comEmail: 2, comWhatsApp: 2, semContacto: 1, ids: [10, 11, 12, 13] });
    expect(telemovelDoAviso("+351 912 345 678")).toBe("351912345678");
    expect(telemovelDoAviso("00351912345678")).toBe("351912345678");
    expect(telemovelDoAviso("213456789")).toBeNull();
  });
});

describe("a janela do WhatsApp: das 9h às 20h de Lisboa", () => {
  it("no Inverno (Lisboa = UTC)", () => {
    expect(dentroDaJanelaDoWhatsApp(new Date("2026-11-15T08:59:00Z"))).toBe(false);
    expect(dentroDaJanelaDoWhatsApp(new Date("2026-11-15T09:00:00Z"))).toBe(true);
    expect(dentroDaJanelaDoWhatsApp(new Date("2026-11-15T19:59:00Z"))).toBe(true);
    expect(dentroDaJanelaDoWhatsApp(new Date("2026-11-15T20:00:00Z"))).toBe(false);
  });
  it("no Verão (Lisboa = UTC+1), seja qual for o fuso desta máquina", () => {
    expect(dentroDaJanelaDoWhatsApp(new Date("2026-07-01T07:59:00Z"))).toBe(false);
    expect(dentroDaJanelaDoWhatsApp(new Date("2026-07-01T08:00:00Z"))).toBe(true);
    expect(dentroDaJanelaDoWhatsApp(new Date("2026-07-01T18:59:00Z"))).toBe(true);
    expect(dentroDaJanelaDoWhatsApp(new Date("2026-07-01T19:00:00Z"))).toBe(false);
  });
});

describe("o intervalo entre WhatsApp: 20 a 45 s ao acaso", () => {
  it("fica sempre dentro dos limites", () => {
    expect(intervaloAoAcaso(0)).toBe(20);
    expect(intervaloAoAcaso(0.999999)).toBe(45);
    expect(intervaloAoAcaso(1)).toBe(45);
    expect(intervaloAoAcaso(-3)).toBe(20);
    for (let i = 0; i < 200; i++) {
      const s = intervaloAoAcaso();
      expect(s).toBeGreaterThanOrEqual(20);
      expect(s).toBeLessThanOrEqual(45);
    }
  });
});

describe("os textos", () => {
  it("o HTML do email escapa tudo o que vem do texto", () => {
    const h = corpoEmHtml('Olá <script>alert(1)</script> **negrito** https://clyon.pt/x"y');
    expect(h).not.toContain("<script>");
    expect(h).toContain("&lt;script&gt;");
    expect(h).toContain("<strong");
    expect(h).toContain('href="https://clyon.pt/x"');
  });
  it("listas, subtítulos e parágrafos", () => {
    const b = blocosDoTexto("### Título\n\n1. um\n2. dois\n\n- a\n- b\n\nfim");
    expect(b.map((x) => x.tipo)).toEqual(["subtitulo", "lista", "lista", "paragrafo"]);
  });
  it("{nome} é o primeiro nome, e sem nome sai limpo", () => {
    expect(comONome("Olá {nome}!", "Ana Maria Silva")).toBe("Olá Ana!");
    expect(comONome("Olá {nome}!", null)).toBe("Olá!");
  });
  it("os textos aprovados (15-11): válidos, os 7 pontos no WhatsApp e no email, as 6 perguntas, e o telefone da fonte única", () => {
    const r = rascunhoDoAviso();
    expect(typeof validarConteudo(r)).toBe("object");
    expect(r.titulo).toBe("CLYON: o que muda a partir de 15 de novembro");
    expect(r.textoWhatsApp.startsWith("Olá! Novidades importantes da CLYON para os profissionais.")).toBe(true);
    expect(r.textoWhatsApp.endsWith("Dúvidas? Responda a esta mensagem.")).toBe(true);
    for (let n = 1; n <= 7; n++) expect(r.textoWhatsApp).toContain(`*${n}. `);
    for (let n = 1; n <= 7; n++) expect(r.textoEmail).toContain(`### ${n}. `);
    for (let n = 1; n <= 6; n++) expect(r.textoEmail).toContain(`**${n}. `);
    expect(r.textoEmail).toContain("Passa à CLYON 36,90 €: a taxa e o IVA dela.");
    expect(r.textoEmail).toContain("931 632 622");
    // O WhatsApp aprovado não leva ligação: o «Saber mais» não depende do interruptor para enviar.
    expect(ligaAoSaberMais(r)).toBe(false);
    expect(ler("src/lib/aviso-aos-profissionais.ts")).not.toMatch(/931\s?632\s?622/);
  });
});

/* ── O motor, com uma base em memória ───────────────────────────────────── */

type Linha = { id: number; providerId: number; canal: Canal; envioId: number; estado: string; motivo: string | null };

function baseEmMemoria(provs: number[], canais: Canal[] = ["email", "whatsapp"]) {
  const linhas: Linha[] = [];
  const envio = { id: 1, activo: true, proximoEm: 0 };
  let relogio = 0;
  let n = 0;
  // A chave única (chave, providerId, canal): o mesmo «começar» duas vezes não duplica.
  const comecar = () => {
    for (const canal of canais)
      for (const p of provs) {
        if (!linhas.some((l) => l.providerId === p && l.canal === canal)) {
          linhas.push({ id: ++n, providerId: p, canal, envioId: envio.id, estado: "pendente", motivo: null });
        }
      }
  };
  const repo: RepositorioDoAviso = {
    envioActivo: async () =>
      envio.activo ? { id: envio.id, canais, conteudo: { titulo: "T", textoEmail: "E {nome}", textoWhatsApp: "W {nome}" } } : null,
    proximoPendente: async (id, canal) => {
      const l = linhas.find((x) => x.envioId === id && x.canal === canal && x.estado === "pendente");
      return l ? { id: l.id, providerId: l.providerId, canal } : null;
    },
    reservar: async (id) => {
      const l = linhas.find((x) => x.id === id);
      if (!l || l.estado !== "pendente") return false;
      l.estado = "a_enviar";
      return true;
    },
    devolver: async (id) => {
      const l = linhas.find((x) => x.id === id);
      if (l && l.estado === "a_enviar") l.estado = "pendente";
    },
    marcar: async (d, estado, motivo) => {
      const l = linhas.find((x) => x.id === d.id)!;
      l.estado = estado;
      l.motivo = motivo;
    },
    ganharAVezDoWhatsApp: async (_id, s) => {
      if (!envio.activo || envio.proximoEm > relogio) return false;
      envio.proximoEm = relogio + s;
      return true;
    },
    pendentes: async (id) => linhas.filter((l) => l.envioId === id && l.estado === "pendente").length,
    terminar: async () => {
      envio.activo = false;
    },
    contacto: async (id): Promise<ContactoNoMomento> => ({
      nome: `Pro ${id}`,
      email: `p${id}@exemplo.pt`,
      telemovel: `35191000000${id}`,
      elegivel: true,
    }),
  };
  const saidas: Array<{ canal: Canal; para: string }> = [];
  const portas: PortasDoAviso = {
    enviarEmail: async (para) => {
      saidas.push({ canal: "email", para });
      return "enviado";
    },
    enviarWhatsApp: async (para) => {
      saidas.push({ canal: "whatsapp", para });
      return true;
    },
    whatsappPronto: async () => true,
    esperar: async () => {},
    aleatorio: () => 0.5,
  };
  const parar = () => {
    envio.activo = false;
    for (const l of linhas) if (l.estado === "pendente") l.estado = "parado";
  };
  return { linhas, envio, comecar, repo, portas, saidas, parar, avancarRelogio: (s: number) => (relogio += s) };
}

const DE_DIA = new Date("2026-11-16T10:00:00Z");
const DE_NOITE = new Date("2026-11-16T22:30:00Z");

describe("o motor do envio", () => {
  it("cada profissional recebe uma só vez por canal, mesmo carregando duas vezes", async () => {
    const b = baseEmMemoria([1, 2, 3]);
    b.comecar();
    b.comecar();
    expect(b.linhas).toHaveLength(6);
    for (let i = 0; i < 20; i++) {
      await avancarOAviso(b.repo, b.portas, DE_DIA, { maxEmails: 10 });
      b.avancarRelogio(60);
    }
    expect(b.saidas.filter((s) => s.canal === "email")).toHaveLength(3);
    expect(b.saidas.filter((s) => s.canal === "whatsapp")).toHaveLength(3);
    expect(new Set(b.saidas.map((s) => `${s.canal}:${s.para}`)).size).toBe(6);
    expect(b.envio.activo).toBe(false);
  });

  it("o WhatsApp sai um de cada vez e espera o intervalo entre mensagens", async () => {
    const b = baseEmMemoria([1, 2, 3], ["whatsapp"]);
    b.comecar();
    await avancarOAviso(b.repo, b.portas, DE_DIA);
    await avancarOAviso(b.repo, b.portas, DE_DIA);
    expect(b.saidas).toHaveLength(1);
    b.avancarRelogio(19);
    await avancarOAviso(b.repo, b.portas, DE_DIA);
    expect(b.saidas).toHaveLength(1);
    b.avancarRelogio(30);
    await avancarOAviso(b.repo, b.portas, DE_DIA);
    expect(b.saidas).toHaveLength(2);
  });

  it("duas passagens ao mesmo tempo não enviam o mesmo duas vezes", async () => {
    const b = baseEmMemoria([1, 2], ["whatsapp"]);
    b.comecar();
    await Promise.all([avancarOAviso(b.repo, b.portas, DE_DIA), avancarOAviso(b.repo, b.portas, DE_DIA)]);
    expect(b.saidas).toHaveLength(1);
  });

  it("fora das 9h–20h de Lisboa o WhatsApp fica na fila (o email não espera)", async () => {
    const b = baseEmMemoria([1, 2]);
    b.comecar();
    const r = await avancarOAviso(b.repo, b.portas, DE_NOITE, { maxEmails: 10 });
    expect(r.foraDaJanela).toBe(true);
    expect(b.saidas.filter((s) => s.canal === "whatsapp")).toHaveLength(0);
    expect(b.saidas.filter((s) => s.canal === "email")).toHaveLength(2);
    expect(b.linhas.filter((l) => l.canal === "whatsapp").every((l) => l.estado === "pendente")).toBe(true);
    expect(b.envio.activo).toBe(true);
  });

  it("«Parar» pára: nada mais sai", async () => {
    const b = baseEmMemoria([1, 2, 3], ["whatsapp"]);
    b.comecar();
    await avancarOAviso(b.repo, b.portas, DE_DIA);
    b.parar();
    b.avancarRelogio(100);
    await avancarOAviso(b.repo, b.portas, DE_DIA);
    expect(b.saidas).toHaveLength(1);
    expect(b.linhas.filter((l) => l.estado === "parado")).toHaveLength(2);
  });

  it("o Resend a pedir para esperar devolve o destinatário à fila", async () => {
    const b = baseEmMemoria([1], ["email"]);
    b.comecar();
    b.portas.enviarEmail = async () => "esperar";
    await avancarOAviso(b.repo, b.portas, DE_DIA);
    expect(b.linhas[0].estado).toBe("pendente");
  });

  it("quem deixou de ser destinatário falha com o motivo, e não recebe", async () => {
    const b = baseEmMemoria([1], ["email"]);
    b.comecar();
    b.repo.contacto = async () => ({ nome: null, email: "x@exemplo.pt", telemovel: null, elegivel: false });
    await avancarOAviso(b.repo, b.portas, DE_DIA);
    expect(b.saidas).toHaveLength(0);
    expect(b.linhas[0].estado).toBe("falhou");
    expect(b.linhas[0].motivo).toMatch(/destinatário/);
  });
});

describe("as guardas na base e nas rotas", () => {
  const base = ler("src/lib/aviso-aos-profissionais-na-base.ts");
  it("uma linha por profissional e canal, para sempre (chave única + INSERT IGNORE)", () => {
    expect(base).toContain("UNIQUE KEY uq_uma_vez (chave, providerId, canal)");
    expect(base).toContain("INSERT IGNORE INTO avisoProfissionaisDestinatarios");
    // Só os parados e os que falharam voltam à fila: os enviados nunca.
    expect(base).toMatch(/estado IN \('parado', 'falhou'\)/);
    expect(base).toContain("UNIQUE KEY uq_activo (activoChave)");
  });
  it("não guarda emails nem telefones nas tabelas do aviso", () => {
    const tabelas = base.match(/CREATE TABLE IF NOT EXISTS avisoProfissionais\w+ \([\s\S]*?\) ENGINE/g) ?? [];
    expect(tabelas).toHaveLength(3);
    for (const t of tabelas) expect(t).not.toMatch(/\b(email|telefone|phone)\b/);
  });
  it("a ponte põe o motor a andar depois de responder, sem partir a ronda", () => {
    const ponte = ler("src/app/api/whatsapp/ponte/route.ts");
    expect(ponte).toMatch(/after\(async \(\) => \{\s*try \{[\s\S]*?passagemDoAviso\("ponte"\)/);
  });
  it("só o administrador, e enviar pede ENVIAR", () => {
    const rota = ler("src/app/api/admin/aviso-aos-profissionais/route.ts");
    expect(rota.match(/requireAdminGeral\(req\)/g)).toHaveLength(2);
    expect(rota).toContain('!== "ENVIAR"');
  });
  it("a faixa e o «Saber mais» só com o interruptor ligado (desligado por omissão)", () => {
    expect(ler("src/app/profissionais/novo-modelo/page.tsx")).toContain("if (!(await interruptorDoAviso()).ligado) notFound();");
    expect(ler("src/app/api/profissionais/aviso-do-novo-modelo/route.ts")).toMatch(/ligado \?[\s\S]*: \{ mostrar: false \}/);
    expect(base).toMatch(/const desligado: InterruptorDoAviso = \{ ligado: false/);
  });
});
