import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * OS TRABALHOS CLYON COM OS RECURSOS DA MESA — 19-10-2026.
 *
 * *«Quero que implemente todos os recursos da Mesa das negociações em
 * Trabalhos CLYON.»* — o dono, que escolheu: o ecrã como a Mesa (cartões de
 * resumo que filtram e blocos), fora o que só existe porque o cliente negoceia
 * sozinho, e confirmar continua a dar o dinheiro por recebido.
 *
 * Fase 1: os cartões, os blocos e o «Salte para um».
 * Fase 2: o que o cartão mostra (origem, telemóvel, bola, alcance, nota, por ver).
 * Fase 3: as acções (voltar a oferecer, prova, nota ao profissional, trocar,
 * enviar a proposta pela CLYON, ficha do pedido, cancelar com motivo).
 * Fase 4: marcar e agir em lote (confirmar os feitos, arquivar, apagar) e,
 * a procurar, ler todos.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const T = ler("src/components/admin/AdminTrabalhosClyonPanel.tsx");

describe("os blocos", () => {
  it("são sete, pela ordem do que pede alguém, e os três do fim começam fechados", () => {
    const ids = [...T.slice(T.indexOf("const BLOCOS"), T.indexOf("function blocoDoTrabalho")).matchAll(/id: "([a-z]+)",/g)].map((m) => m[1]);
    expect(ids).toEqual(["feito", "precisa", "espera", "atribuidos", "concluidos", "cancelados", "arquivados"]);
    const bloco = (id: string) => {
      const i = T.indexOf(`id: "${id}",`);
      return T.slice(i, T.indexOf("},", i));
    };
    for (const id of ["concluidos", "cancelados", "arquivados"]) expect(bloco(id), id).toContain("fechadoPorOmissao: true,");
    for (const id of ["feito", "precisa", "espera", "atribuidos"]) expect(bloco(id), id).not.toContain("fechadoPorOmissao");
    expect(bloco("feito")).toContain('fases: ["por_confirmar"],');
    expect(bloco("precisa")).toContain('fases: ["escolher", "sem_ninguem"],');
  });

  it("abrem e fecham pelo título, que fica preso em cima, e a procura abre os que têm resultados", () => {
    expect(T).toContain("onClick={() => alternarBloco(b.id)}");
    expect(T).toContain('className="sticky top-0 z-10 flex w-full items-center gap-3');
    expect(T).toContain("(aProcurando && quantosEm(id) > 0 && !fechadosNaProcura.has(id))");
  });

  it("dentro de cada bloco, pelo número do pedido, do mais recente", () => {
    expect(T).toContain("].sort((x, y) => y.id - x.id),");
  });
});

describe("os cartões de resumo", () => {
  it("«Geral» e um por bloco; carregar filtra, outra vez mostra todos", () => {
    expect(T).toContain('{ id: null as Bloco | null, rotulo: "Geral", alarme: false, n: totalEncontrado }');
    expect(T).toContain("onClick={() => setFiltro((f) => (c.id === null || f === c.id ? null : c.id))}");
    expect(T).toContain("A mostrar só «{BLOCOS.find((b) => b.id === filtro)?.rotulo}»");
  });

  it("os que pedem alguém ficam em alarme quando têm trabalhos", () => {
    expect(T).toContain("const emAlarme = c.alarme && c.n > 0;");
  });
});

describe("«Salte para um»", () => {
  it("os feitos por confirmar e os que precisam de si, num clique abertos e à vista", () => {
    expect(T).toContain('const saltos = [...(porBloco.get("feito") ?? []), ...(porBloco.get("precisa") ?? [])]');
    expect(T).toContain("onClick={() => mostrarTrabalho(t)}");
    expect(T).toContain("document.getElementById(`trabalho-${id}`)?.scrollIntoView(");
    expect(T).toContain("<li id={`trabalho-${t.pedidoId}`}");
  });

  it("dizem porquê: quantos aceitaram, ninguém aceitou, ou diz que está feito", () => {
    expect(T).toContain('if (r.fase === "por_confirmar") return "diz que está feito";');
    expect(T).toContain('if (r.fase === "sem_ninguem") return "ninguém aceitou";');
  });
});

