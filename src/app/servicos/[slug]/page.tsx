import type { Metadata } from "next";
import { jsonLd } from "@/lib/json-ld";
import { og } from "@/lib/open-graph";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Phone } from "lucide-react";
import { PROMESSA } from "@/lib/pagamento-na-plataforma";

import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { PRECOS, comMaiuscula, maisIva } from "@/lib/precos-publicos";
import { cabeNoGoogle } from "@/lib/titulos-seo";
import { descricaoQueCabe } from "@/lib/descricoes-seo";
import GuiasDoServico from "@/components/GuiasDoServico";
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  SITE_URL,
  NOTA_DE_PRECO,
  PRAZO_DE_RESPOSTA,
} from "@/lib/seo-data";

/**
 * As páginas dos serviços que não tinham página nenhuma.
 *
 * PORQUE É QUE ISTO PRECISOU DE EXISTIR
 *
 * Nove cartões de serviço na homepage, e quatro deles levavam a `/simulador`.
 * Um cartão que MOSTRA UM PREÇO faz uma promessa de página informativa: quem
 * carrega quer saber mais. Cair num formulário em vez disso é um salto de
 * contexto — a pessoa queria ler e é-lhe pedido que preencha.
 *
 * A regra que fica: um cartão de serviço leva sempre a uma página de serviço.
 *
 * O "outro serviço" continua a apontar ao simulador, e é a excepção certa: é
 * literalmente o cartão de "não encontrei o que preciso", e uma página sobre
 * um serviço indefinido não teria o que dizer.
 *
 * Todo o conteúdo sai do array partilhado — label, descrição, preço. O que
 * vive aqui são só as perguntas, que têm de ser específicas de cada serviço
 * para valerem alguma coisa a quem as lê e ao Google.
 */

/** Só os que não têm landing própria. O resto já tem página dedicada. */
const GERADAS = ["esvaziamento-apartamento", "montagem-moveis", "manutencao-casa"] as const;

type Pergunta = { q: string; a: string };

const PERGUNTAS: Record<string, Pergunta[]> = {
  "esvaziamento-apartamento": [
    {
      q: "O que é que entra num esvaziamento de apartamento?",
      a: "Tudo o que estiver lá dentro e o cliente quiser tirar: móveis, eletrodomésticos, roupa, livros, loiça, decoração e tralha acumulada. O profissional desmonta o que for preciso, carrega e deixa o espaço vazio.",
    },
    {
      q: "Quanto tempo demora?",
      a: "Um T1 ou T2 costuma fazer-se num dia. Um T3 ou T4 com arrecadação pode levar dois. O prazo fica combinado na proposta, antes de começar.",
    },
    {
      q: "É preciso estar presente?",
      a: "Não obrigatoriamente. Muitos esvaziamentos são feitos para heranças ou fim de arrendamento, com alguém a abrir a porta e a fechar no fim. Combina-se caso a caso.",
    },
    {
      q: "Para onde vai o que sai de casa?",
      // Igual à da página inicial desde 30-09-2026: quem transporta é o
      // profissional, e é a ele que as regras da plataforma obrigam.
      a: "O que ainda serve pode seguir para reutilização ou doação; o resto tem de ir para um operador licenciado. Quem transporta é o profissional, e as regras da plataforma obrigam-no a ter as autorizações que a lei exige. A CLYON está registada como operador de resíduos na Agência Portuguesa do Ambiente.",
    },
  ],
  "montagem-moveis": [
    {
      q: "Montam móveis comprados noutro sítio?",
      a: "Sim. IKEA, Conforama, JYSK, Leroy Merlin ou compra em segunda mão — desde que venham com as instruções e as ferragens.",
    },
    {
      q: "E desmontar para uma mudança?",
      a: "Sim, e é dos pedidos mais frequentes. Roupeiros, camas e estantes desmontam-se, embalam-se as ferragens, e volta a montar-se no destino.",
    },
    {
      q: "Trazem ferramentas?",
      a: "Sim. O profissional leva o que precisa, incluindo aparafusadora e nível. Se o móvel exigir fixação à parede, diga-o no pedido para o preço já contar com isso.",
    },
    {
      q: "Quanto custa montar um roupeiro?",
      a: `Depende do número de portas e de haver ou não fixação à parede. A montagem custa ${PRECOS.montagem_moveis.etiqueta.toLowerCase()}, sem IVA, e o valor exacto vem na proposta.`,
    },
  ],
  "manutencao-casa": [
    {
      q: "Que tipo de reparações entram aqui?",
      a: "Pequenos arranjos do dia a dia: fixar prateleiras, trocar puxadores e dobradiças, colocar cortinados e estores, vedar silicones, substituir tomadas e interruptores, apertar torneiras.",
    },
    {
      q: "Fazem obras?",
      a: "Não. Isto é manutenção, não remodelação. Para obra com alvenaria, canalização ou electricidade a sério, descreva o caso no pedido e é encaminhado para quem faça esse trabalho.",
    },
    {
      q: "Posso juntar vários arranjos no mesmo pedido?",
      a: "Sim, e sai mais barato do que pedir um a um — o profissional já está no local. Faça a lista no pedido para o preço contar com tudo.",
    },
    {
      q: "Quem responde por um trabalho mal feito?",
      a: PROMESSA.faqQuemResponde,
    },
  ],
};

