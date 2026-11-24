/**
 * AS FERRAMENTAS DA VITÓRIA AGENTE — d85, fase 0 (22-11-2026); d92, fases 4 e 5 (23-11-2026).
 *
 * O modelo escolhe as ferramentas; o código decide o que é permitido. Nada de
 * lógica nova de negócio: cada ferramenta é uma porta para o que já existe —
 * o pedido, a conversa, o que falta (`oQueFaltaNoPedido`), as propostas como o
 * cliente as vê (o mesmo «ecrã» da Vitória) e com a conta e o regime de cada
 * uma (`propostas-do-agente.ts`, do mesmo cálculo da mensagem das propostas),
 * o que o site sabe (as fontes únicas dos preços: `precos-publicos.ts`,
 * `tabela-das-mudancas.ts`, `sacos-de-entulho.ts`, o IVA de
 * `taxas-plataforma.ts`), as perguntas frequentes do site, os validadores da
 * recolha (`guardarARespostaComoVeio`) e o do seguimento (`validarVoltarEm`).
 *
 * NADA AQUI ESCREVE NEM ENVIA. Gravar um dado e marcar o seguimento dizem o
 * que TERIAM feito. Aceitar, cancelar e perguntar ao parceiro (d92) só
 * PROPÕEM: deixam um «pendente» no estado da conversa e a frase que tem de ir
 * na resposta («… Responda SIM.», «… Responda CANCELAR.»). Quem fecha ou
 * cancela é o código, quando lê a resposta seguinte do cliente
 * (`pendentes.ts`), pelos caminhos de sempre — e só com o interruptor
 * «Vitória agente — aceitar» ligado; desligado, fica no ensaio.
 *
 * Só se lêem os pedidos DESTE telefone, e sem dados de pessoas (sem o nome,
 * o telefone, o email nem a rua). O valor que o parceiro escreveu nunca vai
 * ao modelo: só a conta como o cliente a paga.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { oQueFaltaNoPedido, type PedidoParaOQueFalta } from "../o-que-falta-no-pedido";
import { validarVoltarEm } from "../seguimento-do-cliente";
import { guardarARespostaComoVeio, type DadosDaRecolha, type PassoDaRecolha } from "../whatsapp-recolha";
import { textoDaConfirmacaoDoCancelamento } from "../validade-do-orcamento";
import { eurosDosResultados, motivoParaBloquearOAgente } from "./guarda";
import { textoAnonimizado } from "./anonimizar";
import {
  identificarProposta,
  mensagemAoParceiro,
  motivoParaNaoFecharPeloAgente,
  perguntaDoFecho,
  semOValorDoParceiro,
  type PedidoParaOFecho,
  type PropostaComOValorDoParceiro,
} from "./propostas-do-agente";
import { pendenteEmPalavras, type Pendente } from "./pendentes";
import { condicaoJaIncluida, motivoParaAfirmarOQueInclui, oQueOServicoInclui } from "./o-que-o-servico-inclui";

/** O pedido como a base o tem (as colunas que as ferramentas lêem). */
export type PedidoParaOAgente = PedidoParaOQueFalta & {
  status?: string | null;
  baseDoPreco?: string | null;
};

export type LinhaLida = { direccao: string; texto: string; criadoEm?: string | null };

export type PerguntaDoSite = { pergunta: string; resposta: string };

/** O que as ferramentas precisam do mundo. Nos testes, uma base fingida. */
export type DependenciasDasFerramentas = {
  telefone: string;
  agora: Date;
  pedidosDoTelefone: () => Promise<number[]>;
  lerPedido: (id: number) => Promise<PedidoParaOAgente | null>;
  lerConversa: (quantas: number) => Promise<LinhaLida[]>;
  propostasDoPedido: (id: number) => Promise<string>;
  oQueOSiteSabe: () => string;
  /** d92: as propostas que o cliente pode escolher, com a conta e o regime (e o valor do parceiro, que fica no código). */
  propostasParaEscolher?: (id: number) => Promise<PropostaComOValorDoParceiro[]>;
  /** d92: o que o fecho pelo agente precisa de saber do pedido (valor único, já fechado, pago…). */
  pedidoParaOFecho?: (id: number) => Promise<PedidoParaOFecho>;
  /** d92: as perguntas frequentes do site que batem com a procura. */
  perguntasFrequentes?: (procura: string) => PerguntaDoSite[];
  /** d92: «Vitória agente — aceitar» ligado? Só muda o que as ferramentas dizem (o código é que age). */
  aceitarLigado?: boolean;
  /** d92: a sério (a resposta sai para o cliente)? Com o «aceitar» desligado, aí as acções passam à equipa (as perguntas do SIM não podem sair). */
  aoVivo?: boolean;
  /** d98: as fotografias que este número mandou pelo WhatsApp e ainda esperam pelo pedido (`whatsappFotosPendentes`). */
  fotografiasAEsperar?: () => Promise<number>;
};

