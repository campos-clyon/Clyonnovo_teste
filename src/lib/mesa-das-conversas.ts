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
 *
 * QUEM FALOU POR ÚLTIMO, SEGUNDO O TELEMÓVEL — 23-10-2026.
 *
 * *«Quero ter a noção de quais clientes já foram respondidos, quais não
 * foram, quem foi o último a mandar mensagem, se fomos nós.»* — o dono, com
 * 68 em «Por responder», quase todas «Entregue: respondeu à mão». O site só
 * sabe o que lhe passou pelas mãos: as respostas dadas no telemóvel antes de
 * 21-10 nunca lhe chegaram, e o que entra com a ponte em baixo também não.
 * Agora a ponte lê a lista das conversas do WhatsApp de 10 em 10 minutos e
 * diz de quem foi a última mensagem (`NoTelemovel`). A última palavra é a
 * mais recente das três fontes — o fio do site, o telemóvel e o «Já
 * respondi» do painel (`ultimaPalavra`).
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

/**
 * A última mensagem da conversa no WhatsApp do telemóvel — o retrato que a
 * ponte tira de 10 em 10 minutos (`retratarOTelemovel`, ponte-whatsapp).
 */
export type NoTelemovel = {
  /** Foi nossa — à mão, ou da Vitória. */
  deMim: boolean;
  /** Há quantos segundos, contados pela base. */
  haSegundos: number | null;
  /** Em ISO. */
  quando: string;
  /** O texto, ou o que era: «[imagem]», «[chamada]»… */
  texto: string;
  /** Mensagens do cliente por abrir no telemóvel. */
  porLer: number;
  /** Arquivada no WhatsApp — não se vê na lista do telemóvel. */
  arquivada: boolean;
};

export type FactosDaConversa = {
  telefone: string;
  ultimaEntrada: MensagemDaMesa | null;
  ultimaSaida: MensagemDaMesa | null;
  /** O que o telemóvel diz (23-10-2026). */
  noTelemovel?: NoTelemovel | null;
  /** «Já respondi» — a equipa deu-a por respondida no painel, há tanto tempo (23-10-2026). */
  respondida?: { haSegundos: number | null; quando: string } | null;
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
  leitura?: { estado: string; motivo: string | null; lidaHaSegundos?: number | null } | null;
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
  /** O pedido deste número — o vivo, ou o último —, e se já acabou (23-10-2026). */
  pedido: { id: number; estado: string; fechado: boolean } | null;
  /** Quem disse a última palavra — o cliente, a Vitória ou a equipa. */
  quemFalou: QuemFalou | null;
  /** De onde se sabe: do fio do site, do telemóvel, ou do «Já respondi». */
  onde: OndeSeSoube | null;
  /** Mensagens por abrir no telemóvel. */
  porLerNoTelemovel: number;
  arquivadaNoTelemovel: boolean;
  /** A última mensagem, quando só o telemóvel a conhece — para a Vitória a ler. */
  ultimaDoTelemovel: { direccao: "in" | "out"; texto: string } | null;
  guardada: { nota: string | null } | null;
  /** Quem a fechou, quando está resolvida: «equipa», «vitoria» ou «pedido». */
  fechadaPor: string | null;
};

export type QuemFalou = "cliente" | "vitoria" | "equipa";
export type OndeSeSoube = "site" | "telemovel" | "painel";

export type UltimaPalavra = {
  de: QuemFalou;
  texto: string;
  haSegundos: number | null;
  quando: string | null;
  onde: OndeSeSoube;
};

const PEDIDO_FECHADO = ["concluido", "cancelado", "arquivado", "rejeitado"];

/** Os estados do pedido em palavras de painel — os mesmos do resumo semanal (`email-digest.ts`). */
const ESTADO_DO_PEDIDO: Record<string, string> = {
  novo: "novo",
  pendente: "novo",
  sem_assistente: "novo",
  atribuido: "novo",
  em_analise: "em análise",
  precisa_info: "em análise",
  estimativa_pronta: "em análise",
  presencial_recomendado: "em análise",
  enviado: "enviado aos profissionais",
  em_negociacao: "em negociação",
  negociacao: "em negociação",
  aprovado: "aprovado",
  enviado_cliente: "aprovado",
  confirmado: "confirmado",
  agendado: "agendado",
  em_execucao: "em curso",
  em_curso: "em curso",
  concluido: "concluído",
  cancelado: "cancelado",
  arquivado: "arquivado",
  rejeitado: "recusado",
};

