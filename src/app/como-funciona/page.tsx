import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  HandCoins,
  MessageCircle,
  Truck,
  UserCheck,
} from "lucide-react";

import { BUSINESS_PHONE, COMO_SE_PAGA, PRAZO_DE_RESPOSTA, SITE_URL } from "@/lib/seo-data";
import { DIAS_ATE_LIBERTAR_SOZINHO } from "@/lib/trabalho";

/*
 * ESTA PÁGINA DESCREVIA O MODELO ANTIGO — reescrita a 30-09-2026.
 *
 * "Preço fixo por IA em segundos", "atribuído a um profissional", "sem
 * negociação", "normalmente em menos de 2 horas". Nada disso acontece: o
 * cliente não vê estimativa nenhuma desde 18-09-2026
 * (sem-estimativa-para-o-cliente.test.ts), o preço é o da proposta de cada
 * profissional, e é o cliente quem escolhe — pode aceitar, contrapropor ou
 * não responder.
 *
 * O QUE CONTINUA VERDADE, e por isso ficou: nenhum pedido chega aos
 * profissionais sem uma pessoa da CLYON o conferir. A rota do cliente não
 * distribui; o pedido fica no «portão da análise» até alguém carregar em
 * «Enviar aos profissionais» no backoffice (portao-da-analise.test.ts), e o
 * cron do alcance só trata pedidos que já foram enviados.
 */

export const metadata: Metadata = {
  title: "Como Funciona — Pede, Recebe Propostas, Escolhe",
  description:
    "Descreva o que precisa e receba em até 6 horas propostas de profissionais verificados da sua zona, já com a taxa da plataforma. Escolhe a que quiser e só confirma o trabalho quando estiver feito.",
  alternates: {
    canonical: `${SITE_URL}/como-funciona`,
  },
  openGraph: {
    title: "Como Funciona — Pede, Recebe Propostas, Escolhe",
    description:
      "Descreva o que precisa e receba em até 6 horas propostas de profissionais verificados da sua zona, já com a taxa da plataforma. Escolhe a que quiser e só confirma o trabalho quando estiver feito.",
    url: `${SITE_URL}/como-funciona`,
  },
};

const stages = [
  {
    step: "01",
    title: "Descreve o que precisa",
    icon: ClipboardList,
    accent: "cyan" as const,
    description:
      "No formulário ou por WhatsApp: o que é para levar ou fazer, fotografias, a morada e as condições de acesso — andar, elevador, estacionamento. E escolhe como prefere pagar: pela plataforma ou em dinheiro, ao profissional.",
  },
  {
    step: "02",
    title: "Recebe propostas",
    icon: HandCoins,
    accent: "premium" as const,
    description:
      /*
       * A morada exacta e o contacto só passam depois de contratar: os campos
       * que o profissional vê antes disso são uma lista fechada
       * (CAMPOS_VISIVEIS_AO_PROFISSIONAL, em pedido-valores.ts), com a zona e
       * sem morada nem telefone.
       */
      `O pedido chega a profissionais verificados que fazem esse serviço e cuja zona alcança a sua morada — sem a morada exacta nem o seu contacto, que só passam depois de escolher. Cada proposta mostra o preço já com a taxa da plataforma, sem IVA, e chegam em até ${PRAZO_DE_RESPOSTA.porExtenso}. Pode aceitar, contrapropor ou simplesmente não responder.`,
  },
  {
    step: "03",
    title: "Escolhe",
    icon: UserCheck,
    accent: "cyan" as const,
    description: `Aceita a que quiser — ou nenhuma, sem custo. ${COMO_SE_PAGA}`,
  },
  {
    step: "04",
    title: "Confirma que ficou feito",
    icon: Truck,
    accent: "cyan" as const,
    description:
      /*
       * O prazo do silêncio é o de trabalho.ts: sem resposta do cliente, o
       * trabalho fecha sozinho ao fim desses dias a contar da prova. Dizer só
       * «quando confirmar» esconderia metade da regra.
       */
      `O profissional faz o trabalho no dia combinado e envia fotografias do resultado. Confirma na plataforma que está tudo bem — no pagamento pela plataforma, só então o valor é entregue ao profissional. Se não disser nada, o trabalho dá-se por concluído ${DIAS_ATE_LIBERTAR_SOZINHO} dias depois das fotografias.`,
  },
];

