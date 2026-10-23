import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A MESA DO WHATSAPP — uma lista, e não quatro.
 *
 * O ecrã tinha quatro listas de números ao mesmo tempo (conversas, entregues
 * a si, bloqueados, fila) e o mesmo número aparecia em três: o +351 961 899
 * 575 estava em «entregues a si» e em «bloqueados» na mesma fotografia. Para
 * saber quem estava a falar com quem era preciso lê-las todas e cruzá-las de
 * cabeça.
 *
 * "Organize essa tela para ser mais prático, simples e intuitivo, e que não
 * fique poluída de informações. O admin deve ter a categoria conversas onde
 * ele vê com quem o bot está a falar e possa pará-lo ou assumir, assim como
 * arquivar ou apagar a conversa, até mesmo reiniciar a conversa a partir de
 * onde parou."
 */

/**
 * Ler a fonte SEMPRE COM `\n`, venha o ficheiro como vier.
 *
 * No Windows o Git faz checkout com CRLF; no Linux da CI, com LF. O `corpoDe`
 * aqui em baixo ancora o fim do corpo em `"\n}\n"` — com CRLF o ficheiro tem
 * `\r\n}\r\n`, o `indexOf` não encontra nada e devolve -1, e `slice(i, -1)`
 * passa a apanhar quase o ficheiro inteiro em vez do corpo da função. Os
 * `not.toContain` chumbavam a apanhar o SQL das funções vizinhas.
 *
 * Chumbavam SÓ em Windows, com a CI verde no mesmo commit — que é a pior
 * espécie de teste falhado: manda procurar um erro que não existe.
 */
const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (t: string) =>
  t.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const DB = ler("src/lib/db.ts");
const ROTA = ler("src/app/api/admin/whatsapp/route.ts");
const PAINEL = ler("src/components/admin/AdminWhatsAppPanel.tsx");
const PAINEL_NU = semNotas(PAINEL);
const NA_BASE = ler("src/lib/mesa-das-conversas-na-base.ts");

/**
 * O corpo de uma função de db.ts, para não confundir SQL de vizinhas.
 *
 * O parêntese faz parte da âncora de propósito: sem ele, procurar
 * `limparFilaWhatsApp` casava primeiro com `limparFilaWhatsAppDoNumero`, que
 * nasceu depois, e o teste passava a ler o corpo da função errada.
 */
const corpoDe = (nome: string) => {
  const i = DB.indexOf(`export async function ${nome}(`);
  expect(i, `${nome} não existe`).toBeGreaterThan(-1);
  const j = DB.indexOf("\n}\n", i);
  return DB.slice(i, j);
};

describe("a mesa é uma lista só", () => {
  it("os estados são separadores dela, e não secções", () => {
    // A prova de que a fusão aconteceu: um separador por estado, num sítio só.
    // Desde 21-10-2026 dizem o que falta fazer — ver `a-mesa-das-conversas.test.ts`.
    expect(PAINEL).toContain("{SEPARADORES_DA_MESA.map((s) => (");
    // E as secções antigas deixaram de ter título próprio.
    expect(PAINEL_NU).not.toContain("Conversas entregues a si");
    expect(PAINEL_NU).not.toContain("Calar o cérebro num número");
  });

  it("cada número entra UMA vez — agora no servidor", () => {
    /*
     * Era esta a conta que se fazia de cabeça, e depois no ecrã. Desde
     * 21-10-2026 faz-se no servidor (`mesa-das-conversas-na-base.ts`), e o
     * estado mais forte decide-o `naMesa`: um bloqueado é bloqueado mesmo
     * que tenha fio.
     */
    expect(NA_BASE).toContain("const porChave = new Map<string, { telefone: string; f?: (typeof factos)[number] }>();");
    expect(NA_BASE).toContain("if (!porChave.has(chave)) porChave.set(chave, { telefone: t.telefone });");
    expect(PAINEL).toContain("(estado?.mesa ?? []).map((c) => ({");
  });

  it("um bloqueado que nunca escreveu continua a aparecer", () => {
    // Sem isto, um número bloqueado à mão desaparecia do ecrã — e ficava um
    // bloqueio que ninguém conseguia desfazer.
    expect(NA_BASE).toContain("for (const t of [...entregues, ...bloqueados]) {");
  });

  it("compara pelos últimos nove dígitos, como o resto da casa", () => {
    expect(NA_BASE).toContain('const ultimos9 = (t: string) => t.replace(/\\D/g, "").slice(-9);');
  });
});

