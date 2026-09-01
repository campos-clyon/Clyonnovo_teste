"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { isPushSupported, isPushEnabled, enablePush, disablePush } from "@/lib/push-client";

/**
 * O AVISO QUE DECIDE QUEM TRABALHA.
 *
 * Um pedido chega a vários profissionais ao mesmo tempo e quem responde
 * primeiro ganha quase sempre. Até aqui ele só sabia de um pedido novo se
 * abrisse o email ou se se lembrasse de entrar no painel — e a diferença entre
 * saber às 9h05 e saber às 11h é a diferença entre ter o trabalho e não ter.
 *
 * A INFRAESTRUTURA JÁ ESTAVA TODA FEITA e nunca tinha sido ligada a ninguém: o
 * service worker, as chaves VAPID, a tabela das subscrições. Faltavam duas
 * coisas — alguém a chamar `sendPushToUser` (ver `avisar-por-push.ts`) e o
 * profissional poder subscrever, que as rotas só deixavam ao cliente.
 *
 * PORQUE É QUE ISTO É UM CARTÃO E NÃO UMA LINHA NAS DEFINIÇÕES
 *
 * Porque uma permissão que se pede numa página escondida não é pedida. Isto
 * aparece no menu, com a razão à frente, e desaparece assim que ele decidir —
 * activando ou dispensando. Um pedido de permissão que fica para sempre no ecrã
 * deixa de ser um pedido e passa a ser um incómodo, e um incómodo é recusado.
 */

const DISPENSADO = "clyon_avisos_dispensados";

export default function AvisosNoTelemovel() {
  const [suportado, setSuportado] = useState(false);
  const [ligado, setLigado] = useState(false);
  const [aTratar, setATratar] = useState(false);
  const [dispensado, setDispensado] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!isPushSupported()) return;
    setSuportado(true);
    try {
      setDispensado(localStorage.getItem(DISPENSADO) === "1");
    } catch {
      /* Um browser sem armazenamento mostra o cartão. É o lado certo do erro. */
      setDispensado(false);
    }
    void isPushEnabled().then(setLigado);
  }, []);

  async function ligar() {
    setATratar(true);
    setErro("");
    try {
      const ok = await enablePush();
      if (ok) setLigado(true);
      else
        setErro(
          "O telemóvel recusou a permissão. Pode dá-la nas definições do browser, em Notificações.",
        );
    } catch {
      setErro("Não foi possível activar. Tente outra vez.");
    } finally {
      setATratar(false);
    }
  }

  async function desligar() {
    setATratar(true);
    try {
      await disablePush();
      setLigado(false);
    } finally {
      setATratar(false);
    }
  }

  function dispensar() {
    setDispensado(true);
    try {
      localStorage.setItem(DISPENSADO, "1");
    } catch {
      /* Sem armazenamento volta a aparecer na próxima visita. Paciência. */
    }
  }

  if (!suportado) return null;

  /*
   * JÁ LIGADO: uma linha discreta, e não um cartão a felicitá-lo.
   *
   * Serve para uma coisa só — quem quiser desligar tem de encontrar onde. Uma
   * definição que se liga e não se desliga é uma armadilha.
   */
  if (ligado) {
    return (
      <button
        onClick={desligar}
        disabled={aTratar}
        className="mb-4 flex w-full items-center gap-2 rounded-xl px-1 py-2 text-left text-xs text-slate-500 transition active:text-slate-700 disabled:opacity-50"
      >
        {aTratar ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <Bell className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
        )}
        Avisos ligados neste telemóvel.{" "}
        <span className="underline underline-offset-2">Desligar</span>
      </button>
    );
  }

  if (dispensado) return null;

  return (
    <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
        <BellOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        Ligue os avisos e saiba dos pedidos primeiro
      </p>
      <p className="mt-1 text-xs leading-relaxed text-amber-800">
        Um pedido chega a vários profissionais ao mesmo tempo, e quem responde
        primeiro fica quase sempre com o trabalho. Avisamos no telemóvel quando
        entra um pedido na sua zona, e quando um cliente o contrata. Mais nada.
      </p>
      {erro && <p className="mt-2 text-xs font-semibold text-rose-700">{erro}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={ligar}
          disabled={aTratar}
          className="flex min-h-[42px] items-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white transition active:bg-amber-700 disabled:opacity-50"
        >
          {aTratar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Ligar os avisos
        </button>
        <button
          onClick={dispensar}
          className="min-h-[42px] px-3 text-sm font-medium text-amber-800 underline underline-offset-2"
        >
          Agora não
        </button>
      </div>
    </section>
  );
}
