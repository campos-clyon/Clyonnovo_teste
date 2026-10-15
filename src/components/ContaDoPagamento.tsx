import type { ContaDoPagamento as Conta } from "@/lib/conta-do-pagamento";
import { emEuros, emPercentagem } from "@/lib/conta-do-pagamento";

/*
 * A CONTA DE UM PAGAMENTO, DEGRAU A DEGRAU — 15-10-2026.
 *
 * *«Seja didático: que ele mostre o valor que o cliente pagou, se ele pagou o
 * IVA e quanto foi do IVA, depois qual foi a taxa usada e qual é o valor da
 * taxa. Assim mostra quanto a gente recebeu no total, quanto foi de IVA,
 * quanto foi de taxa e quanto a gente tem que pagar ao profissional.»*
 *
 * Lê-se de cima para baixo como uma conta feita à mão: o total, menos o IVA,
 * igual ao sem IVA, menos cada taxa com a sua percentagem, igual ao que vai
 * para o profissional — e, por baixo, o que fica para a CLYON. Os números
 * saem de `conta-do-pagamento.ts`; aqui só se desenham.
 *
 * Dois tons: «escuro» no backoffice, «claro» no painel do profissional e na
 * conta do cliente.
 */
export default function ContaDoPagamento({
  conta,
  tom = "escuro",
  titulo = "Conta do pagamento",
  mostrarClyon = true,
}: {
  conta: Conta;
  tom?: "escuro" | "claro";
  titulo?: string | null;
  /** O profissional não precisa de ver o que fica para a CLYON — vê as taxas. */
  mostrarClyon?: boolean;
}) {
  const escuro = tom === "escuro";
  const c = {
    caixa: escuro ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white",
    titulo: escuro ? "text-slate-400" : "text-slate-500",
    rotulo: escuro ? "text-slate-300" : "text-slate-700",
    valor: escuro ? "text-white" : "text-slate-900",
    menos: escuro ? "text-slate-400" : "text-slate-500",
    nota: escuro ? "text-slate-500" : "text-slate-500",
    linha: escuro ? "border-slate-800" : "border-slate-200",
    final: escuro ? "text-emerald-300" : "text-emerald-700",
    pct: escuro ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600",
  };

  return (
    <div className={`rounded-xl border px-3 py-2.5 text-sm ${c.caixa}`}>
      {titulo ? (
        <p className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wide ${c.titulo}`}>{titulo}</p>
      ) : null}
      <dl className="space-y-1">
        {conta.degraus.map((d, i) => {
          const sinal = d.tipo === "menos" ? "−" : d.tipo === "igual" ? "=" : "";
          const forte = d.tipo !== "menos";
          const corDoValor = d.final ? c.final : d.tipo === "menos" ? c.menos : c.valor;
          return (
            <div
              key={`${d.rotulo}-${i}`}
              className={`flex items-start justify-between gap-3 ${d.tipo === "igual" ? `border-t pt-1 ${c.linha}` : ""}`}
            >
              <dt className={`min-w-0 ${c.rotulo}`}>
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span aria-hidden="true" className={`w-3 shrink-0 text-center font-bold ${c.menos}`}>
                    {sinal}
                  </span>
                  <span className={forte ? "font-semibold" : ""}>{d.rotulo}</span>
                  {d.percentagem != null ? (
                    <span className={`rounded px-1.5 py-px text-[10px] font-bold tabular-nums ${c.pct}`}>
                      {emPercentagem(d.percentagem)}
                    </span>
                  ) : null}
                </span>
                {d.nota ? <span className={`block pl-[1.125rem] text-[11px] leading-4 ${c.nota}`}>{d.nota}</span> : null}
              </dt>
              <dd className={`shrink-0 tabular-nums ${forte ? "font-bold" : ""} ${corDoValor}`}>
                {d.tipo === "menos" ? "− " : ""}
                {emEuros(d.valor)}
              </dd>
            </div>
          );
        })}
      </dl>
      {mostrarClyon ? (
        <p className={`mt-2 border-t pt-1.5 text-xs ${c.linha} ${c.nota}`}>
          Fica para a CLYON:{" "}
          <strong className={`tabular-nums ${conta.clyon < 0 ? "text-red-400" : c.final}`}>{emEuros(conta.clyon)}</strong>
          {conta.taxas.length > 1 ? ` (${conta.taxas.map((t) => emEuros(t.valor)).join(" + ")})` : ""}, sem IVA
        </p>
      ) : null}
      {conta.notas.map((n) => (
        <p
          key={n}
          className={`mt-1.5 rounded-md px-2 py-1 text-[11px] leading-4 ${
            escuro ? "bg-amber-500/10 text-amber-200" : "bg-amber-50 text-amber-800"
          }`}
        >
          {n}
        </p>
      ))}
    </div>
  );
}
