import { describe, it, expect } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PainelDoQueFalta, { BotaoPedirOQueFalta, type PedidoParaPedir } from "@/components/admin/PedirOQueFalta";
import type { ChaveDaFalta } from "@/lib/mensagem-do-que-falta";

// Nos testes o JSX do componente sai como `React.createElement` (o Next
// compila-o de outra maneira), e precisa do `React` à mão quando desenha.
(globalThis as { React?: typeof React }).React = React;

/**
 * «PEDIR O QUE FALTA» NO «POR DECIDIR» — 26-10-2026 (d31). O botão na linha,
 * o painel com o WhatsApp, o email e o copiar, e o registo no histórico.
 *
 * Os pedidos, os telefones e os emails destes testes são inventados.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const inicio = MESA.indexOf("const linha = (p: PorPromover) => (");
const LINHA = MESA.slice(inicio, MESA.indexOf("const seccao = (chave: GrupoDeIdade)", inicio));
const COMPONENTE = ler("src/components/admin/PedirOQueFalta.tsx");
const ROTA = ler("src/app/api/admin/pedidos/[id]/o-que-falta/route.ts");
const PROMOVER = ler("src/app/api/admin/negociacoes/promover/route.ts");
const DB = ler("src/lib/db.ts");

const TRES: ChaveDaFalta[] = ["fotografias", "numeroDaPorta", "elevador"];
const pedido = (mudar: Partial<PedidoParaPedir> = {}): PedidoParaPedir => ({
  id: 812,
  serviceType: "recolha_monos",
  city: "Almada",
  contactPhone: "912 345 678",
  contactEmail: "cliente@exemplo.pt",
  ...mudar,
});

const botao = (faltas: ChaveDaFalta[], aberto = false) =>
  renderToStaticMarkup(createElement(BotaoPedirOQueFalta, { pedidoId: 812, faltas, aberto, onAlternar: () => {} })).replace(
    /<!-- -->/g,
    "",
  );
const painel = (p: PedidoParaPedir, faltas: ChaveDaFalta[] = TRES) =>
  renderToStaticMarkup(createElement(PainelDoQueFalta, { pedido: p, faltas, token: "t", onFechar: () => {} })).replace(
    /<!-- -->/g,
    "",
  );

/** A tag de abertura do elemento que tem este texto, para ler as classes e os atributos. */
const elementoCom = (html: string, texto: string) => {
  const i = html.indexOf(texto);
  const abre = Math.max(html.lastIndexOf("<a ", i), html.lastIndexOf("<button", i));
  return html.slice(abre, html.indexOf(">", abre) + 1);
};

