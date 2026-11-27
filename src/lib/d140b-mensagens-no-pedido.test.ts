import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIAS_DAS_MENSAGENS_NO_PEDIDO,
  eOAvisoDaResposta,
  avisoAoClienteDaResposta,
  mensagemDoPedidoPorResponder,
  mensagemNoPedidoContaNaMesa,
  mensagemPorResponder,
  rotuloDasMensagensNoPedido,
  VITORIA_NO_HISTORICO,
} from "./mensagem-no-suporte";

/*
 * d140b (27-11-2026, dono) — o «Precisa de si» mostrava «#N Mensagem no pedido
 * por responder há …» de pedidos de há 66 dias, já resolvidos, sem forma de os
 * limpar, e o contador deixou de ser o dos trabalhos. Agora: um botão próprio
 * na linha discreta; só as da última semana, de pedidos vivos, que ninguém
 * respondeu depois; e «Já está resolvido». Sem dados reais.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/** Sem os comentários de linha e de bloco (só os que começam a linha). */
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const historico = (...entradas: object[]) => JSON.stringify(entradas);
const doCliente = (createdAt: string) => ({ type: "client_reply", by: { id: 0, nome: "Cliente Exemplo", role: "cliente" }, message: "Olá", createdAt });
const daClyon = (createdAt: string, extra: object = {}) => ({ type: "message_to_client", by: { id: 3, nome: "Equipa", role: "admin" }, message: "Já vimos.", createdAt, ...extra });

const AGORA = new Date("2026-11-27T12:00:00Z");
const ONTEM = "2026-11-26 15:00:00";

describe("a última mensagem do cliente", () => {
  it("dá a primeira por responder (a espera) e a mais recente (para ver o que veio depois)", () => {
    const h = historico(doCliente("2026-11-25 10:00:00"), doCliente(ONTEM));
    expect(mensagemDoPedidoPorResponder(h)).toEqual({ desde: "2026-11-25 10:00:00", ultima: ONTEM, motivo: null });
    // A de sempre não muda de forma (a passagem das 08h e a Vitória usam-na).
    expect(mensagemPorResponder(h)).toEqual({ desde: "2026-11-25 10:00:00", motivo: null });
  });

  it("a resposta da equipa no Suporte tira-a; a Vitória que passa à equipa não", () => {
    expect(mensagemDoPedidoPorResponder(historico(doCliente(ONTEM), daClyon("2026-11-26 16:00:00")))).toBeNull();
    const passou = historico(doCliente(ONTEM), daClyon("2026-11-26 15:00:20", { by: VITORIA_NO_HISTORICO, passaAEquipa: true, motivo: "Pede trabalho a mais" }));
    expect(mensagemDoPedidoPorResponder(passou)?.motivo).toBe("Pede trabalho a mais");
    // A resposta da Vitória sem passar conta como resposta.
    expect(mensagemDoPedidoPorResponder(historico(doCliente(ONTEM), daClyon("2026-11-26 15:00:20", { by: VITORIA_NO_HISTORICO })))).toBeNull();
  });
});

describe("o que conta na Mesa", () => {
  const m = { ultima: ONTEM };

  it("uma de ontem, num pedido aberto e sem resposta, conta", () => {
    expect(mensagemNoPedidoContaNaMesa(m, { estado: "pendente" }, AGORA)).toBe(true);
    expect(mensagemNoPedidoContaNaMesa(m, { estado: null }, AGORA)).toBe(true);
  });

  it("as antigas saem sozinhas (como o #362 e o #346, de há 66 dias)", () => {
    expect(DIAS_DAS_MENSAGENS_NO_PEDIDO).toBe(7);
    expect(mensagemNoPedidoContaNaMesa({ ultima: "2026-09-22 10:00:00" }, { estado: "pendente" }, AGORA)).toBe(false);
    expect(mensagemNoPedidoContaNaMesa({ ultima: "2026-11-19 11:00:00" }, { estado: "pendente" }, AGORA)).toBe(false);
    expect(mensagemNoPedidoContaNaMesa({ ultima: "2026-11-21 11:00:00" }, { estado: "pendente" }, AGORA)).toBe(true);
  });

  it("de pedidos concluídos, cancelados ou arquivados não conta", () => {
    for (const estado of ["concluido", "cancelado", "arquivado", "rejeitado"]) {
      expect(mensagemNoPedidoContaNaMesa(m, { estado }, AGORA)).toBe(false);
    }
    // Concluído pelos marcos da negociação, com o estado ainda por mudar.
    expect(mensagemNoPedidoContaNaMesa(m, { estado: "pendente", concluido: true }, AGORA)).toBe(false);
  });

  it("respondida depois no WhatsApp desse número não conta; antes, sim", () => {
    expect(mensagemNoPedidoContaNaMesa(m, { estado: "pendente", respondidaNoWhatsAppEm: new Date("2026-11-26T16:00:00Z") }, AGORA)).toBe(false);
    expect(mensagemNoPedidoContaNaMesa(m, { estado: "pendente", respondidaNoWhatsAppEm: new Date("2026-11-26T14:00:00Z") }, AGORA)).toBe(true);
    // O aviso automático «Respondemos à sua mensagem no pedido» não é uma resposta.
    expect(eOAvisoDaResposta(avisoAoClienteDaResposta(668, "https://exemplo/conta"))).toBe(true);
    expect(eOAvisoDaResposta("Bom dia! O parceiro confirma a hora.")).toBe(false);
  });

  it("«Já está resolvido» tira-a; uma mensagem nova do cliente depois volta a contar", () => {
    const resolvidaEm = new Date("2026-11-26T18:00:00Z");
    expect(mensagemNoPedidoContaNaMesa(m, { estado: "pendente", resolvidaEm }, AGORA)).toBe(false);
    expect(mensagemNoPedidoContaNaMesa({ ultima: "2026-11-27 09:00:00" }, { estado: "pendente", resolvidaEm }, AGORA)).toBe(true);
  });

  it("o botão diz quantas", () => {
    expect(rotuloDasMensagensNoPedido(1)).toBe("mensagem no pedido");
    expect(rotuloDasMensagensNoPedido(3)).toBe("mensagens no pedido");
  });
});

