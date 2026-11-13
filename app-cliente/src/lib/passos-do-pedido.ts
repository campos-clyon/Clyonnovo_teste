/**
 * O PASSO A PASSO DO PEDIDO E O AVISO DO MOMENTO — 02-11-2026 (dono, #555).
 *
 * «Os avisos do parceiro passam despercebidos»: a pílula do estado e a caixa
 * «O parceiro está a caminho.» diziam o mesmo, em cor neutra, e nenhuma
 * chamava a atenção. Agora, no topo do pedido, UM bloco do momento em cor
 * forte («Fred vai a caminho» · «Saiu às 18:20») e, por baixo, a linha de
 * passos: Pedido feito → Parceiro escolhido → Pago → Dia marcado → A caminho
 * → Chegou → Concluído, com o passo actual destacado e a hora de cada um.
 *
 * Só com o que a R5 manda — nenhum estado inventado: as datas são as ISO da
 * API (`criadoEm`, `dataCombinada`, `aCaminhoEm`, `proximoEm`, `chegouEm`,
 * `confirmadoEm`, `pagamento.pagoEm`), escritas aqui na hora de Lisboa. O
 * «Parceiro escolhido» não tem hora (a base não a guarda), e o «Pago» sai
 * quando o cliente paga ao parceiro no local.
 *
 * Também aqui: o aviso em pop-up no topo (`mudancasNaLista`), quando um
 * pedido muda com a app aberta noutro ecrã, e de quanto em quanto tempo o
 * pedido aberto se relê sozinho (`intervaloDeLeitura`).
 *
 * Puro (sem React Native): os testes do site importam-no.
 */
import { diaEmLisboa, horaEmLisboa, instanteDaBase, pecasEmLisboa, somarDiasAoDia } from "../../../src/lib/hora-de-lisboa";
import type { Negociacao, PedidoNaLista } from "./pedidos";

export type IdDoPasso = "feito" | "escolhido" | "pago" | "dia" | "caminho" | "chegou" | "concluido";
/** feito · actual (o destacado) · falta (ficou para trás e ainda conta: o pagamento) · saltado · por fazer. */
export type EstadoDoPasso = "feito" | "actual" | "falta" | "saltado" | "por-fazer";
export type Passo = { id: IdDoPasso; titulo: string; detalhe: string | null; estado: EstadoDoPasso };

export type TomDoMomento = "marca" | "bom" | "aviso";
export type Momento = { titulo: string; texto: string | null; tom: TomDoMomento };

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const dois = (n: number) => String(n).padStart(2, "0");

/** 0 = hoje, 1 = ontem, outro = mais longe (dias de Lisboa). */
function diasAtras(d: Date, agora: Date): number {
  const hoje = diaEmLisboa(agora);
  const dia = diaEmLisboa(d);
  return dia === hoje ? 0 : dia === somarDiasAoDia(hoje, -1) ? 1 : 2;
}

/** «hoje, 18:20» · «ontem, 18:20» · «02/11, 18:20» — na hora de Lisboa. */
export function horaCurtaDoPasso(iso: string | null | undefined, agora: Date = new Date()): string | null {
  const d = instanteDaBase(iso ?? null);
  if (!d) return null;
  const atras = diasAtras(d, agora);
  const p = pecasEmLisboa(d);
  const hora = horaEmLisboa(d);
  return atras === 0 ? `hoje, ${hora}` : atras === 1 ? `ontem, ${hora}` : `${dois(p.dia)}/${dois(p.mes)}, ${hora}`;
}

/** «às 18:20» hoje; «ontem às 18:20»; «02/11 às 18:20». */
function asHoras(iso: string | null | undefined, agora: Date): string | null {
  const d = instanteDaBase(iso ?? null);
  if (!d) return null;
  const atras = diasAtras(d, agora);
  const p = pecasEmLisboa(d);
  const hora = horaEmLisboa(d);
  if (atras === 0) return `às ${hora}`;
  if (atras === 1) return `ontem às ${hora}`;
  return `${dois(p.dia)}/${dois(p.mes)} às ${hora}`;
}

/** O dia marcado em curto: «qua, 04/11, 10:00» (meia-noite = só o dia: «qua, 04/11»). */
export function diaMarcadoCurto(iso: string | null | undefined): string | null {
  const d = instanteDaBase(iso ?? null);
  if (!d) return null;
  const p = pecasEmLisboa(d);
  const dia = `${DIAS_CURTOS[p.diaDaSemana] ?? ""}, ${dois(p.dia)}/${dois(p.mes)}`;
  return p.hora === 0 && p.minuto === 0 ? dia : `${dia}, ${dois(p.hora)}:${dois(p.minuto)}`;
}

type PedidoDosPassos = { criadoEm: string | null; estadoTexto: string };
type NegociacaoDosPassos = { profissional: { nome: string } } & Pick<
  Negociacao,
  "fase" | "accoes" | "dataCombinada" | "dataCombinadaTexto" | "aCaminhoEm" | "chegouEm" | "execucaoEnviadaEm" | "confirmadoEm"
> &
  Partial<Pick<Negociacao, "proximoEm" | "chegadaConfirmadaEm" | "pagamento">>;

