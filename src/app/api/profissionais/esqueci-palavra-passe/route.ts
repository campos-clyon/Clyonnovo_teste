import { NextRequest, NextResponse } from "next/server";
import { profissionalParaEntrar } from "@/lib/db";
import { emailValido } from "@/lib/inscricao-profissional";
import { contaPodeEntrarNoPainel } from "@/lib/profissional-auth";
import { emitirLinkDeRepor, HORAS_DO_LINK_DE_REPOR } from "@/lib/repor-palavra-passe";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";

export const runtime = "nodejs";

/**
 * «Esqueci-me da palavra-passe», na página de entrada do profissional.
 *
 * A RESPOSTA É SEMPRE A MESMA, como no link de entrada dos clientes
 * (`/api/entrada/link`): não diz se o email existe, se a conta está activa,
 * nem se o envio correu bem. Uma resposta diferente para «não conhecemos este
 * endereço» fazia disto uma lista de quem trabalha com a CLYON — bastava
 * testar endereços um a um. Isso inclui os erros: um 500 quando o envio falha
 * diria «este email existe, e nós tentámos».
 *
 * Também serve quem nunca criou a palavra-passe e perdeu o email de
 * aprovação: o link é o mesmo, e a conta não precisa de ter uma para o
 * receber.
 *
 * Duas travas, as mesmas da entrada por link: por IP, contra quem varre
 * endereços a partir de uma máquina; e por endereço, contra quem enche a
 * caixa de correio de um profissional a partir de várias.
 */
export async function POST(req: NextRequest) {
  const porIp = await limitarRotaPublica(req, "profissional-repor-ip", 8, 900);
  if (porIp.erro) return porIp.erro;

  let corpo: { email?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";

  // Uma só, devolvida em todos os caminhos daqui para baixo. Uma segunda
  // mensagem escrita à mão noutro `return` é como esta defesa se perde.
  const sempreOMesmo = NextResponse.json({
    ok: true,
    mensagem: `Se este email tiver conta de profissional na CLYON, o link chega dentro de instantes. Serve uma vez e dura ${HORAS_DO_LINK_DE_REPOR} horas.`,
  });

  if (!emailValido(email)) return sempreOMesmo;

  // Depois de saber que o email é válido, senão enche-se de lixo. Não devolve
  // o erro do limitador: seria a mesma informação por outra porta.
  const porEmail = await limitarPorConta("profissional-repor-email", email, 3, 900);
  if (porEmail.erro) return sempreOMesmo;

  try {
    const p = await profissionalParaEntrar(email);
    // Suspenso, rejeitado ou apagado não recebem nada: a rota de definir
    // recusava o link à mesma, e mandá-lo era prometer uma porta fechada.
    if (p && p.email && contaPodeEntrarNoPainel(p)) {
      const saiu = await emitirLinkDeRepor({
        providerId: p.id,
        nome: p.name,
        email: p.email,
        baseUrl: urlDeAccaoDoPedido(req.headers),
        pedidoPor: "proprio",
      });
      if (!saiu) console.error("[profissionais/esqueci-palavra-passe] o email não saiu para #", p.id);
    }
  } catch (err) {
    // Fica no registo para nós, e não muda uma vírgula do que sai daqui.
    console.error("[profissionais/esqueci-palavra-passe] falhou:", err);
  }

  return sempreOMesmo;
}
