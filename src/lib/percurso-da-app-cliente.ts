/**
 * O PERCURSO DE QUEM RECEBE O CONVITE DA APP DE CLIENTE — 24-11-2026 (d106,
 * aprovada pelo CEO e pelo dono; proposta P2 do Produto).
 *
 * A Play só conta quem carregou em «Tornar-me testador»; o convite ia direito
 * à Google e não sabíamos onde cada pessoa ficava. Agora o convite e o
 * lembrete levam um link NOSSO, `/app-cliente?c=<código>`:
 *
 *   · o código é opaco (aleatório, 16 caracteres), um por pessoa, caduca, e
 *     nunca leva o email;
 *   · ao abrir, a página grava o clique e a CLASSE do aparelho (Android,
 *     iPhone ou computador) — nunca o user-agent nem o IP (Jurídico, d109);
 *   · cada passo a que a pessoa chega grava-se, e o «Não consegui» grava o
 *     passo e o motivo (uma escolha curta e, se quiser, umas palavras).
 *
 * Este ficheiro é PURO (sem base): as regras, os rótulos e as contas do
 * resumo. A base está em `percurso-da-app-cliente-na-base.ts`; a rota que
 * grava em `/api/app-cliente/percurso`.
 */

/* ─── O código ──────────────────────────────────────────────────────────── */

/** Quantos dias o código do link serve, depois de criado. */
export const DIAS_DE_VALIDADE_DO_CODIGO = 60;

/** Um código como os que geramos (base64url, 16 a 32 caracteres). */
export function codigoValido(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{16,32}$/.test(v);
}

/**
 * O LINK DO CONVITE — o ponto único: o convite, o lembrete, o WhatsApp e o
 * aviso «Já pode entrar no teste» levam este link. Sem código (o envio de
 * teste «só para mim»), a mesma página sem registo.
 */
export function linkDoConviteDaApp(base: string, codigo: string | null): string {
  const raiz = base.replace(/\/+$/, "");
  return codigo && codigoValido(codigo) ? `${raiz}/app-cliente?c=${codigo}` : `${raiz}/app-cliente`;
}

/* ─── O aparelho ────────────────────────────────────────────────────────── */

export const APARELHOS = ["android", "iphone", "pc", "outro"] as const;
export type Aparelho = (typeof APARELHOS)[number];

export const ROTULOS_DO_APARELHO: Record<Aparelho, string> = {
  android: "Android",
  iphone: "iPhone",
  pc: "Computador",
  outro: "Outro",
};

/**
 * A classe do aparelho pelo user-agent. O user-agent lê-se e deita-se fora:
 * só a classe se guarda. O iPad conta como iPhone (não há app para iOS).
 * `toques` (só no navegador): o iPad em modo «computador» diz «Macintosh»
 * mas tem ecrã táctil.
 */
export function aparelhoDoUserAgent(ua: unknown, toques = 0): Aparelho {
  if (typeof ua !== "string" || ua.trim() === "") return "outro";
  const u = ua.slice(0, 512);
  if (/android/i.test(u)) return "android";
  if (/iphone|ipad|ipod/i.test(u)) return "iphone";
  if (/macintosh/i.test(u) && toques > 1) return "iphone";
  if (/windows nt|macintosh|mac os x|x11|linux|cros/i.test(u)) return "pc";
  return "outro";
}

export function eAparelho(v: unknown): v is Aparelho {
  return typeof v === "string" && (APARELHOS as readonly string[]).includes(v);
}

/* ─── Os passos e os motivos ────────────────────────────────────────────── */

/** Os quatro passos da adesão no Android (os mesmos da /app-cliente). */
export const PASSOS_DA_ADESAO = {
  1: "A app é para clientes",
  2: "O Gmail",
  3: "«Tornar-me testador»",
  4: "Instalar e entrar",
} as const;
export type PassoDaAdesao = keyof typeof PASSOS_DA_ADESAO;

export function ePasso(v: unknown): v is PassoDaAdesao {
  return v === 1 || v === 2 || v === 3 || v === 4;
}

/*
 * AS OPÇÕES, AS RESPOSTAS E OS TEXTOS DA PÁGINA — v3 da d107, secção 5,
 * aprovada À LETRA pelo dono a 24-11-2026. A resposta a «Não consigo entrar
 * na conta» usa o rótulo real do botão na app («Prefiro receber uma ligação
 * por email», app-cliente/src/componentes/Entrada.tsx), como a v3 pedia.
 */
