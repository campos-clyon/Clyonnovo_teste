import { NextRequest, NextResponse } from "next/server";
import { avisarAccaoPeloLink } from "@/lib/avisar-contacto-do-pedido";
import {
  negociacaoPorTokenHash,
  gravarNegociacao,
  getSimulatorOrderByAcessoTokenHash,
  perfilDoProfissional,
} from "@/lib/db";
import { hashDeToken, verificarTokenDeAcesso } from "@/lib/pedido-acesso";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import {
  propor,
  aceitar,
  desistir,
  type Negociacao,
  type Proposta,
} from "@/lib/negociacao";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { avisarDaProposta } from "@/lib/avisar-da-proposta";
import { lerForma } from "@/lib/forma-de-pagamento";
import { bloqueioDoProfissional } from "@/lib/bloqueio-do-profissional";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { modoDaOferta } from "@/lib/oferta-clyon";
import { responderOfertaClyon } from "@/lib/responder-oferta-clyon";
import { agirComoCliente, eAccaoSoDoCliente, type CorpoDoCliente } from "@/lib/agir-como-cliente";

export const runtime = "nodejs";

/**
 * Agir numa negociação.
 *
 * Uma rota para os dois lados, e é o **token** que diz quem está a falar — não
 * um campo no corpo do pedido. Se o lado viesse do cliente, qualquer pessoa
 * podia enviar `lado: "cliente"` e aceitar propostas em nome dele.
 *
 * O token do profissional é o da negociação; o do cliente é o do pedido. São
 * credenciais diferentes para portas diferentes, e nenhuma serve na outra.
 *
 * O LADO DO CLIENTE PASSA POR `agirComoCliente` (d8, R8, 28-10-2026) — a mesma
 * função da conta e da app de cliente. Esta rota só prova, pelo token do link,
 * que o pedido é dele.
 */

/**
 * `valor` é o do profissional; `preco` é o do cliente, já com a taxa — ver
 * `valorDaPropostaDoCliente`. Só o cliente manda `preco`.
 */
type Corpo = CorpoDoCliente & { accao?: string; valorVisto?: unknown };