/*
 * O QUE CONTA PARA O PREÇO, E PARA ONDE SEGUIR — 15-10-2026 (pente fino).
 *
 * As três páginas tinham pouco mais do que o preço e quatro perguntas. O
 * que se acrescenta é o que a pessoa pergunta a seguir: porque é que o
 * preço varia, onde há profissionais, e qual é a página do serviço maior
 * de que este faz parte.
 */
const FATORES: Record<string, string[]> = {
  "esvaziamento-apartamento": [
    "A tipologia e o recheio — um T1 com pouca mobília não é um T3 com arrecadação cheia.",
    "O andar, o elevador e a distância entre a porta e o sítio onde a carrinha pode parar.",
    "O que é preciso desmontar antes de sair: roupeiros, camas, móveis de cozinha.",
    "Eletrodomésticos e peças pesadas, que pedem mais gente para descer.",
    "O prazo: uma data fixa, ou a casa tem de ficar vazia até ao fim do arrendamento.",
  ],
  "montagem-moveis": [
    "O número de peças, e de portas e gavetas em cada uma.",
    "A fixação à parede — roupeiros altos, estantes e móveis de cozinha.",
    "Desmontar num sítio e montar noutro, ou só uma das duas.",
    "O andar e o acesso, quando é preciso carregar as caixas até à divisão.",
  ],
  "manutencao-casa": [
    "A lista de arranjos — vários no mesmo pedido saem mais em conta do que um a um.",
    "O material: se o profissional o leva, ou se já está em casa.",
    "A altura e o acesso — tetos altos, estores e cortinados por fora.",
    "A urgência, se tem de ficar resolvido num dia certo.",
  ],
};

const RELACIONADOS: Record<string, Array<{ href: string; texto: string }>> = {
  "esvaziamento-apartamento": [
    { href: "/esvaziamento-de-casas", texto: "Esvaziamento de casas, heranças e espólios" },
    { href: "/recolha-de-moveis", texto: "Recolha de móveis, peça a peça" },
    { href: "/recolha-de-monos", texto: "Recolha de monos" },
  ],
  "montagem-moveis": [
    { href: "/mudancas", texto: "Mudanças, com desmontagem e montagem" },
    { href: "/recolha-de-moveis", texto: "Recolha dos móveis velhos que saem" },
  ],
  "manutencao-casa": [
    { href: "/servicos/montagem-moveis", texto: "Montagem e desmontagem de móveis" },
    { href: "/recolha-de-monos", texto: "Recolha de monos" },
  ],
};

