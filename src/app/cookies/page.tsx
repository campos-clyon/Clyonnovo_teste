import type { Metadata } from "next";

import { SITE_URL } from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Política de Cookies | CLYON",
  description: "Informação detalhada sobre os cookies utilizados no site da CLYON: tipos, finalidades e como gerir as suas preferências.",
  alternates: {
    canonical: `${SITE_URL}/cookies`,
  },
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(135deg,#ecfeff_0%,#ffffff_42%,#f8fafc_100%)]">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-24 sm:px-6 lg:px-8 lg:pb-16">
          <div className="inline-flex items-center rounded-full border border-cyan-200 bg-white/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700 shadow-sm">
            Informação Legal
          </div>
          <h1 className="mt-5 max-w-4xl text-[2.6rem] font-bold leading-[1.03] tracking-tight text-slate-950 sm:text-[4rem]">
            Política de Cookies
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
            Esta página explica que cookies utilizamos, para que servem e como pode gerir as suas preferências de consentimento.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <PolicySection
            title="O que são cookies?"
            body="Cookies são pequenos ficheiros de texto que os sites guardam no seu dispositivo para memorizar preferências, sessões e informações de navegação. Alguns são essenciais para o funcionamento do site, outros ajudam-nos a melhorar a experiência."
          />
          <PolicySection
            title="Cookies necessários"
            body="São indispensáveis para o funcionamento básico do site: navegação entre páginas, segurança, preferências de idioma e componentes essenciais. Estes cookies não podem ser desactivados porque o site não funciona correctamente sem eles."
          />
          <PolicySection
            title="Cookies de analítica"
            body="Utilizamos ferramentas de análise para perceber como os visitantes usam o site: páginas mais visitadas, tempo de permanência e origem do tráfego. Estes dados são anónimos e ajudam-nos a melhorar o serviço. Só são activados com o seu consentimento."
          />
          <PolicySection
            title="Cookies de marketing"
            body="Podem ser usados para mostrar publicidade relevante, medir a eficácia de campanhas e evitar que veja o mesmo anúncio repetidamente. Actualmente, o sistema está preparado para esta categoria mas nem todas as integrações estão activas."
          />
          <PolicySection
            title="Como gerir os cookies"
            body="Quando visita o site pela primeira vez, é apresentado um banner onde pode aceitar todos os cookies, recusar os opcionais ou personalizar as suas preferências. Pode alterar as suas escolhas a qualquer momento através do botão de preferências de cookies disponível no rodapé do site."
          />
          <PolicySection
            title="Cookies de terceiros"
            body="Alguns serviços externos (como mapas, vídeos ou ferramentas de análise) podem definir os seus próprios cookies. Estes são regidos pelas políticas de privacidade das respectivas empresas. Consulte as políticas do Google, Meta ou outros serviços que utilizamos."
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
