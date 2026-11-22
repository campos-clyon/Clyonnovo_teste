/**
 * AS FERRAMENTAS DA VITÓRIA AGENTE — d85, fase 0 (22-11-2026).
 *
 * O modelo escolhe as ferramentas; o código decide o que é permitido. Nada de
 * lógica nova de negócio: cada ferramenta é uma porta para o que já existe —
 * o pedido, a conversa, o que falta (`oQueFaltaNoPedido`), as propostas como o
 * cliente as vê (o mesmo «ecrã» da Vitória), o que o site sabe (as fontes
 * únicas dos preços: `precos-publicos.ts`, `tabela-das-mudancas.ts`,
 * `sacos-de-entulho.ts`, o IVA de `taxas-plataforma.ts`), os validadores da
 * recolha (`guardarARespostaComoVeio`) e o do seguimento (`validarVoltarEm`).
 *
 * NESTA FASE NADA ESCREVE: tudo corre em ensaio. Gravar um dado, marcar o
 * seguimento e passar à equipa validam a entrada e dizem o que TERIAM feito.
 * Aceitar uma proposta e cancelar um pedido (mexem em dinheiro e no estado)
 * estão declaradas mas BLOQUEADAS — são da fase 4.
 *
 * Só se lêem os pedidos DESTE telefone, e sem dados de pessoas (sem o nome,
 * o telefone, o email nem a rua).
 */

import type Anthropic from "@anthropic-ai/sdk";
import { oQueFaltaNoPedido, type PedidoParaOQueFalta } from "../o-que-falta-no-pedido";
import { validarVoltarEm } from "../seguimento-do-cliente";
import { guardarARespostaComoVeio, type DadosDaRecolha, type PassoDaRecolha } from "../whatsapp-recolha";
import { eurosDosResultados, motivoParaBloquearOAgente } from "./guarda";
import { textoAnonimizado } from "./anonimizar";

/** O pedido como a base o tem (as colunas que as ferramentas lêem). */
export type PedidoParaOAgente = PedidoParaOQueFalta & {
  status?: string | null;
  baseDoPreco?: string | null;
};

export type LinhaLida = { direccao: string; texto: string; criadoEm?: string | null };

/** O que as ferramentas precisam do mundo. Nos testes, uma base fingida. */
export type DependenciasDasFerramentas = {
  telefone: string;
  agora: Date;
  pedidosDoTelefone: () => Promise<number[]>;
  lerPedido: (id: number) => Promise<PedidoParaOAgente | null>;
  lerConversa: (quantas: number) => Promise<LinhaLida[]>;
  propostasDoPedido: (id: number) => Promise<string>;
  oQueOSiteSabe: () => string;
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

/** As que mexem em dinheiro ou no estado do pedido: declaradas, bloqueadas até à fase 4. */
export const FERRAMENTAS_BLOQUEADAS = ["aceitar_proposta", "cancelar_pedido"] as const;

const objecto = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object" as const,
  properties,
  required,
  additionalProperties: false,
});
const PEDIDO = { type: "integer", description: "O número do pedido (sem o #)." };

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
    description: "Um pedido deste cliente: o serviço, o estado, a localidade, o andar, o elevador, o estacionamento, a data, a descrição e quantas fotografias tem. Sem dados pessoais.",
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
    description: "As propostas dos parceiros a um pedido deste cliente, exactamente como o cliente as vê (o preço a pagar, com o IVA), ou que ainda não há propostas.",
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
    description: "Marca para voltar a contactar o cliente sobre um pedido num dia e hora de Lisboa (das 9h00 às 20h59), quando ele pede para falar mais tarde.",
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
    description: "Passa a conversa a uma pessoa da equipa da CLYON, com o motivo. Usa quando não sabes, quando o cliente pede uma pessoa, se queixa, quer aceitar ou cancelar, ou quando nenhuma resposta tua passa na revisão.",
    input_schema: objecto({ motivo: { type: "string", description: "Porquê, numa frase (sem dados pessoais)." } }, ["motivo"]),
    strict: true,
  },
  {
    name: "propor_resposta",
    description:
      "Propõe a mensagem de WhatsApp a enviar ao cliente. Passa por uma revisão (os preços têm de vir das ferramentas desta conversa, o IVA nunca sozinho, «parceiro», português de Portugal). Se for recusada, diz porquê: reescreve, ou passa à equipa.",
    input_schema: objecto({ texto: { type: "string", description: "A mensagem, como o cliente a vai ler." } }, ["texto"]),
    strict: true,
  },
  {
    name: "aceitar_proposta",
    description: "Aceita a proposta de um parceiro em nome do cliente. AINDA NÃO DISPONÍVEL: passa à equipa.",
    input_schema: objecto({ pedido: PEDIDO, parceiro: { type: "string", description: "O nome do parceiro, como na proposta." } }, ["pedido", "parceiro"]),
    strict: true,
  },
  {
    name: "cancelar_pedido",
    description: "Cancela um pedido a pedido do cliente. AINDA NÃO DISPONÍVEL: passa à equipa.",
    input_schema: objecto({ pedido: PEDIDO, motivo: { type: "string", description: "O que o cliente disse." } }, ["pedido", "motivo"]),
    strict: true,
  },
];

