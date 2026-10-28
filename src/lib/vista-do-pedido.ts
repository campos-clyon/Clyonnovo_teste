import { negociacoesDoPedido } from "@/lib/db";
import { negociacoesParaOCliente } from "@/lib/negociacoes-para-o-cliente";
import { perfilPublicoDoProfissional, type PerfilPublico } from "@/lib/perfil-publico-do-profissional";
import { lerBase } from "@/lib/base-do-preco";
import { negociacaoParaOEcra, type NegociacaoNoEcra } from "@/lib/negociacao-no-ecra";
import {
  negociacaoParaAVista,
  type NegociacaoDoCliente,
  type PerfilNaVista,
} from "@/lib/negociacao-na-vista";

/**
 * AS NEGOCIAÇÕES DE UM PEDIDO, COMO O CLIENTE AS VÊ — no servidor (d8, R5,
 * 28-10-2026).
 *
 * Era o corpo de `VistaDoPedido.tsx`. Saiu para aqui para a página do link, o
 * backoffice «ver como o cliente» e a app de cliente (`/api/cliente/pedidos/[id]`)
 * lerem o mesmo pedido da mesma maneira: as mesmas negociações, pelos mesmos
 * filtros, com o mesmo perfil de cada profissional.
 */

/** O perfil público em texto, para atravessar do servidor para o ecrã sem surpresas. */
export function perfilNaVista(perfil: PerfilPublico | null | undefined): PerfilNaVista | null {
  if (!perfil) return null;
  return {
    naClyonDesde: perfil.naClyonDesde ? perfil.naClyonDesde.toISOString() : null,
    trabalhosConcluidos: perfil.trabalhosConcluidos,
    notaMedia: perfil.notaMedia,
    quantasAvaliacoes: perfil.quantasAvaliacoes,
    categorias: perfil.categorias,
    zonas: perfil.zonas,
    raioKm: perfil.raioKm,
    avaliacoes: perfil.avaliacoes.map((a) => ({
      estrelas: a.estrelas,
      comentario: a.comentario,
      avaliadoEm: a.avaliadoEm ? new Date(a.avaliadoEm).toISOString() : null,
      servicoTipo: a.servicoTipo,
      cidade: a.cidade,
    })),
  };
}

export async function negociacoesDaVistaDoCliente(
  pedido: { id: number; valorFixoClyon?: unknown; baseDoPreco?: unknown },
  agora: Date = new Date(),
): Promise<NegociacaoDoCliente[]> {
  /*
   * SÓ QUEM FEZ PROPOSTA. E o filtro corre AQUI, no servidor.
   *
   * Um pedido vai a todos os profissionais elegíveis da zona, e cada um abre
   * uma negociação no instante em que o recebe — mesmo que nunca lhe toque.
   * Filtrar no browser tirava-os do ecrã e deixava-os no HTML: os nomes, as
   * notas e os trabalhos de pessoas que o cliente não tem nada que conhecer.
   * Aqui nem saem da base — e poupam-se os perfis que ninguém ia ver.
   *
   * A regra é a mesma da conta, e vive em `negociacoes-para-o-cliente.ts`
   * (d33, 26-10-2026): além de só quem fez proposta, um Trabalho CLYON não
   * mostra negociação nenhuma — o valor dela é o que o profissional recebe —
   * e a taxa do profissional não sai daqui.
   */
  const linhas = negociacoesParaOCliente(
    await negociacoesDoPedido(pedido.id),
    pedido.valorFixoClyon != null,
  );
  /*
   * O perfil de cada profissional vai JUNTO com a negociação — a homepage
   * promete "vê o nome, a nota e os trabalhos antes de aceitar". São dados
   * REAIS: com zero avaliações o ecrã diz "sem avaliações ainda".
   */
  const perfis = new Map(
    await Promise.all(
      [...new Set(linhas.map((n) => Number(n.providerId)))].map(
        async (id) => [id, await perfilPublicoDoProfissional(id)] as const,
      ),
    ),
  );
  // O que o valor MEDE: o trabalho todo, ou cada carga. Ver `base-do-preco.ts`.
  const porCarga = lerBase(pedido.baseDoPreco) === "carga";
  return linhas.map((n) =>
    negociacaoParaAVista(n, { porCarga, perfil: perfilNaVista(perfis.get(Number(n.providerId))), agora }),
  );
}

/**
 * AS MESMAS NEGOCIAÇÕES, PRONTAS PARA O ECRÃ DO SITE — 28-10-2026 (d10).
 *
 * É isto que a página do link manda ao navegador: os textos e o preço do
 * cliente, nunca o valor do profissional, as propostas em bruto nem a taxa.
 * Ver `negociacao-no-ecra.ts`.
 */
export async function negociacoesNoEcraDoPedido(
  pedido: { id: number; valorFixoClyon?: unknown; baseDoPreco?: unknown },
  agora: Date = new Date(),
): Promise<NegociacaoNoEcra[]> {
  const base = lerBase(pedido.baseDoPreco);
  return (await negociacoesDaVistaDoCliente(pedido, agora)).map((n) =>
    negociacaoParaOEcra(n, base, agora, pedido.id),
  );
}
