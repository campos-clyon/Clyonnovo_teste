import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { estadoDoPagar } from "../../app-cliente/src/lib/pagamento";
import type { Pagamento, PendenteDoPagamento } from "../../app-cliente/src/lib/pedidos";
import {
  A_ESPERA_DA_TRANSFERENCIA,
  DEPOIS_DA_TRANSFERENCIA,
  O_PAGAMENTO_VEM_A_CAMINHO_POR_TRANSFERENCIA,
  OUTRO_METODO,
} from "./palavras-do-pagamento";
import type { TransferenciaParaOCliente } from "./transferencia-bancaria";

/**
 * A TRANSFERÊNCIA À ESPERA NAS DUAS APPS — d13, 07-11-2026 (a parte das apps;
 * o servidor saiu em 441e32c8). O profissional lê, na app Pro, a mesma frase do
 * painel; o cliente vê, na app, «À espera da transferência» com os dados para
 * transferir, como no site — e não lhe oferecem o MB WAY nem o Multibanco como
 * se nada estivesse feito.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

const AGORA = Date.parse("2026-11-07T12:00:00Z");
const pendente = (o: Partial<PendenteDoPagamento>): PendenteDoPagamento => ({
  metodo: "multibanco",
  metodoTexto: "Multibanco",
  entidade: null,
  referencia: null,
  valorTexto: "861,00 € (700,00 € sem IVA)",
  expiraEm: null,
  expiraEmTexto: null,
  ...o,
});
const TRANSFERENCIA: TransferenciaParaOCliente = {
  iban: "PT50 0000 0000 0000 0000 0000 0",
  titular: "CLYON",
  valor: 861,
  valorSemIva: 700,
  descritivo: "Pedido #123",
  limite: 700,
};
const pagamento = (o: Partial<Pagamento>): Pagamento => ({
  disponivel: true,
  pago: false,
  pagoEmTexto: null,
  emDinheiroAoProfissional: false,
  pendentes: [],
  ivaIncluido: true,
  valoresTexto: { comFactura: "861,00 € (700,00 € sem IVA)", semFactura: "700,00 €" },
  ...o,
});

describe("app de cliente: a transferência à espera", () => {
  const aEspera = pagamento({
    pendentes: [pendente({ metodo: "transferencia", metodoTexto: "Transferência bancária" })],
    transferencia: TRANSFERENCIA,
    aEsperaDaTransferencia: true,
  });

  it("com a transferência escolhida e à espera, é «à espera», com os dados da R5 — não «por pagar»", () => {
    expect(estadoDoPagar(aEspera, AGORA)).toEqual({
      tipo: "a-espera-da-transferencia",
      transferencia: TRANSFERENCIA,
      podePagarDeOutraForma: true,
    });
  });

  it("sem os dados (a R5 não os mandou), continua à espera, sem inventar", () => {
    const e = estadoDoPagar({ ...aEspera, transferencia: null }, AGORA);
    expect(e).toMatchObject({ tipo: "a-espera-da-transferencia", transferencia: null });
  });

  it("um site antigo, sem `aEsperaDaTransferencia`: a pendente é transferência, logo à espera (como o site)", () => {
    const { aEsperaDaTransferencia: _, ...antigo } = aEspera;
    expect(estadoDoPagar(antigo as Pagamento, AGORA).tipo).toBe("a-espera-da-transferencia");
  });

  it("«Pagar por MB WAY ou Multibanco» só quando o servidor abre pagamentos", () => {
    expect(estadoDoPagar({ ...aEspera, disponivel: false }, AGORA)).toMatchObject({ podePagarDeOutraForma: false });
  });

  it("pedida outra forma, volta o bloco de pagar — e a transferência nunca passa por referência", () => {
    const comRef = pagamento({
      ...aEspera,
      pendentes: [pendente({ metodo: "transferencia", referencia: "123 456 789" })],
    });
    expect(estadoDoPagar(comRef, AGORA, { outraForma: true })).toEqual({
      tipo: "por-pagar",
      multibanco: null,
      mbwayNaoConfirmado: false,
    });
  });

  it("passado o prazo (o servidor diz que já não espera): volta «por pagar»", () => {
    expect(estadoDoPagar({ ...aEspera, aEsperaDaTransferencia: false }, AGORA).tipo).toBe("por-pagar");
  });

  it("se depois escolheu o MB WAY (o mais recente vem primeiro), é esse que se mostra", () => {
    const e = estadoDoPagar(
      {
        ...aEspera,
        pendentes: [
          pendente({ metodo: "mbway", expiraEm: new Date(AGORA + 60_000).toISOString() }),
          ...aEspera.pendentes,
        ],
      },
      AGORA,
    );
    expect(e.tipo).toBe("a-confirmar-mbway");
  });

  it("pago ganha a tudo", () => {
    expect(estadoDoPagar({ ...aEspera, pago: true }, AGORA).tipo).toBe("pago");
  });

  it("o ecrã de pagar mostra o bloco com as palavras do site e não oferece as formas de pagar sem o pedido do cliente", () => {
    const ecra = semComentarios(ler("app-cliente/src/componentes/Pagar.tsx"));
    const i = ecra.indexOf('estado.tipo === "a-espera-da-transferencia" ? (');
    expect(i).toBeGreaterThan(-1);
    const bloco = ecra.slice(i, ecra.indexOf(") : referencia && estado.multibanco ? (", i));
    expect(bloco.length).toBeGreaterThan(50);
    expect(bloco).toContain("{A_ESPERA_DA_TRANSFERENCIA}");
    expect(bloco).toContain("<DadosDaTransferencia t={estado.transferencia} />");
    expect(bloco).toContain("{DEPOIS_DA_TRANSFERENCIA}");
    expect(bloco).toContain("titulo={OUTRO_METODO}");
    expect(bloco).toMatch(/setOutraForma\(true\)/);
    expect(bloco).not.toMatch(/Pagar \$\{total\}|MB_WAY\}|REFERENCIA_MULTIBANCO/);
    expect(ecra).toMatch(/estadoDoPagar\(pg, agora, \{[^}]*outraForma[^}]*\}\)/);
    // O IBAN copia-se sem espaços (a regra com a barra: `/s+/` tiraria a letra s).
    expect(ecra).toContain('copia={t.iban.replace(/\\s+/g, "")}');
    // As palavras são as do site, não escritas à mão.
    for (const frase of [A_ESPERA_DA_TRANSFERENCIA, DEPOIS_DA_TRANSFERENCIA, OUTRO_METODO]) expect(ecra).not.toContain(frase);
  });

  it("o resumo no ecrã do pedido diz «À espera da transferência» em vez de «Pagar Z €»", () => {
    const ecra = semComentarios(ler("app-cliente/src/componentes/Pagar.tsx"));
    const resumo = ecra.slice(ecra.indexOf("export function ResumoDoPagamento"));
    const i = resumo.indexOf('estado.tipo === "a-espera-da-transferencia" ? (');
    expect(i).toBeGreaterThan(-1);
    const bloco = resumo.slice(i, resumo.indexOf('estado.tipo === "a-confirmar-mbway"', i));
    expect(bloco).toContain("{A_ESPERA_DA_TRANSFERENCIA}");
    expect(bloco).not.toMatch(/Pagar \$\{/);
  });

  it("a regra é a do site: a app lê `oQueEstaAEspera` de transferencia-bancaria.ts", () => {
    const regra = ler("app-cliente/src/lib/pagamento.ts");
    expect(regra).toMatch(/import \{[^}]*oQueEstaAEspera[^}]*\} from "\.\.\/\.\.\/\.\.\/src\/lib\/transferencia-bancaria"/);
    expect(ler("src/components/PagarTrabalho.tsx")).toContain("oQueEstaAEspera(estado)");
  });
});

describe("app Pro: o pagamento vem a caminho, por transferência", () => {
  const ecra = semComentarios(ler("app-pro/src/componentes/TrabalhoContratado.tsx"));

  it("com `pagamentoACaminho: \"transferencia\"`, mostra a constante e não o «Pode ir fazer o trabalho…»", () => {
    expect(ecra).toMatch(
      /t\.clientePagou === false && t\.pagamentoACaminho === "transferencia" \? \(\s*<Mensagem tom="aviso" texto=\{O_PAGAMENTO_VEM_A_CAMINHO_POR_TRANSFERENCIA\.inteira\} \/>/,
    );
    const i = ecra.indexOf("Pode ir fazer o trabalho");
    expect(i).toBeGreaterThan(-1);
    // O «Pode ir…» só sai quando NÃO é uma transferência a caminho.
    const antes = ecra.slice(Math.max(0, i - 400), i);
    expect(antes).toMatch(/t\.clientePagou === false && t\.pagamentoACaminho !== "transferencia" \? \(/);
  });

  it("a app usa a constante (sem a frase à mão), e o painel também", () => {
    expect(ecra).toMatch(/import \{ O_PAGAMENTO_VEM_A_CAMINHO_POR_TRANSFERENCIA \} from "\.\.\/\.\.\/\.\.\/src\/lib\/palavras-do-pagamento"/);
    expect(ecra).not.toContain(O_PAGAMENTO_VEM_A_CAMINHO_POR_TRANSFERENCIA.titulo);
    const painel = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(painel).toContain("{O_PAGAMENTO_VEM_A_CAMINHO_POR_TRANSFERENCIA.titulo}");
    expect(painel).toContain("{O_PAGAMENTO_VEM_A_CAMINHO_POR_TRANSFERENCIA.texto}");
  });

  it("o tipo da app conhece o campo que o meus-pedidos manda", () => {
    expect(ler("app-pro/src/lib/trabalhos.ts")).toMatch(/pagamentoACaminho\?: "transferencia" \| null;/);
    expect(ler("src/app/api/profissionais/meus-pedidos/route.ts")).toMatch(/pagamentoACaminho: .*"transferencia" as const/);
  });
});