/**
 * Uma mensagem do telemóvel só passa à frente do fio do site quando é
 * claramente mais nova. Os dois relógios não batem ao segundo: o site grava a
 * resposta da Vitória quando ela a escreve, e o telemóvel quando ela sai.
 */
export const FOLGA_DO_TELEMOVEL_S = 90;

/** Para comparar a mesma mensagem vista dos dois lados. */
function textoComparavel(t: string): string {
  return semMarcaDeMao(t).replace(/\s+/g, " ").trim().toLowerCase().slice(0, 120);
}

/**
 * QUEM DISSE A ÚLTIMA PALAVRA, e quando — a mais recente das três fontes.
 *
 *   - o fio do site: o que entrou e saiu pela ponte;
 *   - o telemóvel: a resposta à mão que o site não viu, ou a mensagem que
 *     entrou com a ponte em baixo;
 *   - o painel: «Já respondi» — respondeu-se por telefone, ou noutro sítio.
 *
 * O telemóvel não manda quando a base já tem essa mensagem (o mesmo texto, no
 * mesmo sentido, perto da mesma hora): aí sabe-se mais pelo fio — quem a
 * escreveu, a Vitória ou a equipa. Pura.
 */
export function ultimaPalavra(
  f: Pick<FactosDaConversa, "ultimaEntrada" | "ultimaSaida" | "noTelemovel" | "respondida">,
): UltimaPalavra | null {
  const e = f.ultimaEntrada;
  const s = f.ultimaSaida;
  const naBase = e && s ? (e.id > s.id ? e : s) : (e ?? s);
  let palavra: UltimaPalavra | null = naBase
    ? {
        de: naBase.direccao === "in" ? "cliente" : eDaEquipa(naBase.texto) ? "equipa" : "vitoria",
        texto: naBase.texto,
        haSegundos: naBase.haSegundos,
        quando: naBase.quando,
        onde: "site",
      }
    : null;

  const t = f.noTelemovel;
  if (t && t.haSegundos != null) {
    const doMesmoLado = t.deMim ? s : e;
    const jaNaBase =
      doMesmoLado != null &&
      textoComparavel(doMesmoLado.texto) === textoComparavel(t.texto) &&
      Math.abs((doMesmoLado.haSegundos ?? Infinity) - t.haSegundos) <= 3600;
    const maisNova = palavra?.haSegundos == null || t.haSegundos < palavra.haSegundos - FOLGA_DO_TELEMOVEL_S;
    if (maisNova && !jaNaBase) {
      palavra = {
        de: t.deMim ? "equipa" : "cliente",
        texto: t.texto,
        haSegundos: t.haSegundos,
        quando: t.quando,
        onde: "telemovel",
      };
    }
  }

  // «Já respondi» só conta se for depois da última mensagem do cliente.
  const r = f.respondida;
  if (r && r.haSegundos != null && palavra?.de === "cliente" && (palavra.haSegundos == null || r.haSegundos <= palavra.haSegundos)) {
    palavra = { de: "equipa", texto: "", haSegundos: r.haSegundos, quando: r.quando, onde: "painel" };
  }
  return palavra;
}

/** Há quanto tempo o cliente escreveu pela última vez — no fio ou no telemóvel. */
function haQuantoEscreveuOCliente(f: Pick<FactosDaConversa, "ultimaEntrada" | "noTelemovel">): number | null {
  const idades = [f.ultimaEntrada?.haSegundos, f.noTelemovel && !f.noTelemovel.deMim ? f.noTelemovel.haSegundos : null]
    .filter((n): n is number => n != null && Number.isFinite(n));
  return idades.length > 0 ? Math.min(...idades) : null;
}

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
 * (o Gilberto, 21-10-2026: «Combinado» / «Podemos prosseguir»).
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

