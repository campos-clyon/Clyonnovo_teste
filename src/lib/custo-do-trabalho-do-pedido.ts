import { concelhoDoPedido } from "./concelhos-da-cobertura";
import {
  corpoDoSimuladorDoSite,
  estimativaDaGrelha,
  lerPedidoParaReferencia,
  quantidadeDoEntulhoDoPedido,
  type Estimativa,
  type FormularioDoSimulador,
} from "./preco-de-referencia";
import { numeroDoAndar } from "./respostas-do-simulador";
import { SACOS_POR_METRO_CUBICO } from "./sacos-de-entulho";
import { TIPOS_DE_PECA, tipoDaPeca, type EntradaDoCusto, type GrelhaDoPedido, type PecaDoPedido } from "./custo-do-trabalho";

/**
 * DO PEDIDO GRAVADO À ENTRADA DO MOTOR — d61 fase (a). Puro: lê a linha de
 * `simulatorOrders` (as colunas e o JSON do formulário) e devolve o que
 * `custoDoTrabalho` precisa, menos as bases (que a rota vai buscar). Os
 * serviços que o motor não conta (mudança, manutenção, outro) dão null.
 */

export const SERVICOS_DO_MOTOR: readonly string[] = [
  "recolha_moveis",
  "recolha_monos",
  "recolha_entulho",
  "esvaziamento_casa",
  "esvaziamento_apartamento",
  "esvaziamento_garagem",
  "esvaziamento_sotao",
  "esvaziamento_cave",
];

export type PedidoParaOMotor = Omit<EntradaDoCusto, "bases" | "tipoDaBase"> & {
  ponto: { lat: number; lng: number } | null;
  /** A distância da base CLYON que o simulador já mediu (sem consulta nova), se houver. */
  daBaseClyon: { km: number; minutos: number | null; estimativa: boolean } | null;
  /** Para a elegibilidade (a mesma `avaliarAlcance`). */
  city: string | null;
  notas: string[];
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
};

