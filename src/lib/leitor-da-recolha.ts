/**
 * O LEITOR DA RECOLHA — o que se percebe de uma frase sem modelo nenhum.
 *
 * *«Melhore nosso assistente para ele não cometer esses erros, treine-o para
 * situações diversas para ele ser mais inteligente e perfeito para as suas
 * tarefas.»* — 10-10-2026, com três conversas inteiras:
 *
 *   · o BENTO (10-10) desistiu a meio: «Obrigado, está muito complicado.
 *     Prefiro desistir.» O resumo dizia «Nome: Obrigado Bento» e «Andar: Sou
 *     o Bento», e perguntou-lhe o andar e o elevador de uma morada que dizia
 *     «R/C Esq.»;
 *   · o EMILIANO (09-10) deu a morada, o andar e o sofá com as medidas na
 *     primeira mensagem, e foi-lhe perguntado tudo outra vez. No resumo:
 *     «Quando: Sim» e «Descrição: 2ª feira»;
 *   · o SIMÃO (08-10) escreveu «vagar um apartamento em Moscavide num 4 andar
 *     sem elevador. É um T2 pequeno. Cumprimentos, Simão Fragoso» e ouviu
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
 * «Obrigado Bento» foi gravado como o nome dele, e «Já mandei as fotos» podia
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
 * primeira que não pode. «Rute Valadas e aqui estão as fotos» → «Rute Valadas».
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
    // Um nome acaba numa vírgula ou num ponto: «Bento, a morada é…».
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
 * «chamo-me», «sou o», ou a assinatura no fim («Cumprimentos, Simão
 * Fragoso», «Obrigado Bento»). Uma palavra solta no meio de uma frase não é
 * um nome: «Edson, conforme falamos…» é a quem ele está a escrever.
 *
 * Com `emRespostaAoNome` — a resposta a «Com quem estou a falar?» — aceita-se
 * também o nome sozinho («Emiliano», «simão fragoso»), desde que nenhuma
 * palavra seja das que nunca são nome.
 */
