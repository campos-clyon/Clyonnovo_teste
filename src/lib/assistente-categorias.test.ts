import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CATEGORIAS_POR_ORDEM,
  CATEGORIAS_VIVAS,
  CORES_DA_CATEGORIA,
  CORES_DA_CATEGORIA_ESCURO,
  ETIQUETA_DA_CATEGORIA,
  categoriaDoPedido,
  categoriaViva,
  esperaPeloCliente,
  type NegociacaoParaCategoria,
} from "./assistente-categorias";

/**
 * AS CATEGORIAS DERIVAM-SE. NÃO SE GUARDAM.
 *
 * "O assistente deve ter categorias mais robustas para gerir os pedidos e
 * marcar tudo bem organizado, como por exemplo pedidos criados, orçamentos
 * enviados, orçamentos aceites, orçamentos recusados, pedidos cancelados." —
 * 12-09-2026.
 *
 * A tentação era uma coluna `categoria` escrita a cada passo. Uma coluna de
 * estado escrita à mão em doze sítios fica errada no primeiro que alguém
 * esquecer — e a partir daí o painel diz "orçamento enviado" sobre um pedido
 * que já foi pago, e o assistente manda ao cliente uma mensagem sobre um
 * negócio que acabou na semana passada.
 *
 * Este ficheiro é a prova de que não pode divergir: a função é pura, não toca
 * na base, e responde a trinta situações que em produção demorariam meses a
 * acontecer todas.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

function proposta(por: "cliente" | "profissional", valor: number, estado = "pendente") {
  return JSON.stringify([{ por, valor, criadaEm: "2026-09-10T10:00:00Z", estado }]);
}

function neg(o: Partial<NegociacaoParaCategoria> & { estado: string }): NegociacaoParaCategoria {
  return o as NegociacaoParaCategoria;
}

describe("o caminho feliz, do princípio ao fim", () => {
  it("sem negociações nenhumas é um pedido CRIADO, e não um à espera", () => {
    /*
     * As duas coisas parecem a mesma e não são. Um pedido sem negociações não
     * foi distribuído a ninguém — o problema é NOSSO. Um pedido distribuído
     * sem propostas está à espera dos profissionais — o problema é de oferta.
     * Misturá-los escondia exactamente a diferença que interessa a quem gere.
     */
    expect(categoriaDoPedido({ negociacoes: [] })).toBe("criado");
    expect(categoriaDoPedido({})).toBe("criado");
  });

  it("distribuído e sem uma única proposta: à espera de propostas", () => {
    expect(categoriaDoPedido({ negociacoes: [neg({ estado: "aberta" })] })).toBe(
      "a_espera_de_propostas",
    );
  });

  it("com uma proposta na mesa: orçamento enviado", () => {
    expect(
      categoriaDoPedido({
        negociacoes: [neg({ estado: "aberta", propostasJson: proposta("profissional", 150) })],
      }),
    ).toBe("orcamento_enviado");
  });

  it("o profissional aceitou e falta o cliente fechar: continua orçamento enviado", () => {
    // `aguarda_contratacao` não é um acordo. A bola está do lado do cliente e
    // o negócio ainda pode não acontecer — chamar-lhe "aceite" seria contar
    // como ganho um trabalho que ninguém contratou.
    expect(
      categoriaDoPedido({
        negociacoes: [
          neg({
            estado: "aguarda_contratacao",
            propostasJson: proposta("cliente", 200, "aceite"),
          }),
        ],
      }),
    ).toBe("orcamento_enviado");
  });

  it("acordada sem execução: aceite, por fazer", () => {
    expect(categoriaDoPedido({ negociacoes: [neg({ estado: "acordada" })] })).toBe(
      "aceite_por_fazer",
    );
  });

  it("prova enviada e por confirmar", () => {
    expect(
      categoriaDoPedido({
        negociacoes: [neg({ estado: "acordada", execucaoEnviadaEm: "2026-09-11T10:00:00Z" })],
      }),
    ).toBe("feito_por_confirmar");
  });

  it("confirmado, e depois pago", () => {
    const base = { estado: "acordada", execucaoEnviadaEm: "2026-09-11T10:00:00Z" };
    expect(
      categoriaDoPedido({
        negociacoes: [neg({ ...base, confirmadoEm: "2026-09-12T10:00:00Z" })],
      }),
    ).toBe("concluido");
    expect(
      categoriaDoPedido({
        negociacoes: [
          neg({ ...base, confirmadoEm: "2026-09-12T10:00:00Z", pagoEm: "2026-09-13T10:00:00Z" }),
        ],
      }),
    ).toBe("pago");
  });
});

