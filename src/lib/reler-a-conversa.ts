import {
  fundirCampos,
  primeiroPassoEmFalta,
  perguntaDo,
  resumo,
  codigoPostalELocalidade,
  temPalavraDeRua,
  type DadosDaRecolha,
  type PassoDaRecolha,
} from "./whatsapp-recolha";
import type { CamposCrus } from "./whatsapp-compreensao";

/**
 * RELER A CONVERSA — continuar de onde parámos, em vez de perguntar tudo outra vez.
 *
 * "Quando clico em Recomeçar conversa ele devia ler as mensagens anteriores
 * para recomeçar de onde parámos." — 10-09-2026.
 *
 * O «Recomeçar do zero» apaga a linha da recolha e o assistente volta ao
 * princípio: pergunta o serviço a quem já o disse. Isto faz o contrário — lê o
 * fio que está guardado, reconstrói o que o cliente já respondeu, e pergunta
 * só o que falta.
 *
 * ESTE FICHEIRO É PURO. Recebe mensagens e campos, devolve dados e frases —
 * sem base, sem rede, sem Gemini. Quem lê o fio da base e quem chama o modelo
 * é a rota; é assim que se testa uma releitura inteira sem WhatsApp nenhum.
 *
 * AS TRÊS COISAS QUE ISTO TEM DE ACERTAR, e que não são óbvias:
 *
 *   1. O TEMPO. `interpretarQuando` lê «sexta de manhã» em relação a um
 *      instante, e o contrato dela é «este texto foi escrito AGORA». Num fio
 *      escrito ao longo de semanas isso é falso: um «sexta de manhã» de há
 *      três semanas, lido contra hoje, marca a sexta desta semana e o trabalho
 *      nasce no dia errado, sem ninguém dar por isso. Passa-se-lhe o instante
 *      REAL da última mensagem do cliente, e uma data que já passou é deitada
 *      fora — o passo volta a ficar em falta e o assistente pergunta.
 *
 *   2. ONDE COMEÇA A CONVERSA. `whatsappMensagens` é uma corda contínua por
 *      número: nada separa o pedido de Março do de Setembro. Sem corte, a
 *      releitura ressuscita a morada de um pedido já fechado. Corta-se na
 *      última vez que o assistente disse «Pedido #N registado.» — e, à falta
 *      dela, pela idade.
 *
 *   3. A INTENÇÃO NÃO VIAJA. O que se lê do fio são CAMPOS, nunca intenções.
 *      Um «sim» de há três dias não regista um pedido, um «quero falar com uma
 *      pessoa» de há uma semana não entrega a conversa outra vez, e um
 *      «recomeçar» dito a meio não apaga o que ele disse a seguir.
 */

export type MensagemDoFio = { direccao: string; texto: string; criadoEm: string };

/**
 * A marca de que um pedido nasceu — o fim de uma conversa e o princípio da
 * seguinte. Tem de casar com `mensagemDePedidoRegistado`; há um teste que
 * corre esta expressão contra ela, para o dia em que alguém reescrever a frase.
 */
export const MARCA_DE_PEDIDO_REGISTADO = /^Pedido #\d+ registado\./;

/** Mais velho do que isto não é a conversa de agora. A tabela guarda 60 dias. */
export const DIAS_DE_FIO = 30;
/** Passado isto, um «amanhã» já não quer dizer nada. */
export const HORAS_ATE_O_QUANDO_ENVELHECER = 48;

const MAX_LINHAS = 60;
const MAX_POR_LINHA = 600;
const MAX_GUIAO = 12_000;

const instante = (iso: string): number => {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
};

/**
 * O pedaço do fio que interessa reler.
 *
 * Corta no último «Pedido #N registado.» que o assistente enviou — o que veio
 * antes pertence a um pedido que já foi. À falta dessa marca, corta pela
 * idade. E limita-se o tamanho: um cliente que cole três parágrafos não pode
 * fazer estourar a chamada.
 */
export function fioParaLeitura(
  mensagens: MensagemDoFio[],
  agora: Date = new Date(),
): MensagemDoFio[] {
  let inicio = 0;
  for (let i = mensagens.length - 1; i >= 0; i -= 1) {
    const m = mensagens[i];
    if (m.direccao === "out" && MARCA_DE_PEDIDO_REGISTADO.test(m.texto.trim())) {
      inicio = i + 1;
      break;
    }
  }
  const limiteDeIdade = agora.getTime() - DIAS_DE_FIO * 86_400_000;
  const recentes = mensagens
    .slice(inicio)
    .filter((m) => instante(m.criadoEm) >= limiteDeIdade)
    .map((m) => ({ ...m, texto: m.texto.slice(0, MAX_POR_LINHA) }));
  // A cauda, e não a cabeça: o fim da conversa é onde estão as correcções.
  return recentes.slice(-MAX_LINHAS);
}

