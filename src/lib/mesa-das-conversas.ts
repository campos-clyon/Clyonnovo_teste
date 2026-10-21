import { eDaEquipa, eMarcaDeImagem, semMarcaDeMao } from "./rajada-do-whatsapp";

/**
 * A MESA DAS CONVERSAS — em que pé está cada número, e porquê. 21-10-2026.
 *
 * *«Temos um fluxo de pedidos muito grande vindo do WhatsApp e não estamos a
 * conseguir dar vazão. Estamos perdidos entre quais já foram respondidos,
 * quais já foram resolvidos, quais já foram finalizados, e quais ainda falta
 * responder, quais ficaram a meio, quais a Vitória começou a responder e
 * parou.»* — o dono, com 193 conversas em «Entregues a si».
 *
 * Os separadores antigos diziam QUEM tinha a conversa (o assistente, uma
 * pessoa, arquivada). Estes dizem O QUE FALTA FAZER:
 *
 *   - POR RESPONDER — o cliente escreveu por último e ninguém lhe respondeu;
 *   - A MEIO — a Vitória estava a recolher o pedido e o cliente parou;
 *   - À ESPERA DO CLIENTE — a última palavra foi nossa;
 *   - COM PEDIDO — há um pedido vivo, e é lá que se trata;
 *   - RESOLVIDAS — fechadas, com o porquê: o pedido acabou, alguém da equipa
 *     fechou-a, ou a Vitória leu-a e viu que tinha acabado.
 *
 * Quem a tem (a Vitória ou a equipa) passa a ser uma etiqueta da linha. As
 * guardadas («para continuar») são uma marca por cima do estado.
 *
 * PURO: os factos vêm da base (`factosDasConversasWhatsApp`); aqui só se
 * decide. As idades vêm em segundos contados pela base, para nunca se
 * comparar uma hora de Lisboa com uma de UTC.
 */

export type EstadoNaMesa = "por_responder" | "a_meio" | "a_espera" | "com_pedido" | "resolvida" | "bloqueada";

/** Os separadores, pela ordem em que se trabalham. */
export const SEPARADORES_DA_MESA: Array<{ id: EstadoNaMesa | "guardada"; titulo: string; vazio: string }> = [
  { id: "por_responder", titulo: "Por responder", vazio: "Ninguém à espera de resposta. 👍" },
  { id: "a_meio", titulo: "A meio", vazio: "Nenhuma recolha parada a meio." },
  { id: "a_espera", titulo: "À espera do cliente", vazio: "Nenhuma conversa à espera do cliente." },
  { id: "com_pedido", titulo: "Com pedido", vazio: "Nenhuma conversa com pedido em curso." },
  { id: "guardada", titulo: "Guardadas", vazio: "Nada guardado para continuar." },
  { id: "resolvida", titulo: "Resolvidas", vazio: "Nada resolvido ainda." },
  { id: "bloqueada", titulo: "Bloqueadas", vazio: "Ninguém bloqueado." },
];

/** O passo da recolha, em palavras de painel. */
export const PASSO_DA_RECOLHA: Record<string, string> = {
  servico: "a escolher o serviço",
  nome: "a dizer o nome",
  morada: "a dar a morada",
  codigoPostal: "a dar o código postal",
  moradaDestino: "a dar o destino",
  codigoPostalDestino: "a dar o código postal do destino",
  andar: "a dizer o andar",
  elevador: "a dizer se há elevador",
  estacionamento: "a dizer se dá para estacionar",
  andarDestino: "a dizer o andar do destino",
  elevadorDestino: "a dizer se há elevador no destino",
  estacionamentoDestino: "a dizer se dá para estacionar no destino",
  entulhoQuantidade: "a dizer quanto entulho",
  quando: "a dizer para quando",
  descricao: "a descrever",
  fatura: "a dizer se quer fatura",
  nif: "a dar o NIF",
  confirmar: "a confirmar o resumo",
};

export type MensagemDaMesa = {
  id: number;
  direccao: "in" | "out";
  texto: string;
  /** Há quantos segundos, contados pela base. */
  haSegundos: number | null;
  quando: string;
};

export type FactosDaConversa = {
  telefone: string;
  ultimaEntrada: MensagemDaMesa | null;
  ultimaSaida: MensagemDaMesa | null;
  bloqueada: boolean;
  /** Entregue a uma pessoa — a Vitória cala-se neste número. */
  entregue: boolean;
  /** Porque foi entregue: «Pediu para falar com uma pessoa», «Respondeu à mão»… */
  motivoDaEntrega?: string | null;
  /** O fecho (arquivo), com o porquê e quem fechou. */
  fecho: { haSegundos: number | null; quando: string; motivo: string | null; porQuem: string | null } | null;
  /** A recolha de um pedido a meio — sem pedido registado ainda. */
  recolha: { passo: string } | null;
  /** O pedido vivo deste número, se houver. */
  pedidoVivo: { id: number; status: string | null } | null;
  /** O último pedido deste número, vivo ou não. */
  ultimoPedido: { id: number; status: string | null } | null;
  guardada: { nota: string | null; quando: string } | null;
  /** O que a Vitória percebeu ao ler a conversa, se ainda vale (nada de novo depois). */
  leitura?: { estado: string; motivo: string | null } | null;
};

