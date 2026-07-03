import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { BUSINESS_EMAIL } from "@/lib/seo-data";
import { createLead } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const ContactSchema = z.object({
  nome:                z.string().min(2).max(120),
  telemovel:           z.string().min(9).max(20),
  endereco:            z.string().min(3).max(200),
  servico:             z.string().min(2).max(80),
  mensagem:            z.string().max(2000).optional(),
  pagePath:            z.string().max(255).optional(),
  pageUrl:             z.string().max(512).optional(),
  utmSource:           z.string().max(120).optional(),
  utmMedium:           z.string().max(120).optional(),
  utmCampaign:         z.string().max(120).optional(),
  gclid:               z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  // Rate limit: 5 pedidos por IP por 60 segundos
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`contact:${ip}`, 5, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Aguarde um momento e tente novamente." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  try {
    // Verificar se a API key está configurada
    if (!process.env.RESEND_API_KEY_clyonsite) {
      console.error("[v0] RESEND_API_KEY_clyonsite não está configurada");
      return NextResponse.json(
        { error: "Configuração de email em falta" },
        { status: 500 }
      );
    }

    // Inicializar Resend apenas quando necessário (evita erro no build)
    const resend = new Resend(process.env.RESEND_API_KEY_clyonsite);

    const raw = await request.json();
    const parsed = ContactSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const { nome, telemovel, endereco, servico, mensagem,
            pagePath, pageUrl, utmSource, utmMedium, utmCampaign, gclid } = parsed.data;

    const plainText = `
Novo pedido de orçamento recebido através do site CLYON.

DADOS DO CLIENTE:
- Nome: ${nome}
- Telemóvel: ${telemovel}
- Endereço: ${endereco}
- Serviço: ${servico}
${mensagem ? `- Mensagem: ${mensagem}` : ""}

---
Este email foi enviado automaticamente através do formulário de contacto em clyon.pt
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">CLYON</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Novo Pedido de Orçamento</p>
            </td>
          </tr>
          
          <!-- Service Badge -->
          <tr>
            <td style="padding: 32px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #ecfeff; border-radius: 12px; padding: 16px 20px; border-left: 4px solid #0891b2;">
                    <p style="margin: 0; color: #0e7490; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Serviço Solicitado</p>
                    <p style="margin: 6px 0 0; color: #164e63; font-size: 18px; font-weight: 700;">${servico}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Client Info -->
          <tr>
            <td style="padding: 32px 40px;">
              <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Dados do Cliente</h2>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; border-spacing: 0 12px;">
                <tr>
                  <td style="background-color: #f8fafc; border-radius: 8px; padding: 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="40" valign="top">
                          <div style="width: 36px; height: 36px; background-color: #e0f2fe; border-radius: 8px; text-align: center; line-height: 36px; font-size: 16px;">👤</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Nome</p>
                          <p style="margin: 4px 0 0; color: #1e293b; font-size: 16px; font-weight: 600;">${nome}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8fafc; border-radius: 8px; padding: 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="40" valign="top">
                          <div style="width: 36px; height: 36px; background-color: #dcfce7; border-radius: 8px; text-align: center; line-height: 36px; font-size: 16px;">📱</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Telemóvel</p>
                          <p style="margin: 4px 0 0; color: #1e293b; font-size: 16px; font-weight: 600;">
                            <a href="tel:${telemovel}" style="color: #0891b2; text-decoration: none;">${telemovel}</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8fafc; border-radius: 8px; padding: 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="40" valign="top">
                          <div style="width: 36px; height: 36px; background-color: #fef3c7; border-radius: 8px; text-align: center; line-height: 36px; font-size: 16px;">📍</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Endereço</p>
                          <p style="margin: 4px 0 0; color: #1e293b; font-size: 16px; font-weight: 600;">${endereco}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          ${mensagem ? `
          <!-- Message -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Mensagem do Cliente</h2>
              <div style="background-color: #fffbeb; border-radius: 12px; padding: 20px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #78350f; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${mensagem}</p>
              </div>
            </td>
          </tr>
          ` : ''}
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://wa.me/351${telemovel.replace(/\s/g, '').replace(/^\+?351/, '')}?text=${encodeURIComponent(`Olá ${nome}! Recebemos o seu pedido de ${servico}. `)}" style="display: inline-block; background-color: #22c55e; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 15px; font-weight: 600;">
                      Responder via WhatsApp
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 13px; text-align: center;">
                Este email foi enviado automaticamente através do formulário de contacto em 
                <a href="https://clyon.pt" style="color: #0891b2; text-decoration: none;">clyon.pt</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const { data, error } = await resend.emails.send({
      from: "CLYON Website <noreply@clyon.pt>",
      to: [BUSINESS_EMAIL],
      subject: `Novo pedido: ${servico} - ${endereco}`,
      text: plainText,
      html: htmlContent,
    });

    if (error) {
      console.error("[v0] Resend error:", JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: `Erro ao enviar email: ${error.message || "unknown"}` },
        { status: 500 }
      );
    }

    // Gravar lead na DB em paralelo — independente do email, best-effort
    createLead({
      nome,
      telefone: telemovel,
      email: "",
      localidade: endereco,
      tipoServico: servico,
      preferenciaContacto: "Email",
      mensagem: mensagem ?? null,
      pagePath: pagePath ?? null,
      pageUrl: pageUrl ?? null,
      utmSource: utmSource ?? null,
      utmMedium: utmMedium ?? null,
      utmCampaign: utmCampaign ?? null,
      gclid: gclid ?? null,
      origem: "formulario_contactos",
      canal: "email",
    }).catch((err) => console.error("[api/contact] Erro ao gravar lead:", err));

    return NextResponse.json({ success: true, id: data?.id });
  } catch (error) {
    console.error("[v0] Contact API error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
