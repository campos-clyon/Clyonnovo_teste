import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O INÍCIO PASSA A DIZER O QUE PRECISA DE SI.
 *
 * "Essa tela de início já não condiz com as novas ferramentas, está
 * desactualizada. Vamos colocá-la no modo actual, com informações precisas
 * como num painel bem planeado." — 12-09-2026.
 *
 * O que lá estava contava os pedidos do simulador por estados que já não se
 * usam — seis caixas a zero, e um «A carregar…» que nunca acabava — mais os
 * leads do site com quatro travessões. Nada sobre a plataforma que entretanto
 * nasceu: negociações, agenda, o assistente do WhatsApp, carteiras,
 * levantamentos, candidaturas.
 *
 * A regra do ecrã novo: só entra o que alguém tem de FAZER, e cada número é
 * um link para onde se resolve.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const PAINEL = ler("src/components/admin/AdminInicioPanel.tsx");
const SHELL = ler("src/components/admin/LegacyAdminClient.tsx");
const ROTA = ler("src/app/api/admin/resumo/route.ts");
const DB = ler("src/lib/db.ts");

/** O corpo do resumo, sem apanhar SQL de funções vizinhas. */
const RESUMO = (() => {
  const i = DB.indexOf("export async function resumoDoBackoffice(");
  expect(i, "resumoDoBackoffice não existe").toBeGreaterThan(-1);
  return DB.slice(i);
})();

describe("o ecrã antigo saiu", () => {
  it("já não conta os estados do simulador que ninguém usa", () => {
    // Eram seis caixas — Novos, Atribuídos, Em análise, Aprovados,
    // Confirmados, Presencial — todas a zero, com um «A carregar…» preso.
    const i = SHELL.indexOf('{activeSection === "overview" && (');
    const bloco = SHELL.slice(i, SHELL.indexOf('{activeSection === "pedidos"', i));
    expect(bloco).toContain("<AdminInicioPanel");
    expect(bloco).not.toContain("Pedidos do simulador");
    expect(bloco).not.toContain("Leads e contactos do site");
  });
});

describe("só entra o que alguém tem de fazer", () => {
  it("os oito cartões são os oito sítios onde há trabalho parado", () => {
    for (const t of [
      "atrasados",
      "à espera de si",
      "por enviar",
      "sem dia marcado",
      "por transferir",
      "candidaturas",
      "por aprovar",
      "conversas suas",
    ]) {
      expect(PAINEL).toContain(t);
    }
  });

  it("um zero não ocupa uma caixa — desaparece", () => {
    /*
     * Oito caixas a zero não são informação: são ruído com ar de trabalho. É
     * o defeito exacto do ecrã que saiu.
     */
    expect(PAINEL).toContain(".filter((c) => c.n != null && c.n > 0)");
  });

  it("o ecrã vazio é uma resposta, e diz-se por extenso", () => {
    expect(PAINEL).toContain("Nada à espera de si");
    expect(PAINEL).toContain("Está tudo tratado.");
  });

  it("cada cartão leva ao ecrã que resolve aquilo", () => {
    // Um número que não se pode carregar obriga a procurar o ecrã à mão — e é
    // aí que se desiste.
    expect(PAINEL).toContain("onClick={() => onAbrir(c.seccao)}");
    for (const s of [
      '"agenda"',
      '"negociacoes_clyon"',
      '"pedidos"',
      '"levantamentos"',
      '"profissionais"',
      '"whatsapp"',
    ]) {
      expect(PAINEL).toContain(s);
    }
  });

  it("e o shell sabe abrir essas secções", () => {
    expect(SHELL).toContain("onAbrir={(s) => setActiveSection(s as AdminSection)}");
  });
});

describe("os números contam o que dizem contar", () => {
  it("«por enviar» é o espelho exacto da lista por promover", () => {
    // Ou o pedido tem negociações e está na mesa, ou não tem e está por
    // enviar. Nunca nas duas, nunca em nenhuma.
    expect(RESUMO).toContain(
      "NOT EXISTS (SELECT 1 FROM negociacoes n WHERE n.pedidoId = o.id)",
    );
  });

  it("«à espera de si» é só onde a CLYON responde pelo cliente", () => {
    /*
     * Nas outras a bola está do lado do cliente. Contá-las aqui era pedir à
     * equipa que respondesse por quem pode falar por si — o mesmo erro que a
     * mesa das negociações já tinha corrigido.
     */
    expect(RESUMO).toContain("'backoffice'");
    expect(RESUMO).toContain("o.contactEmail IS NULL OR TRIM(o.contactEmail) = ''");
  });

  it("«atrasados» olha para a data combinada, e não só para a do cliente", () => {
    // O dia que manda é o que ficou combinado; o do formulário é o ponto de
    // partida. São a mesma data, não duas.
    expect(RESUMO).toContain("COALESCE(g.dataCombinada, o.dataAgendada)");
  });

  it("as candidaturas incluem os convites antigos por usar", () => {
    // `convidada` é quem escreveu tudo e ficou sem conta nenhuma.
    expect(RESUMO).toContain("estado IN ('nova','convidada')");
  });

  it("um número que falhe não leva o painel atrás", () => {
    /*
     * Um painel que rebenta por causa de um contador é pior do que um
     * contador em falta. Cada consulta devolve null e o cartão desaparece.
     */
    expect(DB).toContain("async function conta(");
    const i = DB.indexOf("async function conta(");
    expect(DB.slice(i, i + 700)).toContain("return null;");
  });
});

describe("uma chamada, e não sete", () => {
  it("o ecrã pede tudo de uma vez", () => {
    expect(PAINEL).toContain('fetch("/api/admin/resumo"');
    expect(RESUMO).toContain("await Promise.all([");
  });

  it("e a rota é só para quem entrou no backoffice", () => {
    expect(ROTA).toContain("const { err } = await requireAdmin(req);");
  });
});
