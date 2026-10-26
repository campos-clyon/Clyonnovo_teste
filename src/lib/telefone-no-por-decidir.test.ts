import { describe, it, expect } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MessageCircle } from "lucide-react";
import TelefoneComWhatsApp from "@/components/admin/TelefoneComWhatsApp";

// Nos testes o JSX do componente sai como `React.createElement` (o Next
// compila-o de outra maneira), e precisa do `React` à mão quando desenha.
(globalThis as { React?: typeof React }).React = React;

/**
 * O TELEMÓVEL NO «POR DECIDIR» — 26-10-2026. *«Coloque o número de telefone
 * com o link para o WhatsApp aqui também.»* — o dono, sobre a lista do «Por
 * decidir» da Mesa.
 *
 * Os números destes testes são inventados.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const inicio = MESA.indexOf("const linha = (p: PorPromover) => (");
const LINHA = MESA.slice(inicio, MESA.indexOf("const seccao = (chave: GrupoDeIdade)", inicio));

/** O que a linha desenha, com as mesmas props que lá estão. */
const desenhar = (telefone: string | null) =>
  renderToStaticMarkup(
    createElement(TelefoneComWhatsApp, {
      telefone,
      className: "flex shrink-0 items-center gap-1 font-mono text-xs tabular-nums text-cyan-300/90",
      icone: createElement(MessageCircle, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
    }),
  ).replace(/<!-- -->/g, "");

describe("a linha do «Por decidir»", () => {
  it("mostra o telemóvel do cliente ao lado do nome, antes da origem, com o ícone de conversa", () => {
    expect(inicio).toBeGreaterThan(0);
    const nome = LINHA.indexOf('#{p.id} · {p.contactName || "Cliente sem nome"}');
    const telefone = LINHA.indexOf("<TelefoneComWhatsApp\n            telefone={p.contactPhone}");
    const origem = LINHA.indexOf("<EtiquetaDaOrigem slug={p.origem} />");
    expect(nome).toBeGreaterThan(0);
    expect(telefone).toBeGreaterThan(nome);
    expect(origem).toBeGreaterThan(telefone);
    expect(LINHA.slice(telefone, origem)).toContain('icone={<MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />}');
  });

  it("no telemóvel cabe: o texto tem 14rem, e abaixo disso são os botões que descem", () => {
    expect(LINHA).toContain('<div className="min-w-[14rem] flex-1">');
    expect(LINHA).not.toContain('<div className="min-w-0 flex-1">');
  });

  it("e não na linha de baixo, a da conta", () => {
    const deBaixo = LINHA.indexOf('<p className="mt-0.5 text-xs text-slate-400">');
    expect(deBaixo).toBeGreaterThan(0);
    const fim = LINHA.indexOf("</p>", deBaixo);
    expect(LINHA.slice(deBaixo, fim)).not.toContain("contactPhone");
  });

  it("a linha não se abre ao clicar: o clique no número não edita nem marca a caixa", () => {
    // A linha é um <div> sem clique; editar é o botão «Editar»; a caixa marca-se só nela.
    expect(LINHA.slice(0, LINHA.indexOf("<input"))).not.toContain("onClick");
    expect(LINHA).toContain("onClick={() => onEditar(p.id)}");
    expect(ler("src/components/admin/TelefoneComWhatsApp.tsx")).toContain("onClick={(e) => e.stopPropagation()}");
  });
});

describe("o que se vê e para onde vai", () => {
  it("um telemóvel português: legível, e abre a conversa no WhatsApp noutro separador", () => {
    for (const escrito of ["910000001", "910 000 001", "+351 910 000 001", "00351910000001"]) {
      const html = desenhar(escrito);
      expect(html).toContain('href="https://wa.me/351910000001"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).toContain("910 000 001");
      expect(html).toContain("<svg");
    }
  });

  it("um número estrangeiro com + ou 00 também abre o WhatsApp, e fica como foi escrito", () => {
    const html = desenhar("+44 7700 900123");
    expect(html).toContain('href="https://wa.me/447700900123"');
    expect(html).toContain("+44 7700 900123");
    expect(desenhar("0044 7700 900123")).toContain('href="https://wa.me/447700900123"');
  });

  it("um de fora gravado sem o «+» (26-10-2026) abre o WhatsApp e mostra-se com o «+»", () => {
    const html = desenhar("79000000000");
    expect(html).toContain('href="https://wa.me/79000000000"');
    expect(html).toContain("+79000000000");
    expect(html).not.toContain("tel:");
  });

  it("um português com um algarismo a mais continua só a ligar", () => {
    const html = desenhar("9100000012");
    expect(html).toContain('href="tel:9100000012"');
    expect(html).not.toContain("wa.me");
  });

  it("sem telefone não mostra nada", () => {
    expect(desenhar(null)).toBe("");
    expect(desenhar("")).toBe("");
    expect(desenhar("   ")).toBe("");
  });
});
