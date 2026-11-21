import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A SECÇÃO ASSISTENTES ARRUMADA — d81, 21-11-2026 (CEO e dono).
 *
 * «Demasiados textos longos e blocos soltos.» As explicações passaram a um
 * «?» ao lado do título, cada pessoa tem um cartão (nome e papel, código,
 * secções, comissão, «Gerir»), o bloco «Códigos para entrar» desapareceu, a
 * presença nasce recolhida e as desactivadas ficam no fim, recolhidas.
 *
 * A regra da d81 é que NADA SE PERDE. Este teste lista cada acção que a
 * secção tinha e exige que continue lá — e no sítio novo.
 */

function ler(f: string): string {
  return readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
}

/** Tira os comentários de bloco que começam a linha e as linhas `//` — nunca o `/*` de dentro de uma string. */
function semComentarios(s: string): string {
  return s
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");
}

const PAINEL = semComentarios(ler("src/components/admin/AdminAssistentesPanel.tsx"));
const CODIGOS = semComentarios(ler("src/components/admin/CodigosParaEntrar.tsx"));
const PRESENCA = semComentarios(ler("src/components/admin/AdminPresencaPanel.tsx"));
const TRABALHOS = semComentarios(ler("src/components/admin/TrabalhosDoAssistente.tsx"));
const AJUDA = semComentarios(ler("src/components/admin/Ajuda.tsx"));
const LEGACY = ler("src/components/admin/LegacyAdminClient.tsx");

/** O «Gerir» de uma assistente: o que só aparece com o cartão aberto. */
const GERIR = (() => {
  const i = PAINEL.indexOf("{estaAberto && (");
  const fim = PAINEL.indexOf("</article>", i);
  if (i < 0 || fim < i) throw new Error("o Gerir não se encontrou");
  return PAINEL.slice(i, fim);
})();

/** O cartão de uma assistente, de ponta a ponta. */
const CARTAO = (() => {
  const i = PAINEL.indexOf("const cartao = (a: Assistente) =>");
  if (i < 0) throw new Error("o cartão não se encontrou");
  return PAINEL.slice(i, PAINEL.indexOf("</article>", i));
})();

