import type { Metadata } from "next";
import Link from "next/link";
import { Clock, FileText } from "lucide-react";
import { getSimulatorOrderByAcessoTokenHash } from "@/lib/db";
import { hashDeToken, verificarTokenDeAcesso } from "@/lib/pedido-acesso";
import { BUSINESS_PHONE } from "@/lib/seo-data";
import VistaDoPedido from "./VistaDoPedido";

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
  /*
   * A VISTA VIVE NOUTRO FICHEIRO, e a razão não é arrumação.
   *
   * O backoffice precisa de mostrar exactamente isto — "ver como o cliente" —
   * e não pode emitir um token para o fazer: cada token novo mata o anterior,
   * e o que o cliente tem na mão deixava de abrir por causa de uma
   * espreitadela. Duas cópias da vista divergiam ao primeiro texto mudado, e a
   * cópia do backoffice existe justamente para conferir o que o cliente vê.
   *
   * O que FICA aqui é o que só o link sabe fazer: provar o token, e dizer as
   * coisas certas quando ele já não abre nada.
   */
  return <VistaDoPedido pedido={pedido} token={token} />;
}
