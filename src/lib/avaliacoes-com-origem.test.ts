import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPOS_DO_FIM_CLYON, fimDoTrabalhoClyonParaOCliente, A_CLYON_CONFIRMA } from "./fim-do-trabalho-clyon";
import { sePagaPelaNegociacao } from "./trabalho-clyon-paga-se";
import { REGISTADA_PELA_CLYON, SQL_DA_EQUIPA, lerComoOClienteODisse } from "./origem-da-avaliacao";
import { negociacaoDoFimClyon } from "../../app-cliente/src/lib/pedidos";

/**
 * d6 — 31-10-2026: AS AVALIAÇÕES COM ORIGEM, E O FIM DO TRABALHO CLYON.
 *
 *   · cada avaliação nova grava a origem («cliente» ou «equipa») e quem a
 *     gravou — todas as chamadas a `avaliarProfissional` a dizem;
 *   · em nome do cliente, só o administrador, e com o «como o disse»;
 *   · as da equipa ficam fora das estrelas dos dados estruturados e mostram-se
 *     «Registada pela CLYON a pedido do cliente»;
 *   · num Trabalho CLYON, a parte do cliente (fase, datas, textos) e nenhum
 *     campo interno — nunca o valor do profissional nem a taxa.
 */

const RAIZ = join(__dirname, "..", "..");
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
/** Sem os comentários de linha nem de bloco (ancorados ao início da linha). */
const semComentarios = (s: string) => s.replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*$/gm, "").replace(/^[ \t]*\/\/.*$/gm, "").replace(/^[ \t]*\*.*$/gm, "");

