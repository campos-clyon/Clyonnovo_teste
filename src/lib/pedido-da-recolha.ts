import type { DadosDaRecolha } from "./whatsapp-recolha";
import { campoEmLisboa } from "./hora-de-lisboa";

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
 * Para lá do que ele contou do trabalho, leva o acesso que vinha colado à
 * morada («cave saída para rua a porta») e o que ele disse do dia quando não
 * deu uma data só — ou quando deu duas à escolha: «sábado 31/10 ou domingo
 * 01/11» (o Gaspar, 10-10-2026) ficava reduzido ao sábado.
 */
export function descricaoParaOPedido(d: DadosDaRecolha): string | null {
  const quando = limpo(d.quandoTexto);
  const comAlternativa = /\bou\b/i.test(quando);
  return (
    [
      limpo(d.description) || null,
      limpo(d.acessoDito) ? `Acesso (dito pelo cliente): ${limpo(d.acessoDito)}` : null,
      quando && (!d.dataDesejada || comAlternativa) ? `Quando (dito pelo cliente): ${quando}` : null,
    ]
      .filter(Boolean)
      .join("\n") || null
  );
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
  const campos: Partial<CamposDaRecolha> & { contactPhone: string } = { contactPhone: telefone };

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
  texto("entulhoQuantidade", d.entulhoQuantidade);
  texto("urgency", d.urgency);

  const andar = limpo(d.floor);
  if (andar) campos.floor = ANDAR[andar] ?? andar;
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
