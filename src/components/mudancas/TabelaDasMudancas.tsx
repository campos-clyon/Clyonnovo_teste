import {
  HORAS_POR_TIPOLOGIA,
  HORAS_A_MAIS_COM_DESMONTAGEM,
  MINIMO_DE_HORAS,
  PRECO_POR_HORA,
  PRECO_POR_HORA_COM_IVA,
  TIPOLOGIA_POR_EXTENSO,
  tabelaEmLinhas,
  type Tipologia,
} from "@/lib/tabela-das-mudancas";

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/**
 * A TABELA DAS MUDANÇAS, À VISTA — 13-10-2026.
 *
 * *«Sim, publicar.»* — o dono, quando se lhe perguntou se a tabela à hora ia
 * para o site. Até aqui as páginas de mudanças diziam «orçamento
 * personalizado» e nenhum número, porque o motor dava 490 € a qualquer
 * mudança e não havia um piso honesto para anunciar. Agora há: é a tabela,
 * a mesma que o motor usa (`tabela-das-mudancas.ts`).
 *
 * Os números estão SEM IVA, como na tabela do dono, e o preço da hora diz-se
 * também com IVA — que é o que o cliente vai pagar.
 */
export default function TabelaDasMudancas({ compacta = false }: { compacta?: boolean }) {
  const tipologias = Object.keys(HORAS_POR_TIPOLOGIA) as Tipologia[];
  return (
    <div>
      <p className="text-3xl font-bold text-slate-900">
        {euros(PRECO_POR_HORA)} <span className="text-lg font-semibold text-slate-600">+ IVA por hora</span>
      </p>
      <p className="mt-1 text-sm text-slate-600">
        {euros(PRECO_POR_HORA_COM_IVA)} com IVA · carrinha, motorista e 2 ajudantes · mínimo de{" "}
        {MINIMO_DE_HORAS} horas. A mudança paga-se pelas horas de trabalho.
      </p>

      {!compacta && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {tabelaEmLinhas().map((secao) => (
            <div key={secao.titulo} className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-800">{secao.titulo}</h3>
              <dl className="mt-3 space-y-2">
                {secao.linhas.map(([o, quanto, comIva]) => (
                  <div key={o} className="flex items-start justify-between gap-3 text-sm">
                    <dt className="text-slate-700">{o}</dt>
                    <dd className="shrink-0 text-right font-semibold text-slate-900">
                      {quanto}
                      {/* O mesmo com IVA, por baixo (31-10-2026). */}
                      {comIva && <span className="block text-xs font-normal text-slate-600">{comIva}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Quantas horas costuma levar</h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {tipologias.map((t) => (
            <li key={t} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
              {TIPOLOGIA_POR_EXTENSO[t]}: <strong>{HORAS_POR_TIPOLOGIA[t]} h</strong>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Com desmontagem e montagem de móveis, conte mais {HORAS_A_MAIS_COM_DESMONTAGEM} h. São horas
          habituais, não um limite: o parceiro diz quantas prevê ao ver o que vai.
        </p>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Valores sem IVA e, por baixo de cada um, o mesmo com IVA (23 %).
      </p>
    </div>
  );
}
