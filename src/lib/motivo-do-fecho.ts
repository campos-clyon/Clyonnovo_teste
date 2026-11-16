/**
 * O MOTIVO DE CANCELAR OU ARQUIVAR UM PEDIDO — d54, 16-11-2026.
 *
 * Cancelar ou arquivar um pedido pede um motivo, e sem ele não se faz (o
 * servidor recusa com 422 e diz porquê). É uma escolha de seis, e não texto
 * livre: assim conta-se — a Mesa mostra quantos se fecharam na semana, por
 * serviço e por motivo — e não entram dados de pessoas. Com «Preço», pode
 * dizer-se quanto o cliente queria pagar (opcional).
 *
 * Grava-se em colunas próprias do pedido (`motivoDoFecho`, `motivoDoFechoEm`,
 * `quantoQueriaPagar`) e numa linha do histórico. O texto livre do «Cancelar»
 * (o que vai no aviso ao cliente e aos parceiros) continua à parte, como era.
 */

export const MOTIVOS_DO_FECHO = [
  { chave: "sem_resposta", rotulo: "Sem resposta do cliente" },
  { chave: "preco", rotulo: "Preço" },
  { chave: "sem_parceiro", rotulo: "Sem parceiro na zona ou na data" },
  { chave: "repetido", rotulo: "Repetido" },
  { chave: "ja_nao_precisa", rotulo: "Já não precisa" },
  { chave: "outro", rotulo: "Outro" },
] as const;

export type ChaveDoMotivo = (typeof MOTIVOS_DO_FECHO)[number]["chave"];

/** Os estados que fecham um pedido pela mão da equipa. */
export const ESTADOS_QUE_FECHAM = ["cancelado", "arquivado", "rejeitado"] as const;

export const SEM_MOTIVO_DO_FECHO =
  "Escolha o motivo: sem resposta do cliente, preço, sem parceiro na zona ou na data, repetido, já não precisa, ou outro.";

export function rotuloDoMotivo(chave: string | null | undefined): string | null {
  return MOTIVOS_DO_FECHO.find((m) => m.chave === chave)?.rotulo ?? null;
}

export function lerMotivoDoFecho(v: unknown): ChaveDoMotivo | null {
  return MOTIVOS_DO_FECHO.find((m) => m.chave === v)?.chave ?? null;
}

/** «Quanto queria pagar» — só com «Preço», um número positivo e razoável, em euros. */
export function lerQuantoQueriaPagar(v: unknown, motivo: ChaveDoMotivo | null): number | null {
  if (motivo !== "preco" || v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 100_000) return null;
  return Math.round(n * 100) / 100;
}

/** Esta mudança de estado fecha o pedido (de aberto para cancelado, arquivado ou rejeitado)? */
export function fechaOPedido(antes: string | null | undefined, depois: unknown): boolean {
  const fecha = (s: unknown) => (ESTADOS_QUE_FECHAM as readonly string[]).includes(String(s ?? ""));
  return typeof depois === "string" && fecha(depois) && !fecha(antes);
}

export type MotivoLido =
  | { ok: true; motivo: ChaveDoMotivo; quantoQueriaPagar: number | null }
  | { ok: false; erro: string };

/** O motivo do corpo do pedido — obrigatório. */
export function exigirMotivoDoFecho(corpo: { motivoDoFecho?: unknown; quantoQueriaPagar?: unknown } | null | undefined): MotivoLido {
  const motivo = lerMotivoDoFecho(corpo?.motivoDoFecho);
  if (!motivo) return { ok: false, erro: SEM_MOTIVO_DO_FECHO };
  return { ok: true, motivo, quantoQueriaPagar: lerQuantoQueriaPagar(corpo?.quantoQueriaPagar, motivo) };
}

/** A linha do histórico: «Motivo: Preço (queria pagar 150 €).» */
export function textoDoMotivo(motivo: ChaveDoMotivo, quanto: number | null): string {
  const q = motivo === "preco" && quanto != null ? ` (queria pagar ${String(quanto).replace(".", ",")} €)` : "";
  return `Motivo: ${rotuloDoMotivo(motivo)}${q}.`;
}

export type LinhaDosMotivos = { serviceType: string | null; motivo: string | null; n: number };

export type MotivosPorServico = {
  servico: string | null;
  total: number;
  porMotivo: Partial<Record<ChaveDoMotivo, number>>;
};

/** A contagem da semana, por serviço (o que mais fechou em cima), cada um com os seus motivos. */
export function motivosPorServico(linhas: readonly LinhaDosMotivos[]): MotivosPorServico[] {
  const mapa = new Map<string, MotivosPorServico>();
  for (const l of linhas) {
    const motivo = lerMotivoDoFecho(l.motivo);
    const n = Number(l.n);
    if (!motivo || !Number.isFinite(n) || n <= 0) continue;
    const k = l.serviceType ?? "";
    const s = mapa.get(k) ?? { servico: l.serviceType ?? null, total: 0, porMotivo: {} };
    s.total += n;
    s.porMotivo[motivo] = (s.porMotivo[motivo] ?? 0) + n;
    mapa.set(k, s);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total || String(a.servico).localeCompare(String(b.servico)));
}

/**
 * Os motivos das janelas de cancelar (`MOTIVOS_DE_CANCELAMENTO`, mais finos e
 * com o texto que vai nos avisos), cada um na sua categoria. Assim a janela
 * de sempre continua a servir — e o que se escolheu nela conta na semana.
 */
const CATEGORIA_DO_CANCELAMENTO: Record<string, ChaveDoMotivo> = {
  "O cliente desistiu": "ja_nao_precisa",
  "O cliente já não precisa": "ja_nao_precisa",
  "O cliente achou o preço alto": "preco",
  "A data não serviu ao cliente": "sem_parceiro",
  "O cliente escolheu outra empresa": "outro",
  "Já foi feito por outra pessoa": "ja_nao_precisa",
  "Não conseguimos falar com o cliente": "sem_resposta",
  "O profissional não pode fazer": "sem_parceiro",
  "Pedido repetido": "repetido",
};

/** A categoria do motivo escrito numa janela de cancelar; o que não for da lista é «outro». `null` sem motivo. */
export function motivoDoFechoDoTexto(texto: string | null | undefined): ChaveDoMotivo | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  return CATEGORIA_DO_CANCELAMENTO[t] ?? "outro";
}
