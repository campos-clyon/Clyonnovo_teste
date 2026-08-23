"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * Apagar a conta — o mesmo aviso dos dois lados.
 *
 * UM COMPONENTE E NÃO DOIS
 *
 * O cliente e o profissional apagam a conta pela mesma razão e com o mesmo
 * risco. Escrito duas vezes, mais cedo ou mais tarde um dos lados ganhava um
 * guarda que o outro não tinha, ou uma frase que já não era verdade — foi
 * exactamente o que aconteceu ao rodapé quando havia dois.
 *
 * O QUE MUDA ENTRE OS DOIS
 *
 * O endereço que recebe o pedido, o que fica escrito no aviso, e o que se faz
 * quando acaba. Mais nada.
 *
 * O BOTÃO QUE ABRE ISTO É DISCRETO DE PROPÓSITO
 *
 * Estava aqui uma caixa vermelha com um parágrafo permanente a explicar o
 * apagamento — no ecrã de segurança de quem só queria mudar a palavra-passe.
 * Uma acção que a maior parte das pessoas nunca vai usar não merece ocupar
 * espaço fixo, e uma caixa vermelha permanente ensina a ignorar caixas
 * vermelhas. A explicação vive aqui dentro, atrás de um toque, onde é lida
 * por quem está mesmo a pensar nisso.
 */
export default function ApagarContaModal({
  endereco,
  aviso,
  aoTerminar,
  onClose,
}: {
  /** A rota que recebe o DELETE. */
  endereco: string;
  /** O que esta pessoa perde, nas palavras dela. */
  aviso: React.ReactNode;
  /** Corre depois de a conta desaparecer. */
  aoTerminar: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [palavra, setPalavra] = useState("");
  const [aApagar, setAApagar] = useState(false);
  const [erro, setErro] = useState<string>("");

  const apagar = async () => {
    if (palavra !== "ELIMINAR") return;
    setAApagar(true);
    setErro("");
    try {
      const res = await fetch(endereco, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmacao: "ELIMINAR" }),
      });
      const dados = await res.json().catch(() => ({}) as Record<string, unknown>);
      if (!res.ok) {
        /*
         * 409 não é avaria: é dinheiro por levantar ou um trabalho por
         * confirmar, e a pessoa precisa de LER o motivo para saber o que
         * resolver. "Tente novamente" mandava-a repetir o mesmo até desistir.
         */
        setErro(
          typeof dados.error === "string"
            ? dados.error
            : "Não foi possível apagar a conta. Tente novamente.",
        );
        setAApagar(false);
        return;
      }
      await aoTerminar();
    } catch {
      setErro("Erro de rede. Verifique a ligação e tente novamente.");
      setAApagar(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apagar-conta-titulo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 id="apagar-conta-titulo" className="text-base font-semibold text-slate-900">
              Apagar a conta
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-800">Isto não tem volta.</span> {aviso}
          </p>

          <div>
            <label htmlFor="apagar-conta-palavra" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Escreva <span className="font-mono text-red-600">ELIMINAR</span> para confirmar
            </label>
            <input
              id="apagar-conta-palavra"
              type="text"
              value={palavra}
              onChange={(e) => setPalavra(e.target.value)}
              placeholder="ELIMINAR"
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-400/10"
            />
          </div>

          {erro && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-700">
              {erro}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={aApagar}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={palavra !== "ELIMINAR" || aApagar}
            onClick={apagar}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {aApagar ? "A apagar…" : "Apagar a conta"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * O que abre o modal: uma linha, e não uma caixa.
 *
 * Fica no fim do ecrã de segurança, em cinzento, do tamanho do texto legal.
 * Quem a procura encontra-a; quem não a procura não tropeça nela.
 */
export function LinhaApagarConta({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer border-none bg-transparent p-0 text-xs text-slate-400 underline underline-offset-4 transition-colors hover:text-red-600"
    >
      Apagar a minha conta
    </button>
  );
}
