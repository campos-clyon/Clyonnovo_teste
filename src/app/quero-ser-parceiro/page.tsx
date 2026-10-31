import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Camera, ExternalLink, HandCoins, MapPin, MinusCircle, ShieldCheck, Smartphone } from "lucide-react";
import { taxasActuais } from "@/lib/db";
import { SITE_URL } from "@/lib/seo-data";
import {
  PASSOS_DO_PROFISSIONAL,
  O_QUE_A_CLYON_NAO_FAZ,
  COMO_RECEBE,
  comissaoEmPalavras,
} from "@/lib/como-funciona-para-o-profissional";
import FormularioDeCandidatura from "./FormularioDeCandidatura";
import { modeloDeHoje } from "@/lib/iva-incluido";
import { pedidosDosUltimos7Dias, pedidosParaMostrar } from "@/lib/pedidos-da-semana";
import { APP_PRO_SO_EM_TESTE, APP_PRO_NA_PLAY } from "@/lib/links-da-app";
import {
  DESCRICAO_DO_RECRUTAMENTO,
  FOTOGRAFIA_DE_UM_PARCEIRO,
  TITULO_DO_RECRUTAMENTO,
} from "@/lib/pagina-de-recrutamento";

export const metadata: Metadata = {
  // O título e a descrição de 31-10-2026 (d6 de 28-10) — ver pagina-de-recrutamento.ts.
  title: TITULO_DO_RECRUTAMENTO,
  // Até 155 caracteres, o essencial primeiro e sem frases cortadas: o
  // Google mostra uns 155 e corta o resto a meio (29-09-2026).
  description: DESCRICAO_DO_RECRUTAMENTO,
  alternates: { canonical: `${SITE_URL}/quero-ser-parceiro` },
};

/**
 * A CANDIDATURA — o que estava atrás de um botão de WhatsApp.
 *
 * O botão "Tornar-me parceiro" da página inicial abria uma conversa por
 * escrever. Quem carregava saía do site, e do outro lado ficava uma mensagem
 * entre dezenas: sem nome, sem zona, sem serviços, sem registo. Quem não
 * escrevesse naquela hora, perdia-se.
 *
 * Esta página vive FORA de `/profissionais` de propósito: essa secção está
 * atrás do portão do MVP, e um formulário de recrutamento fechado à chave não
 * recruta ninguém. Aqui entra qualquer um, e o Google também.
 */

const PORQUE = [
  {
    icon: HandCoins,
    titulo: "Responder não custa nada",
    texto:
      "Sem mensalidade, sem créditos e sem comprar contactos. Um orçamento que não dá em nada não lhe custa um cêntimo.",
  },
  {
    icon: Camera,
    titulo: "Vê o trabalho antes de responder",
    texto:
      "Cada pedido chega com fotografias, a zona, o andar e se há elevador. Dá um valor a sério, em vez de um palpite que não se aguenta à porta.",
  },
  {
    icon: MapPin,
    titulo: "Só o que lhe serve",
    texto:
      "As categorias que faz, dentro do raio que indicar a partir da sua base. Não lhe mandamos o resto.",
  },
  {
    icon: ShieldCheck,
    titulo: "O valor fica por escrito",
    texto:
      "O preço é acordado na plataforma antes de sair de casa, e ninguém o muda sozinho à porta do cliente.",
  },
];

/*
 * A comissão lê as taxas da base (`taxasActuais`), que mudam no backoffice:
 * sem isto, a página ficava com as do dia do build até ao deploy seguinte.
 */
export const revalidate = 3600;

