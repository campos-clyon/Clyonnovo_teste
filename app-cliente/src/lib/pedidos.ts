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
import { mensagemDaTrocaDeParceiro, mensagemDoProblema } from "../../../src/lib/frases-do-pedido";

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
  /** «Registada pela CLYON a pedido do cliente» (d6), já escrita pela API; `null` nas do cliente. */
  registada?: string | null;
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
  /** A diferença das horas de um trabalho por hora (31-10-2026). Opcional: um site antigo não a manda. */
  diferenca?: {
    aPagar: number;
    aDevolver: number;
    pago: boolean;
    texto: string | null;
    devolverTexto: string | null;
    pendentes: PendenteDoPagamento[];
  } | null;
};

/**
 * AS HORAS DO TRABALHO POR HORA — 31-10-2026, como a API as escreve
 * (`horasParaOCliente` no site). A app não faz contas.
 */
export type HorasMarcadas = {
  texto: string;
  inicio: string;
  fim: string;
  passaDaMeiaNoite: boolean;
  horas: number;
  horasTexto: string;
  duracaoTexto: string;
  materiais: string[];
  totalTexto: string;
  aPagar: number;
  marcadasEmTexto: string | null;
  confirmadas: boolean;
  confirmadasPorTexto: string | null;
  confirmadasEmTexto: string | null;
  contestadas: boolean;
  contestacao: string | null;
};

export type HorasDoTrabalho = {
  titulo: string;
  porHoraTexto: string | null;
  estimativaTexto: string | null;
  horasPrevistas: number;
  regraTexto: string;
  marcadas: HorasMarcadas | null;
  estadoTexto: string | null;
  podeResponder: boolean;
  botaoConfirmar: string;
  botaoNaoConcordo: string;
};

/** O motivo do «Não concordo» — 5 a 300 caracteres (a mesma regra do site). */
export const MOTIVO_MINIMO_DAS_HORAS = 5;
export const MOTIVO_MAXIMO_DAS_HORAS = 300;

/** O corpo de «Confirmo as horas» / «Não concordo» (R8, 31-10-2026). */
export function corpoDasHoras(p: { pedidoId: number; negociacaoId: number; accao: "confirmar_horas" | "contestar_horas"; motivo?: string }) {
  return p.accao === "contestar_horas"
    ? { pedidoId: p.pedidoId, negociacaoId: p.negociacaoId, accao: p.accao, motivo: (p.motivo ?? "").trim() }
    : { pedidoId: p.pedidoId, negociacaoId: p.negociacaoId, accao: p.accao };
}

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
  /** «Estou próximo» (30-10-2026). Opcionais: um site antigo não os manda. */
  proximoEm?: string | null;
  proximoEmTexto?: string | null;
  chegouEm: string | null;
  chegouEmTexto: string | null;
  /** O cliente confirmou que o parceiro chegou — com o «Cheguei» dele, abre o concluir. */
  chegadaConfirmadaEm?: string | null;
  chegadaConfirmadaEmTexto?: string | null;
  /** A viagem em palavras do cliente («O parceiro está próximo.»), da API. */
  viagemTexto?: string | null;
  chegadaConfirmada?: boolean;
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
  /** Por hora (31-10-2026): as horas e o preço por hora; `null` nos outros. Opcionais: um site antigo não os manda. */
  horas?: HorasDoTrabalho | null;
  /** «Materiais incluídos» ou «Materiais à parte: …», da proposta. */
  materiaisTexto?: string | null;
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
  /** O telefone do pedido (d8): o MB WAY vem preenchido com ele, como no site. Um site antigo não o manda. */
  telefone?: string | null;
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
  /** d8: à espera das primeiras propostas, com o prazo — a mesma frase do /pedido/[token]. */
  aindaSemPropostas?: string;
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
    texto: `${preco}O trabalho é feito por ${n.profissional.nome}, parceiro verificado que escolheu. As outras propostas fecham.`,
  };
}

