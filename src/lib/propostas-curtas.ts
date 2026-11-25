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
