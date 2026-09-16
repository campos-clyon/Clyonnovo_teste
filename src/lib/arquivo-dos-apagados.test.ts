import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O que a purga apaga fica guardado, e o ecrã deixa de estar cheio.
 *
 * "verifique se a purga funciona 100% e se ela não está a apagar infos
 * importantes como saldos de carteiras, históricos (…) também leve os arquivos
 * dos nossos históricos de pedidos que foram apagados para as configs, assim o
 * admin pode baixar e visualizar quando necessário." — 16-09-2026.
 *
 * A AUDITORIA DOS SALDOS, feita antes de escrever uma linha de código, está
 * aqui em baixo como teste: as duas regras que a sustentam têm de continuar a
 * encaixar uma na outra.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const DB = ler("src/lib/db.ts");
const CARTEIRA = ler("src/lib/carteira.ts");
const TRABALHO = ler("src/lib/trabalho.ts");
const PAINEL = ler("src/components/admin/AdminRetencaoPanel.tsx");

describe("a purga não pode chegar ao dinheiro", () => {
  /*
   * A CADEIA, verificada a 16-09-2026:
   *
   *   carteiraDe salta tudo o que faseDoTrabalho diz ser "a_negociar"
   *   faseDoTrabalho devolve "a_negociar" sempre que estado !== "acordada"
   *   → só uma negociação `acordada` mexe num saldo
   *   → e `acordada` é a primeira condição da guarda da purga
   */
  it("a carteira ignora o que ainda está a negociar", () => {
    expect(CARTEIRA).toContain('if (faseDoTrabalho(t) === "a_negociar") continue;');
  });

  it("e só é «acordada» que deixa de o ser", () => {
    expect(TRABALHO).toContain('if (t.estado !== "acordada") return "a_negociar";');
  });

  it("a guarda da purga recusa qualquer pedido com uma negociação acordada", () => {
    expect(DB).toContain("g.estado IN ('acordada', 'aguarda_contratacao')");
  });

  it("e protege pelos factos, não pela palavra do estado", () => {
    /*
     * `matarNegociacoesDoPedido` põe TODAS as negociações de um pedido em
     * «morta» — e `cancelarPedido` chama-a sempre. Se a guarda fosse só o
     * estado, cancelar um pedido já pago desarmava-a, e sessenta dias depois o
     * dinheiro saía da conta do profissional.
     */
    for (const coluna of ["valorAcordado", "execucaoEnviadaEm", "confirmadoEm", "pagoEm"]) {
      expect(DB).toContain(`g.${coluna} IS NOT NULL`);
    }
  });

  it("e um trabalho marcado para o futuro não é lixo antigo", () => {
    expect(DB).toContain("o.scheduledDate IS NULL OR o.scheduledDate < CURDATE()");
  });
});

describe("o que se apaga fica guardado antes de se ir", () => {
  it("o arquivo escreve-se dentro da mesma transacção do apagar", () => {
    /*
     * A ordem é o que importa, e mede-se no ficheiro inteiro a partir do
     * início da função — cortar às cegas nos primeiros N caracteres fazia o
     * teste depender do tamanho dos comentários, e foi o que o partiu à
     * primeira.
     */
    const corpo = DB.slice(DB.indexOf("export async function deleteSimulatorOrder"));
    const inicioDaTransaccao = corpo.indexOf("await conn.beginTransaction()");
    const arquivo = corpo.indexOf("INSERT INTO arquivoDePedidos");
    const apagar = corpo.indexOf("DELETE FROM simulatorOrders");

    expect(inicioDaTransaccao).toBeGreaterThan(-1);
    expect(arquivo).toBeGreaterThan(-1);
    expect(apagar).toBeGreaterThan(-1);
    // Dentro da transacção, e antes de a linha se ir.
    expect(arquivo).toBeGreaterThan(inicioDaTransaccao);
    expect(arquivo).toBeLessThan(apagar);
  });

  it("guarda o pedido, as negociações e as fotografias", () => {
    expect(DB).toContain("JSON.stringify({ pedido, negociacoes, fotografias: fotos })");
  });

  it("a lista traz o tamanho, e não o conteúdo", () => {
    /*
     * Cada arquivo pode ter dezenas de kilobytes; trazê-los todos para
     * desenhar uma tabela era arrastar o arquivo inteiro a cada abertura do
     * ecrã. A lista diz QUANTO ocupa, e o conteúdo sai um a um.
     *
     * A primeira versão deste teste tinha uma expressão esperta a tentar
     * provar a ausência, e apanhava a função ao lado — a que TEM de trazer o
     * conteúdo. Prova-se com as duas funções separadas, que é mais simples e
     * não mente.
     */
    const lista = DB.slice(
      DB.indexOf("export async function arquivosDePedidos"),
      DB.indexOf("export async function arquivoDoPedido"),
    );
    expect(lista).toContain("CHAR_LENGTH(dados) AS tamanho");
    expect(lista).not.toContain("SELECT id, pedidoId, motivo, clienteNome, clienteEmail, dados");
  });

  it("e a de um só traz o conteúdo, que é para isso que serve", () => {
    const um = DB.slice(DB.indexOf("export async function arquivoDoPedido"));
    expect(um.slice(0, 900)).toContain("SELECT pedidoId, criadoEm, dados FROM arquivoDePedidos");
  });
});

describe("e sai por uma porta com chave", () => {
  const LISTA = ler("src/app/api/admin/arquivo/route.ts");
  const UM = ler("src/app/api/admin/arquivo/[id]/route.ts");

  it("as duas rotas exigem sessão de administração", () => {
    expect(LISTA).toContain("await requireAdmin(req)");
    expect(UM).toContain("await requireAdmin(req)");
  });

  it("descarrega com um nome que diz o que é", () => {
    expect(UM).toContain('attachment; filename="pedido-');
  });
});

describe("o ecrã deixa de despejar tudo à cara", () => {
  it("o registo da purga fecha-se", () => {
    expect(PAINEL).toContain("<details");
    expect(PAINEL).toContain("O que a purga escreveu no registo");
  });

  it("o arquivo também, e só vai à base quando alguém o abre", () => {
    expect(PAINEL).toContain("Arquivo dos pedidos apagados");
    expect(PAINEL).toContain("if (jaPediu || !token) return;");
  });
});
