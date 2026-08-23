import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  verificarGuiaDeTransporte,
  definirEstadoDoProfissional,
  actualizarProfissional,
  definirBaseDoProfissional,
  guardarTokenDePalavraPasse,
  getPool,
  apagarProfissional,
  ContaComPendencias,
} from "@/lib/db";
import { validarEdicao, estadoValido, afectaDistribuicao } from "@/lib/edicao-profissional";
import { geocodificarLocalidade } from "@/lib/geocodificar";
import { gerarTokenDeAcesso } from "@/lib/pedido-acesso";
import { enviarEmailDeAprovacao } from "@/lib/email-aprovacao-profissional";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";

/** Dias que o link de criação de palavra-passe dura. */
const DIAS_DO_LINK_DE_SENHA = 7;

export const runtime = "nodejs";

/**
 * Gerir um profissional: estado, perfil, verificação da guia, coordenadas.
 *
 * Uma rota com várias acções em vez de quatro rotas, porque o painel altera
 * frequentemente duas coisas ao mesmo tempo — aprovar e verificar a guia, por
 * exemplo — e duas chamadas separadas deixavam um estado intermédio possível.
 *
 * Aprovar e verificar continuam a ser acções DISTINTAS. Aprovar diz "pode
 * receber pedidos"; verificar diz "confirmámos que pode legalmente transportar
 * resíduos". Alguém pode estar aprovado sem guia verificada — só não recebe os
 * pedidos que a exigem.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  const { id } = await params;
  const providerId = Number(id);
  if (!Number.isInteger(providerId) || providerId <= 0) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  try {
    const feito: string[] = [];
    let avisoDeDistribuicao = false;

    // ── Estado ───────────────────────────────────────────────────────────────
    let convitePorEnviar = false;
    if (corpo.estado !== undefined) {
      if (!estadoValido(corpo.estado)) {
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
      }
      await definirEstadoDoProfissional(providerId, corpo.estado);
      feito.push(`estado: ${corpo.estado}`);

      // Aprovar é o momento em que ele passa a ter conta. Antes disso não faz
      // sentido dar-lhe palavra-passe: não recebe pedidos, e o painel estaria
      // vazio.
      if (corpo.estado === "aprovado") convitePorEnviar = true;
    }

    // ── Verificação da guia ──────────────────────────────────────────────────
    if (corpo.verificarGuia === true) {
      await verificarGuiaDeTransporte(providerId, colab.nome);
      feito.push("guia verificada");
    }

    // ── Re-geocodificar a base ───────────────────────────────────────────────
    //
    // A geocodificação na inscrição é "melhor esforço" e pode ter falhado — o
    // Nominatim fora de serviço, ou um nome de localidade que ele não conhece.
    // Sem coordenadas o raio não é aplicado e o profissional só recebe por
    // zona, o que é pior do que ele pediu. Isto dá uma segunda tentativa.
    if (corpo.regeocodificar === true) {
      const pool = await getPool();
      const [linhas] = pool
        ? ((await pool.execute("SELECT city FROM providers WHERE id = ? LIMIT 1", [
            providerId,
          ])) as any[])
        : [[]];
      const cidade = (linhas as Array<{ city: string | null }>)[0]?.city;
      if (!cidade) {
        return NextResponse.json(
          { error: "Este profissional não tem cidade indicada." },
          { status: 400 },
        );
      }
      const base = await geocodificarLocalidade(cidade);
      if (!base) {
        return NextResponse.json(
          { error: `Não foi possível localizar "${cidade}". Continua a receber por zona.` },
          { status: 422 },
        );
      }
      await definirBaseDoProfissional(providerId, base.lat, base.lng);
      feito.push("coordenadas actualizadas");
      avisoDeDistribuicao = true;
    }

    // ── Perfil ───────────────────────────────────────────────────────────────
    const CAMPOS_DE_PERFIL = [
      "categorias",
      "zonas",
      "raioKm",
      "emiteFatura",
      "emiteGuiaTransporte",
      "numeroTransportador",
    ];
    if (CAMPOS_DE_PERFIL.some((k) => k in corpo)) {
      const validacao = validarEdicao(corpo);
      if (!validacao.ok) {
        return NextResponse.json(
          { error: validacao.erros[0].mensagem, erros: validacao.erros },
          { status: 400 },
        );
      }
      await actualizarProfissional(providerId, validacao.alteracoes);
      feito.push("perfil actualizado");
      if (afectaDistribuicao(validacao.alteracoes)) avisoDeDistribuicao = true;
    }

    // ── O convite para criar palavra-passe ───────────────────────────────────
    //
    // Depois de tudo o resto estar gravado: se o email falhar, a aprovação não
    // se desfaz. O convite reenvia-se; a aprovação não se repete.
    let conviteEnviado: boolean | undefined;
    /*
     * O link em claro, para quando o email não sai.
     *
     * Só guardamos o hash do token — depois desta resposta, o link em claro
     * deixa de existir em qualquer sítio. Se o email falhar e nós não o
     * devolvermos aqui, o profissional fica trancado para sempre: aprovado,
     * sem palavra-passe, e sem forma de criar uma. E ninguém dá por isso,
     * porque o painel dizia "aprovado" à mesma.
     *
     * É o mesmo remédio que o painel das negociações já usa quando o email do
     * cliente não sai. Vai só neste corpo de resposta, para o admin copiar e
     * mandar por WhatsApp — não fica gravado em lado nenhum.
     */
    let linkDaSenha: string | undefined;
    if (convitePorEnviar) {
      const pool = await getPool();
      const [linhas] = pool
        ? ((await pool.execute(
            "SELECT name, email, passwordHash FROM providers WHERE id = ? LIMIT 1",
            [providerId],
          )) as any[])
        : [[]];
      const p = (linhas as Array<{ name: string; email: string | null; passwordHash: string | null }>)[0];

      // Quem já tem palavra-passe não precisa de convite — reaprovar alguém que
      // esteve suspenso não lhe deve mandar criar outra.
      if (p?.email && !p.passwordHash) {
        const acesso = gerarTokenDeAcesso();
        const expira = new Date(Date.now() + DIAS_DO_LINK_DE_SENHA * 24 * 3600_000);
        await guardarTokenDePalavraPasse(providerId, acesso.hash, expira);
        conviteEnviado = await enviarEmailDeAprovacao({
          para: p.email,
          nome: p.name,
          token: acesso.token,
          baseUrl: urlDeAccaoDoPedido(req.headers),
          diasDeValidade: DIAS_DO_LINK_DE_SENHA,
        });
        feito.push(conviteEnviado ? "convite enviado" : "convite NÃO enviado");
        if (!conviteEnviado) {
          linkDaSenha = `${urlDeAccaoDoPedido(req.headers)}/profissionais/definir-senha/${acesso.token}`;
        }
      }
    }

    if (feito.length === 0) {
      return NextResponse.json({ error: "Nada para alterar" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, feito, avisoDeDistribuicao, conviteEnviado, linkDaSenha });
  } catch (error) {
    console.error("[api/admin/profissionais PATCH]", error);
    return NextResponse.json({ error: "Erro ao actualizar profissional" }, { status: 500 });
  }
}

