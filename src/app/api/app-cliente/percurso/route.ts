import { NextRequest, NextResponse } from "next/server";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { aparelhoDoUserAgent, lerRegisto } from "@/lib/percurso-da-app-cliente";
import { registarNoPercurso } from "@/lib/percurso-da-app-cliente-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * O PERCURSO DO CONVITE DA APP DE CLIENTE — 24-11-2026 (d106).
 *
 * POST { c, accao: "abriu" }                                   → o clique e a classe do aparelho
 * POST { c, accao: "passo", passo: 1–4 }                        → chegou a este passo
 * POST { c, accao: "nao-consegui", passo, motivo, texto? }      → o «Não consegui»
 *
 * Pública (quem abre o link do convite não tem de ter sessão), por isso:
 *   · responde SEMPRE o mesmo `{ ok: true }` — um código válido, inválido ou
 *     caducado não se distinguem (sem enumeração de códigos);
 *   · nunca devolve nada da pessoa (nem nome, nem email, nem o estado);
 *   · do user-agent só se tira a classe (Android / iPhone / computador): nem
 *     ele nem o IP se guardam (o IP só serve ao travão, e sai em resumo);
 *   · com travão por máquina e por código, e o corpo limitado a 2 KB.
 */

const MAXIMO_DO_CORPO = 2048;
const RESPOSTA = { ok: true };
const SEM_CACHE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const porMaquina = await limitarRotaPublica(req, "app-cliente-percurso", 40, 600);
  if (porMaquina.erro) return porMaquina.erro;

  let corpo: unknown = null;
  try {
    const texto = await req.text();
    if (texto.length <= MAXIMO_DO_CORPO) corpo = JSON.parse(texto);
  } catch {
    corpo = null;
  }
  const lido = lerRegisto(corpo);
  if (!lido) return NextResponse.json(RESPOSTA, { headers: SEM_CACHE });

  const porCodigo = await limitarPorConta("app-cliente-percurso-c", lido.codigo, 30, 3600);
  if (porCodigo.erro) return porCodigo.erro;

  try {
    await registarNoPercurso(lido.codigo, lido.registo, aparelhoDoUserAgent(req.headers.get("user-agent")));
  } catch (e) {
    console.error("[app-cliente/percurso]", e instanceof Error ? e.message : e);
  }
  return NextResponse.json(RESPOSTA, { headers: SEM_CACHE });
}