/** A conversa foi reaberta: o cliente voltou a escrever depois de ela fechar — no fio ou no telemóvel. */
export function reabertaDepoisDoFecho(f: Pick<FactosDaConversa, "fecho" | "ultimaEntrada" | "noTelemovel">): boolean {
  if (!f.fecho) return false;
  const fecho = f.fecho.haSegundos;
  const cliente = haQuantoEscreveuOCliente(f);
  if (fecho == null || cliente == null) return false;
  return cliente < fecho;
}

function motivoDoFecho(fecho: NonNullable<FactosDaConversa["fecho"]>): string {
  const quem = fecho.porQuem === "vitoria" ? "A Vitória fechou-a" : "Fechada pela equipa";
  return fecho.motivo ? `${quem}: ${fecho.motivo}` : quem;
}

/** Em que pé está esta conversa, e porquê. */
export function naMesa(f: FactosDaConversa): ConversaNaMesa {
  const dono: ConversaNaMesa["dono"] = f.entregue ? "equipa" : "assistente";
  const palavra = ultimaPalavra(f);
  const pedido = f.pedidoVivo ?? f.ultimoPedido ?? null;
  const base = {
    telefone: f.telefone,
    dono,
    motivoDaEntrega: f.entregue ? (f.motivoDaEntrega ?? null) : null,
    ultimaMensagem: !palavra
      ? null
      : palavra.onde === "painel"
        ? "✓ marcada como respondida no painel"
        : resumoDaMensagem(palavra.texto),
    direccao: palavra ? (palavra.de === "cliente" ? ("in" as const) : ("out" as const)) : null,
    quando: palavra?.quando ?? null,
    haSegundos: palavra?.haSegundos ?? null,
    ultimoId: Math.max(f.ultimaEntrada?.id ?? 0, f.ultimaSaida?.id ?? 0),
    passo: f.recolha?.passo ?? null,
    pedidoId: f.pedidoVivo?.id ?? null,
    pedido: pedido
      ? {
          id: pedido.id,
          estado: ESTADO_DO_PEDIDO[pedido.status ?? ""] ?? (pedido.status || "em curso"),
          fechado: PEDIDO_FECHADO.includes(pedido.status ?? ""),
        }
      : null,
    quemFalou: palavra?.de ?? null,
    onde: palavra?.onde ?? null,
    porLerNoTelemovel: f.noTelemovel?.porLer ?? 0,
    arquivadaNoTelemovel: f.noTelemovel?.arquivada ?? false,
    ultimaDoTelemovel:
      palavra?.onde === "telemovel"
        ? { direccao: palavra.de === "cliente" ? ("in" as const) : ("out" as const), texto: palavra.texto }
        : null,
    guardada: f.guardada ? { nota: f.guardada.nota } : null,
    fechadaPor: null as string | null,
  };

  if (f.bloqueada) return { ...base, estado: "bloqueada", porque: "Bloqueada — o site não lhe responde." };

  if (f.fecho && !reabertaDepoisDoFecho(f)) {
    return { ...base, estado: "resolvida", porque: motivoDoFecho(f.fecho), fechadaPor: f.fecho.porQuem ?? "equipa" };
  }

  // O pedido já não vai no porquê: está na etiqueta da linha (23-10-2026).
  // O que a Vitória percebeu ao ler, quando ainda vale — vai no porquê. Se o
  // telemóvel ou o painel souberem de uma mensagem mais nova do que a
  // leitura, já não vale: ela leu sem essa mensagem.
  const lidaDepois =
    palavra?.onde === "site" ||
    (palavra?.haSegundos != null && f.leitura?.lidaHaSegundos != null && f.leitura.lidaHaSegundos < palavra.haSegundos);
  const lida = f.leitura?.motivo && lidaDepois ? ` — a Vitória leu: ${f.leitura.motivo}` : "";

  if (palavra?.de === "cliente" && !soAgradece(palavra.texto)) {
    const soNoTelemovel = palavra.onde === "telemovel";
    const recente = dono === "assistente" && !soNoTelemovel && (palavra.haSegundos ?? Infinity) < 180;
    const reaberta = f.fecho ? "Voltou a escrever depois de fechada — " : "";
    const quem = recente
      ? " — a Vitória está a responder"
      : soNoTelemovel
        ? " — só no telemóvel, o site não a recebeu"
        : dono === "assistente"
          ? " — a Vitória não respondeu"
          : "";
    return {
      ...base,
      estado: "por_responder",
      porque: `${reaberta}escreveu ${haQuanto(palavra.haSegundos)}: «${resumoDaMensagem(palavra.texto)}»${quem}${lida}`
        .replace(/^escreveu/, "Escreveu"),
    };
  }

  if (f.pedidoVivo) {
    /*
     * O pedido e o estado dele estão na etiqueta da linha (23-10-2026); o
     * porquê diz quem está calado — «o cliente deixou de responder» também
     * acontece com pedido.
     */
    const porque = !palavra
      ? "Pedido em curso"
      : palavra.de === "cliente"
        ? `O cliente agradeceu ${haQuanto(palavra.haSegundos)} — nada por responder`
        : `À espera do cliente — a última palavra foi nossa, ${haQuanto(palavra.haSegundos)}`;
    return { ...base, estado: "com_pedido", porque: `${porque}${lida}` };
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
    const saida = f.ultimaSaida;
    const quando = saida ? ` — a última pergunta foi ${haQuanto(saida.haSegundos)}` : "";
    return { ...base, estado: "a_meio", porque: `Parou ${onde}${quando}${lida}` };
  }

  if (palavra?.de === "cliente") {
    return {
      ...base,
      estado: "a_espera",
      porque: `O cliente agradeceu ${haQuanto(palavra.haSegundos)} — nada por responder${lida}`,
    };
  }

  if (palavra) {
    const parou = f.recolha ? ` (a recolha parou ${PASSO_DA_RECOLHA[f.recolha.passo] ?? f.recolha.passo})` : "";
    if (palavra.onde === "painel") {
      return {
        ...base,
        estado: "a_espera",
        porque: `Marcada como respondida ${haQuanto(palavra.haSegundos)} — à espera do cliente${parou}`,
      };
    }
    const quem =
      palavra.onde === "telemovel"
        ? "A equipa respondeu no telemóvel"
        : palavra.de === "equipa"
          ? "A equipa respondeu"
          : "A Vitória respondeu";
    return {
      ...base,
      estado: "a_espera",
      porque: `${quem} ${haQuanto(palavra.haSegundos)}: «${resumoDaMensagem(palavra.texto)}»${parou}${lida}`,
    };
  }

  return { ...base, estado: "a_espera", porque: "Sem mensagens guardadas." };
}