/** Os passos da recolha que o agente pode gravar (os mesmos validadores das regras). */
export const PASSOS_QUE_O_AGENTE_GRAVA = [
  "nome",
  "morada",
  "codigoPostal",
  "moradaDestino",
  "codigoPostalDestino",
  "andar",
  "elevador",
  "estacionamento",
  "andarDestino",
  "elevadorDestino",
  "estacionamentoDestino",
  "entulhoQuantidade",
  "quando",
  "descricao",
] as const satisfies readonly PassoDaRecolha[];

/** As que deixam uma acção à espera da confirmação do cliente (ou do parceiro), lida pelo código. */
export const FERRAMENTAS_QUE_PROPOEM = ["aceitar_proposta", "perguntar_ao_parceiro", "cancelar_pedido"] as const;

const objecto = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object" as const,
  properties,
  required,
  additionalProperties: false,
});
const PEDIDO = { type: "integer", description: "O número do pedido (sem o #)." };
const ESCOLHA = {
  type: "string",
  description: "Qual proposta, como o cliente a disse: o nome do parceiro, o valor («a de 85») ou a ordem («a primeira»).",
};

/**
 * AS FERRAMENTAS, numa ordem fixa (a cache de prompt depende de não mudarem
 * de uma chamada para a outra). `strict: true` em todas.
 */
