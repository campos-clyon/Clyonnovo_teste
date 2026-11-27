import { pecasEmLisboa } from "./hora-de-lisboa";

/**
 * DEPOIS DO TRABALHO — d147 (27-11-2026, dono).
 *
 * Nos Concluídos «por ver», cada trabalho mostra a pergunta que se fez ao
 * cliente depois do trabalho (o «correu bem?» ou o pedido de avaliação) e a
 * resposta dele, lida sozinha da conversa. O «por ver» fecha-se de duas
 * maneiras:
 *
 *   · «Guardar a resposta» — a nota vai pelo «Dar a nota como CLYON» que já
 *     existe, com o texto do cliente já escrito e o «Por WhatsApp a DD/MM».
 *     Estrelas só se o cliente deu uma nota ou disse claramente como correu.
 *   · «Sem resposta do cliente — fechar» — uma nota INTERNA no histórico do
 *     pedido. Nunca uma avaliação, nunca estrelas: não aparece no site nem no
 *     perfil do parceiro.
 *
 * Tudo aqui é puro e não sabe de onde vem a conversa: hoje é o WhatsApp; um
 * dia as respostas chegam também pela app de cliente e pela CLYON Pro, e
 * passam pela mesma `respostaDoPosTrabalho`, com o canal delas.
 */

export type CanalDoPosTrabalho = "whatsapp" | "app_cliente" | "app_pro";

/** Uma mensagem da conversa com o cliente: `in` é dele, `out` é nossa. */
export type MensagemDaConversa = { direccao: "in" | "out"; texto: string; em: Date };

export type PosTrabalho = {
  canal: CanalDoPosTrabalho;
  /** A nossa última pergunta de pós-trabalho, ou nenhuma. */
  pergunta: { texto: string; em: Date } | null;
  /** O que o cliente escreveu depois dela, ou nada. */
  resposta: { texto: string; em: Date } | null;
  /** A nota que o cliente deu, se a deu com um número claro (1 a 5). */
  estrelas: number | null;
  /** O «como é que o cliente deu esta nota», já escrito — só com resposta. */
  comoDisse: string | null;
};

/** A nota interna do «Sem resposta do cliente — fechar». Nunca é uma avaliação. */
export const NOTA_SEM_RESPOSTA = "O cliente não respondeu ao pedido de avaliação";

const semAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/*
 * AS PERGUNTAS DE PÓS-TRABALHO QUE SAEM DA PLATAFORMA — pelos pedaços que as
 * distinguem (sem acentos, em minúsculas):
 *   · a avaliação da Vitória, no dia seguinte (`assistente-automatico.ts`);
 *   · o agradecimento com a nota de 1 a 5 (`mensagens-das-fases.ts`);
 *   · o «Correu tudo bem?» dos Feitos (`mensagens-das-fases.ts`);
 *   · o «diz que está feito… ficou tudo bem» da Vitória;
 *   · o «Como correu com {nome}?» do fim de um Trabalho CLYON.
 */
const PEDACOS_DA_PERGUNTA = [
  "como e que correu",
  "como correu",
  "correu tudo bem",
  "ficou tudo bem",
  "que nota da ao parceiro",
  "de 1 a 5",
] as const;

/** Esta mensagem nossa é uma pergunta de pós-trabalho? */
export function ePerguntaDoPosTrabalho(texto: string | null | undefined): boolean {
  const t = semAcentos(String(texto ?? ""));
  return PEDACOS_DA_PERGUNTA.some((p) => t.includes(p));
}

const NUMEROS_POR_EXTENSO: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5 };

/**
 * A NOTA NA RESPOSTA — só quando é clara: a mensagem é só o número, ou o
 * número vem com «nota», «estrelas», «/5», «de 5», ou em ⭐. Dois números
 * diferentes, ou um número solto numa frase («às 5 já cá estavam»), não
 * contam: aí escolhe uma pessoa, ou não há estrelas.
 */
