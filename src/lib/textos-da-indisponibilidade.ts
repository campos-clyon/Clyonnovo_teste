/**
 * «DIAS EM QUE NÃO PODE TRABALHAR» — as palavras e o pedido, iguais no painel
 * e na app Pro (d35, 15-11-2026).
 *
 * O painel (`src/app/profissionais/painel/Indisponibilidades.tsx`) e a app Pro
 * (`app-pro/src/componentes/Indisponibilidades.tsx`) mostram estas frases e
 * fazem o pedido com `corpoDaMarcacao` — uma frase mudada aqui muda nos dois.
 * As regras (o que se aceita, o texto de cada linha da lista, a pergunta do
 * trabalho marcado) continuam no servidor, em `indisponibilidade.ts`.
 */

/** A rota do painel e da app (sessão do profissional). */
export const ROTA_DAS_INDISPONIBILIDADES = "/api/profissionais/indisponibilidades";

export const TEXTOS_DA_INDISPONIBILIDADE = {
  titulo: "Dias em que não pode trabalhar",
  marcarIndisponivel: "Marcar indisponível",
  explicacao: "Os pedidos novos para esses dias não lhe chegam. Os que não têm dia certo chegam, com um aviso.",
  diasInteiros: "Dias inteiros",
  umasHoras: "Umas horas de um dia",
  de: "De",
  dia: "Dia",
  ateOpcional: "Até (opcional)",
  das: "Das",
  as: "Às",
  nota: "Nota (só para si e para a equipa)",
  exemploDaNota: "Ex.: férias",
  marcar: "Marcar",
  aMarcar: "A marcar…",
  cancelar: "Cancelar",
  desmarcar: "Desmarcar",
  marcarNaMesma: "Marcar na mesma",
  trabalhos: "Trabalhos",
  naoMarcou: "Não foi possível marcar.",
  naoDesmarcou: "Não foi possível desmarcar.",
  erroDeRede: "Erro de rede. Tente outra vez.",
} as const;

/** O que se escolheu no formulário. */
export type EscolhaDaIndisponibilidade = {
  soHoras: boolean;
  dia: string;
  /** Dias inteiros: o último dia, ou vazio para um dia só. */
  ate: string;
  inicio: string;
  fim: string;
  nota: string;
};

/**
 * O corpo do POST. Dias inteiros sem «Até» é um dia só; umas horas são num dia
 * só (sem `ate`). `confirmar: true` depois de responder à pergunta do trabalho
 * marcado.
 */
export function corpoDaMarcacao(e: EscolhaDaIndisponibilidade, confirmar = false) {
  return e.soHoras
    ? { dia: e.dia, inicio: e.inicio, fim: e.fim, nota: e.nota, confirmar }
    : { dia: e.dia, ate: e.ate || e.dia, nota: e.nota, confirmar };
}

/** Um trabalho em cima do período, como a rota o devolve no 409. */
export type TrabalhoEmCima = { pedidoId: number; negociacaoId?: number; quando: string };

/** A resposta 409 «precisa confirmar», ou null se o corpo não for isso. */
export function perguntaDoTrabalhoMarcado(
  estado: number,
  corpo: unknown,
): { pergunta: string; trabalhos: TrabalhoEmCima[] } | null {
  if (estado !== 409 || !corpo || typeof corpo !== "object") return null;
  const c = corpo as { precisaConfirmar?: unknown; pergunta?: unknown; trabalhos?: unknown };
  if (c.precisaConfirmar !== true || typeof c.pergunta !== "string") return null;
  const trabalhos = Array.isArray(c.trabalhos)
    ? c.trabalhos.filter(
        (t): t is TrabalhoEmCima =>
          !!t && typeof t === "object" && typeof (t as TrabalhoEmCima).pedidoId === "number",
      )
    : [];
  return { pergunta: c.pergunta, trabalhos };
}

/** «Trabalhos: #512, #498» — a linha por baixo da pergunta. */
export function trabalhosEmCimaPorExtenso(trabalhos: TrabalhoEmCima[]): string {
  return `${TEXTOS_DA_INDISPONIBILIDADE.trabalhos}: ${trabalhos.map((t) => `#${t.pedidoId}`).join(", ")}`;
}
