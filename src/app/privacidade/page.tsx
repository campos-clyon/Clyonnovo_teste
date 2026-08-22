import type { Metadata } from "next";
import Link from "next/link";

import { BUSINESS_EMAIL, BUSINESS_NAME, BUSINESS_PHONE, SITE_URL } from "@/lib/seo-data";
import { linhaDeIdentificacao } from "@/lib/identificacao-legal";

export const metadata: Metadata = {
  title: "Política de Privacidade — Recolha de Móveis e Esvaziamento",
  description:
    "Política de privacidade da CLYON: como tratamos os dados dos clientes que pedem recolha de móveis, esvaziamento de casa, recolha de entulho ou mudanças em Lisboa, Margem Sul e Setúbal. Direitos ao abrigo do RGPD.",
  alternates: { canonical: `${SITE_URL}/privacidade` },
  robots: { index: true, follow: true },
};

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(135deg,#ecfeff_0%,#ffffff_42%,#f8fafc_100%)]">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-24 sm:px-6 lg:px-8 lg:pb-16">
          <div className="inline-flex items-center rounded-full border border-cyan-200 bg-white/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-acao shadow-sm">
            Informação Legal
          </div>
          <h1 className="mt-5 max-w-4xl text-[2.4rem] font-bold leading-[1.05] tracking-tight text-slate-950 sm:text-[3.6rem]">
            Política de Privacidade
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
            A {BUSINESS_NAME} respeita a privacidade dos clientes que contactam o site para pedir
            <strong> recolha de móveis</strong>, <strong>esvaziamento de casa</strong>,
            <strong> recolha de entulho</strong> ou <strong>mudanças</strong> em Lisboa, Margem Sul e
            Setúbal. Esta política explica que dados recolhemos, para que os usamos e quais os seus
            direitos ao abrigo do Regulamento Geral sobre a Proteção de Dados (RGPD).
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Última atualização: 21 de agosto de 2026.
          </p>
        </div>
      </section>

      {/* ── Índice rápido ── */}
      <section className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-acao">Navegação rápida</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ["#responsavel", "1. Responsável pelo tratamento"],
              ["#dados", "2. Que dados recolhemos"],
              ["#finalidade", "3. Para que servem os dados"],
              ["#base-legal", "4. Base legal do tratamento"],
              ["#partilha", "5. Com quem partilhamos"],
              ["#conservacao", "6. Prazo de conservação"],
              ["#direitos", "7. Os seus direitos (RGPD)"],
              ["#seguranca", "8. Segurança dos dados"],
              ["#cookies", "9. Cookies"],
              ["#contacto", "10. Contacto"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="text-sm text-acao hover:text-cyan-900 hover:underline"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Corpo ── */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <PolicySection
            id="responsavel"
            title="1. Responsável pelo tratamento"
            body={
              <>
                O responsável pelo tratamento dos dados é{" "}
                <strong>{linhaDeIdentificacao()}</strong>.
                <br />
                <br />
                A CLYON opera uma plataforma que <strong>liga clientes a
                profissionais independentes</strong> — recolha de móveis,
                esvaziamento de casas e apartamentos, recolha de entulho,
                recolha de monos e mudanças em Lisboa, Margem Sul e Setúbal.
                Quem executa o trabalho e emite a fatura é o profissional que o
                cliente escolher, e não a CLYON.
                <br />
                <br />
                Isto tem uma consequência que interessa: quando contrata um
                profissional, os dados necessários ao trabalho passam para ele,
                e a partir desse momento{" "}
                <strong>ele é responsável autónomo por esses dados</strong> —
                não é nosso subcontratante, e responde por eles perante si.
                <br />
                <br />
                <strong>Contactos:</strong>
                <br />
                Telefone: {BUSINESS_PHONE}
                <br />
                Email: {BUSINESS_EMAIL}
                <br />
                Site: {SITE_URL}
              </>
            }
          />

          <PolicySection
            id="dados"
            title="2. Que dados recolhemos"
            body={
              <>
                Recolhemos apenas os dados necessários para pôr um pedido à
                frente dos profissionais certos e acompanhar o que se combina.
                De quem pede um serviço:
                <ul className="mt-3 list-disc space-y-1.5 pl-5">
                  <li>
                    <strong>Dados de identificação:</strong> nome, telefone, email.
                  </li>
                  <li>
                    <strong>Dados do serviço:</strong> morada de recolha ou esvaziamento, tipo de
                    móveis a recolher, volume estimado, número de andar, existência de elevador,
                    data pretendida.
                  </li>
                  <li>
                    <strong>Fotos e descrições:</strong> imagens e descrições enviadas
                    voluntariamente para orçamento de recolha ou esvaziamento.
                  </li>
                  <li>
                    <strong>Dados de facturação (opcionais):</strong> NIF e morada de facturação
                    quando o cliente solicita recibo ou factura.
                  </li>
                  <li>
                    <strong>Dados técnicos:</strong> endereço IP, tipo de browser, páginas
                    visitadas — recolhidos automaticamente para análise agregada.
                  </li>
                </ul>
              </>
            }
          />

          <PolicySection
            id="finalidade"
            title="3. Para que servem os dados"
            body={
              <>
                Os dados recolhidos são utilizados exclusivamente para:
                <ul className="mt-3 list-disc space-y-1.5 pl-5">
                  <li>Calcular a estimativa automática a partir do que nos descreve.</li>
                  <li>
                    Mostrar o pedido aos profissionais que trabalham na sua zona e
                    fazem esse tipo de serviço — <strong>sem a morada exata nem
                    o seu contacto</strong>, que só passam depois de contratar.
                  </li>
                  <li>Gerir as propostas, as contrapropostas e o registo do que foi combinado.</li>
                  <li>Comunicar consigo por email, telefone ou WhatsApp sobre o pedido.</li>
                  <li>
                    Passar ao profissional que contratar a morada e o contacto, para
                    ele poder lá chegar e falar consigo.
                  </li>
                  <li>Faturar a taxa de plataforma e cumprir as obrigações contabilísticas dela.</li>
                  <li>Guardar as avaliações, sem identificar quem as escreveu.</li>
                  <li>Melhorar o serviço através da análise agregada da utilização do site.</li>
                  <li>Responder a reclamações e ajudar a resolver desacordos.</li>
                </ul>
                Não usamos os dados para publicidade a terceiros nem os vendemos.
              </>
            }
          />

          <PolicySection
            id="base-legal"
            title="4. Base legal do tratamento"
            body={
              <>
                Tratamos os dados ao abrigo das seguintes bases legais previstas no RGPD:
                <ul className="mt-3 list-disc space-y-1.5 pl-5">
                  <li>
                    <strong>Execução de contrato</strong> — quando o cliente pede orçamento e contrata
                    o serviço de recolha ou esvaziamento.
                  </li>
                  <li>
                    <strong>Obrigação legal</strong> — para facturação, contabilidade e requisitos
                    fiscais.
                  </li>
                  <li>
                    <strong>Consentimento</strong> — para cookies opcionais (analítica e marketing) e
                    para comunicações comerciais.
                  </li>
                  <li>
                    <strong>Interesse legítimo</strong> — para segurança do site, prevenção de
                    fraude e melhoria contínua do serviço.
                  </li>
                </ul>
              </>
            }
          />

          <PolicySection
            id="partilha"
            title="5. Com quem partilhamos os dados"
            body={
              <>
                Os dados dos clientes são partilhados apenas com:
                <ul className="mt-3 list-disc space-y-1.5 pl-5">
                  <li>
                    <strong>Profissionais independentes</strong> que respondem ao pedido. Antes de os
                    contratar veem a zona, as fotografias e o valor que indicou — nunca a morada
                    exata nem o seu contacto, que só passam depois de os escolher.
                  </li>
                  <li>
                    <strong>Alojamento e base de dados</strong> — Vercel (alojamento do site) e
                    Railway (base de dados), ambos na União Europeia.
                  </li>
                  <li>
                    <strong>Envio de email</strong> — Resend, para lhe enviar o link do pedido e os
                    avisos de propostas.
                  </li>
                  <li>
                    <strong>Comunicação</strong> — WhatsApp Business (Meta), quando fala connosco por
                    essa via.
                  </li>
                  <li>
                    <strong>Mapas e moradas</strong> — Google Maps e OpenStreetMap/Nominatim, para
                    sugerir a morada e calcular distâncias.
                  </li>
                  <li>
                    <strong>Medição e publicidade</strong> — Google Analytics, Google Ads e Vercel
                    Analytics. <strong>Só carregam se aceitar</strong> os cookies de analítica ou de
                    marketing; se recusar, ou enquanto não responder ao aviso de cookies, não são
                    carregados de todo.
                  </li>
                  <li>
                    <strong>Contabilidade e autoridades fiscais</strong> — quando aplicável para
                    cumprimento de obrigações legais.
                  </li>
                </ul>
                Não vendemos dados a terceiros nem partilhamos com fins de marketing externo.
              </>
            }
          />

          <PolicySection
            id="conservacao"
            title="6. Prazo de conservação"
            body={
              <>
                Os dados são conservados apenas pelo tempo necessário:
                <ul className="mt-3 list-disc space-y-1.5 pl-5">
                  <li>
                    <strong>Pedidos de orçamento não convertidos:</strong> 12 meses.
                  </li>
                  <li>
                    <strong>Clientes com serviço executado:</strong> até 10 anos (obrigação fiscal
                    portuguesa).
                  </li>
                  <li>
                    <strong>Dados de facturação:</strong> 10 anos, conforme legislação em vigor.
                  </li>
                  <li>
                    <strong>Cookies e dados de navegação:</strong> conforme indicado na política de
                    cookies.
                  </li>
                </ul>
              </>
            }
          />

          <PolicySection
            id="direitos"
            title="7. Os seus direitos ao abrigo do RGPD"
            body={
              <>
                Como titular dos dados, tem direito a:
                <ul className="mt-3 list-disc space-y-1.5 pl-5">
                  <li>
                    <strong>Aceder</strong> aos dados que temos sobre si.
                  </li>
                  <li>
                    <strong>Rectificar</strong> dados incorretos ou desatualizados.
                  </li>
                  <li>
                    <strong>Apagar</strong> os dados (direito ao esquecimento), quando aplicável.
                  </li>
                  <li>
                    <strong>Limitar</strong> ou <strong>opor-se</strong> ao tratamento em situações
                    específicas.
                  </li>
                  <li>
                    <strong>Portabilidade</strong> — receber os dados num formato estruturado.
                  </li>
                  <li>
                    <strong>Retirar o consentimento</strong> a qualquer momento, quando o tratamento
                    se baseia nele.
                  </li>
                  <li>
                    <strong>Reclamar</strong> junto da <a
                      href="https://www.cnpd.pt"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-acao hover:underline"
                    >
                      Comissão Nacional de Proteção de Dados (CNPD)
                    </a>.
                  </li>
                </ul>
                Para exercer estes direitos envie um email para <strong>{BUSINESS_EMAIL}</strong>. Respondemos
                em até 30 dias.
              </>
            }
          />

          <PolicySection
            id="seguranca"
            title="8. Segurança dos dados"
            body={
              <>
                Adoptamos medidas técnicas e organizativas para proteger os dados: comunicações
                encriptadas (HTTPS), acesso restrito às bases de dados, cópias de segurança
                periódicas e formação das equipas em proteção de dados. Ainda assim, nenhum sistema
                é 100% imune — recomendamos que não envie dados sensíveis por canais não seguros.
              </>
            }
          />

          <PolicySection
            id="cookies"
            title="9. Cookies"
            body={
              <>
                O uso de cookies no site clyon.pt está descrito em detalhe na{" "}
                <Link href="/cookies" className="text-acao hover:underline">
                  Política de Cookies
                </Link>
                . Pode aceitar, recusar ou personalizar as suas preferências no banner apresentado à
                entrada do site.
              </>
            }
          />

          <PolicySection
            id="contacto"
            title="10. Contacto"
            body={
              <>
                Para qualquer dúvida sobre esta política ou sobre o tratamento dos seus dados
                pessoais:
                <br />
                <br />
                <strong>Email:</strong> {BUSINESS_EMAIL}
                <br />
                <strong>Telefone / WhatsApp:</strong> {BUSINESS_PHONE}
                <br />
                <br />
                Serviços cobertos por esta política:{" "}
                <Link href="/recolha-de-moveis" className="text-acao hover:underline">
                  recolha de móveis
                </Link>
                ,{" "}
                <Link href="/esvaziamento-de-casas" className="text-acao hover:underline">
                  esvaziamento de casa
                </Link>
                ,{" "}
                <Link href="/recolha-de-entulho" className="text-acao hover:underline">
                  recolha de entulho
                </Link>
                ,{" "}
                <Link href="/recolha-de-monos" className="text-acao hover:underline">
                  recolha de monos
                </Link>{" "}
                e{" "}
                <Link href="/mudancas" className="text-acao hover:underline">
                  mudanças
                </Link>{" "}
                em Lisboa, Margem Sul e Setúbal.
              </>
            }
          />
        </div>
      </section>
    </div>
  );
}

function PolicySection({
  id,
  title,
  body,
}: {
  id: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-[28px] border border-cyan-100 bg-white p-7 shadow-[0_20px_50px_-38px_rgba(14,116,144,0.16)]"
    >
      <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
      <div className="mt-4 text-base leading-8 text-slate-600">{body}</div>
    </section>
  );
}
