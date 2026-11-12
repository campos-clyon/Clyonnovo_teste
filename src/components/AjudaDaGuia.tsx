import { AJUDA_DA_GUIA } from "@/lib/guia-de-residuos";

/**
 * O TEXTO A DO JURÍDICO junto ao campo da guia — 12-11-2026 (d5). O mesmo no
 * painel do parceiro e na inscrição; a app CLYON Pro tem o seu, pela API.
 * Fechado por omissão: quem já sabe não precisa de o ler outra vez.
 */
export default function AjudaDaGuia({ comecaAberta = false }: { comecaAberta?: boolean }) {
  return (
    <details open={comecaAberta} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">{AJUDA_DA_GUIA.titulo}</summary>
      <p className="mt-2">{AJUDA_DA_GUIA.abertura}</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5">
        {AJUDA_DA_GUIA.passos.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      <p className="mt-2">{AJUDA_DA_GUIA.privacidade}</p>
      <p className="mt-2">{AJUDA_DA_GUIA.eGar}</p>
    </details>
  );
}
