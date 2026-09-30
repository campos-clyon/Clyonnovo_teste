import type { Metadata } from "next";
import { og } from "@/lib/open-graph";
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
  PRAZO_DE_RESPOSTA,
  REGIONS,
  SITE_URL,
} from "@/lib/seo-data";
import { IDENTIFICACAO } from "@/lib/identificacao-legal";

/*
 * A PÁGINA QUE DIZ O QUE A CLYON É — e nunca dizia que era uma plataforma.
 *
 * Reescrita a 30-09-2026. Falava de "a equipa por trás dos serviços", "a
 * equipa vai ao local, protege acessos, recolhe", "mais execução no terreno" e
 * de limpeza pós-obra, que não é um serviço. Quem faz o trabalho é o
 * profissional que o cliente escolher; a CLYON confere os pedidos, guarda o
 * que se combina e atende quando alguma coisa corre mal.
 *
 * A identidade vem de `IDENTIFICACAO` — a mesma dos Termos e da Privacidade —
 * e não se lhe acrescenta nem história nem números que não existam.
 */

export const metadata: Metadata = {
  title: "Sobre a CLYON — Recolhas, Esvaziamentos e Mudanças",
  description:
    "A CLYON é uma plataforma que liga quem precisa de retirar móveis, entulho ou recheios, ou de mudar de casa, a profissionais verificados da sua zona.",
  alternates: {
    canonical: `${SITE_URL}/sobre-nos`,
  },
  openGraph: og({
    title: "Sobre a CLYON — Recolhas, Esvaziamentos e Mudanças",
    description:
      "Uma plataforma: recebe as propostas de profissionais verificados da sua zona, escolhe, e só confirma o trabalho quando estiver feito.",
    url: `${SITE_URL}/sobre-nos`,
  }),
};

const values = [
  "Cada pedido é lido por uma pessoa da CLYON antes de seguir para os profissionais",
  `Propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}, com o preço já com a taxa da plataforma`,
  "Quem faz o trabalho é o profissional que escolher — vê o nome e a nota dele antes",
  "Lisboa, Margem Sul e Setúbal; fora disso, depende de haver profissional disponível",
];

const clientTypes = [
  "Particulares que precisam de libertar espaço em casa",
  "Senhorios e gestores de património em trocas de inquilino",
  "Empresas e escritórios com necessidade de recolha ou esvaziamento",
  "Condomínios, obras e equipas técnicas com pedidos pontuais",
];

const processSteps = [
  "Descreve o que precisa: fotografias, morada, volume e acessos.",
  `Recebe em menos de ${PRAZO_DE_RESPOSTA.porExtenso} as propostas de profissionais verificados da sua zona, já com a taxa da plataforma, e escolhe.`,
  "O profissional que escolher vai ao local, retira e trata do destino do material.",
  "Confirma na plataforma que ficou feito — e é à CLYON que recorre se alguma coisa correr mal.",
];

const trustSignals = [
  "Profissionais verificados: cada candidatura é lida por uma pessoa da CLYON antes de a conta ser aberta",
  "Recolha de móveis, entulho e monos, esvaziamentos e mudanças",
  "Avaliações no Google e na Fixando, e trabalhos publicados",
  "Contacto direto por telefone, WhatsApp e formulário, de segunda a sábado, das 08:00 às 20:00",
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
                Menos complicação para libertar espaço.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
                A CLYON é uma plataforma: liga quem precisa de retirar móveis, entulho
                ou recheios a profissionais independentes e verificados da sua zona.
                Recebe as propostas deles, já com a taxa da plataforma, escolhe, e só
                confirma o trabalho quando estiver feito.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                {IDENTIFICACAO.nomeComercial} é o nome comercial de {IDENTIFICACAO.nomeLegal},{" "}
                {IDENTIFICACAO.formaJuridica.toLowerCase()}, NIF {IDENTIFICACAO.nif}.
              </p>
            </div>

            <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.2)]">
              <div className="mt-4 space-y-3">
                {REGIONS.map((region) => (
                  <div key={region.slug} className="flex items-start gap-3">
                    <MapPin className="mt-1 h-4 w-4 text-acao" />
                    <p className="text-sm leading-7 text-slate-600">
                      {region.name}: profissionais verificados para recolhas,
                      esvaziamentos e mudanças.
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
                <CheckCircle2 className="h-5 w-5 text-acao" />
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
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-acao shadow-sm">
                <Users className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-3xl font-bold text-slate-950">
                Quem atendemos
              </h2>
              <div className="mt-5 space-y-3">
                {clientTypes.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 text-acao" />
                    <p className="text-sm leading-7 text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[34px] border border-cyan-100 bg-white p-8 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.16)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-acao">
                <Recycle className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-3xl font-bold text-slate-950">
                Compromisso com destino responsável
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                Nem tudo o que sai de um imóvel deve seguir o mesmo destino. O que
                ainda serve pode ir para reaproveitamento ou doação; o resto tem de ir
                para um operador licenciado. Quem transporta é o profissional, e as
                regras da plataforma obrigam-no a ter as autorizações que a lei exige.
                A CLYON está registada como operador de resíduos na Agência Portuguesa
                do Ambiente, com o número {IDENTIFICACAO.codigoAPA}.
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
                Quanto mais claro for o pedido — fotografias, andar, elevador,
                quantidade —, mais certas são as propostas que recebe.
              </p>
            </div>

            <div className="space-y-4">
              {processSteps.map((step, index) => (
                <div
                  key={step}
                  className="rounded-[28px] border border-cyan-100 bg-white p-6 shadow-[0_20px_50px_-34px_rgba(14,116,144,0.16)]"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-acao text-sm font-bold text-white">
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
              {/* Dizia "Porque tantos pedidos chegam por recomendação" — uma
                  estatística que ninguém conta (30-09-2026). */}
              <h2 className="mt-4 text-3xl font-bold text-slate-950">
                Porque pode confiar.
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
                  <Phone className="mt-1 h-4 w-4 text-acao" />
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Telefone</p>
                    <p className="mt-1 text-sm leading-7 text-slate-600">{BUSINESS_PHONE}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-[22px] bg-white p-5 shadow-sm">
                  <Mail className="mt-1 h-4 w-4 text-acao" />
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Email</p>
                    <p className="mt-1 text-sm leading-7 text-slate-600">{BUSINESS_EMAIL}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-[22px] bg-white p-5 shadow-sm">
                  <MapPin className="mt-1 h-4 w-4 text-acao" />
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
                  Tem alguma coisa para tirar de casa?
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                  Descreva o pedido e receba propostas em menos de {PRAZO_DE_RESPOSTA.porExtenso},
                  consulte os preços de referência, ou fale com a equipa da CLYON.
                </p>
              </div>
              <Link
                href="/simulador"
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-7 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-cyan-300"
              >
                Pedir orçamento
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