/**
 * Até quando uma espera é de hoje — 3 dias. Depois disso, no «Por
 * responder», é uma conversa antiga (ver `ordenarNaMesa`).
 */
export const ESPERA_RECENTE_S = 3 * 86400;

/** Uma linha do «Por responder» que espera há mais de `ESPERA_RECENTE_S`. */
export function eEsperaAntiga(l: Pick<ConversaNaMesa, "haSegundos">): boolean {
  return (l.haSegundos ?? Number.MAX_SAFE_INTEGER) > ESPERA_RECENTE_S;
}

/**
 * A ordem de cada separador. Nos outros, o mais recente primeiro.
 *
 * No «Por responder», quem espera há mais tempo primeiro — é quem está mais
 * perto de ir a outra empresa —, MAS SÓ DENTRO DOS ÚLTIMOS 3 DIAS
 * (21-10-2026). No primeiro dia a lista abriu com conversas de há 41 dias:
 * as respostas dadas à mão antes de a ponte as guardar nunca ficaram
 * escritas, e essas conversas parecem por responder. Empurravam as de hoje
 * para o fundo. As antigas vêm depois, das mais recentes para as mais
 * velhas, e o painel separa-as com uma linha.
 */
export function ordenarNaMesa(linhas: ConversaNaMesa[], separador: string): ConversaNaMesa[] {
  const idade = (l: ConversaNaMesa) => l.haSegundos ?? Number.MAX_SAFE_INTEGER;
  if (separador !== "por_responder") return [...linhas].sort((a, b) => idade(a) - idade(b));
  return [...linhas].sort((a, b) => {
    const antigaA = eEsperaAntiga(a);
    const antigaB = eEsperaAntiga(b);
    if (antigaA !== antigaB) return antigaA ? 1 : -1;
    return antigaA ? idade(a) - idade(b) : idade(b) - idade(a);
  });
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
