import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assistenteComSeccoesPodeChamar } from "./papel-do-painel";

/**
 * AS NEGOCIAÇÕES LIGADAS AOS TRABALHOS CLYON — 06-10-2026.
 *
 * *«Vamos criar uma conexão dos trabalhos nas negociações com os Trabalhos
 * CLYON, assim poderemos enviar os trabalhos com valor fixo.»*
 *
 * As decisões dele, no mesmo dia: só os pedidos do «Por enviar» (os que ainda
 * não foram a ninguém) passam a Trabalho CLYON; e, depois de oferecido, o
 * pedido fica só nos Trabalhos CLYON — é lá que se escolhe quem o faz.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
// Sem comentários — a regra ancorada ao início da linha (ver
// tirar-comentarios-sem-comer-codigo.test.ts).
const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const MESA = semNotas(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
const PAINEL = semNotas(ler("src/components/admin/LegacyAdminClient.tsx"));
const PAGINA = semNotas(ler("src/components/admin/AdminTrabalhosClyonPanel.tsx"));
const DB = semNotas(ler("src/lib/db.ts"));
const AGIR = semNotas(ler("src/app/api/admin/negociacoes/agir/route.ts"));

describe("o «Por enviar» oferece a valor fixo", () => {
  it("o botão está na linha do «Por enviar», e só para quem o pode usar", () => {
    const i = MESA.indexOf("function PedidosPorPromover(");
    expect(i).toBeGreaterThan(-1);
    const bloco = MESA.slice(i);
    expect(bloco).toMatch(/\{onTrabalhoClyon && \(\s*<button/);
    expect(bloco).toContain("Trabalho CLYON");
    expect(MESA).toContain("podeOferecerTrabalhoClyon = false,");
    expect(MESA).toContain(
      "onTrabalhoClyon={podeOferecerTrabalhoClyon ? trabalhoClyonOferecido : undefined}",
    );
    expect(PAINEL).toContain('podeOferecerTrabalhoClyon={podeVer("trabalhos_clyon")}');
  });

  it("é o mesmo formulário da página dos Trabalhos CLYON, e não uma cópia", () => {
    expect(MESA).toContain('import { FormularioDaOferta } from "./FormularioDaOferta";');
    expect(PAGINA).toContain('import { FormularioDaOferta } from "@/components/admin/FormularioDaOferta";');
    expect(PAGINA).not.toContain("export function FormularioDaOferta(");

    // E o alcance é o da rota que a lista do «Escolher» já usa.
    const i = MESA.indexOf("function OferecerComoTrabalhoClyon(");
    expect(i).toBeGreaterThan(-1);
    const corpo = MESA.slice(i, MESA.indexOf("const COR_DE_POR_ENVIAR", i));
    expect(corpo).toContain("fetch(`/api/admin/negociacoes/alcance?pedidoId=${pedidoId}`");
    expect(corpo).toContain("<FormularioDaOferta");
  });

  it("depois de oferecido, a mesa recarrega e o aviso leva aos Trabalhos CLYON", () => {
    const i = MESA.indexOf("async function trabalhoClyonOferecido(");
    expect(i).toBeGreaterThan(-1);
    const corpo = MESA.slice(i, i + 600);
    expect(corpo).toContain('setAvisoLeva({ href: "?section=trabalhos_clyon"');
    expect(corpo).toContain("await carregar(true);");
  });
});

describe("e fica só nos Trabalhos CLYON", () => {
  it("a mesa das Negociações não traz os trabalhos de valor fixo", () => {
    const i = DB.indexOf("export async function pedidosComNegociacoes");
    expect(i).toBeGreaterThan(-1);
    const corpo = DB.slice(i, DB.indexOf("export async function", i + 10));
    expect(corpo).toContain("AND o.valorFixoClyon IS NULL");
  });

  it("um Trabalho CLYON que não chegou a ninguém não se envia a negociar", () => {
    // Fica no «Por enviar» (não tem negociações), mas já tem o valor fixo.
    const PROMOVER = semNotas(ler("src/app/api/admin/negociacoes/promover/route.ts"));
    const guarda = PROMOVER.indexOf("(pedido as { valorFixoClyon?: unknown }).valorFixoClyon != null");
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(PROMOVER.indexOf("distribuirPedido("));
  });

  it("e a rota das acções da mesa recusa negociar um trabalho de valor fixo", () => {
    expect(AGIR).toMatch(
      /if \(linha\.ofertaClyon && \(accao === "propor" \|\| accao === "aceitar" \|\| accao === "contratar"\)\)/,
    );
    // Antes de qualquer acção, logo a seguir a encontrar a negociação.
    expect(AGIR.indexOf("linha.ofertaClyon")).toBeLessThan(AGIR.indexOf('accao === "confirmar"'));
  });
});

describe("as contas antigas continuam sem chegar aos Trabalhos CLYON", () => {
  it("só com as Negociações, a rota da oferta continua fechada — com as duas, abre", () => {
    expect(assistenteComSeccoesPodeChamar(["negociacoes_clyon"], "/api/admin/trabalhos-clyon", "POST")).toBe(false);
    expect(
      assistenteComSeccoesPodeChamar(["negociacoes_clyon", "trabalhos_clyon"], "/api/admin/trabalhos-clyon", "POST"),
    ).toBe(true);
  });
});
