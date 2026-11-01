import { NextRequest, NextResponse } from "next/server";
import { hashDaPalavraPasse, palavraPasseConfere } from "@/lib/profissional-auth";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { assinarSessaoDoCliente } from "@/lib/cliente-auth";
import {
  contaDoClientePorEmail,
  criarLinkDaConta,
  registarEntradaDoCliente,
  registoPorConfirmar,
} from "@/lib/conta-com-palavra-passe";
import { enviarEmailDaConta } from "@/lib/email-conta-do-cliente";
import { porSessaoDoClienteNoSite } from "@/lib/sessao-do-cliente-no-site";
import {
  ERRO_DE_ENTRADA,
  ERRO_MUITAS_TENTATIVAS,
  ERRO_POR_CONFIRMAR,
} from "@/lib/palavra-passe-do-cliente";

export const runtime = "nodejs";

/**
 * ENTRAR COM EMAIL E PALAVRA-PASSE — 01-11-2026. Site e app, numa rota só.
 *
 * `{ email, palavraPasse, app?: true }`:
 *   · site → o cookie do NextAuth (o mesmo do Google e do link) e `{ ok: true }`;
 *   · app  → `{ ok, token, expiraEm, email, entrada: "palavra-passe" }`, o
 *     mesmo formato de `/api/cliente/entrar`, e NENHUM cookie.
 *
 * Os erros:
 *   · 401 `errado` — sempre «Email ou palavra-passe errados.», seja o email
 *     desconhecido, a conta sem palavra-passe ou a palavra-passe errada;
 *   · 403 `por-confirmar` — SÓ quando a palavra-passe confere com a de um
 *     registo por confirmar (quem a sabe é quem o fez), e o link sai outra vez;
 *   · 429 `muitas-tentativas` — por endereço (10 em 10 min) e por email (5 em
 *     15 min, venha de onde vier — o mesmo travão da entrada dos profissionais).
 */
/*
 * Um hash a fingir, para o caminho sem palavra-passe gastar o mesmo tempo que
 * o caminho com ela: sem isto, a demora dizia quem tem conta com palavra-passe.
 */
let hashAFingir: Promise<string> | null = null;
function compararAFingir(valor: string): Promise<boolean> {
  hashAFingir ??= hashDaPalavraPasse("clyon-sem-conta-" + Date.now());
  return hashAFingir.then((h) => palavraPasseConfere(valor, h));
}

export async function POST(req: NextRequest) {
  const muitas = () =>
    NextResponse.json(
      { ok: false, codigo: "muitas-tentativas", error: ERRO_MUITAS_TENTATIVAS },
      { status: 429, headers: { "Retry-After": "600" } },
    );
  const errado = () =>
    NextResponse.json({ ok: false, codigo: "errado", error: ERRO_DE_ENTRADA }, { status: 401 });

  const porIp = await limitarRotaPublica(req, "entrada-palavra-passe-ip", 10, 600);
  if (porIp.erro) return muitas();

  let corpo: { email?: unknown; palavraPasse?: unknown; app?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, codigo: "invalido", error: "Pedido inválido." }, { status: 400 });
  }
  if (!corpo || typeof corpo !== "object") {
    return NextResponse.json({ ok: false, codigo: "invalido", error: "Pedido inválido." }, { status: 400 });
  }

  const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
  const palavraPasse = typeof corpo.palavraPasse === "string" ? corpo.palavraPasse : "";
  const paraApp = corpo.app === true;
  if (!email || !palavraPasse || email.length > 200 || palavraPasse.length > 200) return errado();

  const porEmail = await limitarPorConta("entrada-palavra-passe-email", email, 5, 900);
  if (porEmail.erro) return muitas();

  try {
    const conta = await contaDoClientePorEmail(email);

    if (conta?.passwordHash) {
      if (!(await palavraPasseConfere(palavraPasse, conta.passwordHash))) return errado();
      await registarEntradaDoCliente(conta.id);
      if (paraApp) {
        const { token, expiraEm } = await assinarSessaoDoCliente(email, "palavra-passe");
        return NextResponse.json({
          ok: true,
          token,
          expiraEm: expiraEm.toISOString(),
          email,
          entrada: "palavra-passe",
        });
      }
      const resposta = NextResponse.json({ ok: true });
      await porSessaoDoClienteNoSite(resposta, { email, nome: conta.nome });
      return resposta;
    }

    /*
     * Sem palavra-passe na conta (ou sem conta): pode ser um registo por
     * confirmar. Só se diz se a palavra-passe conferir — quem a sabe foi quem
     * se registou, e não fica a saber nada que não soubesse.
     */
    const pendente = await registoPorConfirmar(email);
    if (!pendente) {
      await compararAFingir(palavraPasse);
      return errado();
    }
    if (await palavraPasseConfere(palavraPasse, pendente.passwordHashPendente)) {
      // O reenvio tem o seu travão (o do registo): não enche a caixa a ninguém.
      const reenvio = await limitarPorConta("entrada-registo-email", email, 4, 900);
      if (!reenvio.erro) {
        try {
          const token = await criarLinkDaConta("registo", email, {
            nome: pendente.nome,
            passwordHashPendente: pendente.passwordHashPendente,
            manterAnteriores: true,
          });
          await enviarEmailDaConta({
            tipo: "confirmar",
            para: email,
            link: `${urlDeAccaoDoPedido(req.headers)}/entrar/confirmar-email?token=${encodeURIComponent(token)}`,
          });
        } catch (err) {
          console.error("[entrada/palavra-passe] reenvio:", err instanceof Error ? err.message : err);
        }
      }
      return NextResponse.json(
        { ok: false, codigo: "por-confirmar", error: ERRO_POR_CONFIRMAR },
        { status: 403 },
      );
    }

    return errado();
  } catch (err) {
    console.error("[entrada/palavra-passe] falhou:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, codigo: "indisponivel", error: "Não foi possível entrar agora. Tente outra vez." },
      { status: 500 },
    );
  }
}