export const FERRAMENTAS_DA_VITORIA: Anthropic.Beta.BetaTool[] = [
  {
    name: "pedidos_do_cliente",
    description: "Os pedidos deste cliente (deste número de WhatsApp): o número, o serviço e o estado de cada um, do mais recente para o mais antigo.",
    input_schema: objecto({}, []),
    strict: true,
  },
  {
    name: "ler_pedido",
    description:
      "Um pedido deste cliente: o serviço, o estado, a localidade, o andar, o elevador, o estacionamento, a data combinada ou preferida, a descrição e quantas fotografias tem (contando as que o cliente mandou pelo WhatsApp e ainda estão a caminho do pedido). Sem dados pessoais.",
    input_schema: objecto({ pedido: PEDIDO }, ["pedido"]),
    strict: true,
  },
  {
    name: "o_que_falta",
    description: "O que ainda falta saber num pedido deste cliente para os parceiros poderem fazer a proposta, pela ordem de perguntar.",
    input_schema: objecto({ pedido: PEDIDO }, ["pedido"]),
    strict: true,
  },
  {
    name: "propostas_vivas",
    description:
      "As propostas dos parceiros a um pedido deste cliente: como o cliente as vê, e para cada uma o regime de IVA do parceiro (com IVA, isento, a confirmar), a conta (trabalho do parceiro, taxa da plataforma, o IVA de cada um, o total) e uma explicação do IVA em palavras simples. Usa-a para qualquer pergunta sobre os valores ou o IVA de uma proposta.",
    input_schema: objecto({ pedido: PEDIDO }, ["pedido"]),
    strict: true,
  },
  {
    name: "ler_conversa",
    description: "As últimas mensagens desta conversa de WhatsApp (até 40), da mais antiga para a mais recente.",
    input_schema: objecto({ mensagens: { type: "integer", description: "Quantas mensagens ler (1 a 40)." } }, ["mensagens"]),
    strict: true,
  },
  {
    name: "o_que_o_site_sabe",
    description:
      "O que o site da CLYON diz: os serviços, como funciona, os preços de referência (sem IVA e com IVA), o IVA, os andares, o entulho, como se paga e o que nunca se diz. Usa-a antes de falar de preços, de serviços ou de regras, mesmo que te pareça que já sabes.",
    input_schema: objecto({}, []),
    strict: true,
  },
  {
    name: "gravar_dado",
    description: "Grava no pedido um dado que o cliente disse (a morada, o andar, o elevador, a data…), pelos mesmos validadores da recolha. Diz o que ficou gravado.",
    input_schema: objecto(
      {
        pedido: PEDIDO,
        passo: { type: "string", enum: [...PASSOS_QUE_O_AGENTE_GRAVA], description: "O dado." },
        texto: { type: "string", description: "O que o cliente escreveu, tal e qual." },
      },
      ["pedido", "passo", "texto"],
    ),
    strict: true,
  },
  {
    name: "marcar_seguimento",
    description: "Marca para voltar a contactar o cliente sobre um pedido num dia e hora de Lisboa (das 9h00 às 19h59), quando ele pede para falar mais tarde.",
    input_schema: objecto(
      {
        pedido: PEDIDO,
        dia: { type: "string", description: "AAAA-MM-DD, em Lisboa." },
        hora: { type: "string", description: "hh:mm, em Lisboa." },
        nota: { type: "string", description: "O que ficou combinado, em poucas palavras (sem dados pessoais)." },
      },
      ["pedido", "dia", "hora", "nota"],
    ),
    strict: true,
  },
  {
    name: "passar_a_equipa",
    description:
      "Passa a conversa a uma pessoa da equipa da CLYON, com o motivo e a mensagem que o cliente vai ler (escrita por ti, natural, a dizer o que acontece a seguir). Usa só quando é mesmo preciso: o cliente pede uma pessoa, se queixa, há dinheiro que as ferramentas não explicam, uma ferramenta diz que passa à equipa, ou não sabes responder.",
    input_schema: objecto(
      {
        motivo: { type: "string", description: "Porquê, numa frase, para a equipa (sem dados pessoais)." },
        mensagem: { type: "string", description: "A mensagem ao cliente, curta e humana (passa pela mesma revisão)." },
      },
      ["motivo", "mensagem"],
    ),
    strict: true,
  },
  {
    name: "propor_resposta",
    description:
      "Propõe a mensagem de WhatsApp a enviar ao cliente. Passa por uma revisão (os preços têm de vir das ferramentas desta conversa, o IVA nunca sozinho, «parceiro», português de Portugal, e a frase obrigatória de uma acção proposta). Se for recusada, diz porquê: reescreve, ou passa à equipa.",
    input_schema: objecto({ texto: { type: "string", description: "A mensagem, como o cliente a vai ler." } }, ["texto"]),
    strict: true,
  },
  {
    name: "aceitar_proposta",
    description:
      "Quando o cliente escolhe uma proposta: identifica-a, relê-a e prepara o fecho. NÃO fecha — devolve a pergunta que tens de pôr na resposta, tal e qual («… Responda SIM.»); quem fecha é o sistema, quando o cliente responder SIM. Se disser para passar à equipa, passa.",
    input_schema: objecto({ pedido: PEDIDO, escolha: ESCOLHA }, ["pedido", "escolha"]),
    strict: true,
  },
  {
    name: "cancelar_pedido",
    description:
      "Quando o cliente quer cancelar um pedido: confere se pode ser e devolve a pergunta que tens de pôr na resposta, tal e qual («Confirma que quer cancelar o pedido #N? Responda CANCELAR.»). NÃO cancela: só o CANCELAR do cliente, lido pelo sistema, cancela.",
    input_schema: objecto({ pedido: PEDIDO, motivo: { type: "string", description: "O que o cliente disse, em poucas palavras." } }, ["pedido", "motivo"]),
    strict: true,
  },
  {
    name: "perguntar_ao_parceiro",
    description:
      "Quando o cliente escolhe uma proposta COM uma condição que só o parceiro pode dizer («até quinta-feira», «só de manhã», «só a descida», «se levar também o frigorífico»): a pergunta SAI para o parceiro (WhatsApp e app) e a resposta dele volta ao cliente. NÃO é para o que o serviço já inclui (descer, carregar, o transporte, levar ao destino): isso responde-se logo, com o_que_o_servico_inclui. Depois dizes ao cliente, com naturalidade, que vais confirmar com o parceiro e que lhe dizes assim que ele responder (sem prometer o sim nem uma hora).",
    input_schema: objecto({ pedido: PEDIDO, escolha: ESCOLHA, condicao: { type: "string", description: "A condição, como o cliente a disse." } }, [
      "pedido",
      "escolha",
      "condicao",
    ]),
    strict: true,
  },
  {
    name: "perguntas_frequentes",
    description:
      "As perguntas frequentes do site da CLYON (como funciona, preços, IVA, cargas, esvaziamentos, limpeza depois de esvaziar, mudanças, zonas, pagamentos, cancelar, o selo dos parceiros) que batem com a procura. Usa-a para dúvidas gerais, antes de responder.",
    input_schema: objecto({ procura: { type: "string", description: "Duas ou três palavras do que o cliente quer saber." } }, ["procura"]),
    strict: true,
  },
  {
    name: "o_que_o_servico_inclui",
    description:
      "O que o serviço de um pedido deste cliente inclui sempre (numa recolha: descer, carregar, o transporte e levar a um destino legal), o que acontece se no dia houver mais, e o que só o parceiro pode dizer. Usa-a para «inclui o transporte?», «inclui a descida?», «levam para o lixo / a reciclagem?»: responde logo com isto, sem perguntar ao parceiro.",
    input_schema: objecto({ pedido: PEDIDO }, ["pedido"]),
    strict: true,
  },
];

