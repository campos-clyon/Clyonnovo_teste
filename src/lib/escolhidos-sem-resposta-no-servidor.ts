import {
  appendOrderHistory,
  escolhaDoPedido,
  existeContaComEmail,
  fecharAvisoSemResposta,
  getSimulatorOrderById,
  mudarEscolhaDoPedido,
  negociacoesDoPedido,
  pedidosComEscolhidosPorResponder,
  reservarAvisoSemResposta,
  substituirTokenDoPedido,
} from "./db";
import {
  ACCOES_DOS_ESCOLHIDOS,
  cartaoDoCliente,
  correrOsEscolhidosSemResposta,
  ERROS_DO_CLIENTE,
  escolhidosDeJson,
  HISTORICO_DO_CLIENTE,
  linhaDoHistoricoEscolheuOutro,
  linhaDoHistoricoRegistadoPelaEquipa,
  linhaDoPrazoParaOCliente,
  oClientePediuAClyon,
  pedidoEnviadoAOutros,
  semRespostaDosEscolhidos,
  TEXTOS_DE_ESCOLHER_OUTRO,
  type DecisaoDoCliente,
  type DependenciasDaRotina,
  type EscolhidosDoPedido,
  type NegociacaoDoPedido,
  type ResultadoDaRotina,
} from "./escolhidos-sem-resposta";
import { linkParaQuemFechou } from "./link-de-quem-fecha-pelo-whatsapp";
import { pedidoFechado } from "./pedido-arrumado";
import { MAXIMO_DE_ESCOLHIDOS } from "./lista-de-parceiros-da-mudanca";
import { conferirAssinaturasDoPreco, conferirEscolha, listaDosParceirosDaMudanca } from "./parceiros-da-mudanca";
import { enviarAOutrosEscolhidos, pedidoDaListaDoPedido } from "./mudanca-com-parceiros-escolhidos";
import { urlDeAccao } from "./url-do-site";

/**
 * OS ESCOLHIDOS SEM RESPOSTA, NO SERVIDOR — 11-11-2026 (d6).
 *
 * O que toca na base e nos canais: a rotina horária com as leituras e os
 * envios verdadeiros (os avisos automáticos de sempre: o WhatsApp da CLYON, o
 * email e o aviso na app), as três saídas do cliente (por `agirComoCliente`,
 * a mesma função do link, da conta e da app) e o registo da equipa. As regras
 * e os textos são os de `escolhidos-sem-resposta.ts`.
 */

type Resposta = { status: number; corpo: Record<string, unknown> };

const falha = (status: number, error: string, mais: Record<string, unknown> = {}): Resposta => ({ status, corpo: { ok: false, error, ...mais } });

/* ── A rotina horária ───────────────────────────────────────────────────── */

function dependencias(agora: Date): DependenciasDaRotina {
  return {
    ler: () => pedidosComEscolhidosPorResponder(),
    reservar: (pedidoId, marca) => reservarAvisoSemResposta(pedidoId, marca),
    // Quem tem conta vai para /conta; quem não tem recebe o link do pedido (o mesmo dos avisos de proposta).
    ligacao: async (pedido) =>
      (await linkParaQuemFechou(
        pedido.id,
        { emailDoPedido: async () => (pedido.contactEmail ?? "").trim().toLowerCase() || null, existeContaComEmail, substituirTokenDoPedido },
        agora,
      )) ?? "",
    whatsapp: async (pedido, texto) => {
      const telefone = (pedido.contactPhone ?? "").trim();
      if (telefone.replace(/\D/g, "").length < 9) return false;
      const { enviarAvisoWhatsApp } = await import("./whatsapp-cloud");
      return enviarAvisoWhatsApp(telefone, texto);
    },
    email: async (pedido, email, ligacao) => {
      const para = (pedido.contactEmail ?? "").trim();
      if (!para) return false;
      const { avisarClienteDosEscolhidosSemResposta } = await import("./email-proposta");
      return avisarClienteDosEscolhidosSemResposta({ para, email, ligacao });
    },
    app: async (pedido, aviso) => {
      const email = (pedido.contactEmail ?? "").trim().toLowerCase();
      if (!email) return false;
      const { sendPushToUser } = await import("./webpush");
      const enviados = await sendPushToUser(
        email,
        {
          title: aviso.titulo,
          body: aviso.texto,
          url: `${urlDeAccao().replace(/\/+$/, "")}/conta`,
          tag: `escolhidos_sem_resposta-${pedido.id}`,
          pedidoId: pedido.id,
          tipo: "escolhidos_sem_resposta",
        },
        "cliente",
      );
      return enviados > 0;
    },
    registar: async (pedidoId, marca, linha) => {
      await fecharAvisoSemResposta(pedidoId, marca);
      await appendOrderHistory(pedidoId, { type: "note", by: null, message: linha });
    },
  };
}

