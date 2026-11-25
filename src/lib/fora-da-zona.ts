import { distanciaEmLinhaRecta, FACTOR_DE_ESTRADA, pontoValido, type Ponto } from "./distancia-entre-pontos";
import { pedidoFechado } from "./pedido-arrumado";

/**
 * FORA DA ZONA — d128, 25-11-2026 (dono).
 *
 * A CLYON não faz trabalhos a mais de 200 km de Lisboa (a base). Na mudança
 * conta a ORIGEM: se a mudança sai da zona, o destino não tem limite.
 *
 * Um pedido aberto cuja morada (ou, numa mudança, a origem) fica acima do
 * limite fica marcado «fora da zona», com a distância. A marca não decide
 * nada sozinha: a morada pode estar errada, e é uma pessoa que a confirma com
 * o cliente. Enquanto a marca estiver, o pedido não vai aos parceiros e a
 * Vitória não lhe envia mensagens automáticas. Corrigida a morada para dentro
 * do limite, a marca sai sozinha; confirmada fora, cancela-se e avisa-se o
 * cliente (`mensagemDoForaDaZona`).
 *
 * Distância desconhecida não marca: sem coordenadas nem uma medida da
 * estrada, não há o que confirmar.
 *
 * O limite está nas Configs (`zona_km_maximo`, 200 por omissão) e lê-se
 * sempre pela mesma função no servidor (`limiteDaZonaKm`, fora-da-zona-na-base.ts).
 * Não confundir com o limite da d127 (70 km, `mudanca_km_limite_recolha`):
 * esse só decide como se estima uma recolha longe da base, e continua igual
 * até aos 200 km.
 */

/** A chave das Configs. */
export const CHAVE_DO_LIMITE_DA_ZONA = "zona_km_maximo";

/** O limite por omissão, em km da base (o das Configs manda). */
export const KM_DA_ZONA_POR_OMISSAO = 200;

/** A base CLYON (Fernão Ferro, Seixal) — a mesma do simulador e do motor de custos. */
export const BASE_DA_ZONA: Ponto = { lat: 38.5578, lng: -9.1238 };

/** O motivo do fecho e do histórico. */
export const MOTIVO_FORA_DA_ZONA = "fora da zona";

export type KmDaBase = {
  km: number;
  /** De que ponto: a morada do serviço, ou a origem da mudança. */
  de: "morada" | "origem";
  /** Pela estrada (medida pelo Google no simulador) ou pela linha recta com folga. */
  medida: "estrada" | "linha_recta";
};

export type ForaDaZona = { km: number; limite: number; de: "morada" | "origem" };

const numero = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const objecto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function pontoDe(v: unknown): Ponto | null {
  const o = objecto(v);
  const p = { lat: numero(o.lat), lng: numero(o.lng) };
  return pontoValido(p) && !(p.lat === 0 && p.lng === 0) ? p : null;
}