describe("o resto do topo, como na Mesa", () => {
  it("«actualizado há N min», e o aviso fecha-se", () => {
    expect(T).toContain("`actualizado há ${minutos} min`");
    expect(T).toContain('onClick={() => setAviso("")}');
  });
});

/*
 * Fase 2: o que cada cartão mostra, como na Mesa — a origem e quando entrou,
 * o telefone legível, «N aceitaram», onde está a bola, o «porquê?», a nota e
 * o concluído «por ver».
 */
describe("o cartão de cada trabalho", () => {
  const ROTA = ler("src/app/api/admin/trabalhos-clyon/route.ts");
  const DB = ler("src/lib/db.ts");
  const OFERTAS = DB.slice(DB.indexOf("export async function ofertasClyon("), DB.indexOf("export async function pedidoClyonActivoDoTelefone("));
  const CARTAO = T.slice(T.indexOf("function CartaoDoTrabalho("));

  it("a rota traz a nota, o «por ver», a origem, a prova e a avaliação", () => {
    expect(OFERTAS).toContain("o.notasInternas, v.vistoEm AS concluidoVistoEm,");
    expect(OFERTAS).toContain("LEFT JOIN concluidosVistos v ON v.pedidoId = o.id");
    expect(OFERTAS).toContain("await ensureConcluidosVistosTable();");
    expect(OFERTAS).toContain("n.provaJson, n.estrelas, n.comentario, n.avaliadoEm");
    expect(ROTA).toContain("prova: provaDe(n.provaJson),");
    expect(ROTA).toContain("notas: o.notasInternas,");
    expect(ROTA).toContain("origem: o.origem,");
  });

  it("a origem é a mesma etiqueta da Mesa, num ficheiro partilhado", () => {
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain('import EtiquetaDaOrigem from "@/components/admin/EtiquetaDaOrigem";');
    expect(CARTAO).toContain("<EtiquetaDaOrigem slug={t.origem} />");
    expect(CARTAO).toContain("entrou {dataEHoraEmLisboa(entrou)}");
    expect(CARTAO).toContain("const telefone = telefoneLegivel(t.telefone) || t.telefone;");
  });

  it("onde está a bola, sempre à vista, e «N aceitaram» junto ao estado", () => {
    expect(CARTAO).toContain("{ondeEstaABola(t)}");
    expect(T).toContain('return `${r.enviados === 1 ? "Quem o recebeu recusou" : `Os ${r.enviados} recusaram`} — mexa no valor ou na taxa`;');
    expect(CARTAO).toContain('{r.interessados.length} {r.interessados.length === 1 ? "aceitou" : "aceitaram"}');
  });

  it("«porquê?» pergunta o alcance à mesma rota da Mesa", () => {
    expect(T).toContain("fetch(`/api/admin/negociacoes/alcance?pedidoId=${pedidoId}`");
    expect(CARTAO).toContain('{alcance === "a-ler" ? "a ver…" : "porquê?"}');
  });

  it("o «Anotar» escreve a mesma nota do pedido", () => {
    expect(T).toContain("body: JSON.stringify({ notasInternas: limpo || null }),");
    expect(CARTAO).toContain("Anotar");
    expect(CARTAO).toContain("Apagar a nota");
  });

  it("um concluído por ver tem destaque, e abri-lo é vê-lo", () => {
    expect(CARTAO).toContain('const porVer = (r.fase === "confirmada" || r.fase === "paga") && !t.concluidoVistoEm;');
    expect(CARTAO).toContain("if (porVer && !aberto) onVisto();");
    expect(T).toContain('body: JSON.stringify({ accao: "visto", pedidoId: t.pedidoId }),');
    expect(ler("src/app/api/admin/trabalhos-clyon/route.ts")).toContain("await marcarConcluidoComoVisto(pedidoId);");
    expect(T).toContain("{porVer} por ver");
  });
});

