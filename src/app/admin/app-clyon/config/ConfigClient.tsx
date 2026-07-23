"use client";

import AppClyonShell from "../AppClyonShell";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import Link from "next/link";

// Zonas de cobertura activas — fonte de verdade: src/lib/coverage.ts
// Este painel mostra-as em modo leitura; editar via código (não há tabela de config).
const COVERAGE_ZONES = [
  "Lisboa", "Almada", "Setúbal", "Seixal", "Barreiro", "Montijo",
  "Sesimbra", "Palmela", "Moita", "Alcochete", "Loures", "Amadora",
  "Sintra", "Cascais", "Oeiras", "Vila Franca de Xira",
];

export default function ConfigClient() {
  useAdminAuth({ skip: false }); // garante autenticação antes de renderizar

  return (
    <AppClyonShell>
      <div className="px-5 py-6 md:px-8">
        <div className="mb-6">
          <h2 className="text-base font-bold text-white">Configuração da App</h2>
          <p className="text-xs text-slate-500">Configurações operacionais com integração efectiva no código</p>
        </div>

        {/* Zonas de cobertura — leitura, não editável aqui */}
        <div className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <h3 className="mb-1 text-sm font-semibold text-white">Zonas de cobertura</h3>
          <p className="mb-4 text-xs text-slate-500">
            Fonte: <code className="text-slate-600">src/lib/coverage.ts</code> — editável no código.
            Não existe tabela de configuração de zonas; edição aqui seria decorativa sem efeito real.
          </p>
          <div className="flex flex-wrap gap-2">
            {COVERAGE_ZONES.map((z) => (
              <span
                key={z}
                className="rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1 text-xs text-slate-300"
              >
                {z}
              </span>
            ))}
          </div>
        </div>

        {/* Categorias activas — link para Catálogo */}
        <div className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <h3 className="mb-1 text-sm font-semibold text-white">Categorias visíveis na app</h3>
          <p className="mb-3 text-xs text-slate-500">
            Gerir quais categorias estão activas na aplicação — activar, arquivar e ordenar.
          </p>
          <Link
            href="/admin/app-clyon/catalogo"
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-500/20"
          >
            Ir para Catálogo →
          </Link>
        </div>

        {/* Regras de triagem — N/D sem tabela */}
        <div className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <h3 className="mb-1 text-sm font-semibold text-white">Regras de triagem e SLA</h3>
          <p className="text-xs text-slate-500">
            N/D — não existe tabela de configuração de SLA/triagem persistida.
            Implementar quando houver consumidor real no fluxo de pedidos da app.
          </p>
        </div>

        {/* Modelos de comunicação — N/D */}
        <div className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <h3 className="mb-1 text-sm font-semibold text-white">Modelos de comunicação</h3>
          <p className="text-xs text-slate-500">
            N/D — modelos de e-mail/notificação não têm persistência configurável actualmente.
            Quando implementados, serão expostos aqui com validação e auditoria.
          </p>
        </div>

        {/* Limites de orçamento — N/D */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <h3 className="mb-1 text-sm font-semibold text-white">Limites de orçamento</h3>
          <p className="text-xs text-slate-500">
            N/D — limites de orçamento são calculados pelo motor de preços em{" "}
            <code className="text-slate-600">src/lib/pricing-helper.ts</code>.
            Não há tabela de configuração de limites; edição aqui não teria efeito.
          </p>
        </div>
      </div>
    </AppClyonShell>
  );
}
