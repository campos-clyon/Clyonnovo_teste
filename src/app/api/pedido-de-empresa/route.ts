import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { BUSINESS_EMAIL } from "@/lib/seo-data";
import { createLead } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { e } from "@/lib/escapar-html";

/**
 * OS PEDIDOS DAS EMPRESAS — o cartão por baixo do resumo, no simulador.
 *
 * "uma opção para as empresas enviar pedidos por e-mails" — 13-09-2026.
 *
 * O /api/contact ao lado serve o formulário de contacto do site e exige nome,
 * telemóvel, morada e serviço. Uma empresa que manda sete recolhas de uma vez
 * não tem UMA morada nem UM serviço, e obrigá-la a inventar um dos dois era
 * pedir-lhe que mentisse ao formulário. Daí uma rota à parte, com o que ela
 * tem mesmo: quem é, onde responder, e a lista por suas palavras.
 *
 * Vai aos dois sítios de propósito: o email para quem trata, o Lead para o
 * backoffice. Um email perde-se numa caixa; um lead fica na mesa ao lado dos
 * outros contactos, com a origem à vista.
 */

const PedidoDeEmpresaSchema = z.object({
  empresa: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  telefone: z.string().trim().max(20).optional(),
  mensagem: z.string().trim().min(10).max(4000),
  pagePath: z.string().max(255).optional(),
  pageUrl: z.string().max(512).optional(),
});

/**
 * O assunto leva o nome da empresa, que vem de um campo do formulário. Numa
 * linha e com tamanho — a mesma razão que está explicada em /api/contact.
 */
function assuntoSeguro(texto: string) {
  return texto.replace(/\s+/g, " ").trim().slice(0, 180);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`empresa:${ip}`, 5, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Aguarde um momento e tente novamente." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const raw = await request.json().catch(() => null);
  const parsed = PedidoDeEmpresaSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Faltam dados. Confirme a empresa, o email e os pedidos." },
      { status: 400 },
    );
  }
  const { empresa, email, telefone, mensagem, pagePath, pageUrl } = parsed.data;

  /*
   * O lead primeiro, e o seu falhanço não trava o email.
   *
   * Se a base estiver em baixo, o pior desfecho aceitável é o pedido chegar
   * por email e faltar no backoffice. O inaceitável era a empresa levar com
   * um erro e ir-se embora por causa de uma tabela.
   */
  let leadGravado = true;
  try {
    await createLead({
      nome: empresa,
      telefone: telefone ?? "",
      email,
      localidade: "",
      tipoServico: "Empresa — vários pedidos",
      preferenciaContacto: "Email",
      mensagem,
      pagePath: pagePath ?? null,
      pageUrl: pageUrl ?? null,
      origem: "cartao_empresas_simulador",
      canal: "email",
    });
  } catch {
    leadGravado = false; // já foi registado por createLead
  }

  if (!process.env.RESEND_API_KEY_clyonsite) {
    console.error("[pedido-de-empresa] RESEND_API_KEY_clyonsite não está configurada");
    // O lead salvou-se; dizer que falhou faria a empresa enviar outra vez.
    return leadGravado
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Configuração de email em falta" }, { status: 500 });
  }

  const texto = [
    "Pedido de uma empresa, pelo cartão do simulador.",
    "",
    `Empresa: ${empresa}`,
    `Email: ${email}`,
    telefone ? `Telefone: ${telefone}` : null,
    pageUrl ? `Página: ${pageUrl}` : null,
    "",
    "Os pedidos, pelas palavras dela:",
    mensagem,
  ]
    .filter((l) => l != null)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#102033;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#0891b2,#06b6d4);padding:24px 32px;">
        <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">CLYON</p>
        <p style="margin:6px 0 0;color:rgba(255,255,255,.9);font-size:13px;">Pedido de uma empresa</p>
      </td></tr>
      <tr><td style="padding:28px 32px;">
        <p style="margin:0 0 4px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Empresa</p>
        <p style="margin:0 0 18px;font-size:18px;font-weight:700;">${e(empresa)}</p>

        <p style="margin:0 0 4px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Responder a</p>
        <p style="margin:0 0 18px;font-size:15px;"><a href="mailto:${e(email)}" style="color:#0891b2;">${e(email)}</a>${
          telefone ? ` &middot; ${e(telefone)}` : ""
        }</p>

        <p style="margin:0 0 4px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Os pedidos</p>
        <div style="background:#f8fafc;border-left:4px solid #0891b2;border-radius:8px;padding:16px 20px;font-size:15px;line-height:1.6;white-space:pre-wrap;">${e(
          mensagem,
        )}</div>

        <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">
          Enviado pelo cartão «É uma empresa?» em ${e(pageUrl ?? "clyon.pt/simulador")}.
          ${leadGravado ? "Também está em Leads, no backoffice." : "NÃO ficou em Leads — a base recusou."}
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY_clyonsite);
    const { error } = await resend.emails.send({
      from: "CLYON Website <noreply@clyon.pt>",
      to: [BUSINESS_EMAIL],
      // Carregar em «responder» vai ter à empresa, não ao noreply.
      replyTo: email,
      subject: assuntoSeguro(`Pedido de empresa: ${empresa}`),
      text: texto,
      html,
    });
    if (error) {
      console.error("[pedido-de-empresa] Resend:", JSON.stringify(error));
      // O lead salvou-se: o pedido não se perdeu, e dizer que falhou só faria
      // a empresa enviar tudo outra vez.
      if (leadGravado) return NextResponse.json({ ok: true });
      return NextResponse.json({ error: "Não foi possível enviar." }, { status: 502 });
    }
  } catch (err) {
    console.error("[pedido-de-empresa]", err);
    if (leadGravado) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: "Não foi possível enviar." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