const concluido = (n: NegociacaoDosPassos | null) => !!n && (n.fase === "confirmado" || n.fase === "pago");
const cancelado = (p: Pick<PedidoDosPassos, "estadoTexto">) => /^Cancelado/i.test(p.estadoTexto);

/**
 * O pagamento conta como passo? Não quando o cliente paga ao parceiro no local,
 * nem no modelo de 15-11 (d18), em que paga diretamente ao parceiro e a CLYON não
 * o regista: o passo ficaria «falta» para sempre.
 */
function comPassoDoPagamento(n: NegociacaoDosPassos | null): boolean {
  return !n?.pagamento?.emDinheiroAoProfissional && !n?.pagamento?.pagaAoParceiro;
}

/**
 * A linha de passos. O actual é o que vem a seguir ao último feito; os que
 * ficaram para trás sem marca saem como «saltado» — menos o pagamento, que
 * continua a contar («falta»).
 */
export function passosDoPedido(p: PedidoDosPassos, n: NegociacaoDosPassos | null, agora: Date = new Date()): Passo[] {
  const pago = !!n?.pagamento?.pago;
  const viagem = n?.aCaminhoEm ? horaCurtaDoPasso(n.aCaminhoEm, agora) : null;
  const proximo = n?.proximoEm ? horaCurtaDoPasso(n.proximoEm, agora) : null;
  const base: Array<{ id: IdDoPasso; titulo: string; feito: boolean; detalhe: string | null }> = [
    { id: "feito", titulo: "Pedido feito", feito: true, detalhe: horaCurtaDoPasso(p.criadoEm, agora) },
    { id: "escolhido", titulo: "Parceiro escolhido", feito: !!n, detalhe: n?.profissional.nome ?? null },
    ...(comPassoDoPagamento(n)
      ? [{ id: "pago" as const, titulo: "Pago", feito: pago, detalhe: pago ? horaCurtaDoPasso(n?.pagamento?.pagoEm, agora) : null }]
      : []),
    { id: "dia", titulo: "Dia marcado", feito: !!n?.dataCombinada, detalhe: diaMarcadoCurto(n?.dataCombinada) },
    {
      id: "caminho",
      titulo: "A caminho",
      feito: !!n?.aCaminhoEm,
      detalhe: viagem ? (proximo ? `${viagem} · próximo às ${proximo.split(", ")[1]}` : viagem) : null,
    },
    { id: "chegou", titulo: "Chegou", feito: !!n?.chegouEm, detalhe: horaCurtaDoPasso(n?.chegouEm, agora) },
    {
      id: "concluido",
      titulo: "Concluído",
      feito: concluido(n),
      detalhe: concluido(n)
        ? horaCurtaDoPasso(n?.confirmadoEm, agora)
        : n?.fase === "a_confirmar"
          ? "Confirme que ficou feito"
          : null,
    },
  ];
  let ultimo = -1;
  base.forEach((b, i) => {
    if (b.feito) ultimo = i;
  });
  const parado = cancelado(p);
  return base.map((b, i) => ({
    id: b.id,
    titulo: b.titulo,
    detalhe: b.detalhe,
    estado: b.feito
      ? "feito"
      : !parado && i === ultimo + 1
        ? "actual"
        : i < ultimo
          ? b.id === "pago" && !parado
            ? "falta"
            : "saltado"
          : "por-fazer",
  }));
}

/**
 * O AVISO DO MOMENTO, no topo do pedido: o que acabou de acontecer, em cor
 * forte. `null` sem parceiro escolhido (aí falam as propostas) e cancelado.
 */
export function momentoDoPedido(p: PedidoDosPassos, n: NegociacaoDosPassos | null, agora: Date = new Date()): Momento | null {
  if (!n || cancelado(p)) return null;
  const nome = n.profissional.nome || "O parceiro";
  if (concluido(n)) {
    const quando = asHoras(n.confirmadoEm, agora);
    return { titulo: "Trabalho concluído", texto: quando ? `Confirmado ${quando}.` : null, tom: "bom" };
  }
  if (n.fase === "a_confirmar") {
    const quando = asHoras(n.execucaoEnviadaEm, agora);
    return { titulo: `${nome} terminou o trabalho`, texto: `${quando ? `Marcou como feito ${quando}. ` : ""}Confirme que ficou feito.`, tom: "aviso" };
  }
  if (n.chegouEm) {
    const quando = asHoras(n.chegouEm, agora);
    const porConfirmar = n.accoes.includes("confirmar_chegada");
    return {
      titulo: `${nome} chegou`,
      texto: [quando ? `Chegou ${quando}.` : null, porConfirmar ? "Confirme que chegou." : null].filter(Boolean).join(" ") || null,
      tom: porConfirmar ? "aviso" : "marca",
    };
  }
  if (n.proximoEm) {
    const quando = asHoras(n.proximoEm, agora);
    return { titulo: `${nome} está próximo`, texto: quando ? `Quase a chegar — avisou ${quando}.` : null, tom: "marca" };
  }
  if (n.aCaminhoEm) {
    const quando = asHoras(n.aCaminhoEm, agora);
    return { titulo: `${nome} vai a caminho`, texto: quando ? `Saiu ${quando}.` : null, tom: "marca" };
  }
  const pg = n.pagamento;
  if (pg && !pg.pago && !pg.emDinheiroAoProfissional && !pg.pagaAoParceiro && pg.disponivel) {
    return { titulo: "Falta o pagamento", texto: `${nome} já foi escolhido.`, tom: "aviso" };
  }
  if (n.dataCombinadaTexto) return { titulo: "Dia marcado", texto: n.dataCombinadaTexto, tom: "marca" };
  return { titulo: `${nome} vai combinar o dia consigo`, texto: null, tom: "marca" };
}

