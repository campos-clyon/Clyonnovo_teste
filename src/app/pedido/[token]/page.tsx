import type { Metadata } from "next";
import { lerBase, avisoDaBase } from "@/lib/base-do-preco";
import Link from "next/link";
import { Camera, MapPin, Clock, FileText, Truck } from "lucide-react";
import { getSimulatorOrderByAcessoTokenHash, negociacoesDoPedido } from "@/lib/db";
import { hashDeToken, verificarTokenDeAcesso } from "@/lib/pedido-acesso";
import { BUSINESS_PHONE } from "@/lib/seo-data";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import type { Proposta } from "@/lib/negociacao";
import { faseDoTrabalho, diasAteLibertar } from "@/lib/trabalho";
import Nota from "@/components/Nota";
import PropostasRecebidas from "./PropostasRecebidas";
import { perfilPublicoDoProfissional } from "@/lib/perfil-publico-do-profissional";

/**
 * O pedido, aberto pelo link.
 *
 * Sem conta e sem palavra-passe — obrigar alguém a registar-se antes de ver o
 * próprio pedido é onde se perdem clientes. Convida-se a criar conta em todos
 * os ecrãs, nunca se obriga.
 *
 * O que esta página NÃO faz, de propósito:
 *
 *   · não é indexável. Um pedido no Google com morada e telefone dentro seria
 *     uma fuga de dados pessoais feita por nós;
 *   · não explica a plataforma em caixas fixas. As explicações estão em notas
 *     que se abrem — num telemóvel, cada parágrafo permanente empurra os
 *     botões para fora do ecrã.
 */

export const metadata: Metadata = {
  title: "O seu pedido — CLYON",
  robots: { index: false, follow: false },
};

// O token muda a cada pedido: nada aqui pode ser gerado à partida nem servido
// de cache partilhada.
export const dynamic = "force-dynamic";

const URGENCIA: Record<string, string> = {
  today: "Hoje",
  tomorrow: "Amanhã",
  this_week: "Esta semana",
  flexible: "Sem pressa",
};

function euros(valor: unknown): string | null {
  const n = typeof valor === "string" ? Number(valor) : typeof valor === "number" ? valor : NaN;
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2).replace(".", ",") + " €";
}

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