/** O que aconteceu nesta conversa com o agente (para a guarda e o resultado). */
export type EstadoDaConversa = {
  /**
   * Os resultados das ferramentas de leitura que vêm DAS FONTES DA CLYON (as
   * propostas, o que o site sabe, o que falta, as perguntas frequentes): a
   * ÚNICA origem dos euros que a guarda aceita.
   */
  resultados: unknown[];
  /**
   * O que o CLIENTE escreveu (a conversa, a descrição e os campos de texto do
   * pedido): o modelo lê-o, mas NUNCA conta como origem de euros — um valor
   * escrito pelo cliente não é um preço da CLYON.
   */
  lidoDoCliente: unknown[];
  /** A última resposta que passou na guarda. */
  respostaAceite: string | null;
  /** As que a guarda recusou, com o porquê. */
  recusadas: Array<{ texto: string; motivo: string }>;
  /** O motivo, se passou à equipa. */
  passouAEquipa: string | null;
  /** A mensagem ao cliente ao passar à equipa (escrita pelo modelo, revista), ou null. */
  mensagemDeEquipa: string | null;
  /** O que teria feito (ensaio): uma linha por acção. */
  teriaFeito: string[];
  /**
   * d92: a sério, um dado do pedido ou um seguimento gravam-nos as regras de
   * sempre (o agente ainda não escreve no pedido): a volta acaba e respondem
   * as regras, que gravam e perguntam o que falta. O porquê, ou null.
   */
  deixarAsRegras: string | null;
  /** d92: a acção que fica à espera da confirmação do cliente (ou do parceiro). */
  pendente: Pendente | null;
  /** d92: a frase que a resposta tem de levar tal e qual (a pergunta do SIM ou do CANCELAR). */
  fraseObrigatoria: string | null;
  /**
   * d100: o que o_que_o_servico_inclui devolveu NESTA volta (o «inclui»), ou
   * null se não foi chamada. Sem ela, a revisão não deixa afirmar o que uma
   * proposta inclui; com ela, perguntar_ao_parceiro não pergunta isso.
   */
  incluidoNestaVolta: string[] | null;
};

export function estadoNovo(): EstadoDaConversa {
  return {
    resultados: [],
    lidoDoCliente: [],
    respostaAceite: null,
    recusadas: [],
    passouAEquipa: null,
    mensagemDeEquipa: null,
    teriaFeito: [],
    deixarAsRegras: null,
    pendente: null,
    fraseObrigatoria: null,
    incluidoNestaVolta: null,
  };
}

export type ResultadoDaFerramenta = { resultado: Record<string, unknown>; erro?: boolean };

const inteiro = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);
const texto = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const espacos = (s: string) => s.replace(/\s+/g, " ").trim();

function pedidoSemDadosPessoais(p: PedidoParaOAgente) {
  const fotos = (() => {
    try {
      const f = JSON.parse(String(p.filesJson ?? "[]"));
      return Array.isArray(f) ? f.length : 0;
    } catch {
      return 0;
    }
  })();
  return {
    pedido: p.id,
    servico: p.serviceType ?? null,
    estado: p.status ?? null,
    localidade: p.city ?? null,
    andar: p.floor ?? null,
    elevador: p.hasElevator ?? null,
    estacionamento: p.parkingDistance ?? null,
    dataCombinada: p.dataAgendada ? String(p.dataAgendada) : null,
    quando: p.dataAgendada ? String(p.dataAgendada) : (p.urgency ?? null),
    descricao: p.description ? textoAnonimizado(String(p.description), [p]) : null,
    fotografias: fotos,
    temNome: Boolean(String(p.contactName ?? "").trim()),
    temMorada: Boolean(String(p.address ?? "").trim()),
    temCodigoPostal: Boolean(String(p.postalCode ?? "").trim()),
    baseDoPreco: p.baseDoPreco ?? null,
  };
}

/**
 * AS FOTOGRAFIAS A CAMINHO — 23-11-2026 (d98). As que o cliente mandou pelo
 * WhatsApp antes de o pedido as receber ficam à espera dele; contavam 0, e a
 * Vitória pedia fotografias a quem as tinha acabado de mandar. Contam agora
 * (`fotografias` = no pedido + a caminho), com as duas partes ao lado.
 */
