import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { avisoDeTrabalhoRepostoAoProfissional } from "./aviso-de-oferta-clyon";

/**
 * RESTAURAR UM CANCELADO E DUPLICAR UM PEDIDO — 16-10-2026.
 *
 * *«Coloque no editar pedido a opção de duplicar»* e *«coloque a opção de
 * restaurar pedido cancelado»*, nos Trabalhos CLYON. O que se guarda:
 *
 *   · restaurar volta a pôr o trabalho como estava — o cancelado pela memória
 *     do cancelamento, o arquivado pela do arquivo — sem email ao cliente, e
 *     avisa os profissionais que o cancelamento tinha avisado;
 *   · duplicar faz um pedido NOVO pela rota de criar, e o original não muda;
 *     a cópia de um Trabalho CLYON oferece-se a valor fixo, e só onde a
 *     oferta se pode fazer;
 *   · as fotografias que a cópia partilha com o original não se apagam
 *     quando o original sai.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
// Sem comentários — a regra ancorada ao início da linha (ver
// tirar-comentarios-sem-comer-codigo.test.ts).
const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const DB = ler("src/lib/db.ts");
const ROTA = semNotas(ler("src/app/api/admin/trabalhos-clyon/route.ts"));
const PAINEL = semNotas(ler("src/components/admin/AdminTrabalhosClyonPanel.tsx"));
const FORM = semNotas(ler("src/components/admin/RegistarPedido.tsx"));
const AVISAR = semNotas(ler("src/lib/avisar-trabalho-clyon.ts"));

const corpoDe = (fonte: string, nome: string) => {
  const i = fonte.indexOf(`export async function ${nome}(`);
  expect(i, `${nome} não existe`).toBeGreaterThan(-1);
  const seguinte = fonte.slice(i + 1).search(/\n(export |\/\*\*)/);
  return fonte.slice(i, seguinte < 0 ? undefined : i + 1 + seguinte);
};

describe("o aviso de que o trabalho voltou", () => {
  const base = {
    pedidoId: 442,
    servico: "recolha_moveis",
    localidade: "Barreiro",
    valor: 160,
    ganhos: 128,
    link: "https://clyon.pt/profissionais/painel",
  };
  const agora = new Date("2026-10-16T10:00:00Z");

  it("a quem o tinha: continua a ser seu, com o que ganha e o painel", () => {
    const t = avisoDeTrabalhoRepostoAoProfissional("Manuel Martins", { ...base, eraDele: true, jaAceitou: false }, agora);
    expect(t).toContain("(#442) já não está cancelado: continua a ser seu");
    expect(t).toContain("ganhos estimados de 128,00 €");
    expect(t).toContain(base.link);
    expect(t).not.toContain("Deseja aceitar");
  });

  it("a quem estava oferecido: voltou, com o valor e os ganhos, e pergunta", () => {
    const t = avisoDeTrabalhoRepostoAoProfissional("Jean", { ...base, eraDele: false, jaAceitou: false }, agora);
    expect(t).toContain("voltou a estar disponível, no valor de 160,00 € — ganhos estimados de 128,00 €");
    expect(t).toContain("Deseja aceitar este trabalho?");
  });

  it("a quem já tinha aceitado: não se pergunta outra vez", () => {
    const t = avisoDeTrabalhoRepostoAoProfissional("Jean", { ...base, eraDele: false, jaAceitou: true }, agora);
    expect(t).toContain("A sua resposta continua de pé");
    expect(t).not.toContain("Deseja aceitar");
  });

  it("vai aos mesmos que o cancelamento avisou, pelas regras dos avisos de valor novo", () => {
    const i = AVISAR.indexOf("export async function avisarRegressoDoTrabalhoClyon(");
    const corpo = AVISAR.slice(i, AVISAR.indexOf("export async function", i + 10));
    expect(corpo).toContain('assistentePode("avisar_profissional")');
    expect(corpo).toContain("if (!q.eraDele && !q.avisaPorWhatsApp) continue;");
    // Quem o tinha, já; os outros pela fila, que respeita as horas e a vontade deles.
    expect(corpo).toContain("substituirAvisoPorSairAoProfissional(a.pedidoId, q.providerId)");
    expect(corpo).toContain("reporAvisoAoProfissional(");
  });
});

describe("restaurar", () => {
  it("o cancelado volta pela memória do cancelamento; o arquivado, sem o email ao cliente", () => {
    const corpo = corpoDe(DB, "restaurarPedidoArrumado");
    expect(corpo).toContain('if (estadoAntes === "cancelado") {');
    expect(corpo).toContain("await reabrirPedidoCancelado(pedidoId)");
    expect(corpo).toContain("await reabrirNegociacoesDeUmPedidoArrumado(pedidoId)");
    // Pela base: `updateSimulatorOrder` mandava ao cliente o email da mudança de estado.
    expect(corpo).not.toContain("updateSimulatorOrder(");
    // E só mexe se ainda estiver como estava — dois cliques não restauram duas vezes.
    expect(corpo).toContain("WHERE id = ? AND status = ?");
  });

  it("a rota só restaura um Trabalho CLYON arrumado, avisa, e escreve no histórico", () => {
    const i = ROTA.indexOf('if (accao === "restaurar") {');
    expect(i).toBeGreaterThan(-1);
    const ramo = ROTA.slice(i, ROTA.indexOf('if (accao === "preco") {', i));
    expect(ramo).toContain("if (pedido.valorFixoClyon == null)");
    expect(ramo).toContain("if (!pedidoArrumado(pedido.status))");
    expect(ramo).toContain("await restaurarPedidoArrumado(pedidoId)");
    expect(ramo).toContain("await quemTemOTrabalhoClyon(pedidoId)");
    expect(ramo).toContain("await avisarRegressoDoTrabalhoClyon(");
    expect(ramo).toContain("appendOrderHistory(pedidoId");
    expect(ramo).toContain('acontecimento: "pedido_reaberto"');
  });

  it("o botão só aparece nos cancelados, e pede confirmação", () => {
    const cartao = PAINEL.slice(PAINEL.indexOf("function CartaoDoTrabalho("));
    expect(cartao).toMatch(/\{r\.fase === "cancelada" && \(\s*<button\s+onClick=\{onRestaurar\}/);
    expect(PAINEL).toContain("onRestaurar={() => restaurar(t)}");
    const restaurar = PAINEL.slice(PAINEL.indexOf("function restaurar("), PAINEL.indexOf("useEffect(", PAINEL.indexOf("function restaurar(")));
    expect(restaurar).toContain("window.confirm(");
    expect(restaurar).toContain('accao: "restaurar"');
  });

  it("quem já tinha aceitado sabe-se pela negociação", () => {
    const corpo = corpoDe(DB, "quemTemOTrabalhoClyon");
    expect(corpo).toContain('jaAceitou: n.estado === "aguarda_contratacao"');
  });
});

describe("duplicar", () => {
  it("o botão está no editor, e só em edição", () => {
    expect(FORM).toMatch(/\{editarId != null && !copia && !aCarregarPedido && \(\s*<button\s+onClick=\{duplicar\}/);
    expect(FORM).toContain("Duplicar");
  });

  it("a cópia cria um pedido novo pela rota de criar — o original não se grava", () => {
    expect(FORM).toContain("const idEmEdicao = copia ? null : editarId;");
    expect(FORM).toContain("const aGravarEm = idEmEdicao ?? criadoId;");
    expect(FORM).toContain('aGravarEm != null ? `/api/admin/pedidos/${aGravarEm}/editar` : "/api/admin/pedidos/criar"');
    // O pré-preenchimento não volta a escrever o original por cima da cópia.
    expect(FORM).toContain("if (editarId == null || !token || copia) return;");
    // O valor e a taxa do ORIGINAL não se mudam a partir da cópia.
    const duplicar = FORM.slice(FORM.indexOf("function duplicar("), FORM.indexOf("function fechar("));
    expect(duplicar).toContain("setValorFixo(null);");
    expect(FORM).toContain("if (!token || idEmEdicao == null || taxaClyon == null) return;");
    expect(FORM).toContain("pedidoId: idEmEdicao, accao: \"valor\"");
  });

  it("calcular outra vez corrige o pedido que acabou de ser criado, em vez de criar outro", () => {
    expect(FORM).toContain('if (aGravarEm == null && typeof dados.id === "number") setCriadoId(dados.id);');
    const limpar = FORM.slice(FORM.indexOf("function limpar("), FORM.indexOf("async function escolherFotos("));
    expect(limpar).toContain("setCriadoId(null);");
  });

  it("a cópia de um Trabalho CLYON oferece-se a valor fixo, e só onde a oferta se faz", () => {
    // RegistarPedido não leva o formulário da oferta: ele pede a lista dos
    // profissionais, que quem só tem a Agenda ou o WhatsApp não pode ler.
    expect(FORM).not.toContain("FormularioDaOferta");
    expect(FORM).toContain("if (valorFixo != null && !ofertaDaCopia) {");
    expect(FORM).toContain("oferta={clyonDaCopia && ofertaDaCopia ? (o) => ofertaDaCopia(o, clyonDaCopia) : oferta}");
    // No painel dos Trabalhos CLYON, com o valor e a taxa do original.
    const i = PAINEL.indexOf("editarId={aEditar}");
    const editor = PAINEL.slice(i, PAINEL.indexOf("</div>", i));
    expect(editor).toContain("ofertaDaCopia={(r, original) => (");
    expect(editor).toContain("valorInicial={original.valor}");
    expect(editor).toContain("taxaInicial={original.taxa}");
  });

  it("«Deixar só no backoffice» de uma cópia fecha, e não volta ao original", () => {
    expect(FORM).toContain("onNovo={copia ? fechar : limpar}");
  });
});

describe("as fotografias que a cópia partilha", () => {
  it("apagar um pedido não leva as que outro pedido ainda usa", () => {
    const apagar = corpoDe(DB, "deleteSimulatorOrder");
    const commit = apagar.indexOf("await conn.commit();");
    const blob = apagar.indexOf("apagarFotosDoBlob(await semAsQueOutroPedidoUsa(fotos))");
    expect(commit).toBeGreaterThan(-1);
    expect(blob).toBeGreaterThan(commit);
  });

  it("procura nos dois sítios onde um pedido guarda fotografias, com o LIKE escapado, e na dúvida fica", () => {
    const corpo = corpoDe(DB, "semAsQueOutroPedidoUsa");
    expect(corpo).toContain("filesJson LIKE ? OR rawOrderJson LIKE ?");
    expect(corpo).toContain("url.replace(/[\\\\%_]/g");
    // Um erro ao perguntar não a põe na lista das que saem.
    const erro = corpo.indexOf("} catch (e) {");
    expect(erro).toBeGreaterThan(-1);
    expect(corpo.slice(erro, erro + 200)).not.toContain("livres.push");
  });
});
