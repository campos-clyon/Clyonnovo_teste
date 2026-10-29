import Link from "next/link";
import { MapPin } from "lucide-react";

import { caminhoDoServicoNaCidade } from "@/lib/caminho-da-cidade";
import { emTerra } from "@/lib/preposicao-da-terra";
import { CIDADES_COM_PAGINA } from "@/lib/seo-data";

/*
 * AS PÁGINAS DE UM SERVIÇO, CIDADE A CIDADE — 14-10-2026 (auditoria de SEO).
 *
 * O hub de monos não ligava a nenhuma das 26 páginas de monos, e o de
 * esvaziamento só à da Amadora: o Google chegava às páginas de cidade por
 * outros caminhos, ou não chegava, e o hub não lhes passava nada. Aqui
 * ficam todas, agrupadas pela região, cada uma com o nome do que lá está
 * («Recolha de monos na Moita») e não só o da terra.
 *
 * A lista nasce de CIDADES_COM_PAGINA (as terras juntas ao concelho, d13,
 * ficam de fora), e o endereço de `caminhoDoServicoNaCidade` — uma
 * cidade nova entra sozinha, e as que têm página estática própria (a
 * consolidada) ligam para ela, e não para o redirect.
 */
export default function CidadesDoServico({
  servico,
  nome,
  titulo,
  descricao,
}: {
  /** O slug do serviço nas páginas de cidade: «recolha-monos», «esvaziamento-casas»… */
  servico: string;
  /** Como o serviço começa a âncora: «Recolha de monos». */
  nome: string;
  titulo: string;
  descricao?: string;
}) {
  const regioes = [...new Set(CIDADES_COM_PAGINA.map((c) => c.regionLabel))];
  return (
    <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
      <h2 className="text-2xl font-bold text-slate-900">{titulo}</h2>
      {descricao ? <p className="mt-2 max-w-3xl text-base text-slate-600">{descricao}</p> : null}
      <div className="mt-6 space-y-6">
        {regioes.map((regiao) => (
          <div key={regiao}>
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-acao">
              <MapPin className="h-3.5 w-3.5" />
              {regiao}
            </h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {CIDADES_COM_PAGINA.filter((c) => c.regionLabel === regiao).map((cidade) => (
                <li key={cidade.slug}>
                  <Link
                    href={caminhoDoServicoNaCidade(servico, cidade.slug)}
                    className="block rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 transition hover:border-cyan-300 hover:text-acao-hover"
                  >
                    {nome} {emTerra(cidade.name)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
