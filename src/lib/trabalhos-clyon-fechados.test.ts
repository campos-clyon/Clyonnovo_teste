import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * «Vamos deixar por padrão os pedidos fechados e só abrir com as informações
 * detalhadas quando forem clicados.» — o dono, 17-10-2026, nos Trabalhos CLYON.
 */
const P = readFileSync(join(process.cwd(), "src/components/admin/AdminTrabalhosClyonPanel.tsx"), "utf8").replace(
  /\r\n/g,
  "\n",
);
const CARTAO = P.slice(P.indexOf("function CartaoDoTrabalho("));

describe("os cartões dos Trabalhos CLYON", () => {
  it("nascem fechados — salvo quando são o único na lista", () => {
    expect(CARTAO).toContain("const [aberto, setAberto] = useState(abrirAoInicio);");
    expect(CARTAO).toContain("abrirAoInicio = false,");
    // Desde 19-10-2026: o do «Salte para um», ou o único que a procura encontrou.
    expect(P).toContain("abrirAoInicio={abrirId === t.pedidoId || (aProcurando && totalEncontrado === 1)}");
  });

  it("a linha de cima é o botão que abre e fecha", () => {
    const botao = CARTAO.indexOf("onClick={() => setAberto((v) => !v)}");
    expect(botao).toBeGreaterThan(-1);
    expect(CARTAO.slice(botao, botao + 120)).toContain("aria-expanded={aberto}");
  });

  it("o detalhe — a conta, os profissionais e os botões — só aparece aberto", () => {
    const abre = CARTAO.indexOf("{aberto && (");
    expect(abre).toBeGreaterThan(-1);
    for (const peca of ["<ContaDoPagamento conta={conta} />", "Oferecido a {r.enviados}", "Editar pedido", "Cancelar trabalho"]) {
      expect(CARTAO.indexOf(peca), peca).toBeGreaterThan(abre);
    }
  });
});