export const MOTIVOS_DO_NAO_CONSEGUI = [
  "sem-android",
  "para-que-serve",
  "conta-google",
  "sem-gmail",
  "email-invalido",
  "sem-acesso",
  "no-computador",
  "pagina-nao-abre",
  "nao-disponivel",
  "nao-encontro",
  "entrar-na-conta",
  "outro",
] as const;
export type MotivoDoNaoConsegui = (typeof MOTIVOS_DO_NAO_CONSEGUI)[number];

/** As opções de cada passo (escolha única), pela ordem da v3. */
export const MOTIVOS_POR_PASSO: Record<PassoDaAdesao, readonly MotivoDoNaoConsegui[]> = {
  1: ["sem-android", "para-que-serve", "outro"],
  2: ["conta-google", "sem-gmail", "email-invalido", "outro"],
  3: ["sem-acesso", "no-computador", "pagina-nao-abre", "outro"],
  4: ["nao-disponivel", "nao-encontro", "entrar-na-conta", "outro"],
};

/** O que a pessoa lê nas opções — e a equipa no backoffice. */
export const ROTULOS_DO_MOTIVO: Record<MotivoDoNaoConsegui, string> = {
  "sem-android": "Não tenho Android",
  "para-que-serve": "Não percebo para que serve",
  "conta-google": "Não sei qual é a conta Google do telemóvel",
  "sem-gmail": "Não uso Gmail",
  "email-invalido": "Diz que o email não é válido",
  "sem-acesso": "Diz que não tenho acesso",
  "no-computador": "Abri no computador",
  "pagina-nao-abre": "A página não abre",
  "nao-disponivel": "A Play diz que não está disponível",
  "nao-encontro": "Não encontro a app na Play Store",
  "entrar-na-conta": "Não consigo entrar na conta",
  outro: "Outro",
};

/** A resposta que a página mostra a cada opção. */
export const RESPOSTAS_DO_NAO_CONSEGUI: Record<MotivoDoNaoConsegui, string> = {
  "sem-android": "Por agora a app é só para Android. No site faz tudo na sua conta. Não lhe voltamos a falar da app.",
  "para-que-serve":
    "Na app faz o pedido com fotografias, compara as propostas dos parceiros, acompanha o trabalho e paga ao parceiro, tudo no telemóvel. É opcional: no site faz o mesmo.",
  "conta-google":
    "No telemóvel, abra Definições › Google (ou Definições › Contas). O email que aparece lá em cima é o que a Play usa. Escreva-o no passo 2.",
  "sem-gmail":
    "A Google Play precisa de uma conta Google, que é a que está no telemóvel. Se o telemóvel tem a Play Store, já tem uma: veja-a em Definições › Google.",
  "email-invalido": "Confirme se está escrito sem espaços e com o @. Se continuar, toque em «Outro» e diga-nos o que aparece.",
  "sem-acesso":
    "A sua conta ainda não está na lista, ou abriu a ligação com outra conta Google. Já sabemos: avisamos por email ou WhatsApp quando estiver pronta.",
  "no-computador":
    "Este passo tem de ser no telemóvel Android. Leia o código QR com a câmara do telemóvel, ou abra no telemóvel o email que lhe enviámos.",
  "pagina-nao-abre":
    "Abra a ligação no telemóvel, no Chrome, com a conta Google do telemóvel. Se não abrir, diga-nos em «Outro» o que aparece.",
  "nao-disponivel":
    "A Play Store está com outra conta Google. Abra a Play Store, toque na sua fotografia lá em cima e escolha a conta que escreveu no passo 2. Depois volte à ligação.",
  "nao-encontro": "Enquanto está em teste, a app não aparece na pesquisa. Use o botão «Abrir na Play Store» desta página.",
  "entrar-na-conta":
    "Na app, escolha «Prefiro receber uma ligação por email» e use o email da sua conta CLYON. A ligação só serve uma vez: se falhar, peça outra.",
  outro: "Obrigado, vamos ver e respondemos-lhe por email ou WhatsApp.",
};

