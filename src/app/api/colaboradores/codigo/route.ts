import { NextRequest, NextResponse } from "next/server";

import {
  CODIGO_INVALIDO,
  CODIGO_MAXIMO,
  codigoConfere,
  esperarAte,
  indiceDoCodigo,
  normalizarCodigo,
  segredoDoIndice,
} from "@/lib/codigo-de-entrada";
import { contaPeloIndice, haContasActivasSemCodigo } from "@/lib/codigo-de-entrada-na-base";
import { assinarSessaoDoPainel, porCookieDaSessao } from "@/lib/emitir-sessao-do-painel";
import { contaActiva } from "@/lib/conta-do-painel";
import { paginaInicialDoPapel, type PapelDoPainel } from "@/lib/papel-do-painel";
import { checkRateLimit, getClientIp, lerContador } from "@/lib/rate-limit";
import { COOKIE_DA_MAQUINA, SEGUNDOS_DA_MAQUINA_CONHECIDA, maquinaConhecida, valorDaMaquina } from "@/lib/maquina-conhecida";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { localDosCabecalhos, navegadorESistema } from "@/lib/sessoes-do-backoffice";
import { registarEntrada } from "@/lib/sessoes-do-backoffice-na-base";

export const runtime = "nodejs";

/**
 * A ENTRADA NO BACKOFFICE POR CÓDIGO — d75, 20-11-2026.
 *
 * Um só campo. O código diz quem é a pessoa: o índice (HMAC com o segredo do
 * servidor) encontra a linha, e o bcrypt confirma — sempre os dois.
 *
 * Tudo o que não entra recebe a mesma resposta, «Código inválido.», e no
 * mesmo tempo: o bcrypt corre também quando o índice não encontra ninguém
 * (contra um hash que não é de ninguém), e a resposta nunca sai antes de
 * `TEMPO_MINIMO_DA_RESPOSTA_MS`.
 *
 * FORÇA BRUTA: por máquina, e no total — um código não tem «conta» à frente
 * para se contar por conta, por isso o segundo travão é a soma das tentativas.
 * Por máquina contam todas; NO TOTAL contam só as ERRADAS (d2, 23-11-2026) —
 * com as certas a contar, bastava a equipa entrar para o travão encher — e a
 * máquina que já entrou com êxito nos últimos 30 dias (cookie assinado) passa
 * mesmo com o travão cheio. Com o travão, a resposta é a mesma «Código
 * inválido.», com 429 e o tempo de espera.
 *
 * GET: só diz se o ecrã de entrada ainda mostra «Ainda não tem código?
 * Entrar com utilizador» — enquanto houver contas activas sem código.
 */

const JANELA_SEGUNDOS = 15 * 60;
const TENTATIVAS_POR_IP = 10;
const TENTATIVAS_NO_TOTAL = 100;
const CHAVE_DO_TOTAL = "colaborador-codigo-total";

function invalido(estado = 401, cabecalhos?: Record<string, string>) {
  return NextResponse.json({ error: CODIGO_INVALIDO }, { status: estado, headers: cabecalhos });
}

function bloqueado() {
  return NextResponse.json(
    { error: `${CODIGO_INVALIDO} Aguarde alguns minutos antes de tentar de novo.` },
    { status: 429, headers: { "Retry-After": String(JANELA_SEGUNDOS) } },
  );
}

export async function GET(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "colaborador-codigo-estado", 30, 60);
  if (limite.erro) return limite.erro;
  try {
    return NextResponse.json({ porUtilizador: await haContasActivasSemCodigo() });
  } catch (e) {
    // Sem saber, mostra-se a ligação: é melhor do que trancar alguém fora.
    console.error("[colaborador codigo GET]", e instanceof Error ? e.message : e);
    return NextResponse.json({ porUtilizador: true });
  }
}

