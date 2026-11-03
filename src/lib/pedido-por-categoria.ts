import { PESO_DO_SACO } from "./sacos-de-entulho";
import {
  QUANTO_TRABALHO,
  RECHEIOS,
  TIPOS_DE_TRABALHO,
  lerDesmontagem,
  lerEntulho,
  lerManutencao,
  lerRecheio,
  lerTipologiaDoEsvaziamento,
  medidaDita,
  nomeDaOpcao,
  sacosDaMedida,
  tipologiasDoEsvaziamento,
  type MedidaDoEntulho,
} from "./respostas-do-simulador";

/**
 * O PEDIDO GUARDA AS RESPOSTAS DE CADA CATEGORIA — 03-11-2026 (decisão d1).
 *
 * A app de cliente passa a perguntar o que cada serviço precisa
 * (`simulador-por-categoria.ts`) e manda as respostas pelos mesmos ids ao
 * `POST /api/simulador/pedido`. Quem as lê — a Mesa, a ficha do pedido, o
 * painel e a app do profissional, a sugestão de preço — já lia o entulho por
 * `entulhoState`, `entulhoQuantidade` (sacos), `entulhoQuantidadeDita`,
 * `entulhoQuantidadeEnsacados`, `entulhoQuantidadePorEnsacar` e
 * `entulhoQuantidadeBigBags` (no `rawOrderJson`), e o resto pela descrição.
 * Aqui as respostas novas viram esses campos — os big bags e os m³ em sacos,
 * pelas regras da casa — e uma linha na descrição. Nada se escreve por cima do
 * que já veio (o simulador do site manda os sacos já contados), e os valores
 * antigos (as cargas «Enche uma carrinha», o estado e os sacos) continuam a
 * valer.
 *
 * Puro: o route usa-o, os testes também.
 */

const temValor = (v: unknown) => v != null && String(v).trim() !== "" && String(v).trim() !== "0";

/** O que o pedido passa a ter, além do que já trazia (só os campos em falta). */
export function camposDaCategoriaParaGravar(order: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const servico = typeof order.serviceType === "string" ? order.serviceType : "";

  if (servico === "recolha_entulho") {
    const e = lerEntulho(order);
    if (e) {
      if (e.estado && !temValor(order.entulhoState)) out.entulhoState = e.estado;
      const m = e.medida;
      const sacos = sacosDaMedida(m);
      if (m && sacos != null && sacos > 0 && !temValor(order.entulhoQuantidade)) {
        out.entulhoQuantidade = String(sacos);
        // Quando a quantidade veio noutra medida, quem faz o trabalho vê também como ele a disse.
        const dita = medidaDita(m);
        if (dita && !temValor(order.entulhoQuantidadeDita)) out.entulhoQuantidadeDita = dita;
      }
      if (m?.tipo === "acima" && !temValor(order.entulhoQuantidadeDita)) out.entulhoQuantidadeDita = medidaDita(m);
      if (m?.tipo === "bigbags" && !temValor(order.entulhoQuantidadeBigBags)) out.entulhoQuantidadeBigBags = String(m.bigBags);
      if (m?.tipo === "misto") {
        if (!temValor(order.entulhoQuantidadeEnsacados)) out.entulhoQuantidadeEnsacados = String(m.ensacados);
        if (!temValor(order.entulhoQuantidadePorEnsacar)) out.entulhoQuantidadePorEnsacar = String(m.porEnsacar);
      }
      if (!m && (e.estado === "unknown" || order.entulhoVolume === "incerto") && order.entulhoQuantidadeIncerta !== true) {
        out.entulhoQuantidadeIncerta = true;
      }
    }
  }

  // A desmontagem da R7 (sim/não) no campo de sempre.
  const desmontar = lerDesmontagem(order.desmontagem);
  if (desmontar !== undefined && !temValor(order.needsDismantling)) out.needsDismantling = desmontar ? "simple" : "no";

  // A repetição da manutenção (`repeticao`) no campo de sempre.
  if (servico === "manutencao_casa" && !temValor(order.recurrenceFrequency)) {
    const r = lerManutencao(order).repeticao;
    if (r === "semanal" || r === "quinzenal") out.recurrenceFrequency = r;
  }
  return out;
}

