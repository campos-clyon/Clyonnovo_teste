import type { Metadata } from "next";
import Link from "next/link";
import { BadgeEuro, ClipboardCheck, Lock, MapPin } from "lucide-react";
import { PERGUNTAS_DO_PROFISSIONAL } from "@/lib/ajuda-plataforma";
import { TAXA_PROFISSIONAL } from "@/lib/taxas-plataforma";
import InscricaoForm from "../InscricaoForm";

/**
 * A CANDIDATURA ABERTA — a porta da rua.
 *
 * É onde aterra quem carrega em «Tornar-me parceiro» na homepage. Até
 * 01-09-2026 esse botão abria uma conversa de WhatsApp; agora abre isto, e o
 * que ele escrever cai directamente na fila «Por aprovar» do backoffice.
 *
 * NÃO É A PÁGINA DO CONVITE. A do convite (`[token]/page.tsx`) sabe o nome de
 * quem vem, já falou com ele, e trata-o por tu-a-tu. Esta recebe um
 * desconhecido que acabou de ler uma secção da homepage: tem de dizer o que
 * isto é, quanto custa e o que acontece a seguir, ANTES de lhe pedir o NIF.
 *
 * PORQUE É QUE AS EXPLICAÇÕES ESTÃO ATRÁS DE UM TOQUE
 *
 * Porque 82% das visitas são de telemóvel, e num ecrã de 360 px sete
 * parágrafos entre o título e o primeiro campo são sete écrãs de rolamento que
 * ninguém faz — as respostas ficavam lá, por ler, e a candidatura mesmo assim
 * chegava cheia de dúvidas. Fechadas, vêem-se as sete perguntas de uma vez, e
 * abre-se a que interessa.
 *
 * E NENHUMA DELAS É ESCRITA AQUI. Vêm de `PERGUNTAS_DO_PROFISSIONAL`, que é a
 * mesma lista que o painel dele mostra depois de entrar, e cujos números saem
 * das constantes que o motor usa. Escritas à mão nesta página, a comissão
 * ficaria a dizer 5% no dia em que passasse a outra coisa — e este é o ecrã
 * onde a promessa é feita.
 */

export const metadata: Metadata = {
  title: "Candidate-se a receber pedidos — CLYON",
  description:
    "Candidatura para profissionais de recolha, transporte e esvaziamento. Analisamos cada candidatura antes de aprovar.",
  /*
   * SEM INDEXAÇÃO, e não é contradição com ser pública.
   *
   * Enquanto o resto da plataforma responder 404 a quem não tem a chave do
   * MVP, indexar esta página é publicar uma folha órfã: o Google segue os
   * links dela e não consegue ler nenhum. Quando o portão cair, tira-se.
   *
   * Não se copia o `nocache` da página do convite — esse existe porque o link
   * do convite é privado, e este endereço é para ser partilhado.
   */
  robots: { index: false, follow: false },
};

/** O que ele precisa de saber antes de decidir preencher. Nada de números novos. */
const O_ESSENCIAL = [
  {
    icon: BadgeEuro,
    titulo: "Só paga quando ganha",
    corpo: `Candidatar-se é gratuito e não se paga por contacto nem por proposta. A comissão é de ${Math.round(
      TAXA_PROFISSIONAL * 100,
    )} % e só existe quando fecha um trabalho.`,
  },
  {
    icon: MapPin,
    titulo: "Escolhe o que faz e onde",
    corpo:
      "Só lhe chegam pedidos dos serviços que faz e de trabalhos até aos quilómetros que indicar, contados a partir da sua base. Muda isso quando quiser, no painel.",
  },
  {
    icon: ClipboardCheck,
    titulo: "Há uma análise pelo meio",
    corpo:
      "Não fica com acesso ao carregar em enviar. Alguém lê a candidatura, e se faltar alguma coisa falamos consigo antes de decidir.",
  },
  {
    icon: Lock,
    titulo: "O dinheiro fica garantido",
    corpo:
      "O cliente paga à CLYON quando o contrata e o valor fica cativo até o trabalho estar feito. Não anda atrás de ninguém para receber.",
  },
];

export default function PaginaDaCandidatura() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header>
        <h1 className="text-2xl font-bold text-[#0B1929] sm:text-3xl">
          Candidate-se a receber pedidos
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Diga-nos o que faz e onde trabalha. Analisamos cada candidatura: se faltar
          alguma coisa, falamos consigo. Depois de aprovada, recebe por email o link
          para definir a palavra-passe e passa a ver os pedidos da sua zona.{" "}
          <strong className="font-semibold text-slate-800">Até lá não recebe pedidos.</strong>
        </p>
      </header>

      {/* ── O essencial, sem ter de abrir nada ───────────────────────── */}
      <section aria-labelledby="essencial" className="mt-7">
        <h2 id="essencial" className="sr-only">
          Como funciona
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {O_ESSENCIAL.map((item) => (
            <div
              key={item.titulo}
              className="rounded-2xl border border-[#E2EEF3] bg-white p-4 shadow-sm"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50">
                <item.icon className="h-5 w-5 text-cyan-600" aria-hidden="true" />
              </div>
              <h3 className="mt-2.5 text-sm font-bold text-[#0B1929]">{item.titulo}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{item.corpo}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── O resto, atrás de um toque ───────────────────────────────── */}
      <section aria-labelledby="duvidas" className="mt-6">
        <h2 id="duvidas" className="text-base font-bold text-[#0B1929]">
          Antes de preencher
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          As perguntas que toda a gente faz. Toque para ver a resposta.
        </p>
        <div className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {PERGUNTAS_DO_PROFISSIONAL.map((p) => (
            <details key={p.pergunta} className="group">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[#0B1929] transition hover:bg-slate-50">
                {p.pergunta}
                {/* O sinal roda com o `open` do próprio <details> — sem estado
                    em JavaScript, e por isso funciona antes de a página
                    hidratar, que num telemóvel lento é quase sempre. */}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-lg leading-none text-slate-400 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="px-4 pb-4 text-[13px] leading-relaxed text-slate-600">{p.resposta}</p>
            </details>
          ))}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
          Os valores acima são <strong className="font-semibold">sem IVA</strong>. Quem presta
          o serviço e emite a fatura ao cliente é você — a CLYON liga as duas pontas e
          garante o pagamento.
        </p>
      </section>

      {/* ── O formulário ─────────────────────────────────────────────── */}
      <div className="mt-8 border-t border-slate-200 pt-8">
        <h2 className="text-lg font-bold text-[#0B1929]">A sua candidatura</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          Leva cerca de dois minutos. Os campos com <span aria-hidden="true">*</span> são
          obrigatórios.
        </p>
        <div className="mt-5">
          <InscricaoForm />
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        Já tem conta?{" "}
        <Link
          href="/profissionais/entrar"
          className="font-semibold text-cyan-700 hover:underline"
        >
          Entrar no painel
        </Link>
      </p>
    </main>
  );
}
