import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, FileText, Phone, Truck } from "lucide-react";

import { jsonLd } from "@/lib/json-ld";
import { og } from "@/lib/open-graph";
import { PRESTADOR } from "@/lib/dados-estruturados";
import { ESPACOS_DA_EMPRESA, ESVAZIAMENTO_DE_EMPRESA, PEDIDOS_DA_EMPRESA } from "@/lib/esvaziamento-de-empresa";
import { PROPOSTAS_EM_ATE } from "@/lib/promessas-publicas";
import { BUSINESS_PHONE, SITE_URL, pagamentoDasEmpresas } from "@/lib/seo-data";
import { agoraDoModelo } from "@/lib/relogio-do-modelo";
import { pedirNoSimulador } from "@/lib/servico-na-ligacao";
import { telefoneLegivel } from "@/lib/telefone-legivel";

/*
 * ESVAZIAMENTO DE ARMAZÉNS, ESCRITÓRIOS E LOJAS — 15-11-2026 (d43).
 *
 * A página do tipo de serviço novo (`esvaziamento_empresa`). Diz só o que a
 * plataforma faz: a CLYON recebe o pedido e envia-o a parceiros da zona; quem
 * esvazia é o parceiro escolhido, com a sua equipa. Sem preço publicado —
 * cada parceiro orça o espaço pelas fotografias —, a fatura pela frase das
 * empresas (`pagamentoDasEmpresas`), a guia de transporte a pedido e o fora
 * de horas a pedido. Ligada a partir de /empresas e de /esvaziamento-de-casas.
 */

const URL = `${SITE_URL}/esvaziamento-de-armazens-e-escritorios`;
const TITULO = "Esvaziamento de Armazéns, Escritórios e Lojas";
const DESCRICAO =
  "Esvaziamento de armazéns, escritórios e lojas em Lisboa, Margem Sul e Setúbal: propostas de parceiros da zona, fatura com NIF e guia a pedido.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRICAO,
  alternates: { canonical: URL },
  openGraph: og({ title: TITULO, description: DESCRICAO, url: URL }),
};

// De hora a hora, como /empresas: a frase do pagamento e da fatura segue a data do modelo.
export const revalidate = 3600;


const INCLUIDO = [
  "Desmontagem de secretárias, estantes, prateleiras e balcões",
  "Carregamento e transporte de tudo o que sai, incluindo o equipamento e o arquivo morto",
  "Destino licenciado para o que sai, e reaproveitamento do que ainda serve",
  "O espaço livre para a entrega das chaves, a obra ou o novo inquilino",
];

const PASSOS = [
  { titulo: "Descreva o espaço", texto: "Diga se é armazém, escritório ou loja, quanto há para levar e envie fotografias." },
  { titulo: "Receba propostas", texto: `Parceiros da zona respondem ${PROPOSTAS_EM_ATE}, cada um com o seu preço.` },
  { titulo: "Escolha e combine", texto: "O parceiro escolhido combina consigo o dia e a hora, também fora do horário da loja ou do escritório." },
];

const PERGUNTAS = [
  {
    pergunta: "Quanto custa esvaziar um armazém ou um escritório?",
    resposta:
      "Depende do tamanho do espaço, de quanto há para levar, do acesso e do que é preciso desmontar. Por isso não há tabela: cada parceiro orça o espaço pelas fotografias e pelo que nos disser, e escolhe a proposta que lhe servir.",
  },
  {
    pergunta: "Pode ser fora de horas?",
    resposta: `Sim, se o pedir. Marque «${PEDIDOS_DA_EMPRESA.foraDeHoras}» no pedido e a proposta diz em que dias e horas o parceiro o faz.`,
  },
  {
    pergunta: "Precisam da guia de transporte dos resíduos?",
    resposta:
      "Se a sua empresa precisar da e-GAR, diga-o no pedido: vai para parceiros que a emitem, e a proposta diz se vem incluída.",
  },
  {
    pergunta: "Passam fatura com o NIF da empresa?",
    resposta: pagamentoDasEmpresas(agoraDoModelo()),
  },
];

