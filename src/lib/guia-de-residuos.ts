/**
 * A GUIA DE RESÍDUOS — o que a CLYON aceita — 12-11-2026 (d5).
 *
 * Textos do Jurídico (relatório de 12-11-2026, proposta 2, textos A, C e D),
 * aprovados pelo CEO e pelo dono. Um sítio só: o painel do parceiro, a
 * inscrição, o backoffice e os Termos lêem daqui, e a app CLYON Pro lê-os pela
 * API (não os escreve).
 *
 * O CÓDIGO APA. O registo de transportador no SILiAmb dá um código «APA»
 * seguido de 8 algarismos (o da própria CLYON tem esse formato). O exemplo do
 * campo dizia «APA-123456», que é um formato que não existe e ensinava o
 * errado. O formato AVISA e não bloqueia: quem já escreveu outra coisa grava na
 * mesma, e quem verifica é o administrador, pela lista de baixo.
 *
 * A PROVA E O DESTINO. A prova do registo é um ficheiro que só o administrador
 * vê (`/api/admin/profissionais/[id]/prova-da-guia`): o endereço nunca sai para
 * um browser, nem para o do próprio parceiro. O destino é o operador
 * licenciado onde descarrega, que o administrador confere no SILOGR.
 *
 * É pura (sem base, sem rede): serve ao browser e ao servidor.
 */

/** O exemplo no campo do código — o formato verdadeiro, sem um número de ninguém. */
export const EXEMPLO_DO_CODIGO_APA = "Ex.: APA00000000";

/** «APA» e 8 algarismos. */
export const FORMATO_DO_CODIGO_APA = /^APA\d{8}$/;

/** O código sem espaços, pontos, hífens nem barras, em maiúsculas — só para conferir o formato. */
export function codigoApaCompacto(v: string): string {
  return v.replace(/[\s.\-_/]+/g, "").toUpperCase();
}

/** O código tem o formato «APA» + 8 algarismos (aceita espaços, hífens e minúsculas). */
export function codigoApaTemOFormato(v: string | null | undefined): boolean {
  if (typeof v !== "string") return false;
  return FORMATO_DO_CODIGO_APA.test(codigoApaCompacto(v));
}

export const AVISO_DO_FORMATO_DO_CODIGO_APA =
  "O código APA tem «APA» e 8 algarismos (por exemplo, APA00000000). Confira-o no SILiAmb. Gravamos o que escreveu na mesma.";

/** O aviso do formato, ou null (campo vazio ou formato certo). Nunca bloqueia a gravação. */
export function avisoDoCodigoApa(v: string | null | undefined): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  if (!t) return null;
  return codigoApaTemOFormato(t) ? null : AVISO_DO_FORMATO_DO_CODIGO_APA;
}

/* ── TEXTO A — a ajuda junto ao campo ───────────────────────────────────── */

export const AJUDA_DA_GUIA = Object.freeze({
  titulo: "O que a CLYON aceita como guia de resíduos",
  abertura:
    "Para ser contratado em trabalhos com entulho, e nos pedidos em que o cliente pede guia, temos de confirmar que pode transportar resíduos. Pedimos três coisas:",
  passos: Object.freeze([
    "O seu código APA. É o número que a Agência Portuguesa do Ambiente lhe dá quando se regista no SILiAmb (siliamb.apambiente.pt): começa por «APA» e tem 8 algarismos. Tem de estar em nome do mesmo NIF com que se inscreveu na CLYON.",
    "Uma prova desse registo: uma captura de ecrã ou um PDF do SILiAmb onde se vejam o nome, o NIF e o código APA, ou uma e-GAR de um transporte recente em que apareça como transportador (pode tapar os dados do cliente).",
    "Para onde leva o entulho: o nome do operador licenciado onde descarrega (aterro, centro de triagem ou ecocentro que aceite entregas de empresas). Confirmamos a licença na lista oficial da APA (SILOGR).",
  ]),
  privacidade: "A prova só a vê a administração da CLYON e não a mostramos a clientes.",
  eGar:
    "Em cada trabalho, o transporte leva uma e-GAR, emitida no SILiAmb antes de sair (Portaria n.º 145/2017). Pode emiti-la o cliente ou, com autorização dele, o parceiro ou o destino; se o cliente não a puder confirmar no SILiAmb, assina-a em papel no momento. O entulho só pode ser entregue a um operador licenciado. A e-GAR e o destino são da sua responsabilidade: a CLYON não emite guias.",
});