async function fotografiasAEsperar(deps: DependenciasDasFerramentas): Promise<number> {
  if (!deps.fotografiasAEsperar) return 0;
  const n = await deps.fotografiasAEsperar().catch(() => 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function comAsQueEstaoAChegar<T extends { fotografias: number }>(lido: T, aChegar: number) {
  if (aChegar <= 0) return lido;
  return { ...lido, fotografias: lido.fotografias + aChegar, fotografiasNoPedido: lido.fotografias, fotografiasAChegar: aChegar };
}

/** O pedido, só se for deste telefone. */
async function doTelefone(deps: DependenciasDasFerramentas, id: number | null): Promise<PedidoParaOAgente | string> {
  if (id == null) return "Falta o número do pedido.";
  const meus = await deps.pedidosDoTelefone();
  if (!meus.includes(id)) return `O pedido #${id} não é deste cliente.`;
  const p = await deps.lerPedido(id);
  return p ?? `O pedido #${id} não existe.`;
}

const erro = (mensagem: string): ResultadoDaFerramenta => ({ resultado: { erro: mensagem }, erro: true });

/** Para a equipa (não é um erro): a ferramenta diz porquê, e o modelo chama passar_a_equipa. */
const paraAEquipa = (motivo: string): ResultadoDaFerramenta => ({
  resultado: { feito: false, passarAEquipa: true, motivo, oQueFazer: "Chama passar_a_equipa com este motivo e uma mensagem tua ao cliente." },
});

/** A escolhida, relida pelo código, e o porquê de não seguir (se houver). */
async function escolhida(
  deps: DependenciasDasFerramentas,
  pedidoId: number,
  dito: string,
): Promise<{ proposta: PropostaComOValorDoParceiro } | { erro: string } | { equipa: string }> {
  const lista = deps.propostasParaEscolher ? await deps.propostasParaEscolher(pedidoId) : [];
  const id = identificarProposta(dito, lista);
  if (!id.ok) return { erro: id.porque };
  const pedido = deps.pedidoParaOFecho ? await deps.pedidoParaOFecho(pedidoId) : {};
  const motivo = motivoParaNaoFecharPeloAgente(id.proposta, pedido, deps.agora);
  if (motivo) return { equipa: `Pedido #${pedidoId}, ${id.proposta.parceiro}: ${motivo}` };
  return { proposta: id.proposta };
}

/** As perguntas frequentes que batem com a procura (as palavras com 4+ letras), as melhores primeiro. */
export function procurarNasPerguntas(lista: readonly PerguntaDoSite[], procura: string, maximo = 5): PerguntaDoSite[] {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  const palavras = norm(procura)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
  if (palavras.length === 0) return lista.slice(0, maximo);
  return lista
    .map((q) => {
      const p = norm(q.pergunta);
      const r = norm(q.resposta);
      const pontos = palavras.reduce((s, w) => s + (p.includes(w) ? 3 : 0) + (r.includes(w) ? 1 : 0), 0);
      return { q, pontos };
    })
    .filter((x) => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, maximo)
    .map((x) => x.q);
}

/**
 * CORRE UMA FERRAMENTA. Nunca lança: um erro volta ao modelo como resultado
 * (`is_error`), para ele seguir ou passar à equipa.
 */
export async function correrFerramenta(
  nome: string,
  entrada: unknown,
  deps: DependenciasDasFerramentas,
  estado: EstadoDaConversa,
): Promise<ResultadoDaFerramenta> {
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  const ensaio = deps.aceitarLigado !== true;
  if (deps.aoVivo && ensaio && (FERRAMENTAS_QUE_PROPOEM as readonly string[]).includes(nome)) {
    return paraAEquipa("Fechar, cancelar e perguntar ao parceiro pela Vitória estão desligados («Vitória agente — aceitar»): trata uma pessoa da equipa.");
  }
  try {
    switch (nome) {
      case "pedidos_do_cliente": {
        const ids = (await deps.pedidosDoTelefone()).slice(0, 10);
        const pedidos = [];
        for (const id of ids) {
          const p = await deps.lerPedido(id);
          if (p) pedidos.push({ pedido: p.id, servico: p.serviceType ?? null, estado: p.status ?? null, localidade: p.city ?? null });
        }
        return guardar(estado, { pedidos }, { doCliente: true });
      }
      case "ler_pedido": {
        const p = await doTelefone(deps, inteiro(e.pedido));
        if (typeof p === "string") return erro(p);
        // Só o que a CLYON calcula (a base do preço) fica como origem de euros; o texto do pedido é do cliente.
        const lido = comAsQueEstaoAChegar(pedidoSemDadosPessoais(p), await fotografiasAEsperar(deps));
        return guardar(estado, lido, { doCliente: true, daClyon: { pedido: lido.pedido, baseDoPreco: lido.baseDoPreco } });
      }
      case "o_que_falta": {
        const p = await doTelefone(deps, inteiro(e.pedido));
        if (typeof p === "string") return erro(p);
        // As fotografias a caminho do pedido (d98) não faltam: o cliente já as mandou.
        const aChegar = await fotografiasAEsperar(deps);
        const faltas = oQueFaltaNoPedido(p).filter((f) => !(f === "fotografias" && aChegar > 0));
        return guardar(estado, { pedido: p.id, falta: faltas, completo: faltas.length === 0 });
      }
      case "propostas_vivas": {
        const p = await doTelefone(deps, inteiro(e.pedido));
        if (typeof p === "string") return erro(p);
        const lista = deps.propostasParaEscolher ? await deps.propostasParaEscolher(p.id) : [];
        const dataPreferida = p.urgency ?? null;
        return guardar(
          estado,
          {
            pedido: p.id,
            comoOClienteVe: await deps.propostasDoPedido(p.id),
            propostas: lista.map(semOValorDoParceiro),
            dataCombinada: p.dataAgendada ? String(p.dataAgendada) : null,
            dataPreferida,
          },
          // A data que o cliente preferiu é texto dele: não conta como origem de euros.
          { doCliente: false, semNaGuarda: ["dataPreferida"] },
        );
      }
      case "ler_conversa": {
        const n = Math.max(1, Math.min(40, inteiro(e.mensagens) ?? 20));
        const linhas = await deps.lerConversa(n);
        // A conversa é do cliente (e as respostas da CLYON repetem-no): nunca origem de euros.
        return guardar(
          estado,
          { mensagens: linhas.map((l) => ({ de: l.direccao === "in" ? "cliente" : "clyon", texto: l.texto, em: l.criadoEm ?? null })) },
          { doCliente: true },
        );
      }
      case "o_que_o_site_sabe":
        return guardar(estado, { oQueOSiteSabe: deps.oQueOSiteSabe() });
      case "o_que_o_servico_inclui": {
        const p = await doTelefone(deps, inteiro(e.pedido));
        if (typeof p === "string") return erro(p);
        const inclui = oQueOServicoInclui(p.serviceType ?? null, p.baseDoPreco ?? null);
        estado.incluidoNestaVolta = [...(estado.incluidoNestaVolta ?? []), ...inclui.inclui];
        return guardar(estado, {
          pedido: p.id,
          ...inclui,
          nota: "O que está em «inclui» responde-se já, sem perguntar ao parceiro. Se a CLYON tinha proposto o fecho («… Responda SIM.»), responde e chama aceitar_proposta outra vez, para a pergunta do SIM ir na resposta.",
        });
      }
      case "perguntas_frequentes": {
        const todas = deps.perguntasFrequentes ? deps.perguntasFrequentes(texto(e.procura, 120)) : [];
        return guardar(estado, {
          perguntas: todas,
          nota: todas.length === 0 ? "Nada nas perguntas frequentes: usa o_que_o_site_sabe, ou passa à equipa se não souberes." : undefined,
        });
      }
      case "gravar_dado": {
        const p = await doTelefone(deps, inteiro(e.pedido));
        if (typeof p === "string") return erro(p);
        if (deps.aoVivo) {
          estado.deixarAsRegras = `o cliente deu um dado do pedido #${p.id} (${texto(e.passo, 40)}): gravam as regras`;
          return { resultado: { feito: false, nota: "Isto grava o sistema de sempre, que responde ao cliente: termina sem propor resposta." } };
        }
        const passo = texto(e.passo) as (typeof PASSOS_QUE_O_AGENTE_GRAVA)[number];
        if (!(PASSOS_QUE_O_AGENTE_GRAVA as readonly string[]).includes(passo)) return erro("Esse dado não se grava por aqui.");
        const dito = texto(e.texto, 300);
        if (!dito) return erro("Falta o que o cliente disse.");
        const antes: DadosDaRecolha = {};
        const depois = guardarARespostaComoVeio(antes, passo, dito);
        const mudou = Object.fromEntries(
          Object.entries(depois).filter(([k, v]) => k !== "saltados" && JSON.stringify(v) !== JSON.stringify((antes as Record<string, unknown>)[k])),
        );
        if (Object.keys(mudou).length === 0) return erro("Não percebi um valor para gravar nesse texto: pergunte outra vez ao cliente.");
        estado.teriaFeito.push(`teria gravado no #${p.id}: ${passo}`);
        return { resultado: { ensaio: true, gravado: false, teriaGravado: mudou } };
      }
      case "marcar_seguimento": {
        const p = await doTelefone(deps, inteiro(e.pedido));
        if (typeof p === "string") return erro(p);
        if (deps.aoVivo) {
          estado.deixarAsRegras = `o cliente quer falar mais tarde sobre o #${p.id}: marcam as regras`;
          return { resultado: { feito: false, nota: "Isto marca o sistema de sempre, que responde ao cliente: termina sem propor resposta." } };
        }
        const v = validarVoltarEm(e.dia, e.hora, deps.agora);
        if (!v.ok) return erro(v.porque);
        estado.teriaFeito.push(`teria marcado o seguimento do #${p.id} para ${String(e.dia)} às ${String(e.hora)}`);
        return { resultado: { ensaio: true, marcado: false, teriaMarcado: { pedido: p.id, dia: e.dia, hora: e.hora, nota: texto(e.nota, 200) } } };
      }
      case "passar_a_equipa": {
        const motivo = texto(e.motivo, 200) || "sem motivo";
        const mensagem = texto(e.mensagem, 800);
        estado.passouAEquipa = motivo;
        // A mensagem dele passa pela mesma revisão; se não passar, sai a frase de sempre.
        const bloqueio = mensagem
          ? (motivoParaBloquearOAgente(mensagem, eurosDosResultados(estado.resultados)) ??
            motivoParaAfirmarOQueInclui(mensagem, estado.incluidoNestaVolta !== null))
          : "sem mensagem";
        estado.mensagemDeEquipa = bloqueio ? null : mensagem;
        // Passar à equipa desfaz o que estava a ser proposto.
        estado.pendente = null;
        estado.fraseObrigatoria = null;
        estado.teriaFeito.push(`passaria à equipa: ${motivo}`);
        return { resultado: { passado: true, mensagemAceite: !bloqueio, ...(bloqueio ? { porqueNao: bloqueio } : {}) } };
      }
      case "propor_resposta": {
        const t = texto(e.texto, 2000);
        let motivo = motivoParaBloquearOAgente(t, eurosDosResultados(estado.resultados));
        // d100: o que uma proposta inclui só se afirma com o_que_o_servico_inclui nesta volta (o #664).
        if (!motivo) motivo = motivoParaAfirmarOQueInclui(t, estado.incluidoNestaVolta !== null);
        if (!motivo && estado.fraseObrigatoria && !espacos(t).includes(espacos(estado.fraseObrigatoria))) {
          motivo = `Tem de levar, tal e qual, a frase: «${estado.fraseObrigatoria}»`;
        }
        if (motivo) {
          estado.recusadas.push({ texto: t, motivo });
          return {
            resultado: { aceite: false, motivo, oQueFazer: "Reescreve sem isso (os preços só como vieram das ferramentas), ou chama passar_a_equipa." },
            erro: true,
          };
        }
        estado.respostaAceite = t;
        return { resultado: { aceite: true } };
      }
      case "aceitar_proposta": {
        const p = await doTelefone(deps, inteiro(e.pedido));
        if (typeof p === "string") return erro(p);
        const r = await escolhida(deps, p.id, texto(e.escolha, 200));
        if ("erro" in r) return erro(r.erro);
        if ("equipa" in r) return paraAEquipa(r.equipa);
        const prop = r.proposta;
        const frase = perguntaDoFecho(prop);
        estado.pendente = {
          tipo: "fecho",
          pedidoId: p.id,
          negociacaoId: prop.negociacaoId,
          parceiro: prop.parceiro,
          total: prop.conta.total,
          propostoEm: deps.agora.toISOString(),
        };
        estado.fraseObrigatoria = frase;
        estado.teriaFeito.push(pendenteEmPalavras(estado.pendente, ensaio));
        return guardar(estado, {
          proposto: true,
          fechado: false,
          fraseQueTemDeIrNaResposta: frase,
          proposta: semOValorDoParceiro(prop),
          nota: "Só o SIM do cliente fecha, lido pelo sistema. Podes juntar uma frase tua antes (curta).",
        });
      }
      case "perguntar_ao_parceiro": {
        const p = await doTelefone(deps, inteiro(e.pedido));
        if (typeof p === "string") return erro(p);
        const condicao = texto(e.condicao, 200);
        if (!condicao) return erro("Falta a condição do cliente.");
        // d97 (o caso #664): o que o serviço já inclui não se pergunta ao parceiro — responde-se.
        // d100: nem o que o_que_o_servico_inclui já devolveu nesta volta.
        const jaIncluida = condicaoJaIncluida(condicao, p.serviceType ?? null, estado.incluidoNestaVolta ?? []);
        if (jaIncluida) {
          return guardar(estado, {
            perguntaPreparada: false,
            jaIncluido: true,
            resposta: jaIncluida,
            oQueFazer:
              "Não perguntes ao parceiro: responde ao cliente com isto. Se ele já escolheu a proposta, chama aceitar_proposta para a pergunta do SIM ir na resposta.",
          });
        }
        const r = await escolhida(deps, p.id, texto(e.escolha, 200));
        if ("erro" in r) return erro(r.erro);
        if ("equipa" in r) return paraAEquipa(r.equipa);
        const prop = r.proposta;
        estado.pendente = {
          tipo: "parceiro",
          pedidoId: p.id,
          negociacaoId: prop.negociacaoId,
          parceiro: prop.parceiro,
          condicao,
          // O texto ao parceiro fica no código (leva o valor dele, que não vai ao modelo).
          mensagem: mensagemAoParceiro(prop, condicao),
          propostoEm: deps.agora.toISOString(),
        };
        estado.fraseObrigatoria = null;
        estado.teriaFeito.push(pendenteEmPalavras(estado.pendente, ensaio));
        return guardar(estado, {
          perguntaPreparada: true,
          parceiro: prop.parceiro,
          proposta: semOValorDoParceiro(prop),
          oQueDizerAoCliente:
            "Que vais confirmar com o parceiro se consegue cumprir a condição e que lhe dizes assim que ele responder. Não prometas o sim nem uma hora.",
        });
      }
      case "cancelar_pedido": {
        const p = await doTelefone(deps, inteiro(e.pedido));
        if (typeof p === "string") return erro(p);
        const estadoDoPedido = String(p.status ?? "").toLowerCase();
        if (/cancel/.test(estadoDoPedido)) return erro(`O pedido #${p.id} já está cancelado.`);
        if (/conclu|complet/.test(estadoDoPedido)) return paraAEquipa(`Pedido #${p.id} concluído: o cliente quer cancelar`);
        const fecho = deps.pedidoParaOFecho ? await deps.pedidoParaOFecho(p.id) : {};
        if (fecho.temAcordada || p.dataAgendada) return paraAEquipa(`Pedido #${p.id} já contratado ou com data: o cliente quer cancelar`);
        if (fecho.jaPago) return paraAEquipa(`Pedido #${p.id} com dinheiro pago: o cliente quer cancelar`);
        const frase = textoDaConfirmacaoDoCancelamento(p.id);
        estado.pendente = { tipo: "cancelar", pedidoId: p.id, propostoEm: deps.agora.toISOString() };
        estado.fraseObrigatoria = frase;
        estado.teriaFeito.push(pendenteEmPalavras(estado.pendente, ensaio));
        return { resultado: { proposto: true, cancelado: false, fraseQueTemDeIrNaResposta: frase, nota: "Só o CANCELAR do cliente cancela, lido pelo sistema." } };
      }
      default:
        return erro(`Não há a ferramenta «${nome}».`);
    }
  } catch (err) {
    return erro(err instanceof Error ? `Falhou: ${err.message.slice(0, 160)}` : "Falhou.");
  }
}

/**
 * Guarda o que a ferramenta devolveu. O modelo recebe sempre o resultado todo;
 * à guarda dos € só chega o que veio das fontes da CLYON:
 *  - `doCliente`: o resultado é texto do cliente — vai para `lidoDoCliente`,
 *    e só entra em `resultados` o que vier em `daClyon` (se vier);
 *  - `semNaGuarda`: chaves de um resultado da CLYON que são texto do cliente.
 */
function guardar(
  estado: EstadoDaConversa,
  resultado: Record<string, unknown>,
  origem: { doCliente?: boolean; daClyon?: Record<string, unknown>; semNaGuarda?: readonly string[] } = {},
): ResultadoDaFerramenta {
  if (origem.doCliente) {
    estado.lidoDoCliente.push(resultado);
    if (origem.daClyon) estado.resultados.push(origem.daClyon);
  } else if (origem.semNaGuarda?.length) {
    const limpo: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(resultado)) {
      if (origem.semNaGuarda.includes(k)) estado.lidoDoCliente.push({ [k]: v });
      else limpo[k] = v;
    }
    estado.resultados.push(limpo);
  } else {
    estado.resultados.push(resultado);
  }
  return { resultado };
}
