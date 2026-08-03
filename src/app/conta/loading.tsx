/**
 * O que aparece enquanto a conta carrega.
 *
 * Sem este ficheiro, tocar em "Conta" não fazia nada visível: o Next fica na
 * página anterior a pedir o conteúdo da nova, e /conta é `force-dynamic` com
 * sessão a validar e consultas a uma base remota pelo meio. No telemóvel isso
 * são segundos com o ecrã igual e o botão aparentemente morto — a pessoa toca
 * outra vez, e outra.
 *
 * Com um `loading.tsx`, o Next troca de ecrã no instante do toque e mostra
 * isto até os dados chegarem. Não acelera nada; muda "não funciona" para "está
 * a carregar", que é a diferença entre desistir e esperar.
 *
 * Nenhuma rota do site tinha um. Esta é a que mais dói porque é a única do
 * menu de baixo que precisa de sessão e de base de dados.
 */
function Barra({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}

export default function ContaLoading() {
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        {/* Cabeçalho: avatar e nome */}
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 animate-pulse rounded-full bg-slate-200" />
          <div className="flex-1 space-y-2">
            <Barra className="h-5 w-40" />
            <Barra className="h-3.5 w-56" />
          </div>
        </div>

        {/* Resumo */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
              <Barra className="h-3 w-20" />
              <Barra className="mt-3 h-7 w-14" />
            </div>
          ))}
        </div>

        {/* Pedidos */}
        <Barra className="mt-8 h-4 w-32" />
        <div className="mt-3 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <Barra className="h-4 w-1/2" />
                  <Barra className="h-3 w-3/4" />
                </div>
                <Barra className="h-6 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-slate-400">A carregar a sua conta…</p>
      </div>
    </div>
  );
}
