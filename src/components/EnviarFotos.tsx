"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { enviarFicheiro } from "@/lib/enviar-ficheiro";

/**
 * Escolher fotografias e enviá-las, uma de cada vez.
 *
 * Uma de cada vez porque o Vercel recusa qualquer pedido com mais de 4,5 MB de
 * corpo, e recusa-o à entrada: duas fotos de telemóvel num só envio rebentavam
 * o lote inteiro e ninguém chegava a saber porquê. Cada envio é pequeno, e uma
 * que falhe não leva as outras atrás.
 *
 * A redução para 1920 px acontece no browser, antes de sair: uma foto passa de
 * vários MB para algumas centenas de KB. Numa rede móvel, à porta de um cliente,
 * é a diferença entre enviar e desistir.
 *
 * O botão de remover está sempre visível. Estava a aparecer só no hover, e num
 * telemóvel não há hover — a foto errada não tinha como sair.
 */

export type FotoEnviada = { url: string; name?: string };

export default function EnviarFotos({
  fotos,
  onMudar,
  maximo = 8,
  rotulo = "Adicionar fotografias",
}: {
  fotos: FotoEnviada[];
  onMudar: (fotos: FotoEnviada[]) => void;
  maximo?: number;
  rotulo?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [aEnviar, setAEnviar] = useState(0);
  const [erro, setErro] = useState("");

  async function escolher(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const porEnviar = Array.from(lista).slice(0, Math.max(0, maximo - fotos.length));
    if (porEnviar.length === 0) {
      setErro(`Já tem o máximo de ${maximo} fotografias.`);
      return;
    }

    setErro("");
    setAEnviar(porEnviar.length);
    const novas: FotoEnviada[] = [];
    const falhas: string[] = [];

    for (const original of porEnviar) {
      const r = await enviarFicheiro(original);
      if (r.ok) novas.push({ url: r.ficheiro.url, name: r.ficheiro.name });
      else falhas.push(original.name);
      setAEnviar((n) => n - 1);
    }

    if (novas.length > 0) onMudar([...fotos, ...novas]);
    if (falhas.length > 0) {
      setErro(
        falhas.length === 1
          ? "Uma fotografia não subiu. Tente outra vez."
          : `${falhas.length} fotografias não subiram. Tente outra vez.`,
      );
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {fotos.map((f, i) => (
          <div key={f.url} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.url}
              alt={f.name ?? `Fotografia ${i + 1}`}
              className="aspect-square w-full rounded-xl object-cover ring-1 ring-slate-200"
            />
            <button
              type="button"
              onClick={() => onMudar(fotos.filter((x) => x.url !== f.url))}
              aria-label={`Remover fotografia ${i + 1}`}
              className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/85 text-white shadow"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}

        {fotos.length < maximo && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={aEnviar > 0}
            className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-cyan-300 bg-cyan-50/50 text-cyan-700 transition active:bg-cyan-100 disabled:opacity-50"
          >
            {aEnviar > 0 ? (
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            ) : (
              <Camera className="h-6 w-6" aria-hidden="true" />
            )}
            <span className="px-1 text-center text-[11px] font-semibold leading-tight">
              {aEnviar > 0 ? "a enviar…" : rotulo}
            </span>
          </button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={(e) => escolher(e.target.files)}
        className="hidden"
      />

      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
    </div>
  );
}
