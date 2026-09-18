"use client";

import { useEffect, useState } from "react";

/**
 * O ECRÃ BRANCO DEIXA DE ACONTECER — e, quando a culpa é de um deploy, cura-se
 * sozinho.
 *
 * "Application error: a client-side exception has occurred while loading
 * clyon.pt (see the browser console for more information)."
 *
 * Era isto que um profissional via ao abrir um trabalho, a meio da tarde, com
 * o cliente à espera: uma página branca com uma frase em inglês a mandá-lo
 * abrir a consola do browser. Ele deu F5 e passou — e esse F5 é a pista.
 *
 * O QUE ACONTECEU, quase de certeza: um separador aberto antes de um deploy.
 * O HTML que ele tinha aponta para pedaços de JavaScript com o nome da versão
 * antiga; ao navegar para um ecrã que ainda não tinha sido carregado, o browser
 * vai buscar um ficheiro que já não existe, e o Next mostra aquela frase. Não
 * há avaria nenhuma no trabalho, na negociação nem na conta: há um separador
 * velho a falar com um servidor novo. Hoje houve quatro deploys em poucas
 * horas, e quem tem o painel aberto o dia todo é exactamente quem apanha isto.
 *
 * DUAS COISAS, POR ESTA ORDEM:
 *
 *   1. Se o erro é de versão, RECARREGA SOZINHO, uma vez. É o F5 que ele ia
 *      ter de dar, dado por nós — e uma vez só, com marca na sessão, porque um
 *      recarregar que se repete é pior do que o ecrã branco.
 *   2. Se for outra coisa qualquer, mostra-se em português, diz-se o que ele
 *      pode fazer, e deixa-se um caminho de volta. Uma pessoa na rua com o
 *      telemóvel na mão não vai abrir a consola do browser.
 *
 * NÃO ESCONDE O ERRO: o `digest` fica à vista num canto, que é o que permite
 * encontrá-lo nos registos do servidor quando alguém o comunicar.
 */

/** A marca de que já se tentou recarregar por causa deste erro. */
const JA_RECARREGOU = "clyon:erro-recarregou";

/**
 * É UM ERRO DE VERSÃO, e não uma avaria?
 *
 * Os nomes mudam com o browser e com a versão do Next, por isso olha-se para
 * os três que aparecem na prática — e para o nome `ChunkLoadError`, que é o
 * que o próprio Next atribui.
 */
export function eDeVersaoAntiga(erro: { name?: string; message?: string }): boolean {
  if (erro?.name === "ChunkLoadError") return true;
  const m = String(erro?.message ?? "");
  return (
    /loading chunk/i.test(m) ||
    /failed to fetch dynamically imported module/i.test(m) ||
    /error loading dynamically imported module/i.test(m) ||
    /importing a module script failed/i.test(m)
  );
}

export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [aRecarregar, setARecarregar] = useState(false);

  useEffect(() => {
    if (!eDeVersaoAntiga(error)) return;
    /*
     * UMA VEZ SÓ. Se o recarregamento não resolver — porque o problema afinal
     * era outro — a segunda passagem cai no ecrã normal e a pessoa lê o que
     * se passa, em vez de ficar num ciclo de páginas a piscar.
     */
    try {
      if (sessionStorage.getItem(JA_RECARREGOU)) return;
      sessionStorage.setItem(JA_RECARREGOU, "1");
    } catch {
      // Sem sessionStorage (navegação privada, cookies fechados) não se
      // arrisca o ciclo: mostra-se o ecrã e ele carrega no botão.
      return;
    }
    setARecarregar(true);
    window.location.reload();
  }, [error]);

  /*
   * Quando a página ficou boa, a marca deixa de fazer falta — e tem de sair,
   * senão o próximo deploy apanha a sessão com ela posta e já não recarrega.
   * Corre no ecrã de erro porque é o único sítio que sabe que houve um.
   */
  useEffect(() => {
    if (eDeVersaoAntiga(error)) return;
    try {
      sessionStorage.removeItem(JA_RECARREGOU);
    } catch {
      /* não faz mal nenhum */
    }
  }, [error]);

  if (aRecarregar) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-sm text-slate-500">A actualizar a página…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-bold text-tinta">Não foi possível abrir este ecrã</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Foi um problema nosso, e nada do seu trabalho se perdeu. Tente outra vez — quase
          sempre chega.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={reset}
            className="min-h-[48px] rounded-xl bg-acao px-5 text-sm font-bold text-white transition hover:bg-acao-hover"
          >
            Tentar outra vez
          </button>
          <button
            onClick={() => window.location.reload()}
            className="min-h-[48px] rounded-xl border-2 border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            Recarregar a página
          </button>
        </div>

        {/*
          O `digest` é o que liga este ecrã à linha nos registos do servidor.
          Pequeno e discreto: não é para ele perceber, é para ele conseguir
          dizer-nos qual foi quando telefonar.
        */}
        {error.digest && (
          <p className="mt-4 text-[11px] text-tinta-fraca">
            Se nos contactar, diga este código: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
