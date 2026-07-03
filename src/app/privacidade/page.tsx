import type { Metadata } from "next";

import { SITE_URL } from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Privacidade e Cookies",
  description: "Informação sobre privacidade, cookies e preferências de consentimento no site da CLYON.",
  alternates: {
    canonical: `${SITE_URL}/privacidade`,
  },
};

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(135deg,#ecfeff_0%,#ffffff_42%,#f8fafc_100%)]">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-24 sm:px-6 lg:px-8 lg:pb-16">
          <div className="inline-flex items-center rounded-full border border-cyan-200 bg-white/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700 shadow-sm">
            Privacidade
          </div>
          <h1 className="mt-5 max-w-4xl text-[2.6rem] font-bold leading-[1.03] tracking-tight text-slate-950 sm:text-[4rem]">
            Política de privacidade e cookies
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
            Esta página resume como o site da CLYON utiliza cookies essenciais, preferências de consentimento e
            categorias opcionais como analítica e marketing.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <PolicySection
            title="1. Cookies necessários"
            body="São usados para garantir funções básicas do site, navegação, segurança, preferências essenciais e funcionamento de componentes internos. Estes cookies não podem ser desactivados no painel."
          />
          <PolicySection
            title="2. Cookies de analítica"
            body="Destinam-se a medir visitas, desempenho das páginas e comportamento de navegação. Só devem ser activados quando o utilizador os aceita expressamente."
          />
          <PolicySection
            title="3. Cookies de marketing"
            body="Podem ser usados em campanhas, remarketing e medição publicitária. Actualmente o sistema de consentimento já está preparado para esta categoria, mesmo que nem todas as integrações estejam activas."
          />
          <PolicySection
            title="4. Gestão do consentimento"
            body="O utilizador pode aceitar, recusar ou personalizar os cookies opcionais no banner apresentado no site. As preferências podem voltar a ser alteradas através do botão de cookies disponível no ecrã."
          />
        </div>
      </section>
    </div>
  );
}

function PolicySection({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-[28px] border border-cyan-100 bg-white p-7 shadow-[0_20px_50px_-38px_rgba(14,116,144,0.16)]">
      <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
      <p className="mt-4 text-base leading-8 text-slate-600">{body}</p>
    </section>
  );
}