function ficheiros(pasta: string): string[] {
  return readdirSync(join(RAIZ, pasta)).flatMap((n) => {
    const p = join(pasta, n);
    if (statSync(join(RAIZ, p)).isDirectory()) return ficheiros(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

describe("d6 — cada avaliação nova diz de onde vem", () => {
  it("a base guarda a origem, quem a gravou e como o cliente a deu (v15)", () => {
    const db = ler("src/lib/db.ts");
    expect(Number(/const VERSAO_DAS_NEGOCIACOES = (\d+);/.exec(db)?.[1])).toBeGreaterThanOrEqual(15);
    for (const c of ["avaliacaoOrigem VARCHAR(10)", "avaliadoPor VARCHAR(120)", "avaliacaoComoDisse VARCHAR(300)"]) {
      expect(db).toContain(`ALTER TABLE negociacoes ADD COLUMN ${c}`);
    }
    const f = db.slice(db.indexOf("export async function avaliarProfissional("), db.indexOf("export async function avaliacoesDoProfissional("));
    expect(f).toContain('quem: { origem: "cliente" | "equipa"; por: string | null; comoDisse?: string | null }');
    expect(f).toContain("avaliacaoOrigem = ?, avaliadoPor = ?, avaliacaoComoDisse = ?");
    // Uma da equipa nunca passa por cima de nada; a do cliente substitui a da equipa.
    expect(f).toContain(`: "avaliadoEm IS NULL"`);
    expect(f).toContain("avaliacaoOrigem = 'equipa'");
  });

  it("todas as chamadas a avaliarProfissional dizem a origem", () => {
    let chamadas = 0;
    for (const f of ficheiros("src")) {
      const s = semComentarios(ler(f));
      let i = s.indexOf("avaliarProfissional(");
      while (i > -1) {
        const antes = s.slice(Math.max(0, i - 30), i);
        if (!/function\s+$|export async function\s+$/.test(antes)) {
          chamadas++;
          expect(s.slice(i, i + 400), relative(RAIZ, join(RAIZ, f))).toMatch(/origem: "(cliente|equipa)"/);
        }
        i = s.indexOf("avaliarProfissional(", i + 1);
      }
    }
    expect(chamadas).toBeGreaterThanOrEqual(4);
  });

  it("em nome do cliente: só o administrador, e com o «como o cliente a deu»", () => {
    for (const rota of ["src/app/api/admin/negociacoes/agir/route.ts", "src/app/api/admin/trabalhos-clyon/route.ts"]) {
      const s = ler(rota);
      const bloco = s.slice(s.indexOf('if (accao === "avaliar") {'));
      const guarda = bloco.indexOf('if (colab?.papel !== "admin") return NextResponse.json({ error: SO_O_ADMINISTRADOR }, { status: 403 });');
      expect(guarda, rota).toBeGreaterThan(-1);
      expect(bloco.indexOf("lerComoOClienteODisse(corpo.comoDisse)"), rota).toBeGreaterThan(guarda);
      expect(bloco.indexOf("await avaliarProfissional("), rota).toBeGreaterThan(guarda);
      expect(bloco.slice(bloco.indexOf("await avaliarProfissional("), bloco.indexOf("await avaliarProfissional(") + 300)).toContain('origem: "equipa"');
    }
    expect(lerComoOClienteODisse("  ").ok).toBe(false);
    expect(lerComoOClienteODisse("tel")).toMatchObject({ ok: false });
    expect(lerComoOClienteODisse(" Por telefone,   a 31/10 ")).toEqual({ ok: true, texto: "Por telefone, a 31/10" });
    // O backoffice pede-o e manda-o pelas duas rotas.
    expect(ler("src/components/admin/AvaliarPelaClyon.tsx")).toContain("COMO_O_CLIENTE_O_DISSE.pergunta");
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toContain("estrelas, comentario, comoDisse }),");
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain("estrelas, comentario, comoDisse }),");
  });

  it("os dados estruturados contam só as dos clientes; a página mostra a etiqueta nas outras", () => {
    const pagina = semComentarios(ler("src/app/profissionais/[slug]/page.tsx"));
    const j = pagina.indexOf("aggregateRating = {");
    expect(j).toBeGreaterThan(-1);
    const decl = pagina.slice(j, j + 300);
    expect(decl).toContain("ratingValue: p.notaDosClientes");
    expect(decl).toContain("reviewCount: p.avaliacoesDosClientes");
    expect(pagina).toContain("{a.registadaPelaClyon && (");
    const lib = ler("src/lib/perfil-publico-do-profissional.ts");
    expect(lib).toContain("AVG(CASE WHEN n.estrelas IS NOT NULL AND NOT ${SQL_DA_EQUIPA()} THEN n.estrelas END) AS mediaDosClientes");
    expect(lib).toContain("${SQL_DA_EQUIPA()} AS daEquipa");
    // As da equipa: marcadas, ou de antes, num Trabalho CLYON ou gravadas pela equipa no registo.
    const sql = SQL_DA_EQUIPA();
    expect(sql).toContain("n.avaliacaoOrigem = 'equipa'");
    expect(sql).toContain("n.ofertaClyon IS NOT NULL");
    expect(sql).toContain("ra.autorTipo IN ('clyon', 'assistente')");
    expect(REGISTADA_PELA_CLYON).toBe("Registada pela CLYON a pedido do cliente");
    // E a app e o link do pedido também a mostram.
    expect(ler("src/lib/pedido-para-a-app.ts")).toContain("registada: a.registadaPelaClyon ? REGISTADA_PELA_CLYON : null,");
    expect(ler("app-cliente/src/componentes/Avaliacoes.tsx")).toContain("{item.registada ?");
  });
});

describe("d6 — o fim do Trabalho CLYON, só a parte do cliente", () => {
  const pedido = { valorFixoClyon: "300.00", taxaClyon: "0.15" };
  const linha = (o: Record<string, unknown> = {}) => ({
    id: 31,
    estado: "acordada",
    valorAcordado: "300.00",
    taxaProfissional: "0.15",
    taxaCliente: "0",
    profissionalNome: "Empresa Inventada",
    profissionalTelefone: "912345678",
    ofertaClyon: "distribuida",
    dataCombinada: new Date("2026-11-03T09:00:00Z"),
    execucaoEnviadaEm: null,
    confirmadoEm: null,
    pagoEm: null,
    estrelas: null,
    avaliadoEm: null,
    avaliacaoOrigem: null,
    ...o,
  });

  it("só os campos da lista: nunca o valor dele, a taxa, o telefone nem a oferta", () => {
    const f = fimDoTrabalhoClyonParaOCliente(pedido, [linha()])!;
    expect(Object.keys(f).sort()).toEqual([...CAMPOS_DO_FIM_CLYON].sort());
    const texto = JSON.stringify(f);
    for (const proibido of ["valorAcordado", "taxa", "912345678", "distribuida", "300", "255", "ofertaClyon"]) {
      expect(texto, proibido).not.toContain(proibido);
    }
    expect(f.textos).toEqual({
      quemFaz: "O trabalho é feito por Empresa Inventada, parceiro verificado na CLYON.",
      dia: "Dia combinado: terça-feira, 3 de novembro, às 09:00",
      aClyonConfirma: A_CLYON_CONFIRMA,
      pergunta: "Como correu com Empresa Inventada?",
    });
    expect(f).toMatchObject({ podePagar: true, podeAvaliar: false, estrelas: null });
  });

  it("depois de a CLYON confirmar, avalia; a «nota pela CLYON» não conta como dele e é substituída", () => {
    const confirmada = linha({ confirmadoEm: new Date("2026-11-03T15:00:00Z"), execucaoEnviadaEm: new Date("2026-11-03T14:00:00Z") });
    expect(fimDoTrabalhoClyonParaOCliente(pedido, [confirmada])).toMatchObject({ fase: "confirmado", podeAvaliar: true, textos: { aClyonConfirma: null } });
    // A nota da equipa (marcada, ou de antes num Trabalho CLYON): continua a poder avaliar.
    for (const origem of ["equipa", null]) {
      const f = fimDoTrabalhoClyonParaOCliente(pedido, [{ ...confirmada, estrelas: 4, avaliadoEm: new Date(), avaliacaoOrigem: origem }])!;
      expect(f, String(origem)).toMatchObject({ podeAvaliar: true, estrelas: null });
    }
    // A dele: fica, e não se avalia outra vez.
    const dele = fimDoTrabalhoClyonParaOCliente(pedido, [{ ...confirmada, estrelas: 5, avaliadoEm: new Date(), avaliacaoOrigem: "cliente" }])!;
    expect(dele).toMatchObject({ podeAvaliar: false, estrelas: 5 });
  });

  it("paga pela negociação só quando ela é o preço do cliente; um antigo (sem taxa) não", () => {
    expect(sePagaPelaNegociacao(pedido, { valorAcordado: "300.00" })).toBe(true);
    expect(sePagaPelaNegociacao(pedido, { valorAcordado: "255.00" })).toBe(false);
    expect(sePagaPelaNegociacao({ valorFixoClyon: "250.00", taxaClyon: null }, { valorAcordado: "250.00" })).toBe(false);
    expect(fimDoTrabalhoClyonParaOCliente({ valorFixoClyon: "250.00", taxaClyon: null }, [linha({ valorAcordado: "250.00" })])?.podePagar).toBe(false);
    expect(fimDoTrabalhoClyonParaOCliente({ valorFixoClyon: null }, [linha()])).toBeNull();
    expect(fimDoTrabalhoClyonParaOCliente(pedido, [linha({ estado: "aberta" })])).toBeNull();
    // E a porta do pagamento diz o mesmo, menos ao backoffice.
    const acesso = ler("src/lib/acesso-ao-pagamento.ts");
    expect(acesso).toContain("if (credencial.backoffice !== true && p.valorFixoClyon != null && !sePagaPelaNegociacao(p, linha)) {");
  });

  it("a app usa os ecrãs das negociações, sem telefone nem o «confirme» (quem confirma é a CLYON)", () => {
    const f = fimDoTrabalhoClyonParaOCliente(pedido, [linha({ confirmadoEm: new Date("2026-11-03T15:00:00Z") })])!;
    const n = negociacaoDoFimClyon({ ...f, pagamento: null });
    expect(n).toMatchObject({ id: 31, estado: "acordada", accoes: ["avaliar"], execucaoEnviadaEmTexto: null });
    expect(n.profissional).toMatchObject({ nome: "Empresa Inventada", telefone: null });
    const ecra = ler("app-cliente/src/componentes/TrabalhoClyon.tsx");
    for (const c of ["<Avaliar ", "<Pagar ", "<Acompanhar ", "fim.textos.dia", "fim.textos.aClyonConfirma"]) expect(ecra).toContain(c);
    expect(ecra).not.toContain("<TrabalhoFeito");
    // E o link do pedido, no site.
    const vista = ler("src/app/pedido/[token]/VistaDoPedido.tsx");
    expect(vista).toContain("fimDoTrabalhoClyonParaOCliente(");
    expect(vista).toContain("<FimDoTrabalhoClyon");
    expect(ler("src/components/FimDoTrabalhoClyon.tsx")).toContain('accao: "avaliar"');
  });

  it("agir como cliente aceita «avaliar» num Trabalho CLYON, pela negociação de quem o fez", () => {
    const s = ler("src/lib/agir-como-cliente.ts");
    const avaliar = s.indexOf('if (accao === "avaliar" && a.pedido.valorFixoClyon != null) {');
    const bloqueio = s.indexOf("if (a.pedido.valorFixoClyon != null) return falha(403, TRATADO_PELA_CLYON);");
    expect(avaliar).toBeGreaterThan(-1);
    expect(avaliar).toBeLessThan(bloqueio);
    const f = s.slice(s.indexOf("async function avaliarOTrabalhoClyon("));
    expect(f).toContain('origem: "cliente"');
    expect(f).toContain('falha(404, "Negociação não encontrada.")');
  });
});