/*
 * O que a pessoa da CLYON faz mesmo antes de enviar o pedido — o que está na
 * rota (`À espera da análise da CLYON`) e no bloco «Por enviar» do
 * backoffice: conferir e completar a informação, e só então enviar. Não põe
 * preço: o preço é de cada profissional.
 */
const assistantRules = [
  "Confere se a descrição, as fotografias e a morada chegam para um profissional dar um valor a sério.",
  "Completa o que faltar — o andar, uma fotografia, a quantidade —, perguntando-lhe se for preciso.",
  "Só então envia o pedido aos profissionais que fazem esse serviço e cuja zona alcança a sua morada.",
  "Acompanha o pedido até ao fim, e é a quem recorre se alguma coisa correr mal.",
];

export const revalidate = 86400;

export default function ComoFuncionaPage() {
  const whatsappNumber = BUSINESS_PHONE.replace(/[^\d]/g, "");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    "Olá! Tenho uma dúvida sobre como funciona a CLYON.",
  )}`;

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(90deg,rgba(236,254,255,0.95)_0%,rgba(255,255,255,1)_52%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-22 sm:px-6 lg:px-8 lg:pb-16">
          <div className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold uppercase tracking-[0.22em] text-acao shadow-sm">
            Como funciona
          </div>
          <h1 className="mt-5 max-w-[18ch] text-[2.4rem] font-bold leading-[1.05] tracking-tight text-slate-950 sm:text-[3.4rem]">
            Pede, recebe propostas, escolhe.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
            A CLYON é uma plataforma: liga-o a profissionais independentes e
            verificados da sua zona. Quem faz o trabalho é o profissional que
            escolher — a CLYON confere o pedido antes de o enviar, guarda o que
            ficou combinado e acompanha até ao fim.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/simulador" className="site-btn-primary px-6">
              Pedir orçamento grátis
            </Link>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="site-btn-secondary px-6">
              <MessageCircle className="mr-2 h-4 w-4" />
              Tirar dúvidas por WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {stages.map((stage, index) => (
              <div key={stage.step} className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="absolute -top-4 left-8 flex h-8 w-8 items-center justify-center rounded-full bg-acao text-sm font-bold text-white">
                  {index + 1}
                </div>
                <div
                  className={`mt-4 flex h-14 w-14 items-center justify-center rounded-xl ${
                    stage.accent === "premium" ? "bg-violet-50" : "bg-cyan-50"
                  }`}
                >
                  <stage.icon className={`h-7 w-7 ${stage.accent === "premium" ? "text-violet-600" : "text-acao"}`} />
                </div>
                <h2 className="mt-5 text-xl font-bold text-slate-900">{stage.title}</h2>
                <p className="mt-3 text-base leading-relaxed text-slate-600">{stage.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-acao">
              Quem confere antes de avançar
            </div>
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
              Nenhum pedido avança sem revisão humana
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600">
              O preço não é da CLYON: é de cada profissional. O que uma pessoa da CLYON
              confere é que o pedido tem o que é preciso para lhe darem um valor a sério.
            </p>
          </div>

          <div className="space-y-4">
            {assistantRules.map((rule) => (
              <div key={rule} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-acao" />
                <span className="text-sm font-medium text-slate-700">{rule}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-center sm:p-12 lg:p-16">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Pronto para experimentar?</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
              Descreva o que precisa e receba propostas de profissionais da sua zona em
              até {PRAZO_DE_RESPOSTA.porExtenso}.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/simulador" className="site-btn-primary px-8">
                Pedir orçamento grátis
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
