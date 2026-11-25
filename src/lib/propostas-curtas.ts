/**
 * AS PROPOSTAS AO CLIENTE EM POUCAS MENSAGENS, CURTAS — 25-11-2026 (decisão
 * d114). PURO.
 *
 * O caso: a mesma cliente recebeu à noite a lista das 4 propostas e, de
 * manhã, 3 mensagens compridas em 20 minutos, uma por proposta, a repetir o
 * que já tinha. O dono: «Quando recebe uma proposta, espera até chegar uma
 * nova ou espera 1 hora e diz à cliente, numa mensagem simples, que já tem uma
 * primeira proposta. […] Só na hora da adjudicação, quando o cliente aceitar,
 * é que vão as outras informações.» E no mesmo dia, com mais clientes
 * «entupidos de mensagens»: mensagens pequenas, simples e humanas, e uma só
 * por dia para aquele assunto.
 *
 * A regra, UMA para os três caminhos (a rotina das propostas da d88, a
 * passagem do assistente e a conversa livre):
 *
 *   · quem envia sozinho é só a rotina das propostas
 *     (`envio-das-propostas-ao-cliente*.ts`): a 1.ª mensagem sai 1 h depois
 *     da 1.ª proposta ou quando chega a 2.ª (o que vier primeiro), das 9h às
 *     20h; depois, no máximo uma por dia, com a lista completa e curta, e só
 *     se houver propostas novas; nada depois de aceitar. A proposta nova e o
 *     «o parceiro aceitou» deixam de sair um a um (`A_ROTINA_DIZ_AS_PROPOSTAS`);
 *   · o texto (`mensagemCurtaDasPropostas`): 2 ou 3 linhas, a mais barata
 *     primeiro, o valor com IVA e o sem IVA ao lado, o parceiro, a pergunta;
 *     sem pagamento, fatura, taxa nem itens a mais — esses vão na confirmação
 *     depois de aceitar (`whatsapp-negociacao.ts`, `fecharPeloCliente`);
 *   · nunca se repete: o que já foi dito ao cliente (pela rotina, pela
 *     passagem de antes ou pela conversa livre) fica no registo dos avisos do
 *     assistente com a chave de cada proposta (`chavesDasPropostasVivas`, em
 *     `chaves-das-propostas.ts`, as mesmas `chaveDaProposta`/`chaveDaAceitacao`
 *     de sempre), e só uma proposta que lá não está faz sair outra mensagem;
 *
 * Este ficheiro é lido também pelo painel (o cartão da Mesa): não traz a base
 * nem o assistente — as chaves vivem à parte.
 *   · a numeração é a que a d111 lê: `lerAMensagemCurtaDasPropostas` dá as
 *     linhas («1», «2», o nome ou o valor), e o «1» à mensagem de uma só
 *     proposta aceita-a.
 */
import { horaEmLisboa } from "./hora-de-lisboa";
import { AVISO_DA_GUIA_NO_ENTULHO, lerAPerguntaDaGuia } from "./guia-no-entulho";

/** A proposta nova e o «o parceiro aceitou» já não saem um a um: diz-os a rotina das propostas (d114). */
export const A_ROTINA_DIZ_AS_PROPOSTAS = true;

/** A 1.ª mensagem: 1 h depois da 1.ª proposta (ou quando chega a 2.ª). */
export const MINUTOS_ATE_A_PRIMEIRA_MENSAGEM = 60;

/** A espécie com que fica escrito, no registo do assistente, o que já foi dito ao cliente. */
export const ESPECIE_DAS_PROPOSTAS_DITAS = "propostas_ditas";

