import {
  matarNegociacoesDoPedido,
  negociacoesDoPedido,
  appendOrderHistory,
  getSimulatorOrderById,
} from "./db";
import { distribuirPedido, resumoDaDistribuicao } from "./distribuir-pedido";
import { coordenadasDoPedido } from "./coordenadas-do-pedido";

/**
 * Recomeçar um pedido do zero: matar o que havia e voltar a distribuir.
 *
 * Isto era um botão. Ele tirou-o: "essa função eu queria no código do pedido,
 * quando ele fosse editado — por ex. o valor, fotos ou infos dele — quando
 * houvesse isso ele fosse salvo, passasse pelo processo de recomeçar do zero e
 * fosse reenviado a todos como novo pedido."
 *
 * Tem razão. Um pedido editado JÁ NÃO É o pedido que os profissionais viram:
 * eles propuseram 121 € sobre uma cómoda e o pedido agora diz 30 €; propuseram
 * sem fotografias e agora há três; propuseram para um rés-do-chão e agora é um
 * oitavo andar sem elevador. Guardar as propostas antigas em cima da informação
 * nova é guardar respostas a uma pergunta que já ninguém fez.
 *
 * Deixar isso ao critério de quem edita era pedir-lhe que se lembrasse, todas
 * as vezes, de carregar num segundo botão a seguir ao primeiro.
 */

/** Os campos que MUDAM o pedido aos olhos de quem o vai executar. */
export type RetratoDoPedido = {
  serviceType: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  floor: string | null;
  hasElevator: string | null;
  parkingDistance: string | null;
  dataAgendada: string | null;
  valorDesejadoCliente: string | null;
  precisaFatura: number;
  fotografias: number;
  /*
   * O que só alguns serviços têm, e que vive no rawOrderJson.
   *
   * Mudar para onde vai uma mudança muda o trabalho todo — o percurso, as
   * horas, o preço. Sem isto no retrato, corrigir a morada de destino gravava
   * em silêncio e as propostas antigas ficavam de pé, feitas para outro
   * destino. O mesmo para o número de sacos de um entulho: trinta e trezentos
   * não são o mesmo trabalho.
   */
  destino: string | null;
  acessoNoDestino: string | null;
  entulho: string | null;
};

const texto = (v: unknown): string | null => {
  const t = v == null ? "" : String(v).trim();
  return t.length > 0 ? t : null;
};

/**
 * O retrato do pedido no momento — o que os profissionais leem.
 *
 * O nome, o telefone e o email do cliente ficam DE FORA de propósito. Não são
 * o pedido, são o cliente; nenhum profissional os vê antes de ser contratado,
 * e corrigir um "Fatima" para "Fátima" não pode matar cinco propostas a sério.
 */
export function retratoDoPedido(p: {
  serviceType?: unknown;
  description?: unknown;
  address?: unknown;
  city?: unknown;
  postalCode?: unknown;
  floor?: unknown;
  hasElevator?: unknown;
  parkingDistance?: unknown;
  dataAgendada?: unknown;
  valorDesejadoCliente?: unknown;
  precisaFatura?: unknown;
  filesJson?: unknown;
  rawOrderJson?: unknown;
}): RetratoDoPedido {
  let fotografias = 0;
  try {
    const f = JSON.parse(String(p.filesJson ?? "[]"));
    fotografias = Array.isArray(f) ? f.length : 0;
  } catch {
    /* JSON estragado conta como nenhuma */
  }

  let cru: Record<string, unknown> = {};
  try {
    cru = p.rawOrderJson ? (JSON.parse(String(p.rawOrderJson)) as Record<string, unknown>) : {};
  } catch {
    /* JSON estragado — os campos do serviço contam como ausentes */
  }
  const emTexto = (v: unknown) => (v == null ? null : JSON.stringify(v));
  return {
    serviceType: texto(p.serviceType),
    description: texto(p.description),
    address: texto(p.address),
    city: texto(p.city),
    postalCode: texto(p.postalCode),
    floor: texto(p.floor),
    hasElevator: texto(p.hasElevator),
    parkingDistance: texto(p.parkingDistance),
    // A data chega ora como Date ora como texto, conforme quem a leu.
    dataAgendada: p.dataAgendada ? new Date(p.dataAgendada as string).toISOString() : null,
    // Em número: "30" e "30.00" são o mesmo valor e não são a mesma cadeia.
    valorDesejadoCliente:
      p.valorDesejadoCliente == null || String(p.valorDesejadoCliente).trim() === ""
        ? null
        : String(Number(p.valorDesejadoCliente)),
    precisaFatura: Number(p.precisaFatura) === 1 ? 1 : 0,
    fotografias,
    destino: texto((cru.destinationAddress as Record<string, unknown> | undefined)?.formattedAddress),
    acessoNoDestino: emTexto(cru.destinationAccess),
    entulho: emTexto(
      cru.entulhoState || cru.entulhoQuantidade
        ? { estado: cru.entulhoState ?? null, quantidade: cru.entulhoQuantidade ?? null }
        : null,
    ),
  };
}

