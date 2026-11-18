import type { ReactNode } from "react";
import Link from "next/link";
import { concelhoPorId } from "@/lib/concelhos-da-cobertura";
import { emTerra } from "@/lib/preposicao-da-terra";

/**
 * «TEM CARRINHA?» NO FIM DAS PÁGINAS DE RECOLHA E DE MUDANÇAS — 18-11-2026 (d8).
 *
 * Uma linha de texto com a ligação à candidatura, antes do rodapé. Não vai numa
 * caixa de destaque: estas páginas servem o cliente, e a linha não lhe pode
 * tirar o foco. Nas páginas de uma cidade que é um dos concelhos da cobertura,
 * a ligação leva o `?zona=` (d16), para a candidatura guardar a zona e a página
 * dizer quantos pedidos houve ali. Nunca nas páginas de entulho (d18: sem
 * entulho na divulgação nem no recrutamento).
 */
export type TipoDaLigacaoAosParceiros = "recolha" | "mudancas";

export function destinoDaCandidatura(cidade?: { slug: string } | null): string {
  const c = cidade ? concelhoPorId(cidade.slug) : null;
  return c ? `/quero-ser-parceiro?zona=${c.id}` : "/quero-ser-parceiro";
}

export default function TrabalheConnosco({
  tipo,
  cidade,
}: {
  tipo: TipoDaLigacaoAosParceiros;
  cidade?: { slug: string; nome: string } | null;
}) {
  const href = destinoDaCandidatura(cidade);
  const ligacao = (texto: string) => (
    <Link href={href} className="font-semibold text-cyan-700 underline underline-offset-2 hover:text-cyan-800">
      {texto}
    </Link>
  );

  let frase: ReactNode;
  if (cidade) {
    frase =
      tipo === "recolha" ? (
        <>Faz recolhas de móveis {emTerra(cidade.nome)}? {ligacao("Receba os pedidos da zona")} como parceiro da CLYON.</>
      ) : (
        <>Faz mudanças {emTerra(cidade.nome)}? {ligacao("Receba os pedidos da zona")} como parceiro da CLYON.</>
      );
  } else {
    frase =
      tipo === "recolha" ? (
        <>Faz recolhas de móveis com a sua carrinha? {ligacao("Receba pedidos da sua zona")} como parceiro da CLYON.</>
      ) : (
        <>Tem carrinha e faz mudanças? {ligacao("Receba pedidos de mudanças da sua zona")} e proponha o seu preço à hora.</>
      );
  }

  return (
    <div className="border-t border-slate-100 bg-white">
      <p className="mx-auto max-w-7xl px-4 py-6 text-sm leading-relaxed text-slate-600 sm:px-6 lg:px-8">{frase}</p>
    </div>
  );
}