describe("os becos sem saída", () => {
  it("houve propostas e ninguém quis: recusado", () => {
    expect(
      categoriaDoPedido({
        negociacoes: [
          neg({ estado: "desistida", propostasJson: proposta("profissional", 300, "recusada") }),
          neg({ estado: "morta", propostasJson: proposta("profissional", 400, "expirada") }),
        ],
      }),
    ).toBe("recusado");
  });

  it("morreram todas SEM proposta nenhuma: ninguém recusou nada", () => {
    /*
     * "Recusado" conta uma história — houve um valor e o cliente não o quis.
     * Quando não chegou a haver proposta, o pedido morreu à espera, e essa é
     * outra história: é a equipa que tem de agir, não o cliente.
     */
    expect(
      categoriaDoPedido({
        negociacoes: [neg({ estado: "morta" }), neg({ estado: "desistida" })],
      }),
    ).toBe("a_espera_de_propostas");
  });

  it("cancelado e arquivado mandam sobre tudo o que esteja por baixo", () => {
    const comAcordo = [neg({ estado: "acordada", pagoEm: "2026-09-01T10:00:00Z" })];
    expect(categoriaDoPedido({ status: "cancelado", negociacoes: comAcordo })).toBe("cancelado");
    expect(categoriaDoPedido({ status: "rejeitado", negociacoes: comAcordo })).toBe("cancelado");
    expect(categoriaDoPedido({ status: "arquivado", negociacoes: comAcordo })).toBe("arquivado");
  });

  it("o estado vem da base com maiúsculas ou espaços e continua a valer", () => {
    expect(categoriaDoPedido({ status: "  CANCELADO " })).toBe("cancelado");
  });
});

describe("a mesa com várias negociações", () => {
  it("a acordada manda sobre as que ficaram para trás", () => {
    /*
     * Quando o cliente escolhe um profissional, as outras negociações morrem.
     * Olhar primeiro para as mortas fazia um pedido PAGO aparecer como
     * "recusado" só porque as outras três acabaram sem acordo — que é o
     * desfecho normal de qualquer pedido bem sucedido.
     */
    expect(
      categoriaDoPedido({
        negociacoes: [
          neg({ estado: "morta", propostasJson: proposta("profissional", 400, "recusada") }),
          neg({ estado: "morta", propostasJson: proposta("profissional", 500, "recusada") }),
          neg({
            estado: "acordada",
            propostasJson: proposta("profissional", 300, "aceite"),
            confirmadoEm: "2026-09-12T10:00:00Z",
            pagoEm: "2026-09-13T10:00:00Z",
          }),
        ],
      }),
    ).toBe("pago");
  });

  it("uma viva sem proposta ao lado de uma morta com proposta: ainda há quem responda", () => {
    expect(
      categoriaDoPedido({
        negociacoes: [
          neg({ estado: "morta", propostasJson: proposta("profissional", 400, "recusada") }),
          neg({ estado: "aberta" }),
        ],
      }),
    ).toBe("a_espera_de_propostas");
  });
});

describe("as propostas chegam de duas formas, e as duas têm de servir", () => {
  it("já em array, como nos testes e no ecrã", () => {
    expect(
      categoriaDoPedido({
        negociacoes: [
          neg({
            estado: "aberta",
            propostas: [
              { por: "profissional", valor: 120, criadaEm: "2026-09-10T10:00:00Z", estado: "pendente" },
            ],
          }),
        ],
      }),
    ).toBe("orcamento_enviado");
  });

  it("um JSON estragado não rebenta a lista inteira", () => {
    // Uma linha corrompida na base não pode apagar a tabela do ecrã. Lê-se
    // como se não houvesse propostas, que é o mais conservador dos enganos.
    expect(
      categoriaDoPedido({ negociacoes: [neg({ estado: "aberta", propostasJson: "{isto não é" })] }),
    ).toBe("a_espera_de_propostas");
  });
});