export type ConversaNaMesa = {
  telefone: string;
  estado: EstadoNaMesa;
  /** Porque está ali, e onde parou — numa frase. */
  porque: string;
  dono: "assistente" | "equipa";
  /** Porque foi entregue à equipa, quando foi. */
  motivoDaEntrega: string | null;
  ultimaMensagem: string | null;
  direccao: "in" | "out" | null;
  quando: string | null;
  /** Há quantos segundos foi a última mensagem — para ordenar. */
  haSegundos: number | null;
  /** O id da última mensagem — para a Vitória só reler o que tem novidades. */
  ultimoId: number;
  passo: string | null;
  pedidoId: number | null;
  guardada: { nota: string | null } | null;
  /** Quem a fechou, quando está resolvida: «equipa», «vitoria» ou «pedido». */
  fechadaPor: string | null;
};

const PEDIDO_FECHADO = ["concluido", "cancelado", "arquivado", "rejeitado"];

const ESTADO_DO_PEDIDO: Record<string, string> = {
  novo: "novo",
  pendente: "pendente",
  em_analise: "em análise",
  enviado: "enviado aos profissionais",
  em_negociacao: "em negociação",
  negociacao: "em negociação",
  agendado: "agendado",
  em_curso: "em curso",
  concluido: "concluído",
  cancelado: "cancelado",
  arquivado: "arquivado",
  rejeitado: "recusado",
};

/** «há 5 min», «há 2 h», «há 3 dias». */
export function haQuanto(segundos: number | null | undefined): string {
  if (segundos == null || !Number.isFinite(segundos)) return "";
  const s = Math.max(0, Math.floor(segundos));
  if (s < 60) return "agora mesmo";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const dias = Math.floor(s / 86400);
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

/**
 * Só um agradecimento ou um «ok» — o fim de uma conversa, e não uma pergunta.
 *
 * Mais estreito do que o `eSoUmObrigado` dos avisos de data de propósito:
 * aqui «sim» e «combinado» são o cliente a aceitar, e alguém tem de avançar
 * (o Leandro, 21-10-2026: «Combinado» / «Podemos prosseguir»).
 */
export function soAgradece(texto: string): boolean {
  const limpo = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\p{Extended_Pictographic}\p{Cf}]/gu, " ")
    .replace(/[.,;:!]+/g, " ")
    .trim();
  if (!limpo) return true; // só emojis: 👍 🙏
  if (limpo.length > 40 || limpo.includes("?")) return false;
  const PALAVRAS = /^(ok|okay|okey|oki|obrigad[oa]s?|obg|brigad[oa]|muito|mt|mto|igualmente|de|nada)$/;
  return limpo.split(/\s+/).every((p) => PALAVRAS.test(p));
}

/** O texto da mensagem para a linha: sem marcas, e as imagens como imagens. */
function resumoDaMensagem(texto: string): string {
  if (eMarcaDeImagem(texto)) return "📷 imagem";
  const t = semMarcaDeMao(texto).replace(/\s+/g, " ").trim();
  return t.length > 90 ? `${t.slice(0, 89)}…` : t;
}

/** A conversa foi reaberta: o cliente voltou a escrever depois de ela fechar. */
export function reabertaDepoisDoFecho(f: Pick<FactosDaConversa, "fecho" | "ultimaEntrada">): boolean {
  if (!f.fecho || !f.ultimaEntrada) return false;
  const fecho = f.fecho.haSegundos;
  const entrada = f.ultimaEntrada.haSegundos;
  if (fecho == null || entrada == null) return false;
  return entrada < fecho;
}

function motivoDoFecho(fecho: NonNullable<FactosDaConversa["fecho"]>): string {
  const quem = fecho.porQuem === "vitoria" ? "A Vitória fechou-a" : "Fechada pela equipa";
  return fecho.motivo ? `${quem}: ${fecho.motivo}` : quem;
}

