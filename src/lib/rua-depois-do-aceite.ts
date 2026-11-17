import { guardarMorada, moradaNaFrase, temPalavraDeRua, type DadosDaRecolha } from "./whatsapp-recolha";
import { andarComLado } from "./pedido-da-recolha";

/*
 * A RUA DEPOIS DO ACEITE — 17-11-2026 (decisão d69).
 *
 * Desde a d48 a Vitória regista o pedido só com a zona (a localidade ou o
 * código postal) e promete «a morada certa fica para quando aceitar uma
 * proposta». Nada o fazia: o parceiro contratado podia ficar só com a terra.
 *
 *   · o pedido registado sem a rua fica marcado «falta a rua» (`faltaARua`);
 *   · quando o cliente aceita uma proposta ou o valor único, a Vitória pede-lhe
 *     UMA vez a rua, o número da porta e o andar, pela conversa em que já está
 *     (`perguntaDaRua`) — antes, relê a conversa: se ele já a escreveu, grava-a
 *     sem perguntar;
 *   · a resposta entra no pedido (a morada e o andar), e o parceiro vê-a pelo
 *     servidor, no campo de morada de sempre (`lerARua`);
 *   · sem resposta em 2 h, a conversa passa à equipa (`oQueFazerComARua`).
 *
 * Puro: chama-o `rua-depois-do-aceite-na-base.ts` (o cérebro do WhatsApp, a
 * ponte e a passagem de 10 em 10 minutos), e os testes.
 */

/** Sem resposta à pergunta da rua há tanto tempo, passa à equipa. */
export const HORAS_PARA_A_RUA = 2;

/**
 * Só os aceites a partir daqui: os aceites de antes da d69 não levam a
 * pergunta (a equipa já os tratou à mão). O selo mostra-os na mesma.
 */
export const PEDE_A_RUA_DESDE = new Date("2026-11-17T00:00:00Z");

/**
 * O PEDIDO FICOU SEM A RUA? A morada vazia, «Oeiras (rua por confirmar)» (a
 * localidade sozinha, ver `moradaSoComALocalidade`), ou só um nome de terra —
 * sem número da porta nem palavra de rua.
 */
export function faltaARua(address: string | null | undefined): boolean {
  const a = (address ?? "").trim();
  if (!a) return true;
  if (/rua por confirmar/i.test(a)) return true;
  return !/\d/.test(a) && !temPalavraDeRua(a);
}

/**
 * A PERGUNTA, UMA VEZ — com o número do pedido. Se o andar já está no pedido,
 * não se pergunta outra vez. Tem tradução fixa (traducoes-fixas-da-vitoria.json).
 */
export function perguntaDaRua(pedidoId: number, jaTemOAndar: boolean): string {
  const oQue = jaTemOAndar ? "a rua e o número da porta" : "a rua, o número da porta e o andar";
  return `Falta-me só a morada certa do pedido #${pedidoId}: ${oQue}, por favor. É o que o parceiro recebe para chegar até si.`;
}

/** O agradecimento, com o que ficou no pedido. Tem molde nas traduções fixas. */
export function ruaAnotada(pedidoId: number, morada: string): string {
  return `Obrigada! Fica anotado no pedido #${pedidoId}: ${morada}. O parceiro recebe-a com o trabalho.`;
}

/** O porquê na Mesa das conversas, quando passa à equipa sem resposta. */
export function motivoDaRuaSemResposta(pedidoId: number): string {
  return `Falta a rua do pedido #${pedidoId} — o cliente aceitou e não respondeu em ${HORAS_PARA_A_RUA} h; pedir-lha`;
}

/** O porquê, quando a Vitória não pode perguntar (a conversa está com a equipa, ou é um trabalho CLYON). */
export function motivoDaRuaPelaEquipa(pedidoId: number): string {
  return `Falta a rua do pedido #${pedidoId} — o cliente aceitou; pedir-lha (a Vitória não pergunta nesta conversa)`;
}

export type RuaLida = {
  /** A rua e o número da porta (sem o andar), como o pedido a guarda. */
  morada: string;
  /** O andar com o lado («3º Esq», «r/c»), quando ele o disse. */
  andar: string | null;
  codigoPostal: string | null;
  localidade: string | null;
};

/**
 * A RESPOSTA À PERGUNTA DA RUA — ou null, se não for uma morada. Uma morada
 * tem uma palavra de rua e um número («Rua das Gaivotas Mansas 3, 2º Dto»), ou
 * começa por ela na linha (`moradaNaFrase`). «Amanhã às 10h», «ok» ou «Qual é
 * o parceiro?» não são moradas: a conversa segue como sempre.
 */
