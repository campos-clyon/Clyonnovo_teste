import type { Metadata } from "next";
import Link from "next/link";

import { BUSINESS_EMAIL, BUSINESS_NAME, SITE_URL } from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Política de Cookies — Recolha de Móveis em Lisboa",
  description:
    "Política de cookies do site CLYON: tipos utilizados, finalidades e como gerir preferências. Aplica-se a pedidos de recolha de móveis, esvaziamento de casa, recolha de entulho e mudanças em Lisboa, Margem Sul e Setúbal.",
  alternates: { canonical: `${SITE_URL}/cookies` },
  robots: { index: true, follow: true },
};

const COOKIE_TABLE = [
  {
    name: "cookie_consent",
    type: "Necessário",
    provider: "clyon.pt",
    purpose: "Guarda a escolha do utilizador no banner de consentimento (aceitar / recusar / personalizar).",
    duration: "12 meses",
  },
  {
    name: "session_id",
    type: "Necessário",
    provider: "clyon.pt",
    purpose: "Mantém a sessão de utilizadores autenticados (clientes, colaboradores, admin).",
    duration: "Sessão",
  },
  {
    name: "_ga, _ga_*",
    type: "Analítica",
    provider: "Google Analytics",
    purpose: "Análise agregada e anónima de tráfego, páginas mais visitadas e origem dos visitantes.",
    duration: "24 meses",
  },
  {
    name: "_fbp",
    type: "Marketing",
    provider: "Meta (Facebook)",
    purpose: "Medição de campanhas publicitárias e retargeting. Só activado com consentimento.",
    duration: "3 meses",
  },
];

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(135deg,#ecfeff_0%,#ffffff_42%,#f8fafc_100%)]">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-24 sm:px-6 lg:px-8 lg:pb-16">
          <div className="inline-flex items-center rounded-full border border-cyan-200 bg-white/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700 shadow-sm">
            Informação Legal
          </div>
          <h1 className="mt-5 max-w-4xl text-[2.4rem] font-bold leading-[1.05] tracking-tight text-slate-950 sm:text-[3.6rem]">
            Política de Cookies
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
            Esta página explica quais cookies o site {BUSINESS_NAME} utiliza para prestar os serviços
            de <strong>recolha de móveis</strong>, <strong>esvaziamento de casa e apartamento</strong>,
            <strong> recolha de entulho</strong>, <strong>recolha de monos</strong> e{" "}
            <strong>mudanças</strong> em Lisboa, Margem Sul e Setúbal — e como pode gerir as suas
            preferências.
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Última actualização: 12 de julho de 2026.
          </p>
        </div>
      </section>

      {/* ── Corpo ── */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <PolicySection
            title="O que são cookies?"
            body={
              <>
                Cookies são pequenos ficheiros de texto que os sites guardam no seu dispositivo
                (computador, tablet ou telemóvel) quando visita uma página. Servem para memorizar
                preferências, manter sessões abertas, medir a utilização do site e, em alguns casos,
                mostrar publicidade relevante. No site clyon.pt usamos apenas os cookies estritamente
                necessários e os que o utilizador aceite expressamente.
              </>
            }
          />

          <PolicySection
            title="1. Cookies necessários"
            body={
              <>
                São indispensáveis para o funcionamento básico do site. Sem eles, funcionalidades
                como o simulador de orçamento, o login de colaboradores ou a memorização das suas
                preferências de consentimento deixam de funcionar. Não podem ser desactivados no
                painel de preferências.
                <br />
                <br />
                <strong>Exemplos de utilização na CLYON:</strong>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Guardar as respostas ao simulador de recolha de móveis enquanto o preenche.</li>
                  <li>Manter sessão activa na área de cliente ou de colaborador.</li>
                  <li>Registar a sua escolha no banner de cookies para não voltar a aparecer.</li>
                </ul>
              </>
            }
          />

          <PolicySection
            title="2. Cookies de analítica"
            body={
              <>
                Utilizamos ferramentas de análise (nomeadamente Google Analytics) para perceber como
                os visitantes usam o site: páginas mais visitadas, tempo médio de permanência, taxa
                de conclusão do simulador de orçamento, origem do tráfego (pesquisa, redes sociais,
                referências). Os dados são agregados e anónimos — não identificam o utilizador
                individualmente. Só são activados com o seu consentimento explícito.
                <br />
                <br />
                Estes dados ajudam-nos a melhorar a página de{" "}
                <Link href="/recolha-de-moveis" className="text-cyan-700 hover:underline">
                  recolha de móveis em Lisboa
                </Link>
                , os fluxos de{" "}
                <Link href="/esvaziamento-de-casas" className="text-cyan-700 hover:underline">
                  esvaziamento de casa
                </Link>{" "}
                e o simulador de orçamento.
              </>
            }
          />

          <PolicySection
            title="3. Cookies de marketing"
            body={
              <>
                Podem ser usados para mostrar publicidade relevante em plataformas externas
                (Facebook, Instagram, Google Ads), medir a eficácia de campanhas e evitar mostrar o
                mesmo anúncio repetidamente. Actualmente o sistema está preparado para esta
                categoria mas nem todas as integrações estão activas. Só são activados com
                consentimento explícito.
              </>
            }
          />

          <PolicySection
            title="4. Cookies de terceiros"
            body={
              <>
                Alguns serviços integrados no site definem os seus próprios cookies:
                <ul className="mt-3 list-disc space-y-1 pl-5">
                  <li>
                    <strong>Google Analytics</strong> — análise de tráfego (categoria: analítica).
                  </li>
                  <li>
                    <strong>Google Maps</strong> — mostrar mapas nas páginas de cidade (categoria:
                    necessário / funcional).
                  </li>
                  <li>
                    <strong>WhatsApp</strong> — botão de contacto directo (categoria: necessário).
                  </li>
                  <li>
                    <strong>Vercel</strong> — plataforma de alojamento e desempenho (categoria:
                    necessário).
                  </li>
                </ul>
                Estes serviços têm as suas próprias políticas de privacidade — consulte-as se
                pretender mais detalhes.
              </>
            }
          />

          {/* Tabela detalhada */}
          <section className="rounded-[28px] border border-cyan-100 bg-white p-7 shadow-[0_20px_50px_-38px_rgba(14,116,144,0.16)]">
            <h2 className="text-2xl font-bold text-slate-950">
              5. Cookies utilizados no site clyon.pt
            </h2>
            <p className="mt-3 text-sm text-slate-500">
              Lista detalhada dos principais cookies em uso. Cookies auxiliares de bibliotecas podem
              variar por sessão.
            </p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="p-3 font-semibold text-slate-700">Nome</th>
                    <th className="p-3 font-semibold text-slate-700">Tipo</th>
                    <th className="p-3 font-semibold text-slate-700">Fornecedor</th>
                    <th className="p-3 font-semibold text-slate-700">Finalidade</th>
                    <th className="p-3 font-semibold text-slate-700">Duração</th>
                  </tr>
                </thead>
                <tbody>
                  {COOKIE_TABLE.map((row) => (
                    <tr
                      key={row.name}
                      className="border-b border-slate-100 last:border-none"
                    >
                      <td className="p-3 font-mono text-xs text-slate-800">{row.name}</td>
                      <td className="p-3 text-slate-600">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            row.type === "Necessário"
                              ? "bg-cyan-50 text-cyan-700"
                              : row.type === "Analítica"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-violet-50 text-violet-700"
                          }`}
                        >
                          {row.type}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{row.provider}</td>
                      <td className="p-3 text-slate-600">{row.purpose}</td>
                      <td className="p-3 text-slate-600">{row.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <PolicySection
            title="6. Como gerir as suas preferências"
            body={
              <>
                À entrada do site é apresentado um banner onde pode:
                <ul className="mt-3 list-disc space-y-1 pl-5">
                  <li>
                    <strong>Aceitar todos</strong> — permite necessários, analítica e marketing.
                  </li>
                  <li>
                    <strong>Recusar opcionais</strong> — só ficam activos os necessários.
                  </li>
                  <li>
                    <strong>Personalizar</strong> — escolhe categoria a categoria.
                  </li>
                </ul>
                <br />
                Pode alterar as suas escolhas em qualquer momento através do botão{" "}
                <strong>&ldquo;Gerir cookies&rdquo;</strong> disponível no rodapé do site.
                <br />
                <br />
                Adicionalmente, todos os browsers permitem bloquear cookies nas suas próprias
                configurações. Ter em conta que bloquear cookies necessários pode impedir o
                funcionamento correcto do site.
              </>
            }
          />

          <PolicySection
            title="7. Alterações a esta política"
            body={
              <>
                Podemos actualizar esta política sempre que houver mudanças na tecnologia usada, nos
                fornecedores ou na legislação aplicável. Publicaremos sempre a versão em vigor
                nesta página com a data da última actualização. Recomendamos consulta periódica.
              </>
            }
          />

          <PolicySection
            title="8. Contacto e reclamações"
            body={
              <>
                Para dúvidas ou reclamações sobre esta política envie email para{" "}
                <strong>{BUSINESS_EMAIL}</strong>.
                <br />
                <br />
                Também pode consultar a nossa{" "}
                <Link href="/privacidade" className="text-cyan-700 hover:underline">
                  Política de Privacidade
                </Link>{" "}
                completa ou apresentar reclamação junto da{" "}
                <a
                  href="https://www.cnpd.pt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-700 hover:underline"
                >
                  Comissão Nacional de Protecção de Dados (CNPD)
                </a>.
              </>
            }
          />
        </div>
      </section>
    </div>
  );
}

function PolicySection({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-cyan-100 bg-white p-7 shadow-[0_20px_50px_-38px_rgba(14,116,144,0.16)]">
      <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
      <div className="mt-4 text-base leading-8 text-slate-600">{body}</div>
    </section>
  );
}