describe("na linha do «Por decidir»", () => {
  it("o botão fica ao lado do «Editar», antes do valor fixo, e o painel abre por baixo da nota", () => {
    expect(inicio).toBeGreaterThan(0);
    const editar = LINHA.indexOf("onClick={() => onEditar(p.id)}");
    const botaoNaLinha = LINHA.indexOf("<BotaoPedirOQueFalta");
    const valorFixo = LINHA.indexOf("Valor fixo\n");
    expect(editar).toBeGreaterThan(0);
    expect(botaoNaLinha).toBeGreaterThan(editar);
    expect(valorFixo).toBeGreaterThan(botaoNaLinha);
    const nota = LINHA.indexOf("<NotaDoPedido ");
    const oPainel = LINHA.indexOf("<PainelDoQueFalta pedido={p} faltas={p.faltas} token={token}");
    expect(oPainel).toBeGreaterThan(nota);
    // Um painel aberto de cada vez: abrir este fecha o «Escolher» e o valor fixo, e o contrário
    // (dois), mais o «Fechar» do próprio painel.
    expect(LINHA.match(/setAPedir\(null\)/g)?.length).toBe(3);
    const alternar = LINHA.slice(botaoNaLinha, LINHA.indexOf("/>", botaoNaLinha));
    expect(alternar).toContain("setAEscolher(null);");
    expect(alternar).toContain("setAOferecer(null);");
  });

  it("a nota, o telefone e o «Anotar» continuam lá, e a linha não se abre ao clicar", () => {
    expect(LINHA).toContain('<NotaDoPedido pedidoId={p.id} nota={p.notasInternas} notas={notas} margem="-mt-1" />');
    expect(LINHA).toContain('<BotaoAnotar pedidoId={p.id} nota={p.notasInternas} notas={notas} className="mt-1 w-fit" />');
    expect(LINHA).toContain("<TelefoneComWhatsApp\n            telefone={p.contactPhone}");
    expect(LINHA.slice(0, LINHA.indexOf("<input"))).not.toContain("onClick");
    // Os cliques do botão e do painel ficam neles.
    expect(COMPONENTE).toContain("const soAqui = (e: MouseEvent) => e.stopPropagation();");
    expect(COMPONENTE.match(/soAqui\(e\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("diz quantas coisas faltam; completo, diz «Pedido completo» e não se carrega", () => {
    const com = botao(TRES);
    expect(com).toContain("Pedir o que falta (3)");
    expect(com).toContain('aria-expanded="false"');
    expect(com).not.toContain("disabled");
    expect(botao(TRES, true)).toContain('aria-expanded="true"');
    const completo = botao([]);
    expect(completo).toContain("Pedido completo");
    expect(completo).toContain("disabled");
    expect(completo).not.toContain("Pedir o que falta");
  });
});

describe("o painel aberto", () => {
  it("mostra a lista do que falta e o WhatsApp e o email lado a lado, noutro separador", () => {
    const html = painel(pedido());
    for (const r of ["fotografias", "número da porta", "elevador"]) expect(html).toContain(`>${r}</li>`);
    const whatsapp = elementoCom(html, "WhatsApp</a>");
    expect(whatsapp).toContain('href="https://wa.me/351912345678?text=');
    expect(whatsapp).toContain('target="_blank"');
    expect(whatsapp).toContain('rel="noopener noreferrer"');
    expect(whatsapp).toContain("bg-emerald-600");
    const email = elementoCom(html, "Email</a>");
    expect(email).toContain('href="mailto:cliente@exemplo.pt?subject=Pedido%20%23812%20%E2%80%94%20informa%C3%A7%C3%B5es%20em%20falta&amp;body=');
    expect(email).toContain('target="_blank"');
    expect(email).not.toContain("bg-sky-600");
    expect(html).toContain("Copiar mensagem");
    // A mensagem à vista, para quem envia saber o que sai.
    expect(html).toContain("Ver a mensagem");
    expect(html).toContain("Aqui é a equipa da CLYON.");
  });

  it("um número que não abre no WhatsApp: o WhatsApp desliga-se e o email fica destacado", () => {
    const html = painel(pedido({ contactPhone: "12345" }));
    expect(html).not.toContain("wa.me");
    const whatsapp = elementoCom(html, "· sem WhatsApp");
    expect(whatsapp).toContain("disabled");
    expect(elementoCom(html, "Email</a>")).toContain("bg-sky-600");
  });

  it("sem email: o email desliga-se com «sem email»", () => {
    const html = painel(pedido({ contactEmail: null }));
    expect(html).not.toContain("mailto:");
    expect(elementoCom(html, "· sem email")).toContain("disabled");
    expect(html).toContain("wa.me/351912345678");
  });

  it("sem nenhum dos dois: fica o «Copiar mensagem», destacado", () => {
    const html = painel(pedido({ contactPhone: null, contactEmail: null }));
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("mailto:");
    expect(elementoCom(html, "Copiar mensagem")).toContain("bg-slate-200");
  });

  it("um pedido completo não abre painel", () => {
    expect(painel(pedido(), [])).toBe("");
  });
});

describe("nada se envia sozinho, e fica no histórico", () => {
  it("o painel só abre links e regista: não chama rotas de envio", () => {
    expect(COMPONENTE).toContain("`/api/admin/pedidos/${pedido.id}/o-que-falta`");
    expect(COMPONENTE).not.toMatch(/\/api\/admin\/whatsapp|enviarTextoWhatsApp|sendMail|\/api\/admin\/pedidos\/\$\{[^}]+\}\/pedir-info/);
    // Os três caminhos registam, cada um com o seu canal.
    for (const canal of ['registar("whatsapp"', 'registar("email"', 'registar("copiar"']) expect(COMPONENTE).toContain(canal);
  });

  it("a rota escreve no histórico quem, por onde e a lista — e não envia nada", () => {
    expect(ROTA).toMatch(/import\s*\{\s*requireAdmin\s*\}\s*from\s*"@\/lib\/admin-auth-helper"/);
    expect(ROTA).toContain("oQueFaltaNoPedido(pedido");
    expect(ROTA).toContain('type: "note"');
    expect(ROTA).toContain("by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null");
    expect(ROTA).toContain("message: registoDoQueFalta(colab?.nome, canal, faltas,");
    expect(ROTA).not.toMatch(/whatsapp-cloud|enviarTexto|email-pedido|sendMail|updateSimulatorOrder|precisa_info/);
    // «info_requested» é conversa: apareceria ao cliente como uma mensagem nossa.
    expect(ROTA).not.toContain('"info_requested"');
  });

  it("a Mesa recebe só as chaves do que falta: a descrição e o formulário ficam no servidor", () => {
    expect(PROMOVER).toContain("pedidosPorPromover(100)");
    expect(PROMOVER).toContain("({ description, filesJson, dataAgendada, rawDoQueFalta, ...p }) => ({");
    expect(PROMOVER).toContain("faltas: oQueFaltaNoPedido({ ...p, description, filesJson, dataAgendada, rawOrderJson: rawDoQueFalta })");
    const q = DB.slice(DB.indexOf("export async function pedidosPorPromover"), DB.indexOf("export async function promoverPedidoAPlataforma"));
    expect(q).toContain("AS rawDoQueFalta");
    expect(q).toContain("JSON_EXTRACT(o.rawOrderJson, '$.destinationAddress')");
    // O rawOrderJson inteiro não vem: traz o formulário todo e as fotografias.
    expect(q).not.toMatch(/,\s*o\.rawOrderJson\s*,/);
  });
});
