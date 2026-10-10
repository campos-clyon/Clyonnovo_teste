/**
 * O LEITOR DA RECOLHA — o que se percebe de uma frase sem modelo nenhum.
 *
 * *«Melhore nosso assistente para ele não cometer esses erros, treine-o para
 * situações diversas para ele ser mais inteligente e perfeito para as suas
 * tarefas.»* — 10-10-2026, com três conversas inteiras:
 *
 *   · o MARCO (10-10) desistiu a meio: «Obrigado, está muito complicado.
 *     Prefiro desistir.» O resumo dizia «Nome: Obrigado Marco» e «Andar: Sou
 *     o Marco», e perguntou-lhe o andar e o elevador de uma morada que dizia
 *     «R/C Esq.»;
 *   · o CRISTIANO (09-10) deu a morada, o andar e o sofá com as medidas na
 *     primeira mensagem, e foi-lhe perguntado tudo outra vez. No resumo:
 *     «Quando: Sim» e «Descrição: 2ª feira»;
 *   · o JOÃO (08-10) escreveu «vagar um apartamento em Moscavide num 4 andar
 *     sem elevador. É um T2 pequeno. Cumprimentos, João Rodrigues» e ouviu
 *     «Diga-me o que precisa», «Não percebi o serviço», «Com quem estou a
 *     falar?» e «Em que andar é?».
 *
 * Nas três respondeu o caminho SEM Gemini — as regras escritas à mão. São
 * elas que respondem quando o modelo falha, e foi o que aconteceu nos três
 * dias. Este ficheiro é a parte delas que lê frases: o nome, o andar, a
 * desistência, a pergunta pelo preço, a data e as coisas para levar.
 *
 * Cada função foi «treinada» com as frases verdadeiras destas conversas e das
 * anteriores — ver `leitor-da-recolha.test.ts`, que é o caderno de treino:
 * uma frase que o assistente leu mal entra lá, e fica lá para sempre.
 *
 * PURO e sem dependências do resto da recolha, para poder ser usado pelos
 * dois caminhos (com e sem modelo) sem ciclos de importação.
 */

