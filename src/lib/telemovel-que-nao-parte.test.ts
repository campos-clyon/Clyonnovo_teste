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
/** Sem os comentários: o que eles CONTAM não pode fazer um teste falhar. */
const semNotas = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
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

  it("o botão de arquivar já não tapa o «por carga» — saiu do cartão", () => {
    /*
     * A primeira correcção foi reservar-lhe espaço (`pb-16`): ele estava em
     * posição absoluta no canto e o fundo branco tapava o distintivo «por
     * carga», a etiqueta que diz se o valor é o trabalho todo ou cada viagem
     * ao aterro.
     *
     * A segunda foi melhor, e é a de 12-09-2026: "remova o botão arquivar
     * aqui; esse botão deve estar apenas ao abrir o pedido". Sem botão não há
     * nada a tapar, e a faixa de dezasseis pixéis que ele obrigava a reservar
     * em TODOS os cartões saiu com ele.
     */
    // `semNotas`: os comentários CONTAM a história do `pb-16`, e um teste não
    // pode falhar por causa da explicação de porque é que ele saiu.
    const cartao = semNotas(
      TRABALHOS.slice(
        TRABALHOS.indexOf("onClick={() => abrirTrabalho(p)}"),
        TRABALHOS.indexOf("// ── Arrumar"),
      ),
    );
    expect(cartao).not.toContain("pb-16");
    expect(cartao).not.toContain("absolute bottom-3 right-3");
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

  it("as fotografias do pedido são um carrossel, e não selos de 70 px", () => {
    /*
     * "Ao abrir o pedido quero a primeira imagem já aberta e as demais em
     * forma de carrossel, só puxa para o lado para ver." — 12-09-2026.
     *
     * Estava uma fotografia em grande e as outras numa grelha de quadradinhos
     * de quatro colunas. Num pedido com dez fotografias, as nove seguintes
     * eram selos onde não se vê o que interessa — se o sofá está desmontado,
     * se o corredor tem degraus — e obrigavam a abrir o visor nove vezes para
     * ver o mesmo que um dedo mostra num gesto.
     */
    const galeria = TRABALHOS.slice(
      TRABALHOS.indexOf("O que o cliente enviou, em grande"),
      TRABALHOS.indexOf("Toque para ver em ecrã inteiro"),
    );
    expect(galeria).toContain("snap-x snap-mandatory overflow-x-auto");
    expect(galeria).toContain("w-full shrink-0 snap-center");
    // Todas com o mesmo tamanho, e todas inteiras: a segunda fotografia decide
    // tanto como a primeira.
    expect(galeria).toContain('className="mx-auto h-64 w-full"');
    expect(semNotas(galeria)).not.toContain("grid-cols-4");
  });

  it("e diz-se quantas são, porque dez bolinhas não se contam de relance", () => {
    // As bolinhas dizem ONDE ele está; o número diz QUANTAS faltam — e é a
    // segunda que decide se vale a pena continuar a puxar.
    expect(TRABALHOS).toContain("{fotoAVer + 1} / {doCliente.length}");
    expect(TRABALHOS).toContain("puxe para o lado para ver as outras");
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
