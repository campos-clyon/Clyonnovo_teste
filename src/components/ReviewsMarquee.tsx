"use client";

import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import type { Review } from "@/lib/reviews-data";

/**
 * Desfile contínuo de avaliações.
 *
 * O loop sem costura precisa da lista repetida duas vezes, mas repetir no HTML
 * servido faz com que os motores de busca vejam cada testemunho duas vezes
 * (o relatório de SEO acusava 22 duplicados de texto nesta página). Por isso a
 * cópia só entra no DOM depois de montar no browser: o crawler lê uma lista,
 * o utilizador vê a animação completa.
 */
export function ReviewsMarquee({ reviews }: { reviews: Review[] }) {
  const [duplicado, setDuplicado] = useState(false);
  const jaCorreu = useRef(false);

  useEffect(() => {
    if (jaCorreu.current) return;
    jaCorreu.current = true;
    setDuplicado(true);
  }, []);

  const cartoes = duplicado ? [...reviews, ...reviews] : reviews;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[#F4F8FB] to-transparent sm:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[#F4F8FB] to-transparent sm:w-32" />
      <div className="overflow-hidden">
        <div className={`flex w-max gap-4 py-2 ${duplicado ? "reviews-marquee" : ""}`}>
          {cartoes.map((review, i) => (
            <article
              key={i}
              aria-hidden={i >= reviews.length ? true : undefined}
              className="w-[288px] flex-shrink-0 rounded-2xl border border-[#E2EEF3] bg-white p-6 shadow-sm"
            >
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <blockquote className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                &ldquo;{review.text}&rdquo;
              </blockquote>
              <div className="mt-4 flex items-center gap-3 border-t border-[#E2EEF3] pt-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-700">
                  {review.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#0B1929]">{review.name}</div>
                  <div className="text-xs text-slate-400">{review.date}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
