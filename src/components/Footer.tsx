"use client";

import Link from "next/link";
import Image from "next/image";
import { MessageCircle, ArrowRight, CreditCard, Smartphone, Building, ShieldCheck } from "lucide-react";

import { trackWhatsAppClick } from "@/lib/analytics";
import { BUSINESS_PHONE } from "@/lib/seo-data";
import { IDENTIFICACAO } from "@/lib/identificacao-legal";

/**
 * O rodapé.
 *
 * ERAM DOIS RODAPÉS, E JÁ TINHAM DIVERGIDO
 *
 * Havia dois blocos de markup completos escritos à mão em paralelo — um
 * `hidden lg:grid` e um `lg:hidden` — e os dois estavam SEMPRE no DOM. Com o
 * tempo afastaram-se, como acontece sempre a duas cópias da mesma coisa:
 *
 *   · o desktop tinha "Mudanças" nos serviços e o telemóvel não;
 *   · o desktop tinha "Blog" na empresa e o telemóvel tinha "Avaliações";
 *   · o desktop listava 12 cidades e o telemóvel 8 — Barreiro, Loures,
 *     Montijo e Odivelas desapareciam no telemóvel, que é onde está a maior
 *     parte de quem visita este site.
 *
 * O custo não era só o conteúdo errado. Duplicava o peso do HTML em TODAS as
 * páginas, fazia o leitor de ecrã anunciar o rodapé duas vezes, e enviava ao
 * Google dois conjuntos de links internos diferentes para as mesmas páginas de
 * cidade.
 *
 * Agora há um bloco só, com os dados nos arrays acima, e a diferença entre
 * ecrãs resolvida só por CSS. Acrescentar uma cidade passa a ser uma linha —
 * e aparece nos dois sítios por construção, não por disciplina.
 *
 * E SAÍRAM OS ~90 ESTILOS EM LINHA
 *
 * Eram eles que obrigavam às quarenta linhas de `footer a { color: inherit
 * !important }` no globals.css: um estilo em linha ganha a qualquer classe,
 * por isso a única forma de o vencer era `!important`. Com classes normais,
 * nada disso é preciso.
 */

const SERVICOS = [
  { href: "/recolha-de-moveis", texto: "Recolha de Móveis" },
  { href: "/recolha-de-entulho", texto: "Recolha de Entulho" },
  { href: "/esvaziamento-de-casas", texto: "Esvaziamento de Casas" },
  { href: "/mudancas", texto: "Mudanças" },
  { href: "/precos", texto: "Preços orientativos" },
];

const EMPRESA = [
  { href: "/sobre-nos", texto: "Sobre nós" },
  { href: "/faq", texto: "FAQ" },
  { href: "/blog", texto: "Blog" },
  { href: "/avaliacoes", texto: "Avaliações" },
  { href: "/contactos", texto: "Contactos" },
];

/** As doze, e as mesmas em qualquer ecrã. */
const COBERTURA = [
  { slug: "lisboa", nome: "Lisboa" },
  { slug: "almada", nome: "Almada" },
  { slug: "amadora", nome: "Amadora" },
  { slug: "seixal", nome: "Seixal" },
  { slug: "barreiro", nome: "Barreiro" },
  { slug: "oeiras", nome: "Oeiras" },
  { slug: "cascais", nome: "Cascais" },
  { slug: "setubal", nome: "Setúbal" },
  { slug: "loures", nome: "Loures" },
  { slug: "sintra", nome: "Sintra" },
  { slug: "montijo", nome: "Montijo" },
  { slug: "odivelas", nome: "Odivelas" },
];

const PAGAMENTOS = [
  { icone: CreditCard, nome: "Revolut" },
  { icone: Smartphone, nome: "MB WAY" },
  { icone: Building, nome: "Novo Banco" },
];

const tituloCls =
  "mb-4 text-xs font-bold uppercase tracking-[0.1em] text-white/70";
const linkCls =
  "text-sm text-white transition-colors hover:text-marca";

