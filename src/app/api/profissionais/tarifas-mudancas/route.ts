import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { categoriasDoProfissional, gravarTarifaDasMudancas, tarifaDasMudancasDe } from "@/lib/db";
import { LIMITES_DA_TARIFA, REGRAS_DAS_MUDANCAS, validarTarifa } from "@/lib/conta-da-mudanca";
import {
  ROTULO_DO_ESTADO_DOS_PRECOS,
  TEXTOS_DOS_PRECOS_DAS_MUDANCAS,
  aparecerNaListaAoGravar,
  estadoDosPrecosDasMudancas,
  interruptorAoAbrir,
  mensagemDeGravado,
} from "@/lib/precos-das-mudancas-do-profissional";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OS PREÇOS DAS MUDANÇAS DO PROFISSIONAL — 10-11-2026 (fase 1).
 *
 * GET: a tarifa dele (ou null), se pode aparecer na lista, os limites e as
 * regras da conta (para a pré-visualização no painel e na app).
 * PUT: grava a tarifa inteira. Só quem tem a categoria «Mudanças» pode ligar
 * `aparecerNaLista`.
 *
 * 11-11-2026: a lista está aberta. O GET diz o estado («por preencher», «fora
 * da lista», «na lista»), como o interruptor deve aparecer ao abrir
 * (`interruptorAoAbrir`: ligado para quem ainda não gravou) e os textos do
 * ecrã; o PUT, sem `aparecerNaLista` no corpo, liga-o na primeira gravação e
 * devolve o estado e a frase a mostrar.
 *
 * O `providerId` sai SEMPRE da sessão: nunca do corpo.
 */

async function podeAparecer(providerId: number): Promise<boolean> {
  return (await categoriasDoProfissional(providerId)).includes("mudancas");
}

function regras() {
  return {
    taxaDaPlataforma: REGRAS_DAS_MUDANCAS.taxa,
    modoDaTaxa: REGRAS_DAS_MUDANCAS.modo,
    materialComIva: REGRAS_DAS_MUDANCAS.materialComIva,
    iva: REGRAS_DAS_MUDANCAS.iva,
  };
}

export async function GET(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const [tarifa, pode] = await Promise.all([
      tarifaDasMudancasDe(sessao.providerId),
      podeAparecer(sessao.providerId),
    ]);
    const estado = estadoDosPrecosDasMudancas(tarifa);
    return NextResponse.json({
      tarifa,
      podeAparecerNaLista: pode,
      estado,
      rotuloDoEstado: ROTULO_DO_ESTADO_DOS_PRECOS[estado],
      interruptorAoAbrir: interruptorAoAbrir(tarifa, pode),
      textos: TEXTOS_DOS_PRECOS_DAS_MUDANCAS,
      limites: LIMITES_DA_TARIFA,
      regras: regras(),
    });
  } catch (e) {
    console.error("[tarifas-mudancas] GET", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível ler os preços." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const v = validarTarifa(corpo);
  if (!v.ok) {
    return NextResponse.json({ error: "Há valores por corrigir.", erros: v.erros }, { status: 400 });
  }

  try {
    const [gravada, pode] = await Promise.all([
      tarifaDasMudancasDe(sessao.providerId),
      podeAparecer(sessao.providerId),
    ]);
    // Nasce ligado na primeira gravação; quem diz sim ou não fica com o que disse.
    const enviado = (corpo as { aparecerNaLista?: unknown } | null)?.aparecerNaLista;
    const aparecerNaLista = aparecerNaListaAoGravar({
      enviado: typeof enviado === "boolean" ? enviado : undefined,
      gravada,
      temMudancas: pode,
    });
    if (aparecerNaLista && !pode) {
      return NextResponse.json(
        {
          error: "Para aparecer na lista das mudanças, junte «Mudanças» aos seus serviços.",
          erros: { aparecerNaLista: "Só com o serviço «Mudanças»." },
        },
        { status: 403 },
      );
    }
    await gravarTarifaDasMudancas(sessao.providerId, { ...v.tarifa, aparecerNaLista });
    // O preço público das mudanças lê-se outra vez já (d7, 11-11-2026): as páginas diziam o «desde»
    // antigo até uma hora depois de o parceiro gravar a tarifa ou sair da lista.
    try {
      revalidateTag("preco-publico-das-mudancas");
    } catch {
      /* fora de um pedido do Next (testes) */
    }
    const tarifa = await tarifaDasMudancasDe(sessao.providerId);
    const estado = estadoDosPrecosDasMudancas(tarifa);
    return NextResponse.json({
      ok: true,
      tarifa,
      estado,
      rotuloDoEstado: ROTULO_DO_ESTADO_DOS_PRECOS[estado],
      mensagem: mensagemDeGravado(estado === "na_lista", pode),
    });
  } catch (e) {
    console.error("[tarifas-mudancas] PUT", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível gravar os preços." }, { status: 500 });
  }
}
