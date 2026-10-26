import { passosEmFalta, type DadosDaRecolha, type PassoDaRecolha } from "./whatsapp-recolha";
import { dadosDoPedido } from "./pedido-aberto-na-conversa";
import { codigoPostalGuardado, completarComAMorada, partirMorada } from "./morada-partida";
import { eResDoChao } from "./res-do-chao";
import { arrumarAsFaltas, type ChaveDaFalta } from "./mensagem-do-que-falta";

/**
 * O QUE FALTA PARA O PEDIDO FICAR COMPLETO — 26-10-2026 (d31).
 *
 * *«O registo tem de ficar 100 % completo.»* — o dono. No «Por decidir» da
 * Mesa, o botão «Pedir o que falta» abre o WhatsApp ou o email do cliente com
 * uma mensagem que pede exactamente isto (`mensagem-do-que-falta.ts`).
 *
 * NÃO É UMA LISTA NOVA. O que a Vitória pergunta no WhatsApp decide-o
 * `respondido` (em `whatsapp-recolha.ts`), por esta ordem: o serviço, o nome,
 * a morada, o código postal e a localidade, o destino de uma mudança, o andar,
 * o elevador (que num rés-do-chão não se pergunta), o estacionamento, o acesso
 * no destino, a quantidade de entulho, o quando e a descrição. Aqui o pedido
 * da base passa a dados da conversa — pelo mesmo `dadosDoPedido` com que a
 * Vitória continua um pedido aberto — e é a MESMA função (`passosEmFalta`)
 * que diz o que falta. A factura não entra: há sempre.
 *
 * Por cima disso, três coisas que a conversa não pergunta e o pedido precisa:
 *   · as fotografias — o profissional orça pelo que vê;
 *   · o número da porta — uma rua sem número não leva ninguém à porta;
 *   · numa mudança, a tipologia (T1, T2…) — é por ela que se contam as horas.
 *
 * Este ficheiro é PURO e do servidor (traz a Vitória atrás). O painel recebe
 * só as chaves, já arrumadas, pela rota da Mesa.
 */

/** O pedido, com as colunas de `simulatorOrders` que interessam. */
export type PedidoParaOQueFalta = {
  id: number;
  serviceType?: string | null;
  contactName?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  floor?: string | null;
  hasElevator?: string | null;
  parkingDistance?: string | null;
  description?: string | null;
  filesJson?: string | null;
  urgency?: string | null;
  dataAgendada?: Date | string | null;
  /**
   * O formulário guardado (`rawOrderJson`): o destino de uma mudança, a
   * tipologia, o entulho. Inteiro, ou só as partes que a lista da Mesa extrai
   * na consulta (`pedidosPorPromover`) — lê-se da mesma maneira.
   */
  rawOrderJson?: string | Record<string, unknown> | null;
};

/**
 * Um valor de texto do pedido. O `JSON_EXTRACT` de um `null` guardado no JSON
 * volta como o texto «null», e isso não é uma resposta.
 */
function texto(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t === "null" || t === "undefined" ? "" : t;
}

function lerJson(raw: PedidoParaOQueFalta["rawOrderJson"]): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw;
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const o = JSON.parse(raw);
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const parte = (o: unknown, k: string): string =>
  o && typeof o === "object" ? texto((o as Record<string, unknown>)[k]) : "";

/** As fotografias do pedido: as entradas com endereço (`filesJson`). */
export function fotografiasDoPedido(filesJson: string | null | undefined): number {
  try {
    const l = JSON.parse(filesJson ?? "[]");
    if (!Array.isArray(l)) return 0;
    return l.filter((f) => (typeof f === "string" ? f.trim() : parte(f, "url"))).length;
  } catch {
    return 0;
  }
}

/*
 * AS LINHAS DA DESCRIÇÃO QUE NÃO DIZEM O QUE É — o acesso, o estacionamento,
 * o quando, as fotografias contadas. A Vitória escreve-as na descrição do
 * pedido (`descricao-do-pedido.ts`), e uma descrição só com elas é um pedido
 * em que ninguém disse o que é para levar.
 */