export default function Footer() {
  const anoAtual = new Date().getFullYear();
  const numeroWhatsapp = BUSINESS_PHONE.replace(/[^\d]/g, "");
  const urlWhatsapp = `https://wa.me/${numeroWhatsapp}?text=${encodeURIComponent("Olá! Gostava de pedir um orçamento à CLYON.")}`;

  const contactoRapido = (
    <div className="flex flex-col gap-2.5">
      <a
        href={urlWhatsapp}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackWhatsAppClick("footer")}
        className="group flex min-h-[44px] items-center gap-3 rounded-lg bg-slate-800 px-3.5 py-3 text-sm text-white transition-colors hover:bg-slate-700"
      >
        <MessageCircle className="h-4 w-4 shrink-0 text-marca" aria-hidden="true" />
        WhatsApp direto
      </a>
      <Link
        href="/simulador"
        className="group flex min-h-[44px] items-center gap-3 rounded-lg bg-slate-800 px-3.5 py-3 text-sm text-white transition-colors hover:bg-slate-700"
      >
        <ArrowRight className="h-4 w-4 shrink-0 text-marca" aria-hidden="true" />
        Pedir orçamento
      </Link>
    </div>
  );

  return (
    <footer className="bg-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        {/*
          UM só bloco. A diferença entre ecrãs é só a grelha:
          duas colunas em telemóvel, e a coluna da marca à esquerda a partir
          de lg. Nada de conteúdo duplicado.
        */}
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-[280px_repeat(4,1fr)] lg:gap-12">
          {/* A marca ocupa a linha inteira em telemóvel. */}
          <div className="col-span-2 rounded-2xl bg-slate-800 p-7 lg:col-span-1">
            <Link href="/" className="inline-block">
              <Image
                src="/logo-clyon.png"
                alt="CLYON"
                width={120}
                height={40}
                className="h-9 w-auto brightness-0 invert"
              />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-white">
              Ligamos quem precisa de esvaziar, arrumar ou deitar fora a
              profissionais verificados em Lisboa, Margem Sul e Setúbal.
              Orçamento gratuito, preço fechado antes de começar.
            </p>

            <div className="mt-6 border-t border-slate-700 pt-5">
              <h4 className={tituloCls}>Pagamentos</h4>
              <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                {PAGAMENTOS.map(({ icone: Icone, nome }) => (
                  <span key={nome} className="flex items-center gap-2 text-sm text-white">
                    <Icone className="h-4 w-4 text-marca" aria-hidden="true" />
                    {nome}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <nav aria-label="Serviços">
            <h3 className={tituloCls}>Serviços</h3>
            <ul className="flex list-none flex-col gap-3 p-0">
              {SERVICOS.map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className={linkCls}>
                    {s.texto}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Empresa">
            <h3 className={tituloCls}>Empresa</h3>
            <ul className="flex list-none flex-col gap-3 p-0">
              {EMPRESA.map((e) => (
                <li key={e.href}>
                  <Link href={e.href} className={linkCls}>
                    {e.texto}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Cobertura" className="col-span-2 lg:col-span-1">
            <h3 className={tituloCls}>Cobertura</h3>
            {/*
              Em telemóvel são etiquetas, em ecrã grande são duas colunas de
              links. O mesmo conteúdo — as doze cidades — nos dois casos.

              O padding das etiquetas dá 44 px de altura: eram ≈26 px, e a
              esta densidade quem toca em "Seixal" acerta em "Setúbal".
            */}
            <ul className="flex list-none flex-wrap gap-2 p-0 lg:grid lg:grid-cols-2 lg:gap-x-5 lg:gap-y-3">
              {COBERTURA.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/recolha-moveis-${c.slug}`}
                    className="inline-flex min-h-[44px] items-center rounded-md bg-slate-800 px-3.5 text-sm text-white transition-colors hover:text-marca lg:min-h-0 lg:bg-transparent lg:px-0"
                  >
                    {c.nome}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="col-span-2 lg:col-span-1">
            <h3 className={tituloCls}>Contacto rápido</h3>
            {contactoRapido}
          </div>
        </div>
      </div>

      {/*
        Registo de operador de resíduos e identificação fiscal.

        Os dois principais concorrentes destacam o licenciamento ambiental
        deles, e uma auditoria apontou isso como a maior desvantagem
        competitiva da CLYON. O registo cá estava desde sempre — só não
        aparecia em lado nenhum do site. É público, e é feito para ser
        mostrado.
      */}
      <div className="border-t border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-7 gap-y-2.5 px-6 py-4 text-[13px] text-white/55">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck size={15} className="shrink-0 text-marca" aria-hidden="true" />
            Operador de resíduos registado na APA ·{" "}
            <strong className="font-semibold text-white/80">{IDENTIFICACAO.codigoAPA}</strong>
          </span>
          <span>
            {IDENTIFICACAO.nomeLegal} · NIF {IDENTIFICACAO.nif}
          </span>
          <span>{IDENTIFICACAO.morada}</span>
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-5 sm:flex-row">
          <p className="text-sm text-white/50">
            © CLYON {anoAtual} — Todos os direitos reservados
          </p>
          <div className="flex flex-wrap items-center gap-x-6">
            <Link href="/termos" className="min-h-[44px] py-3 text-sm text-white/50 transition-colors hover:text-white">
              Termos e Condições
            </Link>
            <Link href="/privacidade" className="min-h-[44px] py-3 text-sm text-white/50 transition-colors hover:text-white">
              Política de Privacidade
            </Link>
            <Link href="/cookies" className="min-h-[44px] py-3 text-sm text-white/50 transition-colors hover:text-white">
              Política de Cookies
            </Link>
            {/*
              Era um <button> com `padding: 0` — ≈20 px de altura, o alvo de
              toque mais pequeno do site inteiro. E é o controlo que a lei
              obriga a manter acessível.
            */}
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("clyon-open-cookie-preferences"));
              }}
              className="min-h-[44px] cursor-pointer border-none bg-transparent py-3 text-sm text-white/50 transition-colors hover:text-white"
            >
              Gerir cookies
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