/** O rawOrderJson, lido sem rebentar (texto, objecto ou nada). */
export function lerORaw(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return objecto(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return objecto(raw);
}

/**
 * A DISTÂNCIA À BASE DE UM PEDIDO — a morada do serviço, ou a ORIGEM da mudança.
 *
 * - Mudança: a origem (`originAddress`, a do simulador); se a equipa editou o
 *   pedido, a morada editada (`address`, que numa mudança é a origem); nos
 *   pedidos da Vitória e do backoffice a origem é a `address`.
 * - O resto: a morada (`address`). A medida da estrada que o simulador fez
 *   (`distanceFromBase`, com a duração do Google) ganha à linha recta, salvo
 *   depois de uma edição — a medida era da morada antiga.
 * - Sem coordenadas nem medida: desconhecida (nulo).
 */
export function kmDaBaseDoPedido(
  servico: string | null | undefined,
  rawOrderJson: unknown,
  base: Ponto = BASE_DA_ZONA,
): KmDaBase | null {
  const raw = lerORaw(rawOrderJson);
  const editado = typeof raw.editadoPelaClyonEm === "string" && raw.editadoPelaClyonEm.length > 0;
  if (servico === "mudanca") {
    const ponto = editado
      ? (pontoDe(raw.address) ?? pontoDe(raw.originAddress))
      : (pontoDe(raw.originAddress) ?? pontoDe(raw.address));
    if (!ponto) return null;
    return { km: linhaRecta(base, ponto), de: "origem", medida: "linha_recta" };
  }
  const daBase = objecto(raw.distanceFromBase);
  const medidaKm = numero(daBase.distanceKm);
  const peloGoogle = numero(daBase.durationSeconds) != null || numero(daBase.distanceMeters) != null;
  if (!editado && medidaKm != null && medidaKm > 0 && peloGoogle && daBase.isEstimate !== true) {
    return { km: Math.round(medidaKm * 10) / 10, de: "morada", medida: "estrada" };
  }
  const ponto = pontoDe(raw.address);
  if (!ponto) return null;
  return { km: linhaRecta(base, ponto), de: "morada", medida: "linha_recta" };
}

function linhaRecta(a: Ponto, b: Ponto): number {
  return Math.round(distanciaEmLinhaRecta(a, b) * FACTOR_DE_ESTRADA * 10) / 10;
}

/** O limite das Configs, lido como número; o que não se lê é o por omissão. */
export function limiteDaZona(valor: unknown): number {
  const n = numero(valor);
  return n != null && n > 0 ? n : KM_DA_ZONA_POR_OMISSAO;
}

/**
 * O PEDIDO ESTÁ FORA DA ZONA? — aberto, com a distância conhecida e acima do
 * limite. Um pedido fechado (cancelado, arquivado, concluído…) nunca marca.
 */
export function foraDaZona(
  p: { serviceType?: string | null; status?: string | null; rawOrderJson?: unknown },
  limite: number = KM_DA_ZONA_POR_OMISSAO,
  base: Ponto = BASE_DA_ZONA,
): ForaDaZona | null {
  if (pedidoFechado(p.status)) return null;
  const d = kmDaBaseDoPedido(p.serviceType ?? null, p.rawOrderJson, base);
  if (!d || !(d.km > limite)) return null;
  return { km: d.km, limite, de: d.de };
}

/** A linha do cartão, no topo, com o ⚠. */
export function linhaDoForaDaZona(f: Pick<ForaDaZona, "km">): string {
  return `Fora da zona: ${Math.round(f.km)} km de Lisboa — confirme a morada com o cliente`;
}

/** O motivo à vista no cartão: o que fica parado enquanto a marca estiver. */
export const PARADO_FORA_DA_ZONA =
  "Parado até a morada estar confirmada: não vai aos parceiros e a Vitória não envia mensagens automáticas sobre este pedido.";

/** A recusa das rotas que levam o pedido aos parceiros. */
export function recusaForaDaZona(f: Pick<ForaDaZona, "km">): string {
  return `Este pedido está fora da zona (${Math.round(f.km)} km de Lisboa). Confirme a morada com o cliente antes de o enviar aos parceiros.`;
}

/**
 * O que a Vitória diz, com delicadeza, se o cliente perguntar pelo pedido
 * marcado (o ponto de situação, `ecraDoPedido`): sem prometer parceiros,
 * preços nem datas.
 */
export function respostaDaVitoriaForaDaZona(pedidoId: number): string {
  return `Pedido #${pedidoId}: a equipa da CLYON está a confirmar a morada consigo antes de o enviar aos parceiros. Falamos consigo em breve — obrigada pela paciência!`;
}

/**
 * A MENSAGEM AO CLIENTE — o «Cancelar e avisar o cliente» (d128). Uma só,
 * curta e simpática, com «parceiro» e o primeiro nome.
 */
export function mensagemDoForaDaZona(p: {
  nome?: string | null;
  pedidoId: number;
  localidade?: string | null;
  limite?: number;
}): string {
  const primeiro = String(p.nome ?? "").trim().split(/\s+/)[0] ?? "";
  const ola = primeiro ? `Olá, ${primeiro}!` : "Olá!";
  const onde = String(p.localidade ?? "").trim();
  const limite = Math.round(p.limite ?? KM_DA_ZONA_POR_OMISSAO);
  return (
    `${ola} Confirmámos a morada do seu pedido #${p.pedidoId}${onde ? ` (${onde})` : ""}. ` +
    `Por agora, a CLYON só trabalha até cerca de ${limite} km de Lisboa e ainda não temos parceiros na sua zona, ` +
    `por isso cancelámos o pedido para não ficar à espera. Pedimos desculpa e obrigado por ter pensado em nós.`
  );
}

/** Por onde sai a mensagem: o WhatsApp, ou o email se não houver telemóvel (ou o número estiver bloqueado). */
export function canalDaMensagemForaDaZona(c: {
  telefone?: string | null;
  email?: string | null;
  bloqueado?: boolean;
}): "whatsapp" | "email" | null {
  const digitos = String(c.telefone ?? "").replace(/\D/g, "");
  if (digitos.length >= 9 && !c.bloqueado) return "whatsapp";
  const email = String(c.email ?? "").trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "email";
  return null;
}

/** A linha do histórico do «Cancelar e avisar o cliente», com quem carregou. */
export function historicoDoCancelamentoForaDaZona(p: {
  km: number;
  quem: string;
  canal: "whatsapp" | "email" | null;
  saiu: boolean;
}): string {
  const mensagem =
    p.canal == null
      ? "sem telemóvel nem email: a mensagem não saiu"
      : p.saiu
        ? `mensagem ao cliente por ${p.canal === "whatsapp" ? "WhatsApp" : "email"}`
        : `a mensagem por ${p.canal === "whatsapp" ? "WhatsApp" : "email"} não saiu — avisar o cliente à mão`;
  return `Cancelado pela CLYON (${p.quem}) — motivo: ${MOTIVO_FORA_DA_ZONA} (${Math.round(p.km)} km de Lisboa, morada confirmada); ${mensagem}.`;
}
