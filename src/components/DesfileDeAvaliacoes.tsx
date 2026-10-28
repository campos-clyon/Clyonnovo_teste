"use client";

import { useState } from "react";
import { Pause, Play, Star } from "lucide-react";
import { reviews } from "@/lib/reviews-data";

/**
 * O desfile de testemunhos da homepage.
 *
 * PORQUE É QUE ISTO SAIU DA page.tsx
 *
 * Porque precisa de estado, e a homepage é Server Component. O botão de pausa
 * não é decoração: movimento automático que dura mais de cinco segundos e não
 * pode ser parado é falha direta do critério 2.2.2 das WCAG.
 *
 * E é pior do que uma falha de conformidade. Isto anda em ciclo de 75
 * segundos e só parava com o rato por cima — `:hover`, que não existe em
 * telemóvel, que é onde está a maioria de quem lê isto. Nenhum cliente
 * conseguia acabar de ler um testemunho sem o perder de vista: o activo de
 * confiança mais forte da CLYON passava de raspão.
 *
 * CADA TESTEMUNHO UMA VEZ SÓ — 28-10-2026 (d1).
 *
 * A lista ia a dobrar (a segunda com `aria-hidden`) para o ciclo não saltar à
 * vista. Quem ouvia a página já não a ouvia duas vezes, mas quem a LIA — o
 * Google, as análises de fora — contava cada testemunho a dobrar. Agora a
 * faixa vai até ao último cartão e volta para trás (globals.css), com a lista
 * uma vez só. Os textos, os nomes e quais aparecem ficam como estavam.
 */
export default function DesfileDeAvaliacoes() {
  const [parado, setParado] = useState(false);

  return (
    <div className="relative">
      {/* As margens que desvanecem nas pontas. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[#F4F8FB] to-transparent sm:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[#F4F8FB] to-transparent sm:w-32" />

      <button
        type="button"
        onClick={() => setParado((p) => !p)}
        aria-pressed={parado}
        className="absolute -top-14 right-0 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-[#E2EEF3] bg-white text-tinta-fraca shadow-sm transition hover:text-acao"
      >
        {parado ? (
          <Play className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Pause className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="sr-only">
          {parado ? "Retomar o desfile de avaliações" : "Parar o desfile de avaliações"}
        </span>
      </button>

      <div className="overflow-hidden">
        <div className={`reviews-marquee flex w-max gap-4 py-2 ${parado ? "parado" : ""}`}>
          {reviews.map((review, i) => (
            <CartaoDeAvaliacao key={`${review.name}-${i}`} review={review} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Um testemunho.
 *
 * Extraído quando o desfile levava a lista duas vezes; ficou separado por
 * se ler melhor.
 */
function CartaoDeAvaliacao({
  review,
}: {
  review: { name: string; text: string; date: string };
}) {
  return (
    <article className="w-[288px] flex-shrink-0 rounded-2xl border border-[#E2EEF3] bg-white p-6 shadow-sm">
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, j) => (
          <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
        ))}
      </div>
      <blockquote className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        &ldquo;{review.text}&rdquo;
      </blockquote>
      <div className="mt-4 flex items-center gap-3 border-t border-[#E2EEF3] pt-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-acao">
          {review.name.charAt(0)}
        </div>
        <div>
          <div className="text-sm font-semibold text-tinta">{review.name}</div>
          <div className="text-xs text-tinta-fraca">{review.date}</div>
        </div>
      </div>
    </article>
  );
}