/** Os textos fixos do formulário e da página (v3, secção 5). */
export const TEXTOS_DO_NAO_CONSEGUI = {
  botao: "Não consegui",
  titulo: "O que aconteceu?",
  subtitulo: "Escolha uma opção. Dizemos-lhe já o que fazer.",
  enviar: "Enviar",
  rotuloDoOutro: "Conte-nos em poucas palavras",
  exemploDoOutro: "Ex.: aparece uma mensagem de erro",
  depoisDeEnviar: "Obrigado. Já sabemos em que passo ficou.",
  debaixoDoFormulario: "Usamos esta resposta só para corrigir o convite e a app.",
  recusa: "Não quero receber mensagens sobre a app",
  iphone: "Ainda não há app CLYON para iPhone. No site faz tudo na sua conta. Obrigado: não lhe voltamos a falar da app.",
  computador:
    "Estes passos são no telemóvel Android. Leia este código com a câmara do telemóvel, ou abra no telemóvel o email que lhe enviámos.",
} as const;

/** As opções que fazem a pessoa sair de tudo o que é sobre a app («Não lhe voltamos a falar da app»). */
export function motivoTiraDaApp(m: MotivoDoNaoConsegui): boolean {
  return m === "sem-android";
}

export function eMotivo(v: unknown): v is MotivoDoNaoConsegui {
  return typeof v === "string" && (MOTIVOS_DO_NAO_CONSEGUI as readonly string[]).includes(v);
}

/** O máximo das palavras livres do «Outro» (v3: 200). */
export const MAXIMO_DO_TEXTO_LIVRE = 200;

/**
 * As palavras livres, limpas: sem caracteres de controlo, sem espaços a mais,
 * cortadas, e sem emails nem números de telefone (guarda-se o mínimo: o
 * motivo, não o contacto). Vazio → null.
 */
export function textoLivreLimpo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/\+?\d[\d\s.-]{7,}\d/g, "[número]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAXIMO_DO_TEXTO_LIVRE)
    .trim();
  return t ? t : null;
}

/* ─── O que a página manda ──────────────────────────────────────────────── */

/**
 * As respostas do lembrete (os três botões, r=1|2|3): 1 «Tentei e não
 * consegui», 2 «Não tenho Android», 3 «Não me interessa» — a 3 é a mesma
 * recusa que {LINK_RECUSA}. A 2 e a 3 tiram a pessoa de tudo o que é sobre a
 * app (as mensagens dos pedidos continuam).
 */
export type RespostaDoLembrete = 1 | 2 | 3;
export function eResposta(v: unknown): v is RespostaDoLembrete {
  return v === 1 || v === 2 || v === 3;
}
export function respostaTiraDaApp(r: RespostaDoLembrete): boolean {
  return r === 2 || r === 3;
}

export type RegistoDoPercurso =
  | { accao: "abriu" }
  | { accao: "passo"; passo: PassoDaAdesao }
  | { accao: "nao-consegui"; passo: PassoDaAdesao; motivo: MotivoDoNaoConsegui; texto: string | null }
  | { accao: "resposta"; r: RespostaDoLembrete };

/** O corpo do pedido, validado; `null` = não se grava nada. */
export function lerRegisto(corpo: unknown): { codigo: string; registo: RegistoDoPercurso } | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as Record<string, unknown>;
  if (!codigoValido(c.c)) return null;
  const codigo = c.c;
  if (c.accao === "abriu") return { codigo, registo: { accao: "abriu" } };
  if (c.accao === "resposta") {
    const r = Number(c.r);
    return eResposta(r) ? { codigo, registo: { accao: "resposta", r } } : null;
  }
  const passo = Number(c.passo);
  if (!ePasso(passo)) return null;
  if (c.accao === "passo") return { codigo, registo: { accao: "passo", passo } };
  if (c.accao === "nao-consegui") {
    if (!eMotivo(c.motivo) || !MOTIVOS_POR_PASSO[passo].includes(c.motivo)) return null;
    // As palavras livres só no «Outro» (o servidor tira emails e números).
    const texto = c.motivo === "outro" ? textoLivreLimpo(c.texto) : null;
    return { codigo, registo: { accao: "nao-consegui", passo, motivo: c.motivo, texto } };
  }
  return null;
}

/**
 * «SEM APP» na conversa (v3, 2.c, para o I&D): «sem app» ou «sem a app», em
 * maiúsculas ou minúsculas. Um «não» sozinho não é recusa. Pura — o ponto de
 * leitura para a Vitória; quem a chama grava com `marcarSemApp`.
 */
export function eRespostaSemApp(texto: unknown): boolean {
  if (typeof texto !== "string") return false;
  return /(^|[^\p{L}])sem\s+(a\s+)?app([^\p{L}]|$)/iu.test(texto.normalize("NFC"));
}

/* ─── O que o backoffice mostra ─────────────────────────────────────────── */

