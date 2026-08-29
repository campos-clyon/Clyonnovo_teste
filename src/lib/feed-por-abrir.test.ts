import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O Feed, e o «novo» que se apaga sozinho.
 *
 * "Vamos mudar o nome da primeira opção de Novos para Feed. Os pedidos novos
 * ainda não abertos devem ter uma cor e efeito especial, só muda quando for
 * aberto. Outra coisa: os pedidos estão todos a mostrar novo, mas novo deve ser
 * apenas os 5 recentes ainda não abertos."
 *
 * O distintivo estava em todos os cartões, para sempre. Não era um erro de
 * cálculo: «novo» queria dizer «está no separador dos novos», e um trabalho
 * fica lá até ele responder. Um aviso que nunca se apaga passa a fazer parte
 * do fundo — e a coisa que ele devia destacar, o que chegou desde a última
 * vez, deixa de se ver.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const TRABALHOS = ler("src/app/profissionais/painel/Trabalhos.tsx");
const LIMPO = semComentarios(TRABALHOS);
const DB = ler("src/lib/db.ts");
const ROTA = ler("src/app/api/profissionais/abrir/route.ts");
const API = ler("src/app/api/profissionais/meus-pedidos/route.ts");

describe("o separador", () => {
  it("chama-se Feed", () => {
    expect(LIMPO).toContain('{ id: "novos", rotulo: "Feed" }');
    expect(LIMPO).not.toContain('rotulo: "Novos"');
  });
});

describe("saber que ele abriu", () => {
  it("a coluna existe, por profissional", () => {
    // Vive na negociação porque é isso que ela é: o par (pedido, profissional).
    // O mesmo pedido pode estar por abrir para um e lido há dias para outro.
    expect(DB).toContain("ADD COLUMN abertoProfissionalEm DATETIME NULL DEFAULT NULL");
    expect(DB).toContain("n.abertoProfissionalEm,");
  });

  it("grava só a PRIMEIRA abertura", () => {
    const i = DB.indexOf("export async function marcarTrabalhoComoAberto(");
    expect(i).toBeGreaterThan(-1);
    const corpo = DB.slice(i, DB.indexOf("\nexport ", i + 10));
    // Reescrever a data a cada abertura faria um trabalho lido há uma semana
    // parecer acabado de ler.
    expect(corpo).toContain("abertoProfissionalEm IS NULL");
    // E o providerId no WHERE: sem ele, um id adivinhado marcava como visto o
    // trabalho de outra pessoa.
    expect(corpo).toContain("providerId = ?");
  });

  it("a rota exige sessão e falha em silêncio", () => {
    expect(ROTA).toContain("verificarSessaoDoProfissional");
    expect(ROTA).toContain("sessao.providerId");
    // Abrir o trabalho nunca pode ficar à espera de um registo de leitura.
    expect(ROTA).toMatch(/catch[\s\S]*?ok: true, marcou: false/);
  });

  it("o painel recebe a data", () => {
    expect(API).toContain("abertoEm: l.abertoProfissionalEm ?? null");
  });
});

describe("o distintivo «novo»", () => {
  it("são os cinco mais recentes por abrir, e não o separador inteiro", () => {
    expect(LIMPO).toContain("const novo = porAbrir.has(p.negociacaoId);");
    expect(LIMPO).not.toContain('const novo = separadorDe(p) === "novos";');
    expect(LIMPO).toContain(".slice(0, 5)");
    expect(LIMPO).toContain("!p.abertoEm");
  });

  it("o conjunto calcula-se sobre a lista toda, e não cartão a cartão", () => {
    // «Os cinco mais recentes» é uma propriedade do conjunto — os que estão no
    // ecrã e os que ficaram por baixo — e não de cada cartão sozinho.
    expect(LIMPO).toContain("const porAbrir = useMemo(");
  });

  it("apaga-se no toque, sem esperar pela rede", () => {
    expect(LIMPO).toContain("setLidosAgora((antes) => new Set(antes).add(p.negociacaoId));");
    expect(LIMPO).toContain("lidosAgora.has(p.negociacaoId)");
    expect(LIMPO).toContain('fetch("/api/profissionais/abrir"');
  });

  it("não volta a gravar o que já estava aberto", () => {
    expect(LIMPO).toContain("if (p.abertoEm) return;");
  });
});

