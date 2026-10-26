import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import NotaDoPedido, { BotaoAnotar, type NotasDaMesa } from "@/components/admin/NotaDoPedido";

// Nos testes o JSX do componente sai como `React.createElement` (o Next
// compila-o de outra maneira), e precisa do `React` à mão quando desenha.
(globalThis as { React?: typeof React }).React = React;

/**
 * A NOTA NO «POR DECIDIR» — 26-10-2026 (d29). *«Coloque as notas aqui»* — o
 * dono, sobre as linhas do «Por decidir» da Mesa.
 *
 * Os cartões das negociações já tinham a nota interna do pedido e o
 * «Anotar» debaixo do número; as linhas do «Por decidir» não. Agora têm, com
 * o MESMO componente (`NotaDoPedido.tsx`), o MESMO estado e o MESMO
 * `guardarNota` da Mesa — a nota escrita num sítio aparece igual no outro.
 *
 * As notas e os números destes testes são inventados.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const NOTA = ler("src/components/admin/NotaDoPedido.tsx");
const DB = ler("src/lib/db.ts");
const inicio = MESA.indexOf("const linha = (p: PorPromover) => (");
const LINHA = MESA.slice(inicio, MESA.indexOf("const seccao = (chave: GrupoDeIdade)", inicio));

const notas = (mudar: Partial<NotasDaMesa> = {}): NotasDaMesa => ({
  aberta: null,
  rascunho: "",
  aGuardar: false,
  escrever: vi.fn(),
  abrir: vi.fn(),
  fechar: vi.fn(),
  guardar: vi.fn(),
  ...mudar,
});

/** O que a linha do «Por decidir» desenha para a nota, com as props que lá estão. */
const desenharLinha = (nota: string | null, n: NotasDaMesa = notas()) =>
  renderToStaticMarkup(
    createElement(
      "div",
      null,
      createElement(BotaoAnotar, { pedidoId: 101, nota, notas: n, className: "mt-1 w-fit" }),
      createElement(NotaDoPedido, { pedidoId: 101, nota, notas: n, margem: "-mt-1" }),
    ),
  ).replace(/<!-- -->/g, "");

describe("a linha do «Por decidir» mostra a nota e o «Anotar»", () => {
  it("com o mesmo componente e o mesmo estado dos cartões da Mesa", () => {
    expect(inicio).toBeGreaterThan(0);
    expect(LINHA).toContain('<BotaoAnotar pedidoId={p.id} nota={p.notasInternas} notas={notas} className="mt-1 w-fit" />');
    expect(LINHA).toContain('<NotaDoPedido pedidoId={p.id} nota={p.notasInternas} notas={notas} margem="-mt-1" />');
    // Os cartões das negociações desenham o mesmo, com o mesmo `notas`.
    const foraDaLinha = MESA.slice(0, inicio);
    expect(foraDaLinha).toContain("<NotaDoPedido pedidoId={p.id} nota={p.notasInternas} notas={notas} />");
    expect(foraDaLinha).toContain("<BotaoAnotar pedidoId={p.id} nota={p.notasInternas} notas={notas} />");
    // E o `notas` que chega ao «Por decidir» é o do painel da Mesa.
    const chamada = MESA.indexOf("<PedidosPorPromover");
    expect(chamada).toBeGreaterThan(0);
    expect(MESA.slice(chamada, MESA.indexOf("/>", chamada))).toContain("notas={notas}");
    expect(MESA).toContain("const notas: NotasDaMesa = {");
  });

  it("o «Anotar» fica debaixo do número, antes dos botões; a nota numa linha por baixo", () => {
    const numero = LINHA.indexOf('#{p.id} · {p.contactName || "Cliente sem nome"}');
    const servico = LINHA.indexOf("{nomeComMaiuscula(p.serviceType)}");
    const anotar = LINHA.indexOf("<BotaoAnotar ");
    const editar = LINHA.indexOf("onClick={() => onEditar(p.id)}");
    expect(numero).toBeGreaterThan(0);
    expect(servico).toBeGreaterThan(numero);
    expect(anotar).toBeGreaterThan(servico);
    expect(editar).toBeGreaterThan(anotar);
    // Dentro do bloco do texto, que no telemóvel guarda os seus 14rem.
    const texto = LINHA.indexOf('<div className="min-w-[14rem] flex-1">');
    expect(texto).toBeGreaterThan(0);
    expect(texto).toBeLessThan(anotar);
    expect(LINHA.slice(anotar, editar)).toContain("</div>");
    // A nota vem depois da data, antes das caixas de escolher e de oferecer.
    const data = LINHA.indexOf("{quandoEntrou(p.createdAt)}");
    const nota = LINHA.indexOf("<NotaDoPedido ");
    expect(nota).toBeGreaterThan(data);
    expect(nota).toBeLessThan(LINHA.indexOf("<EscolherProfissionais"));
    expect(nota).toBeLessThan(LINHA.indexOf("<OferecerComoTrabalhoClyon"));
  });

  it("sem nota: o «Anotar», e nada mais", () => {
    const html = desenharLinha(null);
    expect(html).toContain("Anotar");
    expect(html).toContain('type="button"');
    expect(html).not.toContain("bg-amber-500/[0.06]");
    expect(html).not.toContain("<textarea");
  });

  it("com nota: a nota à vista, no âmbar da Mesa, e o clique nela é para a mudar", () => {
    const html = desenharLinha("Ligar depois das 18h");
    expect(html).toContain("Ligar depois das 18h");
    expect(html).toContain("border-amber-500/30 bg-amber-500/[0.06]");
    expect(html).toContain("text-amber-200/90");
    // Numa linha por baixo, inteira, e a partir as palavras longas no telemóvel.
    expect(html).toContain("-mt-1 flex w-full");
    expect(html).toContain("break-words");
    expect(html).not.toMatch(/>\s*Anotar\s*</);

    const n = notas();
    const parar = vi.fn();
    const botao = NotaDoPedido({ pedidoId: 101, nota: "Ligar depois das 18h", notas: n }) as ReactElement<{
      onClick: (e: unknown) => void;
    }>;
    botao.props.onClick({ stopPropagation: parar });
    expect(parar).toHaveBeenCalled();
    expect(n.abrir).toHaveBeenCalledWith(101, "Ligar depois das 18h");
  });

  it("aberta: a mesma caixa da Mesa — 500 caracteres, Guardar, Cancelar e Apagar", () => {
    const html = desenharLinha("Ligar depois das 18h", notas({ aberta: 101, rascunho: "Ligar depois das 18h" }));
    expect(html).toContain("<textarea");
    expect(html).toContain('maxLength="500"');
    expect(html).toContain("Guardar");
    expect(html).toContain("Cancelar");
    expect(html).toContain("Apagar a nota");
    expect(html).toContain("A mesma nota do ecrã do pedido.");
    // Com a caixa aberta, o «Anotar» não se repete por cima.
    expect(html).not.toMatch(/>\s*Anotar\s*</);
    // A caixa de outro pedido não abre esta.
    expect(desenharLinha(null, notas({ aberta: 202 }))).not.toContain("<textarea");
  });
});