/** O instante em que o cliente falou pela última vez, ou null se nunca falou. */
export function quandoOClienteFalouPelaUltimaVez(fio: MensagemDoFio[]): Date | null {
  for (let i = fio.length - 1; i >= 0; i -= 1) {
    if (fio[i].direccao === "in") {
      const d = new Date(fio[i].criadoEm);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

/**
 * O guião que vai ao modelo — as DUAS vozes, e a data em cada linha.
 *
 * As perguntas do assistente são o que dá sentido às respostas curtas: um
 * «sim» sozinho não quer dizer nada, ao lado de «Há elevador no prédio?»
 * quer dizer tudo. E a data por linha é o que deixa ver que o «amanhã» dele
 * foi escrito na semana passada.
 */
export function guiaoDoFio(fio: MensagemDoFio[]): string {
  const linhas = fio.map((m) => {
    const d = new Date(m.criadoEm);
    const dia = Number.isNaN(d.getTime())
      ? "--/--"
      : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    const quem = m.direccao === "out" ? "CLYON" : "CLIENTE";
    return `[${dia}] ${quem}: ${m.texto.replace(/\s+/g, " ").trim()}`;
  });
  const guiao = linhas.join("\n");
  return guiao.length > MAX_GUIAO ? guiao.slice(-MAX_GUIAO) : guiao;
}

/** Os campos que a releitura acrescentou ou mudou, para o relatório. */
export function camposRecuperados(
  antes: DadosDaRecolha,
  depois: DadosDaRecolha,
): string[] {
  const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)]);
  const mudou: string[] = [];
  for (const c of chaves) {
    const a = (antes as Record<string, unknown>)[c];
    const b = (depois as Record<string, unknown>)[c];
    if (b != null && b !== "" && JSON.stringify(a) !== JSON.stringify(b)) mudou.push(c);
  }
  return mudou.sort();
}

export type Releitura = {
  dados: DadosDaRecolha;
  passo: PassoDaRecolha;
  /** Os campos que a releitura trouxe de novo. Vazio = não valeu a pena. */
  recuperados: string[];
  /** A mensagem a enviar ao cliente — já sem segunda saudação. */
  mensagem: string;
  /** Está tudo respondido: o que falta é o SIM do resumo. */
  completo: boolean;
};

/**
 * O que a releitura conclui, a partir do que já estava gravado e do que o
 * modelo percebeu no fio.
 *
 * NUNCA MAIS POBRE DO QUE O QUE LÁ ESTAVA. `fundirCampos` parte do gravado e
 * só acrescenta, por isso um fio truncado, uma falha do modelo ou um campo que
 * ele não percebeu não podem apagar dez campos e escrever quatro.
 */
export function releituraDoFio({
  gravado,
  campos,
  fio,
  agora = new Date(),
}: {
  gravado: DadosDaRecolha;
  campos: CamposCrus;
  fio: MensagemDoFio[];
  agora?: Date;
}): Releitura {
  const ultimaDoCliente = quandoOClienteFalouPelaUltimaVez(fio);

  /*
   * O «quando» envelhece, e o guarda é em CÓDIGO e não uma regra no aviso ao
   * modelo — uma regra num aviso falha exactamente no dia em que for
   * conveniente falhar. Passadas 48 horas sobre a última palavra do cliente,
   * um «amanhã» não quer dizer nada e não se aproveita.
   */
  const velho =
    ultimaDoCliente == null ||
    agora.getTime() - ultimaDoCliente.getTime() > HORAS_ATE_O_QUANDO_ENVELHECER * 3600_000;
  const aproveitaveis: CamposCrus = { ...campos };
  if (velho) delete aproveitaveis.quando;

  // O instante REAL da frase, que é o que `interpretarQuando` contratou.
  const dados = fundirCampos(gravado, aproveitaveis, ultimaDoCliente ?? agora);

  /*
   * E, mesmo dentro das 48 horas, uma data que já passou não se guarda: o
   * cliente disse «sexta» na sexta passada. Limpar os três põe o passo
   * «quando» outra vez em falta — `respondido` olha para o `quandoTexto` — e
   * o assistente pergunta, que é a resposta certa.
   */
  if (dados.dataDesejada != null && instante(dados.dataDesejada) < agora.getTime()) {
    dados.dataDesejada = null;
    dados.quandoTexto = null;
    dados.urgency = null;
  }

  const recuperados = camposRecuperados(gravado, dados);
  const passo = primeiroPassoEmFalta(dados);
  const completo = passo === "confirmar";

  return {
    dados,
    passo,
    recuperados,
    completo,
    mensagem: mensagemDaReleitura(dados, passo, recuperados),
  };
}

/** O que já se sabe, em meia dúzia de palavras, para ele não repetir nada. */
function oQueJaSeSabe(d: DadosDaRecolha): string[] {
  return [
    d.serviceType ? etiqueta(d.serviceType) : null,
    d.contactName ?? null,
    [d.address, d.city].filter(Boolean).join(", ") || null,
    d.floor != null ? `andar ${d.floor === "0" ? "r/c" : d.floor}` : null,
    d.quandoTexto ?? null,
  ].filter((x): x is string => Boolean(x));
}

