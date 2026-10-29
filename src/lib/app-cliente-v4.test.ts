import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ECRAS_QUE_ESPERAM, deveProcurar, INTERVALO_MINIMO_MS, podeRecarregarAgora } from "../../app-cliente/src/lib/actualizacoes";
import { avaliacoesRecebidas, ROTA_DAS_AVALIACOES } from "../../app-cliente/src/lib/avaliacoes";
import { avaliacaoParaAApp, respostaDasAvaliacoes, SQL_DAS_AVALIACOES_AO_CLIENTE } from "./avaliacoes-do-cliente";

/**
 * A APP DE CLIENTE, CORRECÇÕES DE 29-10-2026 (ordem do CEO com o sim do dono,
 * depois do teste no telemóvel do APK 3d8de466): a barra por cima dos botões
 * do Android, o «+» que não abria, o ecrã vazio, a barra com 4 entradas, as
 * avaliações recebidas, as actualizações sozinhas e «parceiro» no lugar de
 * «profissional».
 */

const RAIZ = process.cwd();
const APP = join(RAIZ, "app-cliente");
const ler = (p: string) => readFileSync(join(APP, p), "utf8");
function ficheiros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? ficheiros(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}
const FONTES = ficheiros(join(APP, "src"));

describe("as avaliações: cada um vê só as que recebeu", () => {
  it("a rota do site lê só as do email da sessão e nunca as que o cliente deu", () => {
    expect(SQL_DAS_AVALIACOES_AO_CLIENTE).toContain("FROM avaliacoesAoCliente a");
    expect(SQL_DAS_AVALIACOES_AO_CLIENTE).toContain("WHERE a.clienteEmail = ?");
    // As que o cliente deu ficam em negociacoes.estrelas: esta rota não lhes toca.
    expect(SQL_DAS_AVALIACOES_AO_CLIENTE).not.toMatch(/negociacoes|estrelas\s*=|avaliadoEm/);
    const rota = readFileSync(join(RAIZ, "src/app/api/cliente/avaliacoes/route.ts"), "utf8");
    expect(rota).toContain("const email = await emailDoCliente(req);");
    expect(rota).toContain('{ status: 401 }');
  });

  it("o que sai: estrelas, comentário, dia em Lisboa, serviço e o primeiro nome do parceiro", () => {
    const a = avaliacaoParaAApp({ estrelas: 5, comentario: "  Muito simpático. ", criadaEm: "2026-10-20 23:30:00", serviceType: "recolha_moveis", parceiroNome: "Rui Silva Santos" });
    expect(a).toEqual({ estrelas: 5, comentario: "Muito simpático.", quandoTexto: "21/10/2026", servico: expect.any(String), parceiro: "Rui" });
    expect(avaliacaoParaAApp({ estrelas: 9 })).toBeNull();
    expect(avaliacaoParaAApp({ estrelas: 0 })).toBeNull();
  });

  it("a média em texto, e a lista vazia sem média", () => {
    expect(respostaDasAvaliacoes([])).toEqual({ ok: true, avaliacoes: [], total: 0, mediaTexto: null });
    const r = respostaDasAvaliacoes([{ estrelas: 5 }, { estrelas: 4 }]);
    expect(r.total).toBe(2);
    expect(r.mediaTexto).toBe("4,5");
  });

  it("a app lê a forma da rota com tolerância e mostra-as no Perfil", () => {
    expect(ROTA_DAS_AVALIACOES).toBe("/api/cliente/avaliacoes");
    expect(avaliacoesRecebidas(null)).toEqual({ avaliacoes: [], total: 0, mediaTexto: null });
    const r = avaliacoesRecebidas({ mediaTexto: "4,0", avaliacoes: [{ estrelas: 4, parceiro: "Ana" }, { estrelas: "x" }] });
    expect(r).toEqual({ avaliacoes: [{ estrelas: 4, comentario: null, quandoTexto: null, servico: null, parceiro: "Ana" }], total: 1, mediaTexto: "4,0" });
    expect(ler("src/app/_layout.tsx")).toMatch(/<Stack\.Protected guard=\{ligado\}>[\s\S]*name="avaliacoes"[\s\S]*<\/Stack\.Protected>/);
  });

  it("o Avaliar do pedido não mostra ao cliente a avaliação que ele já deu", () => {
    const avaliar = ler("src/componentes/Avaliar.tsx");
    expect(avaliar).toContain('if (!n.accoes.includes("avaliar")) return null;');
    expect(avaliar).not.toMatch(/n\.estrelas/);
  });

  it("a app Pro mostra só as avaliações que o profissional recebeu (as dos clientes)", () => {
    const pro = readFileSync(join(RAIZ, "app-pro/src/app/conta/avaliacoes.tsx"), "utf8");
    expect(pro).toContain("perfil.ultimasAvaliacoes");
    expect(pro).not.toMatch(/avaliacoesAoCliente|\/api\/cliente\/avaliacoes/);
  });
});