/**
 * DE QUANTO EM QUANTO TEMPO O PEDIDO ABERTO SE RELÊ (ms) — só com o ecrã à
 * vista e a app em primeiro plano. Contratado e por concluir: 15 s (o
 * parceiro pode estar a caminho). À espera de propostas ou do preço: 60 s.
 * Concluído ou cancelado: não se relê sozinho (volta a ler ao voltar à app e
 * com um aviso deste pedido).
 */
export const LEITURA_ACTIVA_MS = 15_000;
export const LEITURA_PARADA_MS = 60_000;
export function intervaloDeLeitura(p: PedidoDosPassos, n: Pick<Negociacao, "fase"> | null): number | null {
  if (cancelado(p) || /^Conclu[íi]do/i.test(p.estadoTexto)) return null;
  if (n && (n.fase === "confirmado" || n.fase === "pago")) return null;
  return n ? LEITURA_ACTIVA_MS : LEITURA_PARADA_MS;
}

/** A lista relê-se de 30 em 30 s com a app aberta — é ela que acende o aviso do topo. */
export const LEITURA_DA_LISTA_MS = 30_000;

/* ─── O aviso em pop-up no topo ───────────────────────────────────────────── */

export type MudancaNaLista = { pedidoId: number; titulo: string; texto: string };

/**
 * O que mudou entre duas leituras da lista (R4), para o aviso do topo, pela
 * ordem da lista. Um pedido novo não conta (foi ele que o fez). O estado em
 * palavras (`estadoTexto`, a tabela única do site) diz o que aconteceu: «Fred
 * vai a caminho», «Fred chegou», «Dia combinado: …», «Por confirmar»… E o
 * «Por pagar» que sai sem o estado mudar é o pagamento que entrou.
 */
export function mudancasNaLista(
  antes: readonly Pick<PedidoNaLista, "id" | "estadoTexto" | "novidade">[],
  depois: readonly Pick<PedidoNaLista, "id" | "estadoTexto" | "novidade">[],
): MudancaNaLista[] {
  const deAntes = new Map(antes.map((p) => [p.id, p]));
  const saida: MudancaNaLista[] = [];
  for (const d of depois) {
    const a = deAntes.get(d.id);
    if (!a) continue;
    const titulo = `Pedido #${d.id}`;
    if (a.estadoTexto !== d.estadoTexto) {
      const extra = d.novidade && d.novidade !== a.novidade ? ` — ${d.novidade}` : "";
      saida.push({ pedidoId: d.id, titulo, texto: `${d.estadoTexto}${extra}` });
    } else if (a.novidade === "Por pagar" && d.novidade !== "Por pagar" && !cancelado(d)) {
      saida.push({ pedidoId: d.id, titulo, texto: "Pagamento recebido" });
    } else if (d.novidade && d.novidade !== a.novidade) {
      saida.push({ pedidoId: d.id, titulo, texto: d.novidade });
    }
  }
  return saida;
}

/** O aviso do topo não aparece no ecrã desse mesmo pedido (nem no pagar dele): lá já se vê. */
export function avisoNoTopoSeVe(caminho: string, pedidoId: number): boolean {
  return caminho !== `/pedido/${pedidoId}` && caminho !== `/pagar/${pedidoId}` && caminho !== `/convidado/${pedidoId}`;
}

/* ─── O estado no cartão da lista ─────────────────────────────────────────── */

/**
 * O tom do estado no cartão da lista (02-11-2026: «o estado actual visível em
 * cada cartão»): em movimento (a caminho, próximo, chegou) e com parceiro em
 * cor de marca; à espera dele (por confirmar, por pagar…) em âmbar; concluído
 * em verde; cancelado apagado. Só pelo `estadoTexto` da tabela única do site.
 */
export type TomDoEstado = "movimento" | "aviso" | "bom" | "apagado" | "normal";
export function tomDoEstado(p: Pick<PedidoNaLista, "estadoTexto" | "novidade">): TomDoEstado {
  const e = p.estadoTexto;
  if (/^Cancelado/i.test(e)) return "apagado";
  if (/^Conclu[íi]do/i.test(e)) return "bom";
  if (p.novidade || /^Por confirmar/i.test(e) || /precisa de mais detalhes/i.test(e)) return "aviso";
  if (/ (vai a caminho|está próximo|chegou)$/.test(e) || /^Dia combinado/.test(e) || /^Contratado/.test(e)) return "movimento";
  return "normal";
}
