/**
 * OS PEDIDOS DO CLIENTE, COMO A API OS MANDA — os contratos da R4, da R5, da R8
 * e da R10 (especificação da app de cliente, secção 5, versão 2 de 28-10-2026).
 *
 * A app não tem regras de preço, taxas nem IVA: cada número de dinheiro chega
 * já escrito (`preco.principal`, `preco.detalhe`, `preco.nota`) e mostra-se tal
 * como vem. As datas também (`…Texto`, já na hora de Lisboa). Aqui só se
 * decide O QUE mostrar e por que ordem — e a ordem é sempre a da API (a app
 * não reordena: P3, 28-10-2026).
 *
 * Puro de propósito (sem Expo nem React Native): os testes do site importam-no
 * e comparam-no com o que as rotas devolvem.
 */

export const ROTA_DOS_PEDIDOS = "/api/cliente/pedidos";
export const ROTA_DO_PEDIDO = (id: number) => `/api/cliente/pedidos/${id}`;
export const ROTA_DAS_ACCOES = "/api/users/me/negociacao";
export const ROTA_DO_PEDIDO_DO_LINK = "/api/cliente/pedido-do-link";

/* ─── R4 — a lista ────────────────────────────────────────────────────────── */

export type PedidoNaLista = {
  id: number;
  servico: string;
  cidade: string | null;
  criadoEm: string | null;
  criadoEmTexto: string | null;
  estadoTexto: string;
  novidade: string | null;
  trabalhoClyon: boolean;
};

export type RespostaDaLista = {
  ok: boolean;
  pedidos: PedidoNaLista[];
  pagina: number;
  paginas: number;
  total: number;
};

/** O número do separador «Pedidos»: os pedidos com novidade. */
export function quantosComNovidade(pedidos: readonly PedidoNaLista[]): number {
  return pedidos.filter((p) => typeof p.novidade === "string" && p.novidade.length > 0).length;
}

/** Junta as páginas da lista sem repetir pedidos, pela ordem em que chegaram. */
export function juntarPaginas(antes: readonly PedidoNaLista[], novos: readonly PedidoNaLista[]): PedidoNaLista[] {
  const vistos = new Set(antes.map((p) => p.id));
  return [...antes, ...novos.filter((p) => !vistos.has(p.id))];
}

/** Uma lista guardada no telemóvel que ainda tem a forma certa (sem rede, mostra-se esta). */
export function listaValida(v: unknown): { pedidos: PedidoNaLista[]; lidaEm: string } | null {
  const o = v as { pedidos?: unknown; lidaEm?: unknown } | null;
  if (!o || !Array.isArray(o.pedidos) || typeof o.lidaEm !== "string") return null;
  const pedidos = o.pedidos.filter(
    (p): p is PedidoNaLista =>
      !!p && typeof (p as PedidoNaLista).id === "number" && typeof (p as PedidoNaLista).estadoTexto === "string",
  );
  return { pedidos, lidaEm: o.lidaEm };
}

/* ─── R5 — o pedido ───────────────────────────────────────────────────────── */

export type TextosDoPreco = { principal: string; detalhe: string; nota: string };

export type ValorClyon = TextosDoPreco & {
  /** O `propostaEnviadaEm` em ISO (S7): vai com «Aceito este preço» para o site saber que é este preço. */
  versao?: string;
};

export type Avaliacao = {
  estrelas: number;
  comentario: string | null;
  quando: string | null;
  servico: string | null;
  cidade: string | null;
};

export type Profissional = {
  nome: string;
  telefone: string | null;
  guiaVerificada: boolean;
  notaMedia: number | null;
  notaTexto: string;
  quantasAvaliacoes: number;
  trabalhosConcluidos: number;
  naClyonDesde: string | null;
  naClyonDesdeTexto: string | null;
  zonas: string[];
  raioKm: number | null;
  avaliacoes: Avaliacao[];
  /** Só se a P6 for (b) ou (c): «Costuma responder em menos de 1 hora». */
  respostaTexto?: string | null;
};

export type Ajuste = {
  motivo: string | null;
  fotos: string[];
  sobe: boolean;
  antes: TextosDoPreco;
  depois: TextosDoPreco;
  ate: string | null;
  ateTexto: string | null;
  regraTexto: string;
};

export type PendenteDoPagamento = {
  metodo: string;
  metodoTexto: string;
  entidade: string | null;
  referencia: string | null;
  valorTexto: string;
  expiraEm: string | null;
  expiraEmTexto: string | null;
};

export type Pagamento = {
  disponivel: boolean;
  pago: boolean;
  pagoEmTexto: string | null;
  emDinheiroAoProfissional: boolean;
  pendentes: PendenteDoPagamento[];
  ivaIncluido: boolean;
  valoresTexto: { comFactura: string; semFactura: string };
};