describe("as acções da Mesa (fase 3)", () => {
  const ROTA = ler("src/app/api/admin/trabalhos-clyon/route.ts");
  const CARTAO = T.slice(T.indexOf("function CartaoDoTrabalho("));

  it("tudo pela rota dos Trabalhos CLYON — quem só tem esta secção não abre a da Mesa", () => {
    for (const accao of ["visto", "proposta", "reoferecer", "avaliar", "cancelar"]) {
      expect(ROTA, accao).toContain(`if (accao === "${accao}") {`);
    }
    expect(T).not.toContain('"/api/admin/negociacoes/agir"');
    expect(T).not.toContain('"/api/admin/negociacoes/cancelar"');
    expect(T).not.toContain("import CancelarPedido");
  });

  it("voltar a oferecer a quem recusou — a um, ou a todos", () => {
    expect(ROTA).toContain("const r = await voltarAOferecerTrabalhoClyon(pedidoId, alvo);");
    expect(ROTA).toContain('motivo: "de_novo",');
    expect(CARTAO).toContain("Voltar a oferecer a todos os que recusaram");
    expect(ler("src/lib/db.ts")).toContain("export async function voltarAOferecerTrabalhoClyon(");
  });

  it("a nota ao profissional usa o mesmo componente da Mesa, cada um pela sua rota", () => {
    const A = ler("src/components/admin/AvaliarPelaClyon.tsx");
    expect(A).not.toContain("fetch(");
    expect(A).toContain("guardar: (estrelas: number, comentario: string | undefined) => Promise<string | null>;");
    expect(T).toContain('import AvaliarPelaClyon from "@/components/admin/AvaliarPelaClyon";');
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain(
      'body: JSON.stringify({ pedidoId: p.id, negociacaoId: acordada.id, accao: "avaliar", estrelas, comentario }),',
    );
    expect(ROTA).toContain("const gravou = await avaliarProfissional(negociacaoId, pedidoId, estrelas, comentario);");
  });

  it("trocar o profissional, e a prova com as fotos", () => {
    expect(T).toContain('import TrocarProfissional from "@/components/admin/TrocarProfissional";');
    expect(CARTAO).toContain("<TrocarProfissional pedidoId={t.pedidoId}");
    expect(CARTAO).toContain("<VisorDeFotos fotos={a.prova.fotos}");
  });

  it("enviar a proposta pelo WhatsApp da CLYON, e não com o número bloqueado", () => {
    expect(CARTAO).toContain("Enviar pela CLYON");
    expect(ROTA).toContain("if (await numeroBloqueadoWhatsApp(telefone)) {");
    expect(ROTA).toContain("const saiu = await enviarTextoManualWhatsApp(telefone, texto);");
  });

  it("a ficha do pedido, sem o botão de apagar, e as rotas dela abertas a esta secção", () => {
    expect(T).toContain("<PedidoDetailModal");
    expect(T).toContain("permitirApagar={false}");
    const P = ler("src/lib/papel-do-painel.ts");
    expect(P).toContain('{ prefixo: "/api/admin/pedidos", seccoes: ["pedidos", "negociacoes_clyon", "agenda", "trabalhos_clyon"] },');
    expect(P).toContain('{ prefixo: "/api/admin/fotos", seccoes: ["pedidos", "negociacoes_clyon", "agenda", "trabalhos_clyon"] },');
  });

  it("cancelar pede o motivo, com os mesmos motivos da Mesa, e o motivo vai no aviso", () => {
    expect(T).toContain("function JanelaDeCancelarTrabalho(");
    expect(T).toContain('{[...MOTIVOS_DE_CANCELAMENTO, "Outro motivo"].map((m) => (');
    expect(T).toContain("const aviso = avisoDoCancelamento(desfaz);");
    expect(ROTA).toContain("motivo: motivo || null,");
    expect(ler("src/lib/avisar-trabalho-clyon.ts")).toContain("localidade: a.localidade, motivo: a.motivo },");
  });
});

