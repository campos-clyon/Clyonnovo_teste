import { instanteDaBase } from "@/lib/hora-de-lisboa";
import { combinaComABusca } from "@/lib/procurar-pedido";

/**
 * PROCURAR EM TODO O LADO — 17-10-2026.
 *
 * *«As barras de pesquisa de toda a backoffice devem mostrar qualquer
 * trabalho, independente de onde foi gerado: Trabalhos CLYON, Negociações ou
 * pedidos directos no site.»* — o dono.
 *
 * Cada ecrã continua a procurar na sua lista, que é onde se age. Isto é o que
 * aparece por baixo da caixa: os pedidos que a mesma procura encontra NOUTROS
 * sítios, com a origem de cada um e o sítio onde se trata. A procura é a das
 * listas (`combinaComABusca`), para «#311», um telemóvel ou um apelido darem o
 * mesmo aqui e lá.
 *
 * Só leitura. Este ficheiro é puro (vai para o browser, com os rótulos); a
 * leitura da base está em `procurar-em-todo-o-lado-na-base.ts`.
 */

export type OrigemDoPedido = "trabalho_clyon" | "negociacao" | "pedido_do_site";

/** Onde se trata cada origem — os ids das secções do painel. */
export type SeccaoDoPedido = "trabalhos_clyon" | "negociacoes_clyon" | "pedidos";

export const ROTULO_DA_ORIGEM: Record<OrigemDoPedido, string> = {
  trabalho_clyon: "Trabalho CLYON",
  negociacao: "Negociação",
  pedido_do_site: "Pedido do site",
};

export const ROTULO_DA_SECCAO_DO_PEDIDO: Record<SeccaoDoPedido, string> = {
  trabalhos_clyon: "Trabalhos CLYON",
  negociacoes_clyon: "Negociações",
  pedidos: "Início",
};

export type ResultadoDaProcura = {
  pedidoId: number;
  cliente: string | null;
  telefone: string | null;
  servico: string | null;
  cidade: string | null;
  /** O estado do pedido, como está na base. */
  estado: string | null;
  origem: OrigemDoPedido;
  seccao: SeccaoDoPedido;
  /** Quem ficou com o trabalho, quando já há acordo. */
  profissional: string | null;
  criadoEm: string | null;
};

export type LinhaParaProcurar = {
  id: number;
  status: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail?: string | null;
  address: string | null;
  city: string | null;
  postalCode?: string | null;
  serviceType: string | null;
  valorFixoClyon: number | string | null;
  negociacoes: number | string | null;
  profissional: string | null;
  createdAt: Date | string | null;
};

/** Um Trabalho CLYON tem valor fixo; uma negociação tem mesa; o resto veio do site e ainda não foi a ninguém. */
export function origemDoPedido(l: { valorFixoClyon: unknown; negociacoes: unknown }): OrigemDoPedido {
  if (l.valorFixoClyon != null && l.valorFixoClyon !== "") return "trabalho_clyon";
  if (Number(l.negociacoes ?? 0) > 0) return "negociacao";
  return "pedido_do_site";
}

export function seccaoDaOrigem(o: OrigemDoPedido): SeccaoDoPedido {
  return o === "trabalho_clyon" ? "trabalhos_clyon" : o === "negociacao" ? "negociacoes_clyon" : "pedidos";
}

export const MAXIMO_DE_RESULTADOS = 20;

/** Puro: as linhas que respondem à procura, as mais recentes primeiro. */
export function procurarNasLinhas(linhas: LinhaParaProcurar[], termo: string, maximo = MAXIMO_DE_RESULTADOS): ResultadoDaProcura[] {
  if (!termoQueProcura(termo)) return [];
  return linhas
    .filter((l) =>
      combinaComABusca(
        {
          id: Number(l.id),
          contactName: l.contactName,
          contactPhone: l.contactPhone,
          contactEmail: l.contactEmail ?? null,
          address: l.address,
          city: l.city,
          postalCode: l.postalCode ?? null,
          serviceType: l.serviceType,
          profissionais: l.profissional ? [l.profissional] : [],
        },
        termo,
      ),
    )
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, maximo)
    .map((l) => {
      const origem = origemDoPedido(l);
      const criado = instanteDaBase(l.createdAt ?? null);
      return {
        pedidoId: Number(l.id),
        cliente: (l.contactName ?? "").trim() || null,
        telefone: (l.contactPhone ?? "").trim() || null,
        servico: l.serviceType ?? null,
        cidade: l.city ?? null,
        estado: l.status ?? null,
        origem,
        seccao: seccaoDaOrigem(origem),
        profissional: (l.profissional ?? "").trim() || null,
        criadoEm: criado ? criado.toISOString() : null,
      };
    });
}

/**
 * Há o que procurar? Duas letras, ou um número — «#4» e «45» já dizem um
 * pedido; uma letra só traria a base inteira.
 */
export function termoQueProcura(termo: string): boolean {
  const t = termo.trim();
  if (!t) return false;
  return t.length >= 2 || /\d/.test(t);
}
