/**
 * A VITÓRIA PERCEBE O «1» E A DESISTÊNCIA, NA BASE E NO WHATSAPP — d111 (CEO
 * e dono, 24-11-2026). As regras puras estão em `a-escolha-e-a-desistencia.ts`.
 *
 * Aceitar é sempre pelo caminho de sempre: as propostas que o cliente pode
 * escolher e os limites do fecho são os da Vitória agente
 * (`propostasParaEscolherDeVerdade`, `motivoParaNaoFecharPeloAgente`: acima
 * de 500 € com IVA, à hora, Trabalho CLYON, valor único, já fechado ou pago,
 * proposta mudada há pouco → a equipa), e o fecho é o do botão «Fechar»
 * (`fecharAEscolhaDoCliente` → `fecharPeloCliente`: o interruptor «fechar»,
 * a guia antes de contratar, a transacção da d26, o aviso ao contratado e a
 * mensagem do fecho). Cancelar é o caminho único da d93/d94/d102
 * (`cancelarEApagarNaHora`: fecha, avisa os parceiros, anonimiza na hora,
 * «não contactar»; o contratado, pago, com data ou faturado fica com a equipa).
 */

import {
  desisteClaramente,
  escolhaDita,
  escolhaNaLista,
  HORAS_DA_LISTA,
  lerAListaDasPropostas,
  MOTIVOS_DO_SEGUIMENTO,
  mensagemDaDesistencia,
  mensagemDaEscolhaComAEquipa,
  pedidoDaEntregaPeloSeguimento,
  pedidoDaUltimaSaida,
  pedidoDoMotivoDoSeguimento,
  textoDaListaDasPropostas,
  ultimaSaidaDaVitoria,
  valorNaLista,
} from "./a-escolha-e-a-desistencia";
import type { PropostaComOValorDoParceiro, PropostaDoAgente } from "./vitoria-agente/propostas-do-agente";
import { MENSAGEM_DE_PASSAR_A_UMA_PESSOA } from "./voz-da-vitoria";

/** Manda a mensagem e entrega a conversa a uma pessoa (a mensagem sai antes: o portão fecha-se com a entrega). */
async function passarAEquipa(telefone: string, motivo: string, mensagem: string = MENSAGEM_DE_PASSAR_A_UMA_PESSOA): Promise<void> {
  const { enviarTextoWhatsApp } = await import("./whatsapp-cloud");
  const { interromperNumeroWhatsApp } = await import("./db");
  await enviarTextoWhatsApp(telefone, mensagem);
  await interromperNumeroWhatsApp(telefone, motivo.slice(0, 480)).catch(() => {});
}

async function enviar(telefone: string, texto: string): Promise<boolean> {
  const { enviarTextoWhatsApp } = await import("./whatsapp-cloud");
  return enviarTextoWhatsApp(telefone, texto);
}

async function propostasDoPedido(pedidoId: number): Promise<PropostaComOValorDoParceiro[]> {
  const { propostasParaEscolherDeVerdade } = await import("./vitoria-agente/accoes-na-base");
  return propostasParaEscolherDeVerdade(pedidoId).catch((err) => {
    console.error("[d111] as propostas não se leram:", err instanceof Error ? err.message : err);
    return [];
  });
}

async function nota(pedidoId: number, mensagem: string): Promise<void> {
  const { appendOrderHistory } = await import("./db");
  await appendOrderHistory(pedidoId, { type: "note", by: null, message: mensagem }).catch(() => {});
}

/**
 * ACEITA A PROPOSTA QUE O CLIENTE ESCOLHEU — com os limites do fecho pela
 * Vitória e o fecho de sempre. `onde` vai para o motivo (««1» ao seguimento»,
 * «resposta à lista»…).
 */
