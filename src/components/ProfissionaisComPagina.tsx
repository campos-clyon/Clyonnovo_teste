import Link from "next/link";
import { MapPin, Star } from "lucide-react";

import {
  profissionaisComPagina,
  temAlgoParaMostrar,
  type ProfissionalNaLista,
} from "@/lib/perfil-publico-do-profissional";
import { normalize } from "@/lib/coverage";
import { tService } from "@/lib/translations";

/**
 * OS PROFISSIONAIS, LIGADOS A PARTIR DAS PÁGINAS QUE O GOOGLE JÁ INDEXA.
 *
 * As páginas `/profissionais/[slug]` estavam em «Detectada, mas não indexada»
 * — dezasseis delas. A causa não era técnica: eram páginas ÓRFÃS. Nenhuma
 * página do site lhes ligava, e a única forma de o Google as conhecer era uma
 * lista nossa no sitemap. Um endereço que só existe numa declaração, sem um
 * único link interno a apontar-lhe, é o que ele põe no fim da fila — e o fim
 * da fila de um site pequeno nunca chega.
 *
 * Este bloco é a ponte. Vive nas páginas que já têm visitas e já estão
 * indexadas — avaliações, trabalhos, as páginas de cidade — e passa-lhes
 * alguma da autoridade que elas têm.
 *
 * SÓ ENTRA QUEM TEM ALGUMA COISA PARA MOSTRAR. A mesma regra do sitemap e do
 * `noindex`, escrita uma vez em `temAlgoParaMostrar`: ligar a uma página vazia
 * é gastar o link e ensinar o Google a ignorar os outros.
 *
 * O QUE NUNCA APARECE AQUI: telefone, email, morada. É a mesma regra da página
 * do perfil — o perfil dá confiança, não dá o contacto.
 */

type Props = {
  /**
   * A cidade da página onde este bloco está, quando há uma.
   *
   * Filtra por quem trabalha lá — a base dele ou uma das zonas que indicou.
   * Sem ninguém dessa zona, o bloco não aparece: «Profissionais em Almada» com
   * uma empresa de Setúbal é pior do que nada, e é o género de coisa que o
   * cliente confirma no primeiro telefonema.
   */
  cidade?: string | null;
  titulo: string;
  descricao?: string;
  /** Quantos cartões no máximo. Uma lista infinita não ajuda ninguém a ler. */
  limite?: number;
  /** A cor de fundo da secção, para encaixar na página que a recebe. */
  fundo?: string;
};

/** Trabalha aqui? A base dele, ou uma das zonas que ele próprio indicou. */
function trabalhaEm(p: ProfissionalNaLista, cidade: string): boolean {
  const alvo = normalize(cidade);
  if (p.cidade && normalize(p.cidade) === alvo) return true;
  return p.zonas.some((z) => normalize(z) === alvo);
}

/** As estrelas, desenhadas. Meia estrela não se inventa: arredonda-se. */
function Estrelas({ nota }: { nota: number }) {
  const cheias = Math.round(nota);
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= cheias ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
        />
      ))}
    </span>
  );
}

export default async function ProfissionaisComPagina({
  cidade,
  titulo,
  descricao,
  limite = 12,
  fundo = "bg-white",
}: Props) {
  const todos = (await profissionaisComPagina()).filter(temAlgoParaMostrar);
  const lista = (cidade ? todos.filter((p) => trabalhaEm(p, cidade)) : todos).slice(0, limite);

  // Sem ninguém, não há secção. Um título sobre uma grelha vazia é pior do que
  // não haver título — e numa página de cidade acontece sempre que ainda não
  // temos lá ninguém.
  if (lista.length === 0) return null;

  return (
    <section className={`${fundo} py-12 lg:py-16`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-tinta sm:text-3xl">{titulo}</h2>
        {descricao && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            {descricao}
          </p>
        )}

        <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((p) => {
            const servicos = p.categorias.map((c) => tService(c) || c).filter(Boolean).slice(0, 2);
            return (
              <li key={p.slug}>
                <Link
                  href={`/profissionais/${p.slug}`}
                  className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
                >
                  <span className="text-base font-semibold text-tinta">{p.nome}</span>

                  {/*
                    A NOTA, quando há avaliações — e nunca «0 avaliações».
                    Um cartão que anuncia zero é um cartão a pedir para não ser
                    carregado. Quem ainda não tem avaliações mostra os
                    trabalhos, que é o que tem.
                  */}
                  {p.quantasAvaliacoes > 0 && p.notaMedia != null ? (
                    <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-600">
                      <Estrelas nota={p.notaMedia} />
                      {p.notaMedia.toFixed(1).replace(".", ",")}
                      <span className="text-tinta-fraca">
                        ({p.quantasAvaliacoes}{" "}
                        {p.quantasAvaliacoes === 1 ? "avaliação" : "avaliações"})
                      </span>
                    </span>
                  ) : (
                    <span className="mt-1.5 text-xs text-tinta-fraca">
                      {p.trabalhosConcluidos}{" "}
                      {p.trabalhosConcluidos === 1 ? "trabalho" : "trabalhos"} na CLYON
                    </span>
                  )}

                  {p.cidade && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {p.cidade}
                    </span>
                  )}

                  {servicos.length > 0 && (
                    <span className="mt-3 flex flex-wrap gap-1.5">
                      {servicos.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                        >
                          {s}
                        </span>
                      ))}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