export type PropostaCurta = {
  negociacaoId: number | null;
  parceiro: string;
  /** Sem IVA (o que o cliente paga antes do imposto). */
  semIva: number;
  /** Com IVA — o total a pagar. */
  total: number;
  /** O parceiro é isento: o IVA é só o da taxa da plataforma. */
  isento?: boolean;
  /** O parceiro aceitou o valor que o cliente propôs. */
  aceitou?: boolean;
  /** A nota do parceiro (só com avaliações). */
  nota?: { media: number; quantas: number } | null;
  /** d118: entulho de um parceiro sem guia verificada — leva a linha do Jurídico. */
  semGuia?: boolean;
  /** d118: entulho de um parceiro com a guia verificada. */
  comGuia?: boolean;
  /**
   * d123: o parceiro tem as três confirmações (o campo `verificado`, `SQL_DO_VERIFICADO`).
   * A mensagem variada só diz «verificado(s)» quando todos os que vão nela o são.
   */
  verificado?: boolean;
};

export type DadosDaMensagemCurta = {
  pedidoId: number;
  nome?: string | null;
  /** O serviço em palavras: «recolha de monos». */
  servico?: string | null;
  propostas: readonly PropostaCurta[];
  agora: Date;
  /** Por carga ou por hora; null pelo trabalho todo. */
  unidade?: "carga" | "hora" | null;
  /** É a primeira mensagem das propostas deste pedido. */
  primeira: boolean;
};

const c2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/** «123 €», «46,04 €». */
export function eurosCurtos(v: number): string {
  const n = c2(v);
  return Number.isInteger(n) ? `${n} €` : `${n.toFixed(2).replace(".", ",")} €`;
}

/**
 * O VALOR NUMA LINHA: «98,40 € (80 € + IVA)»; um isento, «86,96 € (85 € +
 * 1,96 € de IVA)»; sem IVA nenhum, só o total. O com IVA nunca sem o sem IVA
 * ao lado (a regra p da orquestra).
 */
export function valorCurto(p: Pick<PropostaCurta, "semIva" | "total" | "isento">, unidade?: "carga" | "hora" | null): string {
  const por = unidade === "carga" ? " por carga" : unidade === "hora" ? " por hora" : "";
  const iva = c2(p.total - p.semIva);
  if (iva < 0.005) return `${eurosCurtos(p.total)}${por}`;
  if (p.isento) return `${eurosCurtos(p.total)}${por} (${eurosCurtos(p.semIva)} + ${eurosCurtos(iva)} de IVA)`;
  return `${eurosCurtos(p.total)}${por} (${eurosCurtos(p.semIva)} + IVA)`;
}

/** A mais barata primeiro (pelo total); o empate, pela ordem de chegada. */
export function pelaMaisBarata<P extends Pick<PropostaCurta, "total">>(lista: readonly P[]): P[] {
  return lista.map((p, i) => ({ p, i })).sort((a, b) => a.p.total - b.p.total || a.i - b.i).map(({ p }) => p);
}

