import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import { notFound } from "next/navigation";

import { getAllBlogPosts, getBlogPost } from "@/lib/blog-data";
import { BUSINESS_NAME, CONTACT_PATH, SITE_URL } from "@/lib/seo-data";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return { title: "Artigo não encontrado | CLYON" };
  }

  const canonical = `${SITE_URL}/blog/${post.slug}`;

  return {
    title: post.title,
    description: post.description,
    keywords: [...post.keywords, BUSINESS_NAME, "blog recolha", "blog entulho", "blog monos"],
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description: post.description,
      url: canonical,
      type: "article",
      locale: "pt_PT",
    },
  };
}

export const revalidate = 86400;
export const dynamicParams = false;

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) notFound();

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: post.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishDate,
    author: {
      "@type": "Organization",
      name: BUSINESS_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: BUSINESS_NAME,
    },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };

  const relatedPosts = getAllBlogPosts().filter((item) => item.slug !== post.slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_24%),linear-gradient(135deg,#ecfeff_0%,#ffffff_42%,#f8fafc_100%)]">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-24 sm:px-6 lg:px-8 lg:pb-16">
          <h1 className="mt-5 max-w-4xl text-[2.6rem] font-bold leading-[1.03] tracking-tight text-slate-950 sm:text-[4.2rem]">
            {post.title}
          </h1>
          <div className="mt-5 flex flex-wrap gap-4 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "long", year: "numeric" }).format(
                new Date(post.publishDate),
              )}
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              {post.readingTime}
            </span>
          </div>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">{post.intro}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <article className="space-y-8">
            {post.sections.map((section) => (
              <section
                key={section.title}
                className="rounded-[28px] border border-cyan-100 bg-white p-7 shadow-[0_20px_50px_-38px_rgba(14,116,144,0.16)]"
              >
                <h2 className="text-2xl font-bold text-slate-950">{section.title}</h2>
                <div className="mt-4 space-y-4 text-base leading-8 text-slate-600">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {section.bullets?.length ? (
                  <ul className="mt-5 space-y-3 text-base text-slate-700">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-3">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}

            <section className="rounded-[28px] bg-[linear-gradient(135deg,#062737_0%,#083344_100%)] p-7 text-white">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">Próximo passo</p>
              <h2 className="mt-3 text-3xl font-bold leading-tight">Quer resolver este pedido sem perder tempo?</h2>
              <p className="mt-4 text-base leading-8 text-slate-300">
                Use o simulador para ter uma referência de valor e depois confirme com a equipa da CLYON por
                contacto directo.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/simulador"
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-cyan-300"
                >
                  Abrir simulador
                </Link>
                <Link
                  href={CONTACT_PATH}
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Falar connosco
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </section>
          </article>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-cyan-100 bg-cyan-50/70 p-6">
              <p className="mt-3 text-2xl font-bold text-slate-950">{post.category}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {post.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs text-slate-600"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-cyan-100 bg-white p-6 shadow-[0_18px_40px_-34px_rgba(14,116,144,0.18)]">
              <div className="mt-5 space-y-4">
                {post.faq.map((item) => (
                  <div key={item.question} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-950">{item.question}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="mt-3 text-3xl font-bold text-slate-950">Artigos relacionados</h2>
            </div>
            <Link href="/blog" className="text-sm font-semibold text-cyan-700 transition hover:text-cyan-600">
              Ver blog completo
            </Link>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {relatedPosts.map((item) => (
              <article
                key={item.slug}
                className="rounded-[28px] border border-cyan-100 bg-white p-6 shadow-[0_20px_44px_-34px_rgba(14,116,144,0.16)]"
              >
                <h3 className="mt-4 text-2xl font-bold leading-tight text-slate-950">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">{item.description}</p>
                <Link
                  href={`/blog/${item.slug}`}
                  className="mt-6 inline-flex items-center text-sm font-semibold text-cyan-700 transition hover:text-cyan-600"
                >
                  Ler artigo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