/**
 * Apagar a conta de um profissional.
 *
 * A palavra de confirmação vai no CORPO e não na barra de endereço. Um `?nome=`
 * fica no histórico do browser, nos registos do servidor e em qualquer proxy
 * pelo meio — e o que aqui se escreve é o nome de uma pessoa.
 *
 * Os guardas todos vivem em `apagarProfissional`, dentro da transacção, e não
 * aqui: uma verificação feita na rota é uma verificação que a próxima maneira
 * de chamar isto não vai ter.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  const { id } = await params;
  const providerId = Number(id);
  if (!Number.isInteger(providerId) || providerId <= 0) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  }

  // Ninguém apaga uma conta por engano numa chamada solta: tem de vir a
  // palavra, escrita à mão do outro lado.
  let corpo: Record<string, unknown> = {};
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    /* corpo vazio — cai na verificação seguinte */
  }
  if (corpo.confirmacao !== "APAGAR") {
    return NextResponse.json(
      { error: "Falta a confirmação. Escreva APAGAR para continuar." },
      { status: 400 },
    );
  }

  try {
    const r = await apagarProfissional(providerId, colab.nome);
    return NextResponse.json({ ok: true, ...r });
  } catch (error) {
    // Pendências não são avaria nossa: são a resposta certa, e o admin precisa
    // de LER o motivo para saber o que resolver antes de tentar outra vez.
    if (error instanceof ContaComPendencias) {
      return NextResponse.json({ error: error.message, motivos: error.motivos }, { status: 409 });
    }
    console.error("[api/admin/profissionais DELETE]", error);
    return NextResponse.json({ error: "Erro ao apagar a conta" }, { status: 500 });
  }
}