export default async function PaginaDoPedido({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const pedido = await getSimulatorOrderByAcessoTokenHash(hashDeToken(token));
  const resultado = verificarTokenDeAcesso(
    token,
    pedido?.acessoTokenHash ?? null,
    pedido?.acessoTokenExpiraEm ?? null,
  );

  /*
   * O LINK QUE JÁ NÃO ABRE NADA — e que até aqui dava um 404 genérico.
   *
   * Dizia "A página que procura não existe ou foi movida". A pessoa tem o
   * email aberto ao lado, com o link lá dentro, mandado por nós. Dizer-lhe que
   * a página nunca existiu põe-na a duvidar de si — ou de nós — e deixa-a sem
   * saída nenhuma, porque o 404 do site não tem contacto de apoio.
   *
   * E isto vai deixar de ser raro: os pedidos são apagados 60 dias depois de
   * criados. Daqui a dois meses, TODOS os links antigos caem aqui.
   *
   * PORQUE É QUE NÃO DIZ QUAL ERA O PEDIDO
   *
   * Não dá para saber, e é de propósito. O registo permanente guarda o que se
   * passou, mas não guarda o hash do token — seria manter viva a credencial de
   * um recurso que já não existe, para nada.
   *
   * E MOSTRA O MESMO A QUEM ADIVINHA TOKENS
   *
   * Um pedido apagado e um token inventado dão exactamente este ecrã. Se
   * dessem ecrãs diferentes, quem fosse tentando à sorte ficava a saber quais
   * dos seus palpites acertaram num pedido real. A diferença entre os dois não
   * vale nada a quem tem o link certo, e valia demasiado a quem não tem.
   *
   * O link expirado continua a ter ecrã próprio, mais abaixo: esse já provou
   * que o token confere, e a diferença é-lhe útil.
   */
  if (!pedido || (!resultado.valido && resultado.motivo !== "expirado")) {
    const numeroWhatsapp = BUSINESS_PHONE.replace(/[^\d]/g, "");
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md items-center px-4">
        <div className="w-full rounded-2xl border border-[#E2EEF3] bg-white p-6 text-center">
          <FileText className="mx-auto h-8 w-8 text-tinta-fraca" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-bold text-tinta">Este link já não abre nenhum pedido</h1>
          <p className="mt-2 text-sm leading-relaxed text-tinta-fraca">
            Os pedidos são apagados 60 dias depois de criados, e este pode ter
            passado esse prazo ou ter sido removido a pedido. O link também pode
            ter vindo partido do email.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-tinta-fraca">
            Se estava à espera de encontrar aqui um pedido, diga-nos — conseguimos
            confirmar o que aconteceu.
          </p>

          <div className="mt-5 flex flex-col gap-2.5">
            <a
              href={`https://wa.me/${numeroWhatsapp}?text=${encodeURIComponent(
                "Olá! O link do meu pedido já não abre. Podem verificar?",
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-whatsapp-tinta"
            >
              Falar connosco por WhatsApp
            </a>
            <Link
              href="/contactos"
              className="inline-flex items-center justify-center rounded-xl border border-[#E2EEF3] px-5 py-3 text-sm font-semibold text-tinta"
            >
              Outras formas de contacto
            </Link>
            <Link
              href="/simulador"
              className="py-2 text-sm text-tinta-fraca underline underline-offset-4 hover:text-acao"
            >
              Fazer um pedido novo
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!resultado.valido) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md items-center px-4">
        <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <Clock className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-bold text-amber-900">Este link expirou</h1>
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            Os links de acesso duram 30 dias, por segurança. Fale connosco e enviamos
            um novo para o mesmo email.
          </p>
          <Link
            href="/contactos"
            className="mt-4 inline-flex rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Pedir novo link
          </Link>
        </div>
      </main>
    );
  }

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
  const linhas = await negociacoesDoPedido(pedido.id);
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
  const desejado = euros(pedido.valorDesejadoCliente);
  // O que o valor MEDE: o trabalho todo, ou cada carga. Ver `base-do-preco.ts`.
  const base = lerBase((pedido as { baseDoPreco?: string | null }).baseDoPreco);
  const estimativa = euros(pedido.estimateTotal ?? pedido.estimateMax);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-tinta-fraca">
          Pedido #{pedido.id}
        </span>
        <h1 className="mt-1 text-2xl font-bold text-tinta sm:text-3xl">{servico}</h1>
      </header>

      <PropostasRecebidas token={token} negociacoesIniciais={negociacoesDoCliente} />

      {/* Criar conta: convida, nunca obriga — e deixa de convidar quando
          fecham a nota. Repetir o convite a cada visita é insistência. */}
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

      <section className="mt-4 rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-tinta-fraca">
          Os valores
        </h2>

        <div className="mt-3 space-y-3">
          {desejado && (
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-slate-600">
                O valor que indicou
                <span className="block text-xs text-tinta-fraca">
                  {base === "carga" ? "por cada carga" : "pelo trabalho todo"} · sem IVA
                </span>
              </span>
              <span className="text-lg font-bold text-tinta">{desejado}</span>
            </div>
          )}

          {/*
            O AVISO DA CARGA, e só quando o preço é por carga.
            Um «150 €» sem unidade tanto é o trabalho inteiro como cada viagem
            ao aterro — e a diferença só aparece no fim, com o trabalho feito.
          */}
          {avisoDaBase(base) && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold leading-relaxed text-amber-900">
              {avisoDaBase(base)}
            </p>
          )}

          {estimativa && (
            <div className="flex items-baseline justify-between gap-4 border-t border-slate-100 pt-3">
              <span className="text-sm text-slate-600">A nossa estimativa</span>
              <span className="text-lg font-semibold text-acao">{estimativa}</span>
            </div>
          )}

          <Nota titulo="De onde vêm estes números">
            O valor que indicou é o ponto de partida: é o que os profissionais
            veem quando o pedido lhes chega, e a partir dele fazem propostas. A
            estimativa é nossa, é informativa e não muda nada — serve de
            referência antes das propostas. Quem decide o preço são vocês os
            dois.
          </Nota>
        </div>
      </section>

      <p className="mt-6 text-center text-xs leading-relaxed text-tinta-fraca">
        A CLYON liga clientes a profissionais independentes. Quem executa o trabalho
        e emite a fatura é o profissional que escolher.
      </p>
    </main>
  );
}
