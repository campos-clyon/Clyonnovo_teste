/**
 * A REGRA DO ENVIO, NUMA FRASE — 29-10-2026.
 *
 * O dono abriu o perfil de um profissional no backoffice para perceber porque
 * é que um pedido não lhe chegou, e o ecrã mostrava um campo «Zonas» que já
 * não decidia nada. Quem recebe um pedido decide-o `profissional-elegivel.ts`:
 * conta aprovada e activa, a categoria do pedido entre as dele, e a morada do
 * pedido até ao raio dele, medido a partir do ponto da base. Esta frase diz
 * isso com os números de cada um, ao lado do raio.
 */
import { nomeDaCategoria, nomeDoServico } from "./service-categories";
import { GRUPO_QUE_RECEBE_O_OUTRO, OUTRO_SERVICO } from "./outro-servico";

export type DadosDaRegra = {
  /** Os nomes das categorias dele, já por extenso. */
  categorias: readonly string[];
  raioKm: number | null;
  /** A base tem ponto no mapa (coordenadas)? Sem ele o raio não se mede. */
  temPontoDaBase: boolean;
  /** Aprovado e activo. Em falta, não se fala da conta. */
  contaAprovada?: boolean;
};

function juntar(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes.join("");
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

export function regraDoEnvio(d: DadosDaRegra): string {
  if (d.contaAprovada === false) return "Não recebe pedidos: a conta não está aprovada e activa.";
  if (d.categorias.length === 0) return "Não recebe pedidos: não tem nenhuma categoria escolhida.";
  if (!d.temPontoDaBase) {
    return "Não recebe pedidos: a base não tem ponto no mapa, e sem ele o raio não se mede.";
  }
  if (d.raioKm == null || !Number.isFinite(d.raioKm) || d.raioKm <= 0) {
    return "Não recebe pedidos: não tem raio definido.";
  }
  /*
   * O «OUTRO SERVIÇO» VAI COM A MANUTENÇÃO DA CASA — 31-10-2026 (d6 de
   * 30-10, ver `outro-servico.ts`). A frase diz o que o motor faz: quem tem o
   * grupo recebe também esses pedidos.
   */
  const comOOutro =
    d.categorias.includes(nomeDaCategoria(GRUPO_QUE_RECEBE_O_OUTRO)) && !d.categorias.includes(nomeDoServico(OUTRO_SERVICO))
      ? [...d.categorias, nomeDoServico(OUTRO_SERVICO)]
      : d.categorias;
  return `Recebe pedidos destas categorias até ${d.raioKm} km da base: ${juntar(comOOutro)}.`;
}

/** A resposta a «Porque não recebeu o pedido #…?», a partir da distribuição do pedido. */
export type DistribuicaoParaExplicar = {
  receberam: Array<{ providerId: number; negociacao: { estado: string } | null; distanciaKm: number | null }>;
  naoReceberam: Array<{ providerId: number; motivos: string[]; distanciaKm: number | null }>;
};

function km(v: number | null): string {
  return v == null ? "" : ` (a ${String(Math.round(v * 10) / 10).replace(".", ",")} km da base)`;
}

export function porqueNaoRecebeu(pedidoId: number, providerId: number, d: DistribuicaoParaExplicar): string {
  const recebeu = d.receberam.find((l) => l.providerId === providerId);
  if (recebeu) {
    return `Recebeu o pedido #${pedidoId}${km(recebeu.distanciaKm)}${recebeu.negociacao ? ` — está «${recebeu.negociacao.estado}».` : "."}`;
  }
  const fora = d.naoReceberam.find((l) => l.providerId === providerId);
  if (!fora) return `Não aparece na distribuição do pedido #${pedidoId}.`;
  return `Não recebeu o pedido #${pedidoId}${km(fora.distanciaKm)}: ${juntar(fora.motivos)}.`;
}
