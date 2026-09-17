import crypto from "node:crypto";
import { idDoIdentificador } from "./eupago";

/**
 * O WEBHOOK DO euPAGO — a única forma de saber que um cliente pagou.
 *
 * Fase 2 do `docs/plano-pagamentos-eupago.md`, ponto 2.3. Puro: recebe texto e
 * devolve factos. Quem grava é a rota.
 *
 * TRÊS COISAS ACONTECEM SEMPRE, MAIS CEDO OU MAIS TARDE, e as defesas não são
 * opcionais:
 *
 *   · CHEGA DUAS VEZES — o euPago repete de 2 em 2 minutos, 3 vezes, e depois
 *     de hora a hora durante 24 horas, até lhe responderem 200. A defesa é o
 *     índice único do `trid` na base, não um `if` neste ficheiro;
 *   · CHEGA DE QUEM NÃO DEVIA — sem assinatura verificada, quem descobrir o
 *     endereço dá trabalhos por pagos. A defesa é este ficheiro;
 *   · NÃO CHEGA — e o cliente pagou e o ecrã diz que não. A defesa é a
 *     sondagem de recurso, que pergunta ao euPago pelo que ficou pendente.
 *
 * E UMA QUARTA, QUE É A MAIS TRAIÇOEIRA: chega a dizer que se pagou OUTRO
 * valor. Um aviso de «pago 5 €» num trabalho de 105 € não é um pagamento — é
 * meio pagamento, ou um engano, ou um ataque. Este ficheiro devolve o valor
 * que veio; quem chama TEM de o comparar com o que pediu. Ver `confereComOPedido`.
 */

/**
 * A ASSINATURA. Sem isto, o endereço é um botão de «dar por pago» aberto ao
 * mundo — e o endereço de um webhook não é um segredo: anda em registos, em
 * ecrãs de configuração e na barra de endereços de quem o configurou.
 *
 * O euPago documenta-a em PHP:
 *
 *     hash_hmac('sha256', $data, $key, true)   // 32 bytes crus
 *     hash_equals($gerada, base64_decode($assinatura))
 *
 * Ou seja: HMAC-SHA256 do CORPO CRU, e o cabeçalho traz o resultado em
 * base64. É o corpo cru e não o JSON reserializado — dois JSON iguais podem
 * ter bytes diferentes (espaços, ordem das chaves, acentos escapados), e
 * assinar a nossa versão em vez da deles falha sempre.
 *
 * ACEITA-SE TAMBÉM HEXADECIMAL, e não é desleixo. A documentação é um excerto
 * de PHP, não uma especificação, e já esteve desactualizada noutros pontos.
 * As duas codificações são do MESMO resumo: quem não tiver a chave não produz
 * nenhuma delas, por isso aceitar as duas não abre porta nenhuma — só evita
 * uma noite a debitar 401 a toda a gente se eles mudarem de ideias.
 */
export function assinaturaValida(
  corpoCru: string,
  cabecalho: string | null | undefined,
  segredo: string | null | undefined,
): boolean {
  if (!segredo || !cabecalho) return false;
  const recebida = cabecalho.trim();
  if (recebida === "") return false;

  const esperada = crypto.createHmac("sha256", segredo).update(corpoCru, "utf8").digest();

  for (const codificacao of ["base64", "hex"] as const) {
    try {
      const bytes = Buffer.from(recebida, codificacao);
      // `timingSafeEqual` rebenta com tamanhos diferentes, e um resumo
      // SHA-256 tem sempre 32 bytes: o tamanho errado já é resposta.
      if (bytes.length === esperada.length && crypto.timingSafeEqual(bytes, esperada)) {
        return true;
      }
    } catch {
      // Codificação que não descodifica — passa à seguinte.
    }
  }
  return false;
}