export default async function QueroSerParceiroPage() {
  const [taxas, daSemana] = await Promise.all([taxasActuais(), pedidosDosUltimos7Dias()]);
  const exemplo = comissaoEmPalavras(taxas, modeloDeHoje());
  const pedidosDaSemana = pedidosParaMostrar(daSemana);

  return (
    <div className="min-h-screen bg-white">
      {/*
        O PRIMEIRO ECRÃ — 31-10-2026 (d6 de 28-10). Diz as três coisas que quem
        tem carrinha quer saber antes de rolar: que há trabalho (o número da
        semana, lido da base), que não paga para responder, e como se
        candidata — o botão leva ao formulário, que estava no fim da página.
      */}
      <section className="sob-o-menu bg-gradient-to-br from-cyan-50 via-white to-blue-50 pb-12 sm:pb-16">
        <div className="mx-auto max-w-3xl px-4 pt-12 text-center sm:px-6 sm:pt-16">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#0B1929] sm:text-4xl">
            Tem carrinha e equipa? Receba os nossos pedidos.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Recolhas de móveis e entulho, esvaziamentos, mudanças e reparações. O cliente
            descreve o trabalho com fotografias; é só responder com o seu valor.
          </p>
          {pedidosDaSemana != null && (
            <p className="mx-auto mt-5 max-w-xl text-base text-slate-700">
              <strong className="text-2xl font-bold text-[#0B1929]">{pedidosDaSemana} pedidos</strong> de
              clientes chegaram à plataforma nos últimos 7 dias, de Lisboa a Setúbal.
            </p>
          )}
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#candidatura"
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-acao px-8 text-base font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:bg-acao-hover sm:w-auto"
            >
              Candidatar-me (1 minuto)
            </a>
            <a
              href="#como-funciona"
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-6 text-base font-semibold text-slate-700 transition hover:border-slate-300 sm:w-auto"
            >
              Como funciona
            </a>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Responder a pedidos é grátis: sem mensalidade e sem créditos.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Já tem conta?{" "}
            <Link
              href="/profissionais/entrar"
              className="font-semibold text-cyan-600 hover:underline"
            >
              Entrar no painel
            </Link>
          </p>
          {FOTOGRAFIA_DE_UM_PARCEIRO && (
            <Image
              src={FOTOGRAFIA_DE_UM_PARCEIRO.src}
              alt={FOTOGRAFIA_DE_UM_PARCEIRO.alt}
              width={FOTOGRAFIA_DE_UM_PARCEIRO.largura}
              height={FOTOGRAFIA_DE_UM_PARCEIRO.altura}
              priority
              sizes="(min-width: 768px) 720px, 100vw"
              className="mx-auto mt-8 h-auto w-full rounded-2xl object-cover shadow-md"
            />
          )}
        </div>
      </section>

      <section className="py-10 sm:py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {PORQUE.map((p) => (
              <div
                key={p.titulo}
                className="rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50">
                  <p.icon className="h-5 w-5 text-cyan-600" aria-hidden="true" />
                </div>
                <h2 className="mt-3 text-base font-bold text-[#0B1929]">{p.titulo}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{p.texto}</p>
              </div>
            ))}
          </div>

          {/*
            A comissão dita ANTES do formulário, e não depois.

            Quem descobre a percentagem já dentro sente-se enganado, e um
            profissional que se sente enganado não volta — conta aos outros. O
            número vem das taxas em vigor: quando as taxas mudaram, um número
            escrito à mão nesta página teria ficado a mentir.

            30-09-2026: dizia «6 % do valor acordado; num trabalho de 300 €
            ficam-lhe 282 €; a fatura do serviço é sua». Eram as taxas de
            origem, e não as de hoje (11 % do que o cliente paga), e uma
            factura que deixou de ser dele. Passa a ser o exemplo do dono, e
            as duas formas de receber.
          */}
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-left sm:text-center">
            <p className="text-sm leading-relaxed text-slate-700">
              {exemplo.frase} A taxa da plataforma só existe quando fecha um trabalho.
            </p>
            <ul className="mx-auto mt-3 max-w-xl space-y-1.5 text-left">
              {COMO_RECEBE.map((c) => (
                <li key={c.forma} className="text-sm leading-relaxed text-slate-600">
                  <strong className="font-semibold text-slate-800">{c.forma}:</strong> {c.texto}
                </li>
              ))}
            </ul>
          </div>

          {/*
            A APP CLYON PRO — 31-10-2026 (d6 de 28-10). No azul-noite da app.
            Ainda está no teste fechado da Google Play (APP_PRO_SO_EM_TESTE):
            não se promete «instale já» — diz-se para quem é, e como se entra.
            O painel de quem é aprovado mostra-lhe como entrar no teste
            (ConviteDaAppPro, só em Android).
          */}
          <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-[#0F172A] p-6 text-left sm:flex-row sm:items-center sm:p-7">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <Smartphone className="h-6 w-6 text-cyan-300" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-white">A CLYON Pro: os pedidos no seu telemóvel</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                {APP_PRO_SO_EM_TESTE
                  ? "Cada pedido novo chega com um aviso e responde ali mesmo, com o seu preço. A app é para Android e está em teste com os primeiros profissionais: depois de aprovado, o painel mostra-lhe como entrar. Sem a app, faz tudo no painel, no browser do telemóvel."
                  : "Cada pedido novo chega com um aviso e responde ali mesmo, com o seu preço. A app é para Android; sem ela, faz tudo no painel, no browser do telemóvel."}
              </p>
              <a
                href={APP_PRO_NA_PLAY}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-cyan-300 hover:underline"
              >
                {APP_PRO_SO_EM_TESTE ? "Ver a CLYON Pro na Google Play" : "Instalar a CLYON Pro na Google Play"}
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              {APP_PRO_SO_EM_TESTE && (
                <p className="text-xs text-slate-400">Por agora, a página da loja só abre a quem já está no teste.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/*
        COMO FUNCIONA, ANTES DO FORMULÁRIO.

        Quem chega aqui não sabe se isto é uma bolsa de contactos, uma agência
        que subcontrata, ou um site que lhe vende leads. Pedir-lhe seis campos
        antes de responder a isso é pedir-lhe fé. Os passos são os MESMOS que
        ele vai encontrar dentro do painel — vêm do mesmo ficheiro — porque a
        versão que o convence a candidatar-se não pode ser mais generosa do que
        a que lê depois de entrar.
      */}
      <section id="como-funciona" className="scroll-mt-20 border-y border-[#E2EEF3] bg-white py-10 sm:py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-[#0B1929] sm:text-3xl">Como funciona</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Do pedido que lhe chega ao dinheiro que recebe, sem letra pequena.
          </p>

          <ol className="mt-6 space-y-5">
            {PASSOS_DO_PROFISSIONAL.map((passo, i) => (
              <li key={passo.chave} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-sm font-bold text-cyan-700">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#0B1929]">{passo.titulo}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{passo.texto}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-2xl border border-[#E2EEF3] bg-[#F4F8FB] p-5">
            <h3 className="text-base font-bold text-[#0B1929]">O que a CLYON não faz</h3>
            <ul className="mt-3 space-y-2">
              {O_QUE_A_CLYON_NAO_FAZ.map((linha) => (
                <li key={linha} className="flex items-start gap-2.5">
                  <MinusCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                  <span className="text-sm leading-relaxed text-slate-600">{linha}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="candidatura" className="scroll-mt-20 bg-[#F4F8FB] py-10 sm:py-14">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-[#0B1929] sm:text-3xl">Candidate-se</h2>
          {/*
            «A ENTRADA É POR CONVITE» DITO A QUEM ACABOU DE PREENCHER UM
            FORMULÁRIO.

            "Se ele preencheu um formulário, ele não é um convidado — ele está
            a candidatar-se." — 12-09-2026, e a frase estava mesmo a dar-lhe a
            volta: convidámo-lo a candidatar-se e, no fim, dizíamos-lhe que só
            se entra por convite.

            A frase existia por uma razão boa — explicar ao profissional porque
            é que não há inscrição aberta, e ao cliente porque é que quem lhe
            aparece foi verificado. O que estava errado era a palavra: o que
            filtra não é o convite, é haver uma pessoa a ler cada candidatura
            antes de existir conta nenhuma. E isso é verdade dos dois caminhos,
            do candidato e de quem a CLYON procura.
          */}
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Leva um minuto. Não há inscrição automática: é uma pessoa que lê cada
            candidatura antes de haver conta — é isso que nos permite dizer ao cliente
            que quem lhe aparece foi verificado. Se avançar, recebe por email o link
            para escolher a palavra-passe e entrar.
          </p>
          <div className="mt-6">
            <FormularioDeCandidatura />
          </div>
        </div>
      </section>
    </div>
  );
}
