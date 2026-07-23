import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  Recycle,
  Sparkles,
  Users,
} from "lucide-react";

import {
  BUSINESS_ADDRESS,
  BUSINESS_EMAIL,
  BUSINESS_PHONE,
  REGIONS,
  SITE_URL,
} from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Sobre a CLYON | Recolha, Limpeza e Mudanças em Lisboa e Setúbal",
  description:
    "Conheça a CLYON, a equipa por trás dos serviços de recolha, limpeza, esvaziamentos e mudanças em Lisboa, Margem Sul e Setúbal.",
  alternates: {
    canonical: `${SITE_URL}/sobre-nos`,
  },
  openGraph: {
    title: "Sobre a CLYON | Recolha, Limpeza e Mudanças em Lisboa e Setúbal",
    description:
      "Uma equipa focada em resposta rápida, orçamento claro e encaminhamento responsável dos serviços.",
    url: `${SITE_URL}/sobre-nos`,
  },
};

const values = [
  "Resposta rápida e humana desde o primeiro contacto",
  "Orçamento claro antes da marcação",
  "Execução profissional no local com foco em cuidado",
  "Cobertura forte em Lisboa, Margem Sul e Setúbal",
];

const clientTypes = [
  "Particulares que precisam de libertar espaço em casa",
  "Senhorios e gestores de património em trocas de inquilino",
  "Empresas e escritórios com necessidade de recolha ou limpeza",
  "Condomínios, obras e equipas técnicas com pedidos pontuais",
];

const processSteps = [
  "Recebemos o pedido com fotos, morada, volume e acessos.",
  "Damos orientação rápida sobre o serviço certo e o valor esperado.",
  "A equipa vai ao local, protege acessos, recolhe e organiza a saída do material.",
  "Sempre que faz sentido, os materiais seguem para triagem, reaproveitamento ou destino responsável.",
];

const trustSignals = [
  "Atendimento em várias zonas com operação local",
  "Apoio em móveis, entulho, monos, esvaziamentos e limpeza pós-obra",
  "Prova social em avaliações reais e trabalhos publicados",
  "Contacto direto por telefone, WhatsApp e formulário",
];

export const revalidate = 86400;

export default function SobreNosPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(90deg,rgba(236,254,255,0.95)_0%,rgba(255,255,255,1)_52%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:px-8 lg:pb-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-end">
            <div>
              <h1 className="mt-5 max-w-[12ch] text-[2.65rem] font-bold leading-[1.02] tracking-tight text-slate-950 sm:text-[4.2rem]">
                Menos complicação, mais execução no terreno.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
                A CLYON nasceu para simplificar pedidos que costumam dar trabalho:
                retirar móveis velhos, recolher entulho, limpar no fim de uma obra,
                libertar espaço ou apoiar uma mudança. O foco da equipa é responder
                rápido, explicar sem ruido e executar com cuidado.
              </p>
            </div>

            <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.2)]">
              <div className="mt-4 space-y-3">
                {REGIONS.map((region) => (
                  <div key={region.slug} className="flex items-start gap-3">
                    <MapPin className="mt-1 h-4 w-4 text-cyan-600" />
                    <p className="text-sm leading-7 text-slate-600">
                      Operação ativa em {region.name} com resposta para recolhas,
                      limpezas e pedidos urgentes.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {values.map((value) => (
              <div
                key={value}
                className="rounded-[28px] border border-cyan-100 bg-white p-6 shadow-[0_20px_50px_-34px_rgba(14,116,144,0.16)]"
              >
                <CheckCircle2 className="h-5 w-5 text-cyan-600" />
                <p className="mt-4 text-sm leading-7 text-slate-700">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="rounded-[34px] border border-cyan-100 bg-cyan-50/70 p-8 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.16)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-cyan-600 shadow-sm">
                <Users className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-3xl font-bold text-slate-950">
                Quem atendemos
              </h2>
              <div className="mt-5 space-y-3">
                {clientTypes.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 text-cyan-600" />
                    <p className="text-sm leading-7 text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[34px] border border-cyan-100 bg-white p-8 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.16)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                <Recycle className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-3xl font-bold text-slate-950">
                Compromisso com destino responsável
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                Nem tudo o que sai de um imóvel deve seguir o mesmo destino. Sempre
                que o estado dos materiais o permite, a equipa faz separação e triagem
                para reaproveitamento, doação ou encaminhamento adequado. Esse cuidado
                reduz desperdício e melhora a qualidade do serviço para quem pede uma
                solução completa.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <h2 className="mt-4 text-4xl font-bold leading-tight text-slate-950">
                Um processo simples do pedido até ao espaço livre.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
                A operação foi desenhada para reduzir dúvidas e acelerar a marcação.
                Quanto mais claro for o pedido, mais rápido a CLYON consegue validar
                disponibilidade, prever acessos e fechar o serviço certo.
              </p>
            </div>

            <div className="space-y-4">
              {processSteps.map((step, index) => (
                <div
                  key={step}
                  className="rounded-[28px] border border-cyan-100 bg-white p-6 shadow-[0_20px_50px_-34px_rgba(14,116,144,0.16)]"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <p className="pt-1 text-sm leading-7 text-slate-600">{step}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.98fr_1.02fr]">
            <div className="rounded-[34px] border border-cyan-100 bg-white p-8 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.16)]">
              <h2 className="mt-4 text-3xl font-bold text-slate-950">
                Porque tantos pedidos chegam por recomendação.
              </h2>
              <div className="mt-6 space-y-3">
                {trustSignals.map((item) => (
                  <div key={item} className="rounded-[22px] border border-cyan-100 bg-cyan-50/70 px-4 py-4">
                    <p className="text-sm leading-7 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[34px] border border-cyan-100 bg-cyan-50/70 p-8 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.16)]">
              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3 rounded-[22px] bg-white p-5 shadow-sm">
                  <Phone className="mt-1 h-4 w-4 text-cyan-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Telefone</p>
                    <p className="mt-1 text-sm leading-7 text-slate-600">{BUSINESS_PHONE}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-[22px] bg-white p-5 shadow-sm">
                  <Mail className="mt-1 h-4 w-4 text-cyan-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Email</p>
                    <p className="mt-1 text-sm leading-7 text-slate-600">{BUSINESS_EMAIL}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-[22px] bg-white p-5 shadow-sm">
                  <MapPin className="mt-1 h-4 w-4 text-cyan-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Morada</p>
                    <p className="mt-1 text-sm leading-7 text-slate-600">{BUSINESS_ADDRESS}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/avaliacoes" className="site-btn-secondary px-6">
                  Ver avaliações
                </Link>
                <Link href="/trabalhos" className="site-btn-secondary px-6">
                  Ver trabalhos
                </Link>
                <Link href="/precos" className="site-btn-primary px-6">
                  Ver preços
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white pb-16 lg:pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[34px] bg-[linear-gradient(135deg,#062737_0%,#083344_100%)] px-8 py-10 text-white shadow-[0_26px_70px_-30px_rgba(2,6,23,0.45)] lg:px-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 text-cyan-200">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm font-semibold uppercase tracking-[0.2em]">
                    Próximo passo
                  </span>
                </div>
                <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
                  Quer trabalhar connosco no seu próximo pedido?
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                  Pode começar pelo simulador, consultar preços orientativos ou falar
                  diretamente com a equipa para validar disponibilidade.
                </p>
              </div>
              <Link
                href="/simulador"
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-7 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-cyan-300"
              >
                Simular orçamento
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
