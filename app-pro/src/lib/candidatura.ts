import { emailValido, telefoneValido } from "../../../src/lib/inscricao-profissional";
import { CAMPOS_DA_CANDIDATURA } from "../../../src/lib/campos-da-candidatura";
import { MENSAGEM_SEM_FOTOGRAFIA } from "./fotografias-da-carrinha";

/**
 * A CANDIDATURA, VISTA ANTES DE SAIR — 12-11-2026 (decisão d9).
 *
 * As mesmas regras e as mesmas frases da rota (`/api/parceiros/candidatura`,
 * há um teste que as compara): o que falta aparece logo, todo de uma vez, e
 * não se gasta uma tentativa da rota com um campo vazio. O
 * servidor continua a ser quem decide — o que ele recusar aparece igual.
 */
export const MENSAGENS_DA_CANDIDATURA = {
  nome: "Indique o seu nome ou o da empresa.",
  email: "Indique um email válido — é para lá que vai o convite.",
  telefone: "Indique um telemóvel português.",
  cidade: "Diga de onde trabalha — é o que decide que pedidos lhe chegam.",
  servicos: "Escolha pelo menos um serviço que faça.",
} as const;

/**
 * Os nomes do aviso «Falta: …», pela ordem do formulário: os do site
 * (`CAMPOS_DA_CANDIDATURA`, a mesma lista que o formulário e a rota usam).
 */
export const ROTULOS_DA_CANDIDATURA: Record<string, string> = Object.fromEntries(
  CAMPOS_DA_CANDIDATURA.map((c) => [c.campo, c.nome]),
);

export function errosDaCandidatura(c: {
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  servicos: readonly string[];
  fotografias: readonly string[];
}): Record<string, string> {
  const erros: Record<string, string> = {};
  if (c.nome.trim().length < 2) erros.nome = MENSAGENS_DA_CANDIDATURA.nome;
  if (!emailValido(c.email.trim().toLowerCase())) erros.email = MENSAGENS_DA_CANDIDATURA.email;
  if (!telefoneValido(c.telefone.trim())) erros.telefone = MENSAGENS_DA_CANDIDATURA.telefone;
  if (!c.cidade.trim()) erros.cidade = MENSAGENS_DA_CANDIDATURA.cidade;
  if (c.servicos.length === 0) erros.servicos = MENSAGENS_DA_CANDIDATURA.servicos;
  if (c.fotografias.length === 0) erros.fotografias = MENSAGEM_SEM_FOTOGRAFIA;
  return erros;
}
