import Link from "next/link";
import { Camera, MapPin, Clock, FileText, Truck } from "lucide-react";
import { lerBase, avisoDaBaseParaOCliente } from "@/lib/base-do-preco";
import { avisoDosItens } from "@/lib/itens-a-mais";
import { negociacoesDoPedido } from "@/lib/db";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { oClienteVeEsta, type Proposta } from "@/lib/negociacao";
import { faseDoTrabalho, diasAteLibertar } from "@/lib/trabalho";
import Nota from "@/components/Nota";
import PropostasRecebidas from "./PropostasRecebidas";
import { perfilPublicoDoProfissional } from "@/lib/perfil-publico-do-profissional";

/**
 * O PEDIDO COMO O CLIENTE O VÊ — e num sítio só.
 *
 * Esta vista era o corpo de `page.tsx`, a página que se abre pelo link do
 * email. Saiu de lá por uma razão prática: o backoffice precisava de a mostrar
 * também, e a alternativa era desenhá-la outra vez.
 *
 * "Gostaria que, ao clicar em ver como cliente, abrisse o pedido como ele
 * aparece para o cliente, para eu, admin, poder conferir as infos — mas sem
 * gerar links novos." — 12-09-2026.
 *
 * A parte do "sem gerar links novos" é a que manda em tudo o que está aqui. O
 * link do cliente vive só em HASH: para abrir a página dele era preciso emitir
 * um token novo, e cada token novo MATA o anterior — o que o cliente tem na
 * mão deixava de funcionar por causa de uma espreitadela do backoffice. Por
 * isso quem chama esta vista pelo backoffice não traz token nenhum: traz o
 * pedido, e a prova de que é administrador fica à porta.
 *
 * DUAS ENTRADAS, UMA VISTA. Se fossem duas cópias, a do backoffice ficava
 * desactualizada ao primeiro texto que se mudasse do outro lado — e servia
 * justamente para conferir o que o cliente vê.
 */

