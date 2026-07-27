/**
 * Perfil do profissional — regras partilhadas entre a API e o painel.
 *
 * Esquema real (types.ts gerado do Supabase, verificado a 25-07-2026):
 *   partner_profiles.id      → PK do PROFISSIONAL
 *   partner_profiles.user_id → FK para profiles.id (nome, email, telefone)
 *   partner_documents.partner_id → partner_profiles.id
 *   partner_services.partner_id  → partner_profiles.id
 *   reviews                  → NÃO tem partner_id; chega-se por
 *                              booking_id → bookings.partner_id
 *
 * ⚠️ Confundir `id` com `user_id` faz o painel listar profissionais sem
 * serviços, sem documentos e sem avaliações — sem erro nenhum.
 */

/** Estados do profissional (enum partner_status). */
export const PARTNER_STATUSES = ["pending", "in_review", "approved", "rejected", "suspended"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  pending:   "Candidatura submetida",
  in_review: "Em análise",
  approved:  "Aprovado",
  rejected:  "Rejeitado",
  suspended: "Suspenso",
};

/**
 * Escala em que `reviews.rating` está guardado: **0-10 é o canónico**.
 *
 * A app recolhe 5 estrelas e multiplica por 2 ao gravar. A migração
 * `20260725190000_perfis_e_avaliacoes.sql` — aplicada em produção a
 * 26-07-2026 — converteu também as linhas antigas.
 *
 * `quality_rating`, `punctuality_rating` e `communication_rating` seguem a
 * mesma escala.
 */
export const REVIEW_SCALE_MAX: 5 | 10 = 10;

/**
 * Linha técnica da CLYON em `partner_profiles`: o titular das reservas criadas
 * no checkout antes de haver profissional atribuído. NÃO é um profissional.
 *
 * A coluna `is_system` só existe depois da migração `20260726100000`; até lá
 * o nome comercial é o único marcador. Testar os dois torna a exclusão
 * correcta antes e depois do SQL correr.
 */
export const SYSTEM_PARTNER_TRADE_NAME = "CLYON — por atribuir";

export function isSystemPartner(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  if (row.is_system === true) return true;
  return String(row.trade_name ?? "").trim() === SYSTEM_PARTNER_TRADE_NAME;
}

/** Converte uma avaliação guardada para a escala de 5 estrelas que se mostra. */
export function toFiveStars(rating: number | null | undefined): number | null {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return null;
  const v = REVIEW_SCALE_MAX === 10 ? rating / 2 : rating;
  return Math.round(v * 10) / 10;
}