describe("as ligações no código", () => {
  const MESA = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
  const BOTAO = semComentarios(ler("src/components/admin/MensagensNoPedido.tsx"));
  const ROTA = semComentarios(ler("src/app/api/admin/negociacoes/mensagens-no-pedido/route.ts"));
  const BASE = semComentarios(ler("src/lib/mensagem-no-suporte-na-base.ts"));

  it("o contador do «Precisa de si» não muda com mensagens: a Mesa já não as lê nem as soma", () => {
    const i = MESA.indexOf("function quantosNoBloco(");
    const contas = MESA.slice(i, MESA.indexOf("\n  }\n", i));
    expect(contas).not.toMatch(/mensage/i);
    expect(MESA).not.toContain("mensagensNoPedido");
    expect(MESA).not.toContain("mensagensForaDoN1");
    expect(MESA).not.toContain('fetch("/api/admin/negociacoes/mensagens-no-pedido"');
  });

  it("são um botão próprio da linha discreta, depois do «Precisa de si»", () => {
    const linha = MESA.indexOf('aria-label="O que está à espera"');
    const fim = MESA.indexOf("onClick={() => escolherBloco(null)}");
    const bloco = MESA.slice(linha, fim);
    expect(bloco.indexOf("{linhaDoPrecisaDeSi}")).toBeGreaterThan(-1);
    expect(bloco.indexOf("<MensagensNoPedido")).toBeGreaterThan(bloco.indexOf("{linhaDoPrecisaDeSi}"));
    expect(BOTAO).toContain("BOTAO_DA_LINHA");
    expect(BOTAO).toContain("PAINEL_DA_LINHA");
    expect(BOTAO).toContain("rotuloDasMensagensNoPedido(lista.length)");
  });

  it("«Já está resolvido» em cada linha marca com quem e quando, sem apagar a mensagem", () => {
    expect(BOTAO).toContain("Já está resolvido");
    expect(BOTAO).toContain('method: "POST"');
    expect(ROTA).toContain("export async function POST");
    expect(ROTA).toContain("marcarMensagemNoPedidoResolvida(pedidoId, { id: colab?.id ?? null, nome: colab?.nome ?? null })");
    expect(BASE).toContain("CREATE TABLE IF NOT EXISTS mensagensNoPedidoResolvidas");
    expect(BASE).toMatch(/porId[\s\S]*porNome/);
    const i = BASE.indexOf("export async function marcarMensagemNoPedidoResolvida(");
    const marcar = BASE.slice(i, BASE.indexOf("\n}\n", i));
    expect(marcar).not.toMatch(/DELETE|appendOrderHistory|historyJson/);
  });

  it("a leitura só vai a pedidos vivos da última semana, e vê o WhatsApp desse número", () => {
    const i = BASE.indexOf("export async function mensagensNoPedidoPorResponder(");
    const leitura = BASE.slice(i);
    expect(leitura).toContain("status NOT IN (${fechados})");
    expect(leitura).toContain("INTERVAL ${DIAS_DAS_MENSAGENS_NO_PEDIDO + 1} DAY");
    expect(leitura).toContain("concluidoPelosMarcos(n)");
    expect(leitura).toContain("FROM whatsappMensagens");
    expect(leitura).toContain("FROM whatsappNoTelemovel WHERE deMim = 1");
    expect(leitura).toContain("FROM mensagensNoPedidoResolvidas");
  });
});