export function semAcentos(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/* ──────────────────────────────────────────────────────────────────────────
 * O NOME
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Palavras que nunca são um nome — e que chegam à pergunta do nome.
 *
 * «Obrigado Marco» foi gravado como o nome dele, e «Já mandei as fotos» podia
 * ter sido. Um nome não tem verbos, nem cumprimentos, nem «sim».
 */
const NAO_SAO_NOME = new Set([
  "sim", "nao", "ok", "okay", "obrigado", "obrigada", "obg", "obrigadao", "bom", "boa", "dia",
  "tarde", "noite", "ola", "boas", "oi", "ja", "mandei", "enviei", "envio", "mando", "fotos",
  "foto", "fotografias", "fotografia", "rua", "avenida", "quero", "queria", "preciso", "tenho",
  "temos", "sou", "eu", "aqui", "esta", "esse", "essa", "isso", "isto", "certo", "claro", "pode",
  "ser", "hoje", "amanha", "urgente", "pressa", "nada", "tudo", "valor", "preco", "orcamento",
  "quanto", "custa", "morada", "andar", "elevador", "factura", "fatura", "nif", "cliente",
  "senhor", "senhora", "sr", "sra", "dona", "pessoa", "gostava", "gostaria", "favor", "por",
  "desculpe", "desisto", "desistir", "cancelar", "com", "sem", "para", "que", "como", "qual",
  "quem", "onde", "quando", "nao", "mais", "muito", "bem", "tambem", "ainda", "acima", "abaixo",
  "escrito", "disse", "falamos", "falei", "conforme", "estes", "estas", "esses", "essas", "os",
  "as", "um", "uma", "uns", "umas", "no", "na", "nos", "nas", "ao", "pelo", "pela", "entao",
  "depois", "agora", "sofa", "cama", "moveis", "movel", "mobilia", "entulho", "lixo", "casa",
  "apartamento", "prefiro", "vamos", "avancar", "fica", "outra", "oportunidade", "necessario",
  "preciso", "e", "o", "a", "de", "do", "da", "dos", "das", "clyon", "whatsapp", "bot",
  "assistente", "humano", "obrigados", "cumprimentos", "atenciosamente", "abraco", "beijinhos",
  "dono", "proprietario", "proprietaria", "inquilino", "inquilina", "filho", "filha", "marido",
  "mulher", "vizinho", "vizinha", "responsavel", "verdade", "favor", "contra", "mesmo", "mesma",
]);

/** As que ligam um nome a outro: «Maria de Fátima», «Ana e Rui». */
const LIGACOES = new Set(["de", "da", "do", "das", "dos", "e"]);

function maiuscula(palavra: string): string {
  if (LIGACOES.has(palavra.toLowerCase())) return palavra.toLowerCase();
  return palavra.charAt(0).toUpperCase() + palavra.slice(1);
}

/**
 * As palavras do princípio de `texto` que podem ser um nome — e pára na
 * primeira que não pode. «Ana Ferreira e aqui estão as fotos» → «Ana Ferreira».
 */
function nomeNoPrincipio(texto: string, exigeMaiuscula: boolean): string | null {
  const palavras = texto.trim().split(/\s+/);
  const ficam: string[] = [];
  for (const p of palavras) {
    const limpa = p.replace(/[.,;:!?)]+$/, "");
    if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.-]*$/.test(limpa)) break;
    const chave = semAcentos(limpa);
    if (!LIGACOES.has(chave)) {
      if (NAO_SAO_NOME.has(chave)) break;
      if (exigeMaiuscula && !/^[A-ZÀ-Ý]/.test(limpa)) break;
    }
    ficam.push(limpa);
    // Um nome acaba numa vírgula ou num ponto: «Marco, a morada é…».
    if (limpa !== p || ficam.length >= 5) break;
  }
  while (ficam.length > 0 && LIGACOES.has(semAcentos(ficam[ficam.length - 1]))) ficam.pop();
  if (ficam.length === 0) return null;
  if (ficam.every((p) => LIGACOES.has(semAcentos(p)))) return null;
  const nome = ficam.map(maiuscula).join(" ");
  return nome.length >= 2 && nome.length <= 60 ? nome : null;
}

/**
 * O NOME DE QUEM ESCREVE, quando ele o disse.
 *
 * Sem `emRespostaAoNome`, só se aceita o nome DITO como nome — «o meu nome é»,
 * «chamo-me», «sou o», ou a assinatura no fim («Cumprimentos, João
 * Rodrigues», «Obrigado Marco»). Uma palavra solta no meio de uma frase não é
 * um nome: «Anderson, conforme falamos…» é a quem ele está a escrever.
 *
 * Com `emRespostaAoNome` — a resposta a «Com quem estou a falar?» — aceita-se
 * também o nome sozinho («Cristiano», «joão rodrigues»), desde que nenhuma
 * palavra seja das que nunca são nome.
 */
