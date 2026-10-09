import { SERVICE_CATEGORIES } from "./service-categories";

/**
 * O SERVIÇO QUE O LINK JÁ ESCOLHEU — 09-10-2026.
 *
 * Quem carrega em «Pedir orçamento» numa página de mudanças chegava ao
 * simulador com os serviços todos por escolher, e tinha de dizer outra vez que
 * era uma mudança. Agora o link diz-o (`/simulador?servico=mudanca`) e o
 * formulário abre com ele escolhido — a pessoa pode sempre trocar.
 *
 * Aceita o id da categoria (`mudanca`, `recolha_moveis`), o slug
 * (`recolha-moveis`), e os nomes que a página das regiões já mandava em
 * `?categoria=` e que o simulador nunca leu (`moveis`, `monos`, `entulho`,
 * `mudancas`). Um valor que não se conhece é ignorado: o formulário abre como
 * sempre abriu.
 */
const NOMES_ANTIGOS: Record<string, string> = {
  moveis: "recolha_moveis",
  monos: "recolha_monos",
  entulho: "recolha_entulho",
  mudancas: "mudanca",
  esvaziamento: "esvaziamento_casa",
};

export function servicoDaLigacao(pesquisa: string): string | null {
  const p = new URLSearchParams(pesquisa);
  const valor = (p.get("servico") ?? p.get("categoria") ?? "").trim().toLowerCase();
  if (!valor) return null;
  const categoria = SERVICE_CATEGORIES.find((c) => c.id === valor || c.slug === valor);
  if (categoria) return categoria.id;
  return NOMES_ANTIGOS[valor] ?? null;
}
