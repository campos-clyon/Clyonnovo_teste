import type { Metadata } from "next";
import { jsonLd } from "@/lib/json-ld";
import { og } from "@/lib/open-graph";
import Link from "next/link";

import FAQClient from "./FAQClient";
import {
  AVALIACOES,
  AVALIACOES_TOTAL,
  COMO_SE_PAGA,
  FACTURA_EM_PALAVRAS,
  NOTA_DE_PRECO,
  PRAZO_DE_RESPOSTA,
} from "@/lib/seo-data";
import { PRECOS } from "@/lib/precos-publicos";
import { IDENTIFICACAO } from "@/lib/identificacao-legal";

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
const faqCategories = [
  {
    category: "Recolha de Móveis em Lisboa",
    questions: [
      {
        q: "Quanto custa a recolha de móveis em Lisboa?",
        a: `O preço depende do volume, do tipo de móvel e dos acessos. Para peças soltas como sofá, armário ou cama, a referência é ${PRECOS.recolha_moveis.etiqueta}; volumes maiores ou andares sem elevador ficam mais caros. Descreva o pedido em clyon.pt/simulador e recebe as propostas dos profissionais da sua zona em menos de ${PRAZO_DE_RESPOSTA.porExtenso}. ${NOTA_DE_PRECO.curta}`,
      },
      {
        q: "Que móveis recolhem?",
        a: "Os profissionais recolhem qualquer tipo de móvel: sofás, camas, colchões, armários, estantes, secretárias, cadeiras, mesas, aparadores, cómodas, roupeiros e mobiliário de escritório. Também retiram eletrodomésticos (frigoríficos, máquinas de lavar, fogões, micro-ondas) e objetos de grandes dimensões que não cabem no contentor do lixo da rua.",
      },
      {
        q: "Fazem recolha de sofás em Lisboa no mesmo dia?",
        a: `Depende de haver profissional disponível. As propostas chegam em menos de ${PRAZO_DE_RESPOSTA.porExtenso} e a data combina-se com o profissional que escolher — se precisar para o próprio dia, diga-o no pedido, pelo simulador ou por WhatsApp.`,
      },
      {
        q: "Recolhem sofás, colchões e camas com ou sem desmontagem?",
        a: "Com ou sem desmontagem. Se o sofá ou a cama não passa pela porta ou pelo elevador, o profissional desmonta antes de retirar. Indique-o no pedido, para a proposta já contar com isso.",
      },
      {
        q: "Recolhem móveis velhos ou danificados?",
        a: "Sim. Não há restrição sobre o estado do móvel — os profissionais levam peças partidas, com bolor, desmontadas ou incompletas. O importante é dizer o tipo e o volume, para a proposta ser certa.",
      },
      {
        q: "Como funciona a recolha de móveis — passo a passo?",
        a: "1) Faz o pedido no simulador ou por WhatsApp, com fotografias. 2) Recebe as propostas dos profissionais da sua zona, já com a taxa da plataforma, e escolhe uma. 3) O profissional vai no dia combinado e retira os móveis do interior do imóvel. 4) Confirma que ficou feito.",
      },
      {
        q: "A recolha inclui subir ao apartamento para retirar os móveis?",
        a: "Sim. O profissional sobe ao andar, retira os móveis do interior do imóvel, desce e carrega na viatura. Não tem de fazer esforço nenhum — só dizer no pedido o andar e se há elevador.",
      },
      {
        q: "Recolhem apenas uma peça ou precisam de vários móveis?",
        a: "Os profissionais recolhem desde uma única peça (um sofá, uma cama, um armário) até uma casa inteira. Não há mínimo de volume.",
      },
      {
        q: "Para onde vão os móveis recolhidos?",
        // 30-09-2026: dizia que os móveis em bom estado «podem ir para
        // instituições de solidariedade» — a plataforma não tem circuito de
        // doação nenhum, e o destino é decisão do profissional.
        a: "Quem transporta é o profissional, e é ele que decide o destino: o que ainda serve pode ser reaproveitado; o resto tem de ir para um destino legal, e as regras da plataforma proíbem o transporte de resíduos sem as autorizações que a lei exige. Se quer doar peças em bom estado, veja /recolha-gratuita-de-moveis-usados.",
      },
      {
        q: "Existe recolha gratuita de móveis em Lisboa?",
        /*
         * Dizia que a recolha "pode ser gratuita" para móveis com valor de
         * revenda. A CLYON não faz recolha gratuita nenhuma — é a página de
         * que o cliente se lembra quando a proposta chega com preço. O
         * caminho interno no fim é desenhado como ligação pelo FAQClient.
         */
        a: "Na CLYON, não: é uma plataforma de serviços pagos, e o preço é o da proposta que o cliente aceita. Para uma opção gratuita, veja a recolha de monos da sua câmara municipal ou a doação a instituições — explicamos as diferenças em /recolha-gratuita-de-moveis-usados.",
      },
    ],
  },
  {
    category: "Esvaziamento de Casa em Lisboa",
    questions: [
      {
        q: "Quanto custa o esvaziamento de uma casa em Lisboa?",
        a: `Um esvaziamento de casa custa a partir de 250 €. Num apartamento o valor fica em ${PRECOS.esvaziamento_apartamento.etiqueta}, conforme a tipologia: um T0/T1 em 260 – 350 €, um T2 em 320 – 420 €, um T3/T4 em 380 – 450 €. Numa moradia completa, a partir de 450 €. O valor final depende do volume de recheio, número de andares, elevador disponível e distância, e chega nas propostas dos profissionais. ${NOTA_DE_PRECO.curta}`,
      },
      {
        q: "O que inclui o serviço de esvaziamento de casa?",
        a: "O que pedir, e fica escrito na proposta. Normalmente: a retirada dos móveis e objetos indicados, a desmontagem do que for preciso e o transporte para destino adequado. Deixar o espaço varrido pode combinar-se com o profissional; limpezas a fundo não são um serviço da CLYON.",
      },
      {
        q: "Fazem esvaziamento de casas de herança ou imóveis de senhorios?",
        a: "Sim — senhorios que recebem o imóvel com o recheio deixado pelo inquilino, ou famílias a tratar de um espólio. Não precisa de estar presente: o acesso combina-se com o profissional que escolher.",
      },
      {
        q: "Quanto tempo demora o esvaziamento de uma casa?",
        a: "Como referência: um T1 leva 3 a 5 horas, com 2 a 3 pessoas; um T2, entre 4 e 7 horas; uma moradia ou um T3+ pode levar um dia inteiro ou ser dividida em dois dias. O prazo certo combina-se com o profissional, e depende do volume e dos acessos.",
      },
      {
        q: "Fazem esvaziamento ao fim de semana em Lisboa?",
        a: "O atendimento da CLYON é de segunda a sábado, das 08:00 às 20:00. Trabalhos ao domingo dependem de haver profissional disponível; qualquer acréscimo vem na proposta.",
      },
      {
        q: "Recolhem tudo numa casa — do mobiliário ao lixo?",
        a: "Sim. Os profissionais retiram móveis, eletrodomésticos, roupa, documentos para destruição, entulho de obras menores, objetos pessoais e qualquer outro conteúdo que esteja no imóvel. O cliente indica o que fica e o que vai — o resto é com eles.",
      },
      {
        q: "Fazem esvaziamento de apartamento em Lisboa no centro histórico?",
        a: "Sim. Os pedidos do centro histórico — Mouraria, Alfama, Intendente, Príncipe Real — chegam aos profissionais como os outros. Diga no pedido se a rua é estreita e se o elevador é pequeno ou não existe: a proposta tem de contar com isso.",
      },
      {
        q: "Precisam de autorização da câmara para estacionar o camião?",
        a: "Para serviços curtos, o profissional usa um lugar de cargas e descargas. Para trabalhos maiores, que precisem de reservar espaço na via pública, pode ser preciso pedir licença à junta de freguesia ou à câmara — a equipa da CLYON explica-lhe como.",
      },
    ],
  },
  {
    category: "Esvaziamento de Apartamento",
    questions: [
      {
        q: "Qual a diferença entre esvaziamento de casa e de apartamento?",
        a: "Funcionalmente é o mesmo serviço. O esvaziamento de apartamento tende a ter a condicionante do elevador — tamanho, peso máximo, disponibilidade — e do estacionamento na via pública. Indique-as no pedido, para a proposta contar com elas e não haver surpresas.",
      },
      {
        q: "Fazem esvaziamento de apartamento sem elevador?",
        a: "Sim. Sem elevador, o preço sobe por andar, pelo esforço e pelo tempo de descer tudo a pé. Indique o andar no pedido, para a proposta já contar com isso.",
      },
      {
        q: "Consigo fazer esvaziamento do apartamento em 6 horas?",
        a: `As propostas chegam em menos de ${PRAZO_DE_RESPOSTA.porExtenso}; o trabalho em si depende do volume e da disponibilidade do profissional que escolher. Se for urgente, diga-o no pedido e mande fotografias do imóvel pelo WhatsApp — quanto mais claro o pedido, mais depressa se combina a data.`,
      },
      {
        q: "Recolhem os eletrodomésticos do apartamento?",
        a: "Sim. Frigorífico, máquina de lavar, máquina de secar, fogão, forno, micro-ondas, arca frigorífica — os profissionais retiram os eletrodomésticos incluídos no esvaziamento. Indique-os no pedido, sobretudo os grandes.",
      },
      {
        q: "O apartamento fica limpo depois do esvaziamento?",
        a: "Fica sem os volumes que pediu para retirar. Deixar o espaço varrido pode combinar-se com o profissional; limpezas a fundo — pavimentos, paredes, casas de banho, cozinha — não são um serviço da CLYON.",
      },
    ],
  },
  {
    category: "Preços e Orçamentos",
    questions: [
      {
        q: "Como peço orçamento para recolha de móveis?",
        a: `Há três formas: (1) No simulador, em clyon.pt/simulador — indica o tipo de serviço, a morada e o volume, com fotografias. (2) Por WhatsApp — envie fotografias e a descrição. (3) Pelo formulário de contacto, em clyon.pt/contactos. Em qualquer delas, uma pessoa da CLYON confere o pedido e envia-o aos profissionais da sua zona, e as propostas chegam em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`,
      },
      {
        q: "O orçamento é gratuito e sem compromisso?",
        a: "Sim. Pedir propostas é gratuito e não o compromete: só há trabalho se aceitar uma.",
      },
      {
        q: "O preço pode mudar depois de aceitar o orçamento?",
        /*
         * Coerente com a garantia da página inicial. O valor é dado à
         * distância e confirma-se no local (orcamento-a-distancia.ts); o que
         * aparecer a mais combina-se antes de começar (itens-a-mais.ts) e
         * corrige-se na plataforma, com registo. Dizia "fazemos nova
         * estimativa" — a CLYON não estima trabalho de ninguém.
         */
        a: "O valor que aceitar fica combinado por escrito. Como é dado à distância, pelo que descreveu, confirma-se no local antes de começar: se houver mais do que descreveu, o profissional diz-lhe o novo valor antes de começar, e só avança se aceitar — a correcção fica registada na plataforma. Depois do trabalho feito, não acresce nada.",
      },
      {
        q: "Quais os métodos de pagamento aceites?",
        a: COMO_SE_PAGA,
      },
      {
        q: "Há custo de deslocação para Lisboa e Margem Sul?",
        a: "O custo da deslocação entra na proposta de cada profissional. Vê-o antes de aceitar.",
      },
      {
        q: "O entulho vai para onde? Estão licenciados?",
        /*
         * Isto existia e nao estava dito em lado nenhum.
         *
         * Os dois principais concorrentes destacam o licenciamento ambiental
         * deles, e uma auditoria apontou a falta disso como a maior
         * desvantagem competitiva da CLYON. O registo na APA ca estava desde
         * sempre.
         *
         * DEIXOU DE EXCLUIR A 14-09-2026, e a resposta dizia que excluía.
         * Dizia "quem não o tem verificado nem chega a ver o seu pedido", mas
         * em profissional-elegivel.ts a guia passou de filtro a AVISO: o
         * profissional sem transportador verificado vê o pedido e é avisado
         * antes de propor. O que o cliente vê é o selo «guia verificada» no
         * cartão da proposta (PropostasRecebidas.tsx) — é isso que se diz
         * agora, e o código APA sai da constante (30-09-2026).
         */
        a: `A CLYON está registada como operador de resíduos na Agência Portuguesa do Ambiente, com o código ${IDENTIFICACAO.codigoAPA}. Quem transporta o entulho é o profissional que escolher, e as regras da plataforma obrigam-no a ter as autorizações que a lei exige. Quando o trabalho precisa de guia de acompanhamento de resíduos, o cartão de cada proposta mostra se a CLYON já verificou o número de transportador desse profissional.`,
      },
      {
        q: "Fazem fatura ou recibo?",
        // Dizia que a fatura era emitida pelo profissional e que a CLYON
        // faturava só a taxa. Deixou de ser verdade a 22-09-2026: quem fatura
        // ao cliente é a parceira de `ENTIDADE_QUE_FACTURA`, sobre o preço da
        // proposta inteiro (30-09-2026).
        a: `Sim, quando a pede. ${FACTURA_EM_PALAVRAS} Diga no pedido que precisa de fatura.`,
      },
    ],
  },
  {
    category: "Zonas de Atuação",
    questions: [
      {
        q: "Em que zonas de Lisboa fazem recolha de móveis?",
        a: "Toda a cidade de Lisboa — Alfama, Mouraria, Príncipe Real, Intendente, Arroios, Alvalade, Benfica, Lumiar, Telheiras, Parque das Nações, Belém, Alcântara, Campolide, Amoreiras, Avenidas Novas e as restantes freguesias — e concelhos vizinhos como Odivelas. O pedido chega aos profissionais cuja zona alcança a sua morada.",
      },
      {
        q: "Fazem recolha na Margem Sul?",
        a: "Sim. Os pedidos de Almada, Seixal, Barreiro, Corroios, Costa da Caparica, Laranjeiro, Charneca da Caparica, Feijó, Amora e arredores chegam aos profissionais da zona. O custo da deslocação entra na proposta de cada um.",
      },
      {
        q: "Fazem recolha em Setúbal, Palmela e Sesimbra?",
        a: "Sim: Setúbal, Palmela, Sesimbra, Quinta do Conde, Azeitão e concelhos próximos. Fora de Lisboa, da Margem Sul e de Setúbal, depende de haver profissional disponível.",
      },
      {
        q: "Fazem recolha em Sintra, Cascais e Oeiras?",
        a: "Sim: Sintra, Cascais, Oeiras, Algés, Carnaxide, Paço de Arcos e toda a linha de Cascais. O custo da deslocação entra na proposta de cada profissional.",
      },
      {
        q: "Trabalham em condomínios fechados?",
        a: "Sim. Nos condomínios fechados, o acesso trata-se com a segurança ou a portaria: basta avisar que vai entrar um profissional com viatura para fazer o serviço.",
      },
    ],
  },
  {
    category: "Mudanças",
    questions: [
      {
        q: "Fazem mudanças de casa em Lisboa?",
        a: "Sim. Os profissionais da CLYON fazem mudanças residenciais e comerciais em Lisboa, Margem Sul e Setúbal: carga, transporte e descarga. Embalagem e montagem pedem-se à parte, no pedido, e entram na proposta.",
      },
      {
        q: "Quanto custa uma mudança em Lisboa?",
        /*
         * As mudanças não publicam número — decisão de 22-08-2026, e a razão
         * está em `precos-publicos`. Esta resposta anunciava 50 €/hora e um
         * T1 a partir de 180 €, quando o motor factura uma mudança a partir
         * de 490 €. Qualquer número aqui volta a criar a mesma divergência.
         */
        a: `Uma mudança é sempre orçamento personalizado. O valor depende do volume, da distância entre as duas moradas, do andar e do acesso de cada uma — e um preço fixo publicado aqui estaria sempre errado numa delas. Envie a morada de origem, a de destino e fotografias das divisões: recebe propostas grátis em menos de ${PRAZO_DE_RESPOSTA.porExtenso}, cada uma com o preço já com a taxa da plataforma.`,
      },
      {
        q: "Fazem mudanças para outras cidades como Porto ou Coimbra?",
        a: "As mudanças fazem-se a partir de Lisboa, da Margem Sul e de Setúbal. Para destinos mais longe, como o Porto ou o Algarve, depende de haver profissional disponível — faça o pedido com as duas moradas.",
      },
      {
        q: "Incluem embalagem de caixas na mudança?",
        // "A embalagem básica está incluída" era uma promessa sobre o preço de
        // outra pessoa. O que se inclui é o que a proposta disser.
        a: "Depende da proposta. Diga no pedido o que quer embalado — as peças frágeis, a louça, os livros, a casa toda — para o profissional contar com isso no preço.",
      },
    ],
  },
];

export const revalidate = 86400;

export default function FAQPage() {
  const allQuestions = faqCategories.flatMap((cat) => cat.questions);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-white">
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
              { value: String(AVALIACOES_TOTAL), label: "Avaliações no Google e na Fixando" },
              { value: `${AVALIACOES.media} ★`, label: "Avaliação dos clientes" },
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
