import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O titular apaga a própria conta — cliente e profissional.
 *
 * O teste que mais importa aqui é o primeiro: o ecrã do cliente PROMETIA que os
 * pedidos ficavam anonimizados, e o código não anonimizava nada. Uma promessa
 * escrita no ecrã e não cumprida no código é a pior espécie de defeito, porque
 * ninguém vai procurá-la — o ecrã diz que está feito.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");
const ROTA_CLIENTE = ler("src/app/api/users/me/route.ts");
const ROTA_PRO = ler("src/app/api/profissionais/conta/route.ts");
const ECRA_CLIENTE = ler("src/app/conta/components/Seguranca.tsx");
const ECRA_PRO = ler("src/app/profissionais/painel/Perfil.tsx");
const MODAL = ler("src/components/ApagarContaModal.tsx");

const semNotas = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** O corpo de `apagarContaDeCliente`, sem os comentários que o explicam. */
const CORPO_CLIENTE = (() => {
  const i = DB.indexOf("export async function apagarContaDeCliente(");
  expect(i, "apagarContaDeCliente não encontrada").toBeGreaterThan(-1);
  const fim = DB.indexOf("export async function apagarFotosDoBlob", i);
  return semNotas(DB.slice(i, fim));
})();

describe("apagar a conta do cliente", () => {
  it("anonimiza mesmo os pedidos — que era o que o ecrã prometia sem fazer", () => {
    /*
     * O DELETE limpava a linha em `users` e mais nada. O nome, o telefone, o
     * email, a morada completa e as fotografias da casa continuavam em
     * `simulatorOrders`, exactamente onde estavam.
     */
    expect(CORPO_CLIENTE).toContain("UPDATE simulatorOrders");
    for (const campo of [
      "contactName = NULL",
      "contactPhone = NULL",
      "contactEmail = NULL",
      "address = NULL",
      "filesJson = NULL",
      "rawOrderJson = NULL",
      "chatJson = NULL",
    ]) {
      expect(CORPO_CLIENTE, `${campo} não é limpo`).toContain(campo);
    }
  });

  it("fecha o link do pedido", () => {
    // O token de acesso abre o pedido a quem tiver o endereço. Deixá-lo vivo
    // era deixar uma porta aberta para dados que se acabaram de apagar.
    expect(CORPO_CLIENTE).toContain("acessoTokenHash = NULL");
  });

  it("recusa a meio de um trabalho contratado", () => {
    // Sem este guarda, o profissional ficava a trabalhar para ninguém, com o
    // dinheiro preso entre os dois.
    expect(CORPO_CLIENTE).toContain("estado = 'acordada' AND confirmadoEm IS NULL");
    expect(CORPO_CLIENTE).toContain("ContaComPendencias");
  });

  it("baralha o email em vez de o deixar na linha", () => {
    /*
     * `getOrCreateUser` faz o upsert e depois procura `WHERE email = ? AND
     * deletedAt IS NULL`. Com o email na linha apagada, o INSERT via-a e o
     * SELECT não: quem apagasse a conta e voltasse a entrar com o Google
     * apanhava um erro em vez de uma conta nova.
     */
    expect(CORPO_CLIENTE).toContain("CONCAT('apagado-', id, '@removido.invalid')");
    expect(CORPO_CLIENTE).toContain("deletedAt = NOW()");
  });

  it("recolhe as fotografias antes de limpar a coluna", () => {
    // Depois de `filesJson` ir a NULL já não há URLs para apagar do Blob — os
    // ficheiros ficariam lá, acessíveis, para sempre.
    const iRecolha = CORPO_CLIENTE.indexOf("fotos.push");
    const iLimpeza = CORPO_CLIENTE.indexOf("filesJson = NULL");
    expect(iRecolha).toBeGreaterThan(-1);
    expect(iRecolha).toBeLessThan(iLimpeza);
  });

  it("anonimiza o registo permanente sem o apagar", () => {
    expect(CORPO_CLIENTE).toContain('anonimizarRegisto({ clienteEmail: alvo }, "conta_cliente")');
    expect(CORPO_CLIENTE).toContain('acontecimento: "conta_apagada"');
  });

  it("apaga as fotografias do Blob uma a uma, sem desistir à primeira falha", () => {
    // O que falta apagar continua a ser dados de alguém que pediu para os ver
    // apagados. Desistir ao primeiro erro deixava o resto lá.
    const blob = DB.slice(DB.indexOf("export async function apagarFotosDoBlob"));
    expect(blob).toContain("for (const url of urls)");
    expect(blob).toMatch(/try\s*\{[\s\S]*?await del\(url\)/);
  });
});

describe("as rotas do titular", () => {
  it("exigem a palavra escrita à mão", () => {
    // Sem isto, qualquer página aberta com a sessão da pessoa podia apagar-lhe
    // a conta com um `fetch`.
    expect(ROTA_CLIENTE).toContain('corpo.confirmacao !== "ELIMINAR"');
    expect(ROTA_PRO).toContain('corpo.confirmacao !== "ELIMINAR"');
  });

  it("o profissional é suspenso antes de a conta ser apagada", () => {
    /*
     * Suspender é o que o tira da distribuição, e tem de estar GRAVADO antes de
     * o apagar começar — senão um pedido novo pode chegar-lhe a meio, para uma
     * conta que está a desaparecer.
     */
    const semN = semNotas(ROTA_PRO);
    const iSuspender = semN.indexOf('definirEstadoDoProfissional(sessao.providerId, "suspenso")');
    const iApagar = semN.indexOf("apagarProfissional(sessao.providerId");
    expect(iSuspender).toBeGreaterThan(-1);
    expect(iApagar).toBeGreaterThan(iSuspender);
  });

  it("a sessão do profissional morre com a conta", () => {
    // Sem isto, o cookie continuava válido para uma conta que já não existe, e
    // o painel respondia com ecrãs vazios em vez de o mandar embora.
    expect(ROTA_PRO).toMatch(/cookies\.set\(COOKIE_SESSAO_PROFISSIONAL, "", \{ maxAge: 0/);
  });

  it("as duas distinguem pendências de avaria", () => {
    for (const [nome, rota] of [["cliente", ROTA_CLIENTE], ["profissional", ROTA_PRO]] as const) {
      expect(rota, `${nome}: falta ContaComPendencias`).toContain("ContaComPendencias");
      expect(rota, `${nome}: falta o 409`).toMatch(/status:\s*409/);
    }
  });
});

describe("os ecrãs", () => {
  it("os dois lados usam o mesmo modal", () => {
    // Escrito duas vezes, um dos lados acabava com um guarda ou uma frase que o
    // outro não tinha — foi o que aconteceu ao rodapé quando havia dois.
    expect(ECRA_CLIENTE).toContain("@/components/ApagarContaModal");
    expect(ECRA_PRO).toContain("@/components/ApagarContaModal");
  });

  it("o que abre é uma linha discreta, e não uma caixa vermelha", () => {
    /*
     * Havia uma "Zona de perigo" com moldura vermelha e um parágrafo permanente
     * no ecrã de quem só queria mudar a palavra-passe. Um aviso vermelho que
     * está sempre lá deixa de ser um aviso.
     */
    expect(semNotas(ECRA_CLIENTE)).not.toContain("Zona de perigo");
    expect(ECRA_CLIENTE).toContain("LinhaApagarConta");
    expect(ECRA_PRO).toContain("LinhaApagarConta");
    expect(MODAL).toContain("text-xs text-slate-400");
  });

  it("o botão de confirmar não liga sem a palavra certa", () => {
    expect(MODAL).toContain('palavra !== "ELIMINAR"');
  });

  it("o ecrã do cliente trata por você, como o resto do site", () => {
    /*
     * Dizia "os teus dados", "Escreve ELIMINAR", "Tenta novamente" — a mesma
     * pessoa, na mesma visita, tratada de duas maneiras conforme o ecrã.
     */
    const texto = semNotas(ECRA_CLIENTE) + semNotas(MODAL);
    for (const tu of ["os teus ", "o teu ", "a tua ", "Escreve ", "Tenta novamente", "eliminares"]) {
      expect(texto, `ainda trata por tu: "${tu}"`).not.toContain(tu);
    }
  });

  it("o aviso diz o que se perde de facto, e não uma generalidade", () => {
    // "Os teus dados pessoais serão eliminados" não diz nada a ninguém. O que
    // sai tem nome: telefone, morada, facturação, fotografias.
    expect(ECRA_CLIENTE).toContain("fotografias");
    expect(ECRA_PRO).toContain("IBAN");
  });
});
