import { NextRequest, NextResponse } from "next/server";
import { profissionalParaEntrar, registarAcessoDoProfissional } from "@/lib/db";
import {
  palavraPasseConfere,
  assinarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
  porSessaoNaResposta,
  DURACAO_SESSAO_SEGUNDOS,
  contaPodeEntrarNoPainel,
} from "@/lib/profissional-auth";
import { lerLembrar } from "@/lib/manter-sessao";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/**
 * Entrada do profissional.
 *
 * A mensagem de erro é sempre a mesma, aconteça o que acontecer: email que não
 * existe, palavra-passe errada, conta suspensa, conta sem palavra-passe
 * definida. Distinguir seria dizer a quem tenta à sorte quais dos emails que
 * escreveu estão inscritos na plataforma — e a lista de profissionais da CLYON
 * não é para se descobrir a adivinhar.
 *
 * A excepção é a conta sem palavra-passe: aí diz-se, porque é a própria pessoa
 * a bater à porta certa e o silêncio deixá-la-ia sem saber o que fazer. Mas só
 * depois de o email conferir com uma conta aprovada.
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "profissional-entrar", 10, 600);
  if (limite.erro) return limite.erro;

  let corpo: { email?: unknown; palavraPasse?: unknown; lembrar?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
  const palavraPasse = typeof corpo.palavraPasse === "string" ? corpo.palavraPasse : "";
  const GENERICO = "Email ou palavra-passe incorretos.";

  if (!email || !palavraPasse) {
    return NextResponse.json({ error: GENERICO }, { status: 401 });
  }

  /*
   * E POR EMAIL, além de por IP.
   *
   * O limite por IP não trava quem tenta a palavra-passe de UMA conta a partir
   * de muitas máquinas. Este trava — e vale para qualquer email, exista ou
   * não, por isso não diz a ninguém quais estão inscritos.
   */
  const porEmail = await limitarPorConta("profissional-entrar-email", email, 5, 900);
  if (porEmail.erro) return porEmail.erro;

  if (!process.env.JWT_SECRET) {
    console.error("[profissionais/entrar] JWT_SECRET não está definido neste ambiente");
    return NextResponse.json(
      { error: "Área indisponível: falta configuração no servidor." },
      { status: 503 },
    );
  }

  try {
    /*
     * `pendente` ENTRA, e é preciso que entre.
     *
     * Isto exigia `aprovado`, e funcionava enquanto ninguém em `pendente`
     * tinha palavra-passe: o link para a criar só saía com a aprovação. Desde
     * 11-09-2026 a aprovação de uma candidatura pelo site cria a conta em
     * `pendente` e manda logo esse link — ele escolhe a palavra-passe, entra, e
     * é no painel que lhe pedimos o NIF, a morada fiscal e o IBAN.
     *
     * Sem esta linha, era uma armadilha: definia a palavra-passe, fechava o
     * browser, e a conta dele recusava-o com «dados errados» até alguém o
     * aprovar. Passava dias a pensar que se tinha enganado a escrever.
     *
     * Entrar não é receber trabalho. Quem distribui pedidos continua a exigir
     * `aprovado` (ver `avaliarElegibilidade`), e o painel mostra-lhe o estado
     * da conta à cabeça.
     *
     * O critério vive em `contaPodeEntrarNoPainel`, porque desde 30-09-2026 há
     * outro a perguntar o mesmo: cada chamada do painel volta a confirmá-lo
     * (`sessaoActivaDoProfissional`), e duas cópias acabavam por divergir.
     */
    const p = await profissionalParaEntrar(email);
    if (!p || !contaPodeEntrarNoPainel(p)) {
      return NextResponse.json({ error: GENERICO }, { status: 401 });
    }

    if (!p.passwordHash) {
      return NextResponse.json(
        {
          error:
            "Ainda não criou palavra-passe. Procure o email de aprovação, ou peça um link novo.",
          semPalavraPasse: true,
        },
        { status: 409 },
      );
    }

    if (!(await palavraPasseConfere(palavraPasse, p.passwordHash))) {
      return NextResponse.json({ error: GENERICO }, { status: 401 });
    }

    await registarAcessoDoProfissional(p.id);

    /*
     * MANTER-ME LIGADO — 15-09-2026.
     *
     * Vem marcada por omissao, que e o que o sistema sempre fez. Desmarca-la
     * e dizer «este computador nao e meu»: a sessao passa a morrer com o
     * browser. Ver `manter-sessao` para as duas duracoes.
     */
    const lembrar = lerLembrar(corpo.lembrar);
    const token = await assinarSessaoDoProfissional(p.id, p.name, lembrar);
    const resposta = NextResponse.json({ ok: true, nome: p.name });
    porSessaoNaResposta(resposta, token, lembrar);
    return resposta;
  } catch (error) {
    console.error("[profissionais/entrar]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
