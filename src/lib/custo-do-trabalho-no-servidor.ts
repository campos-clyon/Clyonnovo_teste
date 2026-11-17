import { after } from "next/server";
import { custosEBaseDoProfissional, getPool, getSimulatorOrderById, taxasActuais } from "./db";
import { getActivePricingMap } from "./pricing-helper";
import { avaliarAlcance } from "./distribuir-pedido";
import { distanciaSemConsultar } from "./distancia-rodoviaria";
import { concelhoDoPonto } from "./concelhos-da-cobertura";
import { tamanhoDaCarrinha } from "./carga-da-carrinha";
import { pedidoParaOMotor } from "./custo-do-trabalho-do-pedido";
import {
  custoDoTrabalho,
  destinoDaDeposicao,
  foraDaGrelhaParaAMesa,
  parametrosDoMotor,
  type BaseDoCalculo,
  type CustoDoTrabalho,
  type ForaDaGrelhaNaMesa,
  type Perna,
} from "./custo-do-trabalho";
import type { DistanciaMedida } from "./distancia-rodoviaria";
import type { Ponto } from "./distancia-entre-pontos";

/**
 * O CUSTO DO TRABALHO, NO SERVIDOR — d61 fase (a), modo sombra.
 *
 * Depois de o pedido ser gravado: vai buscar as Configs, as bases (os 3
 * profissionais mais perto que o cobrem, pela mesma `avaliarAlcance` da
 * distribuição; ou a base CLYON) e as distâncias — SEM chamadas novas ao
 * Google (a memória das distâncias, a linha recta, ou a que o simulador já
 * mediu) —, chama `custoDoTrabalho` e grava em `custoJson`. Nunca lança.
 */

/** A base CLYON (Fernão Ferro, Seixal), a mesma do simulador; as variáveis de ambiente mandam. */
export const BASE_DA_CLYON: Ponto = {
  lat: Number(process.env.CLYON_BASE_LAT) || 38.5578,
  lng: Number(process.env.CLYON_BASE_LNG) || -9.1238,
};

const perna = (d: DistanciaMedida | null): Perna | null =>
  d ? { km: d.km, minutos: d.minutos, origem: d.origem === "estrada" ? "estrada" : "estimativa" } : null;

async function pernasDe(base: Ponto, cliente: Ponto | null, deposicao: Ponto) {
  const [ida, aDeposicao, volta] = await Promise.all([
    cliente ? distanciaSemConsultar(base, cliente) : Promise.resolve(null),
    cliente ? distanciaSemConsultar(cliente, deposicao) : Promise.resolve(null),
    distanciaSemConsultar(deposicao, base),
  ]);
  return { ida: perna(ida), aDeposicao: perna(aDeposicao), volta: perna(volta) };
}

export type CustoGravado = (CustoDoTrabalho & { calculadoEm: string; notas: string[] }) | { versao: "motor-a1"; calculado: false; porque: string; calculadoEm: string };