export type FaseDoTrabalho = "a_negociar" | "a_executar" | "a_confirmar" | "confirmado" | "pago";

export type Negociacao = {
  id: number;
  estado: string;
  estadoTexto: string;
  fase: FaseDoTrabalho | string;
  profissional: Profissional;
  accoes: string[];
  aguardaContratacao: boolean;
  propostasRestantes: number;
  preco: TextosDoPreco | null;
  precoEtiqueta: string;
  formaTexto: string;
  dataCombinada: string | null;
  dataCombinadaTexto: string | null;
  aCaminhoEm: string | null;
  aCaminhoEmTexto: string | null;
  chegouEm: string | null;
  chegouEmTexto: string | null;
  execucaoEnviadaEm: string | null;
  execucaoEnviadaEmTexto: string | null;
  confirmadoEm: string | null;
  confirmadoEmTexto: string | null;
  pagoEm: string | null;
  pagoEmTexto: string | null;
  avaliado: boolean;
  estrelas: number | null;
  prova: string[];
  provaNota: string | null;
  ajuste: Ajuste | null;
  porConfirmarPelaClyon: boolean;
  diasAteLibertarTexto: string | null;
  botaoDeConfirmar: string;
  pagamento: Pagamento | null;
};

export type Pedido = {
  id: number;
  servico: string;
  estadoTexto: string;
  morada: string | null;
  cidade: string | null;
  quando: string | null;
  descricao: string | null;
  fotos: string[];
  precisaFatura: boolean;
  precisaGuiaTransporte: boolean;
  avisos: string[];
  criadoEm: string | null;
  criadoEmTexto: string | null;
  trabalhoClyon: boolean;
  valorClyon: ValorClyon | null;
  quemFaz: string | null;
  /** S7: `["aceitar_preco_clyon"]` quando o preço da CLYON espera pela resposta dele. */
  accoes?: string[];
  precoAceiteEm?: string | null;
  precoAceiteEmTexto?: string | null;
};

export type TextosDoPedido = {
  sobreAsPropostas: string;
  sobreOValorCombinado: string;
  /** S8/S9: os textos de «Recusar», os mesmos do site. */
  recusar?: { comOutras: string; semOutras: string };
};

export type RespostaDoPedido = {
  ok: boolean;
  pedido: Pedido;
  negociacoes: Negociacao[];
  historico: Array<{ type: string; message: string; createdAt: string; by: { nome: string } | null; quandoTexto: string | null }>;
  podeCancelar: boolean;
  textos: TextosDoPedido;
};

/** Ainda à espera de resposta dele ou do profissional — o que aparece como proposta (E5b). */
export const ESTA_EM_ABERTO = (n: Pick<Negociacao, "estado">) => n.estado === "aberta" || n.estado === "aguarda_contratacao";

/** A negociação fechada (contratada), se houver. */
export function contratadaDe(r: Pick<RespostaDoPedido, "negociacoes">): Negociacao | null {
  return r.negociacoes.find((n) => n.estado === "acordada") ?? null;
}

/** As propostas por decidir, pela ordem da API (a última actividade em cima, P3). */
export function propostasEmAberto(r: Pick<RespostaDoPedido, "negociacoes">): Negociacao[] {
  return r.negociacoes.filter(ESTA_EM_ABERTO);
}

/** A acção de «Contratar» desta proposta: `contratar` (ele aceitou o valor do cliente) ou `aceitar` (a proposta dele). */
export function accaoDeContratar(n: Pick<Negociacao, "accoes">): "contratar" | "aceitar" | null {
  if (n.accoes.includes("contratar")) return "contratar";
  if (n.accoes.includes("aceitar")) return "aceitar";
  return null;
}

/**
 * «Recusar» só aparece quando a API o permite (`desistir`) E já manda o texto
 * da confirmação (`textos.recusar`, S8/S9) — o mesmo do site, que avisa o
 * profissional. Sem o texto, a app não o inventa.
 */
export function podeRecusar(n: Pick<Negociacao, "accoes">, textos: TextosDoPedido): boolean {
  return n.accoes.includes("desistir") && !!textos.recusar?.comOutras && !!textos.recusar?.semOutras;
}

/** A pergunta de «Recusar», com o nome: «com outras» se houver outras propostas em aberto. */
export function perguntaDeRecusar(n: Negociacao, r: Pick<RespostaDoPedido, "negociacoes" | "textos">): string | null {
  const t = r.textos.recusar;
  if (!t) return null;
  const outras = propostasEmAberto(r).some((o) => o.id !== n.id);
  return (outras ? t.comOutras : t.semOutras).replaceAll("{nome}", n.profissional.nome);
}

