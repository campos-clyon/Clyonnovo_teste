import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { guardarTaxas, taxasActuais } from "@/lib/db";
import { TAXA_MAXIMA, TAXAS_DE_ORIGEM } from "@/lib/taxas-plataforma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AS TAXAS DA PLATAFORMA — ver e mudar.
 *
 * "Os campos das taxas da plataforma devem ser editáveis pelo admin e deve
 * mudar para todos correctamente." — 15-09-2026.
 *
 * O "correctamente" está do outro lado, em `criarNegociacao`: cada negociação
 * grava a taxa com que nasceu, e nunca mais a muda. Esta rota mexe só no que
 * a PRÓXIMA vai gravar.
 *
 * Nada do que já existe muda: nem a carteira de um profissional, nem o total
 * de um pedido fechado, nem a proposta que um cliente já recebeu no WhatsApp.
 * Antes disto ser assim, tornar a percentagem editável teria reescrito o
 * passado inteiro — incluindo números que já tinham ido em factura.
 */
export async function GET(req: NextRequest) {
  // Só o administrador. Mudar a comissão da empresa não é coisa de um
  // assistente, mesmo que esta rota lhe caia na lista por engano.
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  try {
    const taxas = await taxasActuais();
    return NextResponse.json({
      cliente: taxas.cliente,
      profissional: taxas.profissional,
      /** Para o ecrã poder dizer «voltar ao que era» sem inventar números. */
      origem: TAXAS_DE_ORIGEM,
      maxima: TAXA_MAXIMA,
    });
  } catch (error) {
    console.error("[admin/taxas GET]", error);
    return NextResponse.json({ error: "Não foi possível ler as taxas." }, { status: 500 });
  }
}

/** Uma percentagem escrita por uma pessoa: «6», «6,5», «6.5». */
function pontos(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const limpo = v.trim().replace("%", "").replace(",", ".");
  // O vazio sai antes da conversão: `Number("")` é zero, e zero é uma taxa
  // legítima. Um campo apagado por engano não pode virar 0 % em silêncio.
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

export async function PUT(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: { cliente?: unknown; profissional?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const cliente = pontos(corpo.cliente);
  const profissional = pontos(corpo.profissional);
  if (cliente == null || profissional == null) {
    return NextResponse.json(
      { error: "Escreva as duas percentagens. Por exemplo: 5 e 6." },
      { status: 400 },
    );
  }

  try {
    /*
     * As duas ao mesmo tempo, e não uma de cada vez.
     *
     * Gravar só uma deixava a plataforma num estado que ninguém escolheu — 7 %
     * ao cliente com os 6 % antigos ao profissional — e as negociações que
     * nascessem nesse intervalo ficavam com ele PARA SEMPRE, porque a taxa
     * fica presa no nascimento.
     */
    const ficaram = await guardarTaxas(
      { cliente: cliente / 100, profissional: profissional / 100 },
      colab?.nome ?? "a CLYON",
    );
    return NextResponse.json({ ok: true, ...ficaram, origem: TAXAS_DE_ORIGEM });
  } catch (error) {
    // A mensagem de `guardarTaxas` é escrita para ser lida por uma pessoa —
    // "a taxa do cliente tem de estar entre 0 % e 50 %" — e vai tal e qual.
    const msg = error instanceof Error ? error.message : "Não foi possível guardar.";
    console.error("[admin/taxas PUT]", error);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