/** Estados de um documento (enum document_status). */
export const DOCUMENT_STATUSES = ["pending", "approved", "rejected"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/**
 * Tipos de documento pedidos ao profissional no onboarding.
 *
 * Desde 27-07-2026 a CLYON não paga ao profissional — o cliente entrega-lhe o
 * valor directamente. Sem transferência, não há IBAN a recolher, e o app
 * deixou de o pedir. Fica na lista de rótulos para os documentos já enviados
 * continuarem a ter nome, mas não é exigido a ninguém.
 */
export const REQUIRED_DOC_TYPES = ["id"] as const;

export const DOC_TYPE_LABELS: Record<string, string> = {
  id:       "Documento de identificação",
  nif:      "NIF",
  activity: "Início de actividade",
  iban:     "Comprovativo de IBAN",
};

/**
 * Documentos que o app exige para mostrar o selo de verificado ao cliente.
 * Aprovar o profissional NÃO chega — o selo só aparece com este documento
 * aprovado, e o painel tem de o dizer ao operador.
 *
 * Era `["id", "nif"]`. Enquanto o painel exigir mais do que o app, mostra
 * profissionais como não verificados quando o cliente já lhes vê o selo.
 */
export const BADGE_DOC_TYPES = ["id"] as const;

/**
 * Campos que SÓ o admin pode alterar. O profissional edita o resto pela app
 * (trade_name, bio, iban, regiões, serviços…), mas estes decidem se ele
 * trabalha e quanto ganha — nunca podem vir do lado dele.
 */
export const ADMIN_ONLY_FIELDS = [
  "status", "approved_at", "rejected_at", "rejection_reason",
  "suspended_until", "suspension_reason", "tier", "trust_score",
  "earning_share", "quality_flags", "rating", "jobs_completed",
] as const;

/** Campos públicos que o admin pode corrigir em nome do profissional. */
export const ADMIN_EDITABLE_PUBLIC_FIELDS = [
  "trade_name", "legal_name", "description", "bio",
  "regions", "service_categories", "has_vehicle",
  "vehicle_capacity_m3", "vehicle_max_weight_kg",
  "base_address", "base_radius_km",
] as const;

export interface PartnerDocumentLike {
  doc_type?: string | null;
  status?: string | null;
}

export interface VerificationState {
  /** true quando o app mostra o selo de verificado ao cliente */
  verified: boolean;
  /** Documentos do selo que faltam aprovar */
  missingDocs: string[];
  /** Explicação para o operador quando o selo não aparece */
  reason: string | null;
}

/**
 * Reproduz a condição EXACTA do selo de verificado no app:
 * status = 'approved' E os documentos 'id' e 'nif' ambos aprovados.
 */
export function verificationState(
  status: string | null | undefined,
  docs: PartnerDocumentLike[] | null | undefined,
): VerificationState {
  const aprovados = new Set(
    (docs ?? [])
      .filter((d) => d?.status === "approved")
      .map((d) => String(d?.doc_type ?? "")),
  );
  const missingDocs = BADGE_DOC_TYPES.filter((t) => !aprovados.has(t));

  if (status !== "approved") {
    return {
      verified: false,
      missingDocs,
      reason: missingDocs.length > 0
        ? `O profissional não está aprovado e faltam documentos aprovados: ${missingDocs.map((d) => DOC_TYPE_LABELS[d] ?? d).join(", ")}.`
        : "O profissional ainda não está aprovado — os documentos já estão em ordem.",
    };
  }

  if (missingDocs.length > 0) {
    return {
      verified: false,
      missingDocs,
      reason: `Aprovado, mas o selo de verificado não aparece no app: falta aprovar ${missingDocs.map((d) => DOC_TYPE_LABELS[d] ?? d).join(" e ")}.`,
    };
  }

  return { verified: true, missingDocs: [], reason: null };
}

/**
 * Apresentação pública do profissional.
 *
 * Histórico: a app do profissional gravava só em `bio` e o ecrã do cliente
 * lia `description` — resultado, um texto de marketing fixo sobre limpezas em
 * Lisboa, errado para qualquer outra categoria.
 *
 * Corrigido no Bridge a 25-07-2026: a app passou a escrever `description`, e
 * o ecrã do cliente passou a ler `bio` como segunda opção. Perfis antigos
 * ficaram recuperados sem ninguém os reeditar.
 *
 * Por isso `needsAttention` só é verdade quando AMBOS estão vazios — nesse
 * caso o cliente vê mesmo o texto genérico. Ter bio sem descrição deixou de
 * ser urgente; continua a valer a pena arrumar, e o botão de copiar mantém-se.
 */
export function publicDescriptionState(
  description: string | null | undefined,
  bio: string | null | undefined,
): { needsAttention: boolean; canCopyFromBio: boolean; message: string | null } {
  const desc = (description ?? "").trim();
  const b = (bio ?? "").trim();

  if (desc.length > 0) return { needsAttention: false, canCopyFromBio: false, message: null };

  if (b.length > 0) {
    return {
      needsAttention: false,
      canCopyFromBio: true,
      message: "A apresentação deste profissional está na bio, e não no campo de descrição pública. O cliente vê-a na mesma (a app usa a bio como alternativa), mas convém arrumar.",
    };
  }

  return {
    needsAttention: true,
    canCopyFromBio: false,
    message: "Sem descrição nem bio, a app mostra um texto genérico sobre limpezas em Lisboa — errado para qualquer outra categoria. Escreve uma apresentação.",
  };
}

/** Um pedido de alteração só passa se todos os campos forem conhecidos. */
export function validateProfilePatch(
  patch: Record<string, unknown>,
): { ok: boolean; error: string | null; allowed: Record<string, unknown> } {
  const permitidos = new Set<string>([
    ...ADMIN_ONLY_FIELDS,
    ...ADMIN_EDITABLE_PUBLIC_FIELDS,
  ]);

  const allowed: Record<string, unknown> = {};
  const rejeitados: string[] = [];

  for (const [k, v] of Object.entries(patch)) {
    if (permitidos.has(k)) allowed[k] = v;
    else rejeitados.push(k);
  }

  if (rejeitados.length > 0) {
    return {
      ok: false,
      error: `Campos não editáveis pelo painel: ${rejeitados.join(", ")}.`,
      allowed: {},
    };
  }

  if (typeof allowed.status === "string" && !(PARTNER_STATUSES as readonly string[]).includes(allowed.status)) {
    return { ok: false, error: `Estado inválido: "${allowed.status}".`, allowed: {} };
  }

  // NULL é uma escolha, não um vazio: significa "usa o padrão da plataforma".
  // Enquanto a coluna era NOT NULL DEFAULT 0.65 não havia como distinguir
  // "ninguém escolheu" de "acordámos 65%" — e foi essa ambiguidade que fez o
  // valor errado sobreviver a uma migração inteira.
  if (allowed.earning_share !== undefined && allowed.earning_share !== null) {
    const n = Number(allowed.earning_share);
    if (!Number.isFinite(n) || n <= 0 || n > 1) {
      return {
        ok: false,
        error: "A quota do profissional tem de ser uma fracção entre 0 e 1 (ex: 0.65 = 65%).",
        allowed: {},
      };
    }
  }

  if (Object.keys(allowed).length === 0) {
    return { ok: false, error: "Nada para alterar.", allowed: {} };
  }

  return { ok: true, error: null, allowed };
}

/**
 * Carimbos e motivos que acompanham cada mudança de estado. Sem isto, um
 * profissional rejeitado fica sem razão registada e ninguém sabe porquê.
 */
export function statusSideEffects(
  status: PartnerStatus,
  reason?: string | null,
): { patch: Record<string, unknown>; error: string | null } {
  const agora = new Date().toISOString();
  const motivo = typeof reason === "string" ? reason.trim() : "";

  if (status === "rejected") {
    if (!motivo) return { patch: {}, error: "Motivo obrigatório para rejeitar um profissional." };
    return { patch: { status, rejected_at: agora, rejection_reason: motivo }, error: null };
  }

  if (status === "suspended") {
    if (!motivo) return { patch: {}, error: "Motivo obrigatório para suspender um profissional." };
    return { patch: { status, suspension_reason: motivo }, error: null };
  }

  if (status === "approved") {
    // Limpa marcas de rejeição/suspensão anteriores — um profissional
    // aprovado não deve arrastar o motivo pelo qual foi recusado antes.
    return {
      patch: {
        status, approved_at: agora,
        rejected_at: null, rejection_reason: null,
        suspended_until: null, suspension_reason: null,
      },
      error: null,
    };
  }

  return { patch: { status }, error: null };
}
