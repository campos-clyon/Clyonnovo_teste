import { EXTRAS_DA_MUDANCA, PRECO_DA_MUDANCA_POR_EXTENSO } from "@/lib/tabela-das-mudancas";
import type { Metadata } from "next";
import { jsonLd } from "@/lib/json-ld";
import { og } from "@/lib/open-graph";
import Link from "next/link";

import FAQClient from "./FAQClient";
import { PERGUNTAS_FREQUENTES } from "@/lib/perguntas-frequentes";
import {
  AVALIACOES,
  MES_DAS_CONTAGENS,
  COMO_SE_PAGA,
  FACTURA_EM_PALAVRAS,
  NOTA_DE_PRECO,
  PRAZO_DE_RESPOSTA,
} from "@/lib/seo-data";
import { PRECOS, etiquetaDoEsvaziamento } from "@/lib/precos-publicos";
import { IDENTIFICACAO } from "@/lib/identificacao-legal";
import { NO_MESMO_DIA, PROMESSA_DO_PRAZO } from "@/lib/promessas-publicas";

export const metadata: Metadata = {
  title: "FAQ — Recolha de Móveis e Esvaziamento de Casa",
  // Até 155 caracteres, o essencial primeiro e sem frases cortadas: o
  // Google mostra uns 155 e corta o resto a meio (29-09-2026).
  description:
    "Perguntas frequentes sobre recolha de móveis e esvaziamento de casas em Lisboa, Margem Sul e Setúbal: quanto custa, prazos, zonas e como funciona.",
  alternates: { canonical: "https://clyon.pt/faq" },
  openGraph: og({
    title: "FAQ — Recolha de Móveis e Esvaziamento de Casa",
    description:
      "Tudo sobre recolha de móveis, esvaziamento de casas e apartamentos em Lisboa, Margem Sul e Setúbal. Preços, prazos e funcionamento.",
    url: "https://clyon.pt/faq",
  }),
};

/*
 * AS RESPOSTAS FORAM REESCRITAS A 30-09-2026, na voz da plataforma.
 *
 * Falavam de uma empresa que já não existe: "a equipa avalia no local", "temos
 * equipas baseadas na Margem Sul", "trabalhamos todos os dias", "orçamento em
 * menos de 1 hora", "a fatura é emitida pelo profissional", "aceitamos MB Way,
 * Revolut e Novo Banco, após o serviço". Quem faz o trabalho é o profissional
 * que o cliente escolher; a CLYON confere o pedido, guarda o que se combinou e
 * atende quando alguma coisa corre mal.
 *
 * O ecrã e o schema FAQPage lêem esta MESMA lista (ver o fim do ficheiro), por
 * isso o Google vê exactamente o que se lê. O prazo, a nota do preço, a forma
 * de pagar e a factura vêm das constantes de seo-data.ts — as mesmas das
 * outras páginas.
 */
const faqCategories = PERGUNTAS_FREQUENTES;

export const revalidate = 86400;

export default function FAQPage() {
  const allQuestions = faqCategories.flatMap((cat) => cat.questions);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero ── */}
      <section className="sob-o-menu relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(90deg,rgba(236,254,255,0.95)_0%,rgba(255,255,255,1)_52%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-24 sm:px-6 lg:px-8 lg:pb-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-acao">
                Central de ajuda
              </p>
              <h1 className="mt-4 max-w-[17ch] text-[2.4rem] font-bold leading-[1.06] tracking-tight text-slate-950 sm:text-[3.6rem]">
                Recolha de móveis e esvaziamento — tudo o que precisa de saber
              </h1>
            </div>
            <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.2)]">
              <p className="text-base leading-8 text-slate-600">
                Respondemos às perguntas mais comuns sobre recolha de móveis,
                monos e esvaziamento de casas e apartamentos em Lisboa, Margem
                Sul e Setúbal. Preços, prazos, zonas e funcionamento.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Recolha de móveis", "Esvaziamento de casa", "Preços", "Zonas"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-acao"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats rápidos ── */}
      <section className="border-y border-slate-100 bg-slate-50 py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {/* Os números vêm das constantes, e "verificadas" saiu: o que se
                confere é onde as avaliações estão (30-09-2026). */}
            {[
              { value: PRAZO_DE_RESPOSTA.curto, label: "Para receber propostas" },
              { value: String(AVALIACOES.google), label: `Avaliações no Google (${MES_DAS_CONTAGENS})` },
              { value: `${AVALIACOES.notaGoogle} ★`, label: "Nota no Google" },
              { value: "Lisboa+", label: "Margem Sul e Setúbal" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-acao">{s.value}</p>
                <p className="mt-1 text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FAQClient categories={faqCategories} />

      {/* ── CTA ── */}
      <section className="bg-white pb-16 lg:pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[34px] bg-[linear-gradient(135deg,#062737_0%,#083344_100%)] px-8 py-10 text-white shadow-[0_26px_70px_-30px_rgba(2,6,23,0.45)] lg:px-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                  Ainda com dúvidas?
                </p>
                {/* Prometia "resposta por WhatsApp em menos de 1 hora" — um
                    prazo que ninguém mede e que o resto do site não repete. O
                    horário é o de atendimento da CLYON (30-09-2026). */}
                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                  Fale connosco e ajudamos a preparar o pedido.
                </h2>
                <p className="mt-3 text-sm text-white/60">
                  Atendimento por WhatsApp de segunda a sábado, das 08:00 às 20:00.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link
                  href="/simulador"
                  className="inline-flex items-center justify-center rounded-2xl bg-acao px-7 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-acao-hover"
                >
                  Pedir orçamento grátis
                </Link>
                <Link
                  href="/contactos"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-7 py-4 text-base font-semibold text-white transition hover:bg-white/20"
                >
                  Falar connosco
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Schema.org FAQPage ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: allQuestions.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          }),
        }}
      />
    </div>
  );
}
