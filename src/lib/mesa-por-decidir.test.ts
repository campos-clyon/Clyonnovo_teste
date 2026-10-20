import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SECCOES_DA_MESA,
  assistenteComSeccoesPodeChamar,
  normalizarSeccoes,
  seccoesGuardadas,
} from "./papel-do-painel";

/**
 * A MESA E OS TRABALHOS CLYON NUM SÓ — fase 1, 20-10-2026.
 *
 * *«Que seja recebido e criado tudo num lugar só, em que a gente só decide se
 * ele será um trabalho com valor fixo ou de negociação entre os
 * profissionais.»* — o dono. Decidiu também juntar as duas permissões.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const REGISTO = ler("src/components/admin/RegistarPedido.tsx");
const TRABALHOS = ler("src/components/admin/TrabalhoClyon.tsx");
const ASSISTENTES = ler("src/components/admin/AdminAssistentesPanel.tsx");

describe("a permissão da Mesa é uma só", () => {
  it("quem tem uma das duas metades fica com as duas — ao gravar e ao ler", () => {
    expect([...SECCOES_DA_MESA]).toEqual(["negociacoes_clyon", "trabalhos_clyon"]);
    expect(normalizarSeccoes(["negociacoes_clyon"])).toEqual(["negociacoes_clyon", "trabalhos_clyon"]);
    expect(normalizarSeccoes(["agenda", "trabalhos_clyon"])).toEqual(["negociacoes_clyon", "trabalhos_clyon", "agenda"]);
    expect(seccoesGuardadas(JSON.stringify(["trabalhos_clyon"]))).toEqual(["negociacoes_clyon", "trabalhos_clyon"]);
    // Sem nenhuma, não ganha nenhuma.
    expect(normalizarSeccoes(["agenda"])).toEqual(["agenda"]);
  });

  it("e as rotas abrem-se das duas: quem só tinha o valor fixo responde na Mesa", () => {
    const so = seccoesGuardadas(JSON.stringify(["trabalhos_clyon"]));
    expect(assistenteComSeccoesPodeChamar(so, "/api/admin/negociacoes/agir", "POST")).toBe(true);
    const outra = seccoesGuardadas(JSON.stringify(["negociacoes_clyon"]));
    expect(assistenteComSeccoesPodeChamar(outra, "/api/admin/trabalhos-clyon", "PATCH")).toBe(true);
  });

  it("no painel dos Assistentes é uma caixa só, e desmarcá-la tira as duas", () => {
    expect(ASSISTENTES).toContain('SECCOES_DO_ASSISTENTE.filter((s) => s !== "trabalhos_clyon")');
    expect(ASSISTENTES).toContain("{SECCOES_A_ESCOLHER.map((s) => {");
    expect(ASSISTENTES).toContain("? normalizarSeccoes([...valor, s])");
    expect(ASSISTENTES).toContain("!(SECCOES_DA_MESA.includes(s) && SECCOES_DA_MESA.includes(x))");
  });
});

describe("o «Por decidir»", () => {
  it("é o antigo «Por enviar», e diz que tudo entra ali", () => {
    const i = MESA.indexOf('chave: "porEnviar",');
    const bloco = MESA.slice(i, MESA.indexOf("visivelEm", i));
    expect(bloco).toContain('titulo: "Por decidir",');
    expect(bloco).toContain("site, WhatsApp ou registado aqui");
  });

  it("cada linha tem as duas escolhas: «Valor fixo» primeiro, depois a «Negociação» com o seu valor", () => {
    const linha = MESA.slice(MESA.indexOf("function PedidosPorPromover("));
    const fixo = linha.indexOf("          Valor fixo\n");
    const caixa = linha.indexOf('placeholder="conta CLYON"');
    const negociacao = linha.indexOf("        Negociação\n");
    expect(fixo).toBeGreaterThan(-1);
    expect(fixo).toBeLessThan(caixa);
    expect(caixa).toBeLessThan(negociacao);
    expect(linha).not.toContain("          Trabalho CLYON\n");
  });
});

describe("um só registo, que acaba na mesma escolha", () => {
  it("o passo 2 pergunta «Como segue?» quando quem chama dá o valor fixo", () => {
    expect(REGISTO).toContain("escolherValorFixo?: (r: { id: number; alcance: Alcance | null; valorDePartida: number | null }) => ReactNode;");
    expect(REGISTO).toContain("Como segue?");
    expect(REGISTO).toContain('{escolherValorFixo ? "Negociação — enviar aos profissionais" : "Enviar aos profissionais"}');
    expect(REGISTO).toContain('{escolherValorFixo ? "Decidir depois" : "Deixar só no backoffice"}');
  });

  it("a Mesa passa-o, com o formulário de sempre", () => {
    const i = MESA.indexOf("escolherValorFixo={");
    expect(i).toBeGreaterThan(-1);
    const corpo = MESA.slice(i, MESA.indexOf("/>", MESA.indexOf("<FormularioDaOferta", i)));
    expect(corpo).toContain("podeOferecerTrabalhoClyon");
    expect(corpo).toContain("onOferecido={(msg) => void trabalhoClyonOferecido(msg)}");
  });

  it("e os Trabalhos CLYON já não têm registo próprio", () => {
    expect(TRABALHOS).not.toContain("oferta={(r) => (");
  });
});

describe("os de valor fixo ficam na Mesa (fase 2)", () => {
  it("o cartão de valor fixo traz as acções e as janelas dele, e a Mesa usa-o", () => {
    expect(TRABALHOS).toContain("export function TrabalhoClyonComAccoes({");
    const c = TRABALHOS.slice(TRABALHOS.indexOf("export function TrabalhoClyonComAccoes({"), TRABALHOS.indexOf("function CartaoDoTrabalho({"));
    for (const accao of ["escolher", "confirmar", "valor", "cancelar", "restaurar", "avaliar", "proposta", "reoferecer"]) {
      expect(c, accao).toContain(accao);
    }
    expect(c).toContain("<JanelaDeCancelarTrabalho");
    expect(c).toContain("<PedidoDetailModal");
    expect(c).toContain("editarId={aEditar}");
    expect(MESA).toContain('} from "./TrabalhoClyon";');
    expect(MESA).toContain("<TrabalhoClyonComAccoes");
  });

  it("vêm com a mesa, pela rota deles, e só no ecrã inteiro", () => {
    expect(MESA).toContain('const comValorFixo = podeOferecerTrabalhoClyon && mostrar === "tudo";');
    expect(MESA).toContain("if (r3.ok) setTrabalhosClyon((await r3.json()).trabalhos ?? []);");
  });

  it("cada bloco deles cai num bloco da Mesa; os arquivados ficam com os cancelados", () => {
    const m = MESA.slice(MESA.indexOf("const BLOCO_NA_MESA"), MESA.indexOf("const BLOCOS"));
    expect(m).toContain('feito: "porConfirmar",');
    expect(m).toContain('precisa: "n1",');
    expect(m).toContain('espera: "n2",');
    expect(m).toContain('atribuidos: "n3",');
    expect(m).toContain('concluidos: "concluidos",');
    expect(m).toContain('arquivados: "cancelados",');
    expect(m).not.toContain("aguardaCliente:");
    expect(MESA).toContain("pedidosDoBloco(chave).length + clyonDoBloco(chave).length");
  });

  it("juntos no bloco, do mais recente para trás, cada um com a etiqueta do tipo", () => {
    expect(MESA).toContain(".sort((x, y) => y.id - x.id)");
    expect(MESA).toMatch(/<TrabalhoClyonComAccoes\s+t=\{t\}\s+comTipo/);
    expect(TRABALHOS).toContain("{comTipo && (");
    const negociacao = MESA.indexOf("                  Negociação\n                </span>");
    expect(negociacao).toBeGreaterThan(-1);
  });

  it("o filtro do tipo: todos, só valor fixo, só negociação — e o «Por decidir» só em «Todos»", () => {
    expect(MESA).toContain('const [tipo, setTipo] = useState<"todos" | "fixo" | "negociacao">("todos");');
    expect(MESA).toContain('(tipo === "fixo" ? [] : pedidos)');
    expect(MESA).toContain('aFiltrarProfissional || tipo !== "todos"');
    expect(MESA).toContain('tipo === "negociacao"');
  });

  it("os que precisam de si também têm o «Salte para um», e os concluídos por ver contam", () => {
    expect(MESA).toContain('{clyonDoBloco("n1").map((t) => (');
    expect(MESA).toContain("onClick={() => irAoTrabalhoClyon(t.pedidoId)}");
    expect(MESA).toContain('clyonDoBloco("concluidos").filter((t) => !t.concluidoVistoEm).length');
  });
});

describe("um lote e um ecrã para os dois (fase 3)", () => {
  const PAINEL = ler("src/components/admin/LegacyAdminClient.tsx");

  it("os de valor fixo marcam-se na Mesa, como as negociações", () => {
    const uso = MESA.slice(MESA.indexOf("<TrabalhoClyonComAccoes"));
    expect(uso.slice(0, 900)).toContain("marcado={marcados.has(t.pedidoId)}");
    expect(uso.slice(0, 900)).toContain("onMarcar={() => marcar(t.pedidoId)}");
    expect(MESA).toContain("const idsClyon = useMemo(() => new Set(trabalhosClyon.map((t) => t.pedidoId)), [trabalhosClyon]);");
  });

  it("confirmar os feitos: os de valor fixo sem as perguntas do pagamento, pela rota deles", () => {
    const f = MESA.slice(MESA.indexOf("async function confirmarOsDeValorFixo("), MESA.indexOf("async function confirmarSoOsDeValorFixo("));
    expect(f).toContain('await fetch("/api/admin/trabalhos-clyon/confirmar", {');
    expect(f).toContain("semProva: false");
    expect(MESA).toContain("if (!marcadosAConfirmar().some((p) => p.negociacao && p.podeConfirmar)) void confirmarSoOsDeValorFixo();");
    expect(MESA).toContain("const r = await confirmarOsDeValorFixo(clyonFeitosMarcados);");
  });

  it("arquivar: cada um pela sua rota — os de valor fixo avisam quem os tinha", () => {
    const f = MESA.slice(MESA.indexOf("async function arquivarMarcados("), MESA.indexOf("async function arquivarOsDeValorFixo("));
    expect(f).toContain("await arquivarPedidos([...marcados].filter((id) => !idsClyon.has(id)));");
    expect(f).toContain("await arquivarOsDeValorFixo(deValorFixo.map((t) => t.pedidoId));");
    expect(MESA).toContain('body: JSON.stringify({ pedidoId, accao: "arquivar" }),');
  });

  it("reenviar é só das negociações; apagar conta a data dos dois", () => {
    expect(MESA).toContain("const ids = [...marcados].filter((id) => !idsClyon.has(id));");
    expect(MESA).toContain("[...marcados].every((id) => idsClyon.has(id))");
    expect(MESA).toContain(".map((t) => ({ pedidoId: t.pedidoId, quando: t.resumo.atribuida?.dataCombinada ?? t.dataAgendada })),");
  });

  it("o separador «Trabalhos CLYON» saiu: os links antigos abrem a Mesa, e a Mesa conta as novidades das duas metades", () => {
    expect(PAINEL).toContain('const ECRA_DOS_PEDIDOS: AdminSection[] = ["negociacoes_clyon", "pedidos"];');
    expect(PAINEL).toContain('negociacoes_clyon: ["negociacoes_clyon", "trabalhos_clyon"],');
    expect(PAINEL).toContain('return s === "trabalhos_clyon" ? "negociacoes_clyon" : s;');
    expect(PAINEL).toContain('if (activeSection === "trabalhos_clyon") setActiveSection("negociacoes_clyon");');
    expect(PAINEL).toContain("const seccao = ecraDaSeccao(pedida as AdminSection);");
    expect(PAINEL).not.toContain("AdminTrabalhosClyonPanel");
  });

  it("o ficheiro do cartão já não tem página", () => {
    expect(TRABALHOS).not.toContain("export default function");
    expect(TRABALHOS).not.toContain("function CartaoDoPedidoFechado(");
  });
});
