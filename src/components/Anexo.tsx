"use client";

import { FileText, Play } from "lucide-react";
import { especieDoAnexo } from "@/lib/tipo-ficheiro";

/**
 * UM ANEXO NO ECRÃ — seja ele fotografia, vídeo ou PDF.
 *
 * "No arquivo nós só aceitamos fotos, mas devemos aceitar também PDFs e
 * vídeos."
 *
 * Cinco ecrãs mostram estes ficheiros: o cartão do profissional, o detalhe do
 * trabalho, a prova do que foi feito, a mesa do backoffice e a página do
 * cliente. Todos eles faziam a mesma coisa — `<img src={url}>` — porque até
 * aqui só havia fotografias.
 *
 * Um vídeo num `<img>` não aparece. Um PDF num `<img>` dá o ícone de imagem
 * partida com o texto alternativo ao lado, que é pior do que não mostrar nada:
 * parece uma avaria, e quem o vê pensa que a fotografia se perdeu.
 *
 * A decisão de como mostrar cada espécie vive aqui, uma vez. Cinco cópias
 * divergiam no dia em que se acrescentasse um formato — e divergiriam em
 * silêncio, porque nada disto dá erro.
 */

export function Miniatura({
  url,
  nome,
  onAbrir,
  className = "h-20 w-20",
  encaixe = "cobrir",
}: {
  url: string;
  nome?: string;
  /** Quando existe, a miniatura é um botão; senão, é só uma imagem. */
  onAbrir?: () => void;
  className?: string;
  /**
   * `cobrir` enche a caixa e corta o que sobra — bom para uma grelha de
   * quadrados iguais. `inteira` mostra a fotografia toda, com faixas.
   *
   * Existe porque a foto GRANDE do detalhe ficava recortada em cima e em
   * baixo: uma foto de telemóvel ao alto perde cerca de 35% da altura numa
   * caixa larga, e é sobre essa fotografia que se decide o preço. Não se
   * resolvia no sítio da chamada — `object-cover` e `object-contain` têm a
   * mesma especificidade e o Tailwind escreve `cover` depois, por isso
   * `cover` ganhava sempre.
   */
  encaixe?: "cobrir" | "inteira";
}) {
  const especie = especieDoAnexo(nome || url);

  const dentro =
    especie === "imagem" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={nome ?? ""}
        className={`${className} rounded-xl ${encaixe === "inteira" ? "object-contain" : "object-cover"}`}
      />
    ) : especie === "video" ? (
      /*
        O PRIMEIRO FOTOGRAMA COMO CAPA.
        `preload="metadata"` traz só o cabeçalho do vídeo — o suficiente para
        desenhar a capa sem descarregar megabytes que ninguém pediu. O
        triângulo por cima diz que aquilo se toca.
      */
      <span className={`relative block ${className}`}>
        <video
          src={url}
          preload="metadata"
          muted
          playsInline
          className="h-full w-full rounded-xl bg-slate-900 object-cover"
        />
        <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/25">
          <Play className="h-6 w-6 fill-white text-white" aria-hidden="true" />
        </span>
      </span>
    ) : (
      /*
        O PDF NÃO TEM CAPA — tem nome.
        É o que distingue "reportagem fotográfica.pdf" de "orçamento.pdf" numa
        fila de seis anexos, e é a única coisa que ali interessa.
      */
      <span
        className={`flex ${className} flex-col items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 p-1.5`}
      >
        <FileText className="h-6 w-6 shrink-0 text-rose-600" aria-hidden="true" />
        <span className="line-clamp-2 break-all text-center text-[9px] font-semibold leading-tight text-rose-800">
          {(nome ?? "PDF").replace(/\.pdf$/i, "")}
        </span>
      </span>
    );

  if (!onAbrir) return dentro;
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`Abrir ${nome ?? "anexo"}`}
      className="shrink-0 transition hover:opacity-90"
    >
      {dentro}
    </button>
  );
}

/**
 * O anexo em grande, dentro do visor.
 *
 * O PDF não se mostra aqui dentro — o armazenamento serve tudo com
 * `Content-Disposition: attachment`, e por isso o browser descarrega-o em vez
 * de o desenhar. Mostra-se o que ele é, e um botão que o abre.
 */
export function AnexoGrande({ url, nome }: { url: string; nome?: string }) {
  const especie = especieDoAnexo(nome || url);

  if (especie === "video") {
    return <video src={url} controls autoPlay className="max-h-[92vh] max-w-[94vw]" />;
  }

  if (especie === "pdf") {
    /*
      SEM `iframe`, e a razão é do armazenamento e não da nossa vontade.

      Os ficheiros são servidos com `Content-Disposition: attachment` — o que
      significa que um PDF metido num `iframe` NÃO se mostra: o browser
      descarrega-o e a moldura fica em branco. Ficava um rectângulo vazio a
      parecer avaria, com o ficheiro a cair na pasta das transferências sem
      ninguém perceber porquê.

      (A CSP do site também tem `frame-src 'none'`, de propósito. Abri-la para
      mostrar uma moldura que ia ficar vazia seria pagar em segurança por
      nada.)

      O que resta é o honesto: dizer o que é, e um botão que o abre.
    */
    return (
      <div className="flex max-w-[90vw] flex-col items-center gap-4 rounded-2xl bg-white/5 p-8 text-center">
        <FileText className="h-16 w-16 text-rose-400" aria-hidden="true" />
        <p className="max-w-md break-words text-base font-semibold text-white">
          {nome ?? "Documento PDF"}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          Abrir o PDF
        </a>
        <p className="text-xs text-white/50">Abre noutro separador ou descarrega, conforme o browser.</p>
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={nome ?? ""} className="max-h-[92vh] max-w-[94vw] object-contain" />;
}