/** Em que pé está esta conversa, e porquê. */
export function naMesa(f: FactosDaConversa): ConversaNaMesa {
  const dono: ConversaNaMesa["dono"] = f.entregue ? "equipa" : "assistente";
  const entrada = f.ultimaEntrada;
  const saida = f.ultimaSaida;
  const ultima = entrada && saida ? (entrada.id > saida.id ? entrada : saida) : (entrada ?? saida);
  const base = {
    telefone: f.telefone,
    dono,
    motivoDaEntrega: f.entregue ? (f.motivoDaEntrega ?? null) : null,
    ultimaMensagem: ultima ? resumoDaMensagem(ultima.texto) : null,
    direccao: ultima?.direccao ?? null,
    quando: ultima?.quando ?? null,
    haSegundos: ultima?.haSegundos ?? null,
    ultimoId: ultima?.id ?? 0,
    passo: f.recolha?.passo ?? null,
    pedidoId: f.pedidoVivo?.id ?? null,
    guardada: f.guardada ? { nota: f.guardada.nota } : null,
    fechadaPor: null as string | null,
  };

  if (f.bloqueada) return { ...base, estado: "bloqueada", porque: "Bloqueada — o site não lhe responde." };

  if (f.fecho && !reabertaDepoisDoFecho(f)) {
    return { ...base, estado: "resolvida", porque: motivoDoFecho(f.fecho), fechadaPor: f.fecho.porQuem ?? "equipa" };
  }

  const clienteFalouPorUltimo = entrada != null && (saida == null || entrada.id > saida.id);
  const comPedido = f.pedidoVivo ? ` · pedido #${f.pedidoVivo.id}` : "";
  // O que a Vitória percebeu ao ler, quando ainda vale — vai no porquê.
  const lida = f.leitura?.motivo ? ` — a Vitória leu: ${f.leitura.motivo}` : "";

  if (clienteFalouPorUltimo && !soAgradece(entrada.texto)) {
    const recente = dono === "assistente" && (entrada.haSegundos ?? Infinity) < 180;
    const reaberta = f.fecho ? "Voltou a escrever depois de fechada — " : "";
    const quem = recente ? " — a Vitória está a responder" : dono === "assistente" ? " — a Vitória não respondeu" : "";
    return {
      ...base,
      estado: "por_responder",
      porque: `${reaberta}escreveu ${haQuanto(entrada.haSegundos)}: «${resumoDaMensagem(entrada.texto)}»${comPedido}${quem}${lida}`
        .replace(/^escreveu/, "Escreveu"),
    };
  }

  if (f.pedidoVivo) {
    const estado = ESTADO_DO_PEDIDO[f.pedidoVivo.status ?? ""] ?? (f.pedidoVivo.status ?? "em curso");
    return { ...base, estado: "com_pedido", porque: `Pedido #${f.pedidoVivo.id} — ${estado}${lida}` };
  }

  if (f.ultimoPedido && PEDIDO_FECHADO.includes(f.ultimoPedido.status ?? "")) {
    const estado = ESTADO_DO_PEDIDO[f.ultimoPedido.status ?? ""] ?? f.ultimoPedido.status;
    return {
      ...base,
      estado: "resolvida",
      porque: `Pedido #${f.ultimoPedido.id} ${estado}`,
      fechadaPor: "pedido",
    };
  }

  if (f.recolha && dono === "assistente") {
    const onde = PASSO_DA_RECOLHA[f.recolha.passo] ?? f.recolha.passo;
    const quando = saida ? ` — a última pergunta foi ${haQuanto(saida.haSegundos)}` : "";
    return { ...base, estado: "a_meio", porque: `Parou ${onde}${quando}${lida}` };
  }

  if (clienteFalouPorUltimo) {
    return {
      ...base,
      estado: "a_espera",
      porque: `O cliente agradeceu ${haQuanto(entrada.haSegundos)} — nada por responder${lida}`,
    };
  }

  if (saida) {
    const quem = eDaEquipa(saida.texto) ? "a equipa respondeu" : "a Vitória respondeu";
    const parou = f.recolha ? ` (a recolha parou ${PASSO_DA_RECOLHA[f.recolha.passo] ?? f.recolha.passo})` : "";
    return {
      ...base,
      estado: "a_espera",
      porque: `${quem.charAt(0).toUpperCase()}${quem.slice(1)} ${haQuanto(saida.haSegundos)}: «${resumoDaMensagem(saida.texto)}»${parou}${lida}`,
    };
  }

  return { ...base, estado: "a_espera", porque: "Sem mensagens guardadas." };
}

/**
 * A ordem de cada separador: no «Por responder», quem espera há mais tempo
 * primeiro — é quem está mais perto de ir a outra empresa. Nos outros, o
 * mais recente primeiro.
 */
export function ordenarNaMesa(linhas: ConversaNaMesa[], separador: string): ConversaNaMesa[] {
  const idade = (l: ConversaNaMesa) => l.haSegundos ?? Number.MAX_SAFE_INTEGER;
  return [...linhas].sort((a, b) => (separador === "por_responder" ? idade(b) - idade(a) : idade(a) - idade(b)));
}

/** Quantas há em cada separador — as guardadas contam à parte, por cima do estado. */
export function contarNaMesa(linhas: ConversaNaMesa[]): Record<EstadoNaMesa | "guardada", number> {
  const c: Record<EstadoNaMesa | "guardada", number> = {
    por_responder: 0,
    a_meio: 0,
    a_espera: 0,
    com_pedido: 0,
    resolvida: 0,
    bloqueada: 0,
    guardada: 0,
  };
  for (const l of linhas) {
    c[l.estado] += 1;
    if (l.guardada) c.guardada += 1;
  }
  return c;
}

/** As linhas de um separador — as guardadas, venham de onde vierem. */
export function linhasDoSeparador(linhas: ConversaNaMesa[], separador: string): ConversaNaMesa[] {
  const doSeparador =
    separador === "guardada" ? linhas.filter((l) => l.guardada) : linhas.filter((l) => l.estado === separador);
  return ordenarNaMesa(doSeparador, separador);
}