/** O que mudou entre dois retratos, pelos nomes dos campos. */
export function oQueMudou(antes: RetratoDoPedido, depois: RetratoDoPedido): string[] {
  return (Object.keys(antes) as Array<keyof RetratoDoPedido>).filter(
    (k) => antes[k] !== depois[k],
  );
}

const EM_PORTUGUES: Record<keyof RetratoDoPedido, string> = {
  serviceType: "o serviço",
  description: "a descrição",
  address: "a morada",
  city: "a localidade",
  postalCode: "o código postal",
  floor: "o andar",
  hasElevator: "o elevador",
  parkingDistance: "o estacionamento",
  dataAgendada: "a data",
  valorDesejadoCliente: "o valor de partida",
  precisaFatura: "a fatura",
  fotografias: "as fotografias",
  destino: "a morada de destino",
  acessoNoDestino: "o acesso no destino",
  entulho: "o entulho",
};

/** "o valor de partida, as fotografias e a descrição" — para o histórico. */
export function mudancasPorExtenso(campos: string[]): string {
  const nomes = campos.map((c) => EM_PORTUGUES[c as keyof RetratoDoPedido] ?? c);
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

export type ResultadoDoRecomeco =
  | { recomecou: true; encerradas: number; receberam: number; avisados: number; candidatos: number }
  | { recomecou: false; porque: "sem_negociacoes" | "trabalho_fechado" | "sem_valor"; detalhe?: string };

/**
 * Mata as negociações do pedido e distribui-o outra vez, como novo.
 *
 * NÃO MEXE EM TRABALHO FECHADO. Se alguém já foi contratado, já executou ou já
 * foi pago, do outro lado há um profissional que contou com o trabalho e
 * dinheiro cativo — recomeçar apagaria um compromisso a sério. Nesse caso a
 * edição fica gravada na mesma e isto recusa, dizendo com quem está fechado,
 * para quem editou saber que o pedido NÃO voltou a circular.
 */
export async function recomecarDoZero(
  pedido: NonNullable<Awaited<ReturnType<typeof getSimulatorOrderById>>>,
  baseUrl: string,
): Promise<ResultadoDoRecomeco> {
  const existentes = await negociacoesDoPedido(pedido.id);
  if (existentes.length === 0) return { recomecou: false, porque: "sem_negociacoes" };

  const fechada = existentes.find(
    (n) =>
      n.estado === "acordada" ||
      n.confirmadoEm != null ||
      n.pagoEm != null ||
      n.execucaoEnviadaEm != null,
  );
  if (fechada) {
    return {
      recomecou: false,
      porque: "trabalho_fechado",
      detalhe: fechada.profissionalNome,
    };
  }

  if (pedido.valorDesejadoCliente == null) return { recomecou: false, porque: "sem_valor" };

  const encerradas = await matarNegociacoesDoPedido(pedido.id);

  const geo = await coordenadasDoPedido(pedido);
  let fotos = 0;
  try {
    const cru = JSON.parse(pedido.rawOrderJson ?? "{}");
    fotos = Array.isArray(cru?.files) ? cru.files.length : 0;
  } catch {
    /* sem fotos */
  }

  const r = await distribuirPedido(
    {
      id: pedido.id,
      serviceType: pedido.serviceType ?? null,
      description: pedido.description ?? null,
      city: pedido.city ?? null,
      urgency: pedido.urgency ?? null,
      quantidadeDeFotos: fotos,
      valorDesejadoCliente: Number(pedido.valorDesejadoCliente),
      precisaFatura: Boolean(pedido.precisaFatura),
      precisaGuiaTransporte: Boolean(pedido.precisaGuiaTransporte),
      lat: geo.lat,
      lng: geo.lng,
      baseUrl,
    },
    { reabrir: true },
  );

  await appendOrderHistory(pedido.id, {
    type: "created",
    by: null,
    message:
      `Recomeçado do zero depois da edição — ${encerradas} ` +
      `${encerradas === 1 ? "negociação encerrada" : "negociações encerradas"}. ` +
      resumoDaDistribuicao(r),
  });

  return {
    recomecou: true,
    encerradas,
    receberam: r.receberam,
    avisados: r.avisados,
    candidatos: r.candidatos,
  };
}
