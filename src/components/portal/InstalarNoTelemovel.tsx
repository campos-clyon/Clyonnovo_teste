"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { LinhaDeMenu } from "@/components/portal/Portal";

/**
 * "Instalar no telemóvel" — a linha do menu que põe o painel no ecrã inicial.
 *
 * TRÊS ESTADOS, UM SÓ COMPONENTE
 *
 *   · Android/Chrome dispara `beforeinstallprompt`: guarda-se o evento e a
 *     linha abre o diálogo nativo de instalação. Um toque, fica instalado.
 *   · iPhone não tem esse evento — a instalação é manual. A linha abre as
 *     instruções: Partilhar → Adicionar ao ecrã principal.
 *   · Já instalado (a correr em standalone), a linha não aparece: convidar a
 *     instalar o que já está instalado é ruído.
 *
 * O evento `beforeinstallprompt` só dispara quando o browser acha o site
 * instalável — pode nunca vir. Por isso a linha aparece SEMPRE (menos em
 * standalone): com o evento usa o diálogo, sem ele mostra as instruções.
 */
type PromptDeInstalacao = Event & { prompt: () => Promise<void> };

export default function InstalarNoTelemovel() {
  const [prompt, setPrompt] = useState<PromptDeInstalacao | null>(null);
  const [instalado, setInstalado] = useState(true); // até prova em contrário, não incomoda
  const [aMostrarComoFazer, setAMostrarComoFazer] = useState(false);

  useEffect(() => {
    // A correr como app instalada? Então a linha não tem nada para vender.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    setInstalado(standalone);

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
        onClick={() => {
          if (prompt) {
            prompt.prompt();
          } else {
            setAMostrarComoFazer((v) => !v);
          }
        }}
      />
      {aMostrarComoFazer && (
        <div className="border-t border-slate-100 bg-[#F4F8FB] px-4 py-3 text-[13px] leading-relaxed text-slate-600">
          <p className="font-semibold text-slate-800">Pôr o painel no ecrã inicial:</p>
          <p className="mt-1">
            <span className="font-medium">iPhone:</span> no Safari, toque em Partilhar
            (o quadrado com a seta) e depois em <span className="font-medium">Adicionar ao
            ecrã principal</span>.
          </p>
          <p className="mt-1">
            <span className="font-medium">Android:</span> no Chrome, menu ⋮ e depois{" "}
            <span className="font-medium">Adicionar ao ecrã principal</span>.
          </p>
          <p className="mt-1.5 text-slate-500">
            Fica um ícone CLYON que abre os seus trabalhos directamente, a ecrã inteiro.
          </p>
        </div>
      )}
    </>
  );
}
