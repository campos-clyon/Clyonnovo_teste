import type { Metadata } from "next";
import Link from "next/link";
import { Building2, FileText, HardHat, Home, KeyRound, Phone, Scale } from "lucide-react";

import { jsonLd } from "@/lib/json-ld";
import { og } from "@/lib/open-graph";
import { IDENTIFICACAO } from "@/lib/identificacao-legal";
import { maisIva, PRECOS } from "@/lib/precos-publicos";
import { PROPOSTAS_EM_ATE } from "@/lib/promessas-publicas";
import { BUSINESS_EMAIL, BUSINESS_PHONE, FACTURA_EM_PALAVRAS, SITE_URL } from "@/lib/seo-data";
import { NOMES_DOS_SERVICOS } from "@/lib/service-categories";
import { telefoneLegivel } from "@/lib/telefone-legivel";

/*
 * PARA EMPRESAS — 14-10-2026 (auditoria de SEO, 30 dias).
 *
 * Condomínios, senhorios, imobiliárias, obras e escritórios pediam pelo mesmo
 * caminho que um particular, sem uma página que lhes dissesse o que querem
 * saber antes de pedir: se há factura com o NIF da empresa, se o resíduo vai
 * para destino licenciado, e quem responde por quê. Aqui diz-se — e só o que
 * o resto do site já confirma: a factura (seo-data), o registo da CLYON na
 * APA (identificacao-legal) e a guia de transporte a pedido, que só os
 * profissionais registados emitem.
 */

const URL = `${SITE_URL}/empresas`;
const TITULO = "Recolhas e Esvaziamentos para Empresas";
const DESCRICAO =
  "Recolha de entulho e monos, esvaziamentos e mudanças de escritório para empresas, condomínios e senhorios em Lisboa e Setúbal. Fatura com NIF.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRICAO,
  alternates: { canonical: URL },
  openGraph: og({ title: TITULO, description: DESCRICAO, url: URL }),
};

const PARA_QUEM = [
  { icon: Building2, titulo: "Condomínios e administrações", texto: "Monos deixados nas partes comuns, arrecadações a esvaziar, entulho de uma obra no prédio." },
  { icon: KeyRound, titulo: "Senhorios e gestores de património", texto: "A casa entre inquilinos: o que ficou para trás sai antes da próxima visita." },
  { icon: Home, titulo: "Imobiliárias e quem vende casas", texto: "Esvaziar antes das fotografias, das visitas ou da escritura." },
  { icon: HardHat, titulo: "Obras e empreiteiros", texto: "Entulho em sacos ou a granel, carregado à mão, sem contentor na rua." },
  { icon: Scale, titulo: "Solicitadores e heranças", texto: "O recheio de uma casa de família, com o que ainda serve separado do resto." },
  { icon: Building2, titulo: "Escritórios e lojas", texto: "Mobiliário antigo, uma mudança de escritório, um espaço a devolver vazio." },
];

/*
 * A MANUTENÇÃO DA CASA TAMBÉM — 28-10-2026 (d1). Voltou a 25/10, com
 * reparações e remodelações, e esta página só falava de recolhas,
 * esvaziamentos e mudanças. Os nomes que têm serviço próprio vêm de
 * NOMES_DOS_SERVICOS, como no resto do site.
 */
const MANUTENCAO = NOMES_DOS_SERVICOS.manutencao_casa;

const O_QUE_PODE_PEDIR = [
  { href: "/recolha-de-entulho", titulo: NOMES_DOS_SERVICOS.recolha_entulho, preco: maisIva(PRECOS.recolha_entulho.etiqueta) },
  { href: "/recolha-de-monos", titulo: NOMES_DOS_SERVICOS.recolha_monos, preco: maisIva(PRECOS.recolha_monos.etiqueta) },
  { href: "/esvaziamento-de-casas", titulo: "Esvaziamentos", preco: maisIva(PRECOS.esvaziamento_casa.etiqueta) },
  { href: "/mudancas-de-escritorio", titulo: "Mudanças de escritório", preco: maisIva(PRECOS.mudanca.etiqueta) },
  { href: "/recolha-de-moveis", titulo: NOMES_DOS_SERVICOS.recolha_moveis, preco: maisIva(PRECOS.recolha_moveis.etiqueta) },
  {
    href: "/servicos/manutencao-casa",
    titulo: `${MANUTENCAO} (reparações e remodelações)`,
    preco: maisIva(PRECOS.manutencao_casa.etiqueta),
  },
];