/** Calcula o custo de um pedido (sem gravar). */
export async function calcularOCusto(pedidoId: number): Promise<CustoGravado | null> {
  const linha = (await getSimulatorOrderById(pedidoId)) as unknown as Record<string, unknown> | undefined;
  if (!linha) return null;
  const calculadoEm = new Date().toISOString();
  const pedido = pedidoParaOMotor(linha);
  if (!pedido) return { versao: "motor-a1", calculado: false, porque: "serviço fora do motor (mudança, manutenção ou outro)", calculadoEm };

  const [mapa, taxas] = await Promise.all([getActivePricingMap(), taxasActuais()]);
  const parametros = parametrosDoMotor(mapa, taxas);
  const destino = destinoDaDeposicao(pedido.concelho).ponto;

  // As bases: os 3 mais perto que cobrem o pedido e têm carrinha; ninguém → a base CLYON.
  const bases: BaseDoCalculo[] = [];
  if (pedido.ponto) {
    const alcance = await avaliarAlcance({
      serviceType: pedido.servico,
      precisaFatura: Number(linha.precisaFatura) === 1,
      precisaGuiaTransporte: Number(linha.precisaGuiaTransporte) === 1,
      city: pedido.city,
      lat: pedido.ponto.lat,
      lng: pedido.ponto.lng,
      formaDePagamento: linha.formaDePagamento,
      semConsultarAEstrada: true,
    }).catch(() => null);
    const maisPerto = (alcance?.elegiveis ?? [])
      .filter((x) => x.distanciaKm != null)
      .sort((a, b) => (a.distanciaKm ?? 0) - (b.distanciaKm ?? 0))
      .slice(0, 8);
    const perfis = await Promise.all(maisPerto.map((x) => custosEBaseDoProfissional(x.id).catch(() => undefined)));
    for (let i = 0; i < maisPerto.length && bases.length < 3; i++) {
      const pf = perfis[i];
      const carrinha = tamanhoDaCarrinha(pf?.tipoVeiculo);
      if (!pf || !carrinha || pf.baseLat == null || pf.baseLng == null) continue;
      const ponto = { lat: pf.baseLat, lng: pf.baseLng };
      bases.push({
        id: maisPerto[i].id,
        concelho: concelhoDoPonto(ponto),
        tamanhoDaCarrinha: carrinha,
        pessoasNaEquipa: pf.pessoasNaEquipa,
        pernas: await pernasDe(ponto, pedido.ponto, destino),
      });
    }
  }
  let tipoDaBase: "candidatos" | "clyon" = "candidatos";
  if (bases.length === 0) {
    tipoDaBase = "clyon";
    const pernas = await pernasDe(BASE_DA_CLYON, pedido.ponto, destino);
    if (!pernas.ida && pedido.daBaseClyon) {
      // Sem coordenadas, a distância da base CLYON que o simulador já mediu.
      pernas.ida = { km: pedido.daBaseClyon.km, minutos: pedido.daBaseClyon.minutos, origem: pedido.daBaseClyon.estimativa ? "estimativa" : "estrada" };
      pernas.volta = pernas.volta ?? pernas.ida;
    }
    bases.push({ id: null, concelho: concelhoDoPonto(BASE_DA_CLYON) ?? "seixal", tamanhoDaCarrinha: null, pernas });
  }

  const { ponto: _p, daBaseClyon: _d, city: _c, notas, ...entrada } = pedido;
  const custo = custoDoTrabalho({ ...entrada, bases, tipoDaBase }, parametros);
  return { ...custo, calculadoEm, notas };
}

/** Calcula e grava em `custoJson`. Não mexe no `updatedAt` (a Mesa ordena por ele). Nunca lança. */
export async function calcularEGravarOCusto(pedidoId: number): Promise<CustoGravado | null> {
  try {
    const custo = await calcularOCusto(pedidoId);
    if (!custo) return null;
    const pool = await getPool();
    if (!pool) return custo;
    await pool.execute("UPDATE simulatorOrders SET custoJson = ?, updatedAt = updatedAt WHERE id = ?", [JSON.stringify(custo), pedidoId]);
    return custo;
  } catch (e) {
    console.error(`[custo do trabalho] #${pedidoId}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Depois da resposta (`after`), e fora de um pedido HTTP, já. Nunca lança. */
export function agendarOCustoDoTrabalho(pedidoId: number): void {
  try {
    after(() => calcularEGravarOCusto(pedidoId).then(() => undefined));
  } catch {
    void calcularEGravarOCusto(pedidoId);
  }
}

/** A etiqueta «Fora da grelha» de cada pedido (só os que saem), para a Mesa. */
export async function foraDaGrelhaDosPedidos(ids: number[]): Promise<Map<number, ForaDaGrelhaNaMesa>> {
  const out = new Map<number, ForaDaGrelhaNaMesa>();
  const limpos = [...new Set(ids.filter((x) => Number.isInteger(x) && x > 0))];
  if (limpos.length === 0) return out;
  const pool = await getPool();
  if (!pool) return out;
  const [linhas] = (await pool.query(
    `SELECT id, custoJson FROM simulatorOrders
      WHERE id IN (?) AND custoJson IS NOT NULL AND custoJson LIKE '%"foraDaFaixa":"%'`,
    [limpos],
  )) as [Array<{ id: number; custoJson: string }>, unknown];
  for (const l of linhas) {
    try {
      const f = foraDaGrelhaParaAMesa(JSON.parse(l.custoJson));
      if (f) out.set(Number(l.id), f);
    } catch {
      /* JSON estragado: sem etiqueta */
    }
  }
  return out;
}
