import Link from "next/link";
import { ArrowRight, CheckCircle2, ExternalLink, MapPin, Phone } from "lucide-react";

import CTABlock from "@/components/CTABlock";
import FAQSection, { type FAQItem } from "@/components/service/FAQSection";
import { caminhoDoServicoNaCidade } from "@/lib/caminho-da-cidade";
import { PRESTADOR, caminhoDaPagina } from "@/lib/dados-estruturados";
import { jsonLd } from "@/lib/json-ld";
import { CIDADES_MUDANCAS } from "@/lib/mudancas-cidades";
import { emTerra } from "@/lib/preposicao-da-terra";
import {
  ANO_DAS_TABELAS,
  TABELAS_REVISTAS_EM,
  comIva,
  comIvaEscrito,
  dataPorExtenso,
  euros,
  semIvaEscrito,
  type LinhaDaTabela,
  type PaginaDePreco as Pagina,
} from "@/lib/quanto-custa";
import { CONSULTADAS_EM, RECOLHA_DA_CAMARA, primeiraFrase } from "@/lib/recolha-da-camara";
import { PROPOSTAS_EM_ATE } from "@/lib/promessas-publicas";
import { BUSINESS_PHONE, NOTA_DE_PRECO, SITE_URL } from "@/lib/seo-data";
import { RAIO_INCLUIDO_KM } from "@/lib/tabela-das-mudancas";

/**
 * O DESENHO DAS PÁGINAS «QUANTO CUSTA» — 17-10-2026. Ver `quanto-custa.ts`.
 *
 * Uma página responde a uma pergunta: a resposta vem logo no primeiro
 * parágrafo, com o número, e o resto da página explica-a — a tabela sem e com
 * IVA, exemplos feitos pela mesma conta do motor, o que faz o preço variar, e o
 * que a câmara de cada concelho recolhe de graça, com a fonte oficial.
 */

const TONS = {
  recolha: {
    destaque: "text-acao",
    borda: "border-cyan-100",
    suave: "bg-cyan-50/70",
    selo: "border-cyan-200 bg-cyan-50 text-acao",
    botao: "site-btn-primary px-6",
    ligacao: "font-semibold text-acao hover:underline",
  },
  mudanca: {
    destaque: "text-emerald-700",
    borda: "border-emerald-100",
    suave: "bg-emerald-50/60",
    selo: "border-emerald-300 bg-emerald-50 text-emerald-700",
    botao:
      "inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-600",
    ligacao: "font-semibold text-emerald-700 hover:underline",
  },
} as const;

export type ConteudoDaPaginaDePreco = {
  pagina: Pagina;
  tom: keyof typeof TONS;
  h1: string;
  /** A resposta à pergunta do título, com o número — o primeiro parágrafo. */
  resposta: string;
  tabela: { titulo: string; linhas: LinhaDaTabela[] };
  extras?: { titulo: string; intro?: string; linhas: LinhaDaTabela[] };
  exemplos?: {
    titulo: string;
    intro: string;
    itens: Array<{ titulo: string; conta: string[]; totalSemIva: number; nota?: string }>;
  };
  /** Uma caixa de apoio — «quanto é 1 m³», «o que conta como mono». */
  caixa?: { titulo: string; itens: string[] };
  fatores: string[];
  /** O que se mostra concelho a concelho. */
  porConcelho: "monos" | "entulho" | "esvaziamento" | "mudancas";
  faqs: FAQItem[];
  relacionados: Array<{ href: string; titulo: string }>;
  /** O que se declara ao Google — só o que a página mostra. */
  oferta: Record<string, unknown>;
  ctaTitulo: string;
  mensagemWhatsApp: string;
};

/*
 * No telemóvel a coluna «Com IVA» ficava fora do ecrã, à espera de que alguém
 * deslizasse a tabela — e é a coluna que interessa. Ali, os dois valores vão
 * na mesma célula, um por baixo do outro; a partir de `sm`, em colunas.
 */
