/**
 * O AVISO DIZ O QUE FALTA — 12-11-2026 (decisão d9).
 *
 * Um formulário que não passa dizia «Falta preencher o que está assinalado
 * acima.» — e o que estava assinalado podia estar fora do ecrã. Agora o aviso
 * nomeia os campos, pela ordem do ecrã: «Falta: telemóvel (tem de ser
 * português), email.» Os nomes curtos vêm de cada ecrã (`rotulos`); um campo
 * que o ecrã não conheça entra com a frase do próprio erro.
 *
 * Pura: corre nos testes do site. Quem pinta, rola e foca é `useFormulario`,
 * em componentes/ui.tsx.
 */

export function fraseDoQueFalta(erros: Record<string, string>, rotulos: Record<string, string>): string | null {
  const campos = Object.keys(erros).filter((k) => typeof erros[k] === "string" && erros[k].trim());
  if (campos.length === 0) return null;
  const ordem = Object.keys(rotulos);
  // Primeiro os que o ecrã conhece, pela ordem dele; depois os outros, pela ordem do erro.
  const conhecidos = ordem.filter((k) => campos.includes(k));
  const outros = campos.filter((k) => !ordem.includes(k));
  const nomes = [
    ...conhecidos.map((k) => rotulos[k]),
    ...outros.map((k) => erros[k].trim().replace(/[.!]+$/, "").replace(/^./, (l) => l.toLowerCase())),
  ];
  return `Falta: ${nomes.join(", ")}.`;
}

/** Dos campos com erro, o primeiro pela ordem do ecrã (para onde se rola, se medir falhar). */
export function primeiroCampoComErro(erros: Record<string, string>, rotulos: Record<string, string>): string | null {
  const campos = Object.keys(erros).filter((k) => typeof erros[k] === "string" && erros[k].trim());
  return Object.keys(rotulos).find((k) => campos.includes(k)) ?? campos[0] ?? null;
}
