"use client";

import { Component, type ReactNode } from "react";

/**
 * Rede de segurança final do painel. O caso comum já é apanhado pelo
 * SecaoErrorBoundary de cada separador — aqui só chega o que rebentar fora
 * deles, e nessa altura não há nada a preservar senão a saída.
 *
 * A mensagem do React não vai para o ecrã: em produção vem minificada e
 * serializa o objecto que a causou, que pode trazer dados do cliente. Fica na
 * consola, com um código que o operador pode dizer a quem investiga.
 */
interface State {
  hasError: boolean;
  ref: string;
}

export default class AdminErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, ref: "" };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true, ref: Math.random().toString(36).slice(2, 8).toUpperCase() };
  }

  override componentDidCatch(error: unknown, info: unknown) {
    console.error(`[painel] ref=${this.state.ref}`, error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#050D17] px-4">
          <div className="max-w-md rounded-[28px] border border-red-500/20 bg-red-500/[0.06] p-8 text-center">
            <p className="text-4xl">⚠️</p>
            <h1 className="mt-4 text-lg font-bold text-white">O painel não conseguiu abrir</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Recarrega para tentar de novo. Se voltar a acontecer, diz o código
              em baixo a quem for investigar.
            </p>
            <button
              className="mt-6 rounded-xl bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.10] transition"
              onClick={() => {
                this.setState({ hasError: false, ref: "" });
                window.location.reload();
              }}
            >
              Recarregar painel
            </button>
            <p className="mt-3 font-mono text-[10px] text-slate-500">ref {this.state.ref}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