describe("ver com quem o assistente está a falar, e pará-lo", () => {
  it("a linha diz em que passo da recolha ele vai", () => {
    expect(PAINEL).toContain("PASSO_DA_RECOLHA[l.passo]");
  });

  it("parar o assistente é um gesto na própria linha, sem abrir nada", () => {
    /*
     * Quem chega a este ecrã a meio de uma conversa má quer calá-lo JÁ. Se o
     * botão vivesse dentro da conversa aberta, eram dois gestos.
     */
    const linha = PAINEL.slice(
      PAINEL.indexOf('{l.dono === "assistente" && l.estado !== "bloqueada" && l.estado !== "resolvida" && ('),
      PAINEL.indexOf('{l.dono === "equipa" && l.estado !== "bloqueada" && l.estado !== "resolvida" && ('),
    );
    expect(linha).toContain('agir("interromper", l.telefone');
    expect(linha).toContain("Assumir");
  });

  it("devolver ao assistente continua de onde parou — não recomeça", () => {
    /*
     * "Reiniciar a conversa a partir de onde parou": `retomar` tira o número
     * dos interrompidos e a recolha fica INTACTA, por isso o assistente
     * retoma no passo em que estava. Recomeçar do zero é outro botão, e diz
     * que apaga.
     */
    const devolver = PAINEL.slice(
      PAINEL.indexOf('{l.dono === "equipa" && l.estado !== "bloqueada" && l.estado !== "resolvida" && ('),
      PAINEL.indexOf('{l.estado === "resolvida" && l.fechadaPor !== "pedido" && ('),
    );
    expect(devolver).toContain('agir("retomar", l.telefone)');
    expect(devolver).toContain("continua no passo onde ficou");
    // E quem apaga o passo é o outro, que avisa antes.
    expect(PAINEL).toContain("Recomeçar do zero");
    expect(PAINEL).toContain("O assistente volta a perguntar tudo desde o serviço");
  });
});

describe("arquivar — arrumação, e não esquecimento", () => {
  it("tem tabela própria e guarda QUANDO, como as negociações", () => {
    expect(DB).toContain("CREATE TABLE IF NOT EXISTS whatsappArquivadas");
    expect(DB).toContain("criadoEm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
  });

  it("arquivar não toca no fio — desarquivar devolve tudo", () => {
    const corpo = corpoDe("arquivarConversaWhatsApp");
    expect(corpo).not.toContain("whatsappMensagens");
    expect(corpo).toContain("INSERT INTO whatsappArquivadas");
    expect(corpo).toContain("DELETE FROM whatsappArquivadas");
  });

  it("o painel fecha (com o porquê) e reabre", () => {
    // «Arquivar» passou a «Fechar» a 21-10-2026 — ver `a-mesa-das-conversas.test.ts`.
    // Desde 23-10-2026 o fecho com o porquê é uma função — está na linha e já não dentro da conversa.
    expect(PAINEL).toContain('void agir("fechar", telefone, motivo.trim() || undefined)');
    expect(PAINEL).toContain("onClick={() => fecharComMotivo(l.telefone)}");
    expect(PAINEL).toContain('agir("reabrir", l.telefone)');
    expect(PAINEL).toContain("Reabrir");
  });
});

describe("apagar uma conversa", () => {
  it("leva a recolha e a fila do número — senão continuava sozinha", () => {
    /*
     * Apagar só o fio deixava a conversa viva onde não se vê: a recolha a meio
     * punha o assistente a retomar no passo antigo à mensagem seguinte, e o
     * que estivesse na fila saía a seguir.
     */
    const corpo = corpoDe("apagarConversaWhatsApp");
    expect(corpo).toContain("DELETE FROM whatsappMensagens");
    expect(corpo).toContain("DELETE FROM whatsappRecolhas");
    expect(corpo).toContain("DELETE FROM whatsappFila");
  });

  it("NÃO desfaz o bloqueio nem a entrega — são decisões em vigor", () => {
    /*
     * O teste que importa deste bloco. Se apagar o registo devolvesse a
     * palavra ao assistente, um contacto pessoal bloqueado voltava a receber
     * mensagens do site por causa de uma arrumação.
     */
    const corpo = corpoDe("apagarConversaWhatsApp");
    expect(corpo).not.toContain("whatsappBloqueados");
    expect(corpo).not.toContain("whatsappInterrompidos");
  });

  it("o painel avisa do que leva, e do que não leva", () => {
    expect(PAINEL).toContain("Apagar conversa");
    expect(PAINEL).toContain("Não se desfaz.");
    expect(PAINEL).toContain("O bloqueio e a entrega a si, se existirem, ficam como estão.");
  });
});

describe("limpar a fila", () => {
  it("marca como saída em vez de apagar — a fila é um registo", () => {
    // Um DELETE apagava a prova de que a mensagem chegou a existir.
    const corpo = corpoDe("limparFilaWhatsApp");
    expect(corpo).toContain("UPDATE whatsappFila SET enviadoEm = NOW() WHERE enviadoEm IS NULL");
    expect(corpo).not.toContain("DELETE");
  });

  it("devolve quantas riscou, para quem carregou saber o que apanhou", () => {
    expect(ROTA).toContain('accao === "limparFila"');
    expect(ROTA).toContain("const quantas = await limparFilaWhatsApp();");
    expect(ROTA).toContain("ok: true, quantas");
  });

  it("o botão pergunta antes, e só existe com fila", () => {
    expect(PAINEL).toContain("Limpar fila");
    expect(PAINEL).toContain("Limpar a fila inteira?");
    expect(PAINEL).toContain("{estado.fila.length > 0 && (");
  });
});

describe("a rota conhece as acções novas", () => {
  it("arquivar, desarquivar e apagar", () => {
    for (const c of ['case "arquivar":', 'case "desarquivar":', 'case "apagarConversa":']) {
      expect(ROTA).toContain(c);
    }
  });

  it("continua a ser só para quem entrou no backoffice", () => {
    // Estas acções apagam registos: uma porta aberta aqui apagava conversas.
    expect(ROTA).toContain("const { err } = await requireAdmin(req);");
  });
});
