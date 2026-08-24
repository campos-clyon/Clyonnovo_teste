"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { LinhaDeMenu } from "@/components/portal/Portal";

/**
 * "Instalar no telemóvel" — a linha do menu que põe o painel no ecrã inicial.
 *
 * O LIMITE QUE DESENHOU ISTO
 *
 * No iPhone NÃO EXISTE forma programática de adicionar ao ecrã principal —
 * nenhum site consegue, por decisão da Apple. O melhor possível é um guia; a
 * pergunta é que guia. Um parágrafo de texto ("toque em Partilhar, o quadrado
 * com a seta…") exige ler, imaginar o ícone e procurá-lo — três passos que
 * quem tem menos à-vontade não dá.
 *
 * Por isso o guia é VISUAL: passos numerados com os ícones verdadeiros
 * desenhados ao lado — a pessoa reconhece o botão em vez de o ler — e
 * mostra-se SÓ o caminho do aparelho dela, detectado, em vez de iPhone e
 * Android ao molho a obrigar a escolher.
 *
 * No Android, quando o Chrome dá o `beforeinstallprompt`, a linha abre o
 * diálogo nativo: um toque e está. O guia é o plano B de quem não o recebeu.
 * Já instalado (standalone), a linha não aparece.
 */
type PromptDeInstalacao = Event & { prompt: () => Promise<void> };

/** O ícone de Partilhar do iOS: o quadrado com a seta para cima. */
function IconePartilharIos() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3v12" strokeLinecap="round" />
      <path d="M8.5 6.5 12 3l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" strokeLinecap="round" />
    </svg>
  );
}

/** O "Adicionar ao ecrã principal" do iOS: o quadrado com o mais. */
function IconeMaisQuadrado() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" strokeLinecap="round" />
    </svg>
  );
}

/** O menu do Chrome: os três pontos. */
function IconeTresPontos() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function Passo({
  numero,
  icone,
  children,
}: {
  numero: number;
  icone?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#007A8C] text-sm font-bold text-white">
        {numero}
      </span>
      {icone && <span className="shrink-0 text-slate-700">{icone}</span>}
      <span className="text-sm leading-snug text-slate-700">{children}</span>
    </li>
  );
}

export default function InstalarNoTelemovel() {
  const [prompt, setPrompt] = useState<PromptDeInstalacao | null>(null);
  const [instalado, setInstalado] = useState(true); // até prova em contrário, não incomoda
  const [aMostrarComoFazer, setAMostrarComoFazer] = useState(false);
  const [aparelho, setAparelho] = useState<"ios" | "android" | "computador">("computador");

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    setInstalado(standalone);

    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) setAparelho("ios");
    else if (/Android/.test(ua)) setAparelho("android");

    const guardar = (e: Event) => {
      e.preventDefault();
      setPrompt(e as PromptDeInstalacao);
    };
    window.addEventListener("beforeinstallprompt", guardar);
    const aoInstalar = () => setInstalado(true);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", guardar);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  if (instalado) return null;

  return (
    <>
      <LinhaDeMenu
        icone={Smartphone}
        rotulo="Instalar no telemóvel"
        destaque={prompt ? "1 toque" : undefined}
        onClick={() => {
          // Com o diálogo nativo disponível, é ele — a acção acontece mesmo.
          if (prompt) {
            prompt.prompt();
          } else {
            setAMostrarComoFazer((v) => !v);
          }
        }}
      />
      {aMostrarComoFazer && (
        <div className="border-t border-slate-100 bg-[#F4F8FB] px-4 py-4">
          {aparelho === "computador" ? (
            <p className="text-sm leading-relaxed text-slate-600">
              Está num computador. Abra{" "}
              <span className="font-semibold text-slate-800">clyon.pt/profissionais/painel</span>{" "}
              no telemóvel e toque outra vez em "Instalar no telemóvel" — os passos
              aparecem lá, do tamanho do seu ecrã.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm font-semibold text-slate-800">
                {aparelho === "ios"
                  ? "No Safari, siga estes 3 passos:"
                  : "No Chrome, siga estes 3 passos:"}
              </p>
              <ol className="list-none space-y-2 p-0">
                {aparelho === "ios" ? (
                  <>
                    <Passo numero={1} icone={<IconePartilharIos />}>
                      Toque neste botão, na barra de baixo do Safari
                    </Passo>
                    <Passo numero={2} icone={<IconeMaisQuadrado />}>
                      Deslize a lista e toque em{" "}
                      <span className="font-semibold">Adicionar ao ecrã principal</span>
                    </Passo>
                    <Passo numero={3}>
                      Toque em <span className="font-semibold">Adicionar</span>, no canto de cima
                    </Passo>
                  </>
                ) : (
                  <>
                    <Passo numero={1} icone={<IconeTresPontos />}>
                      Toque neste botão, no canto de cima do Chrome
                    </Passo>
                    <Passo numero={2} icone={<IconeMaisQuadrado />}>
                      Toque em <span className="font-semibold">Adicionar ao ecrã principal</span>{" "}
                      (nalguns telemóveis diz <span className="font-semibold">Instalar</span>)
                    </Passo>
                    <Passo numero={3}>
                      Toque em <span className="font-semibold">Adicionar</span> para confirmar
                    </Passo>
                  </>
                )}
              </ol>
              <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
                Fica um ícone CLYON no ecrã do telemóvel que abre os seus trabalhos
                directamente — como uma aplicação.
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