export function nomeDoTexto(texto: string, emRespostaAoNome = false): string | null {
  const t = texto.trim();
  if (!t) return null;

  // «O meu nome é Rute Valadas», «chamo-me Ana», «sou o Bento», «aqui é a Ana».
  // E nas línguas dos clientes de fora — «my name is Hannah» (14-10-2026),
  // «me llamo», «je m'appelle».
  const dito = t.match(
    /\b(?:(?:o\s+)?meu\s+nome\s+(?:é|e)|chamo[\s-]me|(?:eu\s+)?sou\s+(?:o|a)|aqui\s+(?:é|e)\s+(?:o|a)|fala\s+(?:o|a)|quem\s+fala\s+(?:é|e)\s+(?:o|a)|my\s+name\s+is|me\s+llamo|mi\s+nombre\s+es|je\s+m['’]appelle|mon\s+nom\s+est)\s+([^\n,.;!?]{2,80})/i,
  );
  if (dito) {
    const n = nomeNoPrincipio(dito[1], false);
    if (n) return n;
  }

  // A assinatura, no FIM da mensagem: «Obrigado Bento», «Cumprimentos,\nSimão
  // Fragoso». Sem a bandeira `i`: o nome da assinatura começa por maiúscula,
  // e é isso que separa «Obrigado Bento» de «Obrigado, está complicado».
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

  /*
   * O NOME À FRENTE, E UMA FRASE A SEGUIR — 13-10-2026. «Abílio. Já contratei
   * vcs umas duas vezes», a responder à pergunta do nome. Só com a pontuação
   * (ou uma linha) a separar, e com maiúscula: «Emiliano já mandei» continua
   * a não ser um nome.
   */
  const aFrente = sozinho.match(/^([A-ZÀ-Ý][^\n,.;!?\d]{1,60})(?:[,.;!]\s+|\s*\n\s*)\S/);
  if (aFrente) {
    const n = nomeNoPrincipio(aFrente[1], false);
    if (n && semAcentos(n) === semAcentos(aFrente[1].trim())) return n;
  }

  if (!sozinho || /\d/.test(sozinho) || sozinho.split(/\s+/).length > 5) return null;
  const n = nomeNoPrincipio(sozinho, false);
  if (!n) return null;
  // Tem de ser a frase toda: «Emiliano» sim, «Emiliano já mandei» não.
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
 *   «Travessa Abel Correia, 9, R/C Esq.»        → "0"
 *   «Rua Tomás de Lemos, N24, 1°esq.»           → "1"
 *   «Rua Abel Faria 12 -4dto Moscavide»         → "4"
 *   «vagar um apartamento num 4 andar»          → "4"
 *
 * Nas três conversas de 10-10-2026 o andar estava escrito e foi perguntado. O
 * número da porta nunca conta: «N24», «9» e «nº 26» não têm o sinal de andar
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
  /*
   * «PÁTIO AO NÍVEL DO CHÃO» — 26-10-2026. É o rés-do-chão dito por outras
   * palavras. Por último: «3º andar, mas o pátio é ao nível da rua» é o 3º.
   */
  if (/\bao\s+nivel\s+d[oa]\s+(chao|rua|passeio)\b|\bpiso\s+terreo\b/.test(t)) return "0";
  return null;
}

/**
 * O LADO DA PORTA, quando vem colado ao andar — «R/C Esq», «2º Dto», «1°esq».
 * Desde 26-10-2026 a morada fica só com a rua e o número, e o lado vai com o
 * andar (`andarComLado`); sem isto, o «Esq» perdia-se com a morada.
 */
export function ladoNaFrase(texto: string): string | null {
  const t = semAcentos(texto);
  const LADO = "(esq(?:uerdo|o)?|dto|dta|dt|dir(?:eito)?|frt|fte|frente)";
  // Com o sinal do andar à frente («R/C Esq», «2º, Dto», «3 andar esq»), ou
  // o número colado ao lado («4dto», «1-esq»). «43, Esq» não: é a porta.
  const m =
    t.match(
      new RegExp(
        `(?:r\\/c|r\\.c\\.?|res[\\s-]+do[\\s-]+chao|(?<![a-z])rc|cave|\\d{1,2}\\s*\\.?\\s*[º°ª]\\s*(?:andar)?|\\d{1,2}\\s*o?\\s*andar)\\s*[,.-]?\\s*${LADO}\\b`,
      ),
    ) ?? t.match(new RegExp(`(?<![\\d\\w])-?\\s*\\d{1,2}\\s*-?\\s*${LADO}\\b`));
  if (!m) return null;
  const lado = m[1];
  if (lado.startsWith("esq")) return "Esq";
  if (/^(dto|dta|dt|dir)/.test(lado)) return "Dto";
  return "Frente";
}

/**
 * A RESPOSTA À PERGUNTA DO ANDAR — o que se aceita como andar.
 *
 * Mais largo do que `andarNaFrase` porque a pergunta acabou de ser feita: um
 * «4» sozinho, «terceiro», «moradia» são andares. Mais estreito do que o
 * `andarDoTexto` de sempre, que guardava QUALQUER frase: «Sou o Bento» foi o
 * andar do Bento no resumo.
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

/**
 * A MORADA E O QUE VEM DEPOIS DO ANDAR — quando é conversa sobre o acesso.
 *
 *   «Rua das Romãzeiras, 23, cave saída para rua a porta ja e na calcada Olivais.»
 *
 * — o Gaspar, 10-10-2026. Ficou tudo na morada, e o formulário do pedido
 * saiu com a frase inteira no campo da rua. O que vem depois do andar, quando
 * é uma frase (quatro palavras ou mais, a começar em minúscula), é o acesso:
 * sai da morada e vai para a descrição. «R/C Esq.» ou «2º Dto, Bloco B» ficam.
 */
export function separarAcessoDaMorada(morada: string): { morada: string; acesso: string | null } {
  const m = morada.match(
    /(?:^|[\s,])(r\/c|r\.c\.|r[eé]s[\s-]+do[\s-]+ch[aã]o|cave|\d{1,2}\s*\.?\s*[º°ª]\s*(?:andar)?|\d{1,2}\s*-?\s*(?:esq\w*|dto|dt|dir\w*|frente)|\d{1,2}\s*o?\s*andar)(?=[\s,.;]|$)/i,
  );
  if (!m || m.index == null) return { morada, acesso: null };
  const fim = m.index + m[0].length;
  const resto = morada.slice(fim).replace(/^[\s,.;:-]+/, "").replace(/[\s,.;]+$/, "");
  // O lado da porta a seguir ao andar («R/C Esq.», «2º Dto») é morada.
  const semLado = resto.replace(/^(esq\w*|dto|dt|dir\w*|frente|fte)\b[.,]?\s*/i, "");
  if (semLado.split(/\s+/).length < 4 || !/^[a-zà-ÿ]/.test(semLado)) return { morada, acesso: null };
  const ficaNaMorada = morada.slice(0, fim) + (resto !== semLado ? ` ${resto.slice(0, resto.length - semLado.length).trim()}` : "");
  return { morada: ficaNaMorada.replace(/[\s,.;]+$/, ""), acesso: semLado };
}

/**
 * «AMBOS», «AS DUAS», «OS DOIS» — a resposta vale para a origem E o destino.
 *
 *   «As duas moradas ficam a poucas ruas de distância e ambos os prédios têm elevador.»
 *   «A porta de ambos»
 *
 * — o Gaspar, numa mudança. O assistente só guardava a origem.
 */
export function valeParaAmbos(texto: string): boolean {
  return /\b(ambos|ambas|as duas|os dois|nas duas|nos dois|das duas|dos dois|em ambos|em ambas)\b/.test(semAcentos(texto));
}

/* ──────────────────────────────────────────────────────────────────────────
 * A DESISTÊNCIA E A PERGUNTA PELO PREÇO
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * ELE ESTÁ A DESISTIR — e não a responder.
 *
 *   «Obrigado, está muito complicado. Prefiro desistir.»   — o Bento
 *   «Obrigado, fica para outra oportunidade.»              — o Bento
 *   «Ok. Obrigado. Não vamos avançar.»                     — o Emiliano
 *
 * O Bento levou de volta «Para registar responda SIM». A desistência só era
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
 * NÃO DEU O NOME — DISSE QUE JÁ O TINHA DADO. 26-10-2026 (decisão d30).
 *
 *   CLYON:   Com quem tenho o gosto de falar?
 *   CLIENTE: Está a falar com a pessoa que pediu o orçamento!
 *   CLYON:   Peço desculpa, não apanhei bem. Com quem tenho o gosto de falar?
 *
 * Não é um nome mal escrito: é ele a dizer que já está tudo dito. Nunca se
 * repete a mesma pergunta — pergunta-se UMA vez de outra forma, e segue-se.
 */
export function fugiuAoNome(texto: string): boolean {
  const t = semAcentos(texto);
  return [
    /\b(a|com\s+a|e\s+a)\s+pessoa\s+que\s+(pediu|fez|enviou|mandou|preencheu|pedi)\b/,
    /\b(quem|o|a)\s+(que\s+)?(pediu|fez|enviou|preencheu)\s+(o\s+|este\s+)?(pedido|orcamento|formulario)\b/,
    /^(sou\s+eu|e\s+o\s+proprio|e\s+a\s+propria|o\s+proprio|a\s+propria|o\s+titular|a\s+titular|eu\s+mesm[oa])\b/,
    /^(eu\s+)?ja\s+(lhe\s+|vos\s+|o\s+)?(disse|dei|indiquei)\b/,
    /\b(ja\s+)?(lhe\s+|vos\s+)?(disse|dei|indiquei|enviei|mandei)\s+(o\s+(meu\s+)?nome|os\s+(meus\s+)?dados)\b/,
    /\bpara\s+que\s+(e\s+que\s+)?(quer|querem|precisa|precisam)\s+(de\s+)?(saber\s+)?o\s+(meu\s+)?nome\b/,
    /\bnao\s+(quero|preciso\s+de|vou)\s+dar\s+o\s+(meu\s+)?nome\b/,
  ].some((r) => r.test(t));
}

/**
 * JÁ FEZ O PEDIDO — «Consulte o pedido de orçamento. Está lá tudo. Fotos
 * também.» (26-10-2026). Quem diz isto tem um pedido, e a Vitória tem de o ir
 * buscar em vez de recomeçar — ver `pedido-aberto-na-conversa.ts`.
 *
 * ⚠️ «Gostava de pedir um orçamento» é o princípio de um pedido, e não isto;
 * nem «já pedi orçamento a outra empresa».
 */
export function jaFezOPedido(texto: string): boolean {
  const t = semAcentos(texto);
  return [
    /\b(consulte|consultem|veja|vejam|verifique|verifiquem|olhe|olhem|leia|leiam)\b[^.!?]{0,30}\b(pedido|formulario)\b/,
    /\b(consulte|consultem|verifique|verifiquem)\b[^.!?]{0,30}\borcamento\b/,
    /\bja\s+(fiz|tinha\s+feito|enviei|mandei|preenchi|registei|submeti)\s+(o\s+|um\s+|esse\s+)?(pedido|orcamento|formulario)\b/,
    /\b(fiz|enviei|preenchi|submeti|pedi)\b[^.!?]{0,30}\b(no|pelo|atraves\s+do)\s+(vosso\s+)?(site|simulador)\b/,
    /\besta\s+(la\s+)?tudo\s+(la|no\s+(pedido|site|formulario|orcamento))\b/,
    /\besta\s+la\s+tudo\b/,
    /\besta\s+(tudo\s+)?no\s+(meu\s+)?pedido\b/,
    /\bja\s+(tenho|tinha)\s+(um\s+|o\s+)?pedido\b/,
  ].some((r) => r.test(t));
}

/**
 * PERGUNTOU QUANTO CUSTA.
 *
 *   «Primeiro quero saber o valor do orçamento»   — o Emiliano, no resumo
 *   «Sim, pode colocar nif. Mas quero orçamento»  — o Emiliano, na factura
 *   «Aguardo orçamento para decidir»              — o Emiliano, já registado
 *
 * Levou «Para registar responda SIM» — uma ordem a quem fez uma pergunta.
 *
 * NÃO conta o pedido de orçamento da primeira mensagem («Gostava de pedir um
 * orçamento», «Quero pedir valores para…»): esse é o princípio da conversa,
 * e a conversa responde-lhe.
 */
export function perguntaPeloPreco(texto: string): boolean {
  const t = semAcentos(texto);
  if (perguntaDirectaPeloPreco(texto)) return true;
  return [
    // «Gostaria de saber o valor primeiro» — o Gaspar, 10-10-2026, à pergunta do NIF.
    /\b(gostaria|gostava|queria|quero|pretendo|preciso)\s+de\s+saber\s+(o\s+|qual\s+(e\s+)?o\s+)?(valor|preco|custo|orcamento)/,
    /\b(o\s+)?(valor|preco|orcamento)\s+(primeiro|antes)\b/,
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

/**
 * A PERGUNTA PELO PREÇO FEITA SEM RODEIOS — a que tem resposta logo na
 * primeira mensagem.
 *
 *   «Podem, por favor, indicar o preço total fechado, incluindo materiais de
 *   embalagem (...)? Agradeço também a confirmação de que o IVA está incluído.»
 *
 * — o Gaspar, 10-10-2026. A primeira mensagem não tinha resposta ao preço
 * de propósito («Gostaria de pedir um orçamento» é o pedido, não a pergunta),
 * e ele ficou sem ela. Esta é a pergunta feita — e responde-se já.
 */
export function perguntaDirectaPeloPreco(texto: string): boolean {
  const t = semAcentos(texto);
  return [
    /\bquanto\s+(e\s+que\s+)?(custa|custaria|fica|ficaria|sai|cobram|cobra|vai\s+(custar|ficar|ser))\b/,
    /\bqual\s+(e\s+)?(o\s+)?(valor|preco|custo)\b/,
    /\b(podem|pode|consegue|conseguem|poderiam|podiam)\s+(,?\s*por favor,?\s+)?(me\s+)?(indicar|dizer|enviar|dar|mandar|passar)\s+(o\s+|um\s+)?(preco|valor|custo)/,
    /\bpreco\s+(total|fechado|final)\b/,
    /\biva\b[^.?!]*\b(incluido|incluso)\b|\b(incluido|incluso)\b[^.?!]*\biva\b/,
    // «Valor?» numa linha sua — o Celso, 20-10-2026, a meio da primeira
    // mensagem, entre os 300 sacos e «Quando podem efectuar o trabalho».
    /(^|\n)\s*(e\s+)?(o\s+)?(valor|preco|custo|orcamento)\s*\?/,
  ].some((r) => r.test(t));
}

/** Fala do IVA — «a confirmação de que o IVA está incluído». */
export function falaDoIva(texto: string): boolean {
  return /\biva\b/.test(semAcentos(texto));
}

/* ──────────────────────────────────────────────────────────────────────────
 * AS FOTOGRAFIAS, A DATA E AS COISAS PARA LEVAR
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * «JÁ MANDEI AS FOTOS» — a descrição está nas fotografias.
 *
 * O Bento mandou dezoito fotografias antes de qualquer pergunta, e à pergunta
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

/**
 * O QUE PARECE UMA DATA E NÃO É — 20-10-2026.
 *
 * «Avenida das Tílias 52, Quinta Nova dos Arcos, 2770-917 Paço de
 * Arcos» foi lida como a data do trabalho, pela «quinta»; e «no seguimento da
 * nossa conversa telefónica do passado sábado» (o Celso) também, pelo
 * «sábado». Saem antes de se procurar a data: uma quinta com nome, uma rua
 * com data no nome («Rua 25 de Abril») e um dia que já passou.
 */
function semLugaresNemPassado(t: string): string {
  const DIAS = "segunda|terca|quarta|quinta|sexta|sabado|domingo";
  return t
    .replace(/\bquinta\s+(do|da|dos|das|sao|santa|santo|nova|velha|de\s+(?!manha|tarde|noite)\w+)\b/g, " ")
    .replace(
      new RegExp(
        `\\b(rua|avenida|av\\.?|travessa|largo|praca|praceta|estrada|calcada|alameda|bairro|urbanizacao)\\s+(do\\s+|da\\s+)?\\d{1,2}\\s+de\\s+(${MESES})\\b`,
        "g",
      ),
      " ",
    )
    .replace(new RegExp(`\\b(passad[oa]|ultim[oa])\\s+(${DIAS}|semana|mes|fim de semana)(-feira)?\\b`, "g"), " ")
    .replace(new RegExp(`\\b(${DIAS}|semana|mes|fim de semana)(-feira)?\\s+passad[oa]\\b`, "g"), " ");
}

/** A descrição de quem já mandou as fotografias. */
export const DESCRICAO_DAS_FOTOS = "Ver as fotografias enviadas pelo cliente.";

const MESES = "janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";

/**
 * Isto fala de QUANDO — um dia, uma semana, uma pressa.
 *
 * «2ª feira» chegou à pergunta da descrição e ficou a ser a descrição do
 * Emiliano. Ao contrário, um «Sim» chegou à pergunta da data e ficou a ser a
 * data dele.
 *
 * ⚠️ «Bom dia» e «Boa tarde» não são datas, e «o marco do correio» não é «março».
 */
export function pareceQuando(texto: string): boolean {
  const t = semLugaresNemPassado(semAcentos(texto));
  return (
    /\b(hoje|amanha|depois de amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|feira|fim de semana|semana|mes|urgen\w*|pressa|breve|rapido|quanto antes|flexivel|qualquer (dia|altura))\b/.test(t) ||
    /\bquando\s+(der|puder|quiser|for\s+possivel|lhe\s+der\s+jeito)\b/.test(t) ||
    /\b(de|pela|a|esta|durante\s+a|ao\s+fim\s+da|ao\s+final\s+da)\s+(manha|tarde|noite)\b/.test(t) ||
    /\b(\d+|uns|alguns|poucos|proximos)\s+dias\b/.test(t) ||
    /(?<![\d])[2-6]\s*[ªa]?\s*-?\s*f(eira)?\b/.test(t) ||
    // «12 -4dto» é a porta e o andar, e não o 12 de abril (26-10-2026).
    /(?<![\d])\d{1,2}\s*[\/.-]\s*\d{1,2}(?![\d-]|[º°ª]|(esq|dto|dt|dir|frente|andar)\b)/.test(t) ||
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
    // O que se embala numa mudança, e o próprio embalar — o Gaspar, 10-10-2026:
    // «E quero que embale as roupas e a mudança» levou «Para registar responda SIM».
    /\b(roupas?|utensilios|pratos|copos|loica|livros|malas|pertences|embal\w*|encaixot\w*|desembal\w*|desmont\w*)\b/.test(t) ||
    /\b(apartamento|casa|moradia|garagem|arrecadacao|sotao|quintal|escritorio|loja)\b.*\b(vagar|esvaziar|despejar|limpar|retirar|tirar)\b|\b(vagar|esvaziar|despejar|limpar|retirar|tirar)\b.*\b(apartamento|casa|moradia|garagem|arrecadacao|sotao|quintal|escritorio|loja)\b/.test(t) ||
    /\bt[0-6]\b/.test(t) ||
    /\d+[.,]?\d*\s*(m|cm|mt|mts|metros)\b/.test(t)
  );
}

/**
 * Isto fala do ACESSO — estacionar, parar, os lugares, o elevador, as escadas.
 *
 * «Depende de como estiver no momento os lugares» chegou à pergunta da data,
 * porque o Emiliano ainda estava a responder à do estacionamento. Uma frase
 * destas, fora do passo dela, é conversa sobre o acesso — não a data.
 */
export function falaDoAcesso(texto: string): boolean {
  const t = semAcentos(texto);
  return /\b(estaciona\w*|parar|parque|lugar(es)?|carrinha|carro|elevador|escadas?|degraus?|lances?|porta\s+do\s+predio|rua\s+(chata|estreita|apertada|dificil))\b/.test(
    t,
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * O QUE NÃO É ENTULHO, O VOLUME E QUEM CARREGA — 26-10-2026
 *
 *   «Preciso de recolha de resíduos de embalagens (cartão, plástico bolha,
 *   película, esferovite e um colchão insuflável; não é entulho de obras) na
 *   quinta-feira (29/10), […] R/C Esq […] (pátio ao nível do chão, sem
 *   escadas nem elevador). Vamos compactar tudo, ficará cerca de 0,5 a
 *   0,7 m³. Aceitam este tipo de material? Qual o preço total com IVA e a
 *   janela horária na quinta? Obrigado!»
 *
 * — o Teodoro (nome inventado; o caso é de 26-10-2026). Ficou «recolha de
 * entulho», pela palavra que ele NEGOU; e a seguir perguntaram-lhe «quanto
 * entulho é? Em sacos ou em m³», que ele tinha escrito. À pergunta do
 * estacionamento disse «Nós próprios carregamos tudo, os profissionais nem
 * precisam de sair da viatura» — e isso não ficou em lado nenhum.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * O ENTULHO NEGADO — «não é entulho de obras», «não é de obras», «sem
 * entulho», «nada de obras». Recebe e devolve o texto já sem acentos, com a
 * negação apagada: o que sobra é o que ele pede.
 */
const ENTULHO_NEGADO =
  /\b(nao|nem|sem|nada\s+de)\s+(e\s+|eh\s+|sao\s+|se\s+trata\s+de\s+|ha\s+|tem\s+|temos\s+|ser\s+|inclui\s+)?(de\s+|do\s+|da\s+|um\s+|uns\s+|o\s+|nenhum\s+)?(entulho|obras?|restos?\s+de\s+obras?|residuos?\s+de\s+(obras?|construcao)|calica|construcao)(\s+(de|da|do)\s+(obras?|construcao))?\b/g;

export function semEntulhoNegado(t: string): string {
  return t.replace(ENTULHO_NEGADO, " ");
}

/** Ele disse que NÃO é entulho? */
export function negaOEntulho(texto: string): boolean {
  return semEntulhoNegado(semAcentos(texto)) !== semAcentos(texto);
}

/**
 * O VOLUME, QUANDO ELE O DIZ — «cerca de 0,5 a 0,7 m³», «uns 20 sacos»,
 * «3 big bags», «meia carrinha», «cabe tudo numa carrinha». Devolve-o como ele
 * o escreveu (sem o «cerca de»), ou `null`.
 *
 * Os metros (comprimento) não contam: «2,35m» é a medida de um sofá. Só os
 * cúbicos, os sacos, os big bags e a carrinha.
 */
export function volumeNaFrase(texto: string): string | null {
  const m = texto.match(
    /(?<![\d,.])(\d+(?:[.,]\d+)?(?:\s*(?:a|-|–|ou)\s*\d+(?:[.,]\d+)?)?)\s*(m3|m³|metros?\s+c[uú]bicos?|sacos?|big[\s-]?bags?|bigbags?)(?![a-zà-ÿ])/i,
  );
  if (m) return `${m[1].replace(/\s+/g, " ")} ${m[2]}`.trim();
  const carrinha = texto.match(
    /\b(?:meia\s+carrinha(?:\s+cheia)?|(?:uma|duas|tr[eê]s)\s+carrinhas?\s+(?:cheias?|pequenas?|grandes?)|cabe(?:m)?\s+(?:tudo\s+)?(?:numa|em\s+uma)\s+carrinha(?:\s+pequena)?)\b/i,
  );
  return carrinha ? carrinha[0] : null;
}

/**
 * QUEM CARREGA É O CLIENTE — «Nós próprios carregamos tudo», «os
 * profissionais nem precisam de sair da viatura», «eu ponho tudo na
 * carrinha». Fica no pedido («O cliente carrega para a viatura») e o andar e
 * o elevador deixam de se perguntar: não são eles que sobem.
 *
 * ⚠️ «Não conseguimos carregar», «ajudo a carregar» e «quem carrega?» não
 * são isto.
 */
export function clienteCarrega(texto: string): boolean {
  const t = semAcentos(texto);
  if (/\b(nao|nem)\s+(\w+\s+){0,2}(carreg|consegu|consig|pod)\w*\s+(\w+\s+)?(carregar|levar|por|meter)\b/.test(t)) return false;
  if (/\bajud\w*\s+a\s+carregar\b/.test(t)) return false;
  return [
    /\b(nos|eu)\s+((proprios?|propria|mesmos?|mesma)\s+)?(carregamos|carrego|pomos|ponho|colocamos|coloco|metemos|meto|levamos|levo)\b(?!\s*\?)/,
    /\b(carregamos|carrego)\s+(tudo\s+)?(nos|eu)\b/,
    /\b(somos\s+nos|sou\s+eu)\s+(que|quem)\s+(carrega|carregamos|carrego|poe|pomos|ponho)\b/,
    /\b(nao|nem)\s+(precisa|precisam|e\s+preciso|tem\s+de|tem\s+que|teem\s+de)\s+(de\s+)?sair\s+d[ao]\s+(viatura|carrinha|carro|camiao|veiculo|camioneta)\b/,
    /\b(ja\s+)?(esta|fica|deixamos|deixo|pomos|ponho)\s+tudo\s+(ca\s+em\s+baixo\s+)?(a\s+porta|junto\s+a\s+viatura|ao\s+pe\s+da\s+(carrinha|viatura))\s+e\s+(nos|eu)\s+(carregamos|carrego)\b/,
  ].some((r) => r.test(t));
}
