import { HORAS_PARA_RESPONDER, JANELA_DE_RESPOSTA } from "./prazo-de-resposta-do-parceiro";
import {
  diaEHoraDoPrazo,
  eEscolhida,
  horaEMinutos as hm,
  instanteOuNull as instante,
  oClientePediuAClyon,
  semRespostaDosEscolhidos,
  temResposta,
  type CanalDoAviso,
  type EscolhidosDoPedido,
  type MarcaSemResposta,
  type NegociacaoDoPedido,
  type SemResposta,
} from "./escolhidos-sem-resposta-regra";

/**
 * OS ESCOLHIDOS SEM RESPOSTA — O QUE A EQUIPA LÊ (d6, 11-11-2026).
 *
 * O selo e a linha do pedido na Mesa, os botões da equipa, o histórico do
 * pedido e o aviso à equipa. Aqui diz-se «escolhidos» e «profissional», como
 * no backoffice sempre se disse; o que o cliente lê está em
 * `escolhidos-sem-resposta.ts`, que é também a porta por onde isto se importa.
 */

/** A1. O selo do pedido na Mesa. */
export const SELO_SEM_RESPOSTA = "escolhidos sem resposta";
/** B. O título do tipo de aviso à equipa. */
export const TITULO_DO_AVISO_SEM_RESPOSTA = "Escolhidos sem resposta";
/** O título do grupo no cartão «Do nosso lado». */
export const TITULO_DO_GRUPO_SEM_RESPOSTA = "Mudanças: escolhidos sem resposta";

/** A3. O rótulo da negociação na Mesa, em vez de «prazo passou …». */
export const rotuloDoPrazoTerminado = (prazo: Date) => `sem resposta · prazo terminou ${diaEHoraDoPrazo(prazo)}`;

/** A4. Os botões da equipa no cartão do pedido. */
export const BOTOES_DA_MESA = Object.freeze({
  enviarAMais: "Enviar a mais profissionais",
  dicaDoEnviarDesligado: "Só quando o cliente pedir. Se pediu por telefone ou WhatsApp, registe-o primeiro.",
  clientePediu: "O cliente pediu que procurássemos",
  perguntaDoRegisto: "Registar que o cliente pediu à CLYON que procure mais parceiros?",
  registar: "Registar",
  voltar: "Voltar",
});

/* ── A2. A linha por baixo do selo ──────────────────────────────────────── */

const FALTA_ENVIAR = "Falta enviar o pedido a mais profissionais.";

/** A linha de quem não respondeu, conforme o caso e o aviso ao cliente. */
function linhaDeBase(s: Pick<SemResposta, "caso" | "prazo" | "escolhidos">, marca: MarcaSemResposta | null): string {
  const n = s.escolhidos;
  const ate = diaEHoraDoPrazo(s.prazo);
  const calou = n === 1 ? `O escolhido não respondeu até ${ate}.` : `Nenhum dos ${n} escolhidos respondeu até ${ate}.`;
  const quem = s.caso === "disseram_que_nao" ? (n === 1 ? "O escolhido disse que não." : `Os ${n} escolhidos disseram que não.`) : calou;
  if (!marca || marca.saiu == null) {
    return `${quem} Cliente ainda por avisar: o aviso sai na passagem seguinte, entre as ${JANELA_DE_RESPOSTA.abre}h e as ${JANELA_DE_RESPOSTA.fecha}h.`;
  }
  if (marca.saiu === false) return `${calou} O aviso ao cliente NÃO saiu: fale com ele.`;
  return `${quem} Cliente avisado às ${hm(instante(marca.avisadoEm) as Date)}; ainda não disse o que prefere.`;
}

export type EstadoNaMesa = {
  /** O selo âmbar «escolhidos sem resposta» está aceso. */
  selo: boolean;
  /** A linha por baixo do selo (ou sozinha, quando o cliente pediu à CLYON na lista). */
  linha: string | null;
  /** O cliente pediu à CLYON que procure: «Enviar a mais profissionais» fica activo. */
  podeEnviarAMais: boolean;
  /** «O cliente pediu que procurássemos» ainda faz sentido (ainda não está registado). */
  podeRegistarOPedido: boolean;
};

/**
 * O PEDIDO COM ESCOLHIDOS, NA MESA: o selo, a linha e o que os botões da
 * equipa podem fazer. Null num pedido sem parceiros escolhidos pelo cliente.
 */
