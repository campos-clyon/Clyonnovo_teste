"use client";

import { Star } from "lucide-react";
import { CabecalhoDeEcra } from "@/components/portal/Portal";
import Nota from "@/components/Nota";

export type AvaliacaoRecebida = {
  estrelas: number;
  comentario: string | null;
  em: string | null;
};

/**
 * As avaliações que ele recebeu.
 *
 * Numa plataforma sem reputação, o cliente só tem o preço para decidir — e o
 * preço sozinho premeia quem corta no trabalho. Isto é a única coisa que um
 * profissional novo não pode comprar, e por isso tem de a poder ver: uma
 * reputação que só a plataforma conhece não muda o comportamento de ninguém.
 *
 * Quem avaliou não aparece. O cliente sabe que a nota fica associada ao nome
 * dele e responde a isso — ou não avalia, ou avalia bem de mais. O anonimato
 * é o que permite dizer que correu mal a alguém que sabe onde ele mora.
 */
export default function Avaliacoes({
  avaliacoes,
  media,
  quantas,
  onVoltar,
}: {
  avaliacoes: AvaliacaoRecebida[];
  media: number | null;
  quantas: number;
  onVoltar: () => void;
}) {
  return (
    <>
      <CabecalhoDeEcra titulo="Avaliações" onVoltar={onVoltar} />

      {/* O número grande ao centro, como na carteira. */}
      <section className="rounded-2xl border border-[#E2EEF3] bg-white p-6 text-center shadow-sm">
        {media == null ? (
          <>
            <Estrelas valor={0} tamanho="grande" />
            <p className="mt-3 text-sm text-slate-500">
              Ainda não tem avaliações. A primeira chega quando um cliente
              confirmar que o trabalho está feito.
            </p>
          </>
        ) : (
          <>
            <p className="text-5xl font-bold leading-none text-[#0B1929]">
              {media.toFixed(1).replace(".", ",")}
            </p>
            <div className="mt-3">
              <Estrelas valor={media} tamanho="grande" />
            </div>
            {/* A média sozinha mente: 5,0 de uma avaliação não é melhor do que
                4,6 de quarenta. Nunca aparece sem o número ao lado. */}
            <p className="mt-2 text-sm text-slate-500">
              {quantas} {quantas === 1 ? "avaliação" : "avaliações"}
            </p>
          </>
        )}
      </section>

      {avaliacoes.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-[#E2EEF3] bg-white shadow-sm">
          {avaliacoes.map((a, i) => (
            <article
              key={i}
              className={`p-4 ${i > 0 ? "border-t border-slate-100" : ""}`}
            >
              <Estrelas valor={a.estrelas} />
              {a.comentario && (
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  “{a.comentario}”
                </p>
              )}
              <p className="mt-1.5 text-xs text-slate-400">
                Cliente
                {a.em && ` · ${new Date(a.em).toLocaleDateString("pt-PT")}`}
              </p>
            </article>
          ))}
        </div>
      )}

      <Nota titulo="Quem avaliou não aparece" className="mt-3" comecaAberta>
        As avaliações são anónimas: vê a nota e o comentário, não vê quem os
        escreveu. É o que permite a um cliente dizer que correu mal sem ter de
        o dizer na cara de quem já sabe onde ele mora — e é o que faz as boas
        avaliações valerem alguma coisa.
      </Nota>
    </>
  );
}

function Estrelas({ valor, tamanho = "normal" }: { valor: number; tamanho?: "normal" | "grande" }) {
  const px = tamanho === "grande" ? "h-6 w-6" : "h-4 w-4";
  return (
    <div
      className="flex justify-center gap-1"
      role="img"
      aria-label={`${valor.toFixed(1).replace(".", ",")} de 5 estrelas`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${px} ${
            n <= Math.round(valor) ? "fill-[#00B4CC] text-[#00B4CC]" : "text-slate-300"
          }`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