export async function POST(req: NextRequest) {
  const inicio = Date.now();

  const porIp = await checkRateLimit(`colaborador-codigo-ip:${getClientIp(req)}`, TENTATIVAS_POR_IP, JANELA_SEGUNDOS);
  if (!porIp.allowed) return bloqueado();
  // d2: lê-se o total SEM contar; só as tentativas erradas o fazem subir (mais abaixo).
  const conhecida = maquinaConhecida(req.cookies.get(COOKIE_DA_MAQUINA)?.value, process.env.JWT_SECRET);
  if (!conhecida && (await lerContador(CHAVE_DO_TOTAL)) >= TENTATIVAS_NO_TOTAL) return bloqueado();

  // Falha fechada: sem o segredo do índice, ninguém entra por código.
  const segredo = segredoDoIndice();
  if (!segredo) {
    console.error("[colaborador codigo] falta CODIGO_DE_ENTRADA_PEPPER neste ambiente");
    await esperarAte(inicio);
    return NextResponse.json(
      { error: "A entrada por código não está disponível neste momento. Fale com a administração." },
      { status: 503 },
    );
  }
  if (!process.env.JWT_SECRET) {
    console.error("[colaborador codigo] JWT_SECRET não está definido neste ambiente");
    await esperarAte(inicio);
    return NextResponse.json({ error: "Área interna mal configurada." }, { status: 503 });
  }

  let codigo = "";
  try {
    const corpo = (await req.json()) as { codigo?: unknown };
    codigo = normalizarCodigo(corpo?.codigo);
  } catch {
    codigo = "";
  }
  const formaValida = codigo.length > 0 && Array.from(codigo).length <= CODIGO_MAXIMO;

  let conta: Awaited<ReturnType<typeof contaPeloIndice>>;
  try {
    conta = formaValida ? await contaPeloIndice(indiceDoCodigo(codigo, segredo)) : undefined;
  } catch (e) {
    console.error("[colaborador codigo] base:", e instanceof Error ? e.message : e);
    await esperarAte(inicio);
    return NextResponse.json({ error: "Não foi possível entrar agora. Tente daqui a instantes." }, { status: 503 });
  }

  // SEMPRE o bcrypt — com o hash da conta, ou com um que não é de ninguém.
  const confere = await codigoConfere(formaValida ? codigo : "x", conta?.codigoHash);

  const eAdministrador = Boolean(conta) && (Number(conta!.isAdmin) === 1 || conta!.funcao === "admin");
  const eAssistente = Boolean(conta) && !eAdministrador && conta!.funcao === "assistente";
  const podeEntrar =
    confere &&
    conta !== undefined &&
    ((eAdministrador && contaActiva(conta)) || (eAssistente && Number(conta.active) === 1));

  if (!podeEntrar || !conta) {
    // d2: só as erradas contam para o travão total.
    await checkRateLimit(CHAVE_DO_TOTAL, TENTATIVAS_NO_TOTAL, JANELA_SEGUNDOS).catch(() => undefined);
    await esperarAte(inicio);
    return invalido();
  }

  const papel: PapelDoPainel = eAdministrador ? "admin" : "assistente";
  const token = await assinarSessaoDoPainel({ id: conta.id, nome: conta.nome, papel });

  try {
    await registarEntrada({
      colaboradorId: conta.id,
      nome: conta.nome,
      papel,
      ...navegadorESistema(req.headers.get("user-agent")),
      ...localDosCabecalhos(req.headers),
    });
  } catch (e) {
    console.error("[colaborador codigo] registo de entrada:", e instanceof Error ? e.message : e);
  }

  await esperarAte(inicio);
  const resposta = NextResponse.json({
    token,
    colaborador: { id: conta.id, nome: conta.nome, isAdmin: papel === "admin" ? 1 : 0, papel },
    paginaInicial: paginaInicialDoPapel(papel),
  });
  porCookieDaSessao(resposta, token);
  // d2: este navegador já entrou — não o apanha o travão total nos próximos 30 dias.
  resposta.cookies.set(COOKIE_DA_MAQUINA, valorDaMaquina(process.env.JWT_SECRET ?? ""), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/colaboradores/codigo",
    maxAge: SEGUNDOS_DA_MAQUINA_CONHECIDA,
  });
  return resposta;
}
