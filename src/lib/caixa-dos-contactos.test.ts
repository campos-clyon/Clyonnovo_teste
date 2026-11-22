import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  accaoDoRespondido,
  contactosAVer,
  contactosParaOAviso,
  emHorarioDoPrazo,
  entradaDoFormulario,
  entradaDoSuporte,
  entradaDoWhatsApp,
  ESTADO_DO_FORMULARIO,
  ESTADO_DO_LEAD_RESPONDIDO,
  juntarContactos,
  medirACaixa,
  quemPrecisaDePrimeiraResposta,
  refValida,
  segundosDeHorario,
  type FormularioParaACaixa,
  type SuporteParaACaixa,
} from "./caixa-dos-contactos";
import { avisosDosContactos } from "./avisos-a-equipa";
import type { ConversaNaMesa } from "./mesa-das-conversas";

/**
 * A CAIXA «CONTACTOS» — d85, fase 1 (CEO e dono, 22-11-2026).
 *
 * «Todos os contactos guardados numa secção, e todos respondidos.» A 17-11
 * havia 17 conversas por responder, 12 há mais de 3 dias, e os formulários e
 * o Suporte da app estavam noutras secções, sem prazo nenhum.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (f: string) =>
  f.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

// Novembro: Lisboa está em UTC+0. 21-11-2026 é sábado, 22 domingo, 23 segunda.
const em = (iso: string) => new Date(iso);
const H = 3600;

type Mesa = Pick<
  ConversaNaMesa,
  "telefone" | "estado" | "porque" | "dono" | "ultimaMensagem" | "haSegundos" | "quemFalou" | "onde" | "pedido" | "profissional"
>;
const conversa = (x: Partial<Mesa> = {}): Mesa => ({
  telefone: "351912345678",
  estado: "por_responder",
  porque: "Escreveu há 3 h",
  dono: "assistente",
  ultimaMensagem: "Boa tarde, queria saber o preço",
  haSegundos: 3 * H,
  quemFalou: "cliente",
  onde: "site",
  pedido: null,
  profissional: null,
  ...x,
});
const formulario = (x: Partial<FormularioParaACaixa> = {}): FormularioParaACaixa => ({
  id: 7,
  nome: "Ana",
  telefone: "912 345 678",
  email: "ana@exemplo.pt",
  status: "novo",
  tipoServico: "Recolha de móveis",
  mensagem: "Um sofá",
  origem: "formulario_contactos",
  haSegundos: 5 * H,
  mudadoHaSegundos: 5 * H,
  ...x,
});
const suporte = (x: Partial<SuporteParaACaixa> = {}): SuporteParaACaixa => ({
  id: 3,
  estado: "aberta",
  atendidaPor: "vitoria",
  ultimoAutor: "cliente",
  ultimaMensagem: "Ainda não recebi resposta",
  ultimaHaSegundos: 4 * H,
  esperaHaSegundos: 6 * H,
  nome: "Ana",
  email: "ANA@exemplo.pt",
  telefone: null,
  contaApagada: false,
  ...x,
});

describe("o prazo conta só dentro do horário (seg–sáb, 08h–20h em Lisboa)", () => {
  it("numa manhã de segunda conta o relógio", () => {
    expect(segundosDeHorario(em("2026-11-23T09:00:00Z"), em("2026-11-23T11:30:00Z"))).toBe(2.5 * H);
  });

  it("quem escreve às 23h começa a contar às 08h", () => {
    expect(segundosDeHorario(em("2026-11-23T23:00:00Z"), em("2026-11-24T09:00:00Z"))).toBe(1 * H);
  });

  it("o domingo não conta: sábado 19h30 → segunda 08h30 é 1 h", () => {
    expect(segundosDeHorario(em("2026-11-21T19:30:00Z"), em("2026-11-23T08:30:00Z"))).toBe(1 * H);
    expect(segundosDeHorario(em("2026-11-22T10:00:00Z"), em("2026-11-22T18:00:00Z"))).toBe(0);
  });

  it("no Verão, as 08h são de Lisboa e não de UTC", () => {
    // 15-07-2026 (quarta), Lisboa em UTC+1: 08h de Lisboa = 07h UTC.
    expect(segundosDeHorario(em("2026-07-15T06:00:00Z"), em("2026-07-15T08:00:00Z"))).toBe(1 * H);
  });

  it("e o «dentro do horário» de agora", () => {
    expect(emHorarioDoPrazo(em("2026-11-23T10:00:00Z"))).toBe(true);
    expect(emHorarioDoPrazo(em("2026-11-23T21:00:00Z"))).toBe(false);
    expect(emHorarioDoPrazo(em("2026-11-22T10:00:00Z"))).toBe(false);
  });

  it("mais de 2 h no horário fica a vermelho; as mesmas horas à noite não", () => {
    const segundaAs1130 = em("2026-11-23T11:30:00Z");
    const [tarde] = juntarContactos([entradaDoFormulario(formulario({ haSegundos: 2.5 * H }), segundaAs1130)], segundaAs1130);
    expect(tarde.atrasado).toBe(true);
    // Entrou sábado às 19h30; segunda às 09h30 passaram 2 h de horário (30 min + 1 h 30) — no limite, ainda não.
    const segundaAs0930 = em("2026-11-23T09:30:00Z");
    const desdeSabado = (segundaAs0930.getTime() - em("2026-11-21T19:30:00Z").getTime()) / 1000;
    const [noite] = juntarContactos([entradaDoFormulario(formulario({ haSegundos: desdeSabado }), segundaAs0930)], segundaAs0930);
    expect(noite.esperaS).toBeGreaterThan(30 * H);
    expect(noite.esperaUtilS).toBe(2 * H);
    expect(noite.atrasado).toBe(false);
  });
});

describe("juntar os contactos de vários canais", () => {
  const agora = em("2026-11-23T15:00:00Z");

  it("pelo telefone (últimos 9 dígitos) e pelo email: WhatsApp + formulário + Suporte da app são uma pessoa", () => {
    const lista = juntarContactos(
      [
        entradaDoWhatsApp(conversa({ estado: "a_espera", quemFalou: "vitoria", haSegundos: 1 * H }), agora),
        entradaDoFormulario(formulario(), agora),
        entradaDoSuporte(suporte(), agora),
      ],
      agora,
    );
    expect(lista).toHaveLength(1);
    expect(lista[0].canais).toEqual(["whatsapp", "formulario", "suporte"]);
    expect(lista[0].chave).toBe("t:912345678");
    // Basta um canal por responder; a espera é a do mais antigo (o Suporte, há 6 h).
    expect(lista[0].estado).toBe("por_responder");
    expect(lista[0].esperaS).toBe(6 * H);
  });

  it("sem telefone, junta pelo email; sem nenhum dos dois, fica sozinho e «anonimizado»", () => {
    const lista = juntarContactos(
      [
        entradaDoFormulario(formulario({ id: 1, telefone: "", email: "rui@exemplo.pt" }), agora),
        entradaDoSuporte(suporte({ id: 9, email: "Rui@Exemplo.pt" }), agora),
        entradaDoFormulario(formulario({ id: 2, telefone: "", email: "" }), agora),
        entradaDoSuporte(suporte({ id: 10, contaApagada: true }), agora),
      ],
      agora,
    );
    expect(lista).toHaveLength(3);
    const rui = lista.find((c) => c.chave === "e:rui@exemplo.pt");
    expect(rui?.canais).toEqual(["formulario", "suporte"]);
    const anonimos = lista.filter((c) => c.anonimizado);
    expect(anonimos).toHaveLength(2);
    expect(anonimos.every((c) => c.chave.startsWith("r:"))).toBe(true);
  });

  it("o estado da pessoa: por responder > com uma pessoa > respondido > fechado", () => {
    const so = (estados: Array<Partial<Mesa>>) =>
      juntarContactos(
        estados.map((x, i) => entradaDoWhatsApp(conversa({ telefone: "35191234567" + i, ...x }), agora)),
        agora,
      ).map((c) => c.estado);
    expect(so([{ estado: "resolvida", quemFalou: "equipa" }])).toEqual(["fechado"]);
    expect(so([{ estado: "a_espera", dono: "equipa", quemFalou: "equipa" }])).toEqual(["com_pessoa"]);
    expect(so([{ estado: "com_pedido", quemFalou: "vitoria" }])).toEqual(["respondido"]);
    const juntos = juntarContactos(
      [
        entradaDoWhatsApp(conversa({ estado: "resolvida", quemFalou: "equipa" }), agora),
        entradaDoFormulario(formulario({ status: "contactado" }), agora),
      ],
      agora,
    );
    expect(juntos.map((c) => c.estado)).toEqual(["respondido"]);
  });

  it("os pedidos ligados vêm de todas as entradas, do maior n.º para o menor", () => {
    const [c] = juntarContactos(
      [entradaDoWhatsApp(conversa({ pedido: { id: 501, estado: "novo", fechado: false } }), agora), entradaDoFormulario(formulario(), agora)],
      agora,
    );
    expect(c.pedidos).toEqual([501]);
  });
});

describe("quem respondeu", () => {
  const agora = em("2026-11-23T15:00:00Z");
  const quem = (x: Partial<Mesa>, respondidaHaS: number | null = null) =>
    entradaDoWhatsApp(conversa({ estado: "a_espera", ...x }), agora, { respondidaHaS }).quemRespondeu;

  it("a Vitória, a equipa pelo backoffice, ou a equipa pelo telemóvel", () => {
    expect(quem({ quemFalou: "vitoria", onde: "site" })).toBe("vitoria");
    expect(quem({ quemFalou: "equipa", onde: "painel" })).toBe("equipa_backoffice");
    expect(quem({ quemFalou: "equipa", onde: "telemovel" })).toBe("equipa_telemovel");
    // «[à mão]» no fio: escrita no telemóvel e trazida pela ponte.
    expect(quem({ quemFalou: "equipa", onde: "site" })).toBe("equipa_telemovel");
  });

  it("a resposta escrita no painel grava a mensagem e o «Já respondi» juntos — é da equipa, não da Vitória", () => {
    expect(quem({ quemFalou: "vitoria", onde: "site", haSegundos: 600 }, 610)).toBe("equipa_backoffice");
    expect(quem({ quemFalou: "vitoria", onde: "site", haSegundos: 600 }, 5 * H)).toBe("vitoria");
  });

  it("ninguém, enquanto está por responder", () => {
    expect(entradaDoWhatsApp(conversa(), agora).quemRespondeu).toBeNull();
  });

  it("no Suporte: quem escreveu por último, ou quem marcou «Respondido» depois do cliente", () => {
    expect(entradaDoSuporte(suporte({ ultimoAutor: "vitoria" }), agora).quemRespondeu).toBe("vitoria");
    expect(entradaDoSuporte(suporte({ ultimoAutor: "equipa" }), agora).quemRespondeu).toBe("equipa_backoffice");
    const marcada = entradaDoSuporte(suporte(), agora, { marca: { porQuem: "Rita", haSegundos: 1 * H } });
    expect(marcada.estado).toBe("respondido");
    expect(marcada.quemRespondeu).toBe("equipa_backoffice");
    expect(marcada.respondidoPorNome).toBe("Rita");
    // Uma marca de antes da última mensagem do cliente já não vale.
    const antiga = entradaDoSuporte(suporte(), agora, { marca: { porQuem: "Rita", haSegundos: 8 * H } });
    expect(antiga.estado).toBe("por_responder");
  });
});

describe("os formulários e a caixa dizem o mesmo", () => {
  const agora = em("2026-11-23T15:00:00Z");

  it("o estado do lead manda: «novo» é por responder, «contactado» respondido, fechado/perdido fechado", () => {
    expect(entradaDoFormulario(formulario({ status: "novo" }), agora).estado).toBe("por_responder");
    expect(entradaDoFormulario(formulario({ status: "contactado" }), agora).estado).toBe("respondido");
    expect(entradaDoFormulario(formulario({ status: "orcamento_enviado" }), agora).estado).toBe("respondido");
    expect(entradaDoFormulario(formulario({ status: "fechado" }), agora).estado).toBe("fechado");
    expect(entradaDoFormulario(formulario({ status: "perdido" }), agora).estado).toBe("fechado");
  });

  it("marcar «Respondido» grava um estado que os Leads aceitam e que a caixa lê como respondido", () => {
    expect(ESTADO_DO_FORMULARIO[ESTADO_DO_LEAD_RESPONDIDO]).toBe("respondido");
    const leads = semComentarios(ler("src/app/api/leads/route.ts"));
    expect(leads).toContain(`"${ESTADO_DO_LEAD_RESPONDIDO}"`);
    const base = semComentarios(ler("src/lib/caixa-dos-contactos-na-base.ts"));
    expect(base).toContain("db.updateLeadStatus(accao.leadId, ESTADO_DO_LEAD_RESPONDIDO)");
    // Só o que ainda estava «novo» muda: um fechado ou perdido fica como está.
    expect(base).toMatch(/=== "novo"\) await db\.updateLeadStatus/);
  });

  it("o «Respondido» do WhatsApp é o «Já respondi» da mesa, e o do Suporte é a leitura da equipa", () => {
    const base = semComentarios(ler("src/lib/caixa-dos-contactos-na-base.ts"));
    expect(base).toContain("db.marcarRespondidaWhatsApp(accao.telefone, true)");
    expect(base).toContain('marcarLida(accao.conversaId, "equipa")');
  });

  it("quem marcou, com nome, numa marca que vale", () => {
    const e = entradaDoFormulario(formulario({ status: "contactado" }), agora, { marca: { porQuem: "Rita", haSegundos: 60 } });
    expect(e.respondidoPorNome).toBe("Rita");
    expect(e.quemRespondeu).toBe("equipa_backoffice");
  });

  it("só estas refs passam do painel — e cada uma diz o que muda", () => {
    expect(refValida("wa:351912345678")).toBe(true);
    expect(refValida("lead:12")).toBe(true);
    expect(refValida("sup:3")).toBe(true);
    for (const lixo of ["", "wa:12", "lead:1; DROP TABLE leads", "sup:", 7, null, "email:x"]) expect(refValida(lixo)).toBe(false);
    expect(accaoDoRespondido("lead:12")).toEqual({ canal: "formulario", leadId: 12 });
    expect(accaoDoRespondido("wa:351912345678")).toEqual({ canal: "whatsapp", telefone: "351912345678" });
    expect(accaoDoRespondido("sup:3")).toEqual({ canal: "suporte", conversaId: 3 });
  });
});

describe("as contas de teste e os números bloqueados ficam de fora", () => {
  const agora = em("2026-11-23T15:00:00Z");

  it("um formulário «teste» não entra; uma conversa de um telefone de teste também não", () => {
    const lista = juntarContactos(
      [
        entradaDoFormulario(formulario({ nome: "Fred Teste" }), agora),
        entradaDoWhatsApp(conversa({ telefone: "351930000111" }), agora, { deTeste: true }),
      ],
      agora,
    );
    expect(lista).toEqual([]);
  });

  it("um número bloqueado tira a pessoa inteira, com o formulário do mesmo telefone", () => {
    const lista = juntarContactos(
      [entradaDoWhatsApp(conversa({ estado: "bloqueada" }), agora), entradaDoFormulario(formulario(), agora)],
      agora,
    );
    expect(lista).toEqual([]);
  });
});

describe("a lista, os números do topo e os avisos", () => {
  const agora = em("2026-11-23T15:00:00Z");
  const lista = juntarContactos(
    [
      entradaDoWhatsApp(conversa({ telefone: "351910000670", haSegundos: 30 * 60 }), agora),
      entradaDoWhatsApp(conversa({ telefone: "351910000671", haSegundos: 5 * H }), agora),
      entradaDoWhatsApp(conversa({ telefone: "351910000672", haSegundos: 5 * 86400 }), agora),
      entradaDoFormulario(formulario({ id: 1, telefone: "910000673", email: "", haSegundos: 4 * H }), agora),
      entradaDoWhatsApp(conversa({ telefone: "351910000674", estado: "a_espera", quemFalou: "vitoria" }), agora),
    ],
    agora,
  );

  it("abre em «Por responder»: quem espera há mais tempo primeiro, as de há mais de 3 dias no fim", () => {
    expect(contactosAVer(lista, "por_responder").map((c) => c.chave)).toEqual([
      "t:910000671",
      "t:910000673",
      "t:910000670",
      "t:910000672",
    ]);
    expect(contactosAVer(lista, "todos")).toHaveLength(5);
    expect(contactosAVer(lista, "por_responder", "formulario").map((c) => c.chave)).toEqual(["t:910000673"]);
  });

  it("«por responder há mais de 2 h» e «há mais de 3 dias»", () => {
    const m = medirACaixa(lista);
    expect(m.porResponder).toBe(4);
    expect(m.maisDeDuasHoras).toBe(3);
    expect(m.maisDeTresDias).toBe(1);
    expect(m.total).toBe(5);
    expect(m.porCanal).toEqual({ whatsapp: 3, formulario: 1, suporte: 0, email: 0 });
  });

  it("os avisos só levam o que o «Do nosso lado» não leva: o formulário, não as conversas", () => {
    const para = contactosParaOAviso(lista, agora);
    expect(para.map((c) => c.chave)).toEqual(["t:910000673"]);
    const [aviso] = avisosDosContactos(para);
    expect(aviso.seccao).toBe("contactos");
    expect(aviso.url).toBe("/admin?section=contactos");
    expect(aviso.corpo).not.toContain("@");
  });

  it("o ponto de encaixe do acolhimento: quem ainda não teve resposta nenhuma", () => {
    const precisam = quemPrecisaDePrimeiraResposta(lista, agora);
    expect(precisam.map((p) => p.ref).sort()).toEqual(
      ["lead:1", "wa:351910000670", "wa:351910000671", "wa:351910000672"].sort(),
    );
  });
});

describe("quem recebe os avisos dos contactos", () => {
  it("o administrador, e a assistente que tem a secção «Contactos» — não a que só tem o WhatsApp", async () => {
    const { recebeOAviso } = await import("./avisos-a-equipa-na-base");
    const conta = (seccoes: string[], isAdmin = 0) => ({
      id: 1,
      isAdmin,
      funcao: isAdmin ? "admin" : "assistente",
      active: 1,
      seccoesJson: JSON.stringify(seccoes),
    });
    expect(recebeOAviso(conta([], 1), "contactos")).toBe(true);
    expect(recebeOAviso(conta(["contactos"]), "contactos")).toBe(true);
    expect(recebeOAviso(conta(["whatsapp"]), "contactos")).toBe(false);
    expect(recebeOAviso(conta(["contactos"]), "whatsapp")).toBe(false);
  });
});

describe("a secção nasce com selo, e nada se apaga", () => {
  const PAINEL = ler("src/components/admin/LegacyAdminClient.tsx");
  const NOVIDADES = semComentarios(ler("src/app/api/admin/novidades/route.ts"));

  it("«Contactos» está no menu, em «Quem contacta», com o seu ecrã", () => {
    expect(PAINEL).toContain('{ titulo: "Quem contacta", itens: ["contactos", "leads", "contas", "suporte"] }');
    expect(PAINEL).toContain('{activeSection === "contactos" && (');
    expect(PAINEL).toContain("<AdminContactosPanel />");
  });

  it("o selo é a fila dos por responder — fica até se responder, como o dos Pagamentos", () => {
    expect(NOVIDADES).toContain("contactosPorResponderParaOSelo()");
    expect(NOVIDADES).toContain("porFazer.contactos = porResponder;");
    // O menu desenha o `porFazer` de cada secção.
    expect(PAINEL).toContain("const aFazer = ePedidos ? 0 : (porFazer[item.id] ?? 0);");
  });

  it("nada na caixa faz DELETE", () => {
    for (const f of [
      "src/lib/caixa-dos-contactos.ts",
      "src/lib/caixa-dos-contactos-na-base.ts",
      "src/app/api/admin/contactos/route.ts",
      "src/components/admin/AdminContactosPanel.tsx",
    ]) {
      const codigo = semComentarios(ler(f));
      expect(codigo, f).not.toMatch(/\bDELETE\b/i);
      // «truncate» é também uma classe do Tailwind: só a instrução da base conta.
      expect(codigo, f).not.toMatch(/\bTRUNCATE\s+TABLE\b|\bDROP\s+TABLE\b/i);
    }
  });

  it("a rota é da secção «Contactos», com a tranca de sempre", () => {
    const rota = ler("src/app/api/admin/contactos/route.ts");
    expect(rota).toContain('import { requireAdmin } from "@/lib/admin-auth-helper";');
    expect(ler("src/lib/papel-do-painel.ts")).toContain('{ prefixo: "/api/admin/contactos", seccoes: ["contactos"] }');
  });
});