/*
 * O `euros` desta vista saiu com o último número que ela escrevia.
 *
 * Formatava dois: a estimativa do motor, que saiu a 18-09-2026, e o valor que
 * o cliente indicou, que saiu no mesmo dia. Esta página deixou de dizer
 * dinheiro — quem o diz é o bloco das propostas, que tem o seu.
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

function fotosDoPedido(filesJson: unknown): Array<{ url: string; name?: string }> {
  if (typeof filesJson !== "string") return [];
  try {
    const lista = JSON.parse(filesJson);
    if (!Array.isArray(lista)) return [];
    return lista.filter((f) => f && typeof f.url === "string");
  } catch {
    return [];
  }
}

const URGENCIA: Record<string, string> = {
  today: "Hoje",
  tomorrow: "Amanhã",
  this_week: "Esta semana",
  flexible: "Sem pressa",
};

export default async function VistaDoPedido({
  pedido,
  token,
  soParaVer = false,
}: {
  pedido: Awaited<ReturnType<typeof import("@/lib/db").getSimulatorOrderById>>;
  /** O token do link, quando se chega por ele. O backoffice não traz nenhum. */
  token?: string;
  /**
   * O backoffice está a CONFERIR, não a decidir pelo cliente.
   *
   * Sem isto, quem abrisse para ver tinha à frente os botões de aceitar e de
   * recusar propostas — e um clique distraído fechava um negócio de centenas
   * de euros em nome de outra pessoa. A vista é a mesma; os gestos não.
   */
  soParaVer?: boolean;
}) {
  if (!pedido) return null;

  const servico =
    SERVICE_CATEGORIES.find((c) => c.id === pedido.serviceType)?.label ??
    pedido.serviceType ??
    "Serviço";

  // As negociações a decorrer. O cliente pode ter várias — é isso que torna o
  // segundo passo do aperto de mão necessário.
  const agora = new Date();
  /*
   * O perfil de cada profissional vai JUNTO com a negociação, calculado aqui
   * no servidor — a homepage promete "vê o nome, a nota e os trabalhos antes
   * de aceitar", e até aqui só ia o nome. São dados REAIS: com zero
   * avaliações o ecrã diz "sem avaliações ainda", não inventa número nenhum.
   */
  /*
   * SÓ QUEM FEZ PROPOSTA. E o filtro corre AQUI, no servidor.
   *
   * Um pedido vai a todos os profissionais elegíveis da zona, e cada um abre
   * uma negociação no instante em que o recebe — mesmo que nunca lhe toque. O
   * cliente via seis cartões com nome e avaliações a dizer «à espera da
   * proposta dele».
   *
   * Filtrar no browser tirava-os do ecrã e deixava-os no HTML: os nomes, as
   * notas e os trabalhos de seis pessoas que o cliente não tem nada que
   * conhecer viajavam na mesma. Aqui, nem saem da base — e, de caminho,
   * poupam-se os perfis públicos que não vão ser mostrados a ninguém.
   *
   * A regra é a mesma da conta, e vive em `oClienteVeEsta`.
   */
  const linhas = (await negociacoesDoPedido(pedido.id)).filter((n) =>
    oClienteVeEsta({ estado: n.estado, propostas: propostasDe(n.propostasJson) }),
  );
  const perfis = new Map(
    await Promise.all(
      [...new Set(linhas.map((n) => Number(n.providerId)))].map(
        async (id) => [id, await perfilPublicoDoProfissional(id)] as const,
      ),
    ),
  );
  const negociacoesDoCliente = linhas.map((n) => {
    const contratado = n.estado === "acordada";
    const perfil = perfis.get(Number(n.providerId)) ?? null;
    return {
      perfil: perfil
        ? {
            naClyonDesde: perfil.naClyonDesde ? perfil.naClyonDesde.toISOString() : null,
            trabalhosConcluidos: perfil.trabalhosConcluidos,
            notaMedia: perfil.notaMedia,
            quantasAvaliacoes: perfil.quantasAvaliacoes,
            categorias: perfil.categorias,
            zonas: perfil.zonas,
            raioKm: perfil.raioKm,
            avaliacoes: perfil.avaliacoes.map((a) => ({
              estrelas: a.estrelas,
              comentario: a.comentario,
              avaliadoEm: a.avaliadoEm ? new Date(a.avaliadoEm).toISOString() : null,
              servicoTipo: a.servicoTipo,
              cidade: a.cidade,
            })),
          }
        : null,
      id: n.id,
      estado: n.estado,
      valorAcordado: n.valorAcordado != null ? Number(n.valorAcordado) : null,
      // A comissão desta negociação, para o total que o ecrã mostra ser o
      // mesmo com que ela nasceu — e não o de hoje.
      taxaCliente: n.taxaCliente ?? null,
      taxaProfissional: n.taxaProfissional ?? null,
      propostas: propostasDe(n.propostasJson),
      profissionalNome: n.profissionalNome,
      // O contacto do profissional só depois de o contratar — a simetria do que
      // fazemos com a morada do cliente do outro lado.
      profissionalTelefone: contratado ? (n.profissionalTelefone ?? null) : null,
      emiteFatura: Number(n.emiteFatura) === 1,
      regimeIva: String(n.regimeIva ?? "isento"),
      guiaVerificada: n.guiaVerificadaEm != null,
      fase: faseDoTrabalho(n),
      provaJson: n.provaJson ?? null,
      diasAteLibertar: diasAteLibertar(n, agora),
      execucaoEnviadaEm: n.execucaoEnviadaEm ?? null,
      confirmadoEm: n.confirmadoEm ?? null,
      pagoEm: n.pagoEm ?? null,
    };
  });

  const fotos = fotosDoPedido(pedido.filesJson);
  // O que o valor MEDE: o trabalho todo, ou cada carga. Ver `base-do-preco.ts`.
  const base = lerBase((pedido as { baseDoPreco?: string | null }).baseDoPreco);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-tinta-fraca">
          Pedido #{pedido.id}
        </span>
        <h1 className="mt-1 text-2xl font-bold text-tinta sm:text-3xl">{servico}</h1>
      </header>

      <PropostasRecebidas
        token={token}
        pedidoId={pedido.id}
        negociacoesIniciais={negociacoesDoCliente}
        precisaFatura={Boolean(pedido.precisaFatura)}
        telefoneDoCliente={pedido.contactPhone ?? null}
        soParaVer={soParaVer}
      />

      {/* Criar conta: convida, nunca obriga — e deixa de convidar quando
          fecham a nota. Repetir o convite a cada visita é insistência.

          A quem está a conferir do backoffice isto não diz nada: ele não tem
          link nenhum para guardar, e a nota ocupava o lugar do que ele veio ver. */}
      {!soParaVer && (
      <Nota
        titulo="Guarde este link — é como volta ao pedido"
        icone="ligacao"
        tom="info"
        chave="guardar-link"
        className="mb-6 mt-4"
      >
        Não precisa de conta para voltar aqui: basta este endereço. Se preferir
        ter os pedidos todos no mesmo sítio,{" "}
        <Link href="/entrar" className="font-semibold underline">
          entre com a conta Google
        </Link>{" "}
        — leva um toque e não precisa de palavra-passe.
      </Nota>
      )}

      <section className="rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-tinta-fraca">
          O que pediu
        </h2>

        {pedido.description && (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {pedido.description}
          </p>
        )}

        <dl className="mt-4 space-y-2 text-sm">
          {pedido.city && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-tinta-fraca" aria-hidden="true" />
              <dt className="sr-only">Zona</dt>
              <dd className="text-slate-700">{pedido.city}</dd>
            </div>
          )}
          {pedido.urgency && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-tinta-fraca" aria-hidden="true" />
              <dt className="sr-only">Quando</dt>
              <dd className="text-slate-700">{URGENCIA[pedido.urgency] ?? pedido.urgency}</dd>
            </div>
          )}
          {Boolean(pedido.precisaFatura) && (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-tinta-fraca" aria-hidden="true" />
              <dd className="text-slate-700">Precisa de fatura</dd>
            </div>
          )}
          {Boolean(pedido.precisaGuiaTransporte) && (
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 shrink-0 text-tinta-fraca" aria-hidden="true" />
              <dd className="text-slate-700">Precisa de guia de transporte</dd>
            </div>
          )}
        </dl>

        {fotos.length > 0 && (
          <div className="mt-5">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-tinta-fraca">
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              {fotos.length} {fotos.length === 1 ? "fotografia" : "fotografias"}
            </h3>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fotos.map((f, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={f.url}
                  alt={f.name ?? `Fotografia ${i + 1} do pedido`}
                  className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200"
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/*
        O VALOR QUE ELE INDICOU SAIU DAQUI — 18-09-2026.

        "O valor que eu indiquei não deveria estar visível para os clientes,
        apenas para os pros."

        Aquele número é o PONTO DE PARTIDA DOS PROFISSIONAIS: é o que lhes
        chega com o pedido e é a partir dele que fazem propostas. Devolvê-lo ao
        cliente na página dele não lhe dizia nada de novo — foi ele ou nós que
        o escrevemos — e dizia-lhe uma coisa errada: no #298 lia-se «Contratou
        a TRSul, 350,00 €» em cima e «O valor que indicou 340,00 €» em baixo,
        dois números para a mesma pergunta, com dez euros de diferença e nada
        a explicar qual valia.

        O que fica são os DOIS AVISOS, que não são valores: o da carga e o do
        que o orçamento cobre. Continuam a fazer falta, e agora estão sozinhos
        — por isso a secção mudou de nome e só aparece quando há algum.
      */}
      {(avisoDaBaseParaOCliente(base) || avisoDosItens(base, "cliente")) && (
      <section className="mt-4 rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-tinta-fraca">
          Antes de fechar
        </h2>

        <div className="mt-3 space-y-3">
          {/*
            O AVISO DA CARGA, e só quando o preço é por carga.
            Um «150 €» sem unidade tanto é o trabalho inteiro como cada viagem
            ao aterro — e a diferença só aparece no fim, com o trabalho feito.
          */}
          {avisoDaBaseParaOCliente(base) && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold leading-relaxed text-amber-900">
              {avisoDaBaseParaOCliente(base)}
            </p>
          )}

          {/*
            E O CASO CONTRÁRIO: o que acontece se aparecerem coisas a mais.
            Um orçamento dado sobre fotografias cobre o que está nas
            fotografias. Dizê-lo aqui, antes de ele decidir, é o que impede que
            no dia seja uma surpresa — para ele e para quem vai buscar.
          */}
          {avisoDosItens(base, "cliente") && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
              {avisoDosItens(base, "cliente")}
            </p>
          )}

          {/*
            A NOSSA ESTIMATIVA SAIU DAQUI — 18-09-2026.

            "Vamos deixar de apresentar esse valor estimado para o cliente."

            Era um número calculado pelo motor a partir do formulário, antes
            de existir proposta nenhuma e antes sequer de a morada estar
            confirmada. Vinha em corpo grande e na cor de acção, ao lado do
            valor que ELE indicou — dois números com o mesmo peso a responder
            à mesma pergunta, e um deles não era de ninguém.

            O problema não é a estimativa estar errada: é ela ancorar. Quem lê
            127 € antes de as propostas chegarem lê 180 € como um aumento, e
            não como o preço. A CLYON não faz as recolhas e não é ela quem
            decide o preço — dizer um número «nosso» antes de os profissionais
            falarem era entrar numa conversa que não é nossa.
          */}

          {/*
            A NOTA "DE ONDE VÊM ESTES NÚMEROS" SAIU COM OS NÚMEROS.

            Explicava o valor que ele indicou — que já não está aqui — e a
            estimativa do motor, que saiu na véspera. Uma nota a explicar a
            origem de números que a secção não mostra é ruído com ar de
            transparência.

            O que ela dizia de útil continua dito onde importa: quem decide o
            preço são os dois, e isso está no rodapé da página, ao lado de
            «quem executa o trabalho é o profissional que escolher».
          */}
        </div>
      </section>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-tinta-fraca">
        A CLYON liga clientes a profissionais independentes. Quem executa o trabalho
        e emite a fatura é o profissional que escolher.
      </p>
    </main>
  );
}