describe("o clique no «Anotar» não abre a edição do pedido nem marca a caixa", () => {
  it("abre só a nota, sem o clique passar à linha", () => {
    const n = notas();
    const parar = vi.fn();
    const botao = BotaoAnotar({ pedidoId: 101, nota: null, notas: n }) as ReactElement<{
      onClick: (e: unknown) => void;
    }>;
    botao.props.onClick({ stopPropagation: parar });
    expect(parar).toHaveBeenCalled();
    expect(n.abrir).toHaveBeenCalledWith(101, "");
    expect(n.guardar).not.toHaveBeenCalled();
  });

  it("a linha não tem clique nem rótulo à volta da caixa: editar é só o botão «Editar»", () => {
    expect(LINHA.slice(0, LINHA.indexOf("<input"))).not.toContain("onClick");
    expect(LINHA).not.toContain("<label");
    expect(LINHA).toContain("onChange={() => alternar(p.id)}");
  });
});

describe("a mesma rota e as mesmas regras", () => {
  it("o «Por decidir» recebe a nota da base", () => {
    const i = DB.indexOf("export async function pedidosPorPromover");
    const consulta = DB.slice(i, DB.indexOf("export async function promoverPedidoAPlataforma", i));
    expect(consulta).toContain("o.notasInternas,");
    expect(consulta).toContain("notasInternas: string | null;");
  });

  it("guarda só pelo `guardarNota` da Mesa — a rota do pedido —, e muda a linha antes da rede responder", () => {
    // Nem a linha nem o componente escrevem sozinhos.
    expect(LINHA).not.toContain("fetch(");
    expect(NOTA).not.toContain("fetch(");
    expect(MESA).toContain("guardar: (id, texto) => void guardarNota(id, texto),");
    const i = MESA.indexOf("async function guardarNota");
    const corpo = MESA.slice(i, MESA.indexOf("const notas: NotasDaMesa", i));
    expect(corpo).toContain("`/api/admin/pedidos/${id}`");
    expect(corpo.indexOf("setPorPromover((lista)")).toBeGreaterThan(0);
    expect(corpo.indexOf("setPorPromover((lista)")).toBeLessThan(corpo.indexOf("await fetch("));
  });

  it("uma nota aberta de cada vez, e a batida pára enquanto se escreve — também aqui", () => {
    expect(MESA).toContain("aberta: notaAberta,");
    expect(MESA).toContain("paused: notaAberta !== null");
  });
});