describe("nada se perde (d81)", () => {
  it("criar conta: o botão no topo, o formulário com nome, código, secções e comissão", () => {
    expect(PAINEL).toContain("async function criar()");
    expect(PAINEL).toContain("Criar assistente");
    expect(PAINEL).toContain('placeholder="NOME (sem espaços)"');
    expect(PAINEL).toContain('aria-label="Código para entrar da conta nova"');
    expect(PAINEL).toContain("<EscolhaDeSeccoes valor={seccoesNovas} onChange={setSeccoesNovas} />");
    expect(PAINEL).toContain("...(escrito ? { codigo: codigoNovo } : { gerarCodigo: true })");
  });

  it("o cartão de cada pessoa: nome e papel, código, secções, comissão e «Gerir»", () => {
    expect(CARTAO).toContain("{a.nome}");
    expect(CARTAO).toContain("assistente · {percent(a.comissaoPercent)} do lucro");
    expect(CARTAO).toContain("<EstadoDoCodigo conta={conta} codigos={codigos} />");
    expect(CARTAO).toContain("{nSeccoes} de {SECCOES_A_ESCOLHER.length}");
    for (const r of ["Este período", "Por pagar", "Pago"]) expect(CARTAO).toContain(`>${r}</dt>`);
    expect(CARTAO).toMatch(/aria-expanded=\{estaAberto\}[\s\S]*?Gerir/);
  });

  it("no «Gerir»: secções, comissão (% e «todos/só os dela»), dia de saída e trabalhos por excepção", () => {
    expect(GERIR).toContain("<EscolhaDeSeccoes");
    expect(GERIR).toContain("agir({ id: a.id, seccoes }, a.id)");
    expect(GERIR).toContain("className={CAIXA_DA_PERCENTAGEM}");
    expect(GERIR).toContain("agir({ id: a.id, comissaoPercent: rascunho }, a.id)");
    expect(GERIR).toContain("agir({ id: a.id, comissaoSobre: valor }, a.id)");
    expect(GERIR).toContain('["todos", "Todos os trabalhos"]');
    expect(GERIR).toContain('["seus", "Só os dela"]');
    expect(GERIR).toContain("agir({ id: a.id, saiuA: dia }, a.id)");
    expect(GERIR).toContain("agir({ id: a.id, saiuA: null }, a.id)");
    expect(GERIR).toContain("excepcaoDaSaida: { pedidoId: pid, marcar: true }");
    expect(GERIR).toContain("excepcaoDaSaida: { pedidoId: pid, marcar: false }");
    expect(GERIR).toContain("tirar");
    expect(GERIR).toContain("Conta para {a.nome}");
  });

  it("no «Gerir»: os períodos (resumo entre datas, previsão, pagar, anular, CSV, relatório geral)", () => {
    expect(GERIR).toContain("<TrabalhosDoAssistente");
    expect(GERIR).toContain("gerir={(corpo) => agir({ id: a.id, ...corpo }, a.id)}");
    expect(TRABALHOS).toContain("Resumo entre datas");
    expect(TRABALHOS).toContain("Ver resumo");
    expect(TRABALHOS).toContain("function TabelaDaPrevisao(");
    expect(TRABALHOS).toContain("Marcar como pago");
    expect(TRABALHOS).toMatch(/Anular o pagamento/);
    expect(TRABALHOS).toContain('type: "text/csv;charset=utf-8"');
    expect(TRABALHOS).toContain("Descarregar relatório (CSV)");
    expect(TRABALHOS).toContain("relatorioDasComissoes(d.periodos, previsao)");
  });

  it("os códigos: gerar e escrever no cartão, mostrado uma vez, e o registo no «Gerir»", () => {
    expect(CODIGOS).toContain("Gerar código");
    expect(CODIGOS).toContain("Escrever código");
    expect(CODIGOS).toContain("Guardar código");
    expect(CODIGOS).toContain("body: JSON.stringify({ codigoDeEntrada: { id: conta.id, ...corpo } })");
    expect(CODIGOS).toContain("Tem código desde");
    // Trocar o código de alguém avisa antes; a própria sessão nova guarda-se.
    expect(CODIGOS).toContain("O antigo deixa de servir e as sessões abertas fecham-se.");
    expect(CODIGOS).toContain('localStorage.setItem("colaborador_token", dados.sessaoNova)');
    expect(PAINEL.match(/<CodigoMostradoUmaVez/g)).toHaveLength(2);
    expect(GERIR).toContain("<RegistoDasTrocas nome={a.nome} registo={codigos.registo} />");
  });

  it("a conta do administrador também tem cartão, só com o código", () => {
    const admin = PAINEL.slice(PAINEL.indexOf("const cartaoDoAdministrador ="), PAINEL.indexOf("const cartao ="));
    expect(admin).toContain("administrador");
    expect(admin).toContain("<EstadoDoCodigo conta={c} codigos={codigos} />");
    expect(admin).toContain("<RegistoDasTrocas nome={c.nome} registo={codigos.registo} />");
    expect(admin).not.toContain("<TrabalhosDoAssistente");
    expect(admin).not.toContain("Comissão");
    expect(PAINEL).toContain("{adminsAtivos.map(cartaoDoAdministrador)}");
  });

  it("desactivar e reactivar continuam no «Gerir»", () => {
    expect(GERIR).toContain("onClick={() => alternarEstado(a)}");
    expect(GERIR).toContain('"Desactivar"');
    expect(GERIR).toContain('"Reactivar"');
    expect(PAINEL).toContain("agir({ id: a.id, activo: !a.activo }, a.id)");
  });

  it("a presença: no meio, recolhida, só das ativas — a de uma desactivada no «Gerir» dela", () => {
    expect(LEGACY).toContain("<AdminAssistentesPanel presenca={<AdminPresencaPanel novasAoAbrir={novasAoAbrir.equipa ?? 0} />} />");
    expect(PRESENCA).toContain("const [calendarioAberto, setCalendarioAberto] = useState(false);");
    expect(PRESENCA).toContain("if (!calendarioAberto) {");
    expect(PRESENCA).toContain('"Ver o calendário"');
    for (const r of ["Hoje", "Semana", "Mês"]) expect(PRESENCA).toContain(`${r} <strong`);
    expect(PRESENCA).toContain("(soDe != null ? a.id === soDe : a.activo)");
    expect(PRESENCA).toContain("visiveis.has(m.colaboradorId)");
    expect(GERIR).toMatch(/\{!a\.activo && \([\s\S]*?<AdminPresencaPanel soDe=\{a\.id\} \/>/);
  });
});

describe("a arrumação (d81)", () => {
  it("as explicações estão atrás de um «?», e não no ecrã", () => {
    for (const texto of ["<TextoDoCabecalho />", "<TextoDaComissao />", "<TextoDosCodigos />"]) {
      const vezes = PAINEL.split(texto).length - 1;
      expect(vezes, texto).toBeGreaterThan(0);
      // Cada uso está dentro de um <Ajuda …> … </Ajuda>.
      const dentro = PAINEL.match(new RegExp(`<Ajuda sobre="[^"]+">\\s*${texto.replace(/[/]/g, "\\/")}\\s*</Ajuda>`, "g")) ?? [];
      expect(dentro.length, texto).toBe(vezes);
    }
    expect(PRESENCA).toMatch(/<Ajuda sobre="Presença e agendas">[\s\S]*?Informação interna, sem efeito nenhum/);
    // O bloco «Comissão sobre o lucro da CLYON» e o texto por baixo da lista saíram do ecrã.
    expect(PAINEL).not.toMatch(/<section[^>]*>\s*<h3[^>]*>[\s\S]{0,200}Comissão sobre o lucro da CLYON/);
    const lista = PAINEL.slice(PAINEL.indexOf("{assistentesAtivas.map(cartao)}"));
    expect(lista).not.toContain("A comissão conta-se por períodos");
    // E o parágrafo do cabeçalho saiu do LegacyAdminClient.
    expect(LEGACY).not.toContain("Os assistentes não gerem assistentes e não apagam");
  });

  it("o «?» é um botão a sério: teclado, Esc, toque fora", () => {
    expect(AJUDA).toContain('type="button"');
    expect(AJUDA).toContain("aria-expanded={aberta}");
    expect(AJUDA).toContain("aria-controls={id}");
    expect(AJUDA).toContain('e.key !== "Escape"');
    expect(AJUDA).toContain("botao.current?.focus()");
    expect(AJUDA).toContain('document.addEventListener("pointerdown", fora)');
    // No telemóvel ocupa a largura do bloco à volta, para não sair do ecrã.
    expect(AJUDA).toContain("absolute inset-x-0 top-full");
  });

  it("o bloco «Códigos para entrar» desapareceu", () => {
    expect(CODIGOS).not.toMatch(/export default function/);
    expect(PAINEL).not.toContain("<CodigosParaEntrar");
    expect(PAINEL).not.toMatch(/>\s*Códigos para entrar\s*</);
  });

  it("a ordem: título com o resumo e os botões, contas ativas, presença, desactivadas", () => {
    const titulo = PAINEL.indexOf('<h2 className="text-2xl font-semibold text-white">Assistentes</h2>');
    const nova = PAINEL.indexOf("onClick={() => setNovaAberta((v) => !v)}");
    const resumo = PAINEL.indexOf("comissões por pagar ${euros(totalPorPagar)}");
    const ativas = PAINEL.indexOf("{assistentesAtivas.map(cartao)}");
    const presenca = PAINEL.indexOf("{presenca && (");
    const presencaSimples = PAINEL.indexOf("{presenca && <div");
    const meio = presenca > -1 ? presenca : presencaSimples;
    const desactivadas = PAINEL.indexOf("Desactivadas ({nDesactivadas})");
    expect(titulo).toBeGreaterThan(-1);
    expect(nova).toBeGreaterThan(titulo);
    expect(resumo).toBeGreaterThan(nova);
    expect(ativas).toBeGreaterThan(resumo);
    expect(meio).toBeGreaterThan(ativas);
    expect(desactivadas).toBeGreaterThan(meio);
  });

  it("as desactivadas nascem recolhidas e abrem ao tocar", () => {
    expect(PAINEL).toContain("const [desactivadasAbertas, setDesactivadasAbertas] = useState(false);");
    expect(PAINEL).toContain("onClick={() => setDesactivadasAbertas((v) => !v)}");
    const i = PAINEL.indexOf("{desactivadasVisiveis && (");
    expect(i).toBeGreaterThan(PAINEL.indexOf("Desactivadas ({nDesactivadas})"));
    expect(PAINEL.slice(i)).toContain("{assistentesDesactivadas.map(cartao)}");
    expect(PAINEL.slice(0, i)).not.toContain("{assistentesDesactivadas.map(cartao)}");
  });

  it("sem pílula por cima do título nem caminho à vista", () => {
    const seccao = LEGACY.slice(LEGACY.indexOf('{activeSection === "equipa" && papel === "admin" && ('));
    const ate = seccao.slice(0, seccao.indexOf("</section>"));
    expect(ate).not.toMatch(/uppercase tracking-\[0\.2\d?em\]/);
    expect(ate).not.toContain("Início /");
    expect(PAINEL).not.toContain("Início /");
  });
});
