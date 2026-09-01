import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O painel do profissional é um produto MÓVEL.
 *
 * "Ajuste a adaptação do site ao telemóvel."
 *
 * Não é uma preferência: é o que os números dizem. Nos últimos sete dias, do
 * Analytics da Vercel — **82% das visitas são de telemóvel** (Android 59%,
 * iOS 24%), e a página mais vista de todo o site é `/profissionais/painel`,
 * com 94 visitas. O ecrã de referência é 360×800, não um portátil.
 *
 * O DEFEITO QUE DEU ORIGEM A ISTO estava numa captura do telemóvel dele: a
 * linha do dinheiro tinha cinco filhos num `flex` sem `flex-wrap`, e num ecrã
 * de 360 px o texto «já com a taxa, sem IVA» ficava espremido numa coluna de
 * UMA PALAVRA de largura — lia-se na vertical, uma palavra por linha.
 *
 * Cinco auditores independentes procuraram os irmãos dele. Este ficheiro
 * guarda o que encontraram, para não voltar.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const TRABALHOS = ler("src/app/profissionais/painel/Trabalhos.tsx");
const AGENDA = ler("src/app/profissionais/painel/Agenda.tsx");
const CARTEIRA = ler("src/app/profissionais/painel/Carteira.tsx");
const PERFIL = ler("src/app/profissionais/painel/Perfil.tsx");
const ANEXO = ler("src/components/Anexo.tsx");
const FOTOS = ler("src/components/EnviarFotos.tsx");

describe("nada se lê na vertical", () => {
  /*
   * O PADRÃO Nº1 DE TODA A AUDITORIA: três auditores viram-no em quatro
   * sítios diferentes. Uma linha `flex` com dois ou mais textos e sem
   * `flex-wrap`: os textos ficam presos à mesma linha e o único caminho que
   * lhes resta é partirem por dentro, em colunas paralelas.
   */
  it("a linha do dinheiro quebra em vez de espremer", () => {
    expect(TRABALHOS).toContain('className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1"');
    expect(TRABALHOS).toContain('whitespace-nowrap text-[11px] text-slate-400');
  });

  it("a cidade e a distância também", () => {
    // «Algueirão-Mem · menos de 1» numa coluna, «Martinskm» noutra.
    expect(TRABALHOS).toContain('className="flex flex-wrap items-center gap-x-1 gap-y-0.5"');
  });

  it("o nome e o telefone do cliente, na agenda", () => {
    // «912 345» numa linha e «678» na outra, no ecrã que existe para ligar.
    expect(AGENDA).toContain("flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs");
  });

  it("e a morada do trabalho não transborda", () => {
    expect(TRABALHOS).toContain("flex items-start gap-2 break-words text-sm text-emerald-900");
  });

  it("a descrição do cliente parte palavras compridas", () => {
    /*
     * `whitespace-pre-line` quebra em espaços mas NUNCA dentro de uma palavra:
     * uma ligação do OLX ou um email transbordava o cartão, e o que passava
     * dos 360 px era cortado pelo `overflow-x: hidden` da página — sem
     * rolamento que o recuperasse. É o texto onde o cliente diz o que há para
     * levar.
     */
    expect(TRABALHOS).toContain("whitespace-pre-line break-words text-sm leading-relaxed");
  });
});

describe("o que se lê, lê-se todo", () => {
  it("o título do trabalho não é cortado a meio", () => {
    /*
     * Com `truncate` sobravam ~147 px, e «Esvaziamento de casa» e
     * «Esvaziamento de apartamento» ficavam AMBOS «Esvaziamento de ...». O
     * título é o que identifica o trabalho na lista: dois trabalhos
     * diferentes passavam a ler-se iguais.
     */
    expect(TRABALHOS).toContain('className="line-clamp-2 text-[15px] font-bold text-[#0B1929]"');
  });

  it("o botão de arquivar deixa de tapar o «por carga»", () => {
    // Está em posição absoluta e o cartão não lhe reservava espaço nenhum.
    expect(TRABALHOS).toContain('podeArrumar ? "pb-16" : ""');
  });

  it("o email lê-se inteiro, porque deixou de ser um campo desactivado", () => {
    /*
     * Um `<input disabled>` não recebe foco, não rola e não se selecciona: no
     * telemóvel o fim de um email comprido ficava inalcançável. E a ajuda ao
     * lado diz «é com este email que entra».
     */
    expect(PERFIL).toContain("break-all bg-slate-50 text-slate-500");
    expect(PERFIL).not.toContain("value={dados.email} disabled");
  });

  it("a fotografia grande do detalhe deixa de ser recortada", () => {
    /*
     * Uma foto de telemóvel ao alto perdia ~35% da altura numa caixa larga —
     * e é sobre essa fotografia que se decide o preço. Não se resolvia no
     * sítio da chamada: `object-cover` e `object-contain` têm a mesma
     * especificidade e o Tailwind escreve `cover` depois.
     */
    expect(ANEXO).toContain('encaixe?: "cobrir" | "inteira"');
    expect(ANEXO).toContain('encaixe === "inteira" ? "object-contain" : "object-cover"');
    expect(TRABALHOS).toContain('encaixe="inteira"');
  });
});

describe("o contraste chega para um telemóvel ao sol", () => {
  it("a linha que diz «sem IVA» passa a norma AA", () => {
    // #94A3B8 sobre branco dá 2,56:1; a norma pede 4,5:1. O slate-500 dá 4,76.
    expect(TRABALHOS).toContain("já com a taxa CLYON descontada");
    const i = TRABALHOS.indexOf("já com a taxa CLYON descontada");
    expect(TRABALHOS.slice(i - 200, i)).toContain("text-slate-500");
  });

  it("a pista de que a fotografia abre também", () => {
    const i = TRABALHOS.indexOf("Toque para ver em ecrã inteiro");
    expect(TRABALHOS.slice(i - 120, i)).toContain("text-slate-500");
  });

  it("e a frase que explica um botão morto na carteira", () => {
    // Quem pede menos do que o mínimo via um botão apagado e a explicação em
    // cinzento quase branco. Aqui vale slate-600: é a razão de um bloqueio.
    expect(CARTEIRA).toContain("text-center text-xs leading-relaxed text-slate-600");
  });
});

describe("os alvos de toque têm a medida do dedo", () => {
  it("os separadores da navegação principal", () => {
    // Seis alvos encostados uns aos outros no ecrã mais visto do site, a
    // ~37 px. Cada falha custa dois toques.
    expect(TRABALHOS).toContain("flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-3");
  });

  it("o telefone do cliente na agenda", () => {
    expect(AGENDA).toContain("mt-0.5 flex min-h-[44px] basis-full items-center");
  });

  it("o cursor do raio de acção", () => {
    // A calha nativa tem 16 px, e é ela que decide que trabalhos lhe chegam.
    expect(PERFIL).toContain("mt-2 h-11 w-full cursor-pointer accent-cyan-600");
  });

  it("e o botão de tirar uma fotografia da prova", () => {
    /*
     * 28 px num gesto destrutivo colado ao canto de uma miniatura. Falhar o
     * alvo significa carregar na miniatura, que não faz nada — e ele fica sem
     * perceber porque é que a foto não sai. O disco visível continua com 28;
     * o alvo é que passou a 44.
     */
    expect(FOTOS).toContain("absolute -right-2.5 -top-2.5 flex h-11 w-11 items-center justify-center");
    expect(FOTOS).toContain("flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/85");
  });
});
