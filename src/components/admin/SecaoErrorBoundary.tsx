"use client";

import { Component, type ReactNode } from "react";

/**
 * Limite de erro por secção.
 *
 * O painel tinha um único limite à volta de tudo: bastava a agenda rebentar
 * para o backoffice inteiro ficar num ecrã vermelho, e o operador perdia a
 * navegação e o contexto. Aqui a falha fica contida no separador onde
 * aconteceu — o resto continua a trabalhar.
 *
 * A mensagem técnica não vai para o ecrã. O operador recebe uma frase que
 * explica o que fazer e um código para dizer a quem investiga; a mensagem
 * real e a stack vão para a consola e para a telemetria.
 */

type Props = {
  /** Nome da secção, para a mensagem e para o registo. */
  seccao: string;
  /** Alternativa funcional — ex.: a agenda em lista quando o calendário falha. */
  fallback?: ReactNode;
  children: ReactNode;
};

type State = { hasError: boolean; ref: string };

/** Código curto e dizível ao telefone. Não identifica ninguém. */
function novaReferencia(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default class SecaoErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, ref: "" };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true, ref: novaReferencia() };
  }

  override componentDidCatch(error: unknown, info: unknown) {
    // Só aqui — nunca no ecrã. A mensagem do React vem minificada em produção
    // e serializa o objecto que a causou, que pode trazer dados do cliente.
    console.error(`[painel:${this.props.seccao}] ref=${this.state.ref}`, error, info);
  }

  private retry = () => this.setState({ hasError: false, ref: "" });

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
          <p className="text-sm font-semibold text-white">
            Não foi possível mostrar {this.props.seccao}.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            O resto do painel continua a funcionar.
            {this.props.fallback ? " Em baixo fica a mesma informação em lista." : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={this.retry}
              className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.14]"
            >
              Tentar de novo
            </button>
            <span className="font-mono text-[10px] text-slate-500">ref {this.state.ref}</span>
          </div>
        </div>
        {this.props.fallback}
      </div>
    );
  }
}
