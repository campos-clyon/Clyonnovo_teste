import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assistenteComSeccoesPodeChamar } from "./papel-do-painel";

/**
 * EDITAR UM TRABALHO CLYON — 07-10-2026.
 *
 * *«Deixe a opção de editar o pedido»*, na página dos Trabalhos CLYON.
 *
 * O editor é o de sempre (`RegistarPedido`, o mesmo da Agenda e das
 * Negociações). O que não podia vir com ele é o resto da gravação: num pedido
 * normal, gravar uma mudança recomeça o pedido do zero — mata as negociações e
 * manda-o a toda a gente para propostas. Num Trabalho CLYON isso desfazia a
 * oferta a valor fixo e os «aceito» que já houvesse. Aqui grava-se, e a oferta
 * segue como estava, com o mesmo valor.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
// Sem comentários — a regra ancorada ao início da linha (ver
// tirar-comentarios-sem-comer-codigo.test.ts).
const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const PAGINA = semNotas(ler("src/components/admin/AdminTrabalhosClyonPanel.tsx"));
const LIB = semNotas(ler("src/lib/recomecar-do-zero.ts"));
const EDITOR = semNotas(ler("src/app/api/admin/pedidos/[id]/editar/route.ts"));
const FORMULARIO = semNotas(ler("src/components/admin/RegistarPedido.tsx"));

describe("o botão, no cartão do trabalho", () => {
  it("cada cartão tem «Editar pedido», e abre o editor com o número do pedido", () => {
    const i = PAGINA.indexOf("function CartaoDoTrabalho(");
    expect(i).toBeGreaterThan(-1);
    const cartao = PAGINA.slice(i);
    expect(cartao).toMatch(/onClick=\{onEditar\}[\s\S]{0,400}Editar pedido/);
    expect(PAGINA).toContain("onEditar={() => setAEditar(t.pedidoId)}");
    expect(PAGINA).toContain("editarId={aEditar}");
  });

  it("o editor só grava: sem oferta nem envio — um trabalho oferecido não se reenvia daqui", () => {
    const i = PAGINA.indexOf("editarId={aEditar}");
    const editor = PAGINA.slice(PAGINA.lastIndexOf("<RegistarPedido", i), PAGINA.indexOf("/>", i));
    expect(editor).not.toContain("oferta=");
    expect(editor).not.toContain("podeEnviarAoGravar");
  });

  it("fecha pelo botão e só pelo botão — um clique ao lado não deita o formulário fora", () => {
    const i = PAGINA.indexOf("{aEditar != null && (");
    const bloco = PAGINA.slice(i, PAGINA.indexOf("editarId={aEditar}", i));
    expect(bloco).not.toContain("onClick");
    expect(PAGINA).toContain("setAEditar(null);");
  });

  it("quem tem só os Trabalhos CLYON pode ler e gravar o pedido", () => {
    expect(assistenteComSeccoesPodeChamar(["trabalhos_clyon"], "/api/admin/pedidos/417", "GET")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(["trabalhos_clyon"], "/api/admin/pedidos/417/editar", "POST")).toBe(true);
  });
});

describe("⚠️ gravar não desfaz a oferta", () => {
  it("o recomeço recusa um Trabalho CLYON antes de tocar em qualquer negociação", () => {
    const guarda = LIB.indexOf("if (pedido.valorFixoClyon != null)");
    expect(guarda).toBeGreaterThan(-1);
    expect(LIB.slice(guarda, guarda + 120)).toContain('porque: "trabalho_clyon"');
    expect(guarda).toBeLessThan(LIB.indexOf("negociacoesDoPedido(pedido.id)"));
    expect(guarda).toBeLessThan(LIB.indexOf("matarNegociacoesDoPedido(pedido.id)"));
    expect(guarda).toBeLessThan(LIB.indexOf("await distribuirPedido("));
  });

  it("o valor fixo e o que ele mede ficam como estavam, mande o formulário o que mandar", () => {
    expect(EDITOR).toContain("const trabalhoClyon = pedido.valorFixoClyon != null;");
    expect(EDITOR).toMatch(/const valorDesejado = trabalhoClyon\s*\?\s*Number\(pedido\.valorDesejadoCliente\)/);
    expect(EDITOR).toContain("if (trabalhoClyon) corpo.baseDoPreco = pedido.baseDoPreco;");
    // E é antes de se gravar, que é onde o `corpo.baseDoPreco` se lê.
    expect(EDITOR.indexOf("if (trabalhoClyon) corpo.baseDoPreco")).toBeLessThan(
      EDITOR.indexOf("baseDoPreco: lerBase(corpo.baseDoPreco)"),
    );
  });

  /*
   * Desde 08-10-2026 o valor e a taxa mudam-se aqui também — «antes de
   * enviar o pedido ou depois em editar» —, mas pela rota dos Trabalhos
   * CLYON e num botão à parte: mudar o valor volta a pedir «aceito» a quem já
   * o tinha, e gravar o resto do pedido continua a não mexer na oferta.
   */
  it("o formulário muda o valor e a taxa à parte, e diz que a oferta continua", () => {
    expect(FORMULARIO).toContain("setValorFixo(o.valorFixoClyon != null ? Number(o.valorFixoClyon) : null);");
    const i = FORMULARIO.indexOf("{valorFixo != null ? (");
    expect(i).toBeGreaterThan(-1);
    const ramo = FORMULARIO.slice(i, FORMULARIO.indexOf(") : (", i));
    expect(ramo).toContain("<ValorETaxaDoTrabalho");
    expect(ramo).toContain('fetch("/api/admin/trabalhos-clyon"');
    expect(ramo).toContain('accao: "valor"');
    expect(FORMULARIO).toContain('r.recomeco.porque === "trabalho_clyon"');
    expect(FORMULARIO).toContain("a oferta continua como estava");
  });
});