const migalhas = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Empresas", item: URL },
  ],
};

export default function EmpresasPage() {
  return (
    <div className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(migalhas) }} />

      <section className="sob-o-menu bg-gradient-to-br from-cyan-50 via-white to-white">
        <div className="mx-auto max-w-5xl px-6 py-14 lg:px-8 lg:py-20">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Recolhas e esvaziamentos para empresas
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            A CLYON liga a sua empresa a parceiros verificados de Lisboa, da Margem Sul e de
            Setúbal — para recolhas, esvaziamentos, mudanças e a {MANUTENCAO.toLowerCase()}, com
            reparações e remodelações. Descreve o trabalho, recebe propostas {PROPOSTAS_EM_ATE} com
            o preço fechado, e escolhe. Quem faz o trabalho é o parceiro; quem responde se algo correr mal é a
            CLYON.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/simulador" className="site-btn-primary min-w-[220px] px-6 py-3.5">
              Pedir orçamento
            </Link>
            <a
              href={`tel:${BUSINESS_PHONE}`}
              className="site-btn-secondary min-w-[220px] border-slate-300 px-6 py-3.5 text-slate-900"
            >
              <Phone className="h-4 w-4" />
              Ligar {telefoneLegivel(BUSINESS_PHONE)}
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
        <h2 className="text-2xl font-bold text-slate-950">Para quem</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PARA_QUEM.map(({ icon: Icone, titulo, texto }) => (
            <div key={titulo} className="rounded-2xl border border-slate-200 bg-white p-5">
              <Icone className="h-5 w-5 text-acao" />
              <h3 className="mt-3 font-semibold text-slate-900">{titulo}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-950">O que pode pedir</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {O_QUE_PODE_PEDIR.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-800 transition hover:border-cyan-300"
                >
                  <span>{s.titulo}</span>
                  <span className="text-acao">{s.preco}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Valores de referência, sem IVA. Na proposta, o preço já vem com IVA incluído.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-950">
          <FileText className="h-6 w-6 text-acao" />
          Fatura e documentos
        </h2>
        <dl className="mt-6 space-y-4 text-sm leading-7 text-slate-700">
          <div>
            <dt className="font-semibold text-slate-900">Fatura</dt>
            <dd>{FACTURA_EM_PALAVRAS} Para a fatura levar o NIF da empresa, diga-o no pedido.</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Resíduos e destino licenciado</dt>
            <dd>
              A CLYON está registada como operador de resíduos na Agência Portuguesa do Ambiente,
              com o número {IDENTIFICACAO.codigoAPA}. O que sai vai para destino licenciado, e o
              que ainda serve pode seguir para reaproveitamento.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Guia de transporte (e-GAR)</dt>
            <dd>
              Transportar resíduos exige transportador registado, e quem responde pelo destino é
              quem os produz. Se precisar da e-GAR, diga-o no pedido: a equipa encaminha-o para
              parceiros que a emitem, e a proposta diz se vem incluída.
            </dd>
          </div>
        </dl>
      </section>

      <section className="bg-cyan-50/60">
        <div className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-950">Falar com a CLYON</h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Para pedidos frequentes ou vários locais, fale connosco antes: combinamos como
            descrever cada pedido para as propostas chegarem certas.
          </p>
          <p className="mt-4 text-sm text-slate-700">
            <a href={`tel:${BUSINESS_PHONE}`} className="font-semibold text-acao">
              {telefoneLegivel(BUSINESS_PHONE, { comIndicativo: true })}
            </a>{" "}
            ·{" "}
            <a href={`mailto:${BUSINESS_EMAIL}`} className="font-semibold text-acao">
              {BUSINESS_EMAIL}
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
