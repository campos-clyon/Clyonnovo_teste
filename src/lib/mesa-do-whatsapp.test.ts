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

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semNotas = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const DB = ler("src/lib/db.ts");
const ROTA = ler("src/app/api/admin/whatsapp/route.ts");
const PAINEL = ler("src/components/admin/AdminWhatsAppPanel.tsx");
const PAINEL_NU = semNotas(PAINEL);

/** O corpo de uma função de db.ts, para não confundir SQL de vizinhas. */
const corpoDe = (nome: string) => {
  const i = DB.indexOf(`export async function ${nome}`);
  expect(i, `${nome} não existe`).toBeGreaterThan(-1);
  const j = DB.indexOf("\n}\n", i);
  return DB.slice(i, j);
};

describe("a mesa é uma lista só", () => {
  it("os quatro estados são separadores dela, e não quatro secções", () => {
    // A prova de que a fusão aconteceu: um separador por estado, num sítio só.
    expect(PAINEL).toContain("const SEPARADORES");
    for (const estado of ['"assistente"', '"entregue"', '"arquivada"', '"bloqueada"']) {
      expect(PAINEL).toContain(estado);
    }
    // E as secções antigas deixaram de ter título próprio.
    expect(PAINEL_NU).not.toContain("Conversas entregues a si");
    expect(PAINEL_NU).not.toContain("Calar o cérebro num número");
  });

  it("cada número entra UMA vez, com o estado mais forte que tiver", () => {
    /*
     * Era esta a conta que se fazia de cabeça. Um bloqueado é bloqueado mesmo
     * que tenha fio; uma arquivada sai da mesa mesmo que esteja entregue.
     */
    expect(PAINEL).toContain("const porNumero = new Map<string, Linha>()");
    expect(PAINEL).toContain("if (porNumero.has(chave)) continue;");
    const estadoDe = PAINEL.slice(
      PAINEL.indexOf("const estadoDe = (chave: string)"),
      PAINEL.indexOf("const notaDe"),
    );
    expect(estadoDe).toContain('bloqueadoDe.has(chave)');
    expect(estadoDe).toContain('"bloqueada"');
    expect(estadoDe).toContain('"assistente"');
  });

  it("um bloqueado que nunca escreveu continua a aparecer", () => {
    // Sem isto, um número bloqueado à mão desaparecia do ecrã — e ficava um
    // bloqueio que ninguém conseguia desfazer.
    expect(PAINEL).toContain("for (const [chave, fonte] of [...bloqueadoDe, ...entregueDe])");
  });

  it("compara pelos últimos nove dígitos, como o resto da casa", () => {
    expect(PAINEL).toContain("function ultimos9(");
    expect(PAINEL).toContain('.slice(-9)');
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
      PAINEL.indexOf('{l.estado === "assistente" && ('),
      PAINEL.indexOf('{l.estado === "entregue" && ('),
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
      PAINEL.indexOf('{l.estado === "entregue" && ('),
      PAINEL.indexOf('{l.estado === "arquivada" && ('),
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

  it("o painel arquiva e repõe", () => {
    expect(PAINEL).toContain('agir("arquivar", l.telefone)');
    expect(PAINEL).toContain('agir("desarquivar", l.telefone)');
    expect(PAINEL).toContain("Repor na mesa");
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
