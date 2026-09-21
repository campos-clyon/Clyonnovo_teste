import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O BACKOFFICE NÃO CONSEGUIA COBRAR OS CLIENTES DO TELEFONE.
 *
 * "deu erro ao tentar gerar a entidade referencia" — 21-09-2026.
 *
 * O #308 é do Manuel Pita, entrou pelo telefone, e tem escrito no próprio ecrã
 * «sem email». Carregar em «Referência Multibanco» dava:
 *
 *   GET /api/admin/pagamentos/criar?negociacaoId=280 → 404
 *   "Trabalho não encontrado."
 *
 * E dava-o OUTRA VEZ a cada pulso do painel, aos vinte segundos, para sempre —
 * a consola encheu-se de 404 iguais antes de alguém perceber que era um só.
 *
 * ⚠️ A CAUSA: uma credencial forjada. `trabalhoVistoPeloBackoffice`
 * reutilizava o caminho do cliente «com a credencial já dada por boa», mas o
 * que fazia era ir buscar o email do cliente e passá-lo como se fosse o de
 * quem perguntava. Num pedido sem email esse valor é nulo, `porSessao` dava
 * falso, `porToken` dava falso — e a verificação que era suposto estar a ser
 * dispensada rejeitava o administrador.
 *
 * Resultado: o backoffice não cobrava exactamente os clientes para quem o
 * backoffice existe. Os do telefone e do WhatsApp nunca deram email nenhum —
 * é por isso que há um botão «Registar pedido do WhatsApp ou telefone» no topo
 * daquela página.
 *
 * A LIÇÃO, e é a razão de este ficheiro existir: forjar uma credencial para
 * passar na própria porta funciona até ao dia em que o material com que se
 * forja não existe. Uma autorização diz o que é.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const ACESSO = semComentarios(ler("src/lib/acesso-ao-pagamento.ts"));

const corpoDe = (fonte: string, nome: string) => {
  const i = fonte.indexOf(`export async function ${nome}(`);
  expect(i, nome).toBeGreaterThan(-1);
  const proxima = fonte.indexOf("\nexport ", i + 10);
  return fonte.slice(i, proxima === -1 ? fonte.length : proxima);
};

describe("o backoffice pede autorização em nome próprio", () => {
  it("não vai buscar o email do cliente para se fazer passar por ele", () => {
    /*
     * Era esta linha: `email: (pedido?.contactEmail ?? "").trim() || null`.
     * Lia-se como reaproveitamento e era um disfarce — e o disfarce caía em
     * todo o pedido sem email.
     */
    const corpo = corpoDe(ACESSO, "trabalhoVistoPeloBackoffice");
    expect(corpo).not.toContain("contactEmail");
    expect(corpo).toContain("{ backoffice: true }");
  });

  it("e a regra deixa passar essa marca, sem olhar a email nem a token", () => {
    const corpo = corpoDe(ACESSO, "trabalhoQueSePodePagar");
    expect(corpo).toContain("credencial.backoffice !== true && !porSessao && !porToken");
  });
});

describe("mas as regras do TRABALHO continuam a valer para os dois", () => {
  it("fechado, e com valor — é sobre o que se pode cobrar, não sobre quem pergunta", () => {
    /*
     * A tentação, ao corrigir isto, era dar ao backoffice um caminho próprio.
     * Seria a terceira cópia da mesma regra, e já se sabe como isso acaba
     * nesta casa: o ecrã oferece o que o servidor recusa.
     */
    const corpo = corpoDe(ACESSO, "trabalhoQueSePodePagar");
    expect(corpo).toContain('linha.estado !== "acordada"');
    expect(corpo).toContain("Este trabalho ainda não está fechado.");
    expect(corpo).toContain("Este trabalho não tem valor acordado.");
  });

  it("e essas verificações vêm DEPOIS do portão, não antes", () => {
    // Senão, um trabalho por fechar respondia «ainda não está fechado» a quem
    // não tem nada que saber que ele existe.
    const corpo = corpoDe(ACESSO, "trabalhoQueSePodePagar");
    expect(corpo.indexOf("credencial.backoffice !== true")).toBeLessThan(
      corpo.indexOf('linha.estado !== "acordada"'),
    );
  });
});

describe("a marca do backoffice não entra por um corpo de pedido", () => {
  it("as duas portas públicas montam a credencial campo a campo", () => {
    /*
     * ISTO É O QUE IMPEDE UM `"backoffice": true` NO JSON. Um espalhamento do
     * corpo (`{ ...corpo }`) dava a qualquer pessoa na internet a autorização
     * que se acabou de criar — e sobre o botão que tira dinheiro da conta de
     * alguém.
     */
    const publica = semComentarios(ler("src/app/api/pagamentos/route.ts"));
    expect(publica).toContain("token: corpo.token,");
    // `[\s\S]` e não a flag `/s`: o alvo deste projecto é anterior a es2018 e
    // o `tsc` chumba a flag — o vitest deixava passar, e foi assim que ela
    // entrou num commit. Correr os testes não é correr o compilador.
    expect(publica).not.toMatch(/trabalhoQueSePodePagar\([\s\S]*?\.\.\.corpo/);
    expect(publica).not.toContain("backoffice");
  });

  it("e quem a constrói só é chamado atrás de um requireAdmin", () => {
    const rota = semComentarios(ler("src/app/api/admin/pagamentos/criar/route.ts"));
    for (const metodo of ["GET", "POST"]) {
      const i = rota.indexOf(`export async function ${metodo}(`);
      expect(i, metodo).toBeGreaterThan(-1);
      const corpo = rota.slice(i, rota.indexOf("\nexport ", i + 10));
      expect(corpo, metodo).toContain("requireAdmin");
      expect(
        corpo.indexOf("requireAdmin"),
        `${metodo}: o portão tem de vir antes de ler o trabalho`,
      ).toBeLessThan(corpo.indexOf("trabalhoVistoPeloBackoffice"));
    }
  });
});
