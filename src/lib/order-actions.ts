// Helpers puros das acções de administração sobre pedidos do app CLYON.
// Mantidos fora do componente para serem testáveis e reutilizáveis.

// Normaliza um número de telefone português para o formato wa.me (E.164 sem +).
// Aceita "931 632 622", "+351931632622", "351931632622" → "351931632622".
export function normalizePhoneForWhatsapp(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("351")) return digits;
  // Número nacional (9 dígitos) sem indicativo → prefixar 351
  if (digits.length === 9) return `351${digits}`;
  return digits;
}

export function buildWhatsappLink(phone: string, orderId: string, categoryName: string): string {
  const number = normalizePhoneForWhatsapp(phone);
  const msg = `Olá, aqui é a equipa CLYON sobre o seu pedido #${orderId.slice(0, 8)} (${categoryName}).`;
  return `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
}

// A eliminação de um pedido exige um motivo não vazio (registado em auditoria).
export function deleteReasonError(reason: string): string | null {
  return reason.trim().length === 0 ? "Motivo obrigatório para eliminar um pedido." : null;
}
