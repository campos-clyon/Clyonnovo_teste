import type { Metadata } from "next";
import { Miniatura } from "@/components/Anexo";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { COOKIE_SESSAO_PROFISSIONAL } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { Clock } from "lucide-react";
import {
  negociacaoPorTokenHash,
  getSimulatorOrderById,
  custosEBaseDoProfissional,
} from "@/lib/db";
import { hashDeToken, verificarTokenDeAcesso } from "@/lib/pedido-acesso";
import { vistaDoProfissional } from "@/lib/pedido-valores";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { quantoOProfissionalRecebe, taxasDaNegociacao } from "@/lib/taxas-plataforma";
import { distanciasRodoviarias } from "@/lib/distancia-rodoviaria";
import { getActivePricingMap } from "@/lib/pricing-helper";
import {
  parametrosDoMapa,
  sugerirParaOProfissional,
  type SugestaoParaOProfissional,
} from "@/lib/sugestao-para-o-profissional";
import type { Proposta } from "@/lib/negociacao";
import Nota from "@/components/Nota";
import { cargaParaEste, fraseDaCarga } from "@/lib/carga-da-carrinha";
import { lerBase } from "@/lib/base-do-preco";
import NegociacaoProfissional from "./NegociacaoProfissional";
import HistoricoDaNegociacao from "@/components/HistoricoDaNegociacao";
import { modoDaOferta } from "@/lib/oferta-clyon";
import { estadoParaOProfissional } from "@/lib/pedido-arrumado";

