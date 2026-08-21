import { NextRequest, NextResponse } from "next/server";
import { criarLigacaoDeEntrada } from "@/lib/db";
import { gerarLigacaoDeEntrada } from "@/lib/entrada-por-link-segredo";
import { emailValido } from "@/lib/inscricao-profissional";
import { enviarEmailDeEntrada } from "@/lib/email-entrada";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";

export const runtime = "nodejs";

/**
 * Pede um link de entrada por email.
 *
 * A RESPOSTA É SEMPRE A MESMA. Não diz se o email existe, se tem conta, se tem
 * pedidos, nem se o envio correu bem. Uma resposta diferente para "não
 * conhecemos este endereço" transformava isto numa lista de quem é cliente da
 * CLYON: bastava alguém testar endereços um a um e ficava a saber quem cá está.
 *
 * Isso inclui o tempo de resposta e inclui os erros. Um 500 quando o envio
 * falha diria "este email existe, e nós tentámos" — por isso o envio corre
 * sem que a resposta dependa dele.
 *
 * Duas travas de abuso, e as duas são precisas:
 *   · por IP, contra quem varre endereços a partir de uma máquina;
 *   · por endereço, contra quem enche a caixa de correio de outra pessoa a
 *     partir de várias máquinas — que é assédio, e sai à nossa custa.
 */
export async function POST(req: NextRequest) {
  const porIp = await limitarRotaPublica(req, "entrada-link-ip", 8, 900);
  if (porIp.erro) return porIp.erro;

  let corpo: { email?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";

  /*
   * A mesma resposta para todos os caminhos daqui para baixo.
   *
   * Está declarada uma vez e devolvida em todos os `return` de propósito: uma
   * segunda mensagem escrita à mão noutro sítio é como estas defesas se
   * perdem — alguém acrescenta um caso e responde-lhe de outra maneira.
   */
  const sempreOMesmo = NextResponse.json({
    ok: true,
    mensagem: "Se este email tiver conta na CLYON, o link de entrada chega dentro de instantes.",
  });

  if (!emailValido(email)) return sempreOMesmo;

  // O limite por endereço vem depois de saber que o email é válido, senão
  // enche-se de lixo. Não devolve o erro do limitador — devolveria a mesma
  // informação por outra porta.
  const porEmail = await limitarRotaPublica(req, `entrada-link-email:${email}`, 4, 900);
  if (porEmail.erro) return sempreOMesmo;

  try {
    const ligacao = gerarLigacaoDeEntrada();
    await criarLigacaoDeEntrada(email, ligacao.hash, ligacao.expiraEm);

    const base = urlDeAccaoDoPedido(req.headers);
    await enviarEmailDeEntrada({
      para: email,
      link: `${base}/entrar/link?t=${encodeURIComponent(ligacao.token)}`,
    });
  } catch (err) {
    // Fica no registo para nós, e não muda uma vírgula do que sai daqui.
    console.error("[entrada/link] falhou:", err);
  }

  return sempreOMesmo;
}