export default function EsvaziamentoDeArmazensPage() {
  const servico = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: TITULO,
    url: URL,
    provider: PRESTADOR,
    description: DESCRICAO,
    areaServed: ["Lisboa", "Margem Sul", "Setúbal"].map((name) => ({ "@type": "AdministrativeArea", name })),
  };
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PERGUNTAS.map((p) => ({ "@type": "Question", name: p.pergunta, acceptedAnswer: { "@type": "Answer", text: p.resposta } })),
  };
  const migalhas = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Empresas", item: `${SITE_URL}/empresas` },
      { "@type": "ListItem", position: 3, name: TITULO, item: URL },
    ],
  };

  return (
    <div className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(servico) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(migalhas) }} />

      <section className="sob-o-menu bg-gradient-to-br from-cyan-50 via-white to-white">
        <div className="mx-auto max-w-5xl px-6 py-14 lg:px-8 lg:py-20">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Esvaziamento de armazéns, escritórios e lojas
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Fechar uma loja, mudar de escritório, libertar um armazém: diga o que há no espaço e receba
            propostas de parceiros de Lisboa, da Margem Sul e de Setúbal. Uma empresa
            parceira, com a sua equipa, desmonta, carrega e leva tudo.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={pedirNoSimulador(ESVAZIAMENTO_DE_EMPRESA)} className="site-btn-primary min-w-[220px] px-6 py-3.5">
              Pedir propostas
            </Link>
            <a
              href={`tel:${BUSINESS_PHONE}`}
              className="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 transition hover:border-cyan-300"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {telefoneLegivel(BUSINESS_PHONE)}
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
        <h2 className="text-2xl font-bold text-slate-950">O que está incluído</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {INCLUIDO.map((linha) => (
            <li key={linha} className="flex gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm leading-6 text-slate-700">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-acao" aria-hidden="true" />
              {linha}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-600">
          Espaços: {ESPACOS_DA_EMPRESA.filter((e) => e.id !== "outro").map((e) => e.nome.toLowerCase()).join(", ")} e
          outros espaços de trabalho. O que cada proposta inclui vem escrito nela.
        </p>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-950">O que a sua empresa pode pedir</h2>
          <dl className="mt-6 space-y-5 text-sm leading-7 text-slate-700">
            <div className="flex gap-3">
              <FileText className="mt-1 h-5 w-5 flex-shrink-0 text-acao" aria-hidden="true" />
              <div>
                <dt className="font-semibold text-slate-900">Fatura com NIF</dt>
                <dd>{pagamentoDasEmpresas(agoraDoModelo())}</dd>
              </div>
            </div>
            <div className="flex gap-3">
              <Truck className="mt-1 h-5 w-5 flex-shrink-0 text-acao" aria-hidden="true" />
              <div>
                <dt className="font-semibold text-slate-900">Guia de transporte (e-GAR), a pedido</dt>
                <dd>Diga-o no pedido: vai para parceiros que a emitem, e a proposta diz se vem incluída.</dd>
              </div>
            </div>
            <div className="flex gap-3">
              <Clock className="mt-1 h-5 w-5 flex-shrink-0 text-acao" aria-hidden="true" />
              <div>
                <dt className="font-semibold text-slate-900">Fora de horas, a pedido</dt>
                <dd>À noite ou ao fim de semana, para não fechar a loja nem parar o escritório. A proposta diz quando o parceiro o faz.</dd>
              </div>
            </div>
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
        <h2 className="text-2xl font-bold text-slate-950">Como funciona, em 3 passos</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="rounded-xl border border-slate-200 bg-white p-5">
              <span className="text-sm font-bold text-acao">{i + 1}</span>
              <h3 className="mt-1 font-semibold text-slate-900">{p.titulo}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{p.texto}</p>
            </li>
          ))}
        </ol>
        <Link href={pedirNoSimulador(ESVAZIAMENTO_DE_EMPRESA)} className="site-btn-primary mt-8 inline-flex min-w-[220px] px-6 py-3.5">
          Pedir propostas
        </Link>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-950">Perguntas frequentes</h2>
          <div className="mt-6 space-y-5">
            {PERGUNTAS.map((p) => (
              <div key={p.pergunta}>
                <h3 className="font-semibold text-slate-900">{p.pergunta}</h3>
                <p className="mt-1 text-sm leading-7 text-slate-700">{p.resposta}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-slate-600">
            É uma casa e não um espaço de trabalho? Veja o{" "}
            <Link href="/esvaziamento-de-casas" className="font-semibold text-acao hover:underline">
              esvaziamento de casas e recheios
            </Link>
            . Recolhas, mudanças de escritório e reparações para empresas:{" "}
            <Link href="/empresas" className="font-semibold text-acao hover:underline">
              tudo o que a sua empresa pode pedir
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