/** A confirmação de «Contratar» (E5): o preço, a nota e quem faz o trabalho. */
export function textoDeContratar(n: Negociacao): { titulo: string; texto: string } {
  const preco = n.preco ? `${n.preco.principal}.${n.preco.nota ? ` ${n.preco.nota}` : ""} ` : "";
  return {
    titulo: `Contratar ${n.profissional.nome}?`,
    texto: `${preco}O trabalho é feito por ${n.profissional.nome}, profissional verificado que escolheu. As outras propostas fecham.`,
  };
}

/** O que mostrar antes de haver propostas (E5a), pelo estado em palavras da API. */
export function textoDaEspera(r: Pick<RespostaDoPedido, "pedido" | "negociacoes">): string | null {
  if (r.pedido.trabalhoClyon || r.negociacoes.some((n) => n.estado === "acordada")) return null;
  if (propostasEmAberto(r).length > 0) return null;
  if (r.pedido.estadoTexto === "Cancelado" || r.pedido.estadoTexto === "Concluído") return null;
  if (r.pedido.estadoTexto === "À espera de propostas") {
    return "O pedido foi enviado aos profissionais da zona. Ainda sem propostas.";
  }
  return "A CLYON está a rever o seu pedido.";
}

/* ─── E5d — Trabalho CLYON de valor fixo (P2) ─────────────────────────────── */

export type MomentoDoTrabalhoClyon =
  | { momento: "a-rever" }
  | { momento: "por-responder"; valor: ValorClyon; versao: string }
  | { momento: "aceite"; valor: ValorClyon; aceiteEmTexto: string | null }
  | { momento: "com-profissional"; valor: ValorClyon | null; quemFaz: string };

/**
 * O momento de um Trabalho CLYON, só pelo que a R5 manda. O preço só aparece
 * depois de enviado ao cliente: sem `versao` (o `propostaEnviadaEm`, S7) a app
 * trata-o como «a ser revisto» — a equipa pode ainda estar a acertá-lo.
 */
export function momentoDoTrabalhoClyon(p: Pedido): MomentoDoTrabalhoClyon {
  if (p.quemFaz) return { momento: "com-profissional", valor: p.valorClyon?.versao ? p.valorClyon : null, quemFaz: p.quemFaz };
  const valor = p.valorClyon;
  if (!valor || !valor.versao) return { momento: "a-rever" };
  if (p.precoAceiteEm) return { momento: "aceite", valor, aceiteEmTexto: p.precoAceiteEmTexto ?? null };
  if ((p.accoes ?? []).includes("aceitar_preco_clyon")) return { momento: "por-responder", valor, versao: valor.versao };
  return { momento: "a-rever" };
}

/* ─── E8 — a linha do tempo ───────────────────────────────────────────────── */

export type PassoDaLinha = { titulo: string; quando: string | null };

/** O que já aconteceu, pela ordem do E8, com as datas que a API manda (já em Lisboa). */
export function linhaDoTempo(n: Negociacao): PassoDaLinha[] {
  const passos: PassoDaLinha[] = [{ titulo: "Contratado", quando: null }];
  passos.push(
    n.dataCombinadaTexto
      ? { titulo: `Dia combinado: ${n.dataCombinadaTexto}`, quando: null }
      : { titulo: "O profissional vai combinar o dia consigo.", quando: null },
  );
  if (n.aCaminhoEmTexto) passos.push({ titulo: "A caminho", quando: n.aCaminhoEmTexto });
  if (n.chegouEmTexto) passos.push({ titulo: "Chegou", quando: n.chegouEmTexto });
  if (n.execucaoEnviadaEmTexto) passos.push({ titulo: "Trabalho feito — confirme", quando: n.execucaoEnviadaEmTexto });
  if (n.confirmadoEmTexto) passos.push({ titulo: "Confirmado", quando: n.confirmadoEmTexto });
  if (n.avaliado) passos.push({ titulo: "Avaliado", quando: null });
  return passos;
}

/* ─── R10 — o link de um pedido ───────────────────────────────────────────── */

export type RespostaDoPedidoDoLink =
  | { ok: true; estado: "seu"; id: number; juntado?: boolean }
  | { ok: true; estado: "semEmail"; id: number; servico: string; cidade: string | null; criadoEmTexto: string | null }
  | { ok: true; estado: "outroEmail" };

/* ─── Mensagens do WhatsApp (as frases da página do pedido no site) ───────── */

export const WHATSAPP_LINK_EXPIROU = "Olá! O link do meu pedido expirou. Podem enviar outro?";
export const WHATSAPP_LINK_NAO_ABRE = "Olá! O link do meu pedido já não abre. Podem verificar?";
export const whatsappHaUmProblema = (id: number) => `Pedido #${id}: há um problema com o trabalho.`;