/** O que mostrar antes de haver propostas (E5a), pelo estado em palavras da API. */
export function textoDaEspera(r: Pick<RespostaDoPedido, "pedido" | "negociacoes"> & { textos?: Partial<TextosDoPedido> }): string | null {
  if (r.pedido.trabalhoClyon || r.negociacoes.some((n) => n.estado === "acordada")) return null;
  if (propostasEmAberto(r).length > 0) return null;
  if (r.pedido.estadoTexto === "Cancelado" || r.pedido.estadoTexto === "Concluído") return null;
  if (r.pedido.estadoTexto === "À espera de propostas") {
    // A frase do site, com o prazo (d8, 31-10-2026), vem da R5; um site antigo não a manda.
    return r.textos?.aindaSemPropostas ?? "Ainda sem propostas.";
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
      : { titulo: "O parceiro vai combinar o dia consigo.", quando: null },
  );
  if (n.aCaminhoEmTexto) passos.push({ titulo: "A caminho", quando: n.aCaminhoEmTexto });
  if (n.proximoEmTexto) passos.push({ titulo: "Está próximo", quando: n.proximoEmTexto });
  if (n.chegouEmTexto) passos.push({ titulo: "Chegou", quando: n.chegouEmTexto });
  if (n.chegadaConfirmadaEmTexto) passos.push({ titulo: "Confirmou que chegou", quando: n.chegadaConfirmadaEmTexto });
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
/** A mesma frase do site (d8, 31-10-2026): `frases-do-pedido.ts`. */
export const whatsappHaUmProblema = mensagemDoProblema;

/* ─── v3 (29-10-2026) — o que a R4/R5 ganham com a S18, a S22 e a S17 ─────── */

/*
 * Ficam FORA dos tipos `Pedido`, `Negociacao` e `PedidoNaLista` de propósito:
 * o teste dos tipos confere esses três contra o que a R5 devolve hoje, e
 * estes campos chegam com as rotas novas. Todos opcionais: sem eles, o ecrã
 * mostra o que mostrava.
 */

/** S18 (c14aab89): `de` é «CLYON» ou «Eu», nunca o nome de quem escreveu na equipa. */
export type MensagemDoPedido = { de: "CLYON" | "Eu"; tipo?: "detalhes" | "resposta" | "mensagem"; texto: string; quandoTexto: string | null };
export const eMinha = (m: Pick<MensagemDoPedido, "de">) => String(m.de).toLowerCase() === "eu";

export type ExtrasDoPedidoV3 = {
  dataPreferidaTexto?: string | null;
  /** O acesso em palavras: um lado, ou origem e destino numa mudança. */
  acesso?: string | { origem?: string | null; destino?: string | null } | null;
  repeticao?: string | null;
  videos?: string[];
  mensagens?: MensagemDoPedido[];
  /** A CLYON pediu mais detalhes e falta a resposta dele (S18). */
  precisaDeSi?: boolean;
  /** S17: se pode alterar, o quê, e se há uma alteração à espera. */
  alteracoes?: { pode: boolean; campos: string[]; pendente: { quandoTexto: string | null; texto?: string } | null; texto?: string } | null;
  /** O pedido contratado: o texto «O trabalho já está combinado com {nome}…» vem da API. */
  combinadoTexto?: string | null;
  /** O fim de um Trabalho CLYON (d6): o dia, o pagamento, «a CLYON confirma» e a avaliação. */
  fimClyon?: FimDoTrabalhoClyon | null;
};

/**
 * O FIM DE UM TRABALHO CLYON — d6, 31-10-2026, como a R5 o manda (só a parte
 * do cliente: nunca o valor do profissional nem a taxa). Os textos vêm
 * escritos; o pagamento é o mesmo das negociações.
 */
export type FimDoTrabalhoClyon = {
  negociacaoId: number;
  profissional: string;
  fase: FaseDoTrabalho | string;
  dataCombinada: string | null;
  dataCombinadaTexto: string | null;
  confirmadoEm: string | null;
  confirmadoEmTexto: string | null;
  podePagar: boolean;
  estrelas: number | null;
  podeAvaliar: boolean;
  pagamento: Pagamento | null;
  textos: { quemFaz: string; dia: string; aClyonConfirma: string | null; pergunta: string };
};

/**
 * A negociação «do cliente» de um Trabalho CLYON, para os mesmos ecrãs das
 * outras (Pagar, Acompanhar, Avaliar): só com o que a R5 manda; o resto vazio.
 * Sem telefone (o cliente fala com a CLYON) nem o «Trabalho feito — confirme»
 * (num Trabalho CLYON quem confirma é a CLYON).
 */
export function negociacaoDoFimClyon(f: FimDoTrabalhoClyon): Negociacao {
  return {
    id: f.negociacaoId,
    estado: "acordada",
    estadoTexto: "",
    fase: f.fase,
    profissional: {
      nome: f.profissional,
      telefone: null,
      guiaVerificada: false,
      notaMedia: null,
      notaTexto: "",
      quantasAvaliacoes: 0,
      trabalhosConcluidos: 0,
      naClyonDesde: null,
      naClyonDesdeTexto: null,
      zonas: [],
      raioKm: null,
      avaliacoes: [],
    },
    accoes: f.podeAvaliar ? ["avaliar"] : [],
    aguardaContratacao: false,
    propostasRestantes: 0,
    preco: null,
    precoEtiqueta: "",
    formaTexto: "",
    dataCombinada: f.dataCombinada,
    dataCombinadaTexto: f.dataCombinadaTexto,
    aCaminhoEm: null,
    aCaminhoEmTexto: null,
    chegouEm: null,
    chegouEmTexto: null,
    execucaoEnviadaEm: null,
    execucaoEnviadaEmTexto: null,
    confirmadoEm: f.confirmadoEm,
    confirmadoEmTexto: f.confirmadoEmTexto,
    pagoEm: null,
    pagoEmTexto: null,
    avaliado: f.estrelas != null,
    estrelas: f.estrelas,
    prova: [],
    provaNota: null,
    ajuste: null,
    porConfirmarPelaClyon: false,
    diasAteLibertarTexto: null,
    botaoDeConfirmar: "",
    pagamento: f.pagamento,
  };
}

export type ExtrasDaNegociacaoV3 = {
  /** S22: os eventos da proposta, já escritos para quem lê (`quando` em ISO; a app mostra só o texto). */
  historico?: Array<{ texto: string; quandoTexto?: string | null }>;
  /** S22: os atalhos de «Propor outro valor», já calculados pelo site: `{ valor, texto }` (a app não calcula). */
  atalhos?: Array<{ valor: number | string; texto?: string; rotulo?: string }>;
  emDuasEntregas?: string[] | null;
  /** d8: a legenda de «Proponha um valor» desta negociação, a mesma do site (`frase-da-contraproposta.ts`). */
  proporAjuda?: string | null;
};

/** `proporAjuda`: a frase do site por baixo de «Proponha um valor» (vem da API, com o imposto escrito). */
export type ExtrasDosTextosV3 = { rodape?: string; responderam?: string; proporAjuda?: string };

export type PedidoV3 = Pedido & ExtrasDoPedidoV3;
export type NegociacaoV3 = Negociacao & ExtrasDaNegociacaoV3;

/** A primeira fotografia do pedido, no cartão da lista (R4 v3). */
export type ExtrasDaListaV3 = { fotografia?: string | null };

/* ─── E2 v3 — os separadores da lista ─────────────────────────────────────── */

/** Os valores do `?status=` da R4 v3 (S22): todos · em_aberto · concluidos · cancelados. */
export type Separador = "todos" | "em_aberto" | "concluidos" | "cancelados";
export const SEPARADORES: ReadonlyArray<{ id: Separador; nome: string }> = [
  { id: "todos", nome: "Todos" },
  { id: "em_aberto", nome: "Em aberto" },
  { id: "concluidos", nome: "Concluídos" },
  { id: "cancelados", nome: "Cancelados" },
];

/** Os atalhos da R5 para os botões: o texto que se lê e o número que vai para o campo («85,50»). */
export function atalhosDoEcra(a: ExtrasDaNegociacaoV3["atalhos"]): Array<{ rotulo: string; valor: string }> {
  return (a ?? [])
    .map((x) => {
      const n = typeof x.valor === "number" ? x.valor : Number(String(x.valor).replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) return null;
      const valor = (Math.round(n * 100) / 100).toFixed(2).replace(".", ",").replace(/,00$/, "");
      return { rotulo: x.texto ?? x.rotulo ?? valor, valor };
    })
    .filter((x): x is { rotulo: string; valor: string } => !!x);
}

/** O endereço da R4 com o separador (o filtro `status` da `/api/users/me/orders`). */
export const rotaDaLista = (pagina: number, s: Separador) => `${ROTA_DOS_PEDIDOS}?pagina=${pagina}${s === "todos" ? "" : `&status=${s}`}`;

/**
 * Enquanto a R4 não filtra (antes da S22), a app filtra pelo estado em
 * palavras da tabela única do site — sem mudar a ordem.
 */
export function noSeparador(p: Pick<PedidoNaLista, "estadoTexto">, s: Separador): boolean {
  if (s === "todos") return true;
  const cancelado = /^Cancelado/i.test(p.estadoTexto);
  const concluido = /^Conclu[íi]do/i.test(p.estadoTexto);
  if (s === "cancelados") return cancelado;
  if (s === "concluidos") return concluido;
  return !cancelado && !concluido;
}

/* ─── E5 v3 — as acções novas ─────────────────────────────────────────────── */

export const ROTA_DA_RESPOSTA = (id: number) => `/api/cliente/pedidos/${id}/resposta`;
export const ROTA_DA_ALTERACAO = (id: number) => `/api/cliente/pedidos/${id}/alteracao`;

/** «Pedir troca de parceiro»: a mensagem ao WhatsApp da CLYON (G8), a mesma do site (d8): `frases-do-pedido.ts`. */
export const whatsappTrocaDeProfissional = mensagemDaTrocaDeParceiro;

/**
 * O que o «Copiar» põe na área de transferência (d8, 31-10-2026): só o número
 * que o banco pede — sem o «(… sem IVA)» ao lado, sem espaços e sem o «€».
 * «452,03 € (367,50 € sem IVA)» → «452,03»; «123 456 789» → «123456789».
 */
export function paraCopiar(valor: string): string {
  return valor.split(" (")[0].replace(/[^\d,.]/g, "");
}

/** «Propor outro valor» (R8 `propor`): o que ele escreve é o que paga, com IVA incluído — vai como `preco`. */
export function corpoDePropor(pedidoId: number, negociacaoId: number, escrito: string): Record<string, unknown> | null {
  const limpo = escrito.replace(/\s/g, "").replace(/€/g, "");
  if (!/^\d{1,6}([.,]\d{1,2})?$/.test(limpo)) return null;
  return { pedidoId, negociacaoId, accao: "propor", preco: limpo.replace(".", ",") };
}

/** O pagamento com a escolha da fatura (como o site): a app deixa de mandar sempre `comFactura: true`. */
export function corpoDoPagamento(p: {
  pedidoId: number;
  negociacaoId: number;
  metodo: "mbway" | "multibanco";
  comFactura: boolean;
  telemovel?: string;
  /** A diferença das horas (31-10-2026). */
  parte?: "diferenca";
}) {
  return {
    pedidoId: p.pedidoId,
    negociacaoId: p.negociacaoId,
    metodo: p.metodo,
    comFactura: p.comFactura,
    telemovel: p.metodo === "mbway" ? (p.telemovel ?? "").trim() : undefined,
    ...(p.parte === "diferenca" ? { parte: "diferenca" as const } : {}),
  };
}

/* ─── E5A — Alterar o pedido (R13, S17) ───────────────────────────────────── */

export const MAXIMO_DOS_PORMENORES = 1000;
export const DIAS_PARA_ALTERAR = 180;

export const TEXTOS_DA_ALTERACAO = {
  titulo: "O que quer mudar?",
  dia: "O dia",
  fotos: "Juntar fotografias ou vídeos",
  pormenores: "Acrescentar pormenores",
  acesso: "O acesso",
  sempre: "Para mudar a morada, o serviço ou os seus contactos, fale com a CLYON pelo WhatsApp.",
  aplicada: "Alteração guardada. A CLYON revê o pedido antes de o enviar aos parceiros.",
  pedida: "Alteração enviada à CLYON. Os parceiros que já fizeram proposta podem ter de a rever; a CLYON diz-lhe quando estiver aplicada.",
  emEspera: (quando: string | null) => `A CLYON está a rever a alteração que pediu${quando ? ` a ${quando}` : ""}.`,
  jaHaUma: "Já tem uma alteração à espera da CLYON.",
} as const;

/**
 * O corpo da R13 — SÓ os campos da lista fechada da Segurança (R14 da D3):
 * o dia, juntar fotografias, acrescentar pormenores (até 1000 caracteres) e o
 * acesso. Nada de morada, serviço, contactos, NIF ou valor. A data: de amanhã
 * em diante, em Lisboa, até 180 dias.
 */
export function corpoDaAlteracao(
  a: {
    quando?: string;
    dataPreferida?: string;
    fotografias?: string[];
    pormenores?: string;
    acesso?: Record<string, unknown>;
    acessoDestino?: Record<string, unknown>;
    desmontagem?: boolean;
  },
  limites: { primeiroDia: string; ultimoDia: string },
): { corpo: Record<string, unknown> } | { erro: string } {
  const corpo: Record<string, unknown> = {};
  if (a.quando) corpo.quando = a.quando;
  if (a.dataPreferida) {
    if (a.dataPreferida < limites.primeiroDia || a.dataPreferida > limites.ultimoDia) return { erro: "Escolha um dia a partir de amanhã." };
    corpo.dataPreferida = a.dataPreferida;
  }
  if (a.fotografias && a.fotografias.length > 0) corpo.fotografias = a.fotografias;
  const p = a.pormenores?.trim();
  if (p) {
    if (p.length > MAXIMO_DOS_PORMENORES) return { erro: "Os pormenores vão até 1000 caracteres." };
    corpo.pormenores = p;
  }
  if (a.acesso) corpo.acesso = a.acesso;
  if (a.acessoDestino) corpo.acessoDestino = a.acessoDestino;
  if (a.desmontagem !== undefined) corpo.desmontagem = a.desmontagem;
  if (Object.keys(corpo).length === 0) return { erro: "Diga o que quer mudar." };
  return { corpo };
}

/* ─── E5M — Mensagens com a CLYON (R14, S18) ──────────────────────────────── */

export const TEXTOS_DAS_MENSAGENS = {
  pediu: "A CLYON pediu mais detalhes",
  escreva: "Escreva a sua resposta",
  enviar: "Enviar resposta",
  juntar: "Juntar fotografias",
  enviada: "Resposta enviada. A CLYON continua com o seu pedido.",
  escrever: "Escrever à CLYON",
} as const;