export function estadoNaMesa(
  negociacoes: readonly NegociacaoDoPedido[],
  e: EscolhidosDoPedido | null | undefined,
  agora: Date,
  pedidoFechado = false,
): EstadoNaMesa | null {
  if (!negociacoes.some(eEscolhida)) return null;
  const pediu = oClientePediuAClyon(e);
  const botoes = { podeEnviarAMais: pediu && !pedidoFechado, podeRegistarOPedido: !pediu && !pedidoFechado };
  if (pedidoFechado) return { selo: false, linha: null, ...botoes };
  const s = semRespostaDosEscolhidos(negociacoes, agora);
  const d = e?.decisao ?? null;

  if (e?.enviadoAMais) {
    const quando = instante(e.enviadoAMais.em) as Date;
    return { selo: false, linha: `Enviado a mais ${e.enviadoAMais.quantos} profissionais às ${hm(quando)}, a pedido do cliente.`, ...botoes };
  }
  if (d?.saida === "pedir_a_clyon") {
    const quando = hm(instante(d.em) as Date);
    const como = d.por === "equipa" ? `registado por ${d.operador ?? "a equipa"} às ${quando}` : `às ${quando}`;
    return { selo: s != null, linha: `O cliente pediu à CLYON que procure mais parceiros (${como}). ${FALTA_ENVIAR}`, ...botoes };
  }
  if (e?.procurarMais) {
    return { selo: s != null, linha: `O cliente pediu também à CLYON que procure mais parceiros. ${FALTA_ENVIAR}`, ...botoes };
  }
  if (!s) {
    // Escolheu outro(s) e o prazo deles ainda corre: o selo apaga-se até esse prazo passar.
    const prazo = d?.saida === "escolher_outro" ? instante(d.prazoEm) : null;
    if (prazo && prazo.getTime() > agora.getTime() && !negociacoes.some(temResposta)) {
      return { selo: false, linha: `O cliente escolheu mais ${d?.nomes?.length || 1}: resposta até ${diaEHoraDoPrazo(prazo)}.`, ...botoes };
    }
    return { selo: false, linha: null, ...botoes };
  }
  if (d?.saida === "esperar") {
    return { selo: true, linha: `O cliente prefere esperar pelos escolhidos (disse-o às ${hm(instante(d.em) as Date)}).`, ...botoes };
  }
  return { selo: true, linha: linhaDeBase(s, e?.marca ?? null), ...botoes };
}

/* ── A5. O histórico do pedido ──────────────────────────────────────────── */

const NOME_DO_CANAL: Record<CanalDoAviso, string> = { whatsapp: "WhatsApp", email: "email", app: "aviso na app" };

export function linhaDoHistoricoSemResposta(s: Pick<SemResposta, "caso" | "prazo">, nomes: readonly string[], canais: readonly CanalDoAviso[]): string {
  const quem = nomes.length > 0 ? ` (${nomes.join(", ")})` : "";
  const como =
    canais.length > 0
      ? `Cliente avisado por ${canais.map((c) => NOME_DO_CANAL[c]).join(", ")}.`
      : "O aviso ao cliente NÃO saiu por nenhum canal: fale com ele.";
  return s.caso === "disseram_que_nao"
    ? `Os escolhidos${quem} disseram que não. ${como}`
    : `Prazo de resposta terminou às ${hm(s.prazo)} sem resposta dos escolhidos${quem}. ${como}`;
}

export const HISTORICO_DO_CLIENTE = Object.freeze({
  esperar: "O cliente respondeu ao aviso: prefere esperar.",
  pedirAClyon: "O cliente respondeu ao aviso: pediu à CLYON que procure mais parceiros.",
});

export const linhaDoHistoricoEscolheuOutro = (nomes: readonly string[], prazo: Date) =>
  `O cliente respondeu ao aviso: escolheu ${nomes.join(", ")}. Prazo de resposta: ${diaEHoraDoPrazo(prazo)} ` +
  `(${HORAS_PARA_RESPONDER} h, entre as ${JANELA_DE_RESPOSTA.abre}h e as ${JANELA_DE_RESPOSTA.fecha}h).`;

export const linhaDoHistoricoRegistadoPelaEquipa = (operador: string) =>
  `${operador} registou que o cliente pediu à CLYON que procure mais parceiros.`;


/* ══ B. O AVISO À EQUIPA ═════════════════════════════════════════════════ */

/** A linha do cartão «Do nosso lado»: «Pedido #610: mudança — …». */
export function oQueDaMesa(s: Pick<SemResposta, "caso" | "escolhidos">): string {
  if (s.caso === "disseram_que_nao") return "mudança — os escolhidos pelo cliente disseram que não";
  return s.escolhidos === 1
    ? `mudança — o escolhido pelo cliente não respondeu em ${HORAS_PARA_RESPONDER} horas`
    : `mudança — nenhum dos ${s.escolhidos} escolhidos pelo cliente respondeu em ${HORAS_PARA_RESPONDER} horas`;
}

export const O_QUE_DA_MESA_QUANDO_PEDIU = "mudança — o cliente pediu à CLYON que procure mais parceiros; falta enviar o pedido";

/** O corpo do aviso à equipa, depois de o cliente ter sido avisado (ou de o aviso ter falhado). */
export function avisoAEquipaSemResposta(numero: number, s: Pick<SemResposta, "caso" | "escolhidos">, avisoAoClienteSaiu: boolean): string {
  if (!avisoAoClienteSaiu) return `#${numero} · Mudança: escolhidos sem resposta e o aviso ao cliente não saiu. Fale com o cliente.`;
  if (s.caso === "disseram_que_nao") return `#${numero} · Mudança: os escolhidos pelo cliente disseram que não. O cliente foi avisado.`;
  return s.escolhidos === 1
    ? `#${numero} · Mudança: o escolhido pelo cliente não respondeu em ${HORAS_PARA_RESPONDER} horas. O cliente foi avisado.`
    : `#${numero} · Mudança: nenhum dos ${s.escolhidos} escolhidos pelo cliente respondeu em ${HORAS_PARA_RESPONDER} horas. O cliente foi avisado.`;
}

/** O segundo aviso, o que pede acção: o cliente pediu à CLYON que procure. */
export const avisoAEquipaClientePediu = (numero: number) =>
  `#${numero} · Mudança: o cliente pediu à CLYON que procure mais parceiros. Falta enviar o pedido.`;

/** A linha do histórico de quem respondeu já depois do prazo. */
export const linhaDaRespostaTardia = (nome: string, quando: Date) => `${nome} respondeu depois do prazo (${hm(quando)}).`;