describe("a lista das categorias serve os ecrãs", () => {
  it("todas têm etiqueta em português e cor", () => {
    for (const c of CATEGORIAS_POR_ORDEM) {
      expect(ETIQUETA_DA_CATEGORIA[c]).toBeTruthy();
      expect(CORES_DA_CATEGORIA[c]).toBeTruthy();
    }
  });

  it("as etiquetas não deixam escapar identificadores da base", () => {
    for (const c of CATEGORIAS_POR_ORDEM) {
      expect(ETIQUETA_DA_CATEGORIA[c]).not.toContain("_");
    }
  });

  it("há uma paleta para o fundo claro e outra para o escuro", () => {
    /*
     * "Corrija esses botões" — 12-09-2026, sobre uma pílula cor de creme no
     * meio de um cartão preto.
     *
     * As Negociações são um painel escuro e os Pedidos uma tabela branca. Com
     * uma paleta só, `bg-amber-50` num cartão preto era uma mancha cheia ao
     * lado de etiquetas transparentes — e uma mancha cheia lê-se como um
     * BOTÃO. Alguém ia lá carregar.
     */
    for (const c of CATEGORIAS_POR_ORDEM) {
      expect(CORES_DA_CATEGORIA_ESCURO[c]).toBeTruthy();
      // Nada de fundos claros no escuro: nem `bg-*-50`, nem `bg-*-100`.
      expect(CORES_DA_CATEGORIA_ESCURO[c]).not.toMatch(/bg-\w+-(50|100)\b/);
    }
    // E o painel escuro usa mesmo a paleta escura.
    const NEGOCIACOES = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(NEGOCIACOES).toContain("CORES_DA_CATEGORIA_ESCURO[categoriaDoPedido(p)]");
    expect(semNotas(NEGOCIACOES)).not.toContain("CORES_DA_CATEGORIA[categoriaDoPedido(p)]");
  });

  it("a etiqueta nunca se parte ao meio", () => {
    /*
     * «Orçamento enviado» numa coluna de 72 px partia-se em duas linhas dentro
     * da pílula, e o que se via era um botão deformado — não um rótulo. Saiu da
     * coluna do número para a linha das etiquetas, que tem a largura toda.
     */
    const NEGOCIACOES = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    const PEDIDOS = ler("src/components/admin/LegacyAdminClient.tsx");
    const i = NEGOCIACOES.indexOf("CORES_DA_CATEGORIA_ESCURO[categoriaDoPedido(p)]");
    expect(NEGOCIACOES.slice(Math.max(0, i - 200), i)).toContain("whitespace-nowrap");
    const j = PEDIDOS.indexOf("CORES_DA_CATEGORIA[pedidoCategorias[String(p.id)]]");
    expect(PEDIDOS.slice(Math.max(0, j - 200), j)).toContain("whitespace-nowrap");
  });

  it("vivas são as que ainda pedem alguma coisa a alguém", () => {
    expect(categoriaViva("orcamento_enviado")).toBe(true);
    expect(categoriaViva("pago")).toBe(false);
    expect(categoriaViva("cancelado")).toBe(false);
    for (const c of CATEGORIAS_VIVAS) expect(CATEGORIAS_POR_ORDEM).toContain(c);
  });
});

describe("quem está à espera do cliente", () => {
  const agora = new Date("2026-09-12T14:00:00Z");

  it("uma proposta do profissional feita há uma hora espera por ele", () => {
    expect(
      esperaPeloCliente(
        {
          estado: "aberta",
          propostas: [
            { por: "profissional", valor: 150, criadaEm: "2026-09-12T13:00:00Z", estado: "pendente" },
          ],
        },
        agora,
      ),
    ).toBe(true);
  });

  it("passadas as 48 horas já não espera por ninguém", () => {
    // O prazo é o de sempre (PRAZO_DA_PROPOSTA_HORAS). Uma proposta caducada
    // não pode gerar um lembrete a pedir resposta a uma coisa que já morreu.
    expect(
      esperaPeloCliente(
        {
          estado: "aberta",
          propostas: [
            { por: "profissional", valor: 150, criadaEm: "2026-09-10T10:00:00Z", estado: "pendente" },
          ],
        },
        agora,
      ),
    ).toBe(false);
  });

  it("a proposta pendente é do CLIENTE: quem tem de responder é o profissional", () => {
    expect(
      esperaPeloCliente(
        {
          estado: "aberta",
          propostas: [
            { por: "cliente", valor: 150, criadaEm: "2026-09-12T13:00:00Z", estado: "pendente" },
          ],
        },
        agora,
      ),
    ).toBe(false);
  });

  it("aguarda_contratacao é sempre a bola do lado dele", () => {
    expect(esperaPeloCliente({ estado: "aguarda_contratacao" }, agora)).toBe(true);
  });
});

describe("a regra vive num sítio só", () => {
  it("os dois ecrãs chamam a mesma função, e não cada um a sua", () => {
    /*
     * A mesa dos Pedidos e a das Negociações mostram a mesma fase do mesmo
     * pedido. Duas cópias da regra acabavam a discordar, e a primeira pessoa
     * a dar por isso seria um cliente ao telefone.
     */
    const NEGOCIACOES = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    const PEDIDOS = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(NEGOCIACOES).toContain('from "@/lib/assistente-categorias"');
    expect(NEGOCIACOES).toContain("categoriaDoPedido(p)");
    expect(PEDIDOS).toContain('from "@/lib/assistente-categorias"');
    expect(PEDIDOS).toContain("pedidoCategorias[String(p.id)]");
  });

  it("a lista dos pedidos recebe a fase numa consulta só, e não uma por linha", () => {
    const DB = ler("src/lib/db.ts");
    const ROTA = ler("src/app/api/admin/pedidos/route.ts");
    expect(DB).toContain("export async function categoriasDosPedidos(");
    expect(ROTA).toContain("categoriasDosPedidos(");
    // Uma fase em falta não pode esconder os pedidos.
    expect(ROTA).toContain(".catch(() => ({}))");
  });

  it("o LEFT JOIN sem negociação nenhuma não conta como uma negociação vazia", () => {
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function categoriasDosPedidos(");
    expect(DB.slice(i, i + 2200)).toContain("if (l.estado == null) continue;");
  });
});
