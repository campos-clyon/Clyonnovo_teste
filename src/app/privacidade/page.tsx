import type { Metadata } from "next";
import Link from "next/link";

import { BUSINESS_EMAIL, BUSINESS_NAME, BUSINESS_PHONE, SITE_URL } from "@/lib/seo-data";
import { ENTIDADE_QUE_FACTURA, linhaDeIdentificacao } from "@/lib/identificacao-legal";
import {
  DIAS_DE_RETENCAO_DOS_PEDIDOS,
  DIAS_DOS_CONTACTOS_A_MEIO,
  DIAS_PARA_AS_RECOLHAS_DO_WHATSAPP,
  DIAS_PARA_OS_ABANDONADOS,
  MESES_ATE_ANONIMIZAR_O_ARQUIVO,
} from "@/lib/retencao";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  // Até 155 caracteres, o essencial primeiro e sem frases cortadas: o
  // Google mostra uns 155 e corta o resto a meio (29-09-2026).
  description:
    "Como a CLYON trata os dados de quem pede recolhas, esvaziamentos ou mudanças em Lisboa, Margem Sul e Setúbal, e os seus direitos ao abrigo do RGPD.",
  alternates: { canonical: `${SITE_URL}/privacidade` },
  robots: { index: true, follow: true },
};

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero ── */}
      <section className="sob-o-menu relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(135deg,#ecfeff_0%,#ffffff_42%,#f8fafc_100%)]">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-24 sm:px-6 lg:px-8 lg:pb-16">
          <h1 className="max-w-4xl text-[2.4rem] font-bold leading-[1.05] tracking-tight text-slate-950 sm:text-[3.6rem]">
            Política de Privacidade
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
            A {BUSINESS_NAME} respeita a privacidade dos clientes que contactam o site para pedir
            <strong> recolha de móveis</strong>, <strong>esvaziamento de casa</strong>,
            <strong> recolha de entulho</strong> ou <strong>mudanças</strong> em Lisboa, Margem Sul e
            Setúbal. Esta política explica que dados recolhemos, para que os usamos e quais os seus
            direitos ao abrigo do Regulamento Geral sobre a Proteção de Dados (RGPD). Os
            profissionais parceiros que usam a app <strong>CLYON Pro</strong> encontram nas secções
            11 e 12 o que a app trata e como apagar a conta.
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Última atualização: 19 de outubro de 2026.
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
              ["#app-pro", "11. A app CLYON Pro, para profissionais"],
              ["#apagar-conta", "12. Apagar a conta de profissional"],
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
                {/*
                  Dizia "quem executa o trabalho e emite a fatura é o
                  profissional". A metade da factura deixou de ser verdade a
                  22-09-2026, e faltava dizer que os pagamentos pela plataforma
                  passam pela CLYON (30-09-2026).
                */}
                A CLYON opera uma plataforma que <strong>liga clientes a
                profissionais independentes</strong> — recolha de móveis,
                esvaziamento de casas e apartamentos, recolha de entulho,
                recolha de monos e mudanças em Lisboa, Margem Sul e Setúbal.
                Quem executa o trabalho é o profissional que o cliente
                escolher; os pagamentos feitos pela plataforma são recebidos
                pela CLYON; e, quando o cliente pede factura, quem a emite é a{" "}
                {ENTIDADE_QUE_FACTURA.nomeLegal}, empresa parceira.
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
                  <li>
                    Gerar as referências de pagamento (MB WAY ou Multibanco), confirmar os
                    pagamentos feitos pela plataforma e entregar ao profissional o valor que
                    lhe cabe.
                  </li>
                  <li>
                    Emitir, através da {ENTIDADE_QUE_FACTURA.nomeCurto}, a factura que o
                    cliente pedir, e cumprir as obrigações contabilísticas.
                  </li>
                  <li>Guardar as avaliações, sem identificar quem as escreveu.</li>
                  <li>Melhorar o serviço através da análise agregada da utilização do site.</li>
                  <li>Responder a reclamações e ajudar a resolver desacordos.</li>
                  {/*
                    O PROFISSIONAL COMO TITULAR, e não só como destinatário.

                    Esta lista falava dos dados do CLIENTE do princípio ao fim.
                    Desde 20-09-2026 a CLYON manda mensagens para o telemóvel do
                    PROFISSIONAL, e isso faz dele titular de dados aqui — com uma
                    finalidade que tem de estar escrita antes de acontecer, e uma
                    base legal que é o consentimento dele e mais nada.
                  */}
                  <li>
                    Avisar o <strong>profissional</strong>, por email, de que lhe
                    foi enviado um pedido — e, <strong>só se ele o activar no
                    painel dele</strong>, também por WhatsApp. Esse aviso leva a
                    localidade, a descrição do trabalho e o valor; desliga-se no
                    painel ou respondendo «parar».
                  </li>
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
                  {/*
                    OS TRÊS QUE FALTAVAM — 30-09-2026, conferidos no código.

                    · euPago: o corpo do MB WAY leva o valor e o telemóvel, e
                      o do Multibanco só o valor (eupago.ts, corpoDoMbway e
                      corpoDoMultibanco); nenhum leva nome nem email.
                    · a parceira que factura: recebe o que vai na factura —
                      os dados de facturação da conta (Faturacao.tsx).
                    · Google (Gemini): a análise do pedido manda as
                      fotografias, a descrição, a morada e os acessos
                      (api/simulator/analyze), e a compreensão do WhatsApp
                      manda o texto das mensagens (whatsapp-compreensao.ts).
                  */}
                  <li>
                    <strong>Pagamentos</strong> — euPago, para gerar as referências MB WAY e
                    Multibanco e confirmar os pagamentos. Recebe o valor a pagar e, no MB WAY, o
                    número de telemóvel para onde vai o pedido de pagamento.
                  </li>
                  <li>
                    <strong>Facturação</strong> — {ENTIDADE_QUE_FACTURA.nomeLegal}, empresa
                    parceira que emite a factura quando o cliente a pede. Recebe os dados de
                    facturação — nome, NIF e morada — e os valores do trabalho.
                  </li>
                  <li>
                    <strong>Análise dos pedidos</strong> — Google (Gemini), para ler as fotografias
                    e a descrição de um pedido e para perceber as mensagens escritas no WhatsApp.
                    Recebe as fotografias e os dados do pedido — descrição, morada, andar e
                    acessos — e o texto dessas mensagens.
                  </li>
                  <li>
                    <strong>Medição e publicidade</strong> — Google Analytics, Google Ads e Vercel
                    Analytics. <strong>Os cookies só se guardam se aceitar</strong> a analítica ou o
                    marketing. O Google Analytics e o Google Ads carregam nas páginas públicas
                    no modo de consentimento do Google: se recusar, ou enquanto não responder ao
                    aviso de cookies, funcionam sem cookies e sem identificadores, e o Google
                    recebe apenas sinais anónimos (por exemplo, que houve uma visita ou um
                    pedido), usados para medir as campanhas de forma agregada. O Vercel Analytics
                    conta as visitas sem cookies e sem identificar ninguém, aceite-se ou não.
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
                {/*
                  OS PRAZOS SÃO OS DO CÓDIGO — 30-09-2026.

                  Dizia "12 meses" para os pedidos não convertidos, e nenhum
                  código fazia isso. O que corre todos os dias é a purga de
                  retencao.ts e db.ts (purgarPedidosTerminados): 60 dias para
                  os terminados, 90 para os abandonados, nunca um pedido com
                  dinheiro combinado, feito ou pago, nem um com data marcada
                  ainda por chegar. O que ela apaga deixa uma cópia em
                  `arquivoDePedidos`, e isso também se diz — com o prazo
                  que o código lhe dá desde 01-10-2026 (ver em baixo).
                */}
                Os dados são conservados apenas pelo tempo necessário:
                <ul className="mt-3 list-disc space-y-1.5 pl-5">
                  <li>
                    <strong>Pedidos que não chegaram a trabalho combinado:</strong> apagados{" "}
                    {DIAS_DE_RETENCAO_DOS_PEDIDOS} dias depois de terminados (concluídos,
                    cancelados ou arquivados), ou {DIAS_PARA_OS_ABANDONADOS} dias depois da última
                    actividade quando ficaram a meio — com a morada, a descrição e as fotografias.
                    Um pedido com data marcada não é apagado antes dessa data.
                  </li>
                  {/* 14-10-2026 — o contacto guardado no passo 1 da página inicial. */}
                  <li>
                    <strong>Nome e telefone de um pedido não terminado:</strong> se começar um pedido
                    na página inicial e não o enviar, o nome e o telefone que escreveu no primeiro
                    passo ficam guardados {DIAS_DOS_CONTACTOS_A_MEIO} dias, para a nossa equipa o
                    poder ajudar a terminá-lo. Se enviar o pedido, saem logo.
                  </li>
                  <li>
                    <strong>Pedidos com trabalho combinado, feito ou pago:</strong> não são apagados
                    automaticamente, porque guardam o registo do dinheiro — valores, taxa e
                    pagamentos —, que a lei fiscal obriga a conservar durante 10 anos.
                  </li>
                  {/*
                    01-10-2026 — «Anonimizar ao fim de 12 meses», e também
                    quando o cliente apaga a conta (decisão do dono). O prazo
                    é MESES_ATE_ANONIMIZAR_O_ARQUIVO (retencao.ts), contado da
                    data em que a cópia foi arquivada; o que sai e o que fica
                    está em arquivo-anonimo.ts.
                  */}
                  <li>
                    <strong>Cópia dos pedidos apagados:</strong> quando um pedido é apagado, fica uma
                    cópia num arquivo interno, só acessível à administração da CLYON, para responder
                    a reclamações ou litígios. Ao fim de {MESES_ATE_ANONIMIZAR_O_ARQUIVO} meses — ou
                    antes, quando apaga a sua conta — essa cópia é anonimizada: deixa de ter o que o
                    identifica (nome, contactos, morada, texto escrito e fotografias) e fica só com
                    as datas, os valores, o serviço e a zona.
                  </li>
                  <li>
                    <strong>Registo do que aconteceu em cada pedido</strong> (datas, valores,
                    serviço, zona e nomes): conservado como prova e para as obrigações fiscais.
                    Quando apaga a sua conta, o seu nome e o seu contacto são retirados dele.
                  </li>
                  <li>
                    <strong>Mensagens de WhatsApp:</strong> {DIAS_DE_RETENCAO_DOS_PEDIDOS} dias. As
                    conversas com o assistente do WhatsApp que não chegaram a pedido:{" "}
                    {DIAS_PARA_AS_RECOLHAS_DO_WHATSAPP} dias.
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
                no prazo de 30 dias.
              </>
            }
          />

          <PolicySection
            id="seguranca"
            title="8. Segurança dos dados"
            body={
              <>
                {/*
                  "Cópias de segurança periódicas e formação das equipas" saiu
                  a 30-09-2026: não há cópias automáticas da base, e nenhuma
                  formação está feita. Fica o que o código faz — HTTPS, acesso
                  com sessão, as chaves dos pedidos guardadas só em hash
                  (acessoTokenHash) e fora das medições (endereco-sem-segredos.ts).
                */}
                Adoptamos medidas técnicas para proteger os dados: comunicações encriptadas
                (HTTPS), acesso restrito às bases de dados e ao painel de administração, e as
                chaves de acesso aos pedidos guardadas só como resumo criptográfico (hash) e nunca
                enviadas às ferramentas de medição. Ainda assim, nenhum sistema é 100% imune —
                recomendamos que não envie dados sensíveis por canais não seguros.
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

          {/*
            A APP DOS PROFISSIONAIS — 19-10-2026, conferido no código da app
            (app-pro/) e das rotas /api/profissionais/*.

            A Google Play pede que a política diga o que a app recolhe e com
            quem passa. A app não lê a localização, os contactos, o calendário
            nem o microfone (não há expo-location nem expo-calendar, e o
            app.json bloqueia o RECORD_AUDIO); não tem publicidade, medição nem
            relatórios de erros; o token dos avisos sai ao «Sair» e ao apagar
            a conta (avisos.ts, db.ts). O IBAN nunca volta inteiro à app
            (api/profissionais/perfil).
          */}
          <PolicySection
            id="app-pro"
            title="11. A app CLYON Pro, para profissionais"
            body={
              <>
                A CLYON Pro é a app dos profissionais parceiros. Entra-se com a mesma conta do
                painel no site, e os dados que usa são os dessa conta. Além do que está nas secções
                anteriores, a app trata:
                <ul className="mt-3 list-disc space-y-1.5 pl-5">
                  <li>
                    <strong>Dados da conta:</strong> nome ou empresa, email, telefone, morada da base
                    (e a localização dessa morada, que o Google Maps calcula), os serviços que faz, o
                    raio de trabalho, a viatura e as fotografias da viatura.
                  </li>
                  <li>
                    <strong>Dados de facturação:</strong> NIF, morada fiscal, regime de IVA e, para o
                    entulho e os monos, a guia de transporte de resíduos e o número de registo de
                    transportador.
                  </li>
                  <li>
                    <strong>Dados para receber e pagar:</strong> IBAN e titular da conta, para lhe
                    transferirmos o que ganhou, e o número MB WAY, se o indicar, para pagar o que deve
                    à CLYON. A app nunca mostra o IBAN inteiro e não guarda cartões.
                  </li>
                  <li>
                    <strong>O que junta a um trabalho:</strong> as fotografias e a nota de um ajuste ao
                    valor no local ou da prova de que o trabalho está feito, e a hora a que diz que vai
                    a caminho e que chegou. O cliente que o contratou vê essas fotografias e a nota,
                    pode receber por WhatsApp os avisos de «a caminho» e «cheguei», e vê o seu nome e o
                    seu telefone.
                  </li>
                  <li>
                    <strong>Mensagens à CLYON</strong> escritas na Ajuda da app.
                  </li>
                  <li>
                    <strong>Avisos no telemóvel:</strong> se os autorizar, a app regista um
                    identificador do telemóvel para os avisos, que serve só para lhe mandar avisos dos
                    seus pedidos e trabalhos — por exemplo, que entrou um pedido para si ou que um
                    trabalho é seu. Sai quando carrega em «Sair» ou apaga a conta.
                  </li>
                </ul>
                A app <strong>não lê</strong> a localização do telemóvel, os contactos, o calendário
                nem o microfone, e não tem publicidade nem ferramentas de medição. A câmara e as
                fotografias só são usadas quando escolhe juntar uma imagem. O botão «Pôr no calendário
                do telemóvel» abre o Google Calendar com os dados desse trabalho, para os guardar na
                sua agenda se quiser.
                <br />
                <br />
                Além dos que estão na secção 5, estes dados passam por: <strong>Expo</strong> e{" "}
                <strong>Google (Firebase Cloud Messaging)</strong>, para entregar os avisos no
                telemóvel; <strong>Vercel</strong>, onde ficam guardadas as fotografias;{" "}
                <strong>Google Maps</strong>, para encontrar a morada da base; e{" "}
                <strong>euPago</strong>, para gerar as referências das dívidas e, no MB WAY, o número
                para onde vai o pedido de pagamento. A base legal é a execução do acordo de parceria,
                as obrigações fiscais para a facturação e, nos avisos no telemóvel e no WhatsApp, o
                seu consentimento. Os dados ficam enquanto a conta existir; para a apagar, veja a
                secção seguinte.
              </>
            }
          />

          {/*
            APAGAR A CONTA — 19-10-2026. A Google Play pede uma página pública
            com os passos, o que se apaga e o que fica. O que se apaga é o da
            função que apaga a conta do profissional (db.ts) e do texto do
            ecrã da app (app-pro/src/app/conta/palavra-passe.tsx). As
            fotografias dos trabalhos não saem: ficam com o trabalho, que fica
            sem o nome dele. O email já estava prometido nos Termos (§12).
          */}
          <PolicySection
            id="apagar-conta"
            title="12. Apagar a conta de profissional"
            body={
              <>
                Pode apagar a sua conta de profissional da CLYON — a mesma da app CLYON Pro — quando
                quiser, sem custo, de três maneiras:
                <ul className="mt-3 list-disc space-y-1.5 pl-5">
                  <li>
                    <strong>Na app CLYON Pro:</strong> separador «Conta» › «Palavra-passe» › «Apagar a
                    conta», escreva ELIMINAR e confirme.
                  </li>
                  <li>
                    <strong>No site:</strong> entre no{" "}
                    <Link href="/profissionais/entrar" className="text-acao hover:underline">
                      painel do profissional
                    </Link>
                    , abra «Palavra-passe» e carregue em «Apagar a conta».
                  </li>
                  <li>
                    <strong>Por email:</strong> peça-o para <strong>{BUSINESS_EMAIL}</strong>.
                    Respondemos no prazo de 30 dias.
                  </li>
                </ul>
                <strong>O que se apaga:</strong> nome, email, telefone, NIF, IBAN e titular, número
                MB WAY, morada fiscal, morada da base, número de registo de transportador, serviços,
                zonas, fotografias da viatura, palavra-passe e os identificadores dos avisos no
                telemóvel. Deixa de receber pedidos.
                <br />
                <br />
                <strong>O que fica:</strong> os trabalhos que já fez continuam no histórico dos
                clientes que o contrataram, sem o seu nome, com as fotografias e as notas que lhes
                juntou; e o registo do dinheiro desses trabalhos é guardado durante 10 anos, como a lei
                fiscal obriga (secção 6).
                <br />
                <br />
                Se houver dinheiro seu por pagar ou um trabalho por confirmar, o pedido é recusado e a
                conta fica suspensa — deixa de receber pedidos — até isso estar resolvido. A app e o
                painel dizem o que falta; depois, pode apagá-la.
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