export async function aceitarAEscolha(telefone: string, pedidoId: number, p: PropostaDoAgente, onde: string): Promise<void> {
  const { pedidoParaOFechoDeVerdade } = await import("./vitoria-agente/accoes-na-base");
  const { motivoParaNaoFecharPeloAgente } = await import("./vitoria-agente/propostas-do-agente");
  const pedido = await pedidoParaOFechoDeVerdade(pedidoId).catch(() => null);
  const motivo = pedido ? motivoParaNaoFecharPeloAgente(p, pedido, new Date()) : "o pedido não se leu";
  if (motivo) {
    await nota(pedidoId, `O cliente escolheu ${p.parceiro} pelo WhatsApp (${onde}), mas ${motivo}: passou à equipa (d111).`);
    await passarAEquipa(telefone, `Pedido #${pedidoId}: o cliente escolheu ${p.parceiro} (${onde}), mas ${motivo} — fechar com ele`, mensagemDaEscolhaComAEquipa(p.parceiro));
    return;
  }
  const { fecharAEscolhaDoCliente } = await import("./whatsapp-negociacao");
  const fechou = await fecharAEscolhaDoCliente(telefone, pedidoId, p.negociacaoId).catch((err) => {
    console.error("[d111] o fecho da escolha falhou:", err instanceof Error ? err.message : err);
    return false;
  });
  if (!fechou) {
    await passarAEquipa(telefone, `Pedido #${pedidoId}: o cliente escolheu ${p.parceiro} (${onde}), mas a proposta já não está de pé — confirmar`);
  }
}

/** Manda a lista das propostas (e anota no pedido). */
async function mandarALista(telefone: string, pedidoId: number, propostas: readonly PropostaDoAgente[], deNovo = false): Promise<void> {
  await enviar(telefone, textoDaListaDasPropostas(pedidoId, propostas, deNovo));
  if (!deNovo) await nota(pedidoId, `A Vitória mandou ao cliente a lista das ${propostas.length} propostas para escolher (d111).`);
}

/**
 * O «1» AO SEGUIMENTO (d111, a): uma proposta → aceita-a; várias → a lista e
 * «Qual quer escolher?»; nenhuma → a equipa, como antes. O ciclo pára sempre.
 */
export async function responderAoUmDoSeguimento(telefone: string, pedidoId: number): Promise<void> {
  const { pararSeguimento } = await import("./seguimento-do-cliente-na-base");
  const propostas = await propostasDoPedido(pedidoId);
  if (propostas.length === 0) {
    await pararSeguimento(pedidoId, "«1» — quer avançar: sem proposta para escolher", new Date()).catch(() => false);
    await passarAEquipa(telefone, MOTIVOS_DO_SEGUIMENTO.semPropostas(pedidoId));
    return;
  }
  if (propostas.length === 1) {
    await pararSeguimento(pedidoId, `«1» — quer avançar: a proposta de ${propostas[0].parceiro}`, new Date()).catch(() => false);
    await aceitarAEscolha(telefone, pedidoId, propostas[0], "«1» ao seguimento");
    return;
  }
  await pararSeguimento(pedidoId, `«1» — quer avançar: ${propostas.length} propostas, a Vitória mandou a lista`, new Date()).catch(() => false);
  await mandarALista(telefone, pedidoId, propostas);
}

/**
 * A ESCOLHA POR PALAVRAS EM RESPOSTA AO SEGUIMENTO («Gostaria de escolher a
 * proposta da X»): aceita; na dúvida, a lista. Devolve true quando tratou.
 */
export async function escolhaPorPalavrasNoSeguimento(telefone: string, pedidoId: number, texto: string): Promise<boolean> {
  const propostas = await propostasDoPedido(pedidoId);
  const e = escolhaDita(texto, propostas);
  if (!e) return false;
  const { pararSeguimento } = await import("./seguimento-do-cliente-na-base");
  if (e.tipo === "duvida") {
    await pararSeguimento(pedidoId, "o cliente quer escolher — a Vitória mandou a lista", new Date()).catch(() => false);
    await mandarALista(telefone, pedidoId, propostas);
    return true;
  }
  await pararSeguimento(pedidoId, `o cliente escolheu ${e.proposta.parceiro}`, new Date()).catch(() => false);
  await aceitarAEscolha(telefone, pedidoId, e.proposta, "resposta ao seguimento");
  return true;
}

/**
 * DESISTE: cancela já, pelo caminho único (d93/d94), com a mensagem da d111.
 * O que não se pode cancelar por aqui (contratado, pago, com data, faturado)
 * vai à equipa com a frase de sempre.
 */
