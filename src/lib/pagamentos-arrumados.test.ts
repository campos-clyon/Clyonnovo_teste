import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A PÁGINA DE PAGAMENTOS POR ORDEM DE USO — 02-11-2026 (dono). Só
 * apresentação: o que precisa de acção em cima, «Trabalho a trabalho» a
 * seguir, a ligação ao euPago no fim; «Ainda por fazer» fechado; os pagos em
 * mão numa linha com «Já conferi».
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const PAINEL = ler("src/components/admin/AdminPagamentosPanel.tsx");
const PRINCIPAL = PAINEL.slice(PAINEL.indexOf("export default function AdminPagamentosPanel"));

describe("a ordem da página", () => {
  it("acção → trabalho a trabalho → últimos → ligação ao euPago", () => {
    const porAplicar = PRINCIPAL.indexOf("estado.avisos.length > 0 && (");
    const transferencias = PRINCIPAL.indexOf("Transferências à espera");
    const gestor = PRINCIPAL.indexOf("<GestorDoDinheiro");
    const ultimos = PRINCIPAL.indexOf("Últimos pagamentos");
    const ligacao = PRINCIPAL.indexOf("Ligação ao euPago");
    expect(porAplicar).toBeGreaterThan(-1);
    expect(porAplicar).toBeLessThan(gestor);
    expect(transferencias).toBeLessThan(gestor);
    expect(gestor).toBeLessThan(ultimos);
    expect(ultimos).toBeLessThan(ligacao);
  });

  it("a ligação ao euPago fica numa linha que se abre", () => {
    expect(PRINCIPAL).toContain("<details");
    expect(PRINCIPAL).toContain("ver detalhes");
  });
});

describe("«Trabalho a trabalho»", () => {
  it("os feitos num cartão «Trabalhos à espera de si», com quantos e o total", () => {
    expect(PAINEL).toContain("Trabalhos à espera de si · {linhasDaVez.length}");
    expect(PAINEL).toContain("euros(somaDe(linhasDaVez, separador))");
  });

  it("«Ainda por fazer» começa fechado e a escolha fica no navegador, com try/catch", () => {
    expect(PAINEL).toContain("const [verPorFazer, setVerPorFazer] = useState(false);");
    expect(PAINEL).toContain("window.localStorage.getItem(CHAVE_VER_POR_FAZER)");
    expect(PAINEL).toContain("{verPorFazer && desenhar(porFazerG)}");
  });
});

describe("os pagos em mão", () => {
  it("«Já conferi» só para o administrador, e um caso novo volta a mostrar", () => {
    const rota = ler("src/app/api/admin/pagamentos/pagos-em-mao/route.ts");
    expect(rota.match(/requireAdminGeral\(req\)/g)?.length).toBe(2);
    expect(rota).toContain("conferido && novos === 0");
    expect(PAINEL).toContain("{eAdministrador && <PagosEmMaoAfectados");
    const ecra = ler("src/components/admin/PagosEmMaoAfectados.tsx");
    expect(ecra).toContain("Para conferir:");
    expect(ecra).toContain("if (dados.conferido) return null;");
  });
});

describe("o aviso da «Provar a ligação» e as recusas (03-11-2026)", () => {
  const BASE = ler("src/lib/pagamentos-na-base.ts");

  it("o identificador de teste não conta como «por aplicar», nem na lista nem no alarme", () => {
    expect(BASE).toContain("WHERE aplicado = 0 AND ${NAO_E_TESTE}");
    expect(BASE).toContain("WHERE aplicado = 0 AND ${NAO_E_TESTE}`, [IDENTIFICADOR_DE_TESTE]");
    expect(BASE).toContain("identificador NOT LIKE CONCAT(?, '%')");
  });

  it("arruma-se nos detalhes da ligação como «Teste da ligação recebido a …»", () => {
    expect(BASE).toContain("ultimoTesteDaLigacao:");
    const detalhes = PRINCIPAL.slice(PRINCIPAL.indexOf("<details"));
    expect(detalhes).toContain("Teste da ligação recebido a");
  });

  it("«veio sem assinatura» não culpa o segredo; «assinatura não confere» culpa", () => {
    const i = PAINEL.indexOf("export function leituraDaRecusa");
    const f = PAINEL.slice(i, PAINEL.indexOf("\n}\n", i));
    expect(f).toContain('porque === "veio sem assinatura"');
    expect(f).toContain("Chegou um pedido sem assinatura (não é do euPago).");
    expect(f).toContain("o que não bate é o segredo");
  });
});