/** Uma linha do percurso, como sai da base (sem o código). */
export type Percurso = {
  email: string;
  criadoEm: string | null;
  cliqueEm: string | null;
  cliques: number;
  aparelho: Aparelho | null;
  /** Todas as classes de aparelho em que abriu (o PC e depois o Android, por exemplo). */
  aparelhos: Aparelho[];
  passo: PassoDaAdesao | null;
  passoEm: string | null;
  naoConsegui: { passo: PassoDaAdesao; motivo: MotivoDoNaoConsegui; texto: string | null; em: string | null } | null;
  /** O botão do lembrete em que tocou (r=1|2|3), se tocou. Opcional nos dados antigos. */
  resposta?: RespostaDoLembrete | null;
  /** Saiu de tudo o que é sobre a app (recusa, «Não tenho Android», iPhone), e quando. */
  semAppEm?: string | null;
};

/** As classes guardadas em texto («pc,android») → a lista, sem lixo nem repetidos. */
export function aparelhosDoTexto(v: unknown): Aparelho[] {
  if (typeof v !== "string") return [];
  return [...new Set(v.split(",").map((s) => s.trim()).filter(eAparelho))];
}

/** O texto que se guarda: as de antes e a de agora. */
export function juntarAparelho(antes: unknown, agora: Aparelho): string {
  return [...new Set([...aparelhosDoTexto(antes), agora])].join(",");
}

/**
 * O último passo, por palavras: «Convite enviado» → «Clicou (Android)» →
 * «Chegou ao passo 3 («Tornar-me testador»)» → «Não conseguiu no passo 2: …».
 */
export function ultimoPassoEmPalavras(p: Percurso | null): string {
  if (!p) return "—";
  if (p.resposta === 3) return "Recusou as mensagens sobre a app";
  if (p.resposta === 2) return "Disse que não tem Android";
  if (p.semAppEm && !p.naoConsegui) return p.aparelho === "iphone" ? "Abriu num iPhone (sai das mensagens sobre a app)" : "Saiu das mensagens sobre a app";
  if (p.naoConsegui) {
    const n = p.naoConsegui;
    return `Não conseguiu no passo ${n.passo} (${PASSOS_DA_ADESAO[n.passo]}): ${ROTULOS_DO_MOTIVO[n.motivo]}`;
  }
  if (p.passo && p.passo > 1) return `Chegou ao passo ${p.passo} (${PASSOS_DA_ADESAO[p.passo]})`;
  if (p.cliques > 0) return p.aparelho ? `Clicou (${ROTULOS_DO_APARELHO[p.aparelho]})` : "Clicou";
  return "Convite enviado, ainda sem clique";
}

export type ResumoDosPercursos = {
  /** Pessoas com link nosso (convite ou lembrete com o código). */
  comLink: number;
  /** Pessoas que abriram o link pelo menos uma vez. */
  clicaram: number;
  /** Quantas pessoas abriram em cada classe (uma pessoa pode contar em duas). */
  porAparelho: Record<Aparelho, number>;
  /** % das que clicaram que abriram num iPhone / num computador (0–100, arredondado). */
  percentIphone: number;
  percentPc: number;
  /** «Não consegui», por passo e por motivo. */
  motivos: Array<{ passo: PassoDaAdesao; motivo: MotivoDoNaoConsegui; n: number }>;
};

export function resumoDosPercursos(lista: readonly Percurso[]): ResumoDosPercursos {
  const porAparelho: Record<Aparelho, number> = { android: 0, iphone: 0, pc: 0, outro: 0 };
  let clicaram = 0;
  const contagem = new Map<string, { passo: PassoDaAdesao; motivo: MotivoDoNaoConsegui; n: number }>();
  for (const p of lista) {
    if (p.cliques > 0) {
      clicaram += 1;
      for (const a of p.aparelhos) porAparelho[a] += 1;
    }
    if (p.naoConsegui) {
      const k = `${p.naoConsegui.passo}:${p.naoConsegui.motivo}`;
      const ja = contagem.get(k);
      if (ja) ja.n += 1;
      else contagem.set(k, { passo: p.naoConsegui.passo, motivo: p.naoConsegui.motivo, n: 1 });
    }
  }
  const pct = (n: number) => (clicaram ? Math.round((n / clicaram) * 100) : 0);
  return {
    comLink: lista.length,
    clicaram,
    porAparelho,
    percentIphone: pct(porAparelho.iphone),
    percentPc: pct(porAparelho.pc),
    motivos: [...contagem.values()].sort((a, b) => a.passo - b.passo || b.n - a.n),
  };
}
