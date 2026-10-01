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
  mudarEmailDoProfissional,
  EmailDeOutraConta,
} from "@/lib/db";
import {
  validarEdicao,
  estadoValido,
  afectaDistribuicao,
  validarDados,
  CAMPOS_DE_DADOS,
  CAMPOS_SO_DO_ADMINISTRADOR,
  type DadosValidados,
} from "@/lib/edicao-profissional";
import { contaPodeEntrarNoPainel } from "@/lib/profissional-auth";
import { emitirLinkDeRepor, HORAS_DO_LINK_DE_REPOR } from "@/lib/repor-palavra-passe";
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
 * Gerir um profissional: estado, perfil, verificação da guia, coordenadas, os
 * dados da pessoa (contacto, faturação, viatura, pagamento) e o link para
 * repor a palavra-passe.
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

  /*
   * OS DADOS DA PESSOA validam-se ANTES de qualquer escrita — 01-10-2026.
   *
   * Nome, telefone, NIF, email, morada fiscal, viatura, IBAN e MB WAY (o dono
   * pediu «Tudo» no «Editar perfil»). Validar aqui em cima é o que impede um
   * NIF errado de deixar gravada a meio a morada da base que veio no mesmo
   * pedido.
   *
   * O email e os dados de pagamento só o administrador muda: por um entra-se
   * na conta (é para lá que vai o link de repor a palavra-passe), pelos outros
   * sai o dinheiro dele.
   */
  let dadosValidados: DadosValidados | null = null;
  if (CAMPOS_DE_DADOS.some((k) => k in corpo)) {
    if (CAMPOS_SO_DO_ADMINISTRADOR.some((k) => k in corpo) && colab.papel !== "admin") {
      return NextResponse.json(
        { error: "Só o administrador muda o email e os dados de pagamento." },
        { status: 403 },
      );
    }
    const validacao = validarDados(corpo);
    if (!validacao.ok) {
      return NextResponse.json(
        { error: validacao.erros[0].mensagem, erros: validacao.erros },
        { status: 400 },
      );
    }
    // A mesma regra do perfil dele: a fatura sem NIF não existe.
    if (corpo.emiteFatura === true && validacao.dados.colunas.nif === null) {
      return NextResponse.json({ error: "Para emitir fatura é preciso o NIF." }, { status: 400 });
    }
    dadosValidados = validacao.dados;
  }

  try {
    const feito: string[] = [];
    let avisoDeDistribuicao = false;

    // ── Os dados da pessoa ───────────────────────────────────────────────────
    //
    // Primeiro de tudo: um email que já é de outra conta pára o pedido antes
    // de se escrever o que quer que seja.
    if (dadosValidados) {
      if (dadosValidados.email !== undefined) {
        await mudarEmailDoProfissional(providerId, dadosValidados.email);
        feito.push("email mudado");
        console.info(`[admin/profissionais] email de #${providerId} mudado por ${colab.nome}`);
      }
      const colunas = dadosValidados.colunas;
      if (Object.keys(colunas).length > 0) {
        await actualizarPerfilDoProfissional(providerId, colunas);
        feito.push("dados actualizados");
        if ("iban" in colunas || "mbway" in colunas || "ibanTitular" in colunas) {
          // Para onde vai o dinheiro dele: fica escrito quem o mudou.
          console.info(`[admin/profissionais] pagamento de #${providerId} mudado por ${colab.nome}`);
        }
      }
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

    // ── Conta de teste ───────────────────────────────────────────────────────
    //
    // Só o administrador: uma conta de teste tem os trabalhos apagáveis sem
    // olhar ao dinheiro, e isso não é coisa que um assistente decida.
    if (typeof corpo.contaDeTeste === "boolean") {
      if (colab.papel !== "admin") {
        return NextResponse.json(
          { error: "Só o administrador marca uma conta como de teste." },
          { status: 403 },
        );
      }
      const pool = await getPool();
      if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });
      const [r] = (await pool.execute("UPDATE providers SET contaDeTeste = ? WHERE id = ?", [
        corpo.contaDeTeste ? 1 : 0,
        providerId,
      ])) as [{ affectedRows?: number }, unknown];
      // Uma marca que não pegou em linha nenhuma diz-se — não passa por feita.
      if (Number(r?.affectedRows ?? 0) === 0) {
        return NextResponse.json(
          { error: `O profissional #${providerId} não foi encontrado.` },
          { status: 404 },
        );
      }
      feito.push(corpo.contaDeTeste ? "marcada como conta de teste" : "deixou de ser conta de teste");
      console.info(
        `[admin/profissionais] #${providerId} ${corpo.contaDeTeste ? "marcado" : "desmarcado"} como teste por ${colab.nome}`,
      );
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

    // ── Repor a palavra-passe ────────────────────────────────────────────────
    //
    // «Esse profissional não consegue acessar a conta pois perdeu sua senha» —
    // 01-10-2026. Até aqui o link só saía ao aprovar alguém que ainda não
    // tinha palavra-passe, e quem a perdesse ficava fora da conta e do saldo.
    //
    // SÓ POR EMAIL, como o dono escolheu: a resposta diz se saiu e para onde,
    // e nunca traz o link. Serve também o assistente — o link vai para a caixa
    // de correio do profissional, não para as mãos de quem carregou no botão.
    let linkDeReporEnviado: boolean | undefined;
    let linkDeReporPara: string | undefined;
    if (corpo.reporPalavraPasse === true) {
      const pool = await getPool();
      if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });
      const [linhas] = (await pool.execute(
        "SELECT name, email, estado, isActive FROM providers WHERE id = ? LIMIT 1",
        [providerId],
      )) as any[];
      const p = (linhas as Array<{ name: string; email: string | null; estado: string; isActive: number }>)[0];
      if (!p) return NextResponse.json({ error: "Profissional não encontrado." }, { status: 404 });
      if (!p.email) {
        return NextResponse.json(
          { error: "Este profissional não tem email. Corrija-o primeiro no «Editar perfil»." },
          { status: 400 },
        );
      }
      // A rota de definir recusa o link a uma conta fechada: mandá-lo era
      // prometer-lhe uma porta que não abre.
      if (!contaPodeEntrarNoPainel(p)) {
        return NextResponse.json(
          { error: `A conta está «${p.estado}» e o link não abriria. Reactive-a primeiro.` },
          { status: 409 },
        );
      }
      linkDeReporEnviado = await emitirLinkDeRepor({
        providerId,
        nome: p.name,
        email: p.email,
        baseUrl: urlDeAccaoDoPedido(req.headers),
        pedidoPor: "clyon",
      });
      linkDeReporPara = p.email;
      feito.push(linkDeReporEnviado ? "link de repor enviado" : "link de repor NÃO enviado");
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
        /*
         * O LINK EM CLARO SÓ VAI PARA O ADMINISTRADOR — 30-09-2026.
         *
         * É a chave da conta do profissional: quem o abre escolhe a
         * palavra-passe e fica com ela. O assistente aprova, mas não precisa
         * de ter na mão a chave da conta de outra pessoa — se o email não
         * sair, o painel diz-lhe para pedir ao administrador, que volta a
         * aprovar e recebe o link (um novo, que substitui este).
         */
        if (!conviteEnviado && colab.papel === "admin") {
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
      linkDaSenha,
      linkDeReporEnviado,
      linkDeReporPara,
      horasDoLinkDeRepor: HORAS_DO_LINK_DE_REPOR,
    });
  } catch (error) {
    if (error instanceof EmailDeOutraConta) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
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
