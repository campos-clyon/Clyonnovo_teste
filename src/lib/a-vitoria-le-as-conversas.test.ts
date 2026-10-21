import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fioParaALeitura, INSTRUCAO_DA_LEITURA, lerALeitura, MENSAGENS_LIDAS } from "./leitura-das-conversas";
import { conversasPorLer, CONVERSAS_POR_PASSAGEM, lerAsConversasParadas, SOSSEGO_ANTES_DE_LER_S } from "./ler-as-conversas";
import { naMesa, type ConversaNaMesa, type FactosDaConversa } from "./mesa-das-conversas";
import { MARCA_DE_MAO } from "./rajada-do-whatsapp";

/**
 * A VITÓRIA LÊ AS CONVERSAS E FECHA AS QUE ACABARAM — 21-10-2026.
 *
 * *«Tanto a gente quanto o assistente sozinho pode ler as mensagens e ele
 * mesmo fechar o fluxo. Não estou a dizer que ele tenha de responder aos
 * clientes: lê as conversas e identifica que aquele serviço já foi
 * concluído.»* — o dono. Decidiu que ela fecha sozinha (com o porquê, e
 * reabre-se com um clique) e que lê as 193 de «Entregues a si».
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("o que se manda ao modelo", () => {
  it("a conversa com quem escreveu cada linha — o cliente, a Vitória, a equipa", () => {
    const fio = fioParaALeitura(
      [
        { direccao: "in", texto: "Retirada nessa sexta-feira dia 23/10 às 19h" },
        { direccao: "out", texto: "Boa tarde, Leandro. Aqui é a CLYON. A nossa proposta…" },
        { direccao: "in", texto: "[fotografia] cerca de 30 sacos de entulho numa sala" },
        { direccao: "in", texto: "[fotografia]" },
        { direccao: "in", texto: "[áudio] Bom dia, é para amanhã" },
        { direccao: "out", texto: `${MARCA_DE_MAO} sim` },
        { direccao: "in", texto: "Podemos prosseguir" },
      ],
      "há 1 min",
    );
    expect(fio.split("\n").slice(0, 7)).toEqual([
      "CLIENTE: Retirada nessa sexta-feira dia 23/10 às 19h",
      "VITÓRIA: Boa tarde, Leandro. Aqui é a CLYON. A nossa proposta…",
      "CLIENTE: [mandou uma fotografia: cerca de 30 sacos de entulho numa sala]",
      "CLIENTE: [mandou uma imagem]",
      "CLIENTE: [áudio] Bom dia, é para amanhã",
      "EQUIPA: sim",
      "CLIENTE: Podemos prosseguir",
    ]);
    expect(fio).toMatch(/\(A última mensagem foi há 1 min\.\)$/);
  });

  it("só as últimas — é aí que está o fim", () => {
    const muitas = Array.from({ length: 70 }, (_, i) => ({ direccao: "in", texto: `mensagem ${i}` }));
    const fio = fioParaALeitura(muitas, "há 2 h");
    expect(fio).not.toContain("mensagem 0\n");
    expect(fio).toContain(`mensagem ${70 - MENSAGENS_LIDAS}\n`);
    expect(fio).toContain("mensagem 69");
  });

  it("o aviso diz que não responde, e que na dúvida não fecha", () => {
    expect(INSTRUCAO_DA_LEITURA).toContain("NÃO vais responder ao cliente");
    expect(INSTRUCAO_DA_LEITURA).toContain('Na dúvida, NÃO é "resolvida"');
    expect(INSTRUCAO_DA_LEITURA).toContain('Um orçamento sem resposta do cliente NÃO é "resolvida"');
    expect(INSTRUCAO_DA_LEITURA).toContain("O cliente aceitar");
  });
});

describe("a resposta do modelo, validada", () => {
  it("o estado e o porquê", () => {
    expect(lerALeitura('{"estado": "resolvida", "motivo": "o cliente disse que já arranjou quem fizesse"}')).toEqual({
      estado: "resolvida",
      motivo: "o cliente disse que já arranjou quem fizesse",
    });
    expect(lerALeitura('Aqui vai: {"estado":"a_espera_do_cliente","motivo":"«falta aceitar o orçamento»"}')).toEqual({
      estado: "a_espera_do_cliente",
      motivo: "falta aceitar o orçamento",
    });
  });

  it("um estado que não existe, ou fechar sem razão, não vale", () => {
    expect(lerALeitura('{"estado": "fechada", "motivo": "x"}')).toBeNull();
    expect(lerALeitura('{"estado": "resolvida", "motivo": ""}')).toBeNull();
    expect(lerALeitura("não percebi")).toBeNull();
    expect(lerALeitura(null)).toBeNull();
  });
});

describe("quais se lêem em cada passagem", () => {
  const H = 3600;
  const linha = (telefone: string, estado: ConversaNaMesa["estado"], haSegundos: number, ultimoId: number) =>
    ({ telefone, estado, haSegundos, ultimoId }) as ConversaNaMesa;

  it("as paradas com novidades, nem fechadas nem bloqueadas, as mais recentes primeiro", () => {
    const mesa = [
      linha("351910000001", "por_responder", 5 * H, 10),
      linha("351910000002", "a_espera", 3 * H, 20),
      linha("351910000003", "a_espera", 30 * 60, 30), // ainda viva
      linha("351910000004", "resolvida", 9 * H, 40),
      linha("351910000005", "bloqueada", 9 * H, 50),
      linha("351910000006", "com_pedido", 24 * H, 60), // já lida até à última
    ];
    const leituras = new Map([["910000006", { ateMensagemId: 60 }]]);
    expect(conversasPorLer(mesa, leituras).map((l) => l.telefone)).toEqual(["351910000002", "351910000001"]);
  });

  it("vinte de cada vez, duas horas paradas", () => {
    expect(CONVERSAS_POR_PASSAGEM).toBe(20);
    expect(SOSSEGO_ANTES_DE_LER_S).toBe(2 * H);
    const mesa = Array.from({ length: 50 }, (_, i) => linha(`3519100000${String(i).padStart(2, "0")}`, "a_espera", 3 * H + i, i + 1));
    expect(conversasPorLer(mesa, new Map())).toHaveLength(20);
  });

  describe("sem chave do Gemini", () => {
    const chave = process.env.GEMINI_API_KEY;
    afterEach(() => {
      if (chave === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = chave;
    });
    it("não lê nada, e diz porquê", async () => {
      delete process.env.GEMINI_API_KEY;
      const r = await lerAsConversasParadas();
      expect(r).toMatchObject({ lidas: 0, fechadas: 0 });
      expect(r.linhas[0]).toContain("GEMINI_API_KEY");
    });
  });
});

describe("o que ela percebeu aparece na mesa", () => {
  const conversa = (f: Partial<FactosDaConversa>): FactosDaConversa => ({
    telefone: "351910652111",
    ultimaEntrada: null,
    ultimaSaida: null,
    bloqueada: false,
    entregue: true,
    fecho: null,
    recolha: null,
    pedidoVivo: null,
    ultimoPedido: null,
    guardada: null,
    ...f,
  });

  it("no porquê, a seguir ao que o cliente escreveu", () => {
    const l = naMesa(
      conversa({
        ultimaEntrada: {
          id: 7,
          direccao: "in",
          texto: "Obrigado, se possível ligue quando estiver por perto. Até amanhã",
          haSegundos: 3 * 3600,
          quando: "x",
        },
        leitura: { estado: "em_curso", motivo: "o cliente pediu para ligar quando estiver por perto" },
      }),
    );
    expect(l.estado).toBe("por_responder");
    expect(l.porque).toContain("— a Vitória leu: o cliente pediu para ligar quando estiver por perto");
    expect(l.ultimoId).toBe(7);
  });

  it("e só enquanto não houver mensagem nova — senão já não vale", () => {
    const NA_BASE = ler("src/lib/mesa-das-conversas-na-base.ts");
    expect(NA_BASE).toContain("leitura && leitura.ateMensagemId >= ultimoId ? { estado: leitura.estado, motivo: leitura.motivo } : null");
  });
});

describe("as peças estão ligadas — e nenhuma escreve ao cliente", () => {
  const JOB = semComentarios(ler("src/lib/ler-as-conversas.ts"));
  const LEITURA = semComentarios(ler("src/lib/leitura-das-conversas.ts"));

  it("fecha com o porquê e «porQuem: vitoria», e guarda o que percebeu", () => {
    expect(JOB).toContain("await db.guardarLeituraDaConversaWhatsApp(l.telefone, ate, leitura.estado, leitura.motivo);");
    expect(JOB).toContain('if (leitura.estado === "resolvida") {');
    expect(JOB).toContain('await db.arquivarConversaWhatsApp(l.telefone, true, { motivo: leitura.motivo, porQuem: "vitoria" });');
  });

  it("não manda mensagem nenhuma", () => {
    for (const fonte of [JOB, LEITURA]) {
      expect(fonte).not.toMatch(/enviarTextoWhatsApp|enviarAvisoWhatsApp|registarMensagemWhatsApp|filaWhatsApp/);
    }
  });

  it("o cron corre de 15 em 15 minutos, fechado sem CRON_SECRET", () => {
    const vercel = JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };
    expect(vercel.crons).toContainEqual({ path: "/api/cron/ler-conversas", schedule: "*/15 * * * *" });
    const CRON = ler("src/app/api/cron/ler-conversas/route.ts");
    expect(CRON).toContain('if (!bearerConfere(req.headers.get("authorization"), secret)) {');
    expect(CRON).toContain("const r = await lerAsConversasParadas();");
  });

  it("e o painel pede-lhe para ler — todas as paradas, ou uma", () => {
    const ROTA = ler("src/app/api/admin/whatsapp/route.ts");
    expect(ROTA).toContain('if (accao === "lerConversas") {');
    expect(ROTA).toContain("await lerAsConversasParadas(telefone ? { telefone } : { maximo: 12 });");
    const PAINEL = ler("src/components/admin/AdminWhatsAppPanel.tsx");
    expect(PAINEL).toContain("onClick={() => void pedirLeitura()}");
    expect(PAINEL).toContain("onClick={() => void pedirLeitura(l.telefone)}");
    expect(PAINEL).toContain('body: JSON.stringify({ accao: "lerConversas", telefone }),');
  });
});