export function nomeDoTexto(texto: string, emRespostaAoNome = false): string | null {
  const t = texto.trim();
  if (!t) return null;

  // «O meu nome é Ana Ferreira», «chamo-me Ana», «sou o Marco», «aqui é a Ana».
  const dito = t.match(
    /\b(?:(?:o\s+)?meu\s+nome\s+(?:é|e)|chamo[\s-]me|(?:eu\s+)?sou\s+(?:o|a)|aqui\s+(?:é|e)\s+(?:o|a)|fala\s+(?:o|a)|quem\s+fala\s+(?:é|e)\s+(?:o|a))\s+([^\n,.;!?]{2,80})/i,
  );
  if (dito) {
    const n = nomeNoPrincipio(dito[1], false);
    if (n) return n;
  }

  // A assinatura, no FIM da mensagem: «Obrigado Marco», «Cumprimentos,\nJoão
  // Rodrigues». Sem a bandeira `i`: o nome da assinatura começa por maiúscula,
  // e é isso que separa «Obrigado Marco» de «Obrigado, está complicado».
  const assinatura = t.match(
    /(?:[Oo]brigad[oa]|[Cc]umprimentos|[Aa]tenciosamente|[Aa]tt\.?|[Aa]bra[çc]os?|[Bb]eijinhos|[Bb]js|[Gg]rat[oa])[\s,!.:-]*([A-ZÀ-Ý][^\n,.;!?]{1,60})[\s.!]*$/,
  );
  if (assinatura) {
    const n = nomeNoPrincipio(assinatura[1], true);
    // A assinatura tem de ser o nome todo até ao fim: «Obrigado. Não vamos
    // avançar» começa por maiúscula e não é nome nenhum.
    if (n && semAcentos(n) === semAcentos(assinatura[1].trim().replace(/[.!]+$/, ""))) return n;
  }

  if (!emRespostaAoNome) return null;

  // O nome sozinho, a responder à pergunta do nome.
  const sozinho = t.replace(/^(?:ol[aá]|bom dia|boa tarde|boa noite|boas)[\s,!.]*/i, "").trim();
  if (!sozinho || /\d/.test(sozinho) || sozinho.split(/\s+/).length > 5) return null;
  const n = nomeNoPrincipio(sozinho, false);
  if (!n) return null;
  // Tem de ser a frase toda: «Cristiano» sim, «Cristiano já mandei» não.
  const resto = semAcentos(sozinho.replace(/[.!]+$/, ""));
  return semAcentos(n) === resto ? n : null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * O ANDAR — tantas vezes escrito DENTRO da morada
 * ────────────────────────────────────────────────────────────────────────── */

const ANDAR_POR_EXTENSO: Record<string, string> = {
  primeiro: "1", segundo: "2", terceiro: "3", quarto: "4", quinto: "5",
  sexto: "6", setimo: "7", oitavo: "8", nono: "9", decimo: "10",
};

/**
 * O ANDAR, QUANDO A FRASE O DIZ — e só quando o diz.
 *
 *   «Travessa João Alves, 7, R/C Esq.»          → "0"
 *   «Rua Rodrigues de Freitas, N18, 1°esq.»     → "1"
 *   «Rua João Gomes patacão 7 -4dto Moscavide»  → "4"
 *   «vagar um apartamento num 4 andar»          → "4"
 *
 * Nas três conversas de 10-10-2026 o andar estava escrito e foi perguntado. O
 * número da porta nunca conta: «N18», «7» e «nº 26» não têm o sinal de andar
 * (º, °, «andar», esq, dto) colado a eles.
 *
 * `null` quando não há andar nenhum na frase — e aí a pergunta faz-se.
 */
export function andarNaFrase(texto: string): string | null {
  // «2ª feira» e «4f» são dias da semana, e não o 2º andar.
  const t = semAcentos(texto).replace(/(?<![\d])[2-6]\s*[ªa]?\s*-?\s*f(eira)?\b/g, " ");
  if (/(?:^|[^a-z])(r\/c|r\.c\.?|res[\s-]+do[\s-]+chao|rc)(?![a-z])/.test(t)) return "0";
  if (/\bcave\b/.test(t)) return "-1";
  const comAndar = t.match(/(?<!\d)(\d{1,2})\s*(?:\.?\s*[º°ª]|o\b)?\s*andar\b/);
  if (comAndar) return String(Number(comAndar[1]));
  const andarPrimeiro = t.match(/\bandar\s*(?:n\.?\s*[º°]?\s*)?(\d{1,2})\b/);
  if (andarPrimeiro) return String(Number(andarPrimeiro[1]));
  const comSinal = t.match(/(?<![\d\w])(\d{1,2})\s*\.?\s*[º°ª]/);
  if (comSinal) return String(Number(comSinal[1]));
  const comLado = t.match(
    /(?<![\d\w])-?\s*(\d{1,2})\s*-?\s*(?:esq|esqo|esquerdo|dto|dt|dta|dir|direito|frt|fte|frente)\b/,
  );
  if (comLado) return String(Number(comLado[1]));
  const extenso = t.match(/\b(primeiro|segundo|terceiro|quarto|quinto|sexto|setimo|oitavo|nono|decimo)\s+andar\b/);
  if (extenso) return ANDAR_POR_EXTENSO[extenso[1]];
  return null;
}

/**
 * A RESPOSTA À PERGUNTA DO ANDAR — o que se aceita como andar.
 *
 * Mais largo do que `andarNaFrase` porque a pergunta acabou de ser feita: um
 * «4» sozinho, «terceiro», «moradia» são andares. Mais estreito do que o
 * `andarDoTexto` de sempre, que guardava QUALQUER frase: «Sou o Marco» foi o
 * andar do Marco no resumo.
 */
export function andarDaResposta(texto: string): string | null {
  const naFrase = andarNaFrase(texto);
  if (naFrase != null) return naFrase;
  const t = semAcentos(texto).replace(/[.!º°ª]+/g, "").trim();
  if (/^(o\s+|no\s+|ao\s+|e\s+o\s+|e\s+no\s+)?\d{1,2}$/.test(t)) return String(Number(t.match(/\d{1,2}/)![0]));
  if (/^(o\s+|no\s+)?(terreo|piso\s*0|zero|loja)$/.test(t)) return "0";
  if (/\b(moradia|vivenda|casa\s+terrea|terrea)\b/.test(t)) return "0";
  const extenso = t.match(/^(o\s+|no\s+)?(primeiro|segundo|terceiro|quarto|quinto|sexto|setimo|oitavo|nono|decimo)$/);
  if (extenso) return ANDAR_POR_EXTENSO[extenso[2]];
  return null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * A DESISTÊNCIA E A PERGUNTA PELO PREÇO
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * ELE ESTÁ A DESISTIR — e não a responder.
 *
 *   «Obrigado, está muito complicado. Prefiro desistir.»   — o Marco
 *   «Obrigado, fica para outra oportunidade.»              — o Marco
 *   «Ok. Obrigado. Não vamos avançar.»                     — o Cristiano
 *
 * O Marco levou de volta «Para registar responda SIM». A desistência só era
 * reconhecida com UMA palavra sozinha («cancelar», «esquece»).
 *
 * ⚠️ Nada aqui pode apanhar a resposta a uma pergunta: «não preciso» é o «não»
 * da factura, e «não é necessário» o do elevador. Por isso «já não preciso» só
 * conta a fechar a frase, e as perguntas de sim ou não são lidas ANTES disto.
 */
export function desisteDoPedido(texto: string): boolean {
  const t = semAcentos(texto);
  return [
    /\b(prefiro|vou|quero|vamos)\s+desistir\b/,
    /\bdesisto\b/,
    /\bdesistir\s+do\s+(pedido|servico)\b/,
    /\bnao\s+(vamos|vou|quero|iremos)\s+(avancar|continuar|seguir|prosseguir)\b/,
    // «Fica para outra oportunidade» — e não «fica para a próxima semana», que é uma data.
    /\bfica\s+para\s+(outra|uma\s+proxima|a\s+proxima)\s+(oportunidade|altura|vez|ocasiao)\b/,
    /\bfica\s+para\s+(outra|a\s+proxima)\s*[.!]*$/,
    /\b(esta|e|isto e|isso e)\s+(muito|demasiado|tao|bastante)\s+(complicado|confuso|demorado)\b/,
    /\bja\s+nao\s+(preciso|quero|e\s+preciso|e\s+necessario|me\s+interessa)\s*(,?\s*obrigad\w*)?\s*[.!]*$/,
    /\bnao\s+estou\s+interessad[oa]\b/,
    /\b(cancele|cancelem|cancela|anule|anulem)\s+(o\s+)?(pedido|servico)\b/,
    /\bja\s+(resolvi|tratei|arranjei|encontrei)\b/,
    /\bnao\s+(quero|preciso)\s+mais\b/,
  ].some((r) => r.test(t));
}

/**
 * PERGUNTOU QUANTO CUSTA.
 *
 *   «Primeiro quero saber o valor do orçamento»   — o Cristiano, no resumo
 *   «Sim, pode colocar nif. Mas quero orçamento»  — o Cristiano, na factura
 *   «Aguardo orçamento para decidir»              — o Cristiano, já registado
 *
 * Levou «Para registar responda SIM» — uma ordem a quem fez uma pergunta.
 *
 * NÃO conta o pedido de orçamento da primeira mensagem («Gostava de pedir um
 * orçamento», «Quero pedir valores para…»): esse é o princípio da conversa,
 * e a conversa responde-lhe.
 */
export function perguntaPeloPreco(texto: string): boolean {
  const t = semAcentos(texto);
  return [
    /\bquanto\s+(e\s+que\s+)?(custa|custaria|fica|ficaria|e\b|sai|cobram|cobra|levam|leva|vai\s+(custar|ficar|ser)|seria)/,
    /\bqual\s+(e\s+)?(o\s+)?(valor|preco|custo|orcamento)\b/,
    /\b(quero|queria|gostava\s+de|preciso\s+de)\s+(saber\s+)?(o\s+|um\s+)?(valor|preco|orcamento|custo)\b/,
    /\b(primeiro|antes)\s+(quero|queria|preciso\s+de|gostava\s+de)\s+saber\b/,
    /\bvalor\s+(do|para\s+o)\s+(orcamento|servico|trabalho)\b/,
    /\b(e\s+)?(o|qual\s+o)\s+(valor|preco)\s*\?/,
    /\bvlr\b/,
    /\b(aguardo|espero|fico\s+a\s+aguardar)\s+(o\s+|pelo\s+)?(orcamento|valor|preco)\b/,
    /\bmas\s+quero\s+(o\s+|um\s+)?orcamento\b/,
    /\b(tem|ha|existe)\s+(um\s+)?(preco|valor)\s+(fixo|base|indicativo)\b/,
  ].some((r) => r.test(t));
}

/* ──────────────────────────────────────────────────────────────────────────
 * AS FOTOGRAFIAS, A DATA E AS COISAS PARA LEVAR
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * «JÁ MANDEI AS FOTOS» — a descrição está nas fotografias.
 *
 * O Marco mandou dezoito fotografias antes de qualquer pergunta, e à pergunta
 * «Conte-me o que há para levar» respondeu isto. Ficou a ser a descrição dele,
 * à letra.
 */
export function remeteParaAsFotos(texto: string): boolean {
  const t = semAcentos(texto);
  return (
    /\b(ja\s+)?(mandei|enviei|envio|mando|vai|vao|segue|seguem|esta|estao|tem|veja|ve|ver|nas|pelas)\b[^.!?\n]{0,25}\b(fotos?|fotografias?|imagens?)\b/.test(t) ||
    /^(as\s+)?(fotos?|fotografias?|imagens?)(\s+acima|\s+que\s+mandei|\s+que\s+enviei)?[.!]*$/.test(t) ||
    /\b(esta|e)\s+(tudo\s+)?(o\s+que\s+(esta|aparece)\s+)?nas\s+(fotos|fotografias|imagens)\b/.test(t)
  );
}

/** A descrição de quem já mandou as fotografias. */
export const DESCRICAO_DAS_FOTOS = "Ver as fotografias enviadas pelo cliente.";

const MESES = "janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";

/**
 * Isto fala de QUANDO — um dia, uma semana, uma pressa.
 *
 * «2ª feira» chegou à pergunta da descrição e ficou a ser a descrição do
 * Cristiano. Ao contrário, um «Sim» chegou à pergunta da data e ficou a ser a
 * data dele.
 *
 * ⚠️ «Bom dia» e «Boa tarde» não são datas, e «Marco» não é «março».
 */
export function pareceQuando(texto: string): boolean {
  const t = semAcentos(texto);
  return (
    /\b(hoje|amanha|depois de amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|feira|fim de semana|semana|mes|urgen\w*|pressa|breve|rapido|quanto antes|flexivel|qualquer (dia|altura))\b/.test(t) ||
    /\bquando\s+(der|puder|quiser|for\s+possivel|lhe\s+der\s+jeito)\b/.test(t) ||
    /\b(de|pela|a|esta|durante\s+a|ao\s+fim\s+da|ao\s+final\s+da)\s+(manha|tarde|noite)\b/.test(t) ||
    /\b(\d+|uns|alguns|poucos|proximos)\s+dias\b/.test(t) ||
    /(?<![\d])[2-6]\s*[ªa]?\s*-?\s*f(eira)?\b/.test(t) ||
    /(?<![\d])\d{1,2}\s*[\/.-]\s*\d{1,2}(?![\d-])/.test(t) ||
    /(?<![\d])\d{1,2}\s*(h\b|h\d{2}|:\d{2})/.test(t) ||
    new RegExp(`\\b\\d{1,2}\\s+(de\\s+)?(${MESES})\\b|\\b(em|no inicio de|no fim de|meados de)\\s+(${MESES})\\b`).test(t)
  );
}

/**
 * Isto fala das COISAS para levar ou do trabalho a fazer.
 *
 * Serve para não confundir uma descrição com outra resposta — «O sofa, a
 * caixa que acompanha a chaise e dois bancos» chegou à pergunta da factura —
 * e para tirar a descrição de uma primeira mensagem comprida.
 */
export function falaDeCoisas(texto: string): boolean {
  const t = semAcentos(texto);
  return (
    /\b(sofas?|chaise|camas?|colchao|colchoes|armarios?|roupeiros?|guarda-?roupas?|mesas?|cadeiras?|bancos?|estantes?|comodas?|aparadores?|cristaleiras?|moveis|movel|mobiliario|mobilia|frigorificos?|maquinas?|fogao|fogoes|televis\w*|tv|caixas?|sacos?|entulho|electrodomestic\w*|eletrodomestic\w*|estrados?|secretarias?|sapateiras?|louceiros?|vitrines?|piano|tapetes?|quadros?|espelhos?|recheio|tralha|lixo|monos|big\s?bags?|caliça|calica|pecas|volumes|cadeirao|cadeiroes|poltronas?|berco|beliche|escrivaninha|movel-bar)\b/.test(t) ||
    /\b(apartamento|casa|moradia|garagem|arrecadacao|sotao|quintal|escritorio|loja)\b.*\b(vagar|esvaziar|despejar|limpar|retirar|tirar)\b|\b(vagar|esvaziar|despejar|limpar|retirar|tirar)\b.*\b(apartamento|casa|moradia|garagem|arrecadacao|sotao|quintal|escritorio|loja)\b/.test(t) ||
    /\bt[0-6]\b/.test(t) ||
    /\d+[.,]?\d*\s*(m|cm|mt|mts|metros)\b/.test(t)
  );
}

/**
 * Isto fala do ACESSO — estacionar, parar, os lugares, o elevador, as escadas.
 *
 * «Depende de como estiver no momento os lugares» chegou à pergunta da data,
 * porque o Cristiano ainda estava a responder à do estacionamento. Uma frase
 * destas, fora do passo dela, é conversa sobre o acesso — não a data.
 */
export function falaDoAcesso(texto: string): boolean {
  const t = semAcentos(texto);
  return /\b(estaciona\w*|parar|parque|lugar(es)?|carrinha|carro|elevador|escadas?|degraus?|lances?|porta\s+do\s+predio|rua\s+(chata|estreita|apertada|dificil))\b/.test(
    t,
  );
}