function Tabela({ linhas, tom }: { linhas: LinhaDaTabela[]; tom: (typeof TONS)[keyof typeof TONS] }) {
  return (
    <div className={`overflow-x-auto rounded-2xl border ${tom.borda} bg-white`}>
      <table className="w-full border-collapse text-left text-sm sm:min-w-[30rem]">
        <thead>
          <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-4 py-3 font-semibold">O quê</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Sem IVA</th>
            <th scope="col" className="hidden px-4 py-3 text-right font-semibold sm:table-cell">Com IVA</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.oQue} className="border-t border-slate-100 align-top">
              <td className="px-4 py-3">
                <span className="font-semibold text-slate-900">{l.oQue}</span>
                {l.exemplo && <span className="mt-0.5 block text-xs text-slate-500">{l.exemplo}</span>}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                <span className="whitespace-nowrap">{semIvaEscrito(l.valor, l.unidade)}</span>
                {l.valor.tipo !== "orcamento" && (
                  <span className="mt-1 block whitespace-nowrap text-xs font-semibold text-slate-900 sm:hidden">
                    {comIvaEscrito(l.valor, l.unidade)} com IVA
                  </span>
                )}
              </td>
              <td className="hidden whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-900 sm:table-cell">
                {comIvaEscrito(l.valor, l.unidade)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PorConcelho({ c, tom }: { c: ConteudoDaPaginaDePreco; tom: (typeof TONS)[keyof typeof TONS] }) {
  const p = c.pagina;

  if (c.porConcelho === "mudancas") {
    return (
      <>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          O preço da hora é o mesmo em todos os concelhos, e a deslocação está incluída até aos{" "}
          {RAIO_INCLUIDO_KM} km de percurso. O que muda de terra para terra são os acessos e o estacionamento: cada página explica os da
          sua.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {CIDADES_MUDANCAS.map((cidade) => (
            <Link
              key={cidade.slug}
              href={`/mudancas/${cidade.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Mudanças {emTerra(cidade.nome)}
            </Link>
          ))}
        </div>
      </>
    );
  }

  const concelhos = Object.entries(RECOLHA_DA_CAMARA);

  if (c.porConcelho === "esvaziamento") {
    return (
      <>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          Os valores de referência são os mesmos em toda a zona. As câmaras recolhem monos de graça, por
          marcação, mas não esvaziam casas inteiras. Veja o que muda na sua terra:
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {concelhos.map(([slug, camara]) => (
            <Link
              key={slug}
              href={caminhoDoServicoNaCidade(p.servicoDaCidade, slug)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-acao"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Esvaziamento {emTerra(camara.concelho)}
            </Link>
          ))}
        </div>
      </>
    );
  }

  const tipo = c.porConcelho;
  const comInformacao = concelhos.filter(([, camara]) => camara[tipo]);
  const nomeDoServico = tipo === "monos" ? "Recolha de monos" : "Recolha de entulho";

  return (
    <>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        Os valores de referência são os mesmos em toda a zona. O que muda de concelho para concelho é o que o
        município recolhe de graça, e com que regras. Está aqui, com a fonte oficial, para escolher com tudo à
        frente. Fontes consultadas a {dataPorExtenso(CONSULTADAS_EM)}.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {comInformacao.map(([slug, camara]) => {
          const info = camara[tipo]!;
          const fonte = info.fontes[0];
          return (
            <article key={slug} className={`flex flex-col rounded-2xl border ${tom.borda} bg-white p-5`}>
              <h3 className="text-lg font-bold text-slate-900">{camara.concelho}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{primeiraFrase(info.texto)}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <Link href={caminhoDoServicoNaCidade(p.servicoDaCidade, slug)} className={tom.ligacao}>
                  {nomeDoServico} {emTerra(camara.concelho)}
                </Link>
                {fonte && (
                  <a
                    href={fonte.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Fonte: {fonte.nome} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

export default function PaginaDePreco({ c }: { c: ConteudoDaPaginaDePreco }) {
  const tom = TONS[c.tom];
  const p = c.pagina;
  const url = `${SITE_URL}${p.caminho}`;
  const pedir = `/simulador?servico=${p.servico}`;
  // Dentro do @graph, sem o @context próprio que `caminhoDaPagina` traz.
  const { itemListElement } = caminhoDaPagina([
    ["Preços", "/precos"],
    [p.nome, p.caminho],
  ]);
  const caminho = { "@type": "BreadcrumbList", itemListElement };

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        serviceType: p.nome,
        name: c.h1,
        description: c.resposta,
        provider: PRESTADOR,
        areaServed: Object.values(RECOLHA_DA_CAMARA).map((camara) => ({ "@type": "City", name: camara.concelho })),
        offers: c.oferta,
      },
      {
        "@type": "FAQPage",
        mainEntity: c.faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      },
      caminho,
    ],
  };

  return (
    <div className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />

      {/* Sem o caminho «Início / …» à vista — 18-10-2026, a pedido do dono. Fica no JSON-LD. */}

      {/* ── A pergunta, e a resposta logo a seguir ── */}
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
        <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl">
          {c.h1}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-700 sm:text-lg">{c.resposta}</p>
        <p className="mt-3 text-xs text-slate-500">
          Tabela conferida com o motor de preços a {dataPorExtenso(TABELAS_REVISTAS_EM)}.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href={pedir} className={tom.botao}>
            Pedir propostas grátis <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Link>
          <a
            href={`tel:${BUSINESS_PHONE}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
          >
            <Phone className="h-4 w-4" aria-hidden="true" /> Ligar {BUSINESS_PHONE}
          </a>
        </div>
      </section>

      {/* ── A tabela ── */}
      <section className="bg-slate-50 py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">{c.tabela.titulo}</h2>
          <div className="mt-5">
            <Tabela linhas={c.tabela.linhas} tom={tom} />
          </div>
          {c.extras && (
            <div className="mt-8">
              <h3 className="text-lg font-bold text-slate-900">{c.extras.titulo}</h3>
              {c.extras.intro && <p className="mt-1 text-sm text-slate-600">{c.extras.intro}</p>}
              <div className="mt-3">
                <Tabela linhas={c.extras.linhas} tom={tom} />
              </div>
            </div>
          )}
          <p className="mt-5 text-sm leading-relaxed text-slate-500">{NOTA_DE_PRECO.completa}</p>
        </div>
      </section>

      {/* ── Exemplos e a caixa de apoio ── */}
      {(c.exemplos || c.caixa) && (
        <section className="py-12">
          <div className="mx-auto max-w-4xl space-y-8 px-4 sm:px-6">
            {c.exemplos && (
              <div>
                <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">{c.exemplos.titulo}</h2>
                <p className="mt-2 text-sm text-slate-600">{c.exemplos.intro}</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {c.exemplos.itens.map((e) => (
                    <article key={e.titulo} className={`rounded-2xl border ${tom.borda} bg-white p-5`}>
                      <h3 className="font-bold text-slate-900">{e.titulo}</h3>
                      <ul className="mt-3 space-y-1 text-xs leading-relaxed text-slate-600">
                        {e.conta.map((linha) => (
                          <li key={linha}>{linha}</li>
                        ))}
                      </ul>
                      <p className="mt-4 text-sm text-slate-700">
                        <span className="text-lg font-bold tabular-nums text-slate-900">≈ {euros(e.totalSemIva)}</span> + IVA
                        <span className="text-slate-500"> · ≈ {euros(comIva(e.totalSemIva))} com IVA</span>
                      </p>
                      {e.nota && <p className="mt-2 text-xs text-slate-500">{e.nota}</p>}
                    </article>
                  ))}
                </div>
              </div>
            )}
            {c.caixa && (
              <div className={`rounded-2xl border ${tom.borda} ${tom.suave} p-6`}>
                <h2 className="text-xl font-bold text-slate-900">{c.caixa.titulo}</h2>
                <ul className="mt-3 space-y-2">
                  {c.caixa.itens.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${tom.destaque}`} aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── O que faz variar ── */}
      <section className={c.exemplos || c.caixa ? "bg-slate-50 py-12" : "py-12"}>
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">O que faz o preço subir ou descer</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {c.fatores.map((f) => (
              <li key={f} className={`flex items-start gap-2 rounded-2xl border ${tom.borda} bg-white p-4 text-sm text-slate-700`}>
                <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${tom.destaque}`} aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Concelho a concelho ── */}
      <section className="py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Concelho a concelho</h2>
          <PorConcelho c={c} tom={tom} />
        </div>
      </section>

      {/* ── Perguntas — o FAQPage já vai no @graph de cima ── */}
      <section className="bg-slate-50 px-4 sm:px-6">
        <FAQSection title={`Perguntas sobre o preço: ${p.nome.toLowerCase()}`} faqs={c.faqs} includeSchema={false} />
      </section>

      {/* ── Para continuar ── */}
      <section className="py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-xl font-bold text-slate-900">Para ler a seguir</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {c.relacionados.map((r) => (
              <li key={r.href}>
                <Link
                  href={r.href}
                  className={`flex h-full items-center justify-between gap-3 rounded-2xl border ${tom.borda} bg-white p-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50`}
                >
                  {r.titulo} <ArrowRight className={`h-4 w-4 shrink-0 ${tom.destaque}`} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-slate-50 py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <CTABlock
            variant="centered"
            title={c.ctaTitulo}
            description={`Propostas grátis ${PROPOSTAS_EM_ATE}, sem compromisso.`}
            primaryText="Pedir orçamento"
            primaryHref={pedir}
            showWhatsApp
            showPhone
            whatsappMessage={c.mensagemWhatsApp}
          />
        </div>
      </section>
    </div>
  );
}