/**
 * O que aconteceu à transacção.
 *
 * O euPago escreve os estados de duas maneiras conforme a página: `Paid` na
 * documentação do corpo, `PAID` na configuração do canal. Aceitam-se as duas —
 * e nenhuma outra.
 */
export type EstadoDoAviso = "pago" | "reembolsado" | "erro" | "cancelado" | "expirado";

const ESTADOS: Record<string, EstadoDoAviso> = {
  paid: "pago",
  refund: "reembolsado",
  refunded: "reembolsado",
  error: "erro",
  cancel: "cancelado",
  canceled: "cancelado",
  cancelled: "cancelado",
  expired: "expirado",
};

export type AvisoDoEupago = {
  /** O identificador da transacção do lado deles. É a chave da idempotência. */
  trid: string;
  /** O nosso identificador, tal como veio. */
  identificador: string | null;
  /** O id da nossa linha em `pagamentos`, se o identificador for nosso. */
  pagamentoId: number | null;
  estado: EstadoDoAviso;
  /** «Multibanco», «Mbway», … tal como veio. */
  metodo: string | null;
  /** O valor que ELES dizem ter sido pago. A confirmar contra o nosso. */
  valor: number | null;
  moeda: string | null;
  /** O que o euPago cobrou pela operação. Sai da parte da CLYON. */
  comissao: number | null;
  quando: Date | null;
  entidade: string | null;
  referencia: string | null;
};

export type LeituraDoAviso =
  | { ok: true; aviso: AvisoDoEupago }
  /**
   * `retentar` decide o código de resposta, e a decisão importa:
   *
   *   true  → 500. O euPago volta durante 24 horas e manda-nos o aviso de
   *           «Erro de Webhook 2.0». É o que se quer quando o problema é
   *           NOSSO e tem conserto — um corpo que não sabemos ler ainda.
   *   false → 200. Percebemos o aviso e não há nada a fazer com ele. Repetir
   *           dava exactamente o mesmo, e deixar o euPago a tentar 24 horas
   *           por um aviso que não nos diz respeito é ruído dos dois lados.
   */
  | { ok: false; porque: string; retentar: boolean };

function texto(v: unknown): string | null {
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/** Um valor de dinheiro, venha ele como número, como texto ou dentro de `{ value }`. */
function dinheiro(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return dinheiro(o.value ?? o.amount ?? o.valor);
  }
  return null;
}

function moedaDe(v: unknown): string | null {
  if (v && typeof v === "object") {
    return texto((v as Record<string, unknown>).currency);
  }
  return null;
}

