import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, MapPin, ShieldCheck, FileText, Truck, CalendarDays, Circle } from "lucide-react";
import { perfilPublicoPorSlug, type PerfilPublico } from "@/lib/perfil-publico-do-profissional";
import { tService } from "@/lib/translations";
import { SITE_URL, BUSINESS_NAME } from "@/lib/seo-data";

/**
 * A PÁGINA DE UM PROFISSIONAL — a única do site que se escreve sozinha.
 *
 * Nenhum dos concorrentes portugueses tinha isto por acaso: a Fixando dá um
 * endereço próprio a cada especialista, e cada um deles é uma página indexada
 * que apanha pesquisas que a página de serviço nunca apanha. Nós tínhamos 160
 * URLs, todos escritos à mão, e zero páginas de pessoas.
 *
 * TRÊS COISAS AO MESMO TEMPO, e é por isso que compensa:
 *
 *   Para o CLIENTE que recebeu uma proposta — vê com quem vai lidar antes de
 *   deixar entrar dois desconhecidos em casa.
 *   Para o GOOGLE — conteúdo que muda sozinho, com avaliações reais, que
 *   nenhum concorrente pode copiar porque não tem estes trabalhos.
 *   Para o PROFISSIONAL — «tem uma página sua, que aparece no Google» é o
 *   argumento de recrutamento mais barato que existe, e não custa nada.
 *
 * O QUE NUNCA APARECE AQUI
 *
 * Telefone, email, NIF, IBAN, morada. A regra é a mesma do perfil dentro da
 * negociação e vem do `perfil-publico-do-profissional.ts`: o perfil dá
 * confiança, não dá o contacto. Numa página aberta ao mundo isso deixa de ser
 * uma regra de produto e passa a ser proteção de dados de quem trabalha
 * connosco.
 */

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

function estrelasPorExtenso(n: number | null): string {
  return n == null ? "" : n.toFixed(1).replace(".", ",");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await perfilPublicoPorSlug(slug);
  if (!p) return { title: "Profissional não encontrado | CLYON", robots: { index: false } };

  const servicos = p.categorias.map((c) => tService(c) || c).filter(Boolean);
  const onde = p.cidade ?? p.zonas[0] ?? null;

  /*
   * A DESCRIÇÃO É FEITA DO QUE EXISTE, e nunca de um molde com buracos.
   *
   * Um profissional sem avaliações não pode ter uma descrição que diga «0
   * avaliações» — isso é pior do que não ter descrição. Cada pedaço só entra
   * quando há mesmo alguma coisa para dizer.
   */
  const pedacos = [
    servicos.length > 0 ? servicos.slice(0, 3).join(", ") : "Serviços",
    onde ? `em ${onde}` : null,
    p.quantasAvaliacoes > 0
      ? `${estrelasPorExtenso(p.notaMedia)}★ de ${p.quantasAvaliacoes} ${p.quantasAvaliacoes === 1 ? "avaliação" : "avaliações"}`
      : null,
    p.trabalhosConcluidos > 0
      ? `${p.trabalhosConcluidos} ${p.trabalhosConcluidos === 1 ? "trabalho" : "trabalhos"} na CLYON`
      : null,
  ].filter(Boolean);

  return {
    title: `${p.nome} — ${servicos[0] ?? "Profissional"} ${onde ? `em ${onde} ` : ""}| CLYON`,
    description: `${p.nome}: ${pedacos.join(" · ")}. Peça um orçamento sem compromisso.`,
    alternates: { canonical: `${SITE_URL}/profissionais/${slug}` },
    openGraph: {
      title: `${p.nome} | CLYON`,
      description: pedacos.join(" · "),
      url: `${SITE_URL}/profissionais/${slug}`,
      type: "profile",
    },
  };
}

/** As estrelas, desenhadas. Meia estrela não se inventa: arredonda-se. */
function Estrelas({ nota, tamanho = 16 }: { nota: number; tamanho?: number }) {
  const cheias = Math.round(nota);
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: tamanho, height: tamanho }}
          className={i <= cheias ? "fill-amber-400 text-amber-400" : "text-slate-300"}
        />
      ))}
    </span>
  );
}

