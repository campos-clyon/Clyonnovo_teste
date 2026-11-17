/**
 * O CONVITE NOVO DA APP DE CLIENTE — 17-11-2026 (d59, parte 2; textos
 * aprovados pelo dono).
 *
 * O botão «Enviar o convite novo» (backoffice › Contas › Convidar para testar
 * a app) envia o convite novo — email e, a quem tem telemóvel na conta,
 * WhatsApp — a todas as contas de cliente com Gmail que ainda não aderiram,
 * também as que receberam o convite antigo de 01-11.
 *
 * As regras que não se passam:
 *  - só Gmail (o que a lista da Play reconhece), fora quem está no Programa
 *    da app (segue por lá) e fora quem já aderiu;
 *  - cada pessoa recebe o convite novo UMA vez (a chave da tabela é o email)
 *    e, 3 dias depois DELE, no máximo um lembrete (`lembrete-da-app.ts`);
 *  - o WhatsApp não sai de rajada: fica numa fila própria e sai um de cada
 *    vez, 20 a 45 s entre cada, das 9h às 21h de Lisboa, como o aviso a todos
 *    os profissionais (`aviso-aos-profissionais.ts`).
 *
 * ESTE FICHEIRO É PURO. A base está em `convite-novo-da-app-na-base.ts`.
 */

import { telemovelDoAviso } from "./aviso-aos-profissionais";

export type DestinatarioDoConvite = {
  id: number;
  nome: string | null;
  email: string;
  gmail: boolean;
  noPrograma: boolean;
};

export type ElegivelDoConviteNovo = {
  id: number;
  nome: string | null;
  email: string;
  /** O telemóvel em 351…, ou `null` se a conta não tem um telemóvel português. */
  telemovel: string | null;
};

/** Quem recebe o convite novo agora. */
export function elegiveisParaOConviteNovo(
  destinatarios: DestinatarioDoConvite[],
  telefones: Map<number, string | null>,
  emailsQueAderiram: Set<string>,
  emailsComConviteNovo: Set<string>,
): ElegivelDoConviteNovo[] {
  const saida: ElegivelDoConviteNovo[] = [];
  const vistos = new Set<string>();
  for (const d of destinatarios) {
    const email = d.email.trim().toLowerCase();
    if (!d.gmail || d.noPrograma) continue;
    if (emailsQueAderiram.has(email) || emailsComConviteNovo.has(email) || vistos.has(email)) continue;
    vistos.add(email);
    saida.push({ id: d.id, nome: d.nome, email, telemovel: telemovelDoAviso(telefones.get(d.id) ?? null) });
  }
  return saida;
}

/** O que a confirmação diz: quantos emails e quantos WhatsApp vão sair. */
export function contagemDoConviteNovo(lista: ElegivelDoConviteNovo[]): { emails: number; whatsapps: number } {
  return { emails: lista.length, whatsapps: lista.filter((e) => e.telemovel !== null).length };
}

export type TipoDeWhatsAppDaApp = "convite" | "lembrete";
