import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NOTA_SEM_RESPOSTA,
  comoODisse,
  ePerguntaDoPosTrabalho,
  estrelasNaResposta,
  oPorVerFechaAoAbrir,
  respostaDoPosTrabalho,
  type MensagemDaConversa,
} from "./pos-trabalho";
import { oClienteVeEsteTipo } from "./historico-para-o-cliente";
import { mensagemDeAgradecimento, mensagemDeTrabalhoConcluido } from "./mensagens-das-fases";

/**
 * d147 (27-11-2026, dono): a ordem da Mesa, do início ao fim do pedido, e os
 * Concluídos «por ver» com a pergunta de pós-trabalho e a resposta do cliente.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const CLYON = ler("src/components/admin/TrabalhoClyon.tsx");
const CAIXA = ler("src/components/admin/PosTrabalhoPorVer.tsx");
const BASE = ler("src/lib/pos-trabalho-na-base.ts");
const ROTA = ler("src/app/api/admin/negociacoes/pos-trabalho/route.ts");

describe("a ordem da Mesa (d147)", () => {
  it("os blocos, do início ao fim do pedido", () => {
    const i = MESA.indexOf("const BLOCOS: Array<");
    const lista = MESA.slice(i, MESA.indexOf("\n];", i));
    const chaves = [...lista.matchAll(/\n {4}chave: "([A-Za-z0-9]+)",/g)].map((m) => m[1]);
    expect(chaves).toEqual(["porConfirmar", "porEnviar", "n2", "aguardaCliente", "n1", "n3", "concluidos", "cancelados"]);
  });

  it("os cartões de cima e os blocos de baixo saem do mesmo array, e o «Geral» fica em último", () => {
    expect(MESA).toContain("const blocosDoModo = BLOCOS.filter(");
    const inicio = MESA.indexOf("grid-cols-[repeat(auto-fit,");
    const fila = MESA.slice(inicio, MESA.indexOf("      {soOBloco && (", inicio));
    expect(fila.indexOf("blocosDoModo.map((b) =>")).toBeGreaterThan(-1);
    expect(fila.indexOf(">Geral</p>")).toBeGreaterThan(fila.indexOf("blocosDoModo.map((b) =>"));
    expect(MESA).toContain("{blocosVisiveis.map((b) => {");
  });
});

const d = (iso: string) => new Date(iso);
const conversa = (...l: Array<[MensagemDaConversa["direccao"], string, string]>): MensagemDaConversa[] =>
  l.map(([direccao, texto, em]) => ({ direccao, texto, em: d(em) }));

describe("a pergunta de pós-trabalho", () => {
  it("reconhece as que saem da plataforma", () => {
    expect(ePerguntaDoPosTrabalho(mensagemDeAgradecimento({ pedidoId: 1, cliente: "Ana", parceiro: "X" }))).toBe(true);
    expect(ePerguntaDoPosTrabalho(mensagemDeTrabalhoConcluido({ pedidoId: 1, cliente: "Ana" }))).toBe(true);
    expect(ePerguntaDoPosTrabalho("Olá, Ana! Uma última coisa e não volto a incomodar: como é que correu o trabalho de Rui?")).toBe(true);
    expect(ePerguntaDoPosTrabalho("Olá! O parceiro chega amanhã às 9h.")).toBe(false);
  });
});

describe("a resposta lê-se da conversa", () => {
  it("a última pergunta e o que o cliente escreveu depois", () => {
    const r = respostaDoPosTrabalho(
      conversa(
        ["in", "Bom dia, quero tirar um sofá", "2026-11-20T09:00:00Z"],
        ["out", "Olá! De 1 a 5, que nota dá ao parceiro?", "2026-11-25T10:00:00Z"],
        ["in", "5", "2026-11-25T11:00:00Z"],
        ["in", "Foram muito simpáticos", "2026-11-25T11:01:00Z"],
      ),
      "whatsapp",
    );
    expect(r.pergunta?.texto).toContain("que nota dá ao parceiro");
    expect(r.resposta?.texto).toBe("5\nForam muito simpáticos");
    expect(r.estrelas).toBe(5);
    expect(r.comoDisse).toBe("Por WhatsApp a 25/11");
  });

  it("o que o cliente disse ANTES da pergunta não é a resposta", () => {
    const r = respostaDoPosTrabalho(
      conversa(
        ["in", "5 estrelas para vocês", "2026-11-24T09:00:00Z"],
        ["out", "Como é que correu o trabalho de Rui?", "2026-11-25T10:00:00Z"],
      ),
      "whatsapp",
    );
    expect(r.pergunta).not.toBeNull();
    expect(r.resposta).toBeNull();
    expect(r.estrelas).toBeNull();
    expect(r.comoDisse).toBeNull();
  });

  it("sem pergunta na conversa, não há nada", () => {
    const r = respostaDoPosTrabalho(conversa(["in", "obrigado", "2026-11-25T10:00:00Z"]), "whatsapp");
    expect(r).toMatchObject({ pergunta: null, resposta: null, estrelas: null });
  });

  it("uma pergunta antes do trabalho (`desde`) não conta", () => {
    const r = respostaDoPosTrabalho(
      conversa(
        ["out", "Correu tudo bem?", "2026-10-01T10:00:00Z"],
        ["in", "Sim, 4", "2026-10-01T11:00:00Z"],
      ),
      "whatsapp",
      d("2026-11-20T00:00:00Z"),
    );
    expect(r.pergunta).toBeNull();
  });

  it("o mesmo para as apps, um dia: o canal muda o «como»", () => {
    expect(comoODisse("app_cliente", d("2026-11-27T12:00:00Z"))).toBe("Pela app de cliente a 27/11");
    expect(comoODisse("app_pro", d("2026-11-27T12:00:00Z"))).toBe("Pela app CLYON Pro a 27/11");
  });
});

describe("estrelas só quando a nota é clara", () => {
  it.each([
    ["5", 5],
    ["4/5", 4],
    ["dou 5", 5],
    ["Nota 3", 3],
    ["cinco estrelas!", 5],
    ["⭐⭐⭐⭐", 4],
  ])("«%s» → %i", (texto, n) => expect(estrelasNaResposta(texto)).toBe(n));

  it.each(["Correu bem, obrigado", "Chegaram às 5 e saíram às 7", "4 ou 5", ""])("«%s» → sem estrelas", (texto) =>
    expect(estrelasNaResposta(texto)).toBeNull(),
  );
});

describe("«Sem resposta do cliente — fechar» não é uma avaliação", () => {
  it("fica uma nota interna e o carimbo do visto — nada de avaliações nem estrelas", () => {
    expect(NOTA_SEM_RESPOSTA).toBe("O cliente não respondeu ao pedido de avaliação");
    const fechar = BASE.slice(BASE.indexOf("export async function fecharOPosTrabalho("));
    expect(fechar).toContain('type: "note"');
    expect(fechar).toContain("NOTA_SEM_RESPOSTA");
    expect(fechar).toContain("await marcarConcluidoComoVisto(pedidoId);");
    for (const fonte of [BASE, ROTA]) {
      expect(fonte).not.toContain("avaliarProfissional");
      expect(fonte).not.toMatch(/UPDATE\s+negociacoes/i);
      expect(fonte).not.toContain("estrelas =");
    }
  });

  it("o «note» é um tipo que o cliente não vê", () => {
    expect(oClienteVeEsteTipo("note")).toBe(false);
  });

  it("os dois botões tiram o «por ver»; «Guardar a resposta» usa o «Dar a nota como CLYON» com o texto do cliente", () => {
    expect(CAIXA).toContain("Guardar a resposta");
    expect(CAIXA).toContain("Sem resposta do cliente — fechar");
    expect(CAIXA).toContain('void fechar("sem_resposta")');
    expect(CAIXA).toContain('await fechar("guardada");');
    expect(CAIXA).toContain("<AvaliarPelaClyon");
    expect(CAIXA).toContain("comentario: item?.resposta?.texto");
    expect(CAIXA).toContain("comoDisse: item?.comoDisse");
    expect(ROTA).toContain('accao !== "guardada" && accao !== "sem_resposta"');
  });
});

describe("onde aparece", () => {
  it("na Mesa e nos Trabalhos CLYON, num concluído por ver ainda sem nota", () => {
    expect(MESA).toContain("{porVer && acordada && !acordada.avaliadoEm && (\n          <PosTrabalhoPorVer");
    expect(CLYON).toContain("{porVer && a && a.estrelas == null && (\n        <PosTrabalhoPorVer");
  });

  it("abrir só dá por visto quando não há nota a recolher", () => {
    expect(oPorVerFechaAoAbrir({ avaliado: true, clyonPodeAvaliar: true })).toBe(true);
    expect(oPorVerFechaAoAbrir({ avaliado: false, clyonPodeAvaliar: false })).toBe(true);
    expect(oPorVerFechaAoAbrir({ avaliado: false, clyonPodeAvaliar: true })).toBe(false);
    expect(MESA).toContain("if (porVer && fechaAoAbrir && !negociacoesVisiveis.has(p.id) && token) {");
    expect(CLYON).toContain("if (porVer && !aberto && fechaAoAbrir) onVisto();");
  });

  it("a rota abre-se a quem tem a Mesa ou os Trabalhos CLYON", () => {
    const P = ler("src/lib/papel-do-painel.ts");
    expect(P).toContain('{ prefixo: "/api/admin/negociacoes/pos-trabalho", seccoes: ["negociacoes_clyon", "trabalhos_clyon"] },');
    expect(P.indexOf('"/api/admin/negociacoes/pos-trabalho"')).toBeLessThan(P.indexOf('{ prefixo: "/api/admin/negociacoes", seccoes: ["negociacoes_clyon"] },'));
  });
});