/** Os guias do blog que respondem a quem pede este serviço. */
const GUIAS: Record<string, string> = {
  "esvaziamento-apartamento": "esvaziamento-casas",
  "montagem-moveis": "mudancas",
};

const REGIOES_DO_SERVICO = [
  { href: "/regioes/lisboa", texto: "Lisboa" },
  { href: "/regioes/margem-sul", texto: "Margem Sul" },
  { href: "/regioes/setubal", texto: "Setúbal" },
];

type Props = { params: Promise<{ slug: string }> };

function categoriaDe(slug: string) {
  if (!(GERADAS as readonly string[]).includes(slug)) return null;
  return SERVICE_CATEGORIES.find((c) => c.slug === slug) ?? null;
}

export function generateStaticParams() {
  return GERADAS.map((slug) => ({ slug }));
}

export const dynamicParams = false;
export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = categoriaDe(slug);
  // Sem « | CLYON»: é o template do layout que o acrescenta (29-09-2026).
  if (!cat) return { title: "Serviço não encontrado" };

  const preco = PRECOS[cat.id];
  /*
   * O título que cabe no Google (29-09-2026). «Montagem e desmontagem de
   * móveis em Lisboa, Margem Sul e Setúbal | CLYON» tinha 72 caracteres, e o
   * Google corta aos 60 e reescreve o resto. Tenta-se a versão longa, depois
   * a curta, e no limite só o serviço — nunca um título cortado a meio.
   */
  const titulo =
    [`${cat.label} em Lisboa, Margem Sul e Setúbal`, `${cat.label} em Lisboa e Setúbal`].find(
      cabeNoGoogle,
    ) ?? cat.label;
  // Dizia «…em ordem. desde 57 €, sem IVA.» — a etiqueta guarda-se em
  // minúscula para ir a meio de uma frase (15-10-2026).
  const descricao = descricaoQueCabe([
    cat.description,
    preco ? `${comMaiuscula(maisIva(preco.etiqueta))}.` : null,
    `${PRAZO_DE_RESPOSTA.frase}, com profissionais verificados.`,
  ]);

  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: `${SITE_URL}/servicos/${slug}` },
    openGraph: og({ title: titulo, description: descricao, url: `${SITE_URL}/servicos/${slug}` }),
  };
}