function propostasDe(json: string | null): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  // Uma negociação a sério tem no máximo dez acções. Este travão não incomoda
  // ninguém e trava quem tente adivinhar tokens à força.
  const limite = await limitarRotaPublica(req, "negociacao", 30, 300);
  if (limite.erro) return limite.erro;

  const { token } = await params;
  const hash = hashDeToken(token);

  let corpo: Corpo;
  try {
    corpo = (await req.json()) as Corpo;
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }

  // ── Quem está a falar ─────────────────────────────────────────────────────
  const doProfissional = await negociacaoPorTokenHash(hash);

  if (!doProfissional) {
    /*
     * Não é de profissional — pode ser o link do cliente. O token prova que o
     * pedido é dele; o que ele faz com isso é o mesmo que faria na conta ou na
     * app, e vive num sítio só.
     */
    const pedido = await getSimulatorOrderByAcessoTokenHash(hash);
    const r = verificarTokenDeAcesso(
      token,
      pedido?.acessoTokenHash ?? null,
      pedido?.acessoTokenExpiraEm ?? null,
    );
    if (!pedido || !r.valido) {
      return NextResponse.json({ ok: false, error: "Link inválido ou expirado." }, { status: 403 });
    }
    // E por pedido, além de por endereço (Segurança, 28-10-2026): o link é a conta de quem não tem conta.
    const porPedido = await limitarPorConta("negociacao-pedido", `pedido:${pedido.id}`, 30, 300);
    if (porPedido.erro) return porPedido.erro;
    const resposta = await agirComoCliente({
      pedido,
      corpo,
      autorNome: null,
      porta: "link",
      baseUrl: urlDeAccaoDoPedido(req.headers),
    });
    // Pelo link, o contacto do pedido fica a saber (Segurança, R23, 29-10-2026).
    if (resposta.status === 200) await avisarAccaoPeloLink(pedido, (corpo as { accao?: unknown }).accao);
    return NextResponse.json(resposta.corpo, { status: resposta.status });
  }

  // ── Daqui para baixo, só o profissional ──────────────────────────────────
  const r = verificarTokenDeAcesso(
    token,
    doProfissional.acessoTokenHash,
    doProfissional.acessoTokenExpiraEm,
  );
  if (!r.valido) {
    return NextResponse.json({ ok: false, error: "Link inválido ou expirado." }, { status: 403 });
  }
  /*
   * O link sozinho já não chega — 02-10-2026, decisão do dono («tudo com
   * login»). Propor, aceitar ou recusar pede a sessão do profissional a
   * quem esta negociação pertence: um link reencaminhado deixa de servir.
   */
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) {
    return NextResponse.json(
      { ok: false, error: "Entre na sua conta de profissional para responder a este pedido.", entrar: true },
      { status: 401 },
    );
  }
  if (Number(sessao.providerId) !== Number(doProfissional.providerId)) {
    return NextResponse.json(
      { ok: false, error: "Este pedido foi enviado a outro profissional." },
      { status: 403 },
    );
  }
  const negociacaoId = doProfissional.id;
  const pedidoId = doProfissional.pedidoId;
  const providerId = doProfissional.providerId;
  const linha = doProfissional;

  /*
   * Cancelar o pedido, contratar, confirmar, avaliar e responder a um ajuste
   * são do cliente — ver `ACCOES_SO_DO_CLIENTE`. Pelo link do profissional,
   * nenhuma passa.
   */
  if (eAccaoSoDoCliente(corpo.accao)) {
    return NextResponse.json(
      { ok: false, error: "Só o cliente pode fazer isto." },
      { status: 403 },
    );
  }

  const modoOferta = modoDaOferta((linha as { ofertaClyon?: unknown }).ofertaClyon);

  // ── Aplicar a acção ───────────────────────────────────────────────────────
  const agora = new Date();

  /*
   * DÍVIDA EM ATRASO FECHA OS TRABALHOS EM DINHEIRO — 01-10-2026.
   *
   * A mesma regra da rota do painel (`/api/profissionais/negociacao`): pelo
   * link do email o profissional também propõe e aceita, e uma porta sem a
   * regra era a regra a não existir. Ver `bloqueio-por-divida.ts`.
   */
  if (
    (corpo.accao === "propor" || corpo.accao === "aceitar") &&
    lerForma(linha.formaDePagamento) === "dinheiro"
  ) {
    try {
      const b = await bloqueioDoProfissional(providerId, agora);
      if (b.bloqueado) {
        return NextResponse.json(
          { ok: false, error: b.explicacao, bloqueadoPorDivida: true },
          { status: 403 },
        );
      }
    } catch (err) {
      console.error("[negociacao] não verificou as dívidas do profissional:", err);
      return NextResponse.json(
        { ok: false, error: "Não foi possível guardar. Tente novamente." },
        { status: 500 },
      );
    }
  }

  const estadoActual: Negociacao = {
    estado: linha.estado as Negociacao["estado"],
    valorAcordado: linha.valorAcordado != null ? Number(linha.valorAcordado) : null,
    propostas: propostasDe(linha.propostasJson),
  };

  /*
   * UM TRABALHO CLYON DE VALOR FIXO — 02-10-2026. Só aceitar ou recusar, e a
   * resposta segue por `responderOfertaClyon` (a mesma nas duas portas). Ver
   * `oferta-clyon.ts`.
   */
  if (modoOferta) {
    const perfil = await perfilDoProfissional(providerId).catch(() => undefined);
    const r = await responderOfertaClyon({
      negociacaoId,
      pedidoId,
      providerId,
      nome: String(perfil?.name ?? "O profissional"),
      estadoActual,
      accao: corpo.accao,
      modo: modoOferta,
      baseUrl: urlDeAccaoDoPedido(req.headers),
      agora,
      valorVisto: (corpo as { valorVisto?: unknown }).valorVisto,
    });
    return NextResponse.json(r.corpo, { status: r.status });
  }

  let resultado;
  switch (corpo.accao) {
    case "propor": {
      // O profissional escreve o valor dele, como sempre.
      const valor =
        typeof corpo.valor === "string" ? Number(corpo.valor.replace(",", ".")) : Number(corpo.valor);
      resultado = propor(estadoActual, "profissional", valor, agora);
      break;
    }
    case "aceitar":
      resultado = aceitar(estadoActual, "profissional", agora);
      break;
    case "desistir":
      resultado = desistir(estadoActual, "profissional", agora);
      break;
    default:
      return NextResponse.json({ ok: false, error: "Acção desconhecida." }, { status: 400 });
  }

  if (!resultado.ok) {
    return NextResponse.json({ ok: false, error: resultado.erro }, { status: 409 });
  }

  const nova = resultado.negociacao;

  try {
    // O profissional nunca fecha sozinho: aceitar o valor do cliente deixa a
    // negociação à espera de o cliente o contratar (o aperto de mão duplo).
    await gravarNegociacao(negociacaoId, {
      estado: nova.estado,
      valorAcordado: nova.valorAcordado ?? null,
      propostasJson: JSON.stringify(nova.propostas),
    });
  } catch (err) {
    console.error("[negociacao] falha ao gravar:", err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível guardar. Tente novamente." },
      { status: 500 },
    );
  }

  // Avisar o outro lado. Uma proposta que ninguém vê não morre (já não há
  // prazo, ver `AS_PROPOSTAS_EXPIRAM`), mas fica parada — e perder um
  // trabalho porque ninguém foi ver a página é a pior forma de o perder.
  // Nunca lança: a proposta já está gravada.
  if (corpo.accao === "propor" && nova.valorAcordado == null) {
    const ultima = nova.propostas[nova.propostas.length - 1];
    if (ultima) {
      await avisarDaProposta({
        pedidoId,
        negociacaoId,
        quemPropos: "profissional",
        valor: ultima.valor,
        baseUrl: urlDeAccaoDoPedido(req.headers),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    estado: nova.estado,
    valorAcordado: nova.valorAcordado ?? null,
    propostas: nova.propostas,
  });
}
