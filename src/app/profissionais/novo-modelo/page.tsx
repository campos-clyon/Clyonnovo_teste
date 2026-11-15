import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { blocosDoTexto, comONome, pedacosDaLinha, type Bloco } from "@/lib/aviso-aos-profissionais";
import { conteudoEmVigor, interruptorDoAviso } from "@/lib/aviso-aos-profissionais-na-base";

/**
 * O «SABER MAIS» DO AVISO DO NOVO MODELO — d11 (15-11-2026).
 *
 * A página fixa para onde ligam a mensagem de WhatsApp e a faixa do painel. O
 * texto é o do email (a última versão guardada no backoffice, ou o rascunho),
 * desenhado aqui a partir do texto simples: nunca HTML cru vindo da base.
 *
 * SÓ ABRE com «Mostrar o aviso do novo modelo» ligado nas Configs (desligado
 * por omissão); desligado, é 404. Fora do Google: é para os profissionais.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "O que muda a 15 de novembro",
  description: "O pagamento dos trabalhos a partir de 15/11: o cliente paga ao profissional, e o profissional passa a taxa da plataforma à CLYON.",
  robots: { index: false, follow: false },
};

function Linha({ texto }: { texto: string }) {
  return (
    <>
      {pedacosDaLinha(texto).map((p, i) =>
        p.tipo === "negrito" ? (
          <strong key={i} className="font-semibold text-slate-900">
            {p.texto}
          </strong>
        ) : p.tipo === "ligacao" ? (
          <a key={i} href={p.url} className="text-[#007A8C] underline">
            {p.texto}
          </a>
        ) : (
          <span key={i}>{p.texto}</span>
        ),
      )}
    </>
  );
}

function OBloco({ b }: { b: Bloco }) {
  if (b.tipo === "subtitulo") return <h2 className="mt-8 text-lg font-semibold text-slate-900">{<Linha texto={b.texto} />}</h2>;
  if (b.tipo === "lista") {
    const itens = b.itens.map((i, n) => (
      <li key={n} className="pl-1">
        <Linha texto={i} />
      </li>
    ));
    return b.numerada ? (
      <ol className="mt-4 list-decimal space-y-3 pl-5">{itens}</ol>
    ) : (
      <ul className="mt-4 list-disc space-y-3 pl-5">{itens}</ul>
    );
  }
  return (
    <p className="mt-4">
      {b.linhas.map((l, i) => (
        <span key={i}>
          {i > 0 && <br />}
          <Linha texto={l} />
        </span>
      ))}
    </p>
  );
}

export default async function NovoModeloPage() {
  if (!(await interruptorDoAviso()).ligado) notFound();
  const c = await conteudoEmVigor();
  // O «Olá {nome},» é do email: aqui não há a quem tratar pelo nome.
  const blocos = blocosDoTexto(comONome(c.textoEmail, null)).filter(
    (b, i) => !(i === 0 && b.tipo === "paragrafo" && b.linhas.length === 1 && /^Olá\b/i.test(b.linhas[0])),
  );
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 text-[15px] leading-7 text-slate-700 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">{c.titulo}</h1>
        {blocos.map((b, i) => (
          <OBloco key={i} b={b} />
        ))}
        <div className="mt-8">
          <Link
            href="/profissionais/painel?ecra=banco"
            className="inline-block rounded-xl bg-[#00B4CC] px-5 py-3 text-sm font-semibold text-white"
          >
            Completar o perfil
          </Link>
        </div>
      </article>
    </main>
  );
}