export function lerARua(texto: string | null | undefined): RuaLida | null {
  const t = (texto ?? "").trim();
  if (!t || t.length > 400) return null;
  const candidata = moradaNaFrase(t) ?? (temPalavraDeRua(t) && /\d/.test(t) ? t : null);
  if (!candidata) return null;
  const d: DadosDaRecolha = {};
  guardarMorada(d, candidata);
  const morada = (d.address ?? "").trim();
  if (!morada || faltaARua(morada)) return null;
  // O andar pode vir na linha de baixo («Rua … 12\n3º esq»): lê-se na mensagem toda.
  if (d.floor == null) {
    const todo: DadosDaRecolha = {};
    guardarMorada(todo, t);
    if (todo.floor != null) {
      d.floor = todo.floor;
      if (d.lado == null) d.lado = todo.lado;
    }
  }
  return {
    morada: morada.slice(0, 300),
    andar: andarComLado(d),
    codigoPostal: d.postalCode ?? null,
    localidade: d.city ?? null,
  };
}

/**
 * RELER A CONVERSA ANTES DE PERGUNTAR — o que o cliente escreveu desde que o
 * pedido foi registado: a primeira morada que lá estiver (a mais recente
 * manda). Só as mensagens dele.
 */
export function ruaJaDitaNaConversa(
  mensagens: ReadonlyArray<{ direccao: string; texto: string; haSegundos: number | null }>,
  desde: Date | null,
  agora: Date,
): RuaLida | null {
  const dele = mensagens.filter((m) => {
    if (m.direccao !== "in") return false;
    if (!desde || m.haSegundos == null) return true;
    return agora.getTime() - m.haSegundos * 1000 >= desde.getTime() - 60_000;
  });
  for (let i = dele.length - 1; i >= 0; i--) {
    const lida = lerARua(dele[i].texto);
    if (lida) return lida;
  }
  return null;
}

export type EstadoDaRuaDoPedido = {
  pedidoId: number;
  /** Quando o cliente aceitou (a proposta contratada, ou o valor único). */
  aceiteEm: Date | null;
  ruaPedidaEm: Date | null;
  ruaRecebidaEm: Date | null;
  ruaPassadaEm: Date | null;
  /** A Vitória pode falar neste número (não está entregue a uma pessoa, nem bloqueado). */
  podeFalar: boolean;
  /** Um trabalho CLYON: o cliente não leva mensagens automáticas (02-10-2026). */
  trabalhoClyon: boolean;
  /** A rua que ele já escreveu na conversa, se escreveu. */
  ruaNaConversa: RuaLida | null;
};

export type OQueFazerComARua =
  | { tipo: "gravar"; rua: RuaLida }
  | { tipo: "pedir"; pergunta: string }
  | { tipo: "passar"; motivo: string; interromper: boolean }
  | null;

/**
 * O QUE FAZER AGORA COM ESTE PEDIDO. Uma pergunta por pedido, nunca duas: a
 * marca `ruaPedidaEm` fica antes de a mensagem sair. Sem resposta em 2 h,
 * passa à equipa (uma vez: `ruaPassadaEm`).
 */
export function oQueFazerComARua(e: EstadoDaRuaDoPedido, jaTemOAndar: boolean, agora: Date): OQueFazerComARua {
  if (e.ruaRecebidaEm || !e.aceiteEm) return null;
  if (e.aceiteEm.getTime() < PEDE_A_RUA_DESDE.getTime()) return null;
  if (!e.ruaPedidaEm) {
    if (e.ruaNaConversa) return { tipo: "gravar", rua: e.ruaNaConversa };
    if (e.ruaPassadaEm) return null;
    if (e.trabalhoClyon || !e.podeFalar) {
      return { tipo: "passar", motivo: motivoDaRuaPelaEquipa(e.pedidoId), interromper: false };
    }
    return { tipo: "pedir", pergunta: perguntaDaRua(e.pedidoId, jaTemOAndar) };
  }
  if (e.ruaPassadaEm) return null;
  if (agora.getTime() - e.ruaPedidaEm.getTime() >= HORAS_PARA_A_RUA * 3600_000) {
    return { tipo: "passar", motivo: motivoDaRuaSemResposta(e.pedidoId), interromper: true };
  }
  return null;
}

export { linhaDaRuaNaMesa } from "./rua-na-mesa";