/**
 * ESTÁ POR PERTO?
 *
 * A linha mais rentável da app da Fixando é «Online nas últimas 48h», e faz
 * uma coisa só: transforma um nome numa pessoa disponível. Não se diz a data
 * exacta — isso é informação sobre a vida dele — diz-se se está por perto.
 */
function Presenca({ dias }: { dias: number | null }) {
  if (dias == null || dias > 30) return null;
  const activo = dias <= 2;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        activo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      <Circle
        className={`h-2 w-2 ${activo ? "fill-emerald-500 text-emerald-500" : "fill-slate-400 text-slate-400"}`}
        aria-hidden="true"
      />
      {dias === 0
        ? "Activo hoje"
        : dias <= 2
          ? "Activo nos últimos dias"
          : dias <= 7
            ? "Activo esta semana"
            : "Activo este mês"}
    </span>
  );
}

/** Os dados estruturados. É o que põe as estrelas no resultado do Google. */
function dadosEstruturados(p: PerfilPublico, slug: string) {
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/profissionais/${slug}#profissional`,
    name: p.nome,
    url: `${SITE_URL}/profissionais/${slug}`,
    ...(p.cidade ? { address: { "@type": "PostalAddress", addressLocality: p.cidade, addressCountry: "PT" } } : {}),
    ...(p.categorias.length > 0
      ? { knowsAbout: p.categorias.map((c) => tService(c) || c).filter(Boolean) }
      : {}),
    parentOrganization: { "@type": "Organization", name: BUSINESS_NAME, url: SITE_URL },
  };

  /*
   * A NOTA SÓ ENTRA SE FOR VERDADE.
   *
   * Um `aggregateRating` com zero avaliações é motivo de acção manual do
   * Google — e é justo que seja: são as estrelas que aparecem no resultado da
   * pesquisa, e inventá-las é enganar quem clica.
   */
  if (p.quantasAvaliacoes > 0 && p.notaMedia != null) {
    base.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: p.notaMedia,
      reviewCount: p.quantasAvaliacoes,
      bestRating: 5,
      worstRating: 1,
    };
  }
  return base;
}