/** O que aconteceu nesta conversa com o agente (para a guarda e o resultado). */
export type EstadoDaConversa = {
  /** Os resultados das ferramentas de leitura: de onde podem vir os euros. */
  resultados: unknown[];
  /** A última resposta que passou na guarda. */
  respostaAceite: string | null;
  /** As que a guarda recusou, com o porquê. */
  recusadas: Array<{ texto: string; motivo: string }>;
  /** O motivo, se passou à equipa. */
  passouAEquipa: string | null;
  /** O que teria feito (ensaio): uma linha por acção. */
  teriaFeito: string[];
};

export function estadoNovo(): EstadoDaConversa {
  return { resultados: [], respostaAceite: null, recusadas: [], passouAEquipa: null, teriaFeito: [] };
}

export type ResultadoDaFerramenta = { resultado: Record<string, unknown>; erro?: boolean };

const inteiro = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);
const texto = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");

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
    quando: p.dataAgendada ? String(p.dataAgendada) : (p.urgency ?? null),
    descricao: p.description ? textoAnonimizado(String(p.description), [p]) : null,
    fotografias: fotos,
    temNome: Boolean(String(p.contactName ?? "").trim()),
    temMorada: Boolean(String(p.address ?? "").trim()),
    temCodigoPostal: Boolean(String(p.postalCode ?? "").trim()),
    baseDoPreco: p.baseDoPreco ?? null,
  };
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
  try {
    switch (nome) {
      case "pedidos_do_cliente": {
        const ids = (await deps.pedidosDoTelefone()).slice(0, 10);
        const pedidos = [];
        for (const id of ids) {
          const p = await deps.lerPedido(id);
          if (p) pedidos.push({ pedido: p.id, servico: p.serviceType ?? null, estado: p.status ?? null, localidade: p.city ?? null });
        }
        return guardar(estado, { pedidos });
      }
      case "ler_pedido": {
        const p = await doTelefone(deps, inteiro(e.pedido));
        if (typeof p === "string") return erro(p);
        return guardar(estado, pedidoSemDadosPessoais(p));
      }
      case "o_que_falta": {
        const p = await doTelefone(deps, inteiro(e.pedido));
        if (typeof p === "string") return erro(p);
        const faltas = oQueFaltaNoPedido(p);
        return guardar(estado, { pedido: p.id, falta: faltas, completo: faltas.length === 0 });
      }
      case "propostas_vivas": {
        const p = await doTelefone(deps, inteiro(e.pedido));
        if (typeof p === "string") return erro(p);
        return guardar(estado, { pedido: p.id, comoOClienteVe: await deps.propostasDoPedido(p.id) });
      }
      case "ler_conversa": {
        const n = Math.max(1, Math.min(40, inteiro(e.mensagens) ?? 20));
        const linhas = await deps.lerConversa(n);
        return guardar(estado, {
          mensagens: linhas.map((l) => ({ de: l.direccao === "in" ? "cliente" : "clyon", texto: l.texto, em: l.criadoEm ?? null })),
        });
      }
      case "o_que_o_site_sabe":
        return guardar(estado, { oQueOSiteSabe: deps.oQueOSiteSabe() });
      case "gravar_dado": {
        const p = await doTelefone(deps, inteiro(e.pedido));
        if (typeof p === "string") return erro(p);
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
        estado.teriaFeito.push(`gravar no #${p.id}: ${passo}`);
        return { resultado: { ensaio: true, gravado: false, teriaGravado: mudou } };
      }
      case "marcar_seguimento": {
        const p = await doTelefone(deps, inteiro(e.pedido));
        if (typeof p === "string") return erro(p);
        const v = validarVoltarEm(e.dia, e.hora, deps.agora);
        if (!v.ok) return erro(v.porque);
        estado.teriaFeito.push(`seguimento do #${p.id} a ${String(e.dia)} ${String(e.hora)}`);
        return { resultado: { ensaio: true, marcado: false, teriaMarcado: { pedido: p.id, dia: e.dia, hora: e.hora, nota: texto(e.nota, 200) } } };
      }
      case "passar_a_equipa": {
        const motivo = texto(e.motivo, 200) || "sem motivo";
        estado.passouAEquipa = motivo;
        estado.teriaFeito.push(`passar à equipa: ${motivo}`);
        return { resultado: { ensaio: true, passado: false, teriaPassado: true } };
      }
      case "propor_resposta": {
        const t = texto(e.texto, 2000);
        const motivo = motivoParaBloquearOAgente(t, eurosDosResultados(estado.resultados));
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
      case "aceitar_proposta":
      case "cancelar_pedido":
        estado.teriaFeito.push(`${nome} (bloqueada nesta fase)`);
        return erro("Ainda não disponível: chama passar_a_equipa com o motivo.");
      default:
        return erro(`Não há a ferramenta «${nome}».`);
    }
  } catch (err) {
    return erro(err instanceof Error ? `Falhou: ${err.message.slice(0, 160)}` : "Falhou.");
  }
}

function guardar(estado: EstadoDaConversa, resultado: Record<string, unknown>): ResultadoDaFerramenta {
  estado.resultados.push(resultado);
  return { resultado };
}