/** «Bom dia, Ana!» — pela hora de Lisboa. */
export function cumprimento(agora: Date, nome?: string | null): string {
  const h = Number(horaEmLisboa(agora).slice(0, 2));
  const ola = h < 13 ? "Bom dia" : h < 20 ? "Boa tarde" : "Boa noite";
  const p = String(nome ?? "").trim().split(/\s+/)[0] ?? "";
  const primeiro = p.length >= 2 && /^[\p{L}'’-]+$/u.test(p) ? `${p.charAt(0).toUpperCase()}${p.slice(1).toLowerCase()}` : "";
  return primeiro ? `${ola}, ${primeiro}!` : `${ola}!`;
}

export const QUER_AVANCAR = "Quer avançar?";
export const E_SO_RESPONDER_1 = "É só responder 1.";
export const PODEM_CHEGAR_MAIS = "Se preferir, espere um pouco, que podem chegar mais.";
export const QUAL_PREFERE = "Qual prefere?";
export const RESPONDA_COM_O_NUMERO = "Responda com o número.";
/** d118: ao lado das propostas de entulho com guia, quando a lista tem as duas. */
export const COM_GUIA = ", com guia";

const limpo = (t: string) => t.replace(/\s+/g, " ").trim().replace(/\.+$/, "");

function notaCurta(n: PropostaCurta["nota"]): string {
  if (!n || !Number.isFinite(n.media) || !Number.isInteger(n.quantas) || n.quantas <= 0) return "";
  const media = (Math.round(n.media * 10) / 10).toFixed(1).replace(".", ",");
  return `Tem nota ${media} em ${n.quantas} ${n.quantas === 1 ? "avaliação" : "avaliações"}.`;
}

const doPedido = (d: Pick<DadosDaMensagemCurta, "pedidoId" | "servico">) =>
  `o seu pedido #${d.pedidoId}${d.servico?.trim() ? ` (${d.servico.trim()})` : ""}`;

/**
 * A MENSAGEM DAS PROPOSTAS — curta, humana, e a que a d111 lê.
 *
 *   uma:     «Bom dia, Ana! 😊 Já tem a primeira proposta para o seu pedido #812
 *             (recolha de monos): 98,40 € (80 € + IVA), do parceiro X. Tem nota 4,8
 *             em 12 avaliações. Quer avançar? É só responder 1. Se preferir, espere
 *             um pouco, que podem chegar mais.»
 *   aceitou: «Boa tarde, Ana! Boas notícias: o parceiro X aceitou os 98,40 €
 *             (80 € + IVA) que propôs para o seu pedido #812 (recolha de monos).
 *             Quer avançar? É só responder 1.»
 *   várias:  «Bom dia, André! Já tem 2 propostas para o seu pedido #812 (recolha de
 *             móveis):
 *             1) X: 98,40 € (80 € + IVA)
 *             2) Y: 123 € (100 € + IVA)
 *             Qual prefere? Responda com o número.»
 */
export function mensagemCurtaDasPropostas(d: DadosDaMensagemCurta): string {
  const lista = pelaMaisBarata(d.propostas);
  const ola = cumprimento(d.agora, d.nome);
  if (lista.length === 0) return "";
  if (lista.length === 1) {
    const p = lista[0];
    const valor = valorCurto(p, d.unidade);
    if (p.aceitou) {
      return [
        `${ola} Boas notícias: o parceiro ${limpo(p.parceiro)} aceitou os ${valor} que propôs para ${doPedido(d)}.`,
        QUER_AVANCAR,
        E_SO_RESPONDER_1,
      ].join(" ");
    }
    return [
      `${ola} 😊 Já tem ${d.primeira ? "a primeira" : "uma"} proposta para ${doPedido(d)}: ${valor}, do parceiro ${limpo(p.parceiro)}.`,
      // d118: o aviso da guia ANTES de aceitar, junto à proposta de entulho de um parceiro sem guia.
      p.semGuia ? AVISO_DA_GUIA_NO_ENTULHO : "",
      notaCurta(p.nota),
      QUER_AVANCAR,
      E_SO_RESPONDER_1,
      d.primeira ? PODEM_CHEGAR_MAIS : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  return [
    `${ola} Já tem ${lista.length} propostas para ${doPedido(d)}:`,
    // d118: cada proposta de entulho sem guia leva a linha do Jurídico; com os dois tipos, «com guia» ao lado das que a têm.
    ...lista.flatMap((p, i) => {
      const comGuia = p.comGuia && lista.some((x) => x.semGuia) ? COM_GUIA : "";
      const linha = `${i + 1}) ${limpo(p.parceiro)}: ${valorCurto(p, d.unidade)}${comGuia}`;
      return p.semGuia ? [linha, AVISO_DA_GUIA_NO_ENTULHO] : [linha];
    }),
    `${QUAL_PREFERE} ${RESPONDA_COM_O_NUMERO}`,
  ].join("\n");
}

/** Uma linha da lista, como a d111 a lê (`LinhaDaLista`). */
export type LinhaCurta = { n: number; parceiro: string; valor: string };

/**
 * A MENSAGEM CURTA, LIDA DO TEXTO QUE SAIU (o registo fica em português) — o
 * pedido e as linhas pela ordem em que o cliente as viu; ou null.
 */
export function lerAMensagemCurtaDasPropostas(texto: string | null | undefined): { pedidoId: number; linhas: LinhaCurta[] } | null {
  const t = String(texto ?? "").replace(/\r/g, "");
  // d123: as mensagens variadas lêem-se primeiro.
  const variada = lerAMensagemVariada(t);
  if (variada) return variada;
  const uma = /Já tem (?:a primeira|uma) proposta para o seu pedido #(\d+)(?: \([^)]*\))?: (.+?), do parceiro (.+?)\.(?:\s|$)/.exec(t);
  if (uma && t.includes(E_SO_RESPONDER_1)) {
    return { pedidoId: Number(uma[1]), linhas: [{ n: 1, parceiro: uma[3].trim(), valor: uma[2].trim() }] };
  }
  const aceitou = /Boas notícias: o parceiro (.+?) aceitou os (.+?) que propôs para o seu pedido #(\d+)\b/.exec(t);
  if (aceitou && t.includes(E_SO_RESPONDER_1)) {
    return { pedidoId: Number(aceitou[3]), linhas: [{ n: 1, parceiro: aceitou[1].trim(), valor: aceitou[2].trim() }] };
  }
  // d118: a pergunta da guia antes de fechar — o «1» fecha.
  const daGuia = lerAPerguntaDaGuia(t);
  if (daGuia) return { pedidoId: daGuia.pedidoId, linhas: [{ n: 1, parceiro: daGuia.parceiro, valor: "" }] };
  const varias = /Já tem \d+ propostas para o seu pedido #(\d+)\b/.exec(t);
  if (!varias || !t.includes(`${QUAL_PREFERE} ${RESPONDA_COM_O_NUMERO}`)) return null;
  const linhas: LinhaCurta[] = [];
  for (const l of t.split("\n")) {
    const m = /^(\d{1,2})\) (.+?): (\d[\d.]*(?:,\d{2})? €.*)$/.exec(l.trim());
    if (m) linhas.push({ n: Number(m[1]), parceiro: m[2].trim(), valor: m[3].replace(COM_GUIA, "").trim() });
  }
  return linhas.length > 0 ? { pedidoId: Number(varias[1]), linhas } : null;
}

/** O total de um valor escrito — «98,40 € (80 € + IVA)», «75,00 € + IVA = 92,07 €», «92,07 €» — ou null. */
export function totalDoValorEscrito(valor: string | null | undefined): number | null {
  const t = String(valor ?? "");
  const num = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
  const depoisDoIgual = /=\s*(\d[\d.]*(?:,\d{1,2})?)\s*€/.exec(t);
  const primeiro = /(\d[\d.]*(?:,\d{1,2})?)\s*€/.exec(t);
  const m = depoisDoIgual ?? primeiro;
  if (!m) return null;
  const n = num(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** O nome do parceiro está no texto que saiu? (sem acentos nem maiúsculas) */
export function oTextoNomeia(texto: string, parceiro: string): boolean {
  const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const p = n(parceiro);
  return p.length >= 3 && n(texto).includes(p);
}

/* ── d123 (25-11-2026): as mensagens das propostas, VARIADAS ─────────────── */

/**
 * AS PROPOSTAS AO CLIENTE, DITAS DE VÁRIAS MANEIRAS — 25-11-2026 (decisão
 * d123, CEO e dono). Três tipos de mensagem, cada um com 5 maneiras de o dizer:
 *
 *   · «u» — a 1.ª mensagem, com uma proposta;
 *   · «v» — a 1.ª mensagem, com duas ou mais;
 *   · «n» — uma proposta NOVA, depois disso: só a nova (ou as novas), nunca a
 *     lista toda outra vez.
 *
 * Sempre o mesmo esqueleto, para a d111 ler a escolha e as traduções fixas
 * servirem: 1.ª linha o cumprimento e a abertura (com «#pedido (serviço)»),
 * depois uma linha por proposta («1) Parceiro: 98,40 € (80 € + IVA)»), e a
 * última linha com a confiança e o pedido de resposta («responda 1», «responda
 * com o número»). Os pormenores (pagamento, faturas) continuam só na
 * confirmação, depois de aceitar.
 *
 * A maneira escolhe-se pelo pedido e pelo n.º da mensagem
 * (`escolherAVariante`), e nunca a mesma duas vezes seguidas ao mesmo cliente.
 */
export type TipoDaMensagemDasPropostas = "u" | "v" | "n";

/** Quantas maneiras de dizer cada tipo. */
export const VARIANTES_POR_TIPO = 5;

/**
 * A abertura: `p` é «seu pedido #682 (recolha de monos)», `n` quantas vão, `v`
 * se todos os parceiros da mensagem têm as três confirmações — só então se diz
 * «verificado(s)» (a regra q da orquestra, «Selo só nos que tiverem os 3»).
 */
type Abertura = (p: string, n: number, v: boolean) => string;
type Fecho = { uma: string; varias: string };

const ABERTURAS: Record<TipoDaMensagemDasPropostas, readonly Abertura[]> = {
  u: [
    (p, _n, v) => (v ? `Já tem a primeira proposta para o ${p}, de um parceiro verificado:` : `Já tem a primeira proposta para o ${p}:`),
    (p) => `Boas notícias: chegou a primeira proposta para o ${p}:`,
    (p, _n, v) => (v ? `O ${p} já tem uma proposta de um parceiro verificado:` : `O ${p} já tem uma proposta:`),
    (p, _n, v) =>
      v ? `Há novidades para o ${p}, com a proposta de um parceiro verificado:` : `Há novidades para o ${p}, com a primeira proposta:`,
    (p, _n, v) => (v ? `Um parceiro verificado já respondeu ao ${p}:` : `Um parceiro já respondeu ao ${p}:`),
  ],
  v: [
    (p, n, v) => (v ? `Já tem ${n} propostas de parceiros verificados para o ${p}:` : `Já tem ${n} propostas para o ${p}:`),
    (p, n) => `Boas notícias: o ${p} já tem ${n} propostas:`,
    (p, n, v) => (v ? `Chegaram ${n} propostas de parceiros verificados para o ${p}:` : `Chegaram ${n} propostas para o ${p}:`),
    (p, n) => `Aqui ficam as ${n} propostas para o ${p}, a começar pela mais em conta:`,
    (p, n, v) =>
      v ? `Os parceiros verificados já responderam ao ${p} com ${n} propostas:` : `Os parceiros já responderam ao ${p} com ${n} propostas:`,
  ],
  n: [
    (p, n) => (n === 1 ? `Chegou mais uma proposta para o ${p}:` : `Chegaram mais ${n} propostas para o ${p}:`),
    (p, n, v) =>
      n === 1
        ? v
          ? `Novidade no ${p}, mais uma proposta de um parceiro verificado:`
          : `Novidade no ${p}, mais uma proposta:`
        : v
          ? `Novidade no ${p}, mais ${n} propostas de parceiros verificados:`
          : `Novidade no ${p}, mais ${n} propostas:`,
    (p, n, v) =>
      n === 1
        ? `Mais um parceiro${v ? " verificado" : ""} respondeu ao ${p}:`
        : `Mais ${n} parceiros${v ? " verificados" : ""} responderam ao ${p}:`,
    (p, n) => (n === 1 ? `Há uma proposta nova para o ${p}:` : `Há ${n} propostas novas para o ${p}:`),
    (p, n) => (n === 1 ? `Acabou de chegar uma proposta nova para o ${p}:` : `Acabaram de chegar ${n} propostas novas para o ${p}:`),
  ],
};

/** A última linha: a confiança, a urgência honesta e o pedido de resposta — com uma proposta («uma») ou várias. */
const FECHOS: Record<TipoDaMensagemDasPropostas, readonly Fecho[]> = {
  u: [
    { uma: "Não paga nada adiantado: paga ao parceiro no fim do trabalho. Quer avançar? Responda 1.", varias: "" },
    { uma: "Sem nada adiantado, paga ao parceiro só no fim. Para avançar, responda 1.", varias: "" },
    { uma: "A agenda do parceiro vai enchendo: se lhe servir, responda 1. Não paga nada adiantado.", varias: "" },
    { uma: "Paga ao parceiro no fim, sem nada adiantado. Responda 1 para avançar, ou aguarde por mais propostas.", varias: "" },
    { uma: "Se lhe agradar, é só responder 1. Não paga nada adiantado e paga ao parceiro no fim. 😊", varias: "" },
  ],
  v: [
    { uma: "", varias: "Qual prefere? Responda com o número. Não paga nada adiantado: paga ao parceiro no fim." },
    { uma: "", varias: "Responda com o número da que preferir. Sem nada adiantado, paga ao parceiro só no fim." },
    { uma: "", varias: "A agenda dos parceiros vai enchendo: diga-me o número da que prefere. Não paga nada adiantado." },
    { uma: "", varias: "Qual lhe serve melhor? Responda com o número. Paga ao parceiro no fim, sem nada adiantado." },
    { uma: "", varias: "É só responder com o número da que escolher. Paga ao parceiro no fim do trabalho. 😊" },
  ],
  n: [
    {
      uma: "Se preferir esta, responda 1. Paga ao parceiro no fim, sem nada adiantado.",
      varias: "Se preferir uma destas, responda com o número. Paga ao parceiro no fim, sem nada adiantado.",
    },
    { uma: "Interessa-lhe? Responda 1. Não paga nada adiantado.", varias: "Interessa-lhe alguma? Responda com o número. Não paga nada adiantado." },
    {
      uma: "A agenda do parceiro vai enchendo: se lhe servir, responda 1.",
      varias: "A agenda dos parceiros vai enchendo: se uma lhe servir, responda com o número.",
    },
    {
      uma: "Para ficar com esta, responda 1; para outra, diga o nome do parceiro.",
      varias: "Para ficar com uma destas, responda com o número; para outra, diga o nome do parceiro.",
    },
    {
      uma: "Se for a sua escolha, é só responder 1. Paga ao parceiro só no fim. 😊",
      varias: "Se for a sua escolha, é só responder com o número. Paga ao parceiro só no fim. 😊",
    },
  ],
};

/** Todas as últimas linhas, como saem — é por elas que se reconhece a mensagem (e as traduções fixas têm-nas todas). */
export const FECHOS_DAS_PROPOSTAS: readonly string[] = Object.values(FECHOS)
  .flatMap((l) => l.flatMap((f) => [f.uma, f.varias]))
  .filter(Boolean);

/** O tipo da mensagem: a nova, ou a 1.ª com uma ou com várias. */
export function tipoDaMensagem(nova: boolean, quantas: number): TipoDaMensagemDasPropostas {
  return nova ? "n" : quantas === 1 ? "u" : "v";
}

/**
 * A MANEIRA DE DIZER — pura e determinística: pelo pedido e pelo n.º da
 * mensagem (`(pedido + n) % 5`); se der a mesma da última mensagem a este
 * cliente, a seguinte. Devolve o código («u3», «n1»).
 */
export function escolherAVariante(
  tipo: TipoDaMensagemDasPropostas,
  pedidoId: number,
  numeroDaMensagem: number,
  anterior?: string | null,
): string {
  const base = Math.abs(Math.trunc(Number(pedidoId) || 0)) + Math.max(0, Math.trunc(Number(numeroDaMensagem) || 0));
  let i = base % VARIANTES_POR_TIPO;
  if (`${tipo}${i + 1}` === String(anterior ?? "").trim()) i = (i + 1) % VARIANTES_POR_TIPO;
  return `${tipo}${i + 1}`;
}

/** O código («u3») → o índice; um código de outro tipo, ou estragado, dá a 1.ª maneira. */
function indiceDoCodigo(codigo: string, tipo: TipoDaMensagemDasPropostas): number {
  const m = /^([uvn])([1-9])$/.exec(String(codigo ?? "").trim());
  if (!m || m[1] !== tipo) return 0;
  return Math.min(VARIANTES_POR_TIPO, Number(m[2])) - 1;
}

export type DadosDaMensagemVariada = Omit<DadosDaMensagemCurta, "primeira"> & {
  /** Só as propostas novas (depois de a 1.ª mensagem ter saído). */
  nova: boolean;
  /** O código de `escolherAVariante`. */
  variante: string;
};

/**
 * A MENSAGEM DAS PROPOSTAS (d123) — 3 a 5 linhas: o cumprimento e a abertura,
 * uma linha por proposta (a mais barata primeiro) e o fecho. O valor com IVA
 * leva sempre o sem IVA ao lado; um emoji no máximo; «parceiro», nunca
 * «profissional».
 */
export function mensagemDasPropostasVariada(d: DadosDaMensagemVariada): string {
  const lista = pelaMaisBarata(d.propostas);
  if (lista.length === 0) return "";
  const tipo = tipoDaMensagem(d.nova, lista.length);
  const i = indiceDoCodigo(d.variante, tipo);
  const pedido = `seu pedido #${d.pedidoId}${d.servico?.trim() ? ` (${d.servico.trim()})` : ""}`;
  const verificados = lista.every((p) => p.verificado === true);
  const abertura = ABERTURAS[tipo][i](pedido, lista.length, verificados);
  const fecho = lista.length === 1 ? FECHOS[tipo][i].uma : FECHOS[tipo][i].varias;
  const linhas = lista.flatMap((p, k) => {
    const comGuia = p.comGuia && lista.some((x) => x.semGuia) ? COM_GUIA : "";
    return [
      `${k + 1}) ${limpo(p.parceiro)}: ${valorCurto(p, d.unidade)}${comGuia}`,
      // d118: o aviso da guia ANTES de aceitar, junto à proposta de entulho de um parceiro sem guia.
      p.semGuia ? AVISO_DA_GUIA_NO_ENTULHO : "",
      p.aceitou ? `O parceiro ${limpo(p.parceiro)} aceitou o valor que propôs.` : "",
      lista.length === 1 ? notaCurta(p.nota) : "",
    ].filter(Boolean);
  });
  return [`${cumprimento(d.agora, d.nome)} ${abertura}`, ...linhas, fecho].join("\n");
}

/** A mensagem variada, lida do texto que saiu: o pedido e as linhas numeradas; ou null. */
function lerAMensagemVariada(t: string): { pedidoId: number; linhas: LinhaCurta[] } | null {
  if (!FECHOS_DAS_PROPOSTAS.some((f) => t.includes(f))) return null;
  const cabeca = /#(\d+)\b/.exec(t.split("\n")[0] ?? "");
  if (!cabeca) return null;
  const linhas: LinhaCurta[] = [];
  for (const l of t.split("\n")) {
    const m = /^(\d{1,2})\) (.+?): (\d[\d.]*(?:,\d{2})? €.*)$/.exec(l.trim());
    if (m) linhas.push({ n: Number(m[1]), parceiro: m[2].trim(), valor: m[3].replace(COM_GUIA, "").trim() });
  }
  return linhas.length > 0 ? { pedidoId: Number(cabeca[1]), linhas } : null;
}
