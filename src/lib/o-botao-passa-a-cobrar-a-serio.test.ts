import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { configuracaoDoEupago, podeCobrar, podeCobrarPeloBackoffice, BASE_DO_EUPAGO } from "./eupago";
import { A_PLATAFORMA_COBRA } from "./pagamento-na-plataforma";

/**
 * O MESMO BOTÃO, OUTRA CONSEQUÊNCIA — 21-09-2026.
 *
 * "mude tudo para usarmos PRODUÇÃO, vamos trabalhar com valores reais"
 *
 * O suporte do euPago confirmou o que o ecrã já dizia: a chave é de produção e
 * estava a bater na sandbox. A correcção é uma variável no Vercel —
 * `EUPAGO_AMBIENTE=producao` — e nem uma linha de código.
 *
 * ⚠️ MAS É AÍ QUE ESTÁ O PERIGO, e é por isso que este ficheiro existe. Até
 * esse dia, carregar em «Referência Multibanco» no backoffice não tirava um
 * cêntimo a ninguém: a sandbox não move dinheiro. Depois da variável mudar, o
 * MESMO botão, no MESMO sítio, com o MESMO aspecto, pede dinheiro a uma pessoa
 * verdadeira — e nada no ecrã mudava.
 *
 * Um botão que muda de consequência sem mudar de aspecto é a definição de uma
 * armadilha. Quem andava a experimentar continua a carregar como andava, e a
 * primeira vez que se dá por isso é com um cliente ao telefone a perguntar
 * porque é que lhe pediram 127 €.
 *
 * O que estes testes guardam é o aviso, e a razão de o backoffice poder cobrar
 * em produção sem o interruptor do produto estar ligado.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("as duas casas do euPago são contas separadas", () => {
  it("cada ambiente tem o seu endereço, e uma chave não serve na outra", () => {
    /*
     * Foi exactamente isto que falhou: chave de produção, endereço de sandbox,
     * e o euPago a responder `-10`. As contas são separadas de facto — não é
     * um detalhe de configuração, são duas casas.
     */
    expect(BASE_DO_EUPAGO.sandbox).toBe("https://sandbox.eupago.pt");
    expect(BASE_DO_EUPAGO.producao).toBe("https://clientes.eupago.pt");
    expect(BASE_DO_EUPAGO.sandbox).not.toBe(BASE_DO_EUPAGO.producao);
  });

  it("sem a variável escrita, vai para a sandbox — nunca ao contrário", () => {
    /*
     * A regra não muda por irmos para produção, e é a que impede um
     * esquecimento de custar dinheiro: uma variável em falta tem de falhar do
     * lado que não cobra ninguém. O pior que acontece é a chave não servir; ao
     * contrário, o esquecimento cobrava a sério.
     */
    const semNada = configuracaoDoEupago({ EUPAGO_API_KEY: "k" });
    expect(semNada.ok && semNada.config.ambiente).toBe("sandbox");

    const lixo = configuracaoDoEupago({ EUPAGO_API_KEY: "k", EUPAGO_AMBIENTE: "prod" });
    expect(lixo.ok).toBe(false);

    const producao = configuracaoDoEupago({ EUPAGO_API_KEY: "k", EUPAGO_AMBIENTE: "producao" });
    expect(producao.ok && producao.config.base).toBe(BASE_DO_EUPAGO.producao);
  });
});