/** «2 big bags (≈ 76 sacos de 25 a 30 kg).» — a quantidade do entulho, como ficou contada. */
function linhaDoEntulho(m: MedidaDoEntulho): string | null {
  const sacos = sacosDaMedida(m);
  switch (m.tipo) {
    case "sacos":
      return `${m.sacos} ${m.sacos === 1 ? "saco" : "sacos"} de ${PESO_DO_SACO}.`;
    case "bigbags":
      return `${m.bigBags} ${m.bigBags === 1 ? "big bag" : "big bags"} (≈ ${sacos} sacos de ${PESO_DO_SACO}).`;
    case "volume":
      return `no chão, a granel, até ${m.m3} m³ (≈ ${sacos} sacos).`;
    case "acima":
      return `no chão, a granel, mais de ${m.m3} m³.`;
    case "misto":
      return `${m.ensacados} em sacos e cerca de ${m.porEnsacar} por ensacar.`;
    case "carga":
      return null;
  }
}

export const PREFIXO_DO_ENTULHO = "Quantidade de entulho: ";
export const PREFIXO_DA_TIPOLOGIA = "Tipologia: ";
export const PREFIXO_DO_RECHEIO = "Recheio: ";
export const PREFIXO_DO_TRABALHO = "Trabalho: ";
export const PREFIXO_DOS_MATERIAIS = "Materiais: ";

const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** As linhas que as respostas novas deixam na descrição, para a Mesa e para quem faz o trabalho. */
export function linhasDaCategoria(order: Record<string, unknown>): string[] {
  const servico = typeof order.serviceType === "string" ? order.serviceType : "";
  const l: string[] = [];
  if (servico === "recolha_entulho") {
    // Só das respostas novas (d1): os campos de sempre já tinham onde aparecer.
    const novas = ["tipoDeSaco", "quantidade", "ensacados", "porEnsacar"].some((k) => order[k] != null) ||
      (typeof order.entulhoVolume === "string" && /^(ate\d+|mais)$/.test(order.entulhoVolume));
    const m = novas ? lerEntulho(order)?.medida : null;
    const linha = m ? linhaDoEntulho(m) : null;
    if (linha) l.push(`${PREFIXO_DO_ENTULHO}${linha}`);
  }
  if (servico === "esvaziamento_casa" || servico === "esvaziamento_apartamento") {
    const t = lerTipologiaDoEsvaziamento(servico, order.tipologia);
    const nome = t ? nomeDaOpcao(tipologiasDoEsvaziamento(servico), t) : null;
    if (nome) l.push(`${PREFIXO_DA_TIPOLOGIA}${nome}.`);
    const r = nomeDaOpcao(RECHEIOS, lerRecheio(order.recheio));
    if (r) l.push(`${PREFIXO_DO_RECHEIO}${minuscula(r)}.`);
  }
  if (servico === "manutencao_casa") {
    const m = lerManutencao(order);
    const tipo = nomeDaOpcao(TIPOS_DE_TRABALHO, m.tipoDeTrabalho);
    const quanto = nomeDaOpcao(QUANTO_TRABALHO, m.quantoTrabalho);
    if (tipo || quanto) l.push(`${PREFIXO_DO_TRABALHO}${[tipo, quanto ? (tipo ? minuscula(quanto) : quanto) : null].filter(Boolean).join(", ")}.`);
    const mat =
      m.materiais === "tenho"
        ? "o cliente já tem os materiais."
        : m.materiais === "parceiro"
          ? "quer que os traga quem fizer o trabalho."
          : m.materiais === "nao_sei"
            ? "ainda não sabe."
            : null;
    if (mat) l.push(`${PREFIXO_DOS_MATERIAIS}${mat}`);
  }
  return l;
}

/** A descrição com as linhas da categoria por cima — sem repetir uma que já lá esteja. */
export function comAsLinhasDaCategoria(descricao: unknown, order: Record<string, unknown>): string {
  const antes = typeof descricao === "string" ? descricao : "";
  const ja = antes.split("\n").map((x) => x.trim());
  const novas = linhasDaCategoria(order).filter((linha) => {
    const prefixo = linha.slice(0, linha.indexOf(": ") + 2);
    return !ja.some((x) => x.startsWith(prefixo));
  });
  return [...novas, antes].filter((x) => x.trim()).join("\n").trim();
}
