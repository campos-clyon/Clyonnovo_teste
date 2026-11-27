/**
 * A LINHA DISCRETA DO TOPO DA MESA — d142 (27-11-2026, dono).
 *
 * *«A mesa de trabalho em destaque e em primeiro. O resto passa para botões
 * pequenos numa linha discreta, com contador; ao carregar abre por baixo.»*
 *
 * Quem entra na linha (o «Precisa de si», os sem valor há mais de 4 h, as
 * propostas há mais de 24 h, cada grupo do «Do nosso lado», os fechados da
 * semana) devolve um fragmento: os botões ficam na linha e o conteúdo de cada
 * um, quando aberto, vai para o fim da linha a toda a largura (`order-last
 * basis-full`), por isso a linha nunca parte a meio. Nascem todos fechados.
 *
 * Só classes que o backoffice já usa: o modo claro do painel traduz cada uma no
 * globals.css, e uma classe nova sem regra ficava escura no claro.
 */

/** O botão pequeno: o número à cabeça e o rótulo curto; o porquê vai no `title`. */
export const BOTAO_DA_LINHA =
  "inline-flex items-baseline gap-1 rounded-md border px-2 py-0.5 text-xs transition";
/** Sem pressa. */
export const BOTAO_NEUTRO = "border-slate-700 bg-slate-950/40 text-slate-200 hover:bg-slate-800/60";
/** Alguém está à espera (atrasados, à espera de si, por transferir, propostas >24 h). */
export const BOTAO_URGENTE = "border-amber-500/40 bg-amber-500/[0.08] text-amber-200 hover:bg-amber-500/15";
/** Por enviar sem valor há mais de 4 h: é o selo vermelho da Mesa. */
export const BOTAO_VERMELHO = "border-red-500/30 bg-red-500/[0.06] text-red-300 hover:bg-red-500/15";
/** O botão cujo conteúdo está aberto por baixo. */
export const BOTAO_ABERTO = "border-cyan-500 bg-slate-950/40 text-cyan-200";

/** O conteúdo aberto: no fim da linha, a toda a largura. */
export const PAINEL_DA_LINHA = "order-last basis-full rounded-xl border border-slate-800 bg-slate-900/60 p-3";
