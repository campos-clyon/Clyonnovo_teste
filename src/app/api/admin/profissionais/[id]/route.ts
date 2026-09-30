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
  actualizarPerfilDoProfissional,
  definirPalavraPasseDoProfissional,
  mudarEmailDoProfissional,
  registarSemFalhar,
} from "@/lib/db";
import { mudancasDoPerfil } from "@/lib/mudancas-do-perfil";
import { emailValido } from "@/lib/inscricao-profissional";
import { validarPalavraPasse, hashDaPalavraPasse } from "@/lib/profissional-auth";
import { validarEdicao, estadoValido, afectaDistribuicao } from "@/lib/edicao-profissional";
import { geocodificarLocalidade } from "@/lib/geocodificar";
import { gerarTokenDeAcesso } from "@/lib/pedido-acesso";
import { enviarEmailDeAprovacao } from "@/lib/email-aprovacao-profissional";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";

// O número saiu daqui para `convite-profissional.ts`: a aprovação de uma
// candidatura pelo site emite o mesmo link, e dois «7» em dois ficheiros é como
// um deles passa a 14 sem ninguém dar por isso.
import { DIAS_DO_LINK_DE_SENHA } from "@/lib/convite-profissional";

export const runtime = "nodejs";

/**
 * Os campos da conta que o backoffice grava com as regras do painel dele.
 *
 * O regime de IVA fica de fora porque já entra por `validarEdicao`, com o
 * resto do que decide os pedidos.
 */