function quando(v: unknown): Date | null {
  const t = texto(v);
  if (!t) return null;
  // «2026-09-17 14:32:05» não é ISO e o `Date` do Node aceita-o na mesma em
  // algumas plataformas e noutras não. Um T no meio resolve as duas.
  const d = new Date(/^\d{4}-\d{2}-\d{2} /.test(t) ? t.replace(" ", "T") + "Z" : t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * O corpo do aviso, lido.
 *
 * O campo chama-se `transactions` (plural) e a documentação descreve-o como um
 * objecto. Lê-se das duas maneiras porque um nome no plural acaba, mais dia
 * menos dia, a trazer uma lista — e no dia em que trouxer, é melhor que isto
 * leia a primeira do que estoire.
 */
export function lerAvisoDoEupago(json: unknown): LeituraDoAviso {
  const raiz = (json ?? {}) as Record<string, unknown>;

  /*
   * ENCRIPTADO E NÓS SEM SABER LER — 500, e é a resposta certa.
   *
   * Começámos com «Encriptar Webhook: Não» de propósito (uma coisa de cada
   * vez). Se um dia alguém o ligar no backoffice, os avisos passam a vir só
   * com `data` — e a pior coisa possível seria responder 200 e perder
   * silenciosamente todos os pagamentos até alguém reparar. A 500, o euPago
   * insiste 24 horas e manda o aviso de erro por email.
   */
  if (raiz.transactions == null && typeof raiz.data === "string") {
    return {
      ok: false,
      porque:
        "O aviso veio encriptado e a plataforma ainda não sabe abri-lo. " +
        "Desligue «Encriptar Webhook» no canal do euPago.",
      retentar: true,
    };
  }

  const bruto = Array.isArray(raiz.transactions) ? raiz.transactions[0] : raiz.transactions;
  if (!bruto || typeof bruto !== "object") {
    return { ok: false, porque: "O aviso não traz transacção nenhuma.", retentar: true };
  }
  const t = bruto as Record<string, unknown>;

  const trid = texto(t.trid);
  if (!trid) {
    /*
     * SEM `trid` NÃO HÁ IDEMPOTÊNCIA, e sem idempotência não se credita nada.
     *
     * É ele a chave única na base que faz um aviso repetido não contar duas
     * vezes. Aceitar um aviso sem `trid` era abrir mão da única defesa contra
     * a repetição — num sítio onde a repetição é garantida por desenho.
     */
    return { ok: false, porque: "O aviso não traz trid.", retentar: true };
  }

  const estado = ESTADOS[(texto(t.status) ?? "").toLowerCase()];
  if (!estado) {
    return {
      ok: false,
      porque: `Estado desconhecido: ${texto(t.status) ?? "(vazio)"}.`,
      retentar: false,
    };
  }

  const identificador = texto(t.identifier);
  return {
    ok: true,
    aviso: {
      trid,
      identificador,
      pagamentoId: idDoIdentificador(identificador),
      estado,
      metodo: texto(t.method),
      valor: dinheiro(t.amount),
      moeda: moedaDe(t.amount),
      comissao: dinheiro(t.fees),
      quando: quando(t.date),
      entidade: texto(t.entity),
      referencia: texto(t.reference),
    },
  };
}

/**
 * Margem de cêntimo na comparação de valores.
 *
 * Não é tolerância a erros: é que o valor viaja como número de vírgula
 * flutuante e 105,00 pode voltar como 104,999999. Um cêntimo cobre isso e não
 * cobre mais nada — um pagamento a menos de um cêntimo do combinado é o mesmo
 * pagamento; a dois, já não é.
 */
export const MARGEM_DE_CENTIMO = 0.011;

/**
 * O QUE ELES DIZEM BATE COM O QUE NÓS PEDIMOS? — `null` quando sim.
 *
 * É a defesa contra o caso mais traiçoeiro de todos, e o único que uma
 * assinatura válida não apanha: um aviso legítimo, de uma transacção real, com
 * um valor que não é o nosso. Acontece de três maneiras, e nenhuma é rara:
 *
 *   · o cliente pagou uma referência ANTIGA, de um valor que entretanto mudou;
 *   · a referência foi emitida por outro produto na mesma conta do euPago;
 *   · alguém percebeu que basta acertar no identificador.
 *
 * Dar por pago um trabalho de 105 € com um aviso de 5 € é perder 100 € e
 * ainda mandar o profissional trabalhar.
 */
export function confereComOPedido(
  aviso: AvisoDoEupago,
  esperado: { pagamentoId: number; valor: number },
): string | null {
  if (aviso.pagamentoId !== esperado.pagamentoId) {
    return `O aviso é do pagamento ${aviso.pagamentoId ?? "(nenhum)"} e não do ${esperado.pagamentoId}.`;
  }
  if (aviso.moeda != null && aviso.moeda.toUpperCase() !== "EUR") {
    return `O aviso vem em ${aviso.moeda} e o pedido era em euros.`;
  }
  if (aviso.valor == null) {
    return "O aviso não diz quanto foi pago.";
  }
  if (Math.abs(aviso.valor - esperado.valor) > MARGEM_DE_CENTIMO) {
    return `O aviso diz ${aviso.valor.toFixed(2)} € e o pedido era de ${esperado.valor.toFixed(2)} €.`;
  }
  return null;
}
