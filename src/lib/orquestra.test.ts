import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { SERVICE_CATEGORIES } from "./service-categories";
import { NA_PROPOSTA_COM_IVA, NOTA_DE_PRECO, PRAZO_DE_RESPOSTA } from "./seo-data";
import { SEM_IVA_NA_FRASE } from "./precos-publicos";
import { NOTA_DOS_PRECOS } from "./preco-de-referencia";
import { NO_MESMO_DIA, PROPOSTAS_EM_ATE, PROMESSA_DO_PRAZO } from "./promessas-publicas";
import { FRASES_PROIBIDAS } from "./frases-proibidas";
import { respostaFrequente } from "./perguntas-frequentes-da-vitoria";
import { falaDoModeloAntigo } from "./palavras-do-modelo-antigo";
import { TRABALHOS_CLYON_NO_MODELO_ANTIGO } from "./novo-modelo";

/*
 * O TESTE DA ORQUESTRA — 27-10-2026 (decisão d12).
 *
 * Cada «limpeza geral» (30/09, 14/10, 17/10) voltou a derivar porque guardava
 * FICHEIROS e não REGRAS: o teste das páginas públicas via uma lista fixa de
 * ~45 ficheiros, e os desencontros nasciam nos outros ~130 (a inicial, as FAQ,
 * os emails, a conta do cliente, o backoffice, a app Pro).
 *
 * Este teste lê os TEXTOS do código pela árvore do TypeScript — strings,
 * templates e JSX; os comentários nunca entram, e não há regex sobre o CRLF —
 * em todo o src/app, src/components, src/lib e app-pro/src, e aplica as regras
 * da casa:
 *
 *   a) português de Portugal (nada de «você», «celular», «cadastro», «equipe»…);
 *   b) voz de plataforma: quem faz o trabalho é o profissional escolhido, não
 *      a CLYON («nossa equipa», «a nossa proposta», «levamos», «Empresa de
 *      Recolha»…) — só no que o cliente vê (o backoffice fica de fora);
 *   c) sem «próprio dia», e contentores/big bags só a dizer que não há;
 *   d) o prazo só na forma «em menos de 6 horas»;
 *   e) o telefone da CLYON só pela constante (telefone-da-clyon.ts);
 *   f) o nome de cada serviço só pelo mapa único (service-categories.ts);
 *   g) a hora sempre de Lisboa (getHours/toLocale… sem timeZone, só em
 *      hora-de-lisboa.ts e em quem trabalha de propósito no relógio de Lisboa).
 *
 * E desde 28-10-2026 (d8) também NÚMEROS, não só palavras (h, i e j estão
 * mais abaixo, com as decisões de onde vêm):
 *   k) nenhuma percentagem da taxa escrita à mão — lê-se de quem a sabe;
 *   l) nenhum «NNN €» escrito à mão nos textos do orçamentista e da Vitória —
 *      os preços vêm das fontes (precos-publicos, tabela-das-mudancas,
 *      sacos-de-entulho);
 *   m) as frases mal escritas que já apareceram não voltam.
 *
 * E desde 31-10-2026: p) um valor dito «sem IVA» leva o com IVA na mesma
 * frase (ou a nota do dono, `SEM_IVA_NA_FRASE`).
 *
 * E desde 04-11-2026 (d7): r) em src/, nenhum preço de peça à mão (vem de
 * `PRECO_POR_ITEM`), nenhum «sem mínimo» e nenhum «desde 120 €/m³».
 *
 * E desde 10-11-2026 (d28): t) em src/, nenhum texto traz os números da
 * tabela antiga do motor — o mínimo por item de 48,78 € e os valores por zona
 * de Almada (220 / 230 €); o que o modelo lê para dar preços sai das fontes,
 * com o IVA ao lado. E a regra b) passou a apanhar o «Fazemos, sim»: quem faz
 * é o parceiro, também na voz da Vitória e nas traduções fixas dela.
 *
 * E, na parte do Site da mesma d28:
 *   u) «pelo site» / «no nosso site» → «plataforma», no que o cliente e o
 *      parceiro lêem;
 *   v) a distância das mudanças (o raio incluído e o preço por km) só de
 *      tabela-das-mudancas.ts — nenhum «acima de 50 km» nem «1,30 € por km»
 *      à mão, nem a regra antiga dos 30 km;
 *   w) a taxa nunca como número escrito no código (0.11): lê-se de
 *      taxas-plataforma.ts;
 *   x) o que se diz ao parceiro sobre quem confirma é a frase de trabalho.ts,
 *      com o prazo da confirmação automática — nunca «é um colega da CLYON que
 *      confirma» nem «sem essa confirmação a CLYON não lhe pode entregar».
 *   E a regra b) apanha o «Analisámos o seu pedido e preparámos um orçamento»
 *   do email antigo do orçamento.
 *
 * E desde 11-11-2026 (d7, a parte do I&D): y) as mudanças são ao preço de cada
 * parceiro — nos textos ao modelo e da Vitória, a hora e o mínimo de horas da
 * tabela de referência só se dizem como referência («na referência…»), com a
 * lista vazia; com parceiros na lista não se dizem, e o mínimo é o do parceiro.
 * Nenhum «mínimo N horas» escrito à mão nesses ficheiros.
 *
 * E desde 13-11-2026 (d10, o modelo de 15-11): s) no que o cliente e o parceiro
 * lêem, nada da caução, do valor «cativo», da CLYON a receber ou a guardar o
 * pagamento, nem do cliente a pagar à CLYON ou «pela plataforma»; e o que o
 * parceiro deve é o «valor em atraso», nunca «em dívida»
 * (`palavras-do-modelo-antigo.ts`). As frases antigas continuam certas para os
 * trabalhos já pagos à CLYON antes de 15-11: só podem viver numa declaração com
 * «ANTIGO» no nome ou dentro de `<RegrasAnteriores>`, e o código escolhe-as pela
 * data (`novoModeloEmVigor`). Os Termos e a Privacidade lêem-se desenhados nos
 * dois lados da data (`termos-15-11.test.ts`); os Trabalhos CLYON ficam no
 * modelo antigo enquanto `TRABALHOS_CLYON_NO_MODELO_ANTIGO` estiver ligado.
 *
 * A LISTA DE EXCEPÇÕES diz o que ainda falta, com o motivo. Só pode encolher:
 * uma excepção que já não é precisa chumba (apaga-se), e a lista não pode
 * passar de TAMANHO_MAXIMO. Desce o número quando a lista desce.
 */

const RAIZ = process.cwd();

type Regra =
  | "a-brasil"
  | "b-voz"
  | "c-promessa"
  | "d-prazo"
  | "e-telefone"
  | "f-servico"
  | "g-hora"
  | "h-taxa"
  | "i-grafia"
  | "j-avaliacoes"
  | "k-taxa-a-mao"
  | "l-euros-a-mao"
  | "m-mal-escrito"
  | "n-parceiro"
  | "p-sem-iva-sozinho"
  | "q-verificado"
  | "r-pecas-e-entulho"
  | "t-grelha-antiga"
  | "u-site"
  | "v-distancia-a-mao"
  | "w-taxa-no-codigo"
  | "x-confirmacao"
  | "s-modelo-antigo";

interface Excepcao {
  ficheiro: string;
  regra: Regra;
  motivo: string;
}

/*
 * O QUE AINDA FALTA, com quem o faz:
 *    (a d12 começou com 69 a 27-10-2026 e corrigiu as suas no mesmo dia;
 *    o que ficou é de outra execução. As 9 da Vitória, «d11», fecharam-se
 *    no mesmo dia: o telefone pela constante, «fatura», os nomes pelo mapa
 *    único, e as frases proibidas que o aviso ao modelo cita vêm de
 *    frases-proibidas.ts. As 3 da app CLYON Pro, «apps», também.)
 *  - «dono»: decisões de língua que só o dono toma.
 *  - «painel»: o painel do profissional, que outra execução do mesmo dia tem
 *    em mãos. As duas de «Valores fala» eram TEMPORÁRIAS (d8, 28-10-2026): a
 *    regra m entrou com a frase ainda no painel e na app, e a ordem deixou-a
 *    entrar assim, com o motivo escrito. A do painel saiu com a d7
 *    (28-10-2026) e a da app com o EAS Update de 29-10-2026: os dois dizem
 *    VALOR_QUE_MUDA_NO_LOCAL (ajuste-no-local.ts). A lista ficou vazia.
 */
const EXCEPCOES: Excepcao[] = [
  /*
   * d16 (13-11-2026): a regra s ganhou «guarda o acordo e o pagamento» e «recebe a
   * referência para pagar». Os avisos aos modelos da Vitória são do I&D, que os muda
   * a seguir, sobre o commit do Site. TEMPORÁRIAS: saem com a parte do I&D.
   */
  {
    ficheiro: "src/lib/leitura-das-conversas.ts",
    regra: "s-modelo-antigo",
    motivo: "d16: I&D/apps a seguir — o aviso ao modelo da leitura das conversas",
  },
  { ficheiro: "src/lib/prompt-do-orcamento.ts", regra: "s-modelo-antigo", motivo: "d16: I&D/apps a seguir — o aviso ao orçamentista" },
  { ficheiro: "src/lib/propor-licoes.ts", regra: "s-modelo-antigo", motivo: "d16: I&D/apps a seguir — o aviso das lições da Vitória" },
];

/**
 * Desce sempre que a lista desce. Nunca sobe. Esteve em 0 de 29-10-2026 a
 * 13-11-2026; sobe a 3 só com as temporárias da d16 (o I&D fecha-as a seguir).
 */
const TAMANHO_MAXIMO = 3;

/*
 * AS DECISÕES DE LÍNGUA DO DONO — 27-10-2026 (na conversa com o CEO):
 * português de Portugal sempre, e
 *  h) a taxa chama-se «taxa da plataforma» — nada de «taxa CLYON», «taxa da
 *     CLYON», «taxa de plataforma», «comissão da CLYON» ou «comissão» solta
 *     (as comissões dos ASSISTENTES são outra coisa, e ficam);
 *  i) a grafia é «fatura», «faturação», «faturar» — sem c.
 * Só no texto: nomes de variáveis, colunas da base e chaves da API não se
 * mudam (um texto sem espaços é um nome, não uma frase).
 */
const NOME_DA_TAXA = "taxa da plataforma";
const TAXA_COM_OUTRO_NOME =
  /\b(taxa (da |de )?CLYON|taxa de plataforma|comiss(ão|ões)( da CLYON)?)(?![\wÀ-ú])/i;
// «sem-factura», «/pagamentos/factura»: nomes de ficheiros e rotas, não texto.
const GRAFIA_ANTIGA = /(?<![\w/.-])factur/i;
/*
 * «Comissão» que NÃO é a taxa: a dos assistentes (a parte deles do lucro),
 * a do euPago (o que o banco cobra) e a Comissão Nacional de Proteção de
 * Dados. E o SQL, que é para a base, não para quem lê.
 */
const DOS_ASSISTENTES = new Set([
  "src/components/admin/MinhaComissao.tsx",
  "src/components/admin/TrabalhosDoAssistente.tsx",
  "src/components/admin/AdminAssistentesPanel.tsx",
  "src/lib/assistentes.ts",
  "src/lib/relatorio-das-comissoes.ts",
  "src/lib/periodos-de-comissao.ts",
  "src/app/api/admin/assistentes/route.ts",
  "src/app/api/admin/sessao/eu/route.ts",
]);
const NAO_E_A_TAXA = /assistente|deste período|antes de comissão|euPago|Comissão Nacional|Comissão Europeia/i;
const E_SQL = /\b(SELECT|FROM|WHERE|INSERT INTO|UPDATE|ALTER TABLE)\b/;

/* ─── Onde se lê ─────────────────────────────────────────────────────────── */

const PASTAS = ["src/app", "src/components", "src/lib", "src/hooks", "src/contexts", "app-pro/src", "app-cliente/src"];

function ficheiros(p: string): string[] {
  const abs = join(RAIZ, p);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [p];
  return readdirSync(abs).flatMap((n) => ficheiros(`${p}/${n}`));
}

