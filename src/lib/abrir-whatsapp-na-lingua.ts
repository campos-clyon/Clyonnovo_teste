import { linkDeWhatsApp } from "./link-de-whatsapp";

/**
 * ABRIR O WHATSAPP COM A MENSAGEM NA LÍNGUA DO CLIENTE — 15-11-2026 (d47).
 *
 * Os botões que abrem o WhatsApp de quem está ao backoffice («Enviar
 * orçamento», «Enviar proposta ao cliente», a adjudicação) levavam sempre o
 * português — e a um cliente que fala inglês saía primeiro o português e
 * depois o inglês, pelo número da CLYON (o #623). Agora o texto passa pelo
 * servidor (`/api/admin/whatsapp/na-lingua`) e o separador abre-se já com ele.
 *
 * O separador abre-se NO CLIQUE, vazio, e só depois se leva à conversa: o
 * Chrome recusa um `window.open` que venha segundos depois do gesto (ver o
 * «Enviar orçamento» de 21-09-2026). Sem resposta do servidor, abre com o
 * texto como estava — nunca fica sem abrir.
 *
 * Devolve o texto que foi (para quem o quiser copiar), ou null sem telefone.
 */
export async function abrirWhatsAppNaLingua(
  telefone: string | null | undefined,
  texto: string,
  token: string | null | undefined,
): Promise<string | null> {
  const original = linkDeWhatsApp(telefone, texto);
  if (!original) return null;
  const separador = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;
  let final = texto;
  try {
    const res = await fetch("/api/admin/whatsapp/na-lingua", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ telefone, texto }),
    });
    const d = (await res.json().catch(() => ({}))) as { texto?: string };
    if (res.ok && typeof d.texto === "string" && d.texto.trim()) final = d.texto;
  } catch {
    /* sem rede: o texto como estava */
  }
  const link = linkDeWhatsApp(telefone, final) ?? original;
  if (separador) separador.location.href = link;
  else if (typeof window !== "undefined") window.open(link, "_blank", "noopener");
  return final;
}
