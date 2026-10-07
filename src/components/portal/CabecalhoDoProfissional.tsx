"use client";

import Image from "next/image";
import Link from "next/link";

/**
 * O CABEÇALHO DA ÁREA DO PROFISSIONAL — 07-10-2026.
 *
 * *«Adapte o menu do topo ao backoffice dos pros: o WhatsApp, por exemplo, não
 * devia lá estar.»* O painel e a página de um pedido levavam o cabeçalho do
 * site dos clientes: a localização, «Soluções», «Trabalhos», «Avaliações»,
 * «Contactos» e o botão verde do WhatsApp, que abre uma conversa a pedir um
 * orçamento à CLYON. Nada disso serve a quem está a trabalhar — e um toque
 * distraído tirava-o do painel para a montra.
 *
 * Fica o logótipo, que leva ao painel (é a «casa» de quem aqui está), e a
 * indicação da área. Tudo o resto vive no menu do próprio painel.
 *
 * A MESMA ALTURA do cabeçalho do site — `py-2.5` e o logótipo a `h-8 sm:h-10`,
 * com a borda de baixo —, porque o conteúdo começa por baixo dele pela
 * `--altura-do-menu` do globals.css. E só classes do Tailwind com as cores
 * normais: o modo escuro do painel troca-as pelas variáveis, sem regra nova.
 */
export default function CabecalhoDoProfissional() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-100 bg-white shadow-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <Link href="/profissionais/painel" aria-label="O meu painel" className="flex-shrink-0">
          <Image
            src="/logo-clyon.png"
            alt="CLYON"
            className="h-8 w-auto sm:h-10"
            width={205}
            height={84}
            priority
            sizes="205px"
          />
        </Link>
        <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-acao">
          Profissionais
        </span>
      </div>
    </header>
  );
}