const NAO_DIZ_O_QUE_E =
  /^(acesso|estacionamento|origem|destino|quando|fotografias|acrescentado pelo cliente no whatsapp)\b[^:\n]*:|^o cliente carrega\b/i;

/** O que a descrição diz do trabalho, sem as linhas do acesso e do quando. */
export function conteudoDaDescricao(descricao: string | null | undefined): string {
  return texto(descricao)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !NAO_DIZ_O_QUE_E.test(l))
    .join("\n");
}

/** Quando: o dia gravado, ou o «hoje / esta semana / flexível» do simulador. */
function quandoDoPedido(p: PedidoParaOQueFalta): string {
  const dia = p.dataAgendada ? new Date(p.dataAgendada as string) : null;
  if (dia && !Number.isNaN(dia.getTime())) return dia.toISOString();
  return texto(p.urgency);
}

/** Uma quantidade de entulho escrita na descrição: «20 sacos», «3 m3», «2 metros cúbicos», «Entulho: …». */
const QUANTIDADE_NA_DESCRICAO =
  /\d+(?:[.,]\d+)?\s*(?:(?:sacos?|m3|metros?\s*c[uú]bicos?|carrinhas?)\b|m³)|^\s*entulho:\s*\S/im;

function quantidadeDeEntulho(raw: Record<string, unknown>, descricao: string): string {
  for (const k of [
    "entulhoQuantidade",
    "entulhoQuantidadeDita",
    "entulhoQuantidadeEnsacados",
    "entulhoQuantidadePorEnsacar",
    "entulhoQuantidadeBigBags",
  ]) {
    const v = texto(raw[k]);
    if (v && v !== "0") return v;
  }
  const volume = texto(raw.entulhoVolume);
  if (volume && volume !== "incerto") return volume;
  const dito = descricao.match(QUANTIDADE_NA_DESCRICAO);
  return dito ? dito[0].trim() : "";
}

/** A tipologia de uma mudança: a do simulador, ou dita na descrição («T2», «3 quartos», «4 horas»). */
const TIPOLOGIA_NA_DESCRICAO =
  /\bT\s?[0-6]\b|\bT[0-6]\+|\btipologia\b|\b\d+\s*(?:quartos|assoalhadas|horas)\b|\best[uú]dio\b/i;

function temTipologia(raw: Record<string, unknown>, descricao: string): boolean {
  return Boolean(texto(raw.tipologia)) || TIPOLOGIA_NA_DESCRICAO.test(descricao);
}

/**
 * OS DADOS DA CONVERSA A PARTIR DO PEDIDO — os mesmos que a Vitória leria, mas
 * SEM `pedidoAberto`: com ele ela só pergunta meia dúzia de coisas (as que lhe
 * cabem numa conversa); aqui quer-se o pedido inteiro.
 */
export function dadosDoQueFalta(p: PedidoParaOQueFalta): DadosDaRecolha {
  const raw = lerJson(p.rawOrderJson);
  const morada = completarComAMorada({
    address: texto(p.address),
    postalCode: texto(p.postalCode) || codigoPostalGuardado(JSON.stringify(raw)),
    city: texto(p.city),
  });
  const andar = texto(p.floor);
  const d: DadosDaRecolha = dadosDoPedido({
    id: Number(p.id),
    serviceType: texto(p.serviceType) || null,
    contactName: texto(p.contactName) || null,
    address: texto(p.address) || null,
    city: morada.city || null,
    postalCode: morada.postalCode || null,
    // «rés-do-chão», como o backoffice o escreve, é o andar zero.
    floor: andar && eResDoChao(andar) ? "0" : andar || null,
    hasElevator: texto(p.hasElevator) || null,
    parkingDistance: texto(p.parkingDistance) || null,
  });
  delete d.pedidoAberto;

  const descricao = conteudoDaDescricao(p.description);
  if (descricao) d.description = descricao;
  const quando = quandoDoPedido(p);
  if (quando) d.quandoTexto = quando;

  const servico = texto(p.serviceType);
  if (servico === "mudanca") {
    const destino = raw.destinationAddress;
    const acesso = raw.destinationAccess;
    const moradaDestino = parte(destino, "formattedAddress");
    const partida = partirMorada(moradaDestino);
    // O acesso no destino passa pela MESMA leitura do da origem.
    const noDestino = dadosDoPedido({
      id: Number(p.id),
      floor: (() => {
        const a = parte(acesso, "floor");
        return a && eResDoChao(a) ? "0" : a || null;
      })(),
      hasElevator: parte(acesso, "hasElevator") || null,
      parkingDistance: parte(acesso, "parkingDistance") || null,
    });
    if (moradaDestino) d.moradaDestino = moradaDestino;
    const cpDestino = parte(destino, "postalCode") || partida.codigoPostal || "";
    if (cpDestino) d.codigoPostalDestino = cpDestino;
    const localidadeDestino = parte(destino, "city") || partida.localidade || "";
    if (localidadeDestino) d.localidadeDestino = localidadeDestino;
    if (noDestino.floor != null) d.andarDestino = noDestino.floor;
    if (noDestino.hasElevator != null) d.elevadorDestino = noDestino.hasElevator;
    if (noDestino.parkingDistance !== undefined) d.estacionamentoDestino = noDestino.parkingDistance;
  }
  if (servico === "recolha_entulho") {
    const q = quantidadeDeEntulho(raw, texto(p.description));
    if (q) d.entulhoQuantidade = q;
  }
  return d;
}