function etiqueta(id: string): string {
  return id.replace(/_/g, " ");
}

/**
 * A frase da retoma.
 *
 * NUNCA `perguntaDo("servico")` à seca: essa abre com «Bom dia! Aqui é a
 * CLYON», e uma segunda saudação a meio de uma conversa é o defeito que o
 * ramo do «recomeçar» já existia para evitar. Diz-se o que se sabe, e
 * pergunta-se só o que falta.
 */
export function mensagemDaReleitura(
  dados: DadosDaRecolha,
  passo: PassoDaRecolha,
  recuperados: string[],
): string {
  if (passo === "confirmar") return resumo(dados);

  const sabido = oQueJaSeSabe(dados);
  const abertura =
    recuperados.length > 0 && sabido.length > 0
      ? `Já reli a nossa conversa — ${sabido.join(" · ")}. Não precisa de repetir nada.`
      : "Vamos continuar de onde ficámos.";

  return `${abertura}\n\n${perguntaDo(passo, dados, false)}`;
}

/* ──────────────────────────────────────────────────────────────────────────
 * A RELEITURA SEM MODELO NENHUM.
 *
 * "Ele releu e veio com a pergunta mais feia possível — o endereço está enorme
 * à frente dele, como é que ele não leu?" — 14-09-2026, sobre isto:
 *
 *   CLIENTE: Rua Francisco Andrade Alapraia Sao Joao do estoril   10:42
 *   CLIENTE: Codigo postal 2765-094                               10:43
 *   ...
 *   CLYON:   Qual é a morada? Rua e número — é por aí que o
 *            profissional se orienta.
 *
 * Com o Gemini sem quota, a releitura não lia NADA e o botão limitava-se a
 * repetir a pergunta do passo onde a conversa tinha ficado. Era honesto e era
 * estúpido: um código postal são quatro dígitos e três, e uma morada começa
 * por «Rua». Nada disto precisa de um modelo de linguagem.
 *
 * É O DEGRAU ABAIXO, e não um substituto. O Gemini lê «é no 3º sem elevador,
 * em Cascais, sexta de manhã» — isto lê o que tem forma própria: a morada, o
 * código postal e o nome quando ele o apresenta. O resto continua a ser
 * perguntado, que é melhor do que ser adivinhado.
 *
 * NA DÚVIDA NÃO SE LÊ. Um campo inventado é muito pior do que um campo a
 * menos: quem o vir no resumo assume que foi o cliente que o disse.
 * ────────────────────────────────────────────────────────────────────────── */

/** «Está a falar com Ana Almeida», «sou o João», «chamo-me Maria». */
const DIZ_O_NOME =
  /(?:falar\s+com|fala\s+com|sou\s+(?:o|a)|chamo-me|meu\s+nome\s+e|meu\s+nome\s+é|aqui\s+(?:e|é)\s+(?:o|a))\s+([A-Za-zÀ-ú][A-Za-zÀ-ú'’-]*(?:\s+[A-Za-zÀ-ú][A-Za-zÀ-ú'’-]*){0,2})/i;

/**
 * O que se consegue ler do fio sem perguntar a ninguém.
 *
 * Lê-se de trás para a frente: a última vez que ele disse a morada é a que
 * vale, porque as pessoas corrigem-se.
 */
export function camposDoFioSemModelo(
  fio: MensagemDoFio[],
  jaSabido: DadosDaRecolha,
): CamposCrus {
  const campos: CamposCrus = {};
  const dele = fio.filter((m) => m.direccao === "in" && m.texto.trim());

  for (let i = dele.length - 1; i >= 0; i -= 1) {
    const t = dele[i].texto.trim();

    /*
     * O CÓDIGO POSTAL É O MAIS SEGURO DE TODOS: quatro dígitos e três não se
     * confundem com mais nada numa conversa destas.
     */
    if (!campos.codigoPostal && !jaSabido.postalCode) {
      const { postalCode } = codigoPostalELocalidade(t);
      if (postalCode) campos.codigoPostal = t.slice(0, 200);
    }

    /*
     * A MORADA, pela mesma regra do passo da morada — e nunca a linha que é só
     * o código postal, que já foi lida acima.
     */
    if (!campos.morada && !jaSabido.address && temPalavraDeRua(t)) {
      const soCodigoPostal = /^\s*(?:codigo\s+postal\s*:?\s*)?\d{4}\s*-?\s*\d{3}\b/i.test(t);
      if (!soCodigoPostal) campos.morada = t.slice(0, 300);
    }

    if (!campos.nome && !jaSabido.contactName) {
      const m = t.match(DIZ_O_NOME);
      if (m) campos.nome = m[1].trim().slice(0, 120);
    }
  }

  return campos;
}