describe("em lote, e a procura em todos (fase 4)", () => {
  const ROTA = ler("src/app/api/admin/trabalhos-clyon/route.ts");
  const CARTAO = T.slice(T.indexOf("function CartaoDoTrabalho("));

  it("cada cartão tem a caixa de marcar, fora do botão que o abre", () => {
    const i = CARTAO.indexOf('type="checkbox"');
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(CARTAO.indexOf("if (porVer && !aberto) onVisto();"));
    expect(CARTAO).toContain("aria-label={`Seleccionar o trabalho #${t.pedidoId}`}");
    expect(T).toContain("marcado={marcados.has(t.pedidoId)}");
  });

  it("a barra só com alguma coisa marcada, e o «Apagar» só ao administrador", () => {
    expect(T).toContain("{osMarcados.length > 0 && (");
    expect(T).toContain("Confirmar os feitos · {feitosMarcados.length}");
    const apagar = T.indexOf("onClick={() => void apagarMarcados()}");
    expect(T.lastIndexOf("{eAdministrador && (", apagar)).toBeGreaterThan(T.indexOf("{osMarcados.length > 0 && ("));
    expect(T).toContain("if (!token || osMarcados.length === 0 || !eAdministrador) return;");
  });

  it("confirmar os feitos: só os por confirmar, um de cada vez, sem perguntas do pagamento", () => {
    expect(T).toContain('const feitosMarcados = osMarcados.filter((t) => t.resumo.fase === "por_confirmar" && t.resumo.atribuida);');
    const f = T.slice(T.indexOf("async function confirmarMarcados("), T.indexOf("async function arquivarMarcados("));
    expect(f).toContain("for (const t of lista) {");
    expect(f).toContain('await fetch("/api/admin/trabalhos-clyon/confirmar", {');
    expect(f).toContain("semProva: false");
    expect(f).not.toContain("Promise.all");
  });

  it("arquivar avisa quem o tinha por fazer, não toca no que está feito, e recusa os por confirmar", () => {
    const a = ROTA.slice(ROTA.indexOf('if (accao === "arquivar") {'), ROTA.indexOf('if (accao === "restaurar") {'));
    expect(a).toContain('n.estado === "acordada" && n.execucaoEnviadaEm && !n.confirmadoEm');
    expect(a).toContain("const avisar = pedidoArrumado(pedido.status) || antes.jaFeito ? [] : antes.vivos;");
    expect(a).toContain('await updateSimulatorOrder(pedidoId, { status: "arquivado" });');
    expect(a).toContain("quem: avisar,");
    // O operador fica: a comissão dele não depende de onde o trabalho está.
    expect(a).not.toContain("assignedToId");
    expect(T).toContain('body: JSON.stringify({ pedidoId: t.pedidoId, accao: "arquivar" }),');
  });

  it("apagar vai pela rota da Mesa, e mostra os que se recusaram a sair", () => {
    const f = T.slice(T.indexOf("async function apagarMarcados("));
    expect(f).toContain('await fetch("/api/admin/negociacoes/apagar", {');
    expect(f).toContain("await confirmarSeFuturo(");
    expect(T).toContain("Não foram apagados:");
  });

  it("a procurar, lê todos — e as actualizações seguintes continuam com todos", () => {
    expect(ROTA).toContain('const tudo = new URL(req.url).searchParams.get("tudo") === "1";');
    expect(ROTA).toContain("ofertasClyon(tudo ? 1000 : 150),");
    expect(T).toContain('const res = await fetch(`/api/admin/trabalhos-clyon${todos ? "?tudo=1" : ""}`, {');
    expect(T).toContain("const todos = tudo ?? temTudo.current;");
    expect(T).toContain("if (aProcurando && !temTudo.current && token) void carregar(true, true);");
    expect(ler("src/lib/db.ts")).toContain("LIMIT ${Math.max(1, Math.min(1000, Math.floor(limite)))}`,");
  });
});