/**
 * CADA PERGUNTA DA VITÓRIA, NA CHAVE (OU CHAVES) DO QUE FALTA. O código postal
 * e a localidade são uma pergunta na conversa e duas linhas na mensagem: pede-
 * se só a que falta.
 */
export function faltasDoPasso(passo: PassoDaRecolha, d: DadosDaRecolha): ChaveDaFalta[] {
  switch (passo) {
    case "servico":
      return ["servico"];
    case "nome":
      return ["nome"];
    case "morada":
      return ["morada"];
    case "codigoPostal": {
      const f: ChaveDaFalta[] = [];
      if (!d.postalCode) f.push("codigoPostal");
      if (!d.city) f.push("localidade");
      return f;
    }
    case "moradaDestino":
      return ["moradaDestino"];
    case "codigoPostalDestino": {
      const f: ChaveDaFalta[] = [];
      if (!d.codigoPostalDestino) f.push("codigoPostalDestino");
      if (!d.localidadeDestino) f.push("localidadeDestino");
      return f;
    }
    case "andar":
      return ["andar"];
    case "elevador":
      return ["elevador"];
    case "estacionamento":
      return ["estacionamento"];
    case "andarDestino":
      return ["andarDestino"];
    case "elevadorDestino":
      return ["elevadorDestino"];
    case "estacionamentoDestino":
      return ["estacionamentoDestino"];
    case "entulhoQuantidade":
      return ["volume"];
    case "quando":
      return ["data"];
    case "descricao":
      return ["descricao"];
    // A factura há sempre, e o NIF pede-se depois do sim (13-10-2026).
    case "fatura":
    case "nif":
    case "confirmar":
      return [];
  }
}

/** A morada tem número de porta? Tira-se o código postal antes de procurar algarismos. */
function temNumeroDePorta(morada: string): boolean {
  const rua = partirMorada(morada).rua;
  return /\d/.test(rua) || /\bs\s*\/\s*n\b|\bsem\s+n[uú]mero\b/i.test(rua);
}

/** O QUE FALTA, pela ordem de pedir. Vazio = o pedido está completo. */
export function oQueFaltaNoPedido(p: PedidoParaOQueFalta): ChaveDaFalta[] {
  const d = dadosDoQueFalta(p);
  const faltas: ChaveDaFalta[] = passosEmFalta(d).flatMap((passo) => faltasDoPasso(passo, d));

  if (fotografiasDoPedido(p.filesJson) === 0) faltas.push("fotografias");
  const morada = texto(p.address);
  if (morada && !temNumeroDePorta(morada)) faltas.push("numeroDaPorta");
  if (texto(p.serviceType) === "mudanca" && !temTipologia(lerJson(p.rawOrderJson), texto(p.description))) {
    faltas.push("tipologia");
  }
  return arrumarAsFaltas(faltas);
}