export const metadata: Metadata = {
  title: "Pedido — CLYON profissionais",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * O pedido, do lado de quem o vai fazer.
 *
 * Tudo o que aqui se mostra passa primeiro por `vistaDoProfissional`. Não é
 * zelo a mais: esta página tem acesso à linha inteira do pedido, onde estão o
 * valor máximo do cliente, a morada exacta e o contacto dele. Ler a linha e
 * escolher campos à mão no JSX funcionaria hoje e falharia no dia em que
 * alguém acrescentasse um campo e o passasse sem pensar.
 */

function propostasDe(json: string | null): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

function fotosDe(filesJson: unknown): Array<{ url: string; name?: string }> {
  if (typeof filesJson !== "string") return [];
  try {
    const l = JSON.parse(filesJson);
    return Array.isArray(l) ? l.filter((f) => f && typeof f.url === "string") : [];
  } catch {
    return [];
  }
}

export default async function PaginaDoPedidoProfissional({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  /*
   * O QUE NÃO DEPENDE DE NADA PARTE JUNTO — 07-10-2026.
   *
   * No Speed Insights era uma das duas piores rotas do site (40 em 100,
   * telemóveis em Portugal). A página fazia cinco idas à base, uma atrás da
   * outra, antes de desenhar uma letra — e cada uma atravessa o Atlântico
   * (as funções correm em Washington). Agora são três: o pedido, a sessão e
   * a tabela de preços não dependem uns dos outros e pedem-se juntos. As
   * respostas continuam a ser dadas pela mesma ordem — link que não existe,
   * link expirado, sem sessão, conta de outro —, e o pedido em si só se lê
   * depois de a sessão ser a certa.
   *
   * A tabela de preços nunca rejeita (`getActivePricingMap` cai nos valores
   * de origem), e por isso pode ficar a correr enquanto se decide o resto.
   */
  const tabelaDePrecos = getActivePricingMap();
  const [negociacao, sessao] = await Promise.all([
    negociacaoPorTokenHash(hashDeToken(token)),
    cookies().then((c) => sessaoActivaDoProfissional(c.get(COOKIE_SESSAO_PROFISSIONAL)?.value)),
  ]);
  const acesso = verificarTokenDeAcesso(
    token,
    negociacao?.acessoTokenHash ?? null,
    negociacao?.acessoTokenExpiraEm ?? null,
  );

  if (!negociacao || (!acesso.valido && acesso.motivo !== "expirado")) notFound();

  if (!acesso.valido) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md items-center px-4">
        <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <Clock className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-bold text-amber-900">Este link expirou</h1>
          <p className="mt-2 text-sm text-amber-800">
            Os pedidos não ficam abertos para sempre. Se ainda estiver interessado,
            fale connosco.
          </p>
        </div>
      </main>
    );
  }

  /*
   * O LINK JÁ NÃO CHEGA SOZINHO — 02-10-2026, decisão do dono: «tudo com
   * login».
   *
   * O endereço levava um código secreto que valia por si: quem tivesse o
   * link via o pedido e propunha em nome do profissional, sem entrar. Um
   * link reencaminhado no WhatsApp bastava. Agora o código diz QUAL é a
   * negociação, e a sessão diz QUEM está a ver: sem sessão, vai entrar e
   * volta aqui; com a sessão de outro profissional, não se mostra nada.
   */
  if (!sessao) {
    redirect(`/profissionais/entrar?destino=${encodeURIComponent(`/profissionais/pedidos/${token}`)}`);
  }
  if (Number(sessao.providerId) !== Number(negociacao.providerId)) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md items-center px-4">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <h1 className="text-lg font-bold text-slate-900">Este pedido foi enviado a outro profissional</h1>
          <p className="mt-2 text-sm text-slate-600">
            Entrou com uma conta diferente da que recebeu este link. Saia e entre com a
            conta certa, ou veja os seus pedidos no painel.
          </p>
        </div>
      </main>
    );
  }

  /*
   * O pedido e os custos dele, juntos — os dois só dependem da negociação.
   * Uma falha nos custos não pode impedir a página de abrir: fica guardada
   * e conta como antes, na sugestão (que sai sem nada).
   */
  const custosDele = custosEBaseDoProfissional(Number(negociacao.providerId)).then(
    (custos) => ({ custos }),
    (erro: unknown) => ({ erro }),
  );
  const linha = await getSimulatorOrderById(negociacao.pedidoId);
  if (!linha) notFound();

  // A redução acontece aqui, uma vez, e é o que segue para o ecrã.
  const vista = vistaDoProfissional(linha as unknown as Record<string, unknown>);

  const servico =
    SERVICE_CATEGORIES.find((c) => c.id === vista.serviceType)?.label ??
    (vista.serviceType as string) ??
    "Serviço";
  const fotos = fotosDe(vista.filesJson);
  const minimo =
    vista.valorDesejadoCliente != null ? Number(vista.valorDesejadoCliente) : null;

  /*
   * A SUGESTÃO DA CLYON, CALCULADA PARA ELE — também por aqui.
   *
   * O link do email e o painel são a mesma negociação e têm de dizer o
   * mesmo número. Os quilómetros são da base DELE (o profissional desta
   * negociação) ao trabalho, pela estrada quando dá; os custos são os do
   * perfil dele, se os tiver. Nada disto pode impedir a página de abrir:
   * sem base, sem coordenadas ou sem parâmetros, sai sem sugestão.
   */
  let sugestao: SugestaoParaOProfissional | null = null;
  /*
   * A CARRINHA DELE — fora do `try`, e de propósito.
   *
   * Vem da mesma leitura que os custos. Fica aqui porque o bloco da carga é
   * renderizado abaixo e não pode depender de a sugestão ter corrido bem: uma
   * chamada ao Maps que falhe não tem nada a ver com o que uma carga vale na
   * carrinha dele.
   */
  let carrinhaDele: string | null = null;
  try {
    const [mapa, lidos] = await Promise.all([tabelaDePrecos, custosDele]);
    if ("erro" in lidos) throw lidos.erro;
    const profissional = lidos.custos;
    carrinhaDele = profissional?.tipoVeiculo ?? null;
    const bruto = linha as unknown as Record<string, unknown>;
    let destino: { lat: number; lng: number } | null = null;
    try {
      const raw = typeof bruto.rawOrderJson === "string" ? JSON.parse(bruto.rawOrderJson) : null;
      const lat = Number(raw?.address?.lat);
      const lng = Number(raw?.address?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) destino = { lat, lng };
    } catch {
      destino = null;
    }
    const origem =
      profissional?.baseLat != null && profissional?.baseLng != null
        ? { lat: profissional.baseLat, lng: profissional.baseLng }
        : null;
    let distanciaKm: number | null = null;
    if (origem && destino) {
      const [medida] = await distanciasRodoviarias([{ origem, destino }]);
      distanciaKm = medida?.km ?? null;
    }
    sugestao = sugerirParaOProfissional(
      {
        serviceType: (vista.serviceType as string | null) ?? null,
        entulhoEstado: (vista.entulhoEstado as string | null) ?? null,
        entulhoQuantidade: (vista.entulhoQuantidade as string | null) ?? null,
        floor: (vista.floor as string | null) ?? null,
        hasElevator: (vista.hasElevator as string | null) ?? null,
        parkingDistance: (vista.parkingDistance as string | null) ?? null,
        description: (vista.description as string | null) ?? null,
        percursoKm: (vista.percursoKm as number | string | null) ?? null,
        andarDestino: (vista.andarDestino as string | null) ?? null,
        elevadorDestino: (vista.elevadorDestino as string | null) ?? null,
        estacionamentoDestino: (vista.estacionamentoDestino as string | null) ?? null,
        baseDoPreco: (bruto.baseDoPreco as string | null) ?? null,
      },
      distanciaKm,
      parametrosDoMapa(mapa),
      profissional ?? null,
      taxasDaNegociacao(negociacao),
    );
  } catch (e) {
    console.error("[profissionais/pedidos/[token]] sugestão", e);
    sugestao = null;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Pedido #{negociacao.pedidoId}
        </span>
        <h1 className="mt-1 text-2xl font-bold text-[#0B1929] sm:text-3xl">{servico}</h1>
        {vista.city != null && (
          <p className="mt-1 text-sm text-slate-500">{String(vista.city)}</p>
        )}
      </header>

      <section className="rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">O trabalho</h2>

        {vista.description != null && (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {String(vista.description)}
          </p>
        )}

        <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
          {/* «O cliente precisa de fatura» saiu a 01-10-2026: a factura é da parceira, sempre. */}
          {Boolean(vista.precisaGuiaTransporte) && (
            <li>· O cliente precisa de guia de transporte</li>
          )}
          {vista.floor != null && <li>· Andar: {String(vista.floor)}</li>}
          {vista.hasElevator != null && <li>· Elevador: {String(vista.hasElevator)}</li>}
        </ul>

        {fotos.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {fotos.length} {fotos.length === 1 ? "fotografia" : "fotografias"}
            </h3>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fotos.map((f, i) => (
                <Miniatura
                  key={i}
                  url={f.url}
                  nome={f.name}
                  className="aspect-square w-full"
                  tamanho="(max-width: 640px) 33vw, 200px"
                />
              ))}
            </div>
          </div>
        )}

        <Nota titulo="Morada e contacto: depois de ser contratado" icone="cadeado" className="mt-5">
          Vê a zona para saber se lhe serve e quanto custa lá chegar. A morada
          exacta e o telefone do cliente chegam-lhe por email assim que ele o
          contratar — é o que impede que um pedido seja usado como lista de
          contactos.
        </Nota>
      </section>

      {/*
        O QUE UMA CARGA VALE NA CARRINHA DELE — também pelo link do email.

        É por aqui que ele vê um pedido novo pela primeira vez, e é aqui que
        decide se responde. Ter a conta só no painel era tê-la depois da
        decisão. O painel e o link são a mesma negociação e têm de dizer o
        mesmo — ver `carga-da-carrinha.ts`.

        Sobre o LÍQUIDO, como o número que ele vê ao lado. E não mexe no valor
        que ele aceita: nada no sistema multiplica cargas.
      */}
      {(() => {
        if (lerBase((linha as unknown as Record<string, unknown>).baseDoPreco) !== "carga") {
          return null;
        }
        const liquido =
          negociacao.valorAcordado != null
            ? quantoOProfissionalRecebe(Number(negociacao.valorAcordado), taxasDaNegociacao(negociacao))
            : minimo != null
              ? quantoOProfissionalRecebe(minimo, taxasDaNegociacao(negociacao))
              : null;
        const f = fraseDaCarga(cargaParaEste(liquido, carrinhaDele));
        if (!f) return null;
        return (
          <section className="mt-4 rounded-2xl border border-amber-300 bg-white p-4">
            <h2 className="text-sm font-bold text-amber-900">{f.titulo}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{f.texto}</p>
          </section>
        );
      })()}

      <NegociacaoProfissional
        token={token}
        // Um pedido arquivado ou cancelado é um trabalho perdido (08-10-2026).
        estadoInicial={estadoParaOProfissional(negociacao, linha.status)}
        propostasIniciais={propostasDe(negociacao.propostasJson)}
        valorAcordado={negociacao.valorAcordado != null ? Number(negociacao.valorAcordado) : null}
        minimoDoCliente={minimo}
        recebeSeAceitar={minimo != null ? quantoOProfissionalRecebe(minimo, taxasDaNegociacao(negociacao)) : null}
        sugestao={sugestao}
        taxas={taxasDaNegociacao(negociacao)}
        formaDePagamento={(negociacao as { formaDePagamento?: string | null }).formaDePagamento ?? null}
        criadaEm={negociacao.createdAt ? new Date(negociacao.createdAt).toISOString() : null}
        // Trabalho CLYON de valor fixo — ver `oferta-clyon.ts`.
        ofertaClyon={modoDaOferta(negociacao.ofertaClyon)}
        cancelada={linha.status === "cancelado"}
      />

      {/* O mesmo registo que ele vê no painel. Chegar aqui pelo link do email
          não pode dar uma versão diferente da história. */}
      <HistoricoDaNegociacao
        propostas={propostasDe(negociacao.propostasJson)}
        marcos={{
          execucaoEnviadaEm: negociacao.execucaoEnviadaEm,
          confirmadoEm: negociacao.confirmadoEm,
          pagoEm: negociacao.pagoEm,
          valorAcordado: negociacao.valorAcordado,
        }}
        euSou="profissional"
        ofertaClyon={modoDaOferta(negociacao.ofertaClyon) != null}
      />
    </main>
  );
}
