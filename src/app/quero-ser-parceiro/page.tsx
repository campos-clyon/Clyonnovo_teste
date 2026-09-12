import type { Metadata } from "next";
import Link from "next/link";
import { Camera, HandCoins, MapPin, MinusCircle, ShieldCheck } from "lucide-react";
import { TAXA_PROFISSIONAL, quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";
import { SITE_URL } from "@/lib/seo-data";
import {
  PASSOS_DO_PROFISSIONAL,
  O_QUE_A_CLYON_NAO_FAZ,
} from "@/lib/como-funciona-para-o-profissional";
import FormularioDeCandidatura from "./FormularioDeCandidatura";

export const metadata: Metadata = {
  title: "Trabalhar com a CLYON — receba pedidos na sua zona",
  description:
    "Empresas e profissionais de mudanças, recolhas e esvaziamentos: receba pedidos de clientes na sua zona. Responder não custa nada e só há comissão quando fecha um trabalho.",
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

export default function QueroSerParceiroPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-cyan-50 via-white to-blue-50 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#0B1929] sm:text-4xl">
            Tem carrinha e equipa? Receba os nossos pedidos.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Mudanças, recolhas de móveis e entulho, esvaziamentos. O cliente descreve o
            trabalho com fotografias; você responde com o seu valor.
          </p>
          <p className="mt-5 text-sm text-slate-500">
            Já tem conta?{" "}
            <Link
              href="/profissionais/entrar"
              className="font-semibold text-cyan-600 hover:underline"
            >
              Entrar no painel
            </Link>
          </p>
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
            número vem da constante: quando as taxas mudaram, um número escrito
            à mão nesta página teria ficado a mentir.
          */}
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-center">
            <p className="text-sm leading-relaxed text-slate-700">
              A comissão é de <strong>{Math.round(TAXA_PROFISSIONAL * 100)} %</strong> do valor
              acordado, e só existe quando fecha um trabalho. Num trabalho de 300 € ficam-lhe{" "}
              <strong>{Math.round(quantoOProfissionalRecebe(300))} €</strong>. Quem lhe paga é o
              cliente, no fim; a fatura do serviço é sua.
            </p>
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
      <section className="border-y border-[#E2EEF3] bg-white py-10 sm:py-14">
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

      <section className="bg-[#F4F8FB] py-10 sm:py-14">
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