describe("o realce dos que ainda não abriu", () => {
  it("é o CONTORNO que destaca, e não uma barra à esquerda", () => {
    /*
     * "O azul que aparece do lado esquerdo do pedido quero que remova; basta
     * ter as bordas com um azul claro para destacar o pedido."
     *
     * Eram três coisas a dizer a mesma — barra grossa, anel por fora e fundo.
     * Ficou o contorno e um sopro de cor no fundo.
     */
    expect(LIMPO).toContain("border-2 border-[#8AD8E6]");
    expect(LIMPO).toContain("bg-cyan-50/40");
    expect(LIMPO).not.toContain("border-l-[#00B4CC]");
    expect(LIMPO).not.toContain("ring-1 ring-[#00B4CC]/15");
  });

  it("a barra à esquerda fica reservada ao 🔥, que diz PORQUÊ", () => {
    // Um trabalho a menos de 10 km continua a mudar o cartão inteiro: essa
    // barra não é "é novo", é "é perto".
    expect(LIMPO).toContain("border-l-4 border-l-orange-500");
  });

  it("o distintivo vibra em verde WhatsApp, sem bolinha a piscar", () => {
    /*
     * "Remover a bolinha branca que pisca e colocá-lo para vibrar na cor verde
     * WhatsApp."
     *
     * O ponto a piscar era uma luz; a vibração é um aviso — e o verde já quer
     * dizer "alguém falou contigo" para quem usa a aplicação todos os dias.
     */
    expect(LIMPO).toContain('className="distintivo-novo inline-flex rounded-full bg-[#25D366]');
    expect(LIMPO).not.toContain("animate-pulse motion-reduce:animate-none");
    expect(LIMPO).not.toContain("bg-white/90");
  });

  it("o tremor é curto e espaçado, e pára para quem pediu menos movimento", () => {
    // Movimento constante em cinco cartões faz um ecrã inquieto onde já
    // ninguém olha para nenhum.
    const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(CSS).toContain("@keyframes vibrar-novo");
    /*
     * `display: inline-flex` NAO E ENFEITE: sem ele isto nao mexe.
     *
     * `transform` nao se aplica a elementos inline nao substituidos. O
     * distintivo tinha `flex` por causa da bolinha; ao tirar a bolinha caiu
     * tambem o flex, e a animacao ficou a correr sem deslocar um pixel —
     * `getAnimations()` dizia "running" e a barra nao se mexia. So se viu num
     * browser, a mover a animacao a mao ate ao instante do tremor.
     */
    expect(CSS).toContain("display: inline-flex;");
    expect(CSS).toContain("animation: vibrar-novo 3s ease-in-out infinite;");
    expect(CSS).toContain("prefers-reduced-motion: reduce");
  });

  it("o realce cai quando o cartão é aberto — está preso ao mesmo sinal", () => {
    // `novo` decide as três coisas: o distintivo, a borda e o fundo. Se
    // vivessem em condições separadas, uma delas ficava para trás.
    const i = LIMPO.indexOf("const novo = porAbrir.has(p.negociacaoId);");
    const cartao = LIMPO.slice(i, i + 4000);
    expect(cartao).toContain(": novo");
    expect(cartao).toContain("{novo && (");
  });
});

describe("os hooks e o return antecipado", () => {
  it("nenhum hook fica por baixo do return que abre um trabalho", () => {
    /*
     * O ecrã branco com «Application error» que ele apanhou ao clicar num
     * pedido.
     *
     * `porAbrir` estava por baixo do `return` do trabalho aberto — junto ao
     * sítio onde é usado, que era onde fazia sentido ler. Abrir um trabalho
     * leva a função a sair mais cedo, o useMemo deixa de correr, e o React
     * conta menos hooks do que na volta anterior. A lista de hooks é
     * posicional: uma volta que salta um desalinha todas as seguintes.
     *
     * Este teste é o que impede que volte a acontecer — e voltaria, porque o
     * sítio errado é o sítio legível.
     */
    const corpo = TRABALHOS.slice(TRABALHOS.indexOf("export default function Trabalhos("));
    const saida = corpo.indexOf("const escolhido = pedidos.find(");
    expect(saida).toBeGreaterThan(-1);

    const depois = corpo.slice(saida);
    const finalDoComponente = depois.indexOf("\nfunction ");
    const zona = finalDoComponente === -1 ? depois : depois.slice(0, finalDoComponente);

    const hooks = [...zona.matchAll(/\buse(State|Memo|Effect|Callback|Ref|Reducer)\s*\(/g)];
    expect(hooks.map((h) => h[0])).toEqual([]);
  });

  it("o useMemo do porAbrir está mesmo acima da saída", () => {
    expect(TRABALHOS.indexOf("const porAbrir = useMemo(")).toBeLessThan(
      TRABALHOS.indexOf("const escolhido = pedidos.find("),
    );
  });
});
