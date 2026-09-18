import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eDeVersaoAntiga } from "@/app/error";
import { aceitar, type Negociacao } from "./negociacao";

/**
 * O ECRÃ BRANCO COM UMA FRASE EM INGLÊS.
 *
 * "Application error: a client-side exception has occurred while loading
 * clyon.pt (see the browser console for more information)."
 *
 * Foi o que um profissional viu ao abrir o trabalho #585, a meio da tarde, com
 * o cliente à espera. Ele deu F5 e passou — e esse F5 é a pista toda.
 *
 * O SEPARADOR ERA DE ANTES DE UM DEPLOY. O HTML que ele tinha aponta para
 * pedaços de JavaScript com o nome da versão antiga; ao navegar para um ecrã
 * ainda não carregado, o browser foi buscar um ficheiro que já não existia.
 * Não havia avaria no trabalho, na negociação nem na conta: havia um separador
 * velho a falar com um servidor novo. Nesse dia houve quatro deploys em poucas
 * horas, e quem tem o painel aberto o dia inteiro é precisamente quem apanha
 * isto.
 *
 * O projecto não tinha `error.tsx` em lado nenhum — por isso o que aparecia era
 * o texto por omissão do Next, em inglês, a mandar abrir a consola do browser.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("um erro de versão reconhece-se", () => {
  it("pelo nome que o Next lhe dá", () => {
    expect(eDeVersaoAntiga({ name: "ChunkLoadError", message: "qualquer coisa" })).toBe(true);
  });

  it("e pelas frases que os browsers usam — que não são a mesma", () => {
    /*
     * Chrome, Firefox e Safari dizem isto de três maneiras. Reconhecer só uma
     * deixava dois terços dos profissionais no ecrã branco.
     */
    for (const m of [
      "Loading chunk 4821 failed.",
      "Failed to fetch dynamically imported module: https://clyon.pt/_next/static/chunks/x.js",
      "error loading dynamically imported module",
      "Importing a module script failed.",
    ]) {
      expect(eDeVersaoAntiga({ name: "TypeError", message: m }), m).toBe(true);
    }
  });

  it("e uma avaria a sério NÃO passa por erro de versão", () => {
    // Senão recarregava a página em cima de um bug de verdade, e o bug ficava
    // escondido atrás de um ecrã a piscar.
    for (const m of ["Cannot read properties of undefined", "x is not a function", ""]) {
      expect(eDeVersaoAntiga({ name: "TypeError", message: m })).toBe(false);
    }
  });
});

describe("o ecrã de erro", () => {
  const ERRO = semComentarios(ler("src/app/error.tsx"));

  it("existe — era isso que faltava para a frase ser em inglês", () => {
    expect(ERRO).toContain('"use client"');
    expect(ERRO).toContain("export default function Erro(");
  });

  it("recarrega sozinho quando é versão antiga, e UMA vez só", () => {
    /*
     * Dá o F5 que ele ia ter de dar. Uma vez só, com marca na sessão: um
     * recarregar que se repete é pior do que o ecrã branco — é um ecrã branco
     * a piscar, e sem saída.
     */
    expect(ERRO).toContain("window.location.reload()");
    expect(ERRO).toContain("sessionStorage.getItem(JA_RECARREGOU)");
    expect(ERRO).toContain("sessionStorage.setItem(JA_RECARREGOU");
  });

  it("e sem sessionStorage não arrisca o ciclo", () => {
    // Navegação privada, cookies fechados: o acessor estoira. Aí mostra-se o
    // ecrã e é ele que decide carregar no botão.
    expect(ERRO).toContain("} catch {");
  });

  it("fala português e diz o que fazer", () => {
    expect(ERRO).toContain("Não foi possível abrir este ecrã");
    expect(ERRO).toContain("Tentar outra vez");
    expect(ERRO).toContain("Recarregar a página");
    expect(ERRO).not.toContain("client-side exception");
  });

  it("não culpa quem está a ver, e não manda ninguém à consola do browser", () => {
    // Uma pessoa na rua, com o telemóvel na mão e o cliente à espera, não vai
    // abrir a consola do browser.
    expect(ERRO).toContain("Foi um problema nosso");
    expect(ERRO.toLowerCase()).not.toContain("consola do browser");
  });

  it("mas deixa o código do erro à vista, para se poder encontrar nos registos", () => {
    expect(ERRO).toContain("error.digest");
  });
});

describe("aceitar diz PORQUE é que não dá", () => {
  const base: Negociacao = {
    estado: "aberta",
    valorAcordado: null,
    propostas: [
      {
        por: "cliente",
        valor: 350,
        criadaEm: new Date("2026-09-18T18:00:00Z"),
        estado: "pendente",
      },
    ],
  } as unknown as Negociacao;

  const agora = new Date("2026-09-18T18:05:00Z");

  it("o cliente respondeu primeiro — e diz-se isso, em vez de «não há proposta»", () => {
    /*
     * Foi o que se viu: o botão «Aceitar 350,00 €» e a frase «Não há proposta
     * para aceitar» na mesma imagem. A frase não estava errada — a negociação
     * tinha fechado — mas respondia à pergunta errada.
     */
    const fechada = { ...base, estado: "acordada" } as Negociacao;
    const r = aceitar(fechada, "profissional", agora);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toBe("Este trabalho já ficou fechado — o cliente respondeu entretanto.");
  });

  it("já tinha aceitado, e falta o cliente contratar", () => {
    const r = aceitar({ ...base, estado: "aguarda_contratacao" } as Negociacao, "profissional", agora);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("Falta só o cliente confirmar");
  });

  it("acabou mesmo", () => {
    const r = aceitar({ ...base, estado: "desistida" } as Negociacao, "profissional", agora);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toBe("Esta negociação já terminou.");
  });

  it("e quando é mesmo isso, continua a dizer que não há proposta", () => {
    // Sem nada em cima da mesa, a frase antiga é a certa — e fica.
    const vazia = { ...base, propostas: [] } as unknown as Negociacao;
    const r = aceitar(vazia, "profissional", agora);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toBe("Não há proposta para aceitar.");
  });

  it("e com uma proposta do cliente em cima da mesa, aceita-se", () => {
    // A porta continua aberta: isto não pode ser uma correcção que fecha o que
    // funcionava.
    const r = aceitar(base, "profissional", agora);
    expect(r.ok).toBe(true);
  });
});

describe("um pedido recusado faz o ecrã ir buscar a verdade", () => {
  it("o cartão do profissional recarrega quando o servidor diz que não", () => {
    /*
     * Sem isto, o ecrã continua a oferecer o que o servidor acabou de recusar
     * até alguém dar F5. Uma recusa é precisamente o sinal de que o que está à
     * vista já não é o que está na base.
     */
    const CARTAO = semComentarios(
      ler("src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx"),
    );
    const i = CARTAO.indexOf('setErro(dados.error ?? "Não foi possível.");');
    expect(i).toBeGreaterThan(-1);
    expect(CARTAO.slice(i, i + 200)).toContain("onMudou?.();");
  });
});
