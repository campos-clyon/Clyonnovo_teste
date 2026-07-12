import type { Metadata } from "next";
import Link from "next/link";

import FAQClient from "./FAQClient";

export const metadata: Metadata = {
  title: "FAQ — Recolha de Móveis e Esvaziamento de Casa em Lisboa | CLYON",
  description:
    "Perguntas frequentes sobre recolha de móveis, esvaziamento de casa e apartamento em Lisboa. Saiba quanto custa, quais móveis recolhemos, em que zonas atuamos e como funciona o serviço CLYON.",
  alternates: { canonical: "https://clyon.pt/faq" },
  openGraph: {
    title: "FAQ — Recolha de Móveis e Esvaziamento de Casa em Lisboa",
    description:
      "Tudo sobre recolha de móveis, esvaziamento de casas e apartamentos em Lisboa, Margem Sul e Setúbal. Preços, prazos e funcionamento.",
    url: "https://clyon.pt/faq",
  },
};

const faqCategories = [
  {
    category: "Recolha de Móveis em Lisboa",
    questions: [
      {
        q: "Quanto custa a recolha de móveis em Lisboa?",
        a: "O preço depende do volume, tipo de móvel e acessos. Para peças soltas como sofá, armário ou cama o valor começa nos 40 € a 100 €. Para volumes maiores ou deslocação até pisos superiores sem elevador o preço ajusta-se. Use o simulador em clyon.pt/simulador para obter um orçamento em 2 minutos.",
      },
      {
        q: "Que móveis recolhem?",
        a: "Recolhemos qualquer tipo de móvel: sofás, camas, colchões, armários, estantes, secretárias, cadeiras, mesas, aparadores, cómodas, roupeiros e mobiliário de escritório. Também retiramos eletrodomésticos (frigoríficos, máquinas de lavar, fogões, micro-ondas) e objetos de grandes dimensões que não cabem no contentor.",
      },
      {
        q: "Fazem recolha de sofás em Lisboa no mesmo dia?",
        a: "Sim, quando existe disponibilidade operacional fazemos recolha de sofás no próprio dia em Lisboa. Envie pedido pelo simulador ou WhatsApp e confirmamos a disponibilidade para hoje ou amanhã.",
      },
      {
        q: "Recolhem sofás, colchões e camas com ou sem desmontagem?",
        a: "Com ou sem desmontagem — a equipa avalia no local. Se o sofá ou a cama não passa pela porta ou pelo elevador, desmontamos antes de retirar. Este serviço está incluído no orçamento desde que indicado no pedido.",
      },
      {
        q: "Recolhem móveis velhos ou danificados?",
        a: "Sim. Não há restrição sobre o estado do móvel — recolhemos peças partidas, com bolor, desmontadas ou incompletas. O importante é identificar o tipo e volume para o orçamento ser preciso.",
      },
      {
        q: "Como funciona a recolha de móveis — passo a passo?",
        a: "1) Pede orçamento pelo simulador ou WhatsApp com foto e descrição. 2) Confirmamos preço e data por mensagem. 3) A equipa chega na hora marcada, retira os móveis do interior do imóvel e carrega na viatura. 4) O imóvel fica limpo e pronto a usar. Não tem de fazer nada além de abrir a porta.",
      },
      {
        q: "A recolha inclui subir ao apartamento para retirar os móveis?",
        a: "Sim. A equipa sobe ao andar, retira os móveis do interior do imóvel, desce e carrega na viatura. Não tem de fazer qualquer esforço físico.",
      },
      {
        q: "Recolhem apenas uma peça ou precisam de vários móveis?",
        a: "Recolhemos desde uma única peça (um sofá, uma cama, um armário) até uma casa inteira. Não há mínimo de volume.",
      },
      {
        q: "Para onde vão os móveis recolhidos?",
        a: "Sempre que possível encaminhamos para reutilização, doação ou revenda. Móveis em bom estado podem seguir para instituições de solidariedade social ou ser dados a particulares. O restante vai para destino responsável e legal — nunca para descarga ilegal.",
      },
      {
        q: "Existe recolha gratuita de móveis em Lisboa?",
        a: "Em casos específicos — móveis em bom estado com valor de revenda — a recolha pode ser gratuita ou a custo muito reduzido. Envie fotos pelo WhatsApp e avaliamos se se enquadra neste cenário. Na maioria dos casos há um custo de serviço pelo trabalho de retirada e transporte.",
      },
    ],
  },
  {
    category: "Esvaziamento de Casa em Lisboa",
    questions: [
      {
        q: "Quanto custa o esvaziamento de uma casa em Lisboa?",
        a: "O esvaziamento completo de um T1 começa nos 180 € a 280 €. Um T2 entre 250 € e 400 €. Um T3 ou moradia entre 350 € e 600 €. O valor final depende do volume de recheio, número de andares, elevador disponível e distância. Peça orçamento exato pelo simulador.",
      },
      {
        q: "O que inclui o serviço de esvaziamento de casa?",
        a: "O esvaziamento inclui: retirada de todos os móveis e objetos indicados, desmontagem de mobiliário fixo quando necessário, transporte para destino adequado e limpeza básica do espaço após a retirada. Pode pedir limpeza profunda como serviço adicional.",
      },
      {
        q: "Fazem esvaziamento de casas de herança ou imóveis de senhorios?",
        a: "Sim. Este é um dos pedidos mais comuns — senhorios que recebem o imóvel com recheio deixado pelo inquilino, ou famílias a tratar de espólio. Tratamos de tudo sem que tenha de estar presente se não for possível.",
      },
      {
        q: "Quanto tempo demora o esvaziamento de uma casa?",
        a: "Um T1 vazio em 3 a 5 horas com equipa de 2 a 3 pessoas. Um T2 entre 4 e 7 horas. Uma moradia ou T3+ pode levar um dia inteiro ou ser dividida em dois dias. O prazo exato depende do volume e acessos.",
      },
      {
        q: "Fazem esvaziamento ao fim de semana em Lisboa?",
        a: "Sim. Trabalhamos todos os dias da semana incluindo sábados e domingos. Muitos clientes preferem o fim de semana para não interferir com o trabalho — basta solicitar na reserva.",
      },
      {
        q: "Recolhem tudo numa casa — do mobiliário ao lixo?",
        a: "Sim. Retiramos móveis, eletrodomésticos, roupa, documentos para destruição, entulho de obras menores, objetos pessoais e qualquer outro conteúdo que esteja no imóvel. O cliente indica o que fica e o que vai — nós tratamos do resto.",
      },
      {
        q: "Fazem esvaziamento de apartamento em Lisboa no centro histórico?",
        a: "Sim. Temos experiência em imóveis do centro histórico de Lisboa — Mouraria, Alfama, Intendente, Príncipe Real — onde os acessos são estreitos e os elevadores pequenos ou inexistentes. Ajustamos a equipa e o equipamento para estes casos.",
      },
      {
        q: "Precisam de autorização da câmara para estacionar o camião?",
        a: "Para serviços curtos em zona de residentes usamos lugar de carga e descarga disponível. Para operações maiores que precisam de reserva de espaço público, orientamos o cliente sobre o processo junto da junta de freguesia ou câmara.",
      },
    ],
  },
  {
    category: "Esvaziamento de Apartamento",
    questions: [
      {
        q: "Qual a diferença entre esvaziamento de casa e de apartamento?",
        a: "Funcionalmente é o mesmo serviço. O esvaziamento de apartamento tende a ter a condicionante do elevador — tamanho, peso máximo, disponibilidade — e estacionamento na via pública. Identificamos estas condicionantes no orçamento para não haver surpresas.",
      },
      {
        q: "Fazem esvaziamento de apartamento sem elevador?",
        a: "Sim. Apartamentos sem elevador têm um acréscimo no preço por andar devido ao esforço adicional e ao tempo de descida a pé. Este custo é incluído no orçamento após identificar o número de andares.",
      },
      {
        q: "Consigo fazer esvaziamento do apartamento em 24 horas?",
        a: "Dependendo da disponibilidade e do volume, sim. Para pedidos urgentes em Lisboa responda pelo WhatsApp com fotos do imóvel e tentamos encaixar na agenda mais próxima — muitas vezes no próprio dia ou no seguinte.",
      },
      {
        q: "Recolhem os eletrodomésticos do apartamento?",
        a: "Sim. Frigorífico, máquina de lavar, máquina de secar, fogão, forno, micro-ondas, arca frigorífica — retiramos todos os eletrodomésticos incluídos no esvaziamento. Equipamentos de grandes dimensões são desligados, embalados e transportados com segurança.",
      },
      {
        q: "O apartamento fica limpo depois do esvaziamento?",
        a: "Após o esvaziamento o espaço fica varrido e sem volumes. Para limpeza profunda (pavimentos, paredes, casas de banho, cozinha) oferecemos serviço de limpeza pós-obra e pós-mudança como complemento — peça no orçamento.",
      },
    ],
  },
  {
    category: "Preços e Orçamentos",
    questions: [
      {
        q: "Como peço orçamento para recolha de móveis?",
        a: "Há três formas: (1) Simulador em clyon.pt/simulador — preenche o tipo de serviço, morada e volume em 2 minutos e recebe estimativa imediata. (2) WhatsApp — envie fotos e descrição e respondemos com orçamento em menos de 1 hora durante o horário de funcionamento. (3) Formulário de contacto em clyon.pt/contactos.",
      },
      {
        q: "O orçamento é gratuito e sem compromisso?",
        a: "Sim. O orçamento é sempre gratuito e não tem qualquer compromisso. Só avança quando aprovar o valor e a data.",
      },
      {
        q: "O preço pode mudar depois de aceitar o orçamento?",
        a: "Não. O orçamento confirmado é o preço final, desde que o volume e as condições de acesso correspondam ao que foi descrito. Se no local houver mais volume do que indicado fazemos nova estimativa antes de prosseguir — nunca cobram surpresas no final.",
      },
      {
        q: "Quais os métodos de pagamento aceites?",
        a: "Aceitamos MB Way, Revolut e Novo Banco. O pagamento é feito após o serviço concluído.",
      },
      {
        q: "Há custo de deslocação para Lisboa e Margem Sul?",
        a: "Para serviços em Lisboa, Almada, Seixal, Barreiro, Setúbal e concelhos próximos a deslocação está incluída no preço. Para localidades mais afastadas pode haver um custo adicional de 5 € a 15 € conforme a distância — informado no orçamento.",
      },
      {
        q: "Fazem fatura ou recibo?",
        a: "Sim. Emitimos recibo ou fatura com NIF para todos os serviços. Indique o NIF no pedido de orçamento.",
      },
    ],
  },
  {
    category: "Zonas de Atuação",
    questions: [
      {
        q: "Em que zonas de Lisboa fazem recolha de móveis?",
        a: "Cobrimos toda a cidade de Lisboa: Alfama, Mouraria, Príncipe Real, Intendente, Arroios, Alvalade, Benfica, Lumiar, Odivelas, Telheiras, Parque das Nações, Belém, Alcântara, Campolide, Amoreiras, Avenidas Novas e todas as restantes freguesias.",
      },
      {
        q: "Fazem recolha na Margem Sul?",
        a: "Sim. Temos equipas baseadas na Margem Sul com cobertura em Almada, Seixal, Barreiro, Corroios, Costa da Caparica, Laranjeiro, Charneca da Caparica, Feijó, Amora e arredores. A deslocação é rápida e o custo é idêntico ao de Lisboa.",
      },
      {
        q: "Fazem recolha em Setúbal, Palmela e Sesimbra?",
        a: "Sim, cobrimos Setúbal, Palmela, Sesimbra, Quinta do Conde, Azeitão e concelhos próximos. Para estas zonas confirme disponibilidade no pedido de orçamento.",
      },
      {
        q: "Fazem recolha em Sintra, Cascais e Oeiras?",
        a: "Sim. Cobrimos Sintra, Cascais, Oeiras, Algés, Carnaxide, Paço de Arcos e toda a linha de Cascais. A equipa parte de Lisboa e o custo de deslocação é calculado pela distância.",
      },
      {
        q: "Trabalham em condomínios fechados?",
        a: "Sim. Para condomínios fechados o cliente trata do acesso com o segurança ou portaria. Basta informar que teremos uma equipa com viatura a entrar para prestação de serviço.",
      },
    ],
  },
  {
    category: "Mudanças",
    questions: [
      {
        q: "Fazem mudanças de casa em Lisboa?",
        a: "Sim. Fazemos mudanças residenciais e comerciais em Lisboa e arredores. O serviço inclui carga, transporte e descarga. Embalagem e montagem disponíveis como adicionais.",
      },
      {
        q: "Quanto custa uma mudança em Lisboa?",
        a: "O preço começa a partir de 50 €/hora com equipa mínima de 2 pessoas e viatura. Um T1 completo custa entre 180 € e 350 € dependendo da distância, andar e volume. Um T2/T3 entre 300 € e 700 €.",
      },
      {
        q: "Fazem mudanças para outras cidades como Porto ou Coimbra?",
        a: "Fazemos mudanças dentro de Lisboa, Margem Sul e Setúbal. Para destinos mais distantes como Porto ou Algarve consulte-nos — avaliamos caso a caso com orçamento específico.",
      },
      {
        q: "Incluem embalagem de caixas na mudança?",
        a: "A embalagem básica de peças frágeis está incluída no serviço. Para embalagem completa de toda a casa (louça, livros, roupas, etc.) é um serviço adicional — peça no orçamento.",
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
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">
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
                    className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700"
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
            {[
              { value: "24h", label: "Orçamento em" },
              { value: "188", label: "Trabalhos concluídos" },
              { value: "5,0 ★", label: "Avaliação dos clientes" },
              { value: "Lisboa+", label: "Margem Sul e Setúbal" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-cyan-600">{s.value}</p>
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
                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                  Fale connosco e afinamos o pedido em poucos minutos.
                </h2>
                <p className="mt-3 text-sm text-white/60">
                  Resposta por WhatsApp em menos de 1 hora durante o horário de funcionamento.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link
                  href="/simulador"
                  className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-7 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-cyan-300"
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
          __html: JSON.stringify({
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
