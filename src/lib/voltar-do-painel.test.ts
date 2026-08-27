import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O botão de voltar sobe um nível — e não recua no browser.
 *
 * "O botão voltar está com a acção errada. Ele deve voltar para o ecrã
 * anterior, mas como está ele volta até sair da conta. Se eu estiver na Agenda
 * e depois for para Os meus trabalhos e abrir um trabalho, ao voltar eu deveria
 * voltar para os meus trabalhos — mas volto para a agenda."
 *
 * Eram duas coisas a somar.
 *
 * `history.back()` recua para a PÁGINA anterior, que raramente é o sítio de
 * onde se veio dentro do painel; ao fim de uns toques chega ao ecrã de entrada
 * e deita a pessoa fora da conta.
 *
 * E o trabalho aberto era estado local, invisível para o histórico: para o
 * browser, a lista e o trabalho aberto eram a MESMA página. Recuar saltava a
 * lista inteira.
 */

const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PAINEL = semComentarios(
  readFileSync(join(process.cwd(), "src/app/profissionais/painel/PainelDoProfissional.tsx"), "utf8"),
);
const TRABALHOS = semComentarios(
  readFileSync(join(process.cwd(), "src/app/profissionais/painel/Trabalhos.tsx"), "utf8"),
);

describe("o trabalho aberto vive no endereço", () => {
  it("lê-se de lá, e não de estado local", () => {
    expect(PAINEL).toContain('const trabalhoAberto = Number(params.get("trabalho")) || null;');
    // Se ficasse local, o histórico não o via — e era esse o problema todo.
    expect(TRABALHOS).not.toContain("const [aberto, setAberto] = useState<number | null>(null);");
  });

  it("abrir um trabalho deixa marca no histórico", () => {
    // É o que faz o botão de trás do Android — o único que há numa aplicação
    // instalada — comportar-se como o do ecrã.
    expect(PAINEL).toContain("function abrirTrabalho(negociacaoId: number | null)");
    expect(PAINEL).toContain("?ecra=trabalhos&trabalho=${negociacaoId}");
  });

  it("fechar um trabalho volta à lista, e não a lado nenhum", () => {
    expect(PAINEL).toContain('"/profissionais/painel?ecra=trabalhos"');
    expect(TRABALHOS).toContain("onVoltar={() => onAbrir(null)}");
  });
});

describe("voltar sobe a hierarquia do painel", () => {
  it("deixou de recuar no browser", () => {
    // Era isto que o levava até fora da conta.
    expect(PAINEL).not.toContain("window.history.back()");
  });

  it("três degraus, sempre os mesmos: trabalho, lista, menu", () => {
    const i = PAINEL.indexOf("const voltar = useCallback(");
    const corpo = PAINEL.slice(i, PAINEL.indexOf("}, [", i));
    expect(corpo).toContain("if (trabalhoAberto)");
    expect(corpo).toContain('if (ecra !== "menu")');
    // Do menu sai-se para o site — nunca para o ecrã de entrada.
    expect(corpo).toContain('window.location.href = "/"');
    expect(corpo).not.toContain("/profissionais/entrar");
  });

  it("o caminho de onde se veio não muda o destino", () => {
    /*
     * Era o cerne da queixa: da Agenda para os trabalhos, abrir um, voltar —
     * e dava na Agenda. A hierarquia é sempre a mesma, venha-se de onde se
     * vier, e por isso nunca surpreende.
     */
    const i = PAINEL.indexOf("const voltar = useCallback(");
    const corpo = PAINEL.slice(i, PAINEL.indexOf("}, [", i));
    expect(corpo).not.toContain("router.back()");
    expect(corpo).not.toContain("history");
  });

  it("recalcula-se quando o sítio muda", () => {
    // Um useCallback com dependências vazias guardava a primeira hierarquia
    // para sempre, e o botão passava a responder ao ecrã de há dez minutos.
    const i = PAINEL.indexOf("const voltar = useCallback(");
    expect(PAINEL.slice(i, i + 900)).toContain("}, [trabalhoAberto, ecra, router]);");
  });
});