/** Uma passagem da rotina, com a base e os canais verdadeiros. Nunca lança. */
export function correrARotinaDosEscolhidos(agora: Date = new Date()): Promise<ResultadoDaRotina> {
  return correrOsEscolhidosSemResposta(dependencias(agora), agora);
}

/* ── As três saídas do cliente ──────────────────────────────────────────── */

const NOSSAS: ReadonlySet<string> = new Set(Object.values(ACCOES_DOS_ESCOLHIDOS));

export function eAccaoDosEscolhidos(accao: unknown): boolean {
  return typeof accao === "string" && NOSSAS.has(accao);
}

type PedidoDoCliente = {
  id: number;
  status?: string | null;
  rawOrderJson?: string | null;
  description?: string | null;
  city?: string | null;
  urgency?: string | null;
  valorDesejadoCliente?: unknown;
  precisaFatura?: unknown;
  formaDePagamento?: unknown;
};

type Lido = {
  escolha: NonNullable<Awaited<ReturnType<typeof escolhaDoPedido>>>;
  resumo: EscolhidosDoPedido;
  negociacoes: Array<NegociacaoDoPedido & { providerId: number }>;
};

async function ler(pedidoId: number): Promise<Lido | null> {
  const escolha = await escolhaDoPedido(pedidoId);
  const resumo = escolha ? escolhidosDeJson(escolha.resumoJson) : null;
  if (!escolha || !resumo) return null;
  const negociacoes = (await negociacoesDoPedido(pedidoId)).map((n) => ({
    providerId: Number(n.providerId),
    estado: n.estado,
    propostasJson: n.propostasJson ?? null,
    confirmadoEm: n.confirmadoEm ?? null,
    escolhidoPeloCliente: (n as { tarifaCongeladaJson?: string | null }).tarifaCongeladaJson != null ? 1 : 0,
    prazoRespostaEm: (n as { prazoRespostaEm?: Date | string | null }).prazoRespostaEm ?? null,
    profissionalNome: n.profissionalNome ?? null,
  }));
  return { escolha, resumo, negociacoes };
}

/** O que o ecrã do pedido mostra: o cartão das três saídas, ou a linha do prazo enquanto corre. */
function vista(l: Lido, fechado: boolean, agora: Date) {
  return {
    cartao: cartaoDoCliente(l.negociacoes, l.resumo, agora, fechado),
    prazoTexto: fechado ? null : linhaDoPrazoParaOCliente(l.negociacoes, agora),
  };
}