function jsonDe(v: unknown): Record<string, unknown> {
  if (typeof v !== "string" || !v.trim()) return {};
  try {
    const j = JSON.parse(v);
    return j && typeof j === "object" ? (j as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** A grelha pública do pedido na forma que o motor usa (valor, faixa, «desde»). */
export function grelhaDaEstimativa(e: Estimativa | null): GrelhaDoPedido | null {
  if (!e) return null;
  switch (e.tipo) {
    case "valor":
      return { tipo: "valor", valor: e.valor };
    case "faixa":
    case "topo":
    case "inicio":
      return { tipo: "faixa", de: e.de, ate: e.ate };
    case "desde":
      return { tipo: "desde", de: e.de };
    default:
      return null;
  }
}

const FATOR_DO_RECHEIO: Readonly<Record<string, number>> = { pouco: 0.7, normal: 1, muito: 1.3 };

export function pedidoParaOMotor(linha: Record<string, unknown>): PedidoParaOMotor | null {
  const servico = typeof linha.serviceType === "string" ? linha.serviceType : "";
  if (!SERVICOS_DO_MOTOR.includes(servico)) return null;
  const raw = jsonDe(linha.rawOrderJson) as FormularioDoSimulador & Record<string, unknown>;
  const notas: string[] = [];

  // O acesso.
  const andar = numeroDoAndar((linha.floor as string | null) ?? (raw.floor as string | undefined) ?? null) ?? 0;
  const elevadorCru = String(linha.hasElevator ?? raw.hasElevator ?? "");
  const elevador: "sim" | "nao" = elevadorCru === "yes" || elevadorCru === "small" || elevadorCru === "sim" ? "sim" : "nao";
  if (andar > 0 && elevadorCru !== "yes" && elevadorCru !== "small" && elevadorCru !== "no" && elevadorCru !== "sim" && elevadorCru !== "nao") {
    notas.push("Elevador por saber: contado como escadas.");
  }
  const estacionamento = String(linha.parkingDistance ?? raw.parkingDistance ?? "");
  const distanciaAPorta: "normal" | "longe" = estacionamento === "over_30m" || estacionamento === "difficult" ? "longe" : "normal";
  const cabe = raw.pecasNoElevador === "sim" || raw.pecasNoElevador === "nao" || raw.pecasNoElevador === "nao_sei" ? raw.pecasNoElevador : undefined;

  // A referência pública (a mesma conta do simulador e da R12).
  const ref = lerPedidoParaReferencia(corpoDoSimuladorDoSite({ ...raw, serviceType: servico }));
  const grelha = ref ? grelhaDaEstimativa(estimativaDaGrelha(ref)) : null;

  // As peças: as contadas por tamanho, com os tipos que o cliente escreveu (heavyItems, ou a descrição com 1 grande).
  const pecas: PecaDoPedido[] = [];
  const itens = ref?.itens ?? {};
  let grandes = Math.max(0, Math.floor(itens.grande ?? 0));
  let medias = Math.max(0, Math.floor(itens.medio ?? 0));
  let pequenas = Math.max(0, Math.floor(itens.pequeno ?? 0));
  const desmontar = ["simple", "medium", "complex"].includes(String(raw.needsDismantling ?? ""));
  const escritas = Array.isArray(raw.heavyItems) ? (raw.heavyItems as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const tipos = escritas.map(tipoDaPeca).filter((x): x is string => x != null);
  if (tipos.length === 0 && grandes === 1) {
    const daDescricao = tipoDaPeca(linha.description);
    if (daDescricao && TIPOS_DE_PECA[daDescricao]?.tamanho === "grande") tipos.push(daDescricao);
  }
  for (const tipo of tipos) {
    const t = TIPOS_DE_PECA[tipo];
    if (!t) continue;
    if (t.tamanho === "grande") grandes = Math.max(0, grandes - 1);
    else if (t.tamanho === "media") medias = Math.max(0, medias - 1);
    else pequenas = Math.max(0, pequenas - 1);
    pecas.push({ tipo, tamanho: t.tamanho, quantidade: 1, desmontar: desmontar && t.tamanho === "grande", cabeNoElevador: t.tamanho === "grande" ? cabe : undefined });
  }
  if (grandes > 0) pecas.push({ tamanho: "grande", quantidade: grandes, desmontar, cabeNoElevador: cabe });
  if (medias > 0) pecas.push({ tamanho: "media", quantidade: medias });
  if (pequenas > 0) pecas.push({ tamanho: "pequena", quantidade: pequenas });

  // Os sacos de entulho.
  const sacos: NonNullable<EntradaDoCusto["sacos"]> = [];
  if (servico === "recolha_entulho" && ref) {
    const corpo = corpoDoSimuladorDoSite({ ...raw, serviceType: servico }) ?? {};
    const q = quantidadeDoEntulhoDoPedido(corpo);
    if (q) {
      const n = q.unidade === "m3" ? Math.round(q.quantidade * SACOS_POR_METRO_CUBICO) : Math.round(q.quantidade);
      if (n > 0) sacos.push({ quantidade: n, tipo: "entulho" });
    } else {
      notas.push("Entulho sem quantidade: o motor não conta os sacos.");
    }
  }

  // O recheio e a tipologia.
  let tipologia: string | null = null;
  if (servico === "esvaziamento_casa" || servico === "esvaziamento_apartamento") {
    tipologia = ref?.tipologia ?? null;
    const fator = FATOR_DO_RECHEIO[ref?.recheio ?? "normal"] ?? 1;
    if (tipologia && fator !== 1) notas.push(`Recheio «${ref?.recheio}»: × ${String(fator).replace(".", ",")}.`);
    if (!tipologia) notas.push("Esvaziamento sem tipologia: o motor não sabe o volume.");
    return montar(fator);
  }
  if (servico === "esvaziamento_garagem" || servico === "esvaziamento_sotao" || servico === "esvaziamento_cave") {
    tipologia = typeof raw.volumeTier === "string" ? raw.volumeTier : null;
  }
  if (servico === "recolha_moveis" && raw.movelMode !== "item" && typeof raw.volumeTier === "string") {
    // Por volume: o volume escolhido, como recheio solto.
    tipologia = raw.volumeTier;
  }
  return montar(1);

  function montar(fatorDoRecheio: number): PedidoParaOMotor {
    const morada = (raw.address ?? {}) as Record<string, unknown>;
    const lat = num(morada.lat);
    const lng = num(morada.lng);
    const daBase = (raw.distanceFromBase ?? {}) as Record<string, unknown>;
    const kmDaBase = num(daBase.distanceKm) ?? num(linha.distanceKm);
    const segundos = num(daBase.durationSeconds);
    return {
      servico,
      pecas,
      sacos,
      recheio: null,
      tipologia,
      fatorDoRecheio,
      acesso: { andar, elevador, distanciaAPorta },
      concelho: concelhoDoPedido({ postalCode: linha.postalCode ?? morada.postalCode, city: linha.city ?? morada.city, address: linha.address, lat, lng }),
      grelha,
      ponto: lat != null && lng != null ? { lat, lng } : null,
      daBaseClyon: kmDaBase != null && kmDaBase > 0 ? { km: kmDaBase, minutos: segundos != null ? Math.round(segundos / 60) : null, estimativa: daBase.isEstimate === true } : null,
      city: typeof linha.city === "string" ? linha.city : typeof morada.city === "string" ? morada.city : null,
      notas,
    };
  }
}