export default async function PaginaDoProfissional({ params }: Props) {
  const { slug } = await params;
  const p = await perfilPublicoPorSlug(slug);
  if (!p) notFound();

  const servicos = p.categorias.map((c) => tService(c) || c).filter(Boolean);
  const desde = p.naClyonDesde
    ? new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(
        new Date(p.naClyonDesde),
      )
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosEstruturados(p, slug)) }}
      />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <nav className="mb-6 text-sm text-slate-500">
          <Link href="/" className="hover:underline">
            Início
          </Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700">{p.nome}</span>
        </nav>

        {/* ── Quem é ─────────────────────────────────────────────────────── */}
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-[Poppins] text-2xl font-bold text-tinta sm:text-3xl">
                {p.nome}
              </h1>
              {servicos.length > 0 && (
                <p className="mt-1 text-sm text-slate-600">{servicos.join(" · ")}</p>
              )}
            </div>
            <Presenca dias={p.diasDesdeOUltimoAcesso} />
          </div>

          {/*
            A NOTA, EM GRANDE — ou a verdade de que ainda não há nenhuma.

            Um profissional novo não tem avaliações, e escrever «0,0 ★» ao lado
            do nome dele é pior do que não escrever nada: parece uma nota má em
            vez de uma ausência. Diz-se que é novo, que é o que é.
          */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            {p.quantasAvaliacoes > 0 && p.notaMedia != null ? (
              <span className="flex items-center gap-2">
                <Estrelas nota={p.notaMedia} tamanho={18} />
                <span className="text-lg font-bold text-tinta">
                  {estrelasPorExtenso(p.notaMedia)}
                </span>
                <span className="text-sm text-slate-500">
                  ({p.quantasAvaliacoes} {p.quantasAvaliacoes === 1 ? "avaliação" : "avaliações"})
                </span>
              </span>
            ) : (
              <span className="rounded-full bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-800">
                Ainda sem avaliações na CLYON
              </span>
            )}

            {p.trabalhosConcluidos > 0 && (
              <span className="text-sm text-slate-600">
                <strong className="text-tinta">{p.trabalhosConcluidos}</strong>{" "}
                {p.trabalhosConcluidos === 1 ? "trabalho concluído" : "trabalhos concluídos"}
              </span>
            )}
          </div>

          {/* ── O que é verdade e se pode provar ─────────────────────────── */}
          <ul className="mt-5 grid gap-2 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2">
            {p.cidade && (
              <li className="flex items-center gap-2 text-slate-700">
                <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                Parte de {p.cidade}
                {p.raioKm ? `, até ${p.raioKm} km` : ""}
              </li>
            )}
            {desde && (
              <li className="flex items-center gap-2 text-slate-700">
                <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                Na CLYON desde {desde}
              </li>
            )}
            {p.emiteFatura && (
              <li className="flex items-center gap-2 text-slate-700">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                Passa fatura
              </li>
            )}
            {p.guiaVerificada && (
              <li className="flex items-center gap-2 text-slate-700">
                <Truck className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                Guia de transporte verificada pela CLYON
              </li>
            )}
            <li className="flex items-center gap-2 text-slate-700">
              <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              Aprovado pela CLYON
            </li>
          </ul>

          {/* Base e raio. A lista de zonas escrita à mão saiu: não era o que
              decidia o alcance dele, e um cliente que se visse nomeado nela
              podia estar fora do raio na mesma. */}
          {(p.cidade || p.raioKm != null) && (
            <p className="mt-4 text-sm text-slate-600">
              <span className="font-semibold text-tinta">Onde trabalha:</span>{" "}
              {p.cidade}
              {p.cidade && p.raioKm != null ? " " : ""}
              {p.raioKm != null && `e até ${p.raioKm} km em redor`}
            </p>
          )}
        </header>

        {/*
          O CAMINHO PARA O CONTRATAR NÃO É O TELEFONE DELE.

          O contacto abre depois de contratar, e não antes — a mesma regra que
          protege a morada do cliente do outro lado. Quem chega aqui pelo Google
          e quer este profissional pede um orçamento; se ele estiver dentro do
          raio, o pedido chega-lhe.
        */}
        <section className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-6 text-center">
          <p className="text-base font-semibold text-tinta">
            Quer {p.nome.split(" ")[0]} a fazer o seu trabalho?
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Descreva o que precisa. O pedido chega aos profissionais da sua zona — e a este,
            se estiver dentro do raio dele. Sem compromisso e sem pagar nada para pedir.
          </p>
          <Link
            href="/simulador"
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-acao px-6 text-base font-bold text-white transition hover:bg-acao-hover"
          >
            Pedir orçamento
          </Link>
        </section>

        {/* ── O que dizem dele ────────────────────────────────────────────── */}
        {p.avaliacoes.length > 0 && (
          <section className="mt-8">
            <h2 className="font-[Poppins] text-xl font-bold text-tinta">
              O que dizem os clientes
            </h2>
            <div className="mt-4 space-y-3">
              {p.avaliacoes.map((a, i) => (
                <article
                  key={`${a.avaliadoEm}-${i}`}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Estrelas nota={a.estrelas} />
                    {a.servicoTipo && (
                      <span className="text-sm font-medium text-slate-700">
                        {tService(a.servicoTipo) || a.servicoTipo}
                      </span>
                    )}
                    {a.cidade && <span className="text-sm text-slate-500">· {a.cidade}</span>}
                    {a.avaliadoEm && (
                      <span className="ml-auto text-xs text-slate-400">
                        {new Intl.DateTimeFormat("pt-PT", {
                          month: "long",
                          year: "numeric",
                        }).format(new Date(a.avaliadoEm))}
                      </span>
                    )}
                  </div>
                  {a.comentario && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      {a.comentario}
                    </p>
                  )}
                </article>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Todas as avaliações são de clientes que contrataram este profissional pela
              CLYON e confirmaram o trabalho feito. Não há avaliações compradas nem
              convidadas.
            </p>
          </section>
        )}
      </main>
    </>
  );
}