/** A vista dos escolhidos de um pedido, para a página do pedido desenhar à primeira (sem acção nenhuma). */
export async function escolhidosParaOCliente(pedido: PedidoDoCliente, agora: Date = new Date()) {
  try {
    const l = await ler(Number(pedido.id));
    return l ? vista(l, pedidoFechado(pedido.status), agora) : null;
  } catch (e) {
    console.error("[escolhidos sem resposta] a vista do cliente não se leu:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** A lista do pedido, feita agora, sem os parceiros que já o têm. */
async function listaSemOsQueJaTem(pedido: PedidoDoCliente, l: Lido, agora: Date) {
  let order: Record<string, unknown>;
  try {
    order = JSON.parse(pedido.rawOrderJson ?? "{}") as Record<string, unknown>;
  } catch {
    order = {};
  }
  const lido = pedidoDaListaDoPedido({ ...order, pessoas: l.escolha.pessoas ?? order.pessoas, formaDePagamento: pedido.formaDePagamento ?? order.formaDePagamento });
  if (!lido.ok) return { ok: false as const, erro: lido.erro };
  const lista = await listaDosParceirosDaMudanca(lido.pedido, agora, undefined, { comFiltroDoPagamento: true });
  if (!lista.ok) return { ok: false as const, erro: lista.erro };
  const jaTem = new Set(l.negociacoes.map((n) => n.providerId));
  const escolhiveis = lista.escolhiveis.filter((x) => !jaTem.has(x.providerId));
  const ids = new Set(escolhiveis.map((x) => x.id));
  return { ok: true as const, pedidoDaLista: lido.pedido, lista, escolhiveis, cartoes: lista.cartoes.filter((c) => ids.has(c.id)) };
}

/**
 * O CLIENTE RESPONDE AO AVISO — esperar, escolher outro parceiro da lista ou
 * pedir à CLYON que procure. Quem chama (`agirComoCliente`) já provou que o
 * pedido é dele. Só o pedido à CLYON abre o pedido a mais parceiros, e quem
 * o envia é a equipa, pela Mesa.
 */
export async function agirSobreOsEscolhidos(a: {
  pedido: PedidoDoCliente;
  accao: string;
  corpo: { parceiros?: unknown; assinaturas?: unknown };
  baseUrl: string;
  agora?: Date;
}): Promise<Resposta> {
  const agora = a.agora ?? new Date();
  const pedidoId = Number(a.pedido.id);
  // Quem chama pode trazer só o essencial do pedido: o resto lê-se aqui.
  if (a.pedido.status === undefined || a.pedido.rawOrderJson === undefined) {
    const inteiro = await getSimulatorOrderById(pedidoId);
    if (!inteiro) return falha(404, "Pedido não encontrado.");
    a = { ...a, pedido: inteiro as PedidoDoCliente };
  }
  const l = await ler(pedidoId);
  // Ver um pedido sem parceiros escolhidos não é erro: não há nada a mostrar.
  if (!l && a.accao === ACCOES_DOS_ESCOLHIDOS.ver) return { status: 200, corpo: { ok: true, cartao: null, prazoTexto: null } };
  if (!l) return falha(404, "Este pedido não tem parceiros escolhidos.");
  const fechado = pedidoFechado(a.pedido.status);

  if (a.accao === ACCOES_DOS_ESCOLHIDOS.ver) return { status: 200, corpo: { ok: true, ...vista(l, fechado, agora) } };

  // Daqui para baixo muda-se alguma coisa: só enquanto ninguém respondeu e o pedido está aberto.
  if (fechado) return falha(409, ERROS_DO_CLIENTE.jaFechado, { jaNaoEPreciso: true, botao: ERROS_DO_CLIENTE.verOPedido });
  if (!semRespostaDosEscolhidos(l.negociacoes, agora)) {
    return falha(409, ERROS_DO_CLIENTE.jaRespondeu, { jaNaoEPreciso: true, botao: ERROS_DO_CLIENTE.verOPedido });
  }
  const gravar = async (decisao: DecisaoDoCliente, mais: { procurarMais?: true; escolhidos?: unknown; prazoRespostaEm?: string } = {}) => {
    const ok = await mudarEscolhaDoPedido(pedidoId, { decisaoDoCliente: decisao, ...mais });
    if (!ok) throw new Error("a escolha do cliente não se gravou");
    l.resumo.decisao = decisao;
    if (mais.procurarMais) l.resumo.procurarMais = true;
  };
  const historico = (message: string) =>
    appendOrderHistory(pedidoId, { type: "note", by: null, message }).catch((e) =>
      console.error("[escolhidos sem resposta] o histórico não se gravou:", e instanceof Error ? e.message : e),
    );

  if (a.accao === ACCOES_DOS_ESCOLHIDOS.esperar) {
    await gravar({ saida: "esperar", em: agora.toISOString(), por: "cliente" });
    await historico(HISTORICO_DO_CLIENTE.esperar);
    return { status: 200, corpo: { ok: true, ...vista(l, false, agora) } };
  }

  if (a.accao === ACCOES_DOS_ESCOLHIDOS.pedirAClyon) {
    // Já tinha pedido (na lista ou antes): não se regista outra vez.
    if (!oClientePediuAClyon(l.resumo) || l.resumo.decisao?.saida !== "pedir_a_clyon") {
      await gravar({ saida: "pedir_a_clyon", em: agora.toISOString(), por: "cliente" }, { procurarMais: true });
      await historico(HISTORICO_DO_CLIENTE.pedirAClyon);
    }
    return { status: 200, corpo: { ok: true, ...vista(l, false, agora) } };
  }

  const lista = await listaSemOsQueJaTem(a.pedido, l, agora);
  if (!lista.ok) return falha(409, lista.erro);

  if (a.accao === ACCOES_DOS_ESCOLHIDOS.listaParaEscolherOutro) {
    return {
      status: 200,
      corpo: {
        ok: true,
        titulo: TEXTOS_DE_ESCOLHER_OUTRO.titulo,
        linha: TEXTOS_DE_ESCOLHER_OUTRO.linha(MAXIMO_DE_ESCOLHIDOS),
        botao: TEXTOS_DE_ESCOLHER_OUTRO.botao,
        maximoDeEscolhidos: MAXIMO_DE_ESCOLHIDOS,
        pessoas: lista.pedidoDaLista.pessoas,
        parceiros: lista.cartoes,
        semMaisNinguem: lista.cartoes.length === 0 ? TEXTOS_DE_ESCOLHER_OUTRO.semMaisNinguem : null,
      },
    };
  }

  // ── «Pedir orçamento» aos que escolheu agora ──────────────────────────────
  const conferida = conferirEscolha(a.corpo.parceiros, lista.escolhiveis);
  if (!conferida.ok) return falha(409, conferida.erro);
  const preco = conferirAssinaturasDoPreco(a.corpo.assinaturas, conferida.escolhidos, agora);
  if (!preco.ok) return falha(409, preco.erro, { precoMudou: true });

  let fotos = 0;
  try {
    const cru = JSON.parse(a.pedido.rawOrderJson ?? "{}");
    fotos = Array.isArray(cru?.files) ? cru.files.length : 0;
  } catch {
    fotos = 0;
  }
  const envio = await enviarAOutrosEscolhidos(
    {
      id: pedidoId,
      description: a.pedido.description ?? null,
      city: a.pedido.city ?? null,
      urgency: a.pedido.urgency ?? null,
      quantidadeDeFotos: fotos,
      valorDesejadoCliente: a.pedido.valorDesejadoCliente != null ? Number(a.pedido.valorDesejadoCliente) : null,
      precisaFatura: Boolean(a.pedido.precisaFatura),
      formaDePagamento: a.pedido.formaDePagamento,
      baseUrl: a.baseUrl,
    },
    {
      pedidoDaLista: lista.pedidoDaLista,
      pessoas: lista.pedidoDaLista.pessoas,
      escolhidos: conferida.escolhidos,
      cartoesVistos: [],
      kmPercurso: lista.lista.kmPercurso,
      horas: lista.lista.horas,
      origemPonto: lista.lista.origemPonto,
      zonaPonto: lista.lista.zonaPonto,
      destinoPonto: lista.lista.destinoPonto,
      procurarMais: l.resumo.procurarMais,
    },
    agora,
  );
  if (envio.receberam === 0) return falha(409, "Não foi possível enviar o pedido aos parceiros que escolheu. Tente outra vez, ou peça à CLYON que procure por si.");

  const nomes = conferida.escolhidos.map((x) => x.nome);
  await gravar(
    { saida: "escolher_outro", em: agora.toISOString(), por: "cliente", nomes, prazoEm: envio.prazo.toISOString() },
    {
      escolhidos: [...l.escolha.escolhidos, ...conferida.escolhidos.map((x) => ({ id: x.id, providerId: x.providerId, nome: x.nome }))],
      prazoRespostaEm: envio.prazo.toISOString(),
    },
  );
  await historico(linhaDoHistoricoEscolheuOutro(nomes, envio.prazo));
  return { status: 200, corpo: { ok: true, enviado: pedidoEnviadoAOutros(nomes, envio.prazo, agora), cartao: null, prazoTexto: null } };
}

/* ── A equipa, na Mesa ──────────────────────────────────────────────────── */

/** O resumo da escolha de um pedido (null sem parceiros escolhidos) — para a guarda do «Enviar a mais profissionais». */
export async function resumoDosEscolhidos(pedidoId: number): Promise<EscolhidosDoPedido | null> {
  const escolha = await escolhaDoPedido(pedidoId);
  return escolha ? escolhidosDeJson(escolha.resumoJson) : null;
}

/** «O cliente pediu que procurássemos»: o pedido feito por telefone ou WhatsApp, registado por quem o ouviu. */
export async function registarQueOClientePediu(pedidoId: number, operador: string, agora: Date = new Date()): Promise<Resposta> {
  const resumo = await resumoDosEscolhidos(pedidoId);
  if (!resumo) return falha(404, "Este pedido não tem parceiros escolhidos pelo cliente.");
  if (oClientePediuAClyon(resumo)) return { status: 200, corpo: { ok: true, jaEstava: true } };
  const ok = await mudarEscolhaDoPedido(pedidoId, {
    decisaoDoCliente: { saida: "pedir_a_clyon", em: agora.toISOString(), por: "equipa", operador } satisfies DecisaoDoCliente,
    procurarMais: true,
  });
  if (!ok) return falha(500, "Não foi possível registar.");
  await appendOrderHistory(pedidoId, { type: "note", by: null, message: linhaDoHistoricoRegistadoPelaEquipa(operador) });
  return { status: 200, corpo: { ok: true } };
}

/** Depois de «Enviar a mais profissionais»: fica escrito quando e a quantos (o selo apaga-se). */
export async function registarEnvioAMais(pedidoId: number, quantos: number, agora: Date = new Date()): Promise<void> {
  await mudarEscolhaDoPedido(pedidoId, { enviadoAMais: { em: agora.toISOString(), quantos } }).catch((e) =>
    console.error("[escolhidos sem resposta] o envio a mais não se registou:", e instanceof Error ? e.message : e),
  );
}
