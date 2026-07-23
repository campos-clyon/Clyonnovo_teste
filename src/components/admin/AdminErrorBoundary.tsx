"use client";

import { Component, type ReactNode } from "react";

interface State {
  hasError: boolean;
  message: string;
}

export default class AdminErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Erro desconhecido no painel.",
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#050D17] px-4">
          <div className="max-w-md rounded-[28px] border border-red-500/20 bg-red-500/[0.06] p-8 text-center">
            <p className="text-4xl">⚠️</p>
            <h1 className="mt-4 text-lg font-bold text-white">Erro no painel de administração</h1>
            <p className="mt-2 text-sm text-slate-400">{this.state.message}</p>
            <button
              className="mt-6 rounded-xl bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.10] transition"
              onClick={() => {
                this.setState({ hasError: false, message: "" });
                window.location.reload();
              }}
            >
              Recarregar painel
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
