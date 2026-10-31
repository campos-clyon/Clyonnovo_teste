import type { DadosDaRecolha } from "./whatsapp-recolha";
import { campoEmLisboa } from "./hora-de-lisboa";
import { descricaoOrganizada, O_CLIENTE_CARREGA, type OpcoesDaDescricao } from "./descricao-do-pedido";

/**
 * O QUE O ASSISTENTE RECOLHEU, NOS CAMPOS DO «REGISTAR PEDIDO» — 07-10-2026.
 *
 * *«Queria já poder criar esse pedido.»* O assistente do WhatsApp junta o
 * pedido pergunta a pergunta e só o regista quando o cliente responde SIM. Até
 * lá, quem está no backoffice via tudo escrito na conversa e não tinha como
 * aproveitar: ou esperava pelo SIM, ou copiava campo a campo.
 *
 * Isto traduz o rascunho (`whatsappRecolhas.dadosJson`) para o formulário do
 * backoffice, que abre já preenchido — e é lá que se corrige o que o
 * assistente percebeu mal antes de gravar (um nome que afinal era a
 * descrição, por exemplo). Os dois falam do mesmo pedido com palavras
 * diferentes, e é só aqui que se acertam:
 *
 *   · estacionamento: o assistente diz `near`/`far`, o formulário `easy`/`difficult`;
 *   · andar: o assistente guarda `0` e `-1`, o formulário lê-se como texto;
 *   · data: o assistente guarda um instante, o campo quer a hora de Lisboa;
 *   · o que o cliente disse sobre o dia, quando não deu uma data, vai para a
 *     descrição — como faz o registo automático (`registarPedidoDaRecolha`).
 */

export type CamposDaRecolha = {
  serviceType: string;
  contactName: string;
  contactPhone: string;
  address: string;
  city: string;
  postalCode: string;
  floor: string;
  hasElevator: string;
  parkingDistance: string;
  dataDesejada: string;
  urgency: string;
  description: string;
  precisaFatura: boolean;
  moradaDestino: string;
  localidadeDestino: string;
  codigoPostalDestino: string;
  andarDestino: string;
  elevadorDestino: string;
  estacionamentoDestino: string;
  entulhoQuantidade: string;
};

/**
 * A DESCRIÇÃO QUE VAI PARA O PEDIDO — a mesma no registo automático e no
 * formulário do backoffice.
 *
 * Desde 26-10-2026 (decisão d30) é a Vitória que a escreve, arrumada para o
 * profissional: o que é para levar e quantos, o volume, o acesso, quem
 * carrega, quando, as fotografias e os pormenores — ver
 * `descricao-do-pedido.ts`. Continua a levar o acesso que vinha colado à
 * morada («cave saída para rua a porta») e as duas datas à escolha nas
 * palavras dele («sábado 31/10 ou domingo 01/11», o Leopoldo, 10-10-2026).
 */
export function descricaoParaOPedido(d: DadosDaRecolha, opcoes: OpcoesDaDescricao = {}): string | null {
  return descricaoOrganizada(d, opcoes);
}

export { O_CLIENTE_CARREGA };

/**
 * O ANDAR COM O LADO DA PORTA — «r/c Esq», «2º Dto» — 26-10-2026. A morada
 * passou a ser só a rua e o número; o lado vai com o andar. Sem lado, o andar
 * fica como sempre ficou.
 */
export function andarComLado(d: Pick<DadosDaRecolha, "floor" | "lado">): string | null {
  const andar = limpo(d.floor);
  if (!andar) return null;
  const escrito = ANDAR[andar] ?? andar;
  const lado = limpo(d.lado);
  if (!lado) return escrito;
  return `${/^\d+$/.test(escrito) ? `${escrito}º` : escrito} ${lado}`;
}

/**
 * O TELEFONE DA CONVERSA, COMO SE GUARDA NO PEDIDO — 26-10-2026.
 *
 * A ponte dá o número inteiro, com o indicativo e sem o «+»: «351912345678»
 * ou, de fora, «447700900123». O português lê-se assim; o de fora, sem o
 * «+», não se distingue de um número português mal escrito, e o pedido ficava
 * sem o botão do WhatsApp (`numeroParaWhatsApp` não adivinha). Com o «+», o
 * indicativo fica escrito.
 */
export function telefoneDaConversa(telefone: string): string {
  const t = telefone.trim();
  if (/^(\+|00)/.test(t)) return t;
  const d = t.replace(/\D/g, "");
  if (d.length === 9 || (d.length === 12 && d.startsWith("351"))) return t;
  return d.length >= 8 && d.length <= 15 ? `+${d}` : t;
}

const ESTACIONAMENTO: Record<string, string> = { near: "easy", far: "difficult" };
const ELEVADOR = new Set(["yes", "no", "small"]);
const ANDAR: Record<string, string> = { "0": "r/c", "-1": "cave" };

const limpo = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Os campos do formulário a partir do telefone da conversa e do rascunho do assistente. */
export function camposDaRecolha(
  telefone: string,
  dados: DadosDaRecolha | Record<string, unknown> | null | undefined,
): Partial<CamposDaRecolha> & { contactPhone: string } {
  const d = (dados ?? {}) as DadosDaRecolha;
  const campos: Partial<CamposDaRecolha> & { contactPhone: string } = { contactPhone: telefoneDaConversa(telefone) };

  const texto = (k: keyof CamposDaRecolha, v: unknown) => {
    const t = limpo(v);
    if (t) (campos as Record<string, unknown>)[k] = t;
  };

  texto("serviceType", d.serviceType);
  texto("contactName", d.contactName);
  texto("address", d.address);
  texto("city", d.city);
  texto("postalCode", d.postalCode);
  texto("moradaDestino", d.moradaDestino);
  texto("localidadeDestino", d.localidadeDestino);
  texto("codigoPostalDestino", d.codigoPostalDestino);
  // Os sacos só num entulho: num monos, «Quantos sacos?» com «0,7 m³» era o
  // formulário a pedir o que não é do serviço (26-10-2026).
  if (!d.serviceType || d.serviceType === "recolha_entulho") texto("entulhoQuantidade", d.entulhoQuantidade);
  texto("urgency", d.urgency);

  const andar = andarComLado(d);
  if (andar) campos.floor = andar;
  if (d.hasElevator && ELEVADOR.has(d.hasElevator)) campos.hasElevator = d.hasElevator;
  if (d.parkingDistance && ESTACIONAMENTO[d.parkingDistance]) {
    campos.parkingDistance = ESTACIONAMENTO[d.parkingDistance];
  }
  // O destino de uma mudança — «não perguntei» em tudo, até 10-10-2026.
  const andarDestino = limpo(d.andarDestino);
  if (andarDestino) campos.andarDestino = ANDAR[andarDestino] ?? andarDestino;
  if (d.elevadorDestino && ELEVADOR.has(d.elevadorDestino)) campos.elevadorDestino = d.elevadorDestino;
  if (d.estacionamentoDestino && ESTACIONAMENTO[d.estacionamentoDestino]) {
    campos.estacionamentoDestino = ESTACIONAMENTO[d.estacionamentoDestino];
  }

  const quando = campoEmLisboa(d.dataDesejada ?? null);
  if (quando) campos.dataDesejada = quando;

  const descricao = descricaoParaOPedido({ ...d, dataDesejada: quando ? d.dataDesejada : null });
  if (descricao) campos.description = descricao;

  if (d.precisaFatura === true) campos.precisaFatura = true;
  return campos;
}