const FONTES = PASTAS.flatMap(ficheiros).filter(
  (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !/\.d\.ts$/.test(f) && !/\.generated\.ts$/.test(f),
);

/** O backoffice fala com a equipa, não com o cliente: a voz e as promessas não se lhe aplicam. */
const DO_BACKOFFICE = (f: string) =>
  /^src\/app\/admin\//.test(f) || /^src\/app\/api\/admin\//.test(f) || /^src\/components\/admin\//.test(f);

/*
 * As fontes de cada regra — onde a coisa se escreve UMA vez, de propósito.
 * Não são excepções: são o sítio certo.
 */
const FONTE_DO_TELEFONE = "src/lib/telefone-da-clyon.ts";
const FONTE_DOS_SERVICOS = "src/lib/service-categories.ts";
/*
 * As frases que a CLYON não diz, escritas UMA vez para os avisos ao modelo
 * as citarem («nunca "no próprio dia"»). O teste prova, mais abaixo, que
 * cada uma é apanhada pela regra dela.
 */
const FONTE_DAS_FRASES_PROIBIDAS = "src/lib/frases-proibidas.ts";
/*
 * j) A contagem de avaliações do Google e a nota, com a fonte e o mês em que
 * foram vistas — escritas UMA vez (d1, 28-10-2026). Da Fixando, desde o mesmo
 * dia, nenhuma (dono). As da própria plataforma vêm da base, por expressão, e
 * por isso não são texto escrito.
 */
const FONTE_DAS_AVALIACOES = "src/lib/avaliacoes-publicas.ts";
/*
 * Ficheiros cujas palavras não são frases para ninguém ler: listas para
 * RECONHECER a língua de quem escreve («voce» é uma marca de português).
 */
const NAO_FALAM = new Set(["src/lib/lingua-do-cliente.ts"]);
const NO_RELOGIO_DE_LISBOA = new Set([
  // É aqui que se faz a conversão (noRelogioDeLisboa / doRelogioDeLisboa).
  "src/lib/hora-de-lisboa.ts",
  // A grelha da agenda: quem chama passa as datas por noRelogioDeLisboa.
  "src/lib/agenda-em-grelha.ts",
  "src/components/GrelhaDeAgenda.tsx",
]);

/* ─── As regras ──────────────────────────────────────────────────────────── */

/*
 * «VOCÊ» E «ÔNIBUS» COM O ACENTO — 28-10-2026 (d8). Sem a flag u, o \b do
 * JavaScript só conhece [A-Za-z0-9_]: o «ê» de «você» não é letra para ele,
 * e /\bvoc[êe]s?\b/ nunca apanhava «você» — só «voce», sem acento. Passaram
 * dois («Quem faz é você» na app, «desistiu você» no painel). Nas duas
 * palavras que começam ou acabam numa letra com acento, a fronteira é dita
 * à mão, com as letras do Unicode.
 */
const BRASIL: RegExp[] = [
  /(?<![\p{L}\d_])voc[êe]s?(?![\p{L}\d_])/iu,
  /\bcelular(es)?\b/i,
  /\bcadastr[a-zçãõáéíóú]*/i,
  /\bequipes?\b/i,
  /\b(o|um|nosso|do|no|ao|seu) time\b/i,
  /(?<![\p{L}\d_])[ôo]nibus(?![\p{L}\d_])/iu,
  /(?<!toda )\ba gente\b/i,
  /\bcontatos?\b/i,
  /\busu[áa]rios?\b/i,
  /\bgeladeiras?\b/i,
  /\bbanheiros?\b/i,
  /\bcaminh[ãa]o\b/i,
  /\baluguel\b/i,
  // Gerúndio de progressão: «estamos verificando» (cá: «estamos a verificar»).
  /\b(estou|estás|está|estamos|estão|estava|estavam|esteve|estive|ficamos|fico)\s+(?!quando\b|lindo\b)[a-zà-ú]{2,}(ando|endo|indo)\b/i,
];

const VOZ: RegExp[] = [
  /\bnossa equipa\b/i,
  /\ba nossa proposta\b/i,
  /\bprofissionais da CLYON\b/i,
  /\bvamos buscar\b/i,
  /\blevamos\b/i,
  // «Que dados recolhemos» (a Privacidade) é outra recolha, e fica.
  /(?<!dados )\brecolhemos\b(?![^.]{0,40}\bdados\b)/i,
  /\besvaziamos\b/i,
  /\bEmpresa de Recolha\b/i,
  // O sim da Vitória a quem pergunta «vocês fazem…?» (d28, 10-11-2026): quem faz é o parceiro.
  /\bfazemos,? sim\b/i,
  // O email antigo do orçamento (d28, parte do Site): a CLYON não analisa nem prepara orçamentos como uma empresa.
  /\banalis[áa]mos o seu pedido\b/i,
  /\bprepar[áa]mos (um|o seu|o) orçamento\b/i,
];

const NEGA = /\b(não|nem|sem|nunca|nenhum|nenhuns)\b/i;
/*
 * Contentores e big bags podem aparecer: na pergunta «A CLYON fornece
 * contentor?» (a resposta é não), como medida («cabem num big bag, quase
 * 1 m³»), no serviço da câmara, nos pedidos antigos. O que não pode é a CLYON
 * a oferecê-los.
 */
const PROMESSAS: Array<{ re: RegExp; negavel: boolean; foraDe?: string }> = [
  { re: /\bpr[óo]prio dia\b/i, negavel: false },
  // «No mesmo dia» só na PERGUNTA («Recolhem no mesmo dia?», que se responde
  // com NO_MESMO_DIA); dito como afirmação é uma promessa (d1, 28-10-2026).
  // Os testemunhos são as palavras dos clientes, e ficam como estão (dono).
  { re: /\b(no|o) mesmo dia\b(?![^.!]*\?)/i, negavel: false, foraDe: "src/lib/reviews-data.ts" },
  {
    re: /(\bCLYON\b[^.?!]{0,30}\b(fornece|aluga|disponibiliza|leva|entrega|deixa|traz)|\b(fornecemos|alugamos|disponibilizamos|levamos|entregamos|deixamos|trazemos))\b[^.?!]{0,25}\b(contentor(es)?|big[ -]?bags?)\b(?![^.!]*\?)/i,
    negavel: true,
  },
];

const PRAZO: RegExp[] = [
  /\bem 6 ?h(oras)?\b/i,
  /\bem até 6\b/i,
  /\bdentro de 6\b/i,
  /\bor[çc]amento gratuito em\b/i,
  /\brespondem em \d/i,
  /*
   * A PROMESSA DO PRAZO É UMA SÓ (d1, 28-10-2026): «Propostas em menos de 6
   * horas; o trabalho faz-se no dia que combinar com o parceiro.» —
   * PROMESSA_DO_PRAZO. Nada de «24–48 h», «em 24 h», nem a segunda metade
   * escrita à mão de outra maneira.
   */
  /\b24\s*(–|-|—|a|e|\/)\s*48\s*(h|horas)?\b/i,
  /\b(em|até|dentro de) (24|48|72) ?h(oras)?\b/i,
  // A data com o profissional, dita de outra maneira (a da câmara, «combina-se
  // depois de avaliado o acesso», é outra coisa).
  /\ba data (do trabalho |da recolha |da mudança )?(depois )?(combina-se|se combina) (depois )?com (o profissional|o parceiro|quem)\b/i,
  /\bo trabalho em si depende\b/i,
];

/*
 * j) Uma contagem de avaliações ou uma nota escrita à mão: «46 avaliações»,
 * «119 na Fixando», «4,9 no Google», «165 opiniões», «158 trabalhos
 * contratados». Escrevem-se em avaliacoes-publicas.ts, com a fonte e o mês.
 */
// Dois algarismos ou mais: «Falta 1 avaliação para a coroa» (o painel do pro) não é uma contagem.
const AVALIACOES_A_MAO: RegExp[] = [
  /\b\d{2,5}\+?\s*(avalia[çc](ão|ões)|opini(ão|ões)|reviews?|testemunhos)\b/i,
  /\b\d{2,5}\+?\s*(no Google|na Fixando)\b/i,
  /\b[0-5],\d\s*(★|estrelas)?\s*(no Google|na Fixando)\b/i,
  /\b\d{2,5}\+?\s*(clientes (satisfeitos|felizes)|trabalhos (feitos|realizados|contratados))\b/i,
  /*
   * DA FIXANDO, NENHUM NÚMERO — 28-10-2026 (dono). Só as do Google: a nota, a
   * contagem e as contratações da Fixando saíram, escritas à mão OU lidas de
   * uma constante («‹›» é o que este leitor vê de uma interpolação). Contar a
   * história («os primeiros clientes chegaram pela Fixando») pode.
   */
  /(\d|‹›)[^.;!?]{0,40}\b(na|pela|da) Fixando\b/i,
  /\bFixando\b[^.;!?]{0,25}(\d|‹›)/i,
];

/*
 * k) A PERCENTAGEM DA TAXA SÓ DE QUEM A SABE — d8, 28-10-2026.
 *
 * A taxa das negociações muda nas Configs (`taxasActuais`, que
 * /quero-ser-parceiro, /profissionais e os Termos já liam), e a de um Trabalho
 * CLYON vem de `TAXAS_DO_TRABALHO_CLYON` e de `taxaPeloValor`. Um «11 %»
 * escrito num texto fica a mentir no dia em que as Configs mudam — e era o
 * que a ajuda dos profissionais fazia, no painel e na app. Conta uma
 * percentagem dentro de uma frase que fala da taxa; o IVA (23 %) não é a taxa,
 * e o zero é um limite («entre 0 % e…»), não uma taxa.
 */
// «width:40%», «max-w-[85%]»: o CSS cola o número aos dois pontos ou ao parêntese recto.
const PERCENTAGEM = /(?<![\p{L}\d_.,:[])(\d{1,2}(?:[.,]\d{1,2})?)\s?%/gu;
const FALA_DA_TAXA = /\btaxa\b|\bcomiss(ão|ões)\b|\bfica com\b/i;
const IVA_ANTES = /\bIVA\s*(\(|:|à taxa de|a|de)?\s*$/;
const IVA_DEPOIS = /^\s*(de\s+)?IVA\b/;
const FIM_DE_FRASE = /[.!?;](\s|$)/;

function taxaAMao(texto: string): string | null {
  for (const m of texto.matchAll(PERCENTAGEM)) {
    if (Number(m[1].replace(",", ".")) === 0) continue;
    const i = m.index ?? 0;
    const antes = texto.slice(0, i);
    const depois = texto.slice(i + m[0].length);
    if (IVA_ANTES.test(antes) || IVA_DEPOIS.test(depois)) continue;
    // A frase onde está: do último fim de frase para trás até ao próximo para
    // a frente — e nunca mais de 120 letras para cada lado (o HTML dos emails
    // quase não tem pontos finais).
    const inicio = Math.max(-1, antes.length - 121, ...[". ", "! ", "? ", "; "].map((s) => antes.lastIndexOf(s)));
    const fim = depois.search(FIM_DE_FRASE);
    const frase = antes.slice(inicio + 1) + m[0] + (fim < 0 ? depois : depois.slice(0, fim)).slice(0, 120);
    if (FALA_DA_TAXA.test(frase)) return m[0];
  }
  return null;
}

/*
 * l) OS EUROS DO ORÇAMENTISTA E DA VITÓRIA SÓ DAS FONTES — d8, 28-10-2026.
 *
 * As instruções ao modelo que estima o orçamento tinham uns oito valores
 * escritos à mão (o mínimo por item, uma tabela por zona para a carga completa
 * e o esvaziamento), abaixo das faixas do site, e nenhuma regra os via. Nos
 * textos que vão para um modelo ou para o WhatsApp, um número com € escrito à
 * mão chumba: os preços vêm de precos-publicos.ts, tabela-das-mudancas.ts e
 * sacos-de-entulho.ts, que os textos interpolam — e por isso chegam aqui como
 * «‹› €». As fontes não entram: são o sítio certo.
 */
const FONTES_DE_PRECOS = new Set([
  "src/lib/precos-publicos.ts",
  "src/lib/tabela-das-mudancas.ts",
  "src/lib/sacos-de-entulho.ts",
]);
const DO_ORCAMENTISTA = new Set(["src/lib/prompt-do-orcamento.ts"]);
/** A Vitória: o que ela diz, o que lê, o que traduz, e as rotas que a fazem falar. */
const DA_VITORIA = (f: string) =>
  /^src\/lib\/(voz-da-vitoria|o-que-o-site-sabe|[\w-]*-da-vitoria[\w-]*|[\w-]*whatsapp[\w-]*|[\w-]*conversas?[\w-]*|leitor-da-recolha|pedido-da-recolha|o-que-falta-no-pedido|mensagem-do-que-falta|traduzir-para-o-cliente|propor-licoes|assistente-automatico|assistente-categorias|fila-do-cliente)\.ts$/.test(
    f,
  ) || /^src\/app\/api\/(whatsapp|admin\/whatsapp|cron\/(assistente|ler-conversas|licoes-da-vitoria))\//.test(f);
const FALA_DE_PRECOS = (f: string) => !FONTES_DE_PRECOS.has(f) && (DO_ORCAMENTISTA.has(f) || DA_VITORIA(f));
const EUROS_A_MAO = /(?<![\p{L}\d_.,])\d+(?:[  .]\d{3})*(?:[.,]\d{1,2})?\s?(?:€|euros?(?!\p{L})|EUR(?!\p{L}))|€\s?\d+(?:[.,]\d{1,2})?/giu;

/*
 * m) AS FRASES MAL ESCRITAS QUE JÁ APARECERAM — d8, 28-10-2026.
 *
 * Não são do Brasil (a regra a não as vê) nem de voz: são português partido.
 * Cada uma que aparecer entra aqui, com o dia em que se viu, e não volta.
 */
const MAL_ESCRITAS: RegExp[] = [
  // «Valores fala sempre com a CLYON, nunca directamente com o cliente» — no
  // painel e na app CLYON Pro (relatório da Engenharia — Site, 28-10-2026).
  /\bValores fala\b/i,
];

/*
 * r) AS PEÇAS E O ENTULHO SÓ PELAS FONTES — d7, 04-11-2026 (ordem do CEO).
 *
 * Os exemplos por peça (sofá 40–70 €, cama 40–65 €, armário 55–95 €) viviam
 * ao lado da tabela por peça (15 / 30 / 50 €) e chocavam com ela; o «sem mínimo
 * por pedido» e o «não há mínimo de volume» ficaram depois da recolha mínima;
 * e o «desde 120 €/m³» depois de o granel passar a contar pelos sacos. Em src/
 * (fora das fontes dos preços), nenhum texto diz um preço de peça escrito à mão
 * — vem de `PRECO_POR_ITEM`, e chega aqui como «‹›» —, nem «sem mínimo» (o
 * «sem mínimo de zona» do motor é outra coisa, e fica), nem 120 € por m³.
 */
const PECA_COM_PRECO_A_MAO =
  /(?<!\p{L})(sof[áa]s?|camas?|arm[áa]rios?|roupeiros?|mesas?|colch(?:ão|ões)|peças?(?: pequenas?| médias?| grandes?)?)(?!\p{L})[^.;!?]{0,30}?(?<![\p{L}\d_.,‹])\d+(?:[.,]\d{1,2})?\s?(?:(?:–|-|a)\s?\d+(?:[.,]\d{1,2})?\s?)?(?:€|euros?(?!\p{L}))/iu;
const SEM_MINIMO = /(?<!\p{L})(sem m[íi]nimo(?! de zona)|n[ãa]o h[áa] m[íi]nimo)/iu;
const ENTULHO_A_120 = /(?<![\d.,])120\s?€\s?(\/|por)\s?(m³|m3|metro)|m³[^.;]{0,25}desde\s+120\s?€/iu;
const PRECOS_DA_D7: RegExp[] = [PECA_COM_PRECO_A_MAO, SEM_MINIMO, ENTULHO_A_120];
const A_REGRA_R_SE_APLICA = (f: string) => f.startsWith("src/") && !FONTES_DE_PRECOS.has(f);

/*
 * t) A TABELA ANTIGA DO MOTOR NÃO VOLTA — d28, 10-11-2026 (ordem do CEO).
 *
 * A estrutura de custos que o motor manda ao modelo (`pricing-helper.ts`) tinha
 * ficado «para outra decisão» na d8: um «mínimo por item» de 48,78 € que o site
 * nunca publicou (as peças são 15 / 30 / 50 € e a recolha mínima 40 €, + IVA) e
 * valores por zona para a carga completa e o esvaziamento (Almada a 220 € numa
 * tabela e a 230 € na outra), abaixo das faixas publicadas por tipologia. Em
 * src/ (fora das fontes dos preços), nenhum texto os diz: o que o modelo lê
 * sai de `precos-publicos.ts`, e chega aqui como «‹›».
 */
const MINIMO_POR_ITEM_ANTIGO = /(?<![\d.,])48[.,]78(?!\d)/u;
const ALMADA_POR_ZONA = /\bAlmada\b[^.;!?]{0,40}?(?<![\d.,])2[23]0\s?(?:€|euros?(?!\p{L}))/iu;
const GRELHA_ANTIGA: RegExp[] = [MINIMO_POR_ITEM_ANTIGO, ALMADA_POR_ZONA];
const A_REGRA_T_SE_APLICA = A_REGRA_R_SE_APLICA;

/*
 * u) «PLATAFORMA», NÃO «SITE» — d28 (parte do Site), 10-11-2026; a regra é do
 * dono (27-10-2026): a CLYON fala sempre como plataforma. As mensagens que o
 * formulário inicial põe no WhatsApp do cliente diziam «pelo site», e a faixa
 * dos cookies «no nosso site». Fora do backoffice, que fala com a equipa. A
 * página da história conta o site de então («chegava pelo site»), e fica; e
 * o histórico do pedido, que a equipa lê, diz por onde a conta foi juntada
 * («pela app de cliente» ou «pelo site») — aí é o canal, não a CLYON.
 */
const PELO_SITE = /(?<!\p{L})(pelo|no nosso|do nosso|o nosso) site(?!\p{L})/iu;
const A_HISTORIA = new Set(["src/app/sobre-nos/page.tsx", "src/lib/juntar-a-conta.ts"]);

/*
 * v) A DISTÂNCIA DAS MUDANÇAS SÓ DA TABELA — d28 (parte do Site).
 *
 * O raio incluído e o preço por km vivem em tabela-das-mudancas.ts
 * (RAIO_INCLUIDO_KM, PRECO_POR_KM_LONGE, e as frases feitas com eles). Uma FAQ
 * de cidade dizia-os à mão, e o aviso ao modelo dizia outra regra («percurso
 * >30km: +30min», sem custo de deslocação). Lidos da fonte chegam aqui como
 * «‹›».
 */
const FONTE_DAS_MUDANCAS = "src/lib/tabela-das-mudancas.ts";
const DISTANCIA_A_MAO: RegExp[] = [
  /(?<![\d.,])1[.,]30?\s?(€|euros?)\s?(\/|por|o|ao)\s?(km|quil[óo]metro)/iu,
  /(?<!\p{L})acima d[eo]s? 50 ?km(?!\p{L})/iu,
  /(?<![\d.,])50 ?km(?!\p{L})[^.;!?]{0,60}ida e volta/iu,
  /percurso\s?(>|acima de|passar dos)\s?30 ?km/iu,
];
const A_REGRA_V_SE_APLICA = (f: string) => f.startsWith("src/") && f !== FONTE_DAS_MUDANCAS;

/*
 * w) A TAXA NUNCA COMO NÚMERO NO CÓDIGO — d28 (parte do Site).
 *
 * A regra k vê as percentagens nas frases; esta vê o número na conta. Um
 * 0.11 escrito num ficheiro fica para trás no dia em que a taxa mudar: em
 * src/, lê-se de taxas-plataforma.ts (ou das taxas que o pedido guardou).
 */
const FONTE_DAS_TAXAS = "src/lib/taxas-plataforma.ts";
const TAXA_COMO_NUMERO = 0.11;
const A_REGRA_W_SE_APLICA = (f: string) => f.startsWith("src/") && f !== FONTE_DAS_TAXAS;

/*
 * x) QUEM CONFIRMA, COMO A CONFIRMAÇÃO AUTOMÁTICA — d28 (parte do Site).
 *
 * O email «Foi contratado» dizia ao parceiro «sem fotografias, é um colega da
 * CLYON que confirma com ele — e sem essa confirmação a CLYON não lhe pode
 * entregar o valor». Desde 30-10-2026 o prazo corre para todos: o trabalho
 * fecha sozinho ao fim de DIAS_ATE_LIBERTAR_SOZINHO dias. A frase é a de
 * trabalho.ts (quemConfirmaAntesDeMarcar), no email, no painel e na app.
 */
const CONFIRMACAO_ANTIGA: RegExp[] = [
  /é um colega da CLYON que confirma/iu,
  /sem essa confirmação a CLYON não lhe pode entregar/iu,
];

/*
 * n) «PARCEIRO», NÃO «PROFISSIONAL», NO QUE O CLIENTE LÊ — 29-10-2026 (dono).
 *
 * Um cliente leu no WhatsApp «um profissional verificado» e perguntou se uma
 * pessoa só chegava para levar tudo para a rua. Quem vai é uma empresa
 * parceira, com a sua equipa. Por isso, em tudo o que o cliente lê — páginas,
 * simulador, /pedido/<token>, /conta, emails, avisos, a Vitória, o catálogo
 * da app de cliente — é «parceiro» («parceiro verificado»; a explicar, «uma
 * empresa parceira, com a sua equipa»). O lado do profissional (o painel, a
 * app CLYON Pro, o link do pedido, a inscrição) e o backoffice continuam a
 * dizer «profissional».
 *
 * O adjectivo fica («recolha profissional», «transporte profissional»,
 * «profissionalismo»), e também o que fala COM o profissional («Sou
 * profissional», «Se é profissional», «conta de profissional»).
 */
const PROFISSIONAL_A_PESSOA = /(?<![\p{L}\d_/.#-])profission(al|ais)(?![\p{L}\d_/-])/giu;
const DITO_COMO_ADJECTIVO =
  /(?<!\p{L})(recolha|retirada|transporte|servi[çc]os?|apoio|resposta|domic[íi]lio|forma|[ée]|sou|conta de)\s+$/iu;
function profissionalAoCliente(texto: string): string | null {
  // Um valor sem espaços em minúsculas é um nome (papel, origem), não uma frase.
  if (!/\s/.test(texto) && !/^Profission/.test(texto)) return null;
  for (const m of texto.matchAll(PROFISSIONAL_A_PESSOA)) {
    const antes = texto.slice(Math.max(0, (m.index ?? 0) - 30), m.index ?? 0);
    if (!DITO_COMO_ADJECTIVO.test(antes)) return m[0];
  }
  return null;
}
/** Quem fala com o profissional: o painel, a app, o link do pedido dele, a inscrição. */
const DO_LADO_DO_PROFISSIONAL = (f: string) =>
  /^src\/app\/profissionais\/(?!\[slug\]\/)/.test(f) ||
  /^src\/app\/api\/(profissionais|negociacao)\//.test(f) ||
  /^src\/components\/portal\//.test(f) ||
  /^src\/app\/quero-ser-parceiro\//.test(f) ||
  /^app-pro\//.test(f) ||
  // A app de cliente entrou na regra a 31-10-2026 (d8): é do lado do cliente.
  new Set([
    "src/lib/email-profissional.ts",
    "src/lib/textos-dos-avisos-ao-profissional.ts",
    "src/lib/como-funciona-para-o-profissional.ts",
    "src/lib/profissional-auth.ts",
    "src/lib/bloqueio-do-profissional.ts",
    "src/lib/cobrar-divida-do-profissional.ts",
    "src/lib/candidaturas.ts",
    "src/lib/sessao-activa-do-profissional.ts",
    "src/lib/edicao-profissional.ts",
    "src/lib/email-repor-palavra-passe.ts",
    "src/lib/aviso-de-oferta-clyon.ts",
    "src/lib/responder-oferta-clyon.ts",
    "src/lib/avisos-do-terreno.ts",
    // O comprovativo do que a CLYON pagou ao profissional.
    "src/lib/comprovativo-pdf.ts",
    "src/lib/comprovativo-do-trabalho.ts",
    // A descrição que o modelo escreve PARA o profissional ler.
    "src/lib/descricao-pelo-modelo.ts",
    // O aviso antes de cotar e o email da aprovação são ao profissional (01-11-2026, regra q).
    "src/lib/avisos-antes-de-cotar.ts",
    "src/lib/email-aprovacao-profissional.ts",
    // O que o parceiro escolhido lê no painel e na app Pro: «Confirmo: faço por X/h + IVA», o prazo e os erros (11-11-2026, d6).
    "src/lib/escolhidos-sem-resposta-do-escolhido.ts",
    // O email ao profissional quando mudam o IBAN, o titular ou o MB WAY (12-11-2026, d1).
    "src/lib/email-dados-de-pagamento-do-profissional.ts",
    // Os nomes da carteira do profissional (painel e app Pro) — d10, 13-11-2026.
    "src/lib/rotulos-da-carteira.ts",
  ]).has(f);
/*
 * Entre a equipa: a base, as contas, as notas e as instruções que só a equipa
 * ou um modelo lêem. Os dois do WhatsApp (assistente-automatico e
 * whatsapp-negociacao) falam com o cliente E deixam notas à equipa; as frases
 * ao cliente dizem «parceiro» desde 29-10-2026, as notas continuam como estão.
 * O whatsapp-compreensao pede ao modelo um campo JSON chamado "profissional"
 * e cita as palavras de um cliente.
 */
const ENTRE_A_EQUIPA = new Set([
  "src/lib/db.ts",
  "src/lib/conta-do-pagamento.ts",
  "src/lib/dinheiro-do-trabalho.ts",
  "src/lib/historico-do-pedido.ts",
  "src/lib/distribuir-pedido.ts",
  "src/lib/oferta-clyon.ts",
  "src/lib/pagamento-declarado.ts",
  "src/lib/cancelamento.ts",
  "src/lib/arquivar-sem-resposta.ts",
  "src/lib/assistente-categorias.ts",
  "src/lib/calendar-helpers.ts",
  "src/lib/assistente-automatico.ts",
  "src/lib/whatsapp-negociacao.ts",
  "src/lib/whatsapp-compreensao.ts",
  "src/lib/abater-dividas-no-saldo.ts",
  // A dívida do profissional à CLYON e o acerto de 01-11-2026: histórico da equipa
  // («created», que o cliente não vê — historico-para-o-cliente.ts) e registo.
  "src/lib/pagamento-da-divida.ts",
  "src/lib/quitacao-na-base.ts",
  // O IVA e a taxa da dívida marcados um a um (11-11-2026): Pagamentos › A receber dos profissionais, e o histórico da equipa.
  "src/lib/cobrancas-ao-profissional.ts",
  "src/lib/cobrancas-na-base.ts",
  "src/lib/marcas-da-divida-na-base.ts",
  // Os escolhidos sem resposta (11-11-2026, d6): o selo e a linha da Mesa, os botões da equipa, o histórico e o aviso à equipa.
  "src/lib/escolhidos-sem-resposta-na-mesa.ts",
  "src/lib/assistente-interruptores.ts",
  "src/lib/assistentes.ts",
  "src/lib/avisos-do-backoffice.ts",
  "src/lib/cores-dos-profissionais.ts",
  "src/lib/filtros-dos-pagamentos.ts",
  "src/lib/financas.ts",
  "src/lib/financas-na-base.ts",
  "src/lib/google-sheets.ts",
  "src/lib/licoes-da-vitoria.ts",
  "src/lib/livro-da-carteira.ts",
  "src/lib/mesa-das-conversas.ts",
  "src/lib/papel-do-painel.ts",
  "src/lib/rotinas.ts",
  "src/lib/texto-da-mesa.ts",
  "src/lib/trabalhos-para-gerir.ts",
  // As frases dos Pagamentos e da correcção de um pagamento registado (04-11-2026, d9): só a equipa as lê.
  "src/lib/a-quem-foi-o-dinheiro.ts",
  "src/lib/corrigir-pagamento-registado.ts",
  // Os testemunhos são as palavras dos clientes, e ficam como estão (como na regra c).
  "src/lib/reviews-data.ts",
  "src/app/plataforma/PainelDeTestes.tsx",
  "src/app/api/simulador/pedido/route.ts",
]);
const O_CLIENTE_LE = (f: string) => !DO_BACKOFFICE(f) && !DO_LADO_DO_PROFISSIONAL(f) && !ENTRE_A_EQUIPA.has(f);

/*
 * q) «VERIFICADO» SÓ JUNTO DE UM PARCEIRO COM AS TRÊS CONFIRMAÇÕES — 01-11-2026
 * (dono: «Selo só nos que tiverem os 3»).
 *
 * Os Termos (§10) dizem que «verificado» quer dizer NIF, identidade e contacto
 * confirmados. O site dizia «parceiros verificados» de toda a gente. Agora, no
 * que o cliente lê, a palavra só aparece nos sítios que a mostram debaixo do
 * campo `verificado` de um parceiro (as três confirmações, `SQL_DO_VERIFICADO`
 * em parceiro-verificado.ts): o selo nas propostas e na app, a linha do perfil
 * público, a frase de quem faz o trabalho. Nos Termos, a definição. A guia de
 * transporte verificada é outra coisa e fica.
 */
const VERIFICADO = /(?<!\p{L})verificad[oa]s?(?!\p{L})/iu;
// A guia de resíduos é a mesma guia de transporte (04-11-2026, d10.1: «ainda não tem a guia de resíduos verificada»).
const DA_GUIA = /guia(\s+de\s+(transporte|res[ií]duos))?\s+verificada|registo\s+verificado/giu;
const ONDE_O_SELO_VIVE = new Set([
  "src/lib/parceiro-verificado.ts",
  "src/app/termos/page.tsx",
  // `{p.verificado && …}`: só aparece com as três.
  "src/app/profissionais/[slug]/page.tsx",
  "app-cliente/src/componentes/Proposta.tsx",
  "app-cliente/src/lib/pedidos.ts",
]);
function verificadoAoCliente(texto: string): string | null {
  const m = VERIFICADO.exec(texto.replace(DA_GUIA, ""));
  return m ? m[0] : null;
}

/*
 * p) O SEM IVA NUNCA SOZINHO — 31-10-2026 (ordem do CEO, pela regra do dono de
 * 03 e 14-10-2026: os preços de referência ficam sem IVA, mas nunca sozinhos).
 *
 * O artigo do sofá dizia «Uma recolha com várias peças fica em ‹›, também sem
 * IVA», e /precos/esvaziamento-de-casas «Pouca coisa 120 – 180 €, … (sem
 * IVA)»: um valor com «sem IVA» e mais nada. Numa frase onde um valor se diz
 * «sem IVA», vai também o com IVA — o número («+ IVA (147,60 € com IVA)») ou a
 * nota do dono, `SEM_IVA_NA_FRASE` («sem IVA (na proposta, o preço já vem com
 * IVA incluído)»).
 *
 * Fica de fora o que não é preço de referência: as instruções aos modelos (o
 * orçamentista, as lições da Vitória) e as contas de um pedido já negociado,
 * que seguem `precoDoCliente` — e, nas negociações de antes de 02-10-2026, o
 * cliente pagava mesmo o valor sem IVA.
 */
const SEM_IVA_DITO = /(?<!\p{L})(sem|s\/) ?IVA(?!\p{L})/giu;
const COM_IVA_DITO = /(?<!\p{L})(com|c\/) ?IVA(?!\p{L})|\bIVA inclu[íi]do/iu;
/** «40 €», «€ 40», «‹› €» — um valor na frase (‹› é como este leitor vê uma interpolação). */
const UM_VALOR = /\d\s?€|€\s?\d|‹›\s?€/;
/**
 * …ou o «sem IVA» colado a uma interpolação: «fica em ‹›, também sem IVA», «custa
 * ‹›, sem IVA» — as etiquetas das fontes («40 – 120 €») chegam aqui como ‹›.
 * Um ‹› longe dele é outra coisa (um botão, um nome), e não conta.
 */
const COLADO_A_UM_VALOR = /‹›\s?€?\s*[,(]?\s*(também\s+)?$/u;
/** As instruções a um modelo: «MUDANÇA — À HORA (tabela CLYON, valores sem IVA…». */
const PARA_UM_MODELO = /^[A-ZÀ-Ú][A-ZÀ-Ú0-9 —–/-]{7,}[(:]/u;
const AO_MODELO = new Set([
  "src/lib/pricing-helper.ts",
  "src/lib/prompt-do-orcamento.ts",
  "src/lib/propor-licoes.ts",
  "src/lib/o-que-o-site-sabe.ts",
]);
/** As contas de um pedido: o cliente vê o que vai pagar, com IVA, e o sem IVA ao lado (ou o regime antigo). */
const CONTAS_DE_UM_PEDIDO = (f: string) =>
  /^src\/app\/(conta|pedido)\//.test(f) ||
  /^src\/app\/api\//.test(f) ||
  /^src\/lib\/(email-[\w-]+|pedido-para-a-app|pedidos-do-cliente|iva-incluido|conta-em-palavras|mensagem-das-propostas|whatsapp-negociacao)\.ts$/.test(f) ||
  f === "src/components/ContaDoPagamento.tsx";
const SEM_IVA_SE_APLICA = (f: string) => O_CLIENTE_LE(f) && !AO_MODELO.has(f) && !CONTAS_DE_UM_PEDIDO(f);

/** A frase onde um «sem IVA» fala de um valor sem o com IVA, ou `null`. */
function semIvaSozinho(texto: string): string | null {
  if (PARA_UM_MODELO.test(texto)) return null;
  for (const m of texto.matchAll(SEM_IVA_DITO)) {
    const i = m.index ?? 0;
    const antes = texto.slice(0, i);
    const depois = texto.slice(i + m[0].length);
    const inicio = Math.max(-1, antes.length - 121, ...[". ", "! ", "? ", "; "].map((s) => antes.lastIndexOf(s)));
    const fim = depois.search(FIM_DE_FRASE);
    const frase = antes.slice(inicio + 1) + m[0] + (fim < 0 ? depois : depois.slice(0, fim)).slice(0, 120);
    const temValor = UM_VALOR.test(frase) || COLADO_A_UM_VALOR.test(antes);
    if (temValor && !COM_IVA_DITO.test(frase)) return frase.trim();
  }
  return null;
}

/** Os números da CLYON (o do atendimento e o da API do WhatsApp), escritos à mão. */
const TELEFONE = /(?<!\d)(\+?351[\s.-]?)?93[1][\s.-]?(632[\s.-]?622|493[\s.-]?991)(?!\d)/;

const IDS_DOS_SERVICOS = new Set(SERVICE_CATEGORIES.map((c) => c.id));

const LER_O_RELOGIO = new Set([
  "getHours",
  "getMinutes",
  "getSeconds",
  "getDate",
  "getDay",
  "getMonth",
  "getFullYear",
  "setHours",
  "setMinutes",
  "setSeconds",
  "setDate",
  "setMonth",
  "setFullYear",
]);
const DE_NUMERO = /style\s*:|currency|FractionDigits|useGrouping/;

/* ─── Ler os textos pela árvore ──────────────────────────────────────────── */

/** O valor das constantes que entram nos textos, para ler a frase como o cliente a lê. */
const CONHECIDAS: Record<string, string> = {
  "PRAZO_DE_RESPOSTA.porExtenso": PRAZO_DE_RESPOSTA.porExtenso,
  "PRAZO_DE_RESPOSTA.curto": PRAZO_DE_RESPOSTA.curto,
  "PRAZO_DE_RESPOSTA.frase": PRAZO_DE_RESPOSTA.frase,
  PROPOSTAS_EM_ATE,
  PROMESSA_DO_PRAZO,
  // As notas do IVA (regra p): lê-se a frase como o cliente a lê.
  SEM_IVA_NA_FRASE,
  NA_PROPOSTA_COM_IVA,
  "NOTA_DE_PRECO.curta": NOTA_DE_PRECO.curta,
  "NOTA_DE_PRECO.completa": NOTA_DE_PRECO.completa,
  NOTA_DOS_PRECOS,
};

interface Achado {
  ficheiro: string;
  linha: number;
  regra: Regra;
  texto: string;
}

/*
 * s) ONDE AS FRASES DO MODELO ANTIGO PODEM VIVER — d10, 13-11-2026. Numa
 * declaração (variável, propriedade, função) com «antig» no nome, ou dentro de
 * <RegrasAnteriores>. Os Termos e a Privacidade lêem-se desenhados (o
 * `termos-15-11.test.ts`), e os Trabalhos CLYON ficam no modelo antigo por
 * decisão (`TRABALHOS_CLYON_NO_MODELO_ANTIGO`).
 */
const NOME_DO_MODELO_ANTIGO = /antig/i;
const DESENHADOS_NOS_DOIS_LADOS = new Set(["src/app/termos/page.tsx", "src/app/privacidade/page.tsx"]);
const DO_TRABALHO_CLYON = new Set([
  "src/lib/proposta-clyon-ao-cliente.ts",
  "src/lib/mensagem-de-adjudicacao.ts",
  "src/lib/valores-para-pagamento.ts",
  // d16: o ecrã do Trabalho CLYON na app de cliente (fica no modelo antigo).
  "app-cliente/src/componentes/TrabalhoClyon.tsx",
]);
const A_REGRA_S_SE_APLICA = (f: string) =>
  (O_CLIENTE_LE(f) || DO_LADO_DO_PROFISSIONAL(f)) &&
  !DESENHADOS_NOS_DOIS_LADOS.has(f) &&
  !(TRABALHOS_CLYON_NO_MODELO_ANTIGO && DO_TRABALHO_CLYON.has(f));
const ePorRegrasAnteriores = (n: ts.Node, sf: ts.SourceFile) =>
  (ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === "RegrasAnteriores") ||
  ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText(sf) === "RegrasAnteriores");
function doModeloAntigo(n: ts.Node, sf: ts.SourceFile): boolean {
  for (let p: ts.Node | undefined = n; p; p = p.parent) {
    if (ePorRegrasAnteriores(p, sf)) return true;
    if (
      (ts.isVariableDeclaration(p) ||
        ts.isPropertyAssignment(p) ||
        ts.isFunctionDeclaration(p) ||
        ts.isMethodDeclaration(p) ||
        ts.isPropertyDeclaration(p)) &&
      p.name &&
      NOME_DO_MODELO_ANTIGO.test(p.name.getText(sf))
    )
      return true;
  }
  return false;
}

function lerFicheiro(f: string): { textos: Array<{ linha: number; texto: string; antigo?: boolean }>; codigo: Achado[] } {
  const fonte = readFileSync(join(RAIZ, f), "utf8");
  const sf = ts.createSourceFile(f, fonte, ts.ScriptTarget.Latest, true, f.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const textos: Array<{ linha: number; texto: string; antigo?: boolean }> = [];
  const codigo: Achado[] = [];
  const linhaDe = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const limpar = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();

  const resolver = (e: ts.Expression | undefined): string => {
    if (!e) return "";
    const t = e.getText(sf);
    if (t in CONHECIDAS) return CONHECIDAS[t];
    if (ts.isStringLiteralLike(e)) return e.text;
    return "‹›";
  };

  const textoDoJsx = (n: ts.JsxElement | ts.JsxFragment): string =>
    n.children
      .map((c) => {
        if (ts.isJsxText(c)) return c.text;
        if (ts.isJsxExpression(c)) return resolver(c.expression);
        // s) o texto antigo dentro de <RegrasAnteriores> lê-se nele, não no pai.
        if (ePorRegrasAnteriores(c, sf)) return " ";
        if (ts.isJsxElement(c) || ts.isJsxFragment(c)) return textoDoJsx(c);
        return " ";
      })
      .join("");

  const visitar = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isLiteralTypeNode(n)) return;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const pai = n.parent;
      const eNomeDePropriedade = pai && (ts.isPropertyAssignment(pai) || ts.isPropertySignature(pai)) && pai.name === n;
      if (!eNomeDePropriedade) textos.push({ linha: linhaDe(n), texto: limpar(n.text), antigo: doModeloAntigo(n, sf) });
    } else if (ts.isTemplateExpression(n)) {
      const t = n.head.text + n.templateSpans.map((s) => resolver(s.expression) + s.literal.text).join("");
      textos.push({ linha: linhaDe(n), texto: limpar(t), antigo: doModeloAntigo(n, sf) });
    } else if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      textos.push({ linha: linhaDe(n), texto: limpar(textoDoJsx(n)), antigo: doModeloAntigo(n, sf) });
    }

    // f) um mapa { id do serviço: "Nome" } copiado à mão. Os de minúscula
    // («recolha de móveis» para meio de frase, a pesquisa de preços) dizem o
    // serviço noutra forma, de propósito, e não são o nome.
    if (ts.isObjectLiteralExpression(n) && f !== FONTE_DOS_SERVICOS) {
      const nomes = n.properties.filter(
        (p): p is ts.PropertyAssignment =>
          ts.isPropertyAssignment(p) &&
          IDS_DOS_SERVICOS.has(p.name.getText(sf).replace(/^["']|["']$/g, "")) &&
          ts.isStringLiteralLike(p.initializer) &&
          /^[A-ZÀ-Ú]/.test(p.initializer.text),
      );
      if (nomes.length >= 3) {
        codigo.push({ ficheiro: f, linha: linhaDe(n), regra: "f-servico", texto: `mapa de ${nomes.length} nomes de serviço` });
      }
    }

    // w) a taxa escrita como número
    if (ts.isNumericLiteral(n) && Number(n.text) === TAXA_COMO_NUMERO && A_REGRA_W_SE_APLICA(f)) {
      codigo.push({ ficheiro: f, linha: linhaDe(n), regra: "w-taxa-no-codigo", texto: n.getText(sf) });
    }

    // g) o relógio do processo
    if (ts.isCallExpression(n) && !NO_RELOGIO_DE_LISBOA.has(f)) {
      const callee = n.expression;
      const nome = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isPropertyAccessExpression(callee) === false && callee.getText(sf) === "Intl.DateTimeFormat"
          ? "Intl.DateTimeFormat"
          : "";
      const args = n.arguments.map((a) => a.getText(sf)).join(", ");
      if (LER_O_RELOGIO.has(nome)) {
        codigo.push({ ficheiro: f, linha: linhaDe(n), regra: "g-hora", texto: `${nome}()` });
      } else if (
        (nome === "toLocaleDateString" || nome === "toLocaleTimeString") &&
        !/timeZone|Europe\/Lisbon/.test(args) &&
        !/\.\.\./.test(args)
      ) {
        codigo.push({ ficheiro: f, linha: linhaDe(n), regra: "g-hora", texto: `${nome}(${args})` });
      }
    }
    if (ts.isNewExpression(n) && n.expression.getText(sf) === "Intl.DateTimeFormat" && !NO_RELOGIO_DE_LISBOA.has(f)) {
      const args = (n.arguments ?? []).map((a) => a.getText(sf)).join(", ");
      if (!/timeZone|Europe\/Lisbon/.test(args) && !/\.\.\./.test(args) && !DE_NUMERO.test(args)) {
        codigo.push({ ficheiro: f, linha: linhaDe(n), regra: "g-hora", texto: `new Intl.DateTimeFormat(${args})` });
      }
    }

    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return { textos, codigo };
}

function achadosDe(f: string): Achado[] {
  const { textos, codigo } = lerFicheiro(f);
  const out: Achado[] = [...codigo];
  const publico = !DO_BACKOFFICE(f);
  for (const { linha, texto, antigo } of textos) {
    if (!texto) continue;
    const marcar = (regra: Regra, m: RegExpExecArray | null) => {
      if (m) out.push({ ficheiro: f, linha, regra, texto: m[0] });
    };
    if (f === FONTE_DAS_FRASES_PROIBIDAS) continue;
    if (!NAO_FALAM.has(f)) for (const re of BRASIL) marcar("a-brasil", re.exec(texto));
    if (publico) {
      for (const re of VOZ) marcar("b-voz", re.exec(texto));
      for (const { re, negavel, foraDe } of PROMESSAS) {
        // O SQL é para a base (os comentários dentro dele também), não para quem lê.
        if (foraDe === f || E_SQL.test(texto)) continue;
        const m = re.exec(texto);
        if (m && !(negavel && NEGA.test(texto))) marcar("c-promessa", m);
      }
      for (const re of PRAZO) marcar("d-prazo", re.exec(texto));
    }
    if (f !== FONTE_DO_TELEFONE) marcar("e-telefone", TELEFONE.exec(texto));
    if (f !== FONTE_DAS_AVALIACOES) for (const re of AVALIACOES_A_MAO) marcar("j-avaliacoes", re.exec(texto));
    if (/\s/.test(texto) && !E_SQL.test(texto)) {
      if (!DOS_ASSISTENTES.has(f) && !NAO_E_A_TAXA.test(texto)) marcar("h-taxa", TAXA_COM_OUTRO_NOME.exec(texto));
      marcar("i-grafia", GRAFIA_ANTIGA.exec(texto));
      const taxa = taxaAMao(texto);
      if (taxa) out.push({ ficheiro: f, linha, regra: "k-taxa-a-mao", texto: taxa });
    }
    if (FALA_DE_PRECOS(f)) {
      for (const m of texto.matchAll(EUROS_A_MAO)) out.push({ ficheiro: f, linha, regra: "l-euros-a-mao", texto: m[0] });
    }
    if (!NAO_FALAM.has(f)) for (const re of MAL_ESCRITAS) marcar("m-mal-escrito", re.exec(texto));
    // r) O SQL fica de fora.
    if (A_REGRA_R_SE_APLICA(f) && !E_SQL.test(texto)) for (const re of PRECOS_DA_D7) marcar("r-pecas-e-entulho", re.exec(texto));
    // t) O SQL fica de fora.
    if (A_REGRA_T_SE_APLICA(f) && !E_SQL.test(texto)) for (const re of GRELHA_ANTIGA) marcar("t-grelha-antiga", re.exec(texto));
    // u) Fora do backoffice; o SQL, os registos e a página da história ficam de fora.
    if (publico && !A_HISTORIA.has(f) && !E_SQL.test(texto) && !texto.startsWith("[")) marcar("u-site", PELO_SITE.exec(texto));
    // v) O SQL fica de fora.
    if (A_REGRA_V_SE_APLICA(f) && !E_SQL.test(texto)) for (const re of DISTANCIA_A_MAO) marcar("v-distancia-a-mao", re.exec(texto));
    // s) O SQL e os registos ficam de fora; as frases antigas só onde o nome o diz.
    if (A_REGRA_S_SE_APLICA(f) && !antigo && !E_SQL.test(texto) && !texto.startsWith("[")) {
      const s = falaDoModeloAntigo(texto, O_CLIENTE_LE(f) ? "cliente" : "todos");
      if (s) out.push({ ficheiro: f, linha, regra: "s-modelo-antigo", texto: s });
    }
    // x) Em todo o lado: é a frase antiga, não um tema.
    for (const re of CONFIRMACAO_ANTIGA) marcar("x-confirmacao", re.exec(texto));
    // n) Os registos («[distribuir] …») e o SQL não são para o cliente ler.
    if (O_CLIENTE_LE(f) && !E_SQL.test(texto) && !texto.startsWith("[")) {
      const p = profissionalAoCliente(texto);
      if (p) out.push({ ficheiro: f, linha, regra: "n-parceiro", texto: p });
    }
    // q) O SQL e os registos ficam de fora, e os sítios que vivem debaixo do campo.
    if (O_CLIENTE_LE(f) && !ONDE_O_SELO_VIVE.has(f) && !E_SQL.test(texto) && !texto.startsWith("[")) {
      const v = verificadoAoCliente(texto);
      if (v) out.push({ ficheiro: f, linha, regra: "q-verificado", texto: v });
    }
    // p) O SQL e os registos também ficam de fora.
    if (SEM_IVA_SE_APLICA(f) && !E_SQL.test(texto) && !texto.startsWith("[")) {
      const s = semIvaSozinho(texto);
      if (s) out.push({ ficheiro: f, linha, regra: "p-sem-iva-sozinho", texto: s });
    }
  }
  // O mesmo achado visto duas vezes (a string e o JSX à volta dela) conta uma.
  const vistos = new Set<string>();
  return out.filter((a) => {
    const k = `${a.ficheiro}|${a.regra}|${a.texto.toLowerCase()}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

const ACHADOS = FONTES.flatMap(achadosDe);
const chave = (f: string, r: string) => `${f} · ${r}`;
const EXCEPTUADOS = new Set(EXCEPCOES.map((e) => chave(e.ficheiro, e.regra)));

describe("a orquestra: o site inteiro fala a mesma língua", () => {
  it("lê o que tem de ler", () => {
    expect(FONTES.length).toBeGreaterThan(500);
    expect(FONTES).toContain("src/app/page.tsx");
    expect(FONTES).toContain("src/lib/email-pedido.ts");
    expect(FONTES.some((f) => f.startsWith("app-pro/src/"))).toBe(true);
    // Os comentários não entram: este ficheiro fala de «você» e de «em 6h» nos comentários.
    expect(achadosDe("src/lib/promessas-publicas.ts").filter((a) => a.regra === "d-prazo")).toEqual([]);
  });

  it("a regra l lê o orçamentista e a Vitória, e deixa as fontes dos preços em paz", () => {
    const lidos = FONTES.filter(FALA_DE_PRECOS);
    for (const f of [
      "src/lib/prompt-do-orcamento.ts",
      "src/lib/voz-da-vitoria.ts",
      "src/lib/o-que-o-site-sabe.ts",
      "src/lib/perguntas-frequentes-da-vitoria.ts",
      "src/lib/whatsapp-recolha.ts",
      "src/lib/leitura-das-conversas.ts",
      "src/lib/traduzir-para-o-cliente.ts",
      "src/app/api/cron/assistente/route.ts",
    ])
      expect(lidos, f).toContain(f);
    expect(lidos.length).toBeGreaterThan(20);
    for (const f of FONTES_DE_PRECOS) {
      expect(FONTES, f).toContain(f);
      expect(lidos, f).not.toContain(f);
    }
  });

  it("cada regra apanha o que deve (prova com frases de exemplo)", () => {
    const tem = (lista: RegExp[], s: string) => lista.some((re) => re.test(s));
    expect(tem(BRASIL, "Você recebe no celular")).toBe(true);
    expect(tem(BRASIL, "Estamos verificando o seu pedido")).toBe(true);
    expect(tem(BRASIL, "Estamos a verificar o seu pedido")).toBe(false);
    expect(tem(BRASIL, "Está quando quiser")).toBe(false);
    expect(tem(BRASIL, "toda a gente")).toBe(false);
    expect(tem(VOZ, "A nossa equipa vai buscar")).toBe(true);
    expect(tem(VOZ, "Profissionais verificados na CLYON")).toBe(false);
    expect(tem(PRAZO, "Recebe propostas em 6 horas")).toBe(true);
    expect(tem(PRAZO, "Orçamento em 6h")).toBe(true);
    expect(tem(PRAZO, PROMESSA_DO_PRAZO)).toBe(false);
    expect(PROMESSA_DO_PRAZO).toBe(
      "Propostas em menos de 6 horas; o trabalho faz-se no dia que combinar com o parceiro.",
    );
    expect(tem(PRAZO, "Recolha em 24–48 h")).toBe(true);
    expect(tem(PRAZO, "Fazemos em 24 a 48 horas")).toBe(true);
    expect(tem(PRAZO, "Recolha em 24h")).toBe(true);
    expect(tem(PRAZO, "A data do trabalho combina-se depois com o profissional")).toBe(true);
    expect(tem(PRAZO, "o levantamento é tratado em menos de 24 horas")).toBe(false);
    const promete = (s: string) => PROMESSAS.some(({ re, negavel }) => re.test(s) && !(negavel && NEGA.test(s)));
    expect(promete("Recolha no próprio dia")).toBe(true);
    expect(promete("Recolhemos no mesmo dia em Lisboa.")).toBe(true);
    expect(promete("Recolhem no mesmo dia?")).toBe(false);
    expect(promete("A CLYON fornece contentor para o entulho.")).toBe(true);
    expect(promete("A CLYON fornece contentor para entulho em Lisboa?")).toBe(false);
    expect(promete("A CLYON não fornece contentores.")).toBe(false);
    expect(promete("Cabem num big bag, quase 1 m³")).toBe(false);
    expect(tem(VOZ, "Que dados recolhemos")).toBe(false);
    expect(tem(VOZ, "Recolhemos os seus móveis")).toBe(true);
    expect(TELEFONE.test("ligue 931 632 622")).toBe(true);
    expect(TELEFONE.test("wa.me/351931632622")).toBe(true);
    expect(TELEFONE.test("912 345 678")).toBe(false);
    expect(tem(AVALIACOES_A_MAO, "46 avaliações no Google")).toBe(true);
    expect(tem(AVALIACOES_A_MAO, "165 avaliações")).toBe(true);
    expect(tem(AVALIACOES_A_MAO, "5,0 em 119 na Fixando")).toBe(true);
    expect(tem(AVALIACOES_A_MAO, "Nota 4,9 no Google")).toBe(true);
    expect(tem(AVALIACOES_A_MAO, "158 trabalhos contratados")).toBe(true);
    expect(tem(AVALIACOES_A_MAO, "‹› avaliações no Google (outubro de 2026)")).toBe(false);
    expect(tem(AVALIACOES_A_MAO, "Ainda sem avaliações na CLYON")).toBe(false);
    // Da Fixando, nenhum número — nem lido de uma constante (28-10-2026).
    expect(tem(AVALIACOES_A_MAO, "‹› em ‹› avaliações na Fixando (‹›)")).toBe(true);
    expect(tem(AVALIACOES_A_MAO, "‹› trabalhos contratados pela Fixando (‹›)")).toBe(true);
    expect(tem(AVALIACOES_A_MAO, "‹› ★ na Fixando")).toBe(true);
    expect(tem(AVALIACOES_A_MAO, "Fixando: ‹› avaliações")).toBe(true);
    expect(tem(AVALIACOES_A_MAO, "Os primeiros clientes chegaram pela Fixando; hoje há ‹›.")).toBe(false);
    expect(tem(AVALIACOES_A_MAO, "Os primeiros chegaram pela Fixando. Mas cada orçamento custava.")).toBe(false);
  });

  it("as regras da d8 apanham o que devem: o «você» com acento, a taxa, os euros e as frases mal escritas", () => {
    const tem = (lista: RegExp[], s: string) => lista.some((re) => re.test(s));
    // a) com o acento — antes só «voce» e «onibus», sem ele, eram apanhados.
    expect(tem(BRASIL, "Quem faz é você;")).toBe(true);
    expect(tem(BRASIL, "Obrigado a você.")).toBe(true);
    expect(tem(BRASIL, "Você recebe")).toBe(true);
    expect(tem(BRASIL, "vocês")).toBe(true);
    expect(tem(BRASIL, "Apanhe o ônibus")).toBe(true);
    expect(tem(BRASIL, "voce")).toBe(true);
    expect(tem(BRASIL, "O trabalho é seu; a CLYON fala com o cliente.")).toBe(false);
    expect(tem(BRASIL, "um dos lados desistiu")).toBe(false);

    // k) a percentagem da taxa
    expect(taxaAMao("Nas negociações, a CLYON fica com 11 % do valor do trabalho, sem IVA")).toBe("11 %");
    expect(taxaAMao("Escolha a taxa: 10 %, 15 % ou 20 %.")).toBe("10 %");
    expect(taxaAMao("Taxa da plataforma ‹› Pelo valor sem IVA: até 199,99 € → 10 % · de 200 a 600 € → 15 %")).toBe("10 %");
    expect(taxaAMao("com a comissão de 6,5% descontada")).toBe("6,5%");
    expect(taxaAMao("Nas negociações, a CLYON fica com ‹› do valor do trabalho, sem IVA")).toBeNull();
    expect(taxaAMao("Com fatura (taxa + IVA 23%)")).toBeNull();
    expect(taxaAMao("liquida IVA à taxa de 23 %")).toBeNull();
    expect(taxaAMao("A taxa d‹› tem de estar entre 0 % e ‹› %.")).toBeNull();
    expect(taxaAMao("Para múltiplos itens: desconto de eficiência (~60% do custo).")).toBeNull();
    expect(taxaAMao('<td style="width:40%;">Serviço</td> … Já inclui a taxa da plataforma.')).toBeNull();
    expect(taxaAMao("max-w-[85%] rounded-2xl — a taxa")).toBeNull();
    // A taxa noutra frase não conta: o 23 % do IVA fica.
    expect(taxaAMao("E é ela que liquida os 23 %. Em dinheiro, entrega-o com a taxa da plataforma.")).toBeNull();

    // l) os euros à mão
    const euros = (s: string) => [...s.matchAll(EUROS_A_MAO)].map((m) => m[0]);
    expect(euros("Mínimo por item: ~48,78 € s/IVA (60 € c/IVA).")).toEqual(["48,78 €", "60 €"]);
    expect(euros("Lisboa → 250 € s/IVA; Seixal → 220€ s/IVA")).toEqual(["250 €", "220€"]);
    expect(euros("custo_deslocação = distanceKm × 2 €")).toEqual(["2 €"]);
    expect(euros("acima de 1 234,56 € ou 1500 euros, ou € 30")).toEqual(["1 234,56 €", "1500 euros", "€ 30"]);
    expect(euros("Mínimo por item: ‹› s/IVA (‹› c/IVA); ‹› € por hora, custo €/h")).toEqual([]);
    expect(euros("× 1.23, 23 %, 50 km, #316")).toEqual([]);

    // m) as frases mal escritas
    expect(tem(MAL_ESCRITAS, "Valores fala sempre com a CLYON, nunca directamente com o cliente.")).toBe(true);
    expect(tem(MAL_ESCRITAS, "Sobre valores, fale sempre com a CLYON.")).toBe(false);
  });

  it("a regra n apanha «profissional» dito ao cliente, e deixa o adjectivo e o lado do profissional (29-10-2026)", () => {
    expect(profissionalAoCliente("Um profissional verificado vai buscar.")).toBe("profissional");
    expect(profissionalAoCliente("Profissionais verificados fazem o trabalho")).toBe("Profissionais");
    expect(profissionalAoCliente("recebe propostas de profissionais da sua zona")).toBe("profissionais");
    expect(profissionalAoCliente("Contratar este profissional")).toBe("profissional");
    expect(profissionalAoCliente("Profissional")).toBe("Profissional");
    expect(profissionalAoCliente("Parceiros verificados fazem o trabalho; a CLYON organiza.")).toBeNull();
    expect(profissionalAoCliente("uma empresa parceira, com a sua equipa")).toBeNull();
    expect(profissionalAoCliente("A recolha profissional evita acumulação")).toBeNull();
    expect(profissionalAoCliente("com transporte profissional e destino licenciado")).toBeNull();
    expect(profissionalAoCliente("Rapidez, profissionalismo e preço justo")).toBeNull();
    expect(profissionalAoCliente("Sou profissional")).toBeNull();
    expect(profissionalAoCliente("10. Se é profissional")).toBeNull();
    expect(profissionalAoCliente("Apagar a conta de profissional")).toBeNull();
    expect(profissionalAoCliente("profissional")).toBeNull();
    expect(profissionalAoCliente("/profissionais/entrar e /quero-ser-parceiro")).toBeNull();
    // O lado do profissional e a equipa continuam a dizer «profissional».
    expect(O_CLIENTE_LE("src/app/profissionais/painel/Trabalhos.tsx")).toBe(false);
    expect(O_CLIENTE_LE("app-pro/src/ecras/Inicio.tsx")).toBe(false);
    expect(O_CLIENTE_LE("src/components/admin/TrabalhoClyon.tsx")).toBe(false);
    expect(O_CLIENTE_LE("src/lib/email-profissional.ts")).toBe(false);
    // O perfil público do profissional, o simulador, a conta e a Vitória são do cliente.
    expect(O_CLIENTE_LE("src/app/profissionais/[slug]/page.tsx")).toBe(true);
    expect(O_CLIENTE_LE("src/app/simulador/SimulatorThreePhaseForm.tsx")).toBe(true);
    expect(O_CLIENTE_LE("src/app/pedido/[token]/PropostasRecebidas.tsx")).toBe(true);
    expect(O_CLIENTE_LE("src/lib/voz-da-vitoria.ts")).toBe(true);
    expect(O_CLIENTE_LE("src/lib/frase-unica.ts")).toBe(true);
    expect(FONTES.filter(O_CLIENTE_LE).length).toBeGreaterThan(300);
  });

  it("a regra n lê os emails ao cliente, a FAQ e as descrições do Google (d2, 31-10-2026)", () => {
    // Os emails tiram-se da pasta, não de uma lista: um email novo ao cliente
    // entra na regra sozinho. Ficam de fora só os que vão para o profissional.
    const EMAILS_AO_CLIENTE = FONTES.filter(
      (f) => /^src\/lib\/email-[^/]+\.ts$/.test(f) && !/profissional|repor-palavra-passe/.test(f),
    );
    for (const f of ["src/lib/email-pedido.ts", "src/lib/email-status.ts", "src/lib/email-trabalho.ts", "src/lib/email-proposta.ts"]) {
      expect(EMAILS_AO_CLIENTE, f).toContain(f);
    }
    for (const f of EMAILS_AO_CLIENTE) expect(O_CLIENTE_LE(f), f).toBe(true);
    // A FAQ (o ecrã e as perguntas), e as páginas cuja descrição o Google mostra.
    for (const f of [
      "src/app/faq/page.tsx",
      "src/lib/perguntas-frequentes.ts",
      "src/app/layout.tsx",
      "src/app/page.tsx",
      "src/app/transporte-de-moveis/page.tsx",
    ]) {
      expect(FONTES, f).toContain(f);
      expect(O_CLIENTE_LE(f), f).toBe(true);
    }
    // A descrição é uma string como as outras: a regra lê-a.
    const textos = lerFicheiro("src/app/layout.tsx").textos.map((t) => t.texto);
    expect(textos.some((t) => /parceiros propõem/.test(t) && /Margem Sul/.test(t))).toBe(true);
    expect(profissionalAoCliente("Recolha de móveis em Lisboa com profissionais verificados.")).toBe("profissionais");
  });

  it("a regra q apanha «verificado» dito de todos, e deixa a guia e os sítios do selo (01-11-2026)", () => {
    expect(verificadoAoCliente("Propostas de parceiros verificados da sua zona.")).toBe("verificados");
    expect(verificadoAoCliente("Um parceiro verificado leva tudo.")).toBe("verificado");
    expect(verificadoAoCliente("Verificado")).toBe("Verificado");
    expect(verificadoAoCliente("guia verificada")).toBeNull();
    expect(verificadoAoCliente("Guia de transporte verificada pela CLYON")).toBeNull();
    // d10.1 (04-11-2026): a guia de resíduos é a mesma guia — e o parceiro não passa a «verificado» por ela.
    expect(verificadoAoCliente("Este parceiro ainda não tem a guia de resíduos verificada.")).toBeNull();
    expect(verificadoAoCliente("Parceiro verificado, com a guia de resíduos verificada")).toBe("verificado");
    expect(verificadoAoCliente("Parceiros aprovados")).toBeNull();
    expect(verificadoAoCliente("a verificação do pedido")).toBeNull();
    expect(ONDE_O_SELO_VIVE.has("src/app/pedido/[token]/PropostasRecebidas.tsx")).toBe(false);
    expect(readFileSync(join(RAIZ, "src/app/pedido/[token]/PropostasRecebidas.tsx"), "utf8")).toContain("{SELO_DO_VERIFICADO}");
    expect(readFileSync(join(RAIZ, "src/app/profissionais/[slug]/page.tsx"), "utf8")).toContain("{p.verificado && (");
    expect(readFileSync(join(RAIZ, "app-cliente/src/componentes/Proposta.tsx"), "utf8")).toContain("{p.verificado ? (");
  });

  it("a regra p apanha o sem IVA sozinho, e deixa o que leva o com IVA ou a nota (31-10-2026)", () => {
    // O que se viu no ar: o artigo do sofá e /precos/esvaziamento-de-casas.
    expect(semIvaSozinho("Uma recolha com várias peças fica em ‹›, também sem IVA. O preço certo vem nas propostas.")).toBe(
      "Uma recolha com várias peças fica em ‹›, também sem IVA",
    );
    expect(semIvaSozinho("Pouca coisa ‹› – ‹› €, volume médio ‹› – ‹› €, cheia ‹› – ‹› € (sem IVA)")).not.toBeNull();
    expect(semIvaSozinho("A montagem custa ‹›, sem IVA, e o valor exacto vem na proposta.")).not.toBeNull();
    expect(semIvaSozinho("T1 cerca de 150 €, T2 200 €, T3 250 €, sem IVA.")).not.toBeNull();
    // Com o com IVA ao lado, ou com a nota do dono na mesma frase, passa.
    expect(semIvaSozinho("Fica em 40 – 70 € + IVA (49,20 – 86,10 € com IVA).")).toBeNull();
    expect(semIvaSozinho(`Fica em ‹›, ${SEM_IVA_NA_FRASE}.`)).toBeNull();
    expect(semIvaSozinho("‹› com IVA (‹› sem IVA)")).toBeNull();
    // Sem valor na frase não é um preço sozinho: o regime antigo, a taxa, as notas.
    expect(semIvaSozinho("É o que paga se ele aceitar, sem IVA.")).toBeNull();
    expect(semIvaSozinho("A CLYON fica com ‹› do que o cliente paga sem IVA")).toBeNull();
    expect(semIvaSozinho(NOTA_DE_PRECO.curta)).toBeNull();
    // As instruções a um modelo não são para o cliente ler.
    expect(semIvaSozinho("MUDANÇA — À HORA (tabela CLYON, valores sem IVA, o que o cliente paga): ‹› €/hora")).toBeNull();
    // Lê as páginas, o blog e as tabelas; deixa as contas de um pedido e os modelos.
    for (const f of ["src/lib/blog-data.ts", "src/lib/quanto-custa.ts", "src/app/servicos/[slug]/page.tsx", "src/app/contactos/page.tsx"]) {
      expect(SEM_IVA_SE_APLICA(f), f).toBe(true);
    }
    for (const f of ["src/app/conta/components/OrderDetailModal.tsx", "src/lib/email-proposta.ts", "src/lib/pricing-helper.ts"]) {
      expect(SEM_IVA_SE_APLICA(f), f).toBe(false);
    }
  });

  it("a regra r apanha o preço de peça à mão, o «sem mínimo» e o «desde 120 €/m³» (d7, 04-11-2026)", () => {
    const tem = (s: string) => PRECOS_DA_D7.some((re) => re.test(s));
    // O que estava no site antes da d7.
    expect(tem("Sofá de 2 a 3 lugares: 40 – 70 €")).toBe(true);
    expect(tem("o sofá 40–70 € ao lado de grande 50 €")).toBe(true);
    expect(tem("Armário grande: 55 – 95 € + IVA")).toBe(true);
    expect(tem("Itens Grandes (sofá, armário…): 2 × 50 € = 100 €")).toBe(true);
    expect(tem("A recolha conta-se por peça, sem mínimo por pedido.")).toBe(true);
    expect(tem("De uma peça só a uma casa inteira. Não há mínimo de volume.")).toBe(true);
    expect(tem("A recolha de entulho é desde 120 €/m³, sem IVA")).toBe(true);
    expect(tem("Até 1 m³ (≈ 40 sacos) desde 120 €")).toBe(true);
    // O que se escreve agora: das fontes, interpolado.
    expect(tem("Sofá de 2 a 3 lugares: ‹›")).toBe(false);
    expect(tem("Um sofá conta como uma ‹›. A recolha conta-se ‹›.")).toBe(false);
    expect(tem("Itens Grandes (sofá, armário, frigorífico…): ‹› × ‹› € = ‹› €")).toBe(false);
    expect(tem("ENTULHO: mínimo fixo ‹› € s/IVA — sem mínimo de zona")).toBe(false);
    expect(tem("Garagem: desde 120 €")).toBe(false);
    expect(tem("1 m³ (≈ ‹› sacos, ou a granel): ‹›")).toBe(false);
    // As fontes dos preços são o sítio certo; as apps ficam com as Apps.
    expect(A_REGRA_R_SE_APLICA("src/lib/precos-publicos.ts")).toBe(false);
    expect(A_REGRA_R_SE_APLICA("src/lib/preco-de-referencia.ts")).toBe(true);
    expect(A_REGRA_R_SE_APLICA("app-cliente/src/componentes/Preco.tsx")).toBe(false);
  });

  it("a regra t apanha o mínimo por item antigo e os valores de Almada por zona; a regra b, o «Fazemos, sim» (d28, 10-11-2026)", () => {
    const tem = (s: string) => GRELHA_ANTIGA.some((re) => re.test(s));
    // O que o modelo lia antes da d28.
    expect(tem("Mínimo por item: 48,78 € s/IVA (~60 € c/IVA) por item individual.")).toBe(true);
    expect(tem("Preço real pela fórmula. Mínimo 48,78€ s/IVA por item.")).toBe(true);
    expect(tem("mínimo de 48.78 € por item")).toBe(true);
    expect(tem("Mínimo por item aplicado: 1× 48,78€ + 2× 29,27€ (60%)")).toBe(true);
    expect(tem("- Almada / Barreiro / Setúbal: 220 € s/IVA")).toBe(true);
    expect(tem("mínimo de zona — Local 220€ | Almada 230€ | Lisboa 250€")).toBe(true);
    // O que se escreve agora: das fontes, interpolado; e os outros números ficam em paz.
    expect(tem("Recolha mínima dos móveis: ‹› — a soma das peças nunca fica abaixo dela.")).toBe(false);
    expect(tem("Mínimo por item aplicado: 1× ‹› + ‹›× ‹› (60%) = ‹› € s/IVA")).toBe(false);
    expect(tem("- ‹›: ‹›")).toBe(false);
    expect(tem("Recolha de móveis em Almada. Um T2 fica entre 320 e 420 € + IVA.")).toBe(false);
    expect(tem("148,78 € ou 48,785")).toBe(false);
    expect(A_REGRA_T_SE_APLICA("src/lib/pricing-helper.ts")).toBe(true);
    expect(A_REGRA_T_SE_APLICA("src/lib/precos-publicos.ts")).toBe(false);
    // b) quem faz é o parceiro, também no sim da Vitória.
    const voz = (s: string) => VOZ.some((re) => re.test(s));
    expect(voz("Fazemos, sim! Fica anotado: recolha de monos.")).toBe(true);
    expect(voz("fazemos sim")).toBe(true);
    expect(voz("Sim, é um serviço que os parceiros fazem! Fica anotado: recolha de monos.")).toBe(false);
    expect(voz("Com todo o gosto! Fica anotado: recolha de móveis.")).toBe(false);
  });

  it("as regras u, v, w e x apanham o que devem; a regra b, o email antigo do orçamento (d28, parte do Site)", () => {
    // u) «site» dito a quem usa a plataforma.
    expect(PELO_SITE.test("Olá! Tentei pedir um orçamento pelo site e o pedido não foi enviado.")).toBe(true);
    expect(PELO_SITE.test("Utilizamos cookies para melhorar a sua experiência no nosso site.")).toBe(true);
    expect(PELO_SITE.test("Olá! Acabei de enviar um pedido pela plataforma.")).toBe(false);
    expect(PELO_SITE.test("Utilizamos cookies para melhorar a sua experiência na plataforma.")).toBe(false);
    expect(PELO_SITE.test("pelo sitemap")).toBe(false);
    // v) a distância das mudanças à mão.
    const dist = (t: string) => DISTANCIA_A_MAO.some((re) => re.test(t));
    expect(dist("Paga-se à hora, e acima de 50 km 1,30 € por km, ida e volta.")).toBe(true);
    expect(dist("1,30 €/km")).toBe(true);
    expect(dist("Até 50 km a deslocação está incluída, depois contam todos, ida e volta.")).toBe(true);
    expect(dist("(percurso >30km: +30min)")).toBe(true);
    expect(dist("Paga-se à hora: ‹›; ‹›. Recebe propostas grátis.")).toBe(false);
    expect(dist("Até ‹› km a deslocação está incluída; acima disso, ‹› por km (ida e volta), mais portagens.")).toBe(false);
    expect(dist("limite máximo 70 km da base CLYON")).toBe(false);
    expect(dist("o combustível a 0,50 €/km")).toBe(false);
    expect(A_REGRA_V_SE_APLICA("src/lib/mudancas-cidades.ts")).toBe(true);
    expect(A_REGRA_V_SE_APLICA(FONTE_DAS_MUDANCAS)).toBe(false);
    // w) a taxa como número: só a fonte a pode escrever.
    expect(A_REGRA_W_SE_APLICA("src/lib/ajuda-plataforma.ts")).toBe(true);
    expect(A_REGRA_W_SE_APLICA(FONTE_DAS_TAXAS)).toBe(false);
    // x) quem confirma.
    const conf = (t: string) => CONFIRMACAO_ANTIGA.some((re) => re.test(t));
    expect(
      conf("Depois, o cliente confirma — sem fotografias, é um colega da CLYON que confirma com ele — e sem essa confirmação a CLYON não lhe pode entregar o valor."),
    ).toBe(true);
    expect(conf("Depois de carregar em «Está feito», um colega da CLYON confirma o trabalho com o cliente.")).toBe(false);
    // b) o email antigo do orçamento.
    const voz = (t: string) => VOZ.some((re) => re.test(t));
    expect(voz("Analisámos o seu pedido e preparámos um orçamento personalizado.")).toBe(true);
    expect(voz("Preparámos um orçamento para si")).toBe(true);
    expect(voz("O seu pedido já tem orçamento. Quem faz o trabalho é um parceiro da sua zona.")).toBe(false);
  });

  it("as frases proibidas que os avisos citam são as que as regras apanham", () => {
    const tem = (lista: RegExp[], s: string) => lista.some((re) => re.test(s));
    for (const f of FRASES_PROIBIDAS.promessa) expect(PROMESSAS.some(({ re }) => re.test(`no ${f}`)), f).toBe(true);
    for (const f of FRASES_PROIBIDAS.voz) expect(tem(VOZ, `a ${f}`), f).toBe(true);
    for (const f of FRASES_PROIBIDAS.brasil) expect(tem(BRASIL, f), f).toBe(true);
    // A fonte só tem as frases: nada mais escapa por ela.
    expect(FONTES).toContain(FONTE_DAS_FRASES_PROIBIDAS);
    const { textos } = lerFicheiro(FONTE_DAS_FRASES_PROIBIDAS);
    const todas = new Set<string>([...FRASES_PROIBIDAS.promessa, ...FRASES_PROIBIDAS.voz, ...FRASES_PROIBIDAS.brasil]);
    expect(textos.map((t) => t.texto).filter((t) => !todas.has(t))).toEqual([]);
  });

  it("nenhum desencontro fora da lista de excepções", () => {
    const fora = ACHADOS.filter((a) => !EXCEPTUADOS.has(chave(a.ficheiro, a.regra))).map(
      (a) => `${a.ficheiro}:${a.linha} [${a.regra}] «${a.texto}»`,
    );
    expect(fora).toEqual([]);
  });

  it("a lista de excepções só encolhe: nenhuma está a mais, e não passa do máximo", () => {
    const usadas = new Set(ACHADOS.map((a) => chave(a.ficheiro, a.regra)));
    const amais = EXCEPCOES.filter((e) => !usadas.has(chave(e.ficheiro, e.regra))).map(
      (e) => `${chave(e.ficheiro, e.regra)} já está limpo — apaga a excepção e desce TAMANHO_MAXIMO`,
    );
    expect(amais).toEqual([]);
    expect(EXCEPCOES.length).toBeLessThanOrEqual(TAMANHO_MAXIMO);
    expect(new Set(EXCEPCOES.map((e) => chave(e.ficheiro, e.regra))).size).toBe(EXCEPCOES.length);
    for (const e of EXCEPCOES) {
      expect(e.motivo.length, chave(e.ficheiro, e.regra)).toBeGreaterThan(10);
      // Só ficam as que pertencem a outra execução ou a uma decisão do dono.
      expect(e.motivo, chave(e.ficheiro, e.regra)).toMatch(/^(apps|dono|painel|d16):/);
      // As da d16 só entram como temporárias, com quem as fecha (13-11-2026).
      if (e.motivo.startsWith("d16:")) expect(e.motivo, chave(e.ficheiro, e.regra)).toMatch(/^d16: I&D\/apps a seguir/);
      // As do painel só entram como temporárias (d8, 28-10-2026).
      if (e.motivo.startsWith("painel:")) expect(e.motivo, chave(e.ficheiro, e.regra)).toMatch(/^painel: temporária/);
    }
  });

  it("o email do pedido conta a mesma história do ecrã do simulador", () => {
    const CONFERE = "A CLYON confere o pedido e envia-o aos parceiros da sua zona";
    // Os três passos do ecrã vivem em textos-do-pedido.ts desde 29-10-2026 (S12).
    const ecra =
      readFileSync(join(RAIZ, "src/app/simulador/SimulatorThreePhaseForm.tsx"), "utf8") +
      readFileSync(join(RAIZ, "src/lib/textos-do-pedido.ts"), "utf8");
    const email = readFileSync(join(RAIZ, "src/lib/email-pedido.ts"), "utf8");
    expect(ecra).toContain(CONFERE);
    expect(ecra).toContain("Recebe propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}");
    expect(email).toContain(CONFERE);
    expect(email).toContain("${PROMESSA_DO_PRAZO}");
  });

  it("a taxa tem um nome e a fatura uma grafia (decisão do dono, 27-10-2026)", () => {
    expect(NOME_DA_TAXA).toBe("taxa da plataforma");
    expect(TAXA_COM_OUTRO_NOME.test("a taxa da CLYON")).toBe(true);
    expect(TAXA_COM_OUTRO_NOME.test("a comissão")).toBe(true);
    expect(TAXA_COM_OUTRO_NOME.test("já com a taxa da plataforma")).toBe(false);
    expect(GRAFIA_ANTIGA.test("Há factura em todas as vendas")).toBe(true);
    expect(GRAFIA_ANTIGA.test("Há fatura em todas as vendas")).toBe(false);
  });
});

/*
 * o) «NO MESMO DIA?» TEM UMA RESPOSTA SÓ — 31-10-2026 (decisão d1).
 *
 * A pergunta aparece em mais de vinte sítios — a inicial, a FAQ, as páginas
 * de cada serviço e de cada terra, o blog, /precos — e a Vitória ouve-a todos
 * os dias. Cada resposta escrita à mão acabava a prometer à sua maneira: a da
 * FAQ chegou a dizer «se precisar para o próprio dia, diga-o no pedido». A
 * resposta é NO_MESMO_DIA (promessas-publicas.ts); uma pergunta que junte
 * outra coisa («…custam mais?») acrescenta a sua frase, mas leva-a inteira.
 * As regras c e d dizem o que não se escreve; esta diz o que se escreve.
 */
const PERGUNTA_PELO_MESMO_DIA = /\b(no mesmo dia|hoje)\b[^?]*\?/i;

interface RespostaAoMesmoDia {
  ficheiro: string;
  linha: number;
  pergunta: string;
  pelaConstante: boolean;
}

function respostasAoMesmoDia(): RespostaAoMesmoDia[] {
  const saida: RespostaAoMesmoDia[] = [];
  const nomeDe = (p: ts.PropertyAssignment) =>
    ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : "";
  const eAConstante = (e: ts.Expression) => ts.isIdentifier(e) && e.text === "NO_MESMO_DIA";
  for (const f of FONTES.filter(O_CLIENTE_LE)) {
    const fonte = readFileSync(join(RAIZ, f), "utf8");
    if (!/mesmo dia|hoje/i.test(fonte)) continue;
    const sf = ts.createSourceFile(f, fonte, ts.ScriptTarget.Latest, true, f.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visitar = (n: ts.Node): void => {
      if (ts.isObjectLiteralExpression(n)) {
        const props = n.properties.filter(ts.isPropertyAssignment);
        const q = props.find((p) => ["q", "question", "pergunta"].includes(nomeDe(p)));
        const a = props.find((p) => ["a", "answer", "resposta"].includes(nomeDe(p)));
        if (q && a) {
          const ini = q.initializer;
          const pergunta = ts.isStringLiteralLike(ini)
            ? ini.text
            : ts.isTemplateExpression(ini)
              ? ini.head.text + ini.templateSpans.map((s) => `‹›${s.literal.text}`).join("")
              : "";
          if (PERGUNTA_PELO_MESMO_DIA.test(pergunta)) {
            const r = a.initializer;
            saida.push({
              ficheiro: f,
              linha: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
              pergunta,
              pelaConstante: eAConstante(r) || (ts.isTemplateExpression(r) && r.templateSpans.some((s) => eAConstante(s.expression))),
            });
          }
        }
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }
  return saida;
}

describe("o) «no mesmo dia?» responde-se com uma frase só (d1, 31-10-2026)", () => {
  const RESPOSTAS = respostasAoMesmoDia();

  it("lê as perguntas de todas as páginas", () => {
    expect(RESPOSTAS.length).toBeGreaterThan(20);
    for (const f of [
      "src/app/page.tsx",
      "src/lib/perguntas-frequentes.ts",
      "src/app/precos/page.tsx",
      "src/app/[...slug]/page.tsx",
      "src/lib/city-content.ts",
      "src/lib/blog-data.ts",
    ]) {
      expect(RESPOSTAS.some((r) => r.ficheiro === f), f).toBe(true);
    }
  });

  it("todas respondem com NO_MESMO_DIA, nenhuma à mão", () => {
    expect(RESPOSTAS.filter((r) => !r.pelaConstante).map((r) => `${r.ficheiro}:${r.linha} «${r.pergunta}»`)).toEqual([]);
  });

  it("a frase: propostas em menos de 6 horas, o dia combinado com o parceiro, sem «próprio dia»", () => {
    expect(NO_MESMO_DIA).toContain(PROMESSA_DO_PRAZO);
    expect(NO_MESMO_DIA).toContain(`em menos de ${PRAZO_DE_RESPOSTA.porExtenso}`);
    expect(NO_MESMO_DIA).toMatch(/no dia que combinar com o parceiro/);
    expect(NO_MESMO_DIA).not.toMatch(/pr[óo]prio dia|mesmo dia|\bhoje\b/i);
    expect(PROMESSAS.some(({ re }) => re.test(NO_MESMO_DIA))).toBe(false);
    expect(profissionalAoCliente(NO_MESMO_DIA)).toBeNull();
  });

  it("a Vitória responde o mesmo que o site", () => {
    expect(respostaFrequente("Recolhem no mesmo dia?")).toBe(NO_MESMO_DIA);
    expect(respostaFrequente("Dá para ser hoje?")).toBe(NO_MESMO_DIA);
  });
});

/*
 * s) O RECRUTAMENTO NÃO CHAMA PARCEIROS PARA O ENTULHO — 04-11-2026 (decisão d18).
 *
 * «Não divulgue ou coloque anúncios para entulhos, apenas móveis, monos e
 * esvaziamento.» A /quero-ser-parceiro (a página, o formulário, o título e a
 * descrição do Google) não fala de entulho. O site continua a aceitar pedidos
 * de entulho, e a lista dos serviços que o parceiro escolhe (que vem de
 * `service-categories.ts`) não muda — esta regra lê só o texto escrito
 * nestes ficheiros.
 */
describe("s) a /quero-ser-parceiro não fala de entulho (d18)", () => {
  const FICHEIROS = [
    "src/app/quero-ser-parceiro/page.tsx",
    "src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx",
    "src/app/quero-ser-parceiro/ProcuraNaZona.tsx",
  ];

  it("nenhum texto da página nem do formulário diz entulho", () => {
    const achados = FICHEIROS.flatMap((f) =>
      lerFicheiro(f)
        .textos.filter((t) => /entulho/i.test(t.texto))
        .map((t) => `${f}:${t.linha} «${t.texto.slice(0, 80)}»`),
    );
    expect(achados).toEqual([]);
  });

  it("nem o título e a descrição que o Google mostra", async () => {
    const { TITULO_DO_RECRUTAMENTO, DESCRICAO_DO_RECRUTAMENTO } = await import("./pagina-de-recrutamento");
    expect(`${TITULO_DO_RECRUTAMENTO} ${DESCRICAO_DO_RECRUTAMENTO}`).not.toMatch(/entulho/i);
  });

  it("e a frase de abertura diz o que fica: móveis e monos, esvaziamentos, mudanças e reparações", () => {
    const textos = lerFicheiro("src/app/quero-ser-parceiro/page.tsx").textos.map((t) => t.texto);
    expect(textos.some((t) => t.includes("Recolhas de móveis e monos, esvaziamentos, mudanças e reparações."))).toBe(true);
  });
});

/*
 * t) O QUE O MODELO LÊ PARA DAR PREÇOS É A GRELHA PUBLICADA, E QUEM FAZ É O
 * PARCEIRO — 10-11-2026 (decisão d28).
 *
 * A regra t lê o código (acima); aqui lê-se o texto já montado, como o modelo
 * o recebe — a estrutura de custos do motor e o prompt inteiro —, e as
 * traduções fixas da Vitória, que são um JSON e a árvore do TypeScript não vê.
 */
describe("t) o modelo lê a grelha publicada e a Vitória diz quem faz (d28)", () => {
  const VELHOS: Array<[string, RegExp]> = [
    ["o mínimo por item de 48,78 €", MINIMO_POR_ITEM_ANTIGO],
    ["«Mínimo por item»", /m[íi]nimo por item/i],
    ["Almada com valor por zona", ALMADA_POR_ZONA],
    ["a tabela por zona", /VALOR RECOMENDADO por zona|m[íi]nimo de zona — Local/i],
    ["o desconto de eficiência no preço", /desconto de efici[êe]ncia/i],
  ];

  it("a estrutura de custos do motor e o prompt inteiro não trazem a tabela antiga", async () => {
    const { getActivePricingRulesForGemini } = await import("./pricing-helper");
    const { buildAnalysisPrompt } = await import("./prompt-do-orcamento");
    const regras = await getActivePricingRulesForGemini();
    const prompt = buildAnalysisPrompt("(o pedido)", regras);
    for (const [nome, re] of VELHOS) {
      expect(regras, nome).not.toMatch(re);
      expect(prompt, nome).not.toMatch(re);
    }
  }, 60_000);

  it("os itens soltos e a carga completa saem das fontes, com o IVA ao lado", async () => {
    const { getActivePricingRulesForGemini, ITENS_SOLTOS_PARA_O_MODELO, CARGA_COMPLETA_PARA_O_MODELO, PECAS_PARA_O_MODELO } =
      await import("./pricing-helper");
    const { PRECO_POR_ITEM, RECOLHA_MINIMA_DOS_MOVEIS, PRECOS, ESVAZIAMENTO_POR_TIPOLOGIA } = await import("./precos-publicos");
    const { comIva, euros } = await import("./quanto-custa");
    const regras = await getActivePricingRulesForGemini();
    for (const bloco of [ITENS_SOLTOS_PARA_O_MODELO, CARGA_COMPLETA_PARA_O_MODELO, PECAS_PARA_O_MODELO]) expect(regras).toContain(bloco);
    const par = (v: number) => `${euros(v)} s/IVA (${euros(comIva(v))} c/IVA)`;
    for (const t of ["pequeno", "medio", "grande"] as const) expect(ITENS_SOLTOS_PARA_O_MODELO).toContain(par(PRECO_POR_ITEM[t]));
    expect(ITENS_SOLTOS_PARA_O_MODELO).toContain(`Recolha mínima dos móveis: ${par(RECOLHA_MINIMA_DOS_MOVEIS)}`);
    expect(ITENS_SOLTOS_PARA_O_MODELO).toContain(`${PRECOS.recolha_monos.minimo} – ${euros(PRECOS.recolha_monos.maximo!)} s/IVA`);
    for (const linha of ESVAZIAMENTO_POR_TIPOLOGIA) expect(CARGA_COMPLETA_PARA_O_MODELO).toContain(`- ${linha.tipo}: `);
    // O sem IVA nunca sozinho: cada «s/IVA» destes blocos traz o «c/IVA» logo a seguir.
    for (const bloco of [ITENS_SOLTOS_PARA_O_MODELO, CARGA_COMPLETA_PARA_O_MODELO, PECAS_PARA_O_MODELO]) {
      const sem = bloco.match(/s\/IVA/g) ?? [];
      const comOsDois = bloco.match(/s\/IVA \([^)]*c\/IVA\)/g) ?? [];
      expect(sem.length).toBeGreaterThan(0);
      expect(comOsDois.length).toBe(sem.length);
    }
  }, 60_000);

  it("a Vitória diz que sim sem pôr a CLYON a fazer o trabalho — em português e nas traduções fixas", async () => {
    const { SIM_OS_PARCEIROS_FAZEM } = await import("./voz-da-vitoria");
    expect(SIM_OS_PARCEIROS_FAZEM).toMatch(/^Sim, .*parceiros fazem!$/);
    expect(VOZ.some((re) => re.test(SIM_OS_PARCEIROS_FAZEM))).toBe(false);
    const json = readFileSync(join(RAIZ, "src/lib/traducoes-fixas-da-vitoria.json"), "utf8");
    expect(json).not.toMatch(/fazemos,? sim/i);
    expect(json).not.toMatch(/something we do|nous le faisons|lo hacemos/i);
    for (const re of GRELHA_ANTIGA) expect(json).not.toMatch(re);
    const { traducaoFixa } = await import("./traducoes-fixas-da-vitoria");
    for (const lingua of ["en", "fr", "es"] as const) {
      const t = traducaoFixa(SIM_OS_PARCEIROS_FAZEM, lingua);
      expect(t, lingua).toBeTruthy();
      expect(t, lingua).toMatch(/partners|partenaires|colaboradores/);
    }
  });
});

/*
 * u–x) A PARTE DO SITE DA d28 — 10-11-2026 (ordem do CEO, aprovada pelo dono).
 *
 * As regras de cima lêem os textos; estas provam as cinco correcções pelo que
 * as funções devolvem, para a frase certa não poder sair sem o teste dar por isso.
 */
describe("u–x) emails, taxa, plataforma e distância pelas fontes (d28, parte do Site)", () => {
  it("o email «Foi contratado» diz quem confirma e o prazo como a confirmação automática", async () => {
    const { PROMESSA_POR_FORMA, promessaDaForma } = await import("./pagamento-na-plataforma");
    const { DIAS_ATE_LIBERTAR_SOZINHO, QUEM_CONFIRMA_COM_E_SEM_FOTOS, QUEM_CONFIRMA_COM_E_SEM_FOTOS_NUM_TRABALHO_CLYON, quemConfirmaAntesDeMarcar } =
      await import("./trabalho");
    const caudas = [
      ...Object.values(PROMESSA_POR_FORMA).map((p) => p.emailProParaQueServeAProva),
      promessaDaForma("dinheiro", "sem_iva").emailProParaQueServeAProva,
    ];
    for (const c of caudas) {
      expect(c).not.toMatch(/colega/i);
      expect(c).not.toMatch(/sem essa confirmação/i);
      expect(c).not.toMatch(/fotografia/i);
      expect(c).toMatch(/confirma/i);
    }
    // A frase de quem confirma traz o prazo da confirmação automática, nos dois casos.
    for (const frase of [QUEM_CONFIRMA_COM_E_SEM_FOTOS, QUEM_CONFIRMA_COM_E_SEM_FOTOS_NUM_TRABALHO_CLYON]) {
      expect(frase).toContain("fecha sozinho " + DIAS_ATE_LIBERTAR_SOZINHO + " dias depois");
    }
    expect(quemConfirmaAntesDeMarcar(false)).toBe(QUEM_CONFIRMA_COM_E_SEM_FOTOS);
    expect(quemConfirmaAntesDeMarcar(true)).toBe(QUEM_CONFIRMA_COM_E_SEM_FOTOS_NUM_TRABALHO_CLYON);
    // E o email usa-a, logo antes do que a confirmação faz ao dinheiro.
    const email = readFileSync(join(RAIZ, "src/lib/email-trabalho.ts"), "utf8");
    expect(email).toMatch(/\$\{quemConfirmaAntesDeMarcar\(p\.ofertaClyon === true\)\}\s+\$\{promessa\.emailProParaQueServeAProva\}/);
    // Num Trabalho CLYON quem confirma é a CLYON: o aviso do escolhido di-lo.
    expect(readFileSync(join(RAIZ, "src/lib/avisar-escolhido-da-oferta.ts"), "utf8")).toMatch(/ofertaClyon: true/);
  });

  it("o email do orçamento fala como plataforma: quem faz é o parceiro", async () => {
    const { TEXTOS_DO_EMAIL_DO_ORCAMENTO } = await import("./textos-do-orcamento");
    const tudo = Object.values(TEXTOS_DO_EMAIL_DO_ORCAMENTO).join(" ");
    expect(VOZ.some((re) => re.test(tudo))).toBe(false);
    expect(tudo).not.toMatch(/(?<!\p{L})(fazemos|carregamos|levamos|transportamos|a nossa equipa|a sua reserva)(?!\p{L})/iu);
    expect(profissionalAoCliente(tudo)).toBeNull();
    for (const frase of [TEXTOS_DO_EMAIL_DO_ORCAMENTO.abertura, TEXTOS_DO_EMAIL_DO_ORCAMENTO.naPagina]) {
      expect(frase).toMatch(/Quem faz o trabalho é um parceiro/);
      expect(frase).toMatch(/a CLYON organiza o pedido, guarda o acordo/);
    }
    // O HTML e o assunto lêem as três frases, e as antigas não ficaram no ficheiro (fora dos comentários).
    const fonte = readFileSync(join(RAIZ, "src/lib/email-orcamento.ts"), "utf8").replace(/^[ \t]*\/?\*.*$/gm, "");
    for (const chaveDoTexto of ["titulo", "porBaixoDoNome", "abertura"]) {
      expect(fonte).toContain("$" + "{TEXTOS_DO_EMAIL_DO_ORCAMENTO." + chaveDoTexto + "}");
    }
    expect(fonte).not.toMatch(/Analis[áa]mos|prepar[áa]mos|a sua reserva|Recolha · Mudança · Esvaziamento|O seu orçamento CLYON/);
    // A página do mesmo orçamento diz o mesmo.
    const pagina = readFileSync(join(RAIZ, "src/app/orcamento/[token]/page.tsx"), "utf8");
    expect(pagina).toContain("{TEXTOS_DO_EMAIL_DO_ORCAMENTO.naPagina}");
    expect(pagina).toContain("{TEXTOS_DO_EMAIL_DO_ORCAMENTO.porBaixoDoNome}");
    expect(pagina).not.toMatch(/Analis[áa]mos|prepar[áa]mos|Recolha &middot; Mudança/);
  });

  it("o exemplo da ajuda faz as contas com a taxa de taxas-plataforma.ts", async () => {
    const { TAXA_TOTAL, TAXA_IVA } = await import("./taxas-plataforma");
    const { PERGUNTAS_DO_PROFISSIONAL } = await import("./ajuda-plataforma");
    const fonte = readFileSync(join(RAIZ, "src/lib/ajuda-plataforma.ts"), "utf8");
    expect(fonte).toMatch(/const taxa = TAXA_TOTAL;/);
    const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ","));
    const daTaxa = Math.round(100 * TAXA_TOTAL * 100) / 100;
    const iva = Math.round(100 * TAXA_IVA * 100) / 100;
    const exemplo = PERGUNTAS_DO_PROFISSIONAL.map((p) => p.resposta).find((r) => r.includes("Exemplo, num pedido com a taxa de"));
    expect(exemplo).toBeTruthy();
    expect(exemplo).toContain("fica com " + n(100 - daTaxa) + " € e entrega " + n(iva + daTaxa) + " € à CLYON");
    expect(exemplo).toContain(n(daTaxa) + " € de taxa");
  });

  it("a distância das mudanças é uma só, na página de cidade e no que o modelo lê", async () => {
    const { RAIO_INCLUIDO_KM, PRECO_POR_KM_LONGE, DESLOCACAO_DA_MUDANCA, DESLOCACAO_DA_MUDANCA_CURTA, DESLOCACAO_DA_MUDANCA_PARA_O_MODELO } =
      await import("./tabela-das-mudancas");
    const { regrasDaMudancaParaOModelo, SEM_PARCEIROS, MODELO_DA_MUDANCA_CURTO } = await import("./preco-publico-das-mudancas");
    const porKm = PRECO_POR_KM_LONGE.toFixed(2).replace(".", ",") + " € por km";
    for (const frase of [DESLOCACAO_DA_MUDANCA, DESLOCACAO_DA_MUDANCA_CURTA]) {
      expect(frase).toContain(RAIO_INCLUIDO_KM + " km");
      expect(frase).toContain(porKm);
      expect(frase).toMatch(/ida e volta/);
    }
    expect(DESLOCACAO_DA_MUDANCA_PARA_O_MODELO).toContain("até " + RAIO_INCLUIDO_KM + " km incluída");
    expect(DESLOCACAO_DA_MUDANCA_PARA_O_MODELO).toContain(PRECO_POR_KM_LONGE + " €/km sobre todos os km, ida e volta");
    expect(regrasDaMudancaParaOModelo(SEM_PARCEIROS)).toContain("Deslocação (referência): " + DESLOCACAO_DA_MUDANCA_PARA_O_MODELO + ".");

    const { getCidadeMudancaBySlug } = await import("./mudancas-cidades");
    const sintra = getCidadeMudancaBySlug("sintra");
    const resposta = sintra?.faqs.find((q) => /Quanto custa uma mudança Sintra/.test(q.pergunta))?.resposta ?? "";
    // Desde 11-11-2026 os km são os da tarifa de cada parceiro: a página diz o modelo, sem número à mão.
    expect(resposta).toContain(MODELO_DA_MUDANCA_CURTO);
    expect(resposta).toContain("os km pela tarifa dele");
    expect(resposta).not.toMatch(/\d+(,\d+)? € por km/);

    const { buildAnalysisPrompt } = await import("./prompt-do-orcamento");
    const prompt = buildAnalysisPrompt("(o pedido)", "(as regras)");
    expect(prompt).toContain("Para mudança, a deslocação é a da tabela das mudanças: " + DESLOCACAO_DA_MUDANCA_PARA_O_MODELO + ".");
    expect(prompt).not.toMatch(/>\s?30 ?km|embutido na taxa horária/i);
  }, 60_000);

  it("o formulário inicial e a faixa dos cookies dizem «plataforma»", () => {
    const hero = readFileSync(join(RAIZ, "src/components/HeroQuoteForm.tsx"), "utf8");
    expect(hero).toContain("Tentei pedir um orçamento pela plataforma");
    expect(hero).toContain("Acabei de enviar um pedido pela plataforma");
    const cookies = readFileSync(join(RAIZ, "src/components/CookieConsent.tsx"), "utf8");
    expect(cookies).toContain("a sua experiência na plataforma");
    expect(ACHADOS.filter((a) => a.regra === "u-site")).toEqual([]);
  });
});

/*
 * y) AS MUDANÇAS AO PREÇO DE CADA PARCEIRO, NA VITÓRIA E NO AVISO AO MODELO —
 * 11-11-2026 (d7, ordem do CEO aprovada pelo dono; a parte do I&D).
 *
 * A Vitória e o modelo que estima diziam a hora, a equipa e o mínimo de horas
 * da tabela de referência como se fossem um preço da CLYON — até com parceiros
 * na lista («Para estimar usa a referência…»). A regra:
 *   · com parceiros na lista, nem a hora nem o mínimo da referência: o «desde»
 *     da lista (2 e 3 pessoas) e o mínimo do parceiro;
 *   · com a lista vazia, só na frase que diz «referência»;
 *   · nos ficheiros, nenhum mínimo de horas escrito à mão (a regra l já chumba
 *     os euros à mão): os números vêm de tabela-das-mudancas.ts.
 */
describe("y) as mudanças ao preço de cada parceiro, na Vitória e no aviso ao modelo (d7)", () => {
  const MINIMO_DE_HORAS_A_MAO = /m[íi]nimo (?:de )?\d+(?:[.,]\d+)? ?h(?:oras?)?(?![a-zà-ú])/iu;
  const COM = {
    tipo: "parceiros" as const,
    parceiros: 2,
    desde: { semIvaCent: 4000, comIvaCent: 4920 },
    desde3: { semIvaCent: 5500, comIvaCent: 6765 },
    minimoHoras: { de: 2, ate: 4 },
  };

  async function oQueSeDiz(preco: typeof COM | { tipo: "referencia" }) {
    const m = await import("./preco-publico-das-mudancas");
    const { getActivePricingRulesForGemini } = await import("./pricing-helper");
    const { buildAnalysisPrompt } = await import("./prompt-do-orcamento");
    const { oQueOSiteSabe } = await import("./o-que-o-site-sabe");
    const { notaDoPrecoPara } = await import("./whatsapp-recolha");
    m.lembrarPrecoPublico(preco);
    try {
      const doMotor = await getActivePricingRulesForGemini();
      return {
        daReferencia: m.dizAHoraOuOMinimoDaReferencia,
        textos: {
          "a Vitória, a quem pergunta o preço": notaDoPrecoPara("Quanto custa?", "quando", false, "mudanca"),
          "o que a Vitória sabe": oQueOSiteSabe(),
          "as regras da mudança para o modelo": m.regrasDaMudancaParaOModelo(preco),
          "a estrutura de custos que vai ao modelo": doMotor,
          "o aviso ao modelo que estima": buildAnalysisPrompt("(o pedido)", doMotor),
        } as Record<string, string>,
      };
    } finally {
      m.lembrarPrecoPublico(m.SEM_PARCEIROS);
    }
  }

  it("a regra apanha as frases de antes, e deixa o «desde» da lista", async () => {
    const { dizAHoraOuOMinimoDaReferencia: daReferencia } = await import("./preco-publico-das-mudancas");
    const { PRECO_POR_HORA, MINIMO_DE_HORAS } = await import("./tabela-das-mudancas");
    for (const frase of [
      `Para estimar usa a referência de ${PRECO_POR_HORA} €/hora (equipa de 3), mínimo ${MINIMO_DE_HORAS} horas.`,
      `estima pela referência (${PRECO_POR_HORA} € s/IVA por hora, mínimo ${MINIMO_DE_HORAS} horas)`,
      `Equipa de 3 a ${PRECO_POR_HORA} €/h + IVA`,
      `mínimo de ${MINIMO_DE_HORAS} horas`,
    ]) {
      expect(daReferencia(frase), frase).toBe(true);
    }
    expect(daReferencia("O mais baixo hoje, com 2 pessoas: 40 €/hora; com 3 pessoas: 55 €/hora.")).toBe(false);
    expect(daReferencia("o mínimo de horas é o de cada parceiro (na lista de hoje: entre 2 e 4 horas)")).toBe(false);
    expect("mínimo 3 horas").toMatch(MINIMO_DE_HORAS_A_MAO);
    expect("mínimo de 2,5 h").toMatch(MINIMO_DE_HORAS_A_MAO);
    expect("o mínimo de horas é o do parceiro").not.toMatch(MINIMO_DE_HORAS_A_MAO);
  });

  it("com parceiros na lista, ninguém diz a hora nem o mínimo da referência", async () => {
    const { daReferencia, textos } = await oQueSeDiz(COM);
    for (const [quem, texto] of Object.entries(textos)) {
      expect(texto.split("\n").filter(daReferencia), quem).toEqual([]);
    }
    expect(textos["a Vitória, a quem pergunta o preço"]).toContain("com 2 pessoas e desde");
    expect(textos["as regras da mudança para o modelo"]).toContain("O mínimo de horas é o de cada parceiro");
  }, 60_000);

  it("com a lista vazia, só na frase que diz «referência»", async () => {
    const { daReferencia, textos } = await oQueSeDiz({ tipo: "referencia" });
    let ditas = 0;
    for (const [quem, texto] of Object.entries(textos)) {
      // Frase a frase no que o cliente lê; linha a linha no que vai ao modelo.
      const partes = quem.startsWith("a Vitória") ? texto.split(/(?<=[.!?])\s+/) : texto.split("\n");
      for (const parte of partes.filter(daReferencia)) {
        ditas += 1;
        expect(parte, quem).toMatch(/refer[êe]ncia/i);
      }
    }
    // A referência publicada continua a dizer-se (a Vitória responde por ela).
    expect(ditas).toBeGreaterThan(2);
    expect(textos["a Vitória, a quem pergunta o preço"]).toContain("na referência, são ");
  }, 60_000);

  it("nenhum mínimo de horas escrito à mão nos textos ao modelo e da Vitória", () => {
    const fora = FONTES.filter(FALA_DE_PRECOS).flatMap((f) =>
      lerFicheiro(f)
        .textos.filter((t) => MINIMO_DE_HORAS_A_MAO.test(t.texto))
        .map((t) => `${f}:${t.linha} — ${t.texto.slice(0, 80)}`),
    );
    expect(fora).toEqual([]);
    // O ficheiro das frases (fora das fontes de preços, e por isso lido aqui à parte).
    const doPrecoPublico = lerFicheiro("src/lib/preco-publico-das-mudancas.ts").textos.filter((t) => MINIMO_DE_HORAS_A_MAO.test(t.texto));
    expect(doPrecoPublico.map((t) => t.texto.slice(0, 80))).toEqual([]);
  });

  it("nas traduções fixas, a hora e o mínimo da referência só na frase da referência", async () => {
    const { dizAHoraOuOMinimoDaReferencia: daReferencia } = await import("./preco-publico-das-mudancas");
    const dados = JSON.parse(readFileSync(join(RAIZ, "src/lib/traducoes-fixas-da-vitoria.json"), "utf8")) as { frases: string[][] };
    const ditas = dados.frases.filter((l) => daReferencia(l[0]));
    expect(ditas.length).toBe(1);
    expect(ditas[0][0]).toMatch(/na referência, são /);
    expect(ditas[0][1]).toMatch(/as a reference/);
    expect(ditas[0][2]).toMatch(/à titre de référence/);
    expect(ditas[0][3]).toMatch(/como referencia/);
  });
});

/*
 * z) AS MUDANÇAS PELA LISTA NAS PÁGINAS, NO BLOG, NA FAQ E NO SIMULADOR; O
 *    MÍNIMO DO PARCEIRO; A TAXA DAS MUDANÇAS NA FONTE ÚNICA — d7, 11-11-2026
 *    (parte do Site).
 *
 * A regra y guardou a Vitória e o aviso ao modelo. Ficavam as páginas, o blog
 * e a FAQ a publicar os totais «na referência» com parceiros na lista (a lista
 * dava cerca do dobro num T2), o passo 2 do simulador sem a proteção que o
 * cartão do passo 3 somava, «mínimo 3 horas» fixo nas mudanças da lista, e a
 * taxa das mudanças fora de taxas-plataforma.ts. As regras:
 *   · com parceiros na lista, nenhuma página, artigo ou resposta diz a hora
 *     nem o mínimo da referência — diz o «desde» de 2 e de 3 e os exemplos;
 *   · com a lista vazia, só na frase que diz «referência»;
 *   · o passo 2 do simulador diz o número do cartão (com a proteção);
 *   · numa negociação com tarifa congelada, o mínimo é o do parceiro;
 *   · a taxa das mudanças vive em taxas-plataforma.ts, e a ajuda e o «Como
 *     funciona» dizem-na de lá.
 */
describe("z) as mudanças pela lista nas páginas, no blog, na FAQ e no simulador (d7, parte do Site)", () => {
  const TARIFA = {
    precoHora2: 55,
    precoHora3: 65,
    minimoHoras: 2,
    precoKm: 1,
    kmMinimo: 20,
    kmMaximo: 100,
    caixa: 2,
    cartaoMetro: 1.5,
    filmeRolo: 9,
    plasticoBolhaRolo: 12,
    aparecerNaLista: true,
  };
  const candidato = (tarifa = TARIFA) =>
    ({
      nome: "Exemplo",
      contaDeTeste: false,
      verificado: true,
      tarifa,
      notaMedia: null,
      avaliacoes: 0,
      isActive: true,
      estado: "aprovado",
      categorias: ["mudanca"],
      raioKm: 50,
      emiteFatura: true,
      emiteGuiaTransporte: false,
      guiaVerificadaEm: null,
    }) as never;

  async function comALista() {
    const m = await import("./preco-publico-das-mudancas");
    const preco = m.precoPublicoDosCandidatos([candidato(), candidato({ ...TARIFA, precoHora2: 60, precoHora3: 70, minimoHoras: 4 })]);
    if (preco.tipo !== "parceiros") throw new Error("a lista de exemplo ficou vazia");
    return { m, preco };
  }

  /** Todas as frases de um valor qualquer (strings dentro de objectos e listas). */
  function frases(v: unknown): string[] {
    if (typeof v === "string") return v.split(/(?<=[.!?;])\s+/);
    if (Array.isArray(v)) return v.flatMap(frases);
    if (v && typeof v === "object") return Object.values(v).flatMap(frases);
    return [];
  }

  /** O que as páginas, o blog, a FAQ e o simulador dizem, com este preço público. */
  async function oQueSePublica(preco: import("./preco-publico-das-mudancas").PrecoPublicoDasMudancas) {
    const m = await import("./preco-publico-das-mudancas");
    const { conteudoDoPrecoDasMudancas, descricaoDoPrecoDasMudancas } = await import("./pagina-do-preco-das-mudancas");
    const { mudancaNoBlog } = await import("./mudanca-no-blog");
    const { getAllBlogPosts } = await import("./blog-data");
    const { perguntasFrequentes } = await import("./perguntas-frequentes");
    const { estimativaDaMudanca, comIvaDaEtiqueta, precoDeReferencia } = await import("./preco-de-referencia");
    const { mensagemDaMudanca } = await import("./pricing-helper");
    const { tituloDaMudanca } = await import("./titulos-seo");
    const { horasDaMudanca } = await import("./lista-de-parceiros-da-mudanca");
    const { orcamentoDaMudanca, pessoasParaACasa } = await import("./tabela-das-mudancas");
    m.lembrarPrecoPublico(preco);
    try {
      const passo2 = (["itens", "T0", "T1", "T2", "T3", "T4+"] as const).flatMap((tipologia) =>
        [false, true].map((desmontagem) =>
          estimativaDaMudanca(
            orcamentoDaMudanca({ tipologia, desmontagem, protecao: true }),
            preco,
            { horas: horasDaMudanca(tipologia, desmontagem, 2), pessoas: pessoasParaACasa(tipologia, 2) },
            { tipologia, desmontagem },
          ),
        ),
      );
      return {
        daReferencia: m.dizAHoraOuOMinimoDaReferencia,
        textos: {
          "a página /precos/mudancas": [conteudoDoPrecoDasMudancas(preco), descricaoDoPrecoDasMudancas(preco)],
          "as frases das mudanças no blog": mudancaNoBlog(preco),
          "os artigos do blog": getAllBlogPosts(preco),
          "as perguntas frequentes": perguntasFrequentes(preco),
          "a cabeça, a descrição e o título das páginas": [
            m.precoDaMudancaNaCabeca(preco),
            m.precoDaMudancaPorExtenso(preco),
            m.precoDaMudancaNumaFrase(preco),
            m.precoDaMudancaEmDetalhe(preco),
            m.precoDaMudancaCurto(preco),
            m.precoDaMudancaNaDescricao(preco),
            m.precoDaMudancaNoTitulo(preco),
            tituloDaMudanca("Almada", preco),
          ],
          "a estimativa do passo 2 do simulador": passo2,
          "a mensagem do motor ao cliente": mensagemDaMudanca(m.estimativaPelaLista(preco, "T2", false), 6, 360, 442.8),
          "os cartões dos serviços": [comIvaDaEtiqueta("mudanca"), precoDeReferencia("mudanca")],
        } as Record<string, unknown>,
      };
    } finally {
      m.lembrarPrecoPublico(m.SEM_PARCEIROS);
    }
  }

  it("com parceiros na lista, nenhuma página, artigo ou resposta diz a hora nem o mínimo da referência", async () => {
    const { preco } = await comALista();
    const { daReferencia, textos } = await oQueSePublica(preco);
    for (const [quem, v] of Object.entries(textos)) {
      expect(frases(v).filter(daReferencia), quem).toEqual([]);
      // Nem a referência como preço: com a lista, sai de cena.
      expect(frases(v).filter((f) => /na refer[êe]ncia|refer[êe]ncia:? \d/i.test(f)), quem).toEqual([]);
    }
  }, 60_000);

  it("e dizem o que a lista dá: o «desde» de 2 e de 3 e um exemplo por tipologia, com a proteção e os km", async () => {
    const { m, preco } = await comALista();
    const { conteudoDoPrecoDasMudancas, descricaoDoPrecoDasMudancas } = await import("./pagina-do-preco-das-mudancas");
    const { mudancaNoBlog } = await import("./mudanca-no-blog");
    const { perguntasFrequentes } = await import("./perguntas-frequentes");
    const { getAllBlogPosts } = await import("./blog-data");
    const desde = m.desdeDaListaEmTexto(preco);
    expect(desde).toContain("com 2 pessoas e desde");
    const t2 = m.exemploDaLista(preco, "T2");
    expect(t2?.comProtecao).toBe(true);
    const doT2 = m.exemploDaListaEmTexto(t2!);
    const exemplos = m.exemplosDaListaNumaFrase(preco)!;
    expect(exemplos).toContain("já com a proteção e os km");
    expect(exemplos).toContain(doT2);

    const pagina = conteudoDoPrecoDasMudancas(preco);
    expect(pagina.resposta).toContain(desde);
    expect(pagina.resposta).toContain(exemplos);
    expect(pagina.tabela.titulo).toBe("Pela lista de hoje, por tipologia");
    expect(pagina.tabela.linhas.length).toBe(6);
    expect(pagina.extras).toBeUndefined();
    expect(pagina.exemplos).toBeUndefined();
    expect(pagina.faqs.find((f) => f.question === "Há um preço mínimo?")?.answer).toContain("(hoje, entre 2 e 4 horas)");

    expect(m.precoDaMudancaNaCabeca(preco)).toContain(desde);
    expect(m.precoDaMudancaPorExtenso(preco)).toContain(exemplos);
    expect(m.precoDaMudancaEmDetalhe(preco)).toContain("Com 3 pessoas, desde ");
    const noBlog = mudancaNoBlog(preco);
    expect(noBlog.paraTerUmaIdeia).toContain(desde);
    expect(noBlog.linhasPorTipologia.length).toBe(6);
    const artigo = getAllBlogPosts(preco).find((a) => a.slug === "quanto-custa-uma-mudanca-em-lisboa")!;
    expect(JSON.stringify(artigo)).toContain(doT2);
    const faq = perguntasFrequentes(preco)
      .flatMap((c) => c.questions)
      .find((q) => q.q === "Quanto custa uma mudança em Lisboa?")!;
    expect(faq.a).toContain(desde);
    expect(faq.a).toContain(exemplos);
    // As descrições que o Google mostra cabem (≤ 155), com e sem parceiros.
    const { SEM_PARCEIROS } = m;
    for (const p of [preco, SEM_PARCEIROS]) {
      const b = mudancaNoBlog(p);
      for (const d of [descricaoDoPrecoDasMudancas(p), b.descricaoDoQuantoCusta, b.descricaoDaMargemSul]) {
        expect(d.length, d).toBeLessThanOrEqual(155);
        expect(d.length, d).toBeGreaterThan(60);
      }
    }
  });

  it("com a lista vazia, a referência só na frase que diz «referência»", async () => {
    const { SEM_PARCEIROS } = await import("./preco-publico-das-mudancas");
    const { daReferencia, textos } = await oQueSePublica(SEM_PARCEIROS);
    let ditas = 0;
    for (const [quem, v] of Object.entries(textos)) {
      // A tabela, os extras e os exemplos de /precos/mudancas dizem «referência» no título do bloco.
      const lido =
        quem === "a página /precos/mudancas"
          ? (v as [Record<string, unknown>, string]).map((x) => (typeof x === "string" ? x : { resposta: x.resposta, faqs: x.faqs, caixa: x.caixa }))
          : v;
      for (const f of frases(lido).filter(daReferencia)) {
        ditas += 1;
        expect(f, quem).toMatch(/refer[êe]ncia/i);
      }
    }
    expect(ditas).toBeGreaterThan(4);
    const { conteudoDoPrecoDasMudancas } = await import("./pagina-do-preco-das-mudancas");
    const pagina = conteudoDoPrecoDasMudancas(SEM_PARCEIROS);
    for (const titulo of [pagina.tabela.titulo, pagina.extras?.titulo, pagina.exemplos?.intro]) {
      expect(titulo).toMatch(/refer[êe]ncia/i);
    }
  }, 60_000);

  it("o passo 2 do simulador diz o número do cartão do passo 3: com a proteção e os km", async () => {
    const { m, preco } = await comALista();
    const { cartaoDoParceiro, horasDaMudanca, faixaEmTexto } = await import("./lista-de-parceiros-da-mudanca");
    const { estimativaDaMudanca } = await import("./preco-de-referencia");
    const { orcamentoDaMudanca, pessoasParaACasa } = await import("./tabela-das-mudancas");
    for (const tipologia of ["T1", "T2", "T3"] as const) {
      const ctx = { tipologia, desmontagem: false, pessoas: 2 as const, kmPercurso: 0, formaDePagamento: "na_plataforma" as const, cidade: null };
      // O cartão mais barato do passo 3, para a mesma casa.
      const cartao = cartaoDoParceiro(candidato(), ctx, "x")!;
      expect(cartao.protecao.linhas.length).toBeGreaterThan(0);
      const doPasso2 = m.estimativaPelaLista(preco, tipologia, false)!;
      expect(doPasso2.minimo).toEqual({ semIvaCent: cartao.estimativa.minimo.semIvaCent, comIvaCent: cartao.estimativa.minimo.comIvaCent });
      expect(doPasso2.maximo).toEqual({ semIvaCent: cartao.estimativa.maximo.semIvaCent, comIvaCent: cartao.estimativa.maximo.comIvaCent });
      const frase = estimativaDaMudanca(
        orcamentoDaMudanca({ tipologia, protecao: true }),
        preco,
        { horas: horasDaMudanca(tipologia, false, 2), pessoas: pessoasParaACasa(tipologia, 2) },
        { tipologia, desmontagem: false },
      );
      expect(frase).toContain(faixaEmTexto(cartao.estimativa.minimo, cartao.estimativa.maximo));
      expect(frase).toContain("com a proteção e os km mínimos dele");
      expect(frase).not.toContain("sem o material");
    }
    // A rota pública leva as estimativas (sem dizer quantos parceiros há), e o simulador lê-as inteiras.
    const paraFora = JSON.parse(JSON.stringify(m.precoPublicoParaFora(preco)));
    expect(m.precoPublicoDeFora(paraFora)).toEqual({ ...preco, parceiros: 1 });
    expect(Object.keys(paraFora)).not.toContain("parceiros");
    expect(m.precoPublicoDeFora({ tipo: "parceiros" })).toEqual(m.SEM_PARCEIROS);
    expect(m.precoPublicoDeFora(null)).toEqual(m.SEM_PARCEIROS);
    const simulador = readFileSync(join(RAIZ, "src/app/simulador/SimulatorThreePhaseForm.tsx"), "utf8");
    expect(simulador).toContain("setPrecoDasMudancas(precoPublicoDeFora(p))");
    expect(readFileSync(join(RAIZ, "src/app/api/mudancas/preco-publico/route.ts"), "utf8")).toContain("precoPublicoParaFora(preco)");
  });

  it("o motor estima pela lista quando há parceiros, e pela referência (dita como referência) com a lista vazia", async () => {
    const { m, preco } = await comALista();
    const { mensagemDaMudanca } = await import("./pricing-helper");
    const t2 = m.estimativaPelaLista(preco, "T2", false)!;
    m.lembrarPrecoPublico(preco);
    try {
      const msg = mensagemDaMudanca(t2, 6, 0, 0);
      expect(msg).toContain(m.desdeDaListaEmTexto(preco));
      expect(msg).toContain(m.exemploDaListaEmTexto(t2));
      expect(m.dizAHoraOuOMinimoDaReferencia(msg)).toBe(false);
    } finally {
      m.lembrarPrecoPublico(m.SEM_PARCEIROS);
    }
    const naReferencia = mensagemDaMudanca(null, 6, 360, 442.8);
    expect(naReferencia).toContain(m.NA_REFERENCIA_DA_MUDANCA);
    expect(naReferencia).toContain("Estimativa na referência");
    const fonte = readFileSync(join(RAIZ, "src/lib/pricing-helper.ts"), "utf8");
    expect(fonte).toContain("mudancaPelaLista = estimativaPelaLista(precoPublicoConhecido(), tipologiaDaMudanca(input), desmontagemNaMudanca(input));");
    expect(fonte).not.toContain("por hora (mínimo ${MINIMO_DE_HORAS} h)");
    expect(fonte).not.toContain("Mínimo de mudança aplicado:");
  });

  it("numa negociação com tarifa congelada, o mínimo é o do parceiro — nunca «mínimo 3 horas» fixo", async () => {
    const { congelarTarifa } = await import("./conta-da-mudanca");
    const h = await import("./horas-do-trabalho");
    const { legendaDaContraproposta } = await import("./frase-da-contraproposta");
    const { SAO_PRECOS_POR_HORA_DO_PARCEIRO, mensagemDasPropostas } = await import("./mensagem-das-propostas");
    const { textosDoPrecoPorHora } = await import("./pedido-para-a-app");
    const { MINIMO_DE_HORAS } = await import("./tabela-das-mudancas");
    const MINIMO_FIXO = new RegExp(`m[íi]nimo (?:de )?${MINIMO_DE_HORAS} horas`, "i");
    for (const minimoHoras of [1, 2, 4, 5]) {
      const tarifaCongeladaJson = JSON.stringify(congelarTarifa({ ...TARIFA, minimoHoras }));
      expect(h.minimoDoParceiro({ tarifaCongeladaJson })).toBe(minimoHoras);
      const dito = `mínimo ${minimoHoras} ${minimoHoras === 1 ? "hora" : "horas"}`;
      const textos = [
        h.porHoraParaOCliente({ semIva: 55, total: 67.65, ivaIncluido: true }, minimoHoras),
        h.precoPorHoraParaOCliente(55, 6, { cliente: 0, profissional: 0 }, "iva_incluido", minimoHoras).porHora,
        h.regraDasHoras(minimoHoras),
        legendaDaContraproposta({ porHora: true, ivaIncluido: true, minimoHoras }),
        legendaDaContraproposta({ porHora: true, ivaIncluido: false, minimoHoras }),
        textosDoPrecoPorHora(55, {
          taxaCliente: 0,
          semFactura: 0,
          criadaEm: new Date("2026-11-11T10:00:00Z"),
          horasPrevistas: 6,
          horas: { tarifaCongeladaJson },
        } as never).detalhe ?? "",
        SAO_PRECOS_POR_HORA_DO_PARCEIRO,
      ];
      for (const t of textos) expect(t, t).not.toMatch(MINIMO_FIXO);
      expect(textos[0]).toContain(dito);
      expect(textos[3]).toContain(`(${dito})`);
      expect(textos[5]).toContain(dito);
    }
    // Sem tarifa congelada (os outros trabalhos por hora), o mínimo da casa continua.
    expect(h.minimoDoParceiro({ tarifaCongeladaJson: null })).toBeNull();
    expect(h.porHoraParaOCliente({ semIva: 50, total: 61.5, ivaIncluido: true })).toMatch(MINIMO_FIXO);
    expect(h.REGRA_DAS_HORAS).toBe(h.regraDasHoras());
    // A mensagem das propostas: com a lista, o mínimo de cada parceiro.
    const base = { nomeCliente: "Ana", servico: "mudança", cidade: "Lisboa", propostas: [], base: "hora" as const };
    expect(mensagemDasPropostas({ ...base, mudancaDaLista: true })).not.toMatch(MINIMO_FIXO);
    // Quem lê a tarifa congelada para o dizer.
    const app = readFileSync(join(RAIZ, "src/lib/pedido-para-a-app.ts"), "utf8");
    expect(app).toContain("const minimoDaTarifa = minimoDoParceiro(h);");
    expect(app).toContain("regraTexto: regraDasHoras(minimoDaTarifa),");
    for (const f of ["src/app/pedido/[token]/PropostasRecebidas.tsx", "src/lib/pedidos-do-cliente.ts"]) {
      expect(readFileSync(join(RAIZ, f), "utf8"), f).toMatch(/legendaDaContraproposta\(\{[^}]*minimoHoras: /);
    }
    const painel = readFileSync(join(RAIZ, "src/components/admin/AdminNegociacoesPanel.tsx"), "utf8");
    expect(painel.match(/mudancaDaLista: p\.negociacoes\.some/g)?.length).toBe(2);
  });

  it("o «Reenviar ao profissional» diz a hora dele, congelada, como o primeiro aviso", async () => {
    const { congelarTarifa } = await import("./conta-da-mudanca");
    const { horaCongeladaEmEuros } = await import("./mudanca-escolhida-pelo-cliente");
    const json = JSON.stringify(congelarTarifa(TARIFA));
    expect(horaCongeladaEmEuros(json, 2)).toBe(TARIFA.precoHora2);
    expect(horaCongeladaEmEuros(json, 3)).toBe(TARIFA.precoHora3);
    expect(horaCongeladaEmEuros(null, 2)).toBeNull();
    const rota = readFileSync(join(RAIZ, "src/app/api/admin/negociacoes/reenviar/route.ts"), "utf8").replace(/\s+/g, " ");
    expect(rota).toContain("await tarifaCongeladaDaNegociacao(alvo.id, alvo.providerId)");
    expect(rota).toContain("horaCongelada = horaCongeladaEmEuros(congelada?.tarifaCongeladaJson, congelada?.pessoasEscolhidas);");
    // O valor de partida do pedido só quando a negociação não é de uma mudança escolhida.
    expect(rota).toContain("const minimo = eDaLista ? horaCongelada : pedido.valorDesejadoCliente != null");
  });

  it("o preço público lê-se outra vez quando um parceiro grava a tarifa, e o blog e a FAQ lêem-no", () => {
    const rota = readFileSync(join(RAIZ, "src/app/api/profissionais/tarifas-mudancas/route.ts"), "utf8");
    const gravar = rota.indexOf("await gravarTarifaDasMudancas(");
    expect(gravar).toBeGreaterThan(0);
    expect(rota.indexOf('revalidateTag("preco-publico-das-mudancas")', gravar)).toBeGreaterThan(gravar);
    expect(readFileSync(join(RAIZ, "src/lib/ler-preco-publico-das-mudancas.ts"), "utf8")).toContain('tags: ["preco-publico-das-mudancas"]');
    for (const f of ["src/app/blog/[slug]/page.tsx", "src/app/blog/page.tsx", "src/app/faq/page.tsx"]) {
      const fonte = readFileSync(join(RAIZ, f), "utf8");
      expect(fonte, f).toContain("precoPublicoDasMudancas()");
      expect(fonte, f).toContain("export const revalidate = 3600;");
    }
  });

  it("a taxa das mudanças só da fonte única, e a ajuda e o «Como funciona» dizem-na de lá", async () => {
    const t = await import("./taxas-plataforma");
    const { REGRAS_DAS_MUDANCAS, TAXA_DAS_MUDANCAS } = await import("./conta-da-mudanca");
    const { perguntasDoProfissional, PERGUNTAS_DO_PROFISSIONAL } = await import("./ajuda-plataforma");
    const { comissaoEmPalavras } = await import("./como-funciona-para-o-profissional");
    expect(TAXA_DAS_MUDANCAS).toBe(t.TAXA_DAS_MUDANCAS);
    expect(REGRAS_DAS_MUDANCAS.taxa).toBe(t.TAXA_DAS_MUDANCAS);
    expect(t.TAXA_DAS_MUDANCAS_EM_FRASE).toContain(t.TAXA_DAS_MUDANCAS_EM_PONTOS);
    expect(t.TAXA_DAS_MUDANCAS_EM_PONTOS).toBe(`${String(Math.round(t.TAXA_DAS_MUDANCAS * 10000) / 100).replace(".", ",")} %`);
    expect(t.TAXA_DAS_MUDANCAS_EM_FRASE).toContain("só sobre as horas e os km");
    expect(t.TAXA_DAS_MUDANCAS_EM_FRASE).toContain("o material que fornecer não leva taxa");
    // Um sítio só: em src/, mais ninguém lhe dá um valor.
    const quemADefine = FONTES.filter((f) => f.startsWith("src/") && !f.endsWith(".test.ts")).filter((f) =>
      /\bTAXA_DAS_MUDANCAS\s*(?::[^=]+)?=\s*[\d.]/.test(readFileSync(join(RAIZ, f), "utf8")),
    );
    expect(quemADefine).toEqual(["src/lib/taxas-plataforma.ts"]);
    // A ajuda (com e sem a taxa das Configs) e o «Como funciona».
    const taxas = { cliente: 0, profissional: t.TAXA_TOTAL };
    const quantoLeva = (lista: Array<{ pergunta: string; resposta: string }>) => lista.find((p) => p.pergunta === "Quanto é que a CLYON leva?")?.resposta;
    expect(quantoLeva(perguntasDoProfissional(taxas))).toContain(t.TAXA_DAS_MUDANCAS_EM_FRASE);
    // A lista que a app CLYON Pro traz consigo diz a regra sem o número (como a taxa das negociações).
    expect(quantoLeva(PERGUNTAS_DO_PROFISSIONAL)).toContain(t.TAXA_DAS_MUDANCAS_SEM_NUMERO);
    expect(t.TAXA_DAS_MUDANCAS_SEM_NUMERO).not.toMatch(/\d\s?%/);
    expect(t.TAXA_DAS_MUDANCAS_SEM_NUMERO).toContain("só sobre as horas e os km");
    expect(comissaoEmPalavras(taxas, "iva_incluido").nasMudancas).toBe(t.TAXA_DAS_MUDANCAS_EM_FRASE);
    for (const f of ["src/app/profissionais/page.tsx", "src/app/quero-ser-parceiro/page.tsx"]) {
      expect(readFileSync(join(RAIZ, f), "utf8"), f).toContain("{exemplo.nasMudancas}");
    }
  });

  it("a tabela das páginas: com parceiros, os exemplos da lista; a de referência só com a lista vazia", () => {
    const t = readFileSync(join(RAIZ, "src/components/mudancas/TabelaDasMudancas.tsx"), "utf8").replace(/\s+/g, " ");
    expect(t).toContain('{!compacta && preco.tipo !== "parceiros" && ( <> <h3 className="mt-6 text-sm font-semibold text-slate-900">A tabela de referência</h3>');
    expect(t).toContain("Pela lista de hoje, por tipologia");
    expect(t).toContain("preco.desde3 && (");
    expect(readFileSync(join(RAIZ, "src/app/mudancas/[cidade]/page.tsx"), "utf8")).toContain("{precoDaMudancaEmDetalhe(preco)}");
  });
});