describe("as actualizações chegam sozinhas, sem perder o simulador", () => {
  it("não recarrega a meio do simulador nem de outro ecrã onde se escreve", () => {
    expect(podeRecarregarAgora(["(app)"])).toBe(true);
    expect(podeRecarregarAgora(["(app)", "perfil"])).toBe(true);
    expect(podeRecarregarAgora(["(app)", "pedir"])).toBe(false);
    expect(podeRecarregarAgora(["entrar", "confirmar"])).toBe(false);
    expect(podeRecarregarAgora(["pedido", "[id]"])).toBe(false);
    expect(ECRAS_QUE_ESPERAM).toContain("pedido-do-link");
  });

  it("procura ao abrir e ao voltar, no máximo uma vez por minuto", () => {
    expect(deveProcurar(null, 0)).toBe(true);
    expect(deveProcurar(1000, 1000 + INTERVALO_MINIMO_MS - 1)).toBe(false);
    expect(deveProcurar(1000, 1000 + INTERVALO_MINIMO_MS)).toBe(true);
    const c = ler("src/componentes/ActualizacaoAutomatica.tsx");
    for (const s of ["Updates.checkForUpdateAsync()", "Updates.fetchUpdateAsync()", "Updates.reloadAsync()", 'AppState.addEventListener("change"', "isUpdatePending"]) expect(c).toContain(s);
    expect(ler("src/app/_layout.tsx")).toContain("<ActualizacaoAutomatica />");
  });
});

describe("o ecrã vazio e as margens do Android", () => {
  it("o arranque mostra uma roda e nunca fica preso à espera das letras ou da renovação da sessão", () => {
    const raiz = ler("src/app/_layout.tsx");
    expect(raiz).not.toContain("return <View style={{ flex: 1, backgroundColor: CORES.fundo }} />;");
    expect(raiz).toContain("setSemEsperarPelasLetras(true)");
    const sessao = ler("src/estado/Sessao.tsx");
    // Abre logo dentro com o token guardado; a renovação corre por trás.
    expect(sessao.indexOf("setLigado(true);")).toBeLessThan(sessao.indexOf('pedir<{ token: string }>("/api/cliente/sessao"'));
  });

  it("os ecrãs e as folhas somam a margem de baixo do telemóvel", () => {
    expect(ler("src/componentes/ui.tsx")).toContain('edges={["top", "left", "right", "bottom"]}');
    for (const f of FONTES) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toContain('edges={["top", "left", "right"]}');
      for (const m of s.matchAll(/<Modal [^>]*>/g)) expect(m[0], f).toContain("navigationBarTranslucent");
    }
  });

  it("a folha de entrar fecha-se antes de abrir o Google (o fundo escuro não fica preso)", () => {
    expect(ler("src/componentes/Entrada.tsx")).toContain("antesDoGoogle?.();");
    expect(ler("src/componentes/NovoPedido.tsx")).toMatch(/antesDoGoogle=\{\(\) => \{\s*setErroDoGoogle\(null\);\s*setParaEntrar\(false\);/);
  });
});

describe("«parceiro» no lugar de «profissional» em tudo o que o cliente lê (dono, 29-10-2026)", () => {
  it("nenhum texto da app de cliente diz «profissional»", () => {
    const achados: string[] = [];
    for (const f of FONTES) {
      const linhas = readFileSync(f, "utf8").split("\n");
      linhas.forEach((l, i) => {
        const t = l.trim();
        if (/^(\/\/|\*|\/\*|\{\/\*)/.test(t)) return;
        // Só o que está dentro de aspas ou entre etiquetas (o que se lê); os nomes no código (n.profissional) não contam.
        const textos = [...t.matchAll(/"([^"]*)"|`([^`]*)`|>([^<{}]+)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? "");
        if (textos.map((x) => x.replace(/\$\{[^}]*\}/g, "")).some((x) => /profission/i.test(x) && !/^com-profissional$/.test(x))) achados.push(`${f}:${i + 1}`);
      });
    }
    expect(achados).toEqual([]);
  });
});