export async function desistirDoPedido(telefone: string, pedidoId: number, onde: string): Promise<void> {
  const { cancelarEApagarNaHora } = await import("./cancelar-pelo-cliente-na-base");
  const r = await cancelarEApagarNaHora(pedidoId, {
    origem: "desistencia",
    telefone,
    verificarTelefone: true,
    mensagem: mensagemDaDesistencia(pedidoId),
  }).catch((err) => ({ ok: false as const, porque: err instanceof Error ? err.message : "erro", daEquipa: false }));
  if (r.ok) return;
  const { PASSO_O_CANCELAMENTO_A_EQUIPA } = await import("./cancelar-pelo-cliente");
  await passarAEquipa(
    telefone,
    `Pedido #${pedidoId}: o cliente desistiu (${onde}), mas ${r.porque} — ${r.daEquipa ? "tratar à mão" : "cancelar à mão"}`,
    r.daEquipa ? PASSO_O_CANCELAMENTO_A_EQUIPA : MENSAGEM_DE_PASSAR_A_UMA_PESSOA,
  );
}

type Fio = Array<{ direccao: string; texto: string; haSegundos: number | null }>;

async function fioDe(telefone: string, limite = 40): Promise<Fio> {
  const { mensagensDoNumeroWhatsApp } = await import("./db");
  return mensagensDoNumeroWhatsApp(telefone, limite).catch(() => [] as Fio);
}

/**
 * A DESISTÊNCIA CLARA EM RESPOSTA AO SEGUIMENTO, À LISTA OU A UMA PROPOSTA
 * (d111, c). A última mensagem que lhe saiu (da Vitória, há menos de 7 dias)
 * é sobre as propostas de um pedido aberto dele: cancela-o. Devolve true
 * quando tratou a mensagem.
 */
export async function tratarADesistencia(telefone: string, texto: string): Promise<boolean> {
  if (!desisteClaramente(texto)) return false;
  const ultima = ultimaSaidaDaVitoria(await fioDe(telefone, 10));
  if (!ultima || ultima.haSegundos == null || ultima.haSegundos > 7 * 86400) return false;
  const pedidoId = pedidoDaUltimaSaida(ultima.texto);
  if (pedidoId == null) return false;
  const { pedidosAbertosDoTelefone } = await import("./cancelar-pelo-cliente-na-base");
  const abertos = await pedidosAbertosDoTelefone(telefone).catch(() => [] as number[]);
  if (!abertos.includes(pedidoId)) return false;
  await desistirDoPedido(telefone, pedidoId, "em resposta às propostas");
  return true;
}

/**
 * A RESPOSTA À LISTA DAS PROPOSTAS (d111, a). A última mensagem que lhe saiu
 * é a lista de um pedido dele, há menos de 48 h: o número ou o nome aceita
 * essa (com o valor que ele viu — se mudou, a equipa confirma); a desistência
 * cancela; a dúvida repete a lista. O resto segue a conversa de sempre
 * (devolve false).
 */
export async function responderALista(telefone: string, texto: string): Promise<boolean> {
  const ultima = ultimaSaidaDaVitoria(await fioDe(telefone, 10));
  if (!ultima || ultima.haSegundos == null || ultima.haSegundos > HORAS_DA_LISTA * 3600) return false;
  const lista = lerAListaDasPropostas(ultima.texto);
  if (!lista) return false;
  const { pedidosDoTelefone } = await import("./whatsapp-negociacao");
  if (!(await pedidosDoTelefone(telefone).catch(() => [] as number[])).includes(lista.pedidoId)) return false;
  if (desisteClaramente(texto)) {
    await desistirDoPedido(telefone, lista.pedidoId, "resposta à lista das propostas");
    return true;
  }
  const propostas = await propostasDoPedido(lista.pedidoId);
  const r = escolhaNaLista(texto, lista.linhas, propostas);
  if (r.tipo === "nada") return false;
  if (r.tipo === "duvida") {
    if (propostas.length === 0) {
      await passarAEquipa(telefone, `Pedido #${lista.pedidoId}: respondeu à lista das propostas, mas já não há propostas para escolher — confirmar`);
      return true;
    }
    await mandarALista(telefone, lista.pedidoId, propostas, true);
    return true;
  }
  if (r.linha && r.linha.valor !== valorNaLista(r.proposta)) {
    const { mensagemDaPropostaMudada } = await import("./vitoria-agente/ao-vivo");
    await passarAEquipa(
      telefone,
      `Pedido #${lista.pedidoId}: escolheu ${r.proposta.parceiro} na lista (${r.linha.valor}), mas a proposta mudou (${valorNaLista(r.proposta)}) — confirmar`,
      mensagemDaPropostaMudada(r.proposta.parceiro),
    );
    return true;
  }
  await aceitarAEscolha(telefone, lista.pedidoId, r.proposta, "resposta à lista das propostas");
  return true;
}