describe("o backoffice cobra em produção sem o interruptor do produto", () => {
  const producao = configuracaoDoEupago({ EUPAGO_API_KEY: "k", EUPAGO_AMBIENTE: "producao" });

  it("a porta do backoffice só pergunta se há chave", () => {
    /*
     * "Não, só pelo backoffice" — 21-09-2026, sobre quem pode cobrar.
     *
     * É por esta porta ser outra que mudar a variável chega para o dono passar
     * a cobrar a sério, sem se tocar em `A_PLATAFORMA_COBRA` e sem reescrever
     * uma única promessa dos ecrãs do cliente.
     */
    expect(producao.ok).toBe(true);
    if (!producao.ok) return;
    expect(podeCobrarPeloBackoffice(producao.config).pode).toBe(true);
  });

  it("mas o CLIENTE continua fechado, porque os ecrãs ainda lhe prometem outra coisa", () => {
    /*
     * Enquanto `A_PLATAFORMA_COBRA` for falso, todos os ecrãs dizem ao cliente
     * que ele paga ao profissional no fim. Deixá-lo pagar no site seria
     * contrariar por software o que o software lhe escreveu.
     */
    expect(A_PLATAFORMA_COBRA).toBe(false);
    if (!producao.ok) return;
    const porta = podeCobrar(producao.config, A_PLATAFORMA_COBRA, { email: "alguem@exemplo.pt" });
    expect(porta.pode).toBe(false);
  });

  it("e o portão de testador continua a abrir, com tecto", () => {
    // Dinheiro a sério, uma pessoa nomeada, valor pequeno — é como se prova o
    // webhook verdadeiro, que a sandbox nunca consegue provar.
    const comTestador = configuracaoDoEupago({
      EUPAGO_API_KEY: "k",
      EUPAGO_AMBIENTE: "producao",
      EUPAGO_EMAILS_DE_TESTE: "dono@clyon.pt",
    });
    expect(comTestador.ok).toBe(true);
    if (!comTestador.ok) return;
    expect(podeCobrar(comTestador.config, false, { email: "dono@clyon.pt", valor: 1 }).pode).toBe(true);
    expect(podeCobrar(comTestador.config, false, { email: "dono@clyon.pt", valor: 300 }).pode).toBe(false);
  });
});

describe("o ecrã diz que é a sério, e só o diz quando é", () => {
  const ROTA = semComentarios(ler("src/app/api/admin/pagamentos/criar/route.ts"));
  const CARTAO = semComentarios(ler("src/components/admin/GerarReferencia.tsx"));

  it("a rota diz ao ecrã em que ambiente está", () => {
    // Sem isto o ecrã não tem como saber, e um aviso que ele adivinhasse
    // estaria errado metade das vezes.
    expect(ROTA).toContain("ambiente: conf.ok ? conf.config.ambiente : null");
  });

  it("e o cartão avisa, em produção, que aquilo cobra uma pessoa verdadeira", () => {
    expect(CARTAO).toContain('ambiente === "producao"');
    expect(CARTAO).toContain("Isto é dinheiro a sério");
  });

  it("enquanto não souber o ambiente, não promete nem uma coisa nem outra", () => {
    /*
     * O estado nasce a `null` e o aviso só aparece com a resposta na mão.
     * Assumir «produção» por omissão gritava lobo em todos os ecrãs de
     * sandbox, e quem ouve o lobo todos os dias deixa de o ouvir.
     */
    expect(CARTAO).toContain("useState<string | null>(null)");
  });

  it("e a frase de sempre continua lá: quem diz que foi paga é o webhook", () => {
    /*
     * Nos dois caminhos. É a regra que impede o ecrã de dar um trabalho por
     * pago só porque a referência saiu — e essa não muda com o ambiente.
     *
     * ⚠️ OS ESPAÇOS SÃO COLAPSADOS ANTES DE COMPARAR, e não é detalhe: o JSX
     * parte as frases onde calha a linha acabar. Esta procura encontrava UMA
     * das duas — a que ficou inteira numa linha — e dava a entender que a
     * outra tinha desaparecido. Um teste que lê código como texto tem de ler
     * o texto como ele é servido, não como está escrito no ficheiro.
     */
    const numaLinha = CARTAO.replace(/\s+/g, " ");
    const ocorrencias = [...numaLinha.matchAll(/quem diz que foi paga é o webhook/gi)];
    expect(ocorrencias.length).toBe(2);
  });
});