export function estrelasNaResposta(texto: string | null | undefined): number | null {
  const bruto = String(texto ?? "");
  const achadas = new Set<number>();

  const emEstrelas = (bruto.match(/⭐|★/g) ?? []).length;
  if (emEstrelas >= 1 && emEstrelas <= 5) achadas.add(emEstrelas);

  const t = semAcentos(bruto).replace(/[⭐★]/g, " ");
  const numero = "([1-5]|um|uma|dois|duas|tres|quatro|cinco)";
  const valor = (s: string) => (/^[1-5]$/.test(s) ? Number(s) : NUMEROS_POR_EXTENSO[s]);
  const padroes = [
    new RegExp(`^\\s*${numero}\\s*[.!]*\\s*$`),
    new RegExp(`\\b${numero}\\s*(?:\\/|de|em)\\s*(?:5|cinco)\\b`),
    new RegExp(`\\b${numero}\\s*estrelas?\\b`),
    new RegExp(`\\bnota\\s*(?:de\\s*|e\\s*|:\\s*)?${numero}\\b`),
    new RegExp(`\\b(?:dou|dava|daria)\\s*(?:um\\s*|uma\\s*|o\\s*)?${numero}\\b`),
  ];
  for (const p of padroes) {
    // «m»: numa resposta de várias mensagens, uma linha só com o número conta.
    for (const m of t.matchAll(new RegExp(p.source, "gm"))) {
      const v = valor(m[1]);
      if (v >= 1 && v <= 5) achadas.add(v);
    }
  }
  return achadas.size === 1 ? [...achadas][0] : null;
}

const dois = (n: number) => String(n).padStart(2, "0");

/** «DD/MM», no relógio de Lisboa. */
export function diaCurto(em: Date): string {
  const p = pecasEmLisboa(em);
  return `${dois(p.dia)}/${dois(p.mes)}`;
}

/** O «como é que o cliente deu esta nota», pelo canal e pelo dia da resposta. */
export function comoODisse(canal: CanalDoPosTrabalho, em: Date): string {
  const por = canal === "whatsapp" ? "Por WhatsApp" : canal === "app_cliente" ? "Pela app de cliente" : "Pela app CLYON Pro";
  return `${por} a ${diaCurto(em)}`;
}

/** Até quantas mensagens do cliente se juntam na resposta, e até quantos caracteres (o comentário guarda 600). */
const MENSAGENS_NA_RESPOSTA = 5;
const TAMANHO_DA_RESPOSTA = 600;

/**
 * A FUNÇÃO COMUM: numa conversa (de qualquer canal), a última pergunta de
 * pós-trabalho depois de `desde`, e o que o cliente escreveu a seguir.
 */
export function respostaDoPosTrabalho(
  mensagens: ReadonlyArray<MensagemDaConversa>,
  canal: CanalDoPosTrabalho,
  desde: Date | null = null,
): PosTrabalho {
  const ordenadas = mensagens
    .filter((m) => m.em instanceof Date && !Number.isNaN(m.em.getTime()) && String(m.texto ?? "").trim())
    .filter((m) => !desde || m.em.getTime() >= desde.getTime())
    .slice()
    .sort((a, b) => a.em.getTime() - b.em.getTime());

  let i = -1;
  for (let k = ordenadas.length - 1; k >= 0; k--) {
    if (ordenadas[k].direccao === "out" && ePerguntaDoPosTrabalho(ordenadas[k].texto)) {
      i = k;
      break;
    }
  }
  if (i < 0) return { canal, pergunta: null, resposta: null, estrelas: null, comoDisse: null };

  const pergunta = { texto: ordenadas[i].texto.trim(), em: ordenadas[i].em };
  const doCliente = ordenadas.slice(i + 1).filter((m) => m.direccao === "in").slice(0, MENSAGENS_NA_RESPOSTA);
  if (doCliente.length === 0) return { canal, pergunta, resposta: null, estrelas: null, comoDisse: null };

  const texto = doCliente.map((m) => m.texto.trim()).join("\n").slice(0, TAMANHO_DA_RESPOSTA);
  const em = doCliente[0].em;
  return { canal, pergunta, resposta: { texto, em }, estrelas: estrelasNaResposta(texto), comoDisse: comoODisse(canal, em) };
}

/**
 * ABRIR O CARTÃO AINDA FECHA O «POR VER»? Só quando não há nada a recolher do
 * nosso lado: o trabalho já tem nota, ou a nota é do cliente (tem o link) e a
 * CLYON não a pode dar por ele. Nos outros, o «por ver» fecha-se com
 * «Guardar a resposta» ou «Sem resposta do cliente — fechar».
 */
export function oPorVerFechaAoAbrir(o: { avaliado: boolean; clyonPodeAvaliar: boolean }): boolean {
  return o.avaliado || !o.clyonPodeAvaliar;
}