/* ── Os campos ──────────────────────────────────────────────────────────── */

export const ROTULO_DO_CODIGO_APA = "Código APA (registo de transportador no SILiAmb)";

export const ROTULO_DA_PROVA_DA_GUIA = "Prova do registo no SILiAmb";
export const AJUDA_DA_PROVA_DA_GUIA =
  "Captura de ecrã ou PDF do SILiAmb com o nome, o NIF e o código APA, ou uma e-GAR recente em que apareça como transportador. Só a administração da CLYON a vê.";

export const ROTULO_DO_DESTINO_DOS_RESIDUOS = "Para onde leva o entulho";
export const EXEMPLO_DO_DESTINO_DOS_RESIDUOS = "Ex.: nome do aterro, centro de triagem ou ecocentro";
export const MAXIMO_DO_DESTINO_DOS_RESIDUOS = 200;

/** O destino como se grava: sem espaços a mais, cortado no tamanho da coluna; vazio = null. */
export function destinoDosResiduosLimpo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim().slice(0, MAXIMO_DO_DESTINO_DOS_RESIDUOS);
  return t || null;
}

/** Quatro megabytes: o tecto do corpo de um pedido ao servidor, com folga. Um PDF do SILiAmb cabe. */
export const TAMANHO_MAXIMO_DA_PROVA = 4 * 1024 * 1024;

/** Imagens e PDF. */
export const TIPOS_DA_PROVA = Object.freeze(["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"]);

export function tipoDaProvaAceite(tipo: string): boolean {
  return TIPOS_DA_PROVA.includes(tipo);
}

export const MENSAGENS_DA_PROVA = Object.freeze({
  semFicheiro: "Escolha o ficheiro da prova.",
  grande: "O ficheiro é grande de mais (máximo 4 MB).",
  tipo: "Só imagens (JPG, PNG ou WEBP) ou PDF.",
  falhou: "Não foi possível guardar a prova. Tente outra vez.",
  enviada: "Prova enviada. A administração da CLYON vai vê-la.",
});

/* ── TEXTO C — a lista do administrador (só o administrador verifica) ─── */

export const LISTA_DO_ADMINISTRADOR_DA_GUIA = Object.freeze([
  "O código tem o formato APA + 8 algarismos e é o mesmo que está na prova.",
  "O nome e o NIF da prova são os do parceiro, e o NIF já foi confirmado por outra pessoa (d10.2).",
  "A prova é do SILiAmb (captura ou PDF da entidade, ou uma e-GAR com ele como transportador) e não tem sinais de edição.",
  "O destino indicado aparece no SILOGR com licença para resíduos de construção e demolição (códigos LER do capítulo 17, por exemplo 17 09 04).",
  "Carregar em «Confirmei o registo», que guarda a data e quem verificou. Se faltar alguma coisa, não se verifica, e diz-se ao parceiro o que falta.",
]);

export const NOTA_DA_LISTA_DO_ADMINISTRADOR =
  "Se o parceiro mudar o código, a verificação cai sozinha.";

/* ── TEXTO D — a frase dos Termos, §10 ──────────────────────────────────── */

export const GUIA_NOS_TERMOS =
  "Nos trabalhos com entulho, e sempre que o cliente peça guia, só pode ser contratado depois de a CLYON verificar o seu registo de transportador de resíduos no SILiAmb (código APA). " +
  "Em cada transporte de resíduos, a guia eletrónica (e-GAR) exigida pela Portaria n.º 145/2017 e a entrega num operador licenciado são da sua responsabilidade.";
