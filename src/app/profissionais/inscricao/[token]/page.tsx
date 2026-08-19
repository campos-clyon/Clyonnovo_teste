import type { Metadata } from "next";
import Link from "next/link";
import { Clock, ShieldCheck } from "lucide-react";
import { convitePorTokenHash } from "@/lib/db";
import { hashDeToken, verificarTokenDeAcesso } from "@/lib/pedido-acesso";
import InscricaoForm from "../../InscricaoForm";

export const metadata: Metadata = {
  title: "Complete o seu registo — CLYON",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

/**
 * O formulário de inscrição, aberto pelo convite.
 *
 * O token é verificado aqui e outra vez na API. Não é redundância inútil: esta
 * página só decide o que desenhar, e quem envia o formulário pode nunca ter
 * passado por ela.
 *
 * Um convite gasto e um convite expirado dizem coisas diferentes, porque a
 * pessoa precisa de saber o que fazer a seguir — voltar a entrar na conta, ou
 * pedir-nos outro link.
 */
export default async function PaginaDoConvite({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const convite = await convitePorTokenHash(hashDeToken(token));
  const r = verificarTokenDeAcesso(token, convite?.tokenHash ?? null, convite?.expiraEm ?? null);

  const problema = !convite
    ? "invalido"
    : convite.usadoEm
      ? "usado"
      : convite.revogadoEm
        ? "revogado"
        : !r.valido
          ? "expirado"
          : null;

  if (problema) {
    const texto = {
      invalido: {
        titulo: "Este link não serve",
        corpo: "O endereço está incompleto ou foi alterado pelo caminho. Fale connosco e enviamos outro.",
      },
      usado: {
        titulo: "Já se inscreveu",
        corpo: "Este convite já foi usado. Se já definiu a palavra-passe, entre na sua conta; se não, procure o email de aprovação.",
      },
      revogado: {
        titulo: "Este convite foi anulado",
        corpo: "Fale connosco se acha que foi engano.",
      },
      expirado: {
        titulo: "Este convite expirou",
        corpo: "Os links duram poucos dias, por segurança. Diga-nos e enviamos outro para o mesmo email.",
      },
    }[problema];

    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
        <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <Clock className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-bold text-amber-900">{texto.titulo}</h1>
          <p className="mt-2 text-sm leading-relaxed text-amber-800">{texto.corpo}</p>
          <Link
            href="/contactos"
            className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-amber-600 px-5 text-sm font-semibold text-white"
          >
            Falar connosco
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Convite pessoal
        </span>
        <h1 className="mt-3 text-2xl font-bold text-[#0B1929] sm:text-3xl">
          {convite!.nome.split(/\s+/)[0]}, falta só o registo
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Diga-nos o que faz e onde trabalha. Confirmamos os dados e avisamo-lo por email
          quando a conta estiver activa.
        </p>
      </header>

      <InscricaoForm
        convite={token}
        nomeConvidado={convite!.nome}
        emailConvidado={convite!.email}
        telefoneConvidado={convite!.telefone ?? ""}
        veiculoConvidado={convite!.tipoVeiculo ?? ""}
      />
    </main>
  );
}
