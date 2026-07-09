import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Clock3, Mail, MapPin, MessageCircle, Phone, Sparkles, Star } from "lucide-react";

export const metadata: Metadata = {
  title: "Contactos — Orçamento Grátis em 24h",
  description:
    "Peça orçamento grátis para recolha de entulho, móveis, limpeza pós-obra ou mudanças em Lisboa e Setúbal. Resposta em 24h, 163 avaliações 5 estrelas!",
  alternates: { canonical: "https://clyon.pt/contactos" },
  openGraph: {
    title: "Contacte a CLYON - Orçamento Grátis em 24h",
    description:
      "Peça orçamento grátis para recolha de entulho e limpezas em Lisboa e Setúbal. Resposta rápida!",
    url: "https://clyon.pt/contactos",
  },
};

export const revalidate = 86400;

export default function ContactosPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(90deg,rgba(236,254,255,0.95)_0%,rgba(255,255,255,1)_52%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-22 sm:px-6 lg:px-8 lg:pb-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.96fr] lg:items-end">
            <div>
              <div className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700 shadow-sm">
                Contactos
              </div>
              <h1 className="mt-5 max-w-[14ch] text-[2.55rem] font-bold leading-[1.02] tracking-tight text-slate-950 sm:text-[4.1rem]">
                Orçamento grátis em 24h.
              </h1>
              <p className="mt-4 max-w-lg text-base leading-8 text-slate-600">
                Use o simulador para uma estimativa imediata ou contacte-nos
                diretamente. Respondemos com rapidez e ajudamos a perceber o
                melhor caminho para avançar.
              </p>
            </div>
            <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.2)]">
              <div className="flex items-center gap-3">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-sm font-semibold text-slate-700">163 avaliações</span>
              </div>
              <p className="mt-4 text-base leading-8 text-slate-600">
                A CLYON tem 163 avaliações 5 estrelas no Fixando. Orçamento grátis,
                resposta em 24h e entrega no mesmo dia quando disponível.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            {/* Simulador */}
            <div className="flex flex-col justify-between rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.18)]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">
                  Pedir orçamento
                </p>
                <h2 className="mt-3 text-2xl font-bold text-slate-950">
                  Calcule o preço em 3 passos
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Indique o serviço, a morada e os seus dados de contacto — o
                  simulador dá-lhe uma estimativa imediata, sem compromisso.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-slate-700">
                  <li className="flex items-center gap-3">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cyan-50 text-sm font-bold text-cyan-700">1</span>
                    Escolha o serviço
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cyan-50 text-sm font-bold text-cyan-700">2</span>
                    Indique a morada e o acesso
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cyan-50 text-sm font-bold text-cyan-700">3</span>
                    Deixe o seu contacto e envie
                  </li>
                </ul>
              </div>
              <Link
                href="/simulador"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-6 py-3.5 text-base font-semibold text-white shadow-[0_18px_40px_-22px_rgba(6,182,212,0.75)] transition hover:-translate-y-0.5 hover:bg-cyan-400"
              >
                <Sparkles className="h-5 w-5" />
                <span className="text-white">Abrir simulador</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Contacto Direto */}
            <div className="space-y-6">
              <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.18)]">
                <h2 className="text-2xl font-bold text-slate-950">Contacto direto</h2>
                <div className="mt-7 space-y-6">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-cyan-700">
                        Telefone
                      </p>
                      <a href="tel:+351965785395" className="mt-2 block text-xl font-bold text-slate-950">
                        +351 965 785 395
                      </a>
                      <p className="mt-1 text-sm leading-7 text-slate-600">
                        Ideal para pedidos rápidos, validações e marcações.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-cyan-700">
                        Email
                      </p>
                      <a href="mailto:geral@clyon.pt" className="mt-2 block text-xl font-bold text-slate-950">
                        geral@clyon.pt
                      </a>
                      <p className="mt-1 text-sm leading-7 text-slate-600">
                        Para pedidos detalhados e dúvidas gerais.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-cyan-700">
                        Morada
                      </p>
                      <p className="mt-2 text-sm leading-8 text-slate-600">
                        Belverde, Amora
                        <br />
                        2845-513 Portugal
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                      <Clock3 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-cyan-700">
                        Horário
                      </p>
                      <p className="mt-2 text-sm leading-8 text-slate-600">
                        Segunda a sábado: 08:00 - 20:00
                        <br />
                        Domingo: atendimento por mensagem
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="tel:+351965785395"
                    className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-6 py-3.5 text-base font-semibold text-white shadow-[0_18px_40px_-22px_rgba(6,182,212,0.75)] transition hover:-translate-y-0.5 hover:bg-cyan-400"
                  >
                    <Phone className="mr-2 h-5 w-5" />
                    <span className="text-white">Ligar agora</span>
                  </a>
                  <a
                    href="https://wa.me/351965785395?text=Ol%C3%A1!%20Gostava%20de%20pedir%20um%20or%C3%A7amento%20%C3%A0%20CLYON."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-6 py-3.5 text-base font-semibold text-white shadow-[0_18px_40px_-22px_rgba(37,211,102,0.75)] transition hover:-translate-y-0.5 hover:bg-emerald-400"
                  >
                    <MessageCircle className="mr-2 h-5 w-5" />
                    <span className="text-white">WhatsApp</span>
                  </a>
                </div>
              </div>

              <div className="rounded-[28px] bg-[linear-gradient(135deg,#062737_0%,#083344_100%)] p-6 text-white">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  Sem compromisso
                </p>
                <h3 className="mt-3 text-2xl font-bold leading-tight">
                  Resposta em 24h, sempre.
                </h3>
                <p className="mt-3 text-sm leading-8 text-slate-300">
                  Peça o orçamento pelo simulador ou fale connosco — a nossa
                  equipa responde com rapidez e sem qualquer compromisso.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
