"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

type FAQCategory = {
  category: string;
  questions: { q: string; a: string }[];
};

/*
 * UM CAMINHO INTERNO NO TEXTO VIRA LIGAÇÃO — 30-09-2026.
 *
 * As respostas são texto simples porque o schema FAQPage lê as mesmas
 * strings: pôr JSX lá dentro obrigava a duas versões de cada resposta, e duas
 * versões divergem. Assim a resposta diz «explicamos em /recolha-gratuita-…»,
 * o Google lê isso, e quem está no ecrã carrega.
 *
 * Só apanha um caminho que comece depois de um espaço (ou no início): o
 * «clyon.pt/simulador» e o «T0/T1» ficam como estão.
 */
const CAMINHO_INTERNO = /(^|\s)(\/[a-z0-9-]+(?:\/[a-z0-9-]+)*)/g;

function comLigacoes(texto: string): ReactNode[] {
  const partes: ReactNode[] = [];
  let desde = 0;
  for (const m of texto.matchAll(CAMINHO_INTERNO)) {
    const inicio = (m.index ?? 0) + m[1].length;
    partes.push(texto.slice(desde, inicio));
    partes.push(
      <Link
        key={inicio}
        href={m[2]}
        className="font-semibold text-acao underline-offset-4 hover:underline"
      >
        {m[2]}
      </Link>,
    );
    desde = inicio + m[2].length;
  }
  partes.push(texto.slice(desde));
  return partes;
}

export default function FAQClient({ categories }: { categories: FAQCategory[] }) {
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  return (
    <section className="bg-slate-50 py-16 lg:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="space-y-10">
          {categories.map((cat) => (
            <div key={cat.category}>
              <div className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-acao">
                {cat.category}
              </div>
              <div className="mt-4 space-y-3">
                {cat.questions.map((faq, idx) => {
                  const key = `${cat.category}-${idx}`;
                  const isOpen = openIndex === key;

                  return (
                    <div
                      key={key}
                      className="overflow-hidden rounded-[26px] border border-cyan-100 bg-white shadow-[0_18px_40px_-34px_rgba(14,116,144,0.16)]"
                    >
                      <button
                        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-cyan-50/70"
                        onClick={() => setOpenIndex(isOpen ? null : key)}
                      >
                        <span className="text-base font-semibold leading-7 text-slate-950">
                          {faq.q}
                        </span>
                        <ChevronDown
                          className={`h-5 w-5 flex-shrink-0 text-acao transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="border-t border-cyan-100 px-6 pb-5 pt-4 text-sm leading-8 text-slate-600">
                          {comLigacoes(faq.a)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
