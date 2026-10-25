import { NextRequest, NextResponse } from "next/server";
import { fecharSessoesDoProfissional } from "@/lib/db";
import { assinarSessaoDoProfissional, tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { respostaComSessaoNova } from "@/lib/corte-das-sessoes";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/**
 * «SAIR DE TODOS OS APARELHOS» — 25-10-2026.
 *
 * Fecha a sessão em todos os outros telemóveis e navegadores desta conta: o
 * corte da conta (`sessoesDesde`) passa a agora, e os tokens emitidos antes
 * deixam de entrar (ver `corte-das-sessoes.ts`). Quem carregou no botão fica
 * dentro, com um token novo — no corpo, na app (`{ ok, token }`, a guardar no
 * lugar do antigo); no cookie, no painel.
 *
 * Os avisos no telemóvel não mudam aqui: o telemóvel que sai apaga-se da
 * lista com `DELETE /api/profissionais/dispositivo`, como ao sair da app.
 */
export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const limite = await limitarRotaPublica(req, "profissional-sair-de-todos", 10, 600);
  if (limite.erro) return limite.erro;

  try {
    await fecharSessoesDoProfissional(sessao.providerId);
    const token = await assinarSessaoDoProfissional(sessao.providerId, sessao.nome, sessao.lembrar);
    return respostaComSessaoNova(req, token, sessao.lembrar);
  } catch (e) {
    console.error("[profissionais/sair-de-todos]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível fechar as outras sessões." }, { status: 500 });
  }
}