/**
 * A ESCOLHA NUMA CONVERSA QUE A VITÓRIA ENTREGOU À EQUIPA NO SEGUIMENTO (d111,
 * b). Entregue com um motivo do seguimento, sem uma pessoa ter escrito depois
 * (`pedidoDaEntregaPeloSeguimento`), e o cliente nomeia uma proposta do
 * pedido: a Vitória retoma a conversa e aceita — ou, na dúvida, manda a
 * lista. Uma conversa que uma pessoa respondeu continua com a equipa. Devolve
 * true quando tratou (quem chama já registou a mensagem).
 */
export async function escolhaNumaConversaEntregue(telefone: string, textoCru: string): Promise<boolean> {
  const { separarCodigoDeOrigem } = await import("./codigo-de-origem");
  const texto = separarCodigoDeOrigem(textoCru).texto;
  if (!texto.trim()) return false;
  const db = await import("./db");
  if (!(await db.whatsappLigado().catch(() => false))) return false;
  if (await db.numeroBloqueadoWhatsApp(telefone).catch(() => true)) return false;
  if (!(await db.numeroInterrompidoWhatsApp(telefone).catch(() => false))) return false;
  const motivo = await db.motivoDaEntregaWhatsApp(telefone).catch(() => null);
  if (pedidoDoMotivoDoSeguimento(motivo) == null) return false;
  const fio = await fioDe(telefone, 40);
  const { aEquipaNaConversa } = await import("./pedido-em-curso-na-base");
  const equipa = await aEquipaNaConversa(telefone).catch(() => ({ respondidaHaSegundos: null, devolvidaHaSegundos: null }));
  const pedidoId = pedidoDaEntregaPeloSeguimento({ motivo, fio, respondidaHaSegundos: equipa.respondidaHaSegundos });
  if (pedidoId == null) return false;
  const { pedidosDoTelefone } = await import("./whatsapp-negociacao");
  if (!(await pedidosDoTelefone(telefone).catch(() => [] as number[])).includes(pedidoId)) return false;
  const propostas = await propostasDoPedido(pedidoId);
  const e = escolhaDita(texto, propostas);
  if (!e) return false;
  await db.retomarNumeroWhatsApp(telefone);
  await nota(pedidoId, "A Vitória retomou a conversa que tinha passado à equipa no seguimento: o cliente escolheu uma proposta (d111).");
  if (e.tipo === "duvida") {
    await mandarALista(telefone, pedidoId, propostas);
    return true;
  }
  await aceitarAEscolha(telefone, pedidoId, e.proposta, "depois do seguimento, com a conversa na equipa");
  return true;
}

/**
 * O CÓDIGO LÊ ESTA RESPOSTA (e não a Vitória agente)? Para a «conversa livre»
 * (d92): a desistência clara às propostas, a resposta à lista, e a escolha
 * por palavras ao seguimento ficam com o código — o mesmo resultado com o
 * agente ligado ou desligado. Nunca lança (na dúvida, false: segue como hoje).
 */
export async function oCodigoLeEstaResposta(
  texto: string,
  fio: ReadonlyArray<{ direccao: string; texto: string; haSegundos?: number | null }>,
): Promise<boolean> {
  try {
    const ultima = ultimaSaidaDaVitoria(fio);
    if (!ultima || typeof ultima.haSegundos !== "number") return false;
    const pedidoId = pedidoDaUltimaSaida(ultima.texto);
    if (pedidoId == null) return false;
    if (desisteClaramente(texto) && ultima.haSegundos <= 7 * 86400) return true;
    const lista = lerAListaDasPropostas(ultima.texto);
    if (lista && ultima.haSegundos <= HORAS_DA_LISTA * 3600) {
      return escolhaNaLista(texto, lista.linhas, await propostasDoPedido(lista.pedidoId)).tipo !== "nada";
    }
    const { eMensagemDoSeguimento } = await import("./seguimento-do-cliente");
    if (eMensagemDoSeguimento(ultima.texto, pedidoId)) return escolhaDita(texto, await propostasDoPedido(pedidoId)) != null;
    return false;
  } catch {
    return false;
  }
}