export default async function ServicoGerado({ params }: Props) {
  const { slug } = await params;
  const cat = categoriaDe(slug);
  if (!cat) notFound();

  const preco = PRECOS[cat.id];
  const perguntas = PERGUNTAS[slug] ?? [];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: perguntas.map((p) => ({
      "@type": "Question",
      name: p.q,
      acceptedAnswer: { "@type": "Answer", text: p.a },
    })),
  };

  return (
    <div className="min-h-screen bg-white">
      <section className="secao bg-[#F4F8FB]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Sem o caminho «Início / …» à vista — 18-10-2026, a pedido do dono. Fica no JSON-LD. */}
          <h1 className="text-3xl font-bold leading-tight text-tinta sm:text-4xl lg:text-5xl">
            {cat.label}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-tinta-fraca sm:text-lg">
            {cat.description} Descreva o que precisa e receba propostas de profissionais
            verificados em Lisboa, Margem Sul e Setúbal.
          </p>

          {preco && (
            <div className="mt-7 inline-flex flex-col gap-1 rounded-2xl border border-[#E2EEF3] bg-white px-6 py-4">
              <span className="text-2xl font-bold text-acao">{comMaiuscula(preco.etiqueta)}</span>
              <span className="text-[13px] text-tinta-fraca">{NOTA_DE_PRECO.curta}</span>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/simulador" className="site-btn-primary px-6 py-3.5 text-base">
              Pedir propostas para o meu caso
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href={`tel:${BUSINESS_PHONE}`}
              className="site-btn-secondary px-6 py-3.5 text-base"
            >
              <Phone className="mr-2 h-4 w-4" aria-hidden="true" />
              {BUSINESS_PHONE}
            </a>
          </div>
        </div>
      </section>

      <section className="secao bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-tinta sm:text-3xl">Como funciona</h2>
          <ul className="mt-6 grid list-none gap-4 p-0 sm:grid-cols-3">
            {/*
              "Só paga depois de confirmar" deixou de ser verdade com o
              pagamento pela plataforma: paga-se a referência depois de
              aceitar, e é a entrega ao profissional que espera pela
              confirmação (30-09-2026).
            */}
            {[
              "Descreve o que precisa, com fotografias se ajudarem.",
              `Recebe propostas de profissionais da sua zona em menos de ${PRAZO_DE_RESPOSTA.porExtenso}, já com a taxa da plataforma.`,
              // Dizia «Só paga depois de confirmar», que se lia como «depois do
              // trabalho feito» — e quem paga pela plataforma paga a referência
              // logo a seguir a aceitar (29-09-2026).
              "Escolhe a que quiser — ou nenhuma, e só paga se contratar alguém. Pela plataforma, o valor só chega ao profissional depois de confirmar que ficou feito.",
            ].map((passo) => (
              <li
                key={passo}
                className="rounded-2xl border border-[#E2EEF3] bg-white p-5 text-sm leading-relaxed text-tinta-fraca"
              >
                <CheckCircle2 className="mb-3 h-5 w-5 text-acao" aria-hidden="true" />
                {passo}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {(FATORES[slug]?.length ?? 0) > 0 && (
        <section className="secao bg-[#F4F8FB]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-tinta sm:text-3xl">O que conta para o preço</h2>
            <ul className="mt-6 space-y-3">
              {FATORES[slug].map((fator) => (
                <li key={fator} className="flex items-start gap-3 text-sm leading-relaxed text-tinta-fraca">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-acao" aria-hidden="true" />
                  {fator}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm leading-relaxed text-tinta-fraca">
              Diga-o no pedido, com fotografias se ajudarem: as propostas chegam com o preço fechado
              antes de o trabalho começar.
            </p>
          </div>
        </section>
      )}

      <section className="secao bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-tinta sm:text-3xl">Onde há profissionais</h2>
          <p className="mt-4 text-sm leading-relaxed text-tinta-fraca">
            Há profissionais verificados em três regiões:{" "}
            {REGIOES_DO_SERVICO.map((r, i) => (
              <span key={r.href}>
                {i > 0 && " · "}
                <Link href={r.href} className="font-semibold text-acao underline-offset-2 hover:underline">
                  {r.texto}
                </Link>
              </span>
            ))}
            . Se a sua zona não aparece, peça na mesma — depende de haver profissional disponível.
          </p>
          {(RELACIONADOS[slug]?.length ?? 0) > 0 && (
            <>
              <h3 className="mt-8 text-lg font-semibold text-tinta">Também pode precisar de</h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {RELACIONADOS[slug].map((r) => (
                  <li key={r.href}>
                    <Link
                      href={r.href}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[#E2EEF3] bg-white px-5 py-4 text-sm font-semibold text-tinta transition hover:border-cyan-300"
                    >
                      {r.texto}
                      <ArrowRight className="h-4 w-4 shrink-0 text-acao" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {GUIAS[slug] && <GuiasDoServico servico={GUIAS[slug]} />}

      {perguntas.length > 0 && (
        <section className="secao bg-[#F4F8FB]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-tinta sm:text-3xl">Perguntas frequentes</h2>
            <dl className="mt-6 space-y-4">
              {perguntas.map((p) => (
                <div key={p.q} className="rounded-2xl border border-[#E2EEF3] bg-white p-5">
                  <dt className="text-base font-semibold text-tinta">{p.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-tinta-fraca">{p.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: BUSINESS_NAME, item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Serviços", item: `${SITE_URL}/servicos` },
              {
                "@type": "ListItem",
                position: 3,
                name: cat.label,
                item: `${SITE_URL}/servicos/${slug}`,
              },
            ],
          }),
        }}
      />
    </div>
  );
}