const CAMPOS_DA_CONTA = [
  "nome",
  "telefone",
  "nif",
  "moradaFiscal",
  "codigoPostalFiscal",
  "localidadeFiscal",
  "tipoVeiculo",
  "mbway",
  "iban",
  "ibanTitular",
] as const;

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

    // ── A conta: os dados, o email de entrada e a palavra-passe ──────────────
    //
    // «Tem muitos clientes que não conseguem ou não sabem usar emails, vamos
    // trazer toda a edição e configuração da conta para mim, até reset de
    // senha pelo admin.» — 30-09-2026.
    //
    // PRIMEIRO, e valida tudo antes de gravar seja o que for: um NIF mal
    // escrito não pode deixar para trás um estado já mudado.
    //
    // O email e a palavra-passe são a chave da conta dele: só um
    // administrador lhes toca, nunca um assistente.
    const daConta: Record<string, unknown> = {};
    for (const k of CAMPOS_DA_CONTA) if (k in corpo) daConta[k] = corpo[k];
    const mexeNaEntrada =
      corpo.email !== undefined ||
      corpo.novaPalavraPasse !== undefined ||
      corpo.linkDePalavraPasse === true;
    if (mexeNaEntrada && colab.papel !== "admin") {
      return NextResponse.json(
        { error: "Só um administrador muda o email de entrada ou a palavra-passe." },
        { status: 403 },
      );
    }
    const conta = Object.keys(daConta).length > 0 ? await mudancasDoPerfil(daConta) : null;
    if (conta && conta.erros.length > 0) {
      return NextResponse.json({ error: conta.erros[0].mensagem, erros: conta.erros }, { status: 400 });
    }
    let emailNovo: string | null = null;
    if (corpo.email !== undefined) {
      emailNovo = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
      if (!emailValido(emailNovo)) {
        return NextResponse.json({ error: "Email inválido." }, { status: 400 });
      }
    }
    if (corpo.novaPalavraPasse !== undefined) {
      const erro = validarPalavraPasse(corpo.novaPalavraPasse);
      if (erro) return NextResponse.json({ error: erro.mensagem }, { status: 400 });
    }

    const porQuem = colab?.nome ?? "a CLYON";
    const mexido: string[] = [];
    if (conta) {
      await actualizarPerfilDoProfissional(providerId, conta.mudancas);
      feito.push("dados da conta");
      mexido.push(...Object.keys(daConta));
    }
    if (emailNovo !== null) {
      if ((await mudarEmailDoProfissional(providerId, emailNovo)) === "em_uso") {
        return NextResponse.json(
          { error: "Esse email já é o de outra conta de profissional." },
          { status: 409 },
        );
      }
      feito.push("email de entrada");
      mexido.push(`email de entrada (agora ${emailNovo})`);
    }
    /*
     * A PALAVRA-PASSE DEFINIDA DAQUI — para quem não recebe o email do link.
     *
     * Quem a escolhe diz-lha por telefone ou WhatsApp. Grava-se só o hash,
     * como na dele, e o link que estivesse pendente deixa de valer. Nunca vai
     * para o registo nem para o histórico: aí fica escrito QUE mudou, e quem.
     */
    let palavraPasseDefinida = false;
    if (typeof corpo.novaPalavraPasse === "string") {
      await definirPalavraPasseDoProfissional(
        providerId,
        await hashDaPalavraPasse(corpo.novaPalavraPasse),
      );
      palavraPasseDefinida = true;
      feito.push("palavra-passe");
      mexido.push("palavra-passe definida");
    }
    // O mesmo link do convite, para mandar por WhatsApp — ele escolhe a dele.
    let linkPedidoAqui: string | undefined;
    if (corpo.linkDePalavraPasse === true) {
      const acesso = gerarTokenDeAcesso();
      await guardarTokenDePalavraPasse(
        providerId,
        acesso.hash,
        new Date(Date.now() + DIAS_DO_LINK_DE_SENHA * 24 * 3600_000),
      );
      linkPedidoAqui = `${urlDeAccaoDoPedido(req.headers)}/profissionais/definir-senha/${acesso.token}`;
      feito.push("link de palavra-passe");
      mexido.push("link para criar palavra-passe gerado");
    }
    if (mexido.length > 0) {
      await registarSemFalhar({
        acontecimento: "conta_do_profissional_editada",
        providerId,
        autorTipo: "clyon",
        autorNome: porQuem,
        resumo: `Conta editada pela CLYON (${porQuem}): ${mexido.join(", ")}.`.slice(0, 500),
      });
    }

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

    // ── A morada da base ─────────────────────────────────────────────────────
    //
    // «Porque é que eu não consigo editar para corrigir o erro?» — 25-09-2026.
    //
    // O Jorge escreveu «Merce» na inscrição, e o geocodificador pôs-lhe a base
    // perto de Penafiel. Com 200 km de raio medidos de lá, nenhum pedido de
    // Lisboa lhe chegava — e o backoffice não tinha onde mudar a morada: o
    // «re-geocodificar» voltava a procurar «Merce» e caía no mesmo sítio.
    //
    // As coordenadas escolhidas da lista do Google mandam; o texto só se
    // localiza quando se escreveu à mão, e aí é uma aproximação.
    if (corpo.cidade !== undefined) {
      const cidade = typeof corpo.cidade === "string" ? corpo.cidade.trim().slice(0, 200) : "";
      if (!cidade) {
        return NextResponse.json({ error: "Indique a morada da base." }, { status: 400 });
      }
      const lat = Number(corpo.baseLat);
      const lng = Number(corpo.baseLng);
      const escolhidas =
        corpo.baseLat != null &&
        corpo.baseLng != null &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
          ? { lat, lng }
          : null;
      const base = escolhidas ?? (await geocodificarLocalidade(cidade));
      const pool = await getPool();
      if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });
      await pool.execute("UPDATE providers SET city = ?, baseLat = ?, baseLng = ? WHERE id = ?", [
        cidade,
        base?.lat ?? null,
        base?.lng ?? null,
        providerId,
      ]);
      feito.push(base ? "morada da base actualizada" : "morada gravada, mas sem ponto no mapa");
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

    return NextResponse.json({
      ok: true,
      feito,
      avisoDeDistribuicao,
      conviteEnviado,
      linkDaSenha: linkDaSenha ?? linkPedidoAqui,
      palavraPasseDefinida,
    });
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
