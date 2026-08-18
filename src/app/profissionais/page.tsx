import type { Metadata } from "next";
import Link from "next/link";
import { Camera, HandCoins, Lock, MapPin } from "lucide-react";
import InscricaoForm from "./InscricaoForm";

export const metadata: Metadata = {
  title: "Receba pedidos na sua zona — CLYON para profissionais",
  description:
    "Inscreva-se e receba pedidos com fotografias, zona e o valor que o cliente quer pagar. Responde com um valor e sabe o que recebe antes de aceitar. Pagamento garantido pela plataforma.",
  alternates: { canonical: "https://clyon.pt/profissionais" },
};

export const revalidate = 3600;

/**
 * A página de quem vai trabalhar.
 *
 * O que ela tem de responder, por esta ordem, é o que um profissional pergunta
 * antes de se inscrever: o que me chega, quanto recebo, e quando recebo. Só
 * depois é que faz sentido pedir-lhe os dados.
 *
 * Sobre as percentagens: dizê-las na página em vez de as esconder no registo é
 * deliberado. Quem descobre a comissão depois de se inscrever sente-se
 * enganado, e um profissional que se sente enganado não volta — e conta aos
 * outros.
 */

const O_QUE_RECEBE = [
  {
    icon: Camera,
    title: "Pedidos com fotografias",
    description:
      "Vê o trabalho antes de responder. Com fotografias dá um valor a sério, em vez de um palpite que depois não se aguenta à porta do cliente.",
  },
  {
    icon: MapPin,
    title: "Só o que lhe serve",
    description:
      "Categorias que faz, dentro do raio que indicou. Não lhe mandamos o resto — ao terceiro email irrelevante cancelava a subscrição e perdia os que interessavam.",
  },
  {
    icon: HandCoins,
    title: "Sabe o que recebe",
    description:
      "O valor aparece líquido, já com a comissão descontada. Sem contas para fazer e sem surpresas no fim.",
  },
  {
    icon: Lock,
    title: "Pagamento garantido",
    description:
      "O cliente paga à plataforma quando o contrata. O valor fica retido e é seu assim que ele confirmar que o trabalho está feito — não anda atrás de ninguém para receber.",
  },
];

export default function ProfissionaisPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-cyan-50 via-white to-blue-50 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#0B1929] sm:text-4xl lg:text-5xl">
            Receba pedidos da sua zona
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Sem investir em publicidade e sem comprar contactos. O cliente descreve o
            trabalho com fotografias e diz quanto quer pagar — você responde com um
            valor.
          </p>
          <p className="mt-5 text-sm text-slate-500">
            Já se inscreveu?{" "}
            <Link
              href="/profissionais/entrar"
              className="font-semibold text-cyan-600 hover:underline"
            >
              Entrar no painel
            </Link>
          </p>
        </div>
      </section>

      {/* ── O que recebe ──────────────────────────────────────────────── */}
      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {O_QUE_RECEBE.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50">
                  <item.icon className="h-5 w-5 text-cyan-600" aria-hidden="true" />
                </div>
                <h2 className="mt-3 text-base font-bold text-[#0B1929]">{item.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quanto custa ──────────────────────────────────────────────── */}
      <section className="bg-[#F4F8FB] py-10 sm:py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-[#0B1929] sm:text-3xl">
            Quanto custa
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-600 sm:text-base">
            Inscrever-se é gratuito. Não se paga por contacto nem por proposta — só há
            comissão quando fecha um trabalho.
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl border border-[#E2EEF3] bg-white">
            <div className="grid gap-px bg-[#E2EEF3] sm:grid-cols-2">
              <div className="bg-white px-6 py-6 text-center">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Combina com o cliente
                </div>
                <div className="mt-1.5 text-3xl font-bold text-[#0B1929]">200 €</div>
              </div>
              <div className="bg-white px-6 py-6 text-center">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Recebe
                </div>
                <div className="mt-1.5 text-3xl font-bold text-emerald-600">190 €</div>
                <p className="mt-1 text-xs text-slate-500">Já inclui a taxa CLYON</p>
              </div>
            </div>
            <div className="border-t border-[#E2EEF3] bg-[#F4F8FB] px-6 py-4 text-center">
              <p className="text-xs leading-relaxed text-slate-500">
                A fatura do serviço é sua, e o IVA depende do seu regime — a CLYON não
                se mete nisso e fatura apenas a comissão dela.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Inscrição ─────────────────────────────────────────────────── */}
      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-[#0B1929] sm:text-3xl">Inscrição</h2>
          <p className="mt-2 text-sm text-slate-600">
            Demora dois minutos. Analisamos o registo antes de começar a receber
            pedidos — é o que permite dizer ao cliente que quem lhe aparece foi
            verificado.
          </p>

          <div className="mt-6">
            <InscricaoForm />
          </div>
        </div>
      </section>
    </div>
  );
}
