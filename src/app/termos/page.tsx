import type { Metadata } from "next";
import Link from "next/link";

import { SITE_URL } from "@/lib/seo-data";
/*
 * OS NÚMEROS DA NEGOCIAÇÃO VÊM DO MOTOR, e não escritos aqui.
 *
 * Isto é um contrato. Dizia «cinco propostas» em texto corrido, e no dia em
 * que o limite passou a sete os termos ficaram a prometer uma coisa que o
 * site já não fazia — e os termos são o documento a que se recorre quando há
 * desacordo. Um número escrito à mão num contrato é uma promessa que ninguém
 * está a manter a par do código.
 */
import { MAX_PROPOSTAS_POR_EXTENSO } from "@/lib/negociacao";
import {
  ENTIDADE_QUE_FACTURA,
  IDENTIFICACAO,
  identificacaoCompleta,
  linhaDeIdentificacao,
  O_QUE_FALTA,
  TAXA_IVA,
} from "@/lib/identificacao-legal";
/*
 * OS TERMOS DE 01-10-2026 — «Publicar já», decisão do dono.
 *
 * Reescritos a partir de docs/proposta-termos-2026-09-30.md. Os números que
 * o site também usa vêm de onde o site os lê, pela mesma razão do comentário
 * de cima:
 *
 *   · a quota da CLYON (11 % do que o cliente paga) sai das taxas EM VIGOR,
 *     gravadas no backoffice (`taxasActuais` + `quotaDaClyon`) — como em
 *     /profissionais. Com as de origem (5 % e 6 %) dava 10,48 %;
 *   · a taxa do dinheiro sai de `taxasParaAForma`, que é o que a negociação
 *     grava quando o cliente escolhe pagar em notas;
 *   · o tecto do numerário, o prazo da confirmação automática, o IVA e quem
 *     emite a factura vêm das constantes que o resto do site lê.
 */
import { taxasActuais } from "@/lib/db";
import { quotaDaClyon } from "@/lib/quota-da-clyon";
import { MAXIMO_EM_NUMERARIO, taxasParaAForma } from "@/lib/forma-de-pagamento";
import { IVA_INCLUIDO_DESDE_POR_EXTENSO } from "@/lib/iva-incluido";
import { DIAS_ATE_LIBERTAR_SOZINHO } from "@/lib/trabalho";
import { DIAS_PARA_PAGAR_A_DIVIDA } from "@/lib/divida-do-profissional";

/** As taxas mudam no backoffice: a página relê-as de hora a hora. */
export const revalidate = 3600;

/** O prazo, em dias, para devolver o que o cliente pagou se cancelar antes do trabalho feito. */
const DIAS_PARA_DEVOLVER = 14;

export const metadata: Metadata = {
  // Sem « — CLYON»: o template do layout já a acrescenta, e saía
  // «Termos e Condições — CLYON | CLYON» (29-09-2026).
  title: "Termos e Condições",
  // Até 155 caracteres, o essencial primeiro e sem frases cortadas: o
  // Google mostra uns 155 e corta o resto a meio (29-09-2026).
  description:
    "Termos e condições da plataforma CLYON: o que a CLYON faz e não faz, pedidos e propostas, taxas, responsabilidades e direitos do consumidor.",
  alternates: { canonical: `${SITE_URL}/termos` },
  robots: { index: true, follow: true },
};

/** 0,1155 → «11,55 %»; 0,11 → «11 %». Duas casas, vírgula portuguesa. */
const pct = (n: number) => `${String(Math.round(n * 10000) / 100).replace(".", ",")} %`;

/** 3000 → «3 000 €». */
const eurosRedondos = (n: number) =>
  `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`;

/** Uma secção do documento, com âncora para o índice. */
function S({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-slate-200 pt-8">
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{titulo}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-700">{children}</div>
    </section>
  );
}

const INDICE: [string, string][] = [
  ["quem-somos", "1. Quem somos"],
  ["o-que-e", "2. O que a CLYON é — e o que não é"],
  ["quem-pode", "3. Quem pode usar a plataforma"],
  ["conta", "4. Conta e formas de entrar"],
  ["como-funciona", "5. Como funciona um pedido"],
  ["precos", "6. Preços, taxas e IVA"],
  ["pagamento", "7. Pagamento"],
  ["cancelamento", "7-A. Cancelamento e reembolso"],
  ["execucao", "8. Execução, confirmação e garantia"],
  ["avaliacoes", "9. Avaliações"],
  ["profissionais", "10. Se é profissional"],
  ["regras", "11. O que não é permitido"],
  ["suspensao", "12. Suspensão e encerramento de conta"],
  ["responsabilidade", "13. Responsabilidade"],
  ["resolucao", "14. Direito de livre resolução"],
  ["dados", "15. Dados pessoais"],
  ["alteracoes", "16. Alterações a estes termos"],
  ["litigios", "17. Reclamações, litígios e lei aplicável"],
];

export default async function TermosPage() {
  const taxas = await taxasActuais();
  const quota = pct(quotaDaClyon(taxas));
  // A taxa do dinheiro ANTES do IVA incluído — só para a frase de transição.
  const taxaNoDinheiro = pct(taxasParaAForma("dinheiro", taxas, "sem_iva").cliente);
  const iva = `${Math.round(TAXA_IVA * 100)} %`;

  return (
    <div className="min-h-screen bg-white">
      <section className="sob-o-menu relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(135deg,#ecfeff_0%,#ffffff_42%,#f8fafc_100%)]">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-24 sm:px-6 lg:px-8 lg:pb-16">
          <div className="inline-flex items-center rounded-full border border-cyan-200 bg-white/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-acao shadow-sm">
            Informação Legal
          </div>
          <h1 className="mt-5 max-w-4xl text-[2.4rem] font-bold leading-[1.05] tracking-tight text-slate-950 sm:text-[3.6rem]">
            Termos e Condições
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
            Estas condições regulam a utilização da plataforma CLYON. Explicam o
            que fazemos, o que não fazemos, e quem responde por cada coisa.
            Valem para clientes e para profissionais.
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Última atualização: 1 de outubro de 2026.
          </p>
        </div>
      </section>

      {!identificacaoCompleta() && (
        <div className="mx-auto mt-6 max-w-5xl px-4 sm:px-6 lg:px-8">
          <p className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-sm leading-relaxed text-red-800">
            <strong>Falta um dado obrigatório.</strong> {O_QUE_FALTA}{" "}
            Até lá, estes termos não cumprem integralmente o artigo 10.º do
            Decreto-Lei 7/2004.
          </p>
        </div>
      )}

      <section className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-acao">
            Navegação rápida
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {INDICE.map(([href, rotulo]) => (
              <a
                key={href}
                href={`#${href}`}
                className="text-sm text-slate-700 underline decoration-cyan-300 underline-offset-4 hover:text-acao-hover"
              >
                {rotulo}
              </a>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
        <S id="quem-somos" titulo="1. Quem somos">
          <p>
            A plataforma CLYON, acessível em clyon.pt, é operada por{" "}
            <strong>{linhaDeIdentificacao()}</strong>.
          </p>
          <p>
            Contactos: {IDENTIFICACAO.email} · {IDENTIFICACAO.telefone}.
          </p>
          <p>
            Actividade registada nas Finanças sob o CAE{" "}
            {IDENTIFICACAO.caePrincipal}, e{" "}
            {IDENTIFICACAO.caeSecundaria} como secundária. Operador de resíduos
            registado na Agência Portuguesa do Ambiente com o código{" "}
            <strong>{IDENTIFICACAO.codigoAPA}</strong>.
          </p>
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            A CLYON é uma actividade em nome individual e não uma sociedade.
            Quem contrata connosco está a contratar com uma pessoa singular com
            actividade aberta — dizemo-lo aqui porque é verdade e porque tem
            consequências que ninguém deve descobrir tarde.
          </p>
        </S>

        <S id="o-que-e" titulo="2. O que a CLYON é — e o que não é">
          <p>
            A CLYON <strong>liga clientes a profissionais independentes</strong>.
            Recebemos o que precisa de fazer, calculamos uma estimativa,
            mostramos o pedido aos profissionais que trabalham na sua zona e
            fazem esse tipo de serviço, e damos-lhe um sítio onde comparar as
            propostas e responder.
          </p>
          <p>
            <strong>
              O contrato de prestação de serviço é celebrado entre si e o
              profissional que escolher. A CLYON não é parte nesse contrato.
            </strong>{" "}
            Quem vai a sua casa, quem carrega, quem transporta e quem trata dos
            resíduos é o profissional. É ele o prestador do serviço, e é a ele
            que a lei atribui as obrigações correspondentes.
          </p>
          {/*
            QUEM FACTURA AO CLIENTE — 01-10-2026, decisão do dono.
            Dizia «quem emite a fatura é o profissional». Desde 22-09-2026 a
            factura ao cliente é da `ENTIDADE_QUE_FACTURA` (ver ponto 6).
          */}
          {/*
            HÁ FACTURA EM TODAS AS VENDAS — 01-10-2026, decisão do dono, com os
            preços passados a IVA incluído. Dizia «quando a pede».
          */}
          <p>
            A factura ao cliente é emitida pela{" "}
            {ENTIDADE_QUE_FACTURA.nomeLegal}, empresa parceira da CLYON, em todas
            as vendas — ver o ponto 6.
          </p>
          <p>
            O que contrata connosco é o acesso à plataforma e aos serviços que
            ela presta: a estimativa, a apresentação do pedido aos
            profissionais, o espaço de negociação, o registo do que foi
            combinado, o apoio ao longo do processo e, se escolher pagar pela
            plataforma, a guarda do valor até à confirmação do trabalho.
          </p>
          <p>
            A CLYON não seleciona o profissional por si, não garante que receba
            propostas, e não garante um preço — o preço resulta do que
            combinar com o profissional.
          </p>
        </S>

        <S id="quem-pode" titulo="3. Quem pode usar a plataforma">
          <p>
            Tem de ter <strong>18 anos ou mais</strong> e capacidade para
            contratar. Ao usar a plataforma declara que os dados que nos dá são
            verdadeiros e que são seus, ou que tem autorização de quem eles
            dizem respeito.
          </p>
          <p>
            Se pedir um serviço para casa de outra pessoa — de um familiar, de
            um inquilino, de um cliente seu — é a si que compete garantir que
            essa pessoa sabe e concorda, incluindo com a partilha da morada e do
            contacto com o profissional escolhido.
          </p>
        </S>

        <S id="conta" titulo="4. Conta e formas de entrar">
          <p>
            Pode pedir um orçamento sem conta. Para acompanhar as propostas e
            responder, há três caminhos: entrar com uma conta Google, receber um{" "}
            <strong>link de entrada por email</strong>, ou usar o link que lhe
            enviámos com o pedido.
          </p>
          <p>
            O link de entrada e o link do pedido{" "}
            <strong>são credenciais</strong>: quem os tiver acede à sua
            informação. Não os partilhe. O link de entrada dura 15 minutos e
            serve uma vez; o link do pedido acompanha a vida do pedido.
          </p>
          <p>
            É responsável pelo que acontece na sua conta. Se achar que alguém
            lhe acedeu, avise-nos para {IDENTIFICACAO.email} e nós fechamos o
            acesso.
          </p>
        </S>

        <S id="como-funciona" titulo="5. Como funciona um pedido">
          <ol className="ml-5 list-decimal space-y-2">
            <li>
              Descreve o que precisa: o serviço, a morada, as condições de
              acesso e, se quiser, fotografias. Quanto mais concreto, melhor a
              estimativa.
            </li>
            <li>
              A plataforma calcula uma <strong>estimativa</strong> a partir do
              que nos disse — volume, distância, andar, elevador,
              estacionamento. É uma previsão automática, não é um orçamento
              fechado, e pode mudar quando um profissional olhar para o caso.
            </li>
            <li>
              O pedido é mostrado aos profissionais elegíveis. Antes de o
              contratar, o profissional vê a zona, a descrição, as fotografias e
              o valor de partida — <strong>nunca a morada exata nem o seu
              contacto</strong>.
            </li>
            <li>
              Os profissionais respondem com propostas. Pode aceitar,
              contrapropor ou não responder. Cada lado tem{" "}
              {MAX_PROPOSTAS_POR_EXTENSO} propostas, e uma proposta fica de pé
              até alguém lhe responder.
            </li>
            <li>
              Quando aceita uma proposta, o trabalho fica fechado com esse
              profissional e as outras negociações do mesmo pedido terminam. É
              nesse momento — e só nesse — que a morada exata e o seu contacto
              passam a estar disponíveis para ele.
            </li>
          </ol>
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            Alguns pedidos chegam-nos por telefone ou por WhatsApp. Nesses casos
            é a CLYON que os regista na plataforma e que responde às propostas
            em nome do cliente, com o acordo dele. Fica registado quem o fez.
          </p>
        </S>

        <S id="precos" titulo="6. Preços, taxas e IVA">
          <p>
            <strong>A estimativa é automática e indicativa.</strong> Sai de um
            cálculo sobre o que nos descreveu e não substitui a avaliação de
            quem vai fazer o trabalho.
          </p>
          {/*
            PREÇOS — 01-10-2026, decisão do dono. Dizia «5 % somados ao cliente
            e 6 % descontados ao profissional» e «o IVA é do regime de quem
            emite a fatura». Desde 29-09-2026 o cliente vê um preço só, já com
            a taxa, e a CLYON fica com 11 % do que ele paga; o IVA só entra com
            factura, e quem factura é a parceira.
          */}
          {/*
            IVA INCLUÍDO — 01-10-2026, decisão do dono: "o cliente vê um número
            só por proposta, já com a taxa da CLYON e com 23 % de IVA", e há
            factura em todas as vendas (com NIF, se o cliente o quiser na
            factura). O profissional continua a propor sem IVA; a quota da CLYON
            conta-se sobre o valor sem IVA, como antes. A frase de transição é
            a que o dono escreveu — a data vem de `IVA_INCLUIDO_DESDE`.
          */}
          <p>
            <strong>
              O preço de cada proposta é o que o cliente paga pelo trabalho, com
              IVA incluído, e já inclui a taxa de plataforma da CLYON.
            </strong>{" "}
            O profissional propõe o seu valor sem IVA; ao cliente é apresentado
            esse valor com a taxa de plataforma e com IVA à taxa de {iva}. A CLYON
            fica com {quota} do que o cliente paga sem IVA, e o profissional
            recebe o valor que propôs, descontada a comissão. No pagamento em
            dinheiro, a divisão é a descrita no ponto 7.
          </p>
          <p>
            <strong>Há factura em todas as vendas.</strong> É emitida pela{" "}
            {ENTIDADE_QUE_FACTURA.nomeLegal}, NIF {ENTIDADE_QUE_FACTURA.nif},
            empresa parceira da CLYON, com o NIF do cliente se ele o indicar, ou
            como consumidor final.
          </p>
          <p>
            Os preços de referência apresentados no site (por exemplo, «desde»)
            são indicativos e sem IVA. Na proposta, o preço já vem com IVA
            incluído.
          </p>
          <p>
            Para pedidos com negociação aberta antes de {IVA_INCLUIDO_DESDE_POR_EXTENSO}{" "}
            aplica-se o regime anterior: preço sem IVA e IVA só com factura.
          </p>
          <p>
            A CLYON não liquida IVA. Regime de IVA da CLYON:{" "}
            <strong>{IDENTIFICACAO.regimeIva}</strong>.
          </p>
        </S>

        {/*
          PAGAMENTO — 01-10-2026, decisão do dono. Dizia «o pagamento do
          serviço é feito ao profissional… a CLYON não recebe nem detém o valor
          do serviço», e «se precisa de fatura… só lhe propomos profissionais
          que a possam passar». Nenhuma das duas é verdade: há duas formas de
          pagar (`forma-de-pagamento.ts`), numa delas a CLYON guarda o valor, e
          quem factura é a parceira — não há profissionais a filtrar.
        */}
        <S id="pagamento" titulo="7. Pagamento">
          <p>No pedido, o cliente escolhe como paga:</p>
          <ul className="ml-5 list-disc space-y-3">
            <li>
              <strong>Pela plataforma.</strong> Depois de aceitar a proposta,
              recebe uma referência MB WAY ou Multibanco, processada pelo
              euPago, para pagar à CLYON. A CLYON guarda o valor e só o entrega
              ao profissional depois de o cliente confirmar que o trabalho está
              feito (ou de o trabalho se considerar confirmado, nos termos do
              ponto 8). O profissional pede então o levantamento, que é tratado
              em menos de 24 horas.
            </li>
            <li>
              <strong>Em dinheiro, ao profissional, no fim do trabalho.</strong>{" "}
              Paga-lhe em mão o preço da proposta, com IVA incluído, e não paga
              mais nada à parte. O profissional entrega depois à CLYON o IVA e a
              comissão da plataforma, por referência MB WAY ou Multibanco gerada
              quando o trabalho é confirmado. Não é possível pagar em dinheiro
              trabalhos de valor igual ou superior a{" "}
              {eurosRedondos(MAXIMO_EM_NUMERARIO)} (Lei n.º 92/2017).
            </li>
          </ul>
          {/*
            O DINHEIRO ANTES DO IVA INCLUÍDO — o regime de 21-09-2026, que
            continua a valer para as negociações abertas antes do corte.
          */}
          <p>
            Nas negociações abertas antes de {IVA_INCLUIDO_DESDE_POR_EXTENSO}, o
            pagamento em dinheiro segue o regime anterior: o cliente paga em mão
            ao profissional o valor que ele propôs e paga à CLYON, por
            referência, a comissão da plataforma ({taxaNoDinheiro} sobre o valor
            do profissional).
          </p>
        </S>

        {/*
          CANCELAMENTO E REEMBOLSO — novo a 01-10-2026, decisão do dono: o
          prazo da devolução é de 14 dias.

          O que o código faz (`cancelamento.ts`, `oQueSeDesfaz`): o cancelamento
          passa sempre, e com trabalho contratado pede o motivo. Se o trabalho
          já estiver confirmado (`confirmadoEm`, à mão ou pelo prazo do ponto
          8) ou pago, o aviso diz que cancelar NÃO traz o pagamento de volta.
          A devolução não é automática: faz-se no euPago, e o aviso de
          reembolso que ele manda grava o pagamento como `reembolsado`
          (`darPorReembolsado`).
        */}
        <S id="cancelamento" titulo="7-A. Cancelamento e reembolso">
          <p>
            Pode cancelar o pedido a qualquer momento, na página do pedido. Se
            já tiver contratado um profissional, pedimos-lhe que diga porquê: o
            profissional que perde o trabalho tem direito a saber.
          </p>
          <p>
            <strong>
              Se o pedido for cancelado antes de o trabalho estar feito, o que
              tiver pago à CLYON é-lhe devolvido pelo mesmo meio, no prazo de{" "}
              {DIAS_PARA_DEVOLVER} dias.
            </strong>
          </p>
          <p>
            Depois de o trabalho estar confirmado — por si, ou automaticamente
            nos termos do ponto 8 — o valor é entregue ao profissional e deixa
            de poder ser devolvido pela CLYON; cancelar o pedido a partir daí
            não o traz de volta. Qualquer reclamação sobre o trabalho segue os
            pontos 8 e 17.
          </p>
        </S>

        <S id="execucao" titulo="8. Execução, confirmação e garantia">
          {/*
            A CONFIRMAÇÃO AUTOMÁTICA — 01-10-2026, decisão do dono: fica, e fica
            escrita. O prazo é `DIAS_ATE_LIBERTAR_SOZINHO` (trabalho.ts) e conta
            a partir de `execucaoEnviadaEm` — o momento em que o profissional
            marca o trabalho como feito, com pelo menos uma fotografia. O cron
            `libertar-por-prazo` grava então a confirmação.
          */}
          <p>
            O serviço é executado pelo profissional, na data e nas condições que
            combinarem. Terminado o trabalho, o profissional marca-o como feito
            e envia fotografias do resultado; pede-se-lhe então que confirme que
            está feito.
          </p>
          <p>
            <strong>
              Se não responder, o trabalho considera-se confirmado{" "}
              {DIAS_ATE_LIBERTAR_SOZINHO} dias depois de o profissional enviar as
              fotografias
            </strong>
            {" "}— e, no pagamento pela plataforma, o valor é entregue ao
            profissional. Se alguma coisa estiver mal, fale connosco antes
            disso.
          </p>
          <p>
            <strong>A garantia do serviço é do profissional.</strong> Se alguma
            coisa correr mal — dano, atraso, trabalho por acabar — fale primeiro
            com ele. Se não chegarem a acordo, escreva-nos para{" "}
            {IDENTIFICACAO.email}: temos o registo do que foi combinado e
            ajudamos a resolver, dentro do que nos é possível enquanto
            intermediários.
          </p>
          <p>
            O histórico da negociação — quem propôs o quê, quando, e o que
            aconteceu a cada proposta — fica guardado e visível para os dois
            lados. É deliberado: é para o dia em que houver desacordo.
          </p>
        </S>

        <S id="avaliacoes" titulo="9. Avaliações">
          <p>
            Depois de confirmar um trabalho pode avaliar o profissional de 1 a 5
            estrelas e deixar um comentário. As avaliações são{" "}
            <strong>anónimas para o profissional</strong>: ele vê a nota e o
            texto, não vê quem os escreveu.
          </p>
          <p>
            Escreva o que é verdade. Não publicamos, e podemos remover,
            avaliações com insultos, dados pessoais de terceiros, ou que não
            digam respeito a um trabalho realmente feito.
          </p>
        </S>

        <S id="profissionais" titulo="10. Se é profissional">
          <p>
            A inscrição é gratuita e sujeita a aprovação. Ao inscrever-se,
            declara que exerce a actividade por conta própria, que está
            regularizado perante as Finanças e a Segurança Social, e que tem os
            meios e as autorizações necessárias ao que se propõe fazer —
            incluindo, quando aplicável, registo de transportador de resíduos e
            guia de acompanhamento.
          </p>
          <p>
            <strong>Não existe qualquer relação laboral com a CLYON.</strong>{" "}
            Não há subordinação, horário nem exclusividade. Escolhe que pedidos
            aceita, propõe os seus preços e organiza o seu trabalho. A CLYON não
            lhe garante volume de trabalho.
          </p>
          {/*
            COMO O PROFISSIONAL RECEBE — 01-10-2026, decisão do dono. Dizia
            «emite a fatura… a CLYON fatura-lhe apenas a comissão de 6 %»: a
            factura ao cliente é da parceira, e a comissão depende das taxas da
            negociação. Não se diz aqui que documento ele passa à CLYON.
          */}
          <p>
            É o prestador do serviço perante o cliente: responde pela execução e
            pelos danos e cumpre as obrigações fiscais que lhe correspondem.
            Recebe através da CLYON o valor que propôs, descontada a comissão —
            ou em dinheiro, no local, quando o cliente escolhe essa forma de
            pagamento: nesse caso recebe do cliente o preço com IVA incluído e
            entrega à CLYON, por referência, o IVA e a comissão.
          </p>
          {/*
            A DÍVIDA DOS TRABALHOS EM DINHEIRO — 01-10-2026, decisão do dono:
            «abater no saldo + bloquear». Está aqui antes de se aplicar a
            alguém, porque reserva saldo e restringe trabalho.
          */}
          <p>
            Esse valor paga-se no prazo de {DIAS_PARA_PAGAR_A_DIVIDA} dias depois
            de o trabalho estar confirmado. Enquanto não estiver pago, fica
            reservado no seu saldo disponível e pode ser abatido no levantamento
            seguinte; passado o prazo, deixa de poder aceitar ou propor em
            trabalhos pagos em dinheiro até a dívida estar paga.
          </p>
          <p>
            Os dados do cliente que lhe são mostrados destinam-se{" "}
            <strong>exclusivamente</strong> a executar aquele trabalho. Não os
            pode usar para outro fim, guardar depois de concluído, nem passar a
            terceiros. Contactar clientes da plataforma para trabalhos fora dela
            é motivo de encerramento da conta.
          </p>
          {/*
            OS AVISOS NO WHATSAPP — 20-09-2026.

            Está escrito aqui porque o telemóvel dele foi recolhido na inscrição
            como contacto de trabalho, e usá-lo para lhe mandar mensagens é uma
            finalidade nova. O que torna isto defensável não é este parágrafo: é
            o facto de nascer desligado e de ser ele a ligá-lo. O parágrafo só
            diz, por escrito e antes de acontecer, o que ele vai poder ligar.
          */}
          <p>
            Avisamo-lo por email quando um pedido lhe é enviado. Se quiser,
            pode activar no seu painel o aviso por <strong>WhatsApp</strong> —
            uma mensagem por pedido, com a localidade, o que o cliente descreveu
            e quanto receberia. Não é publicidade e não lhe mandamos mais nada
            por esse meio. Fica desligado até ser o próprio a ligá-lo, e desliga-o
            no painel ou respondendo <strong>parar</strong> a qualquer uma dessas
            mensagens.
          </p>
        </S>

        <S id="regras" titulo="11. O que não é permitido">
          <ul className="ml-5 list-disc space-y-2">
            <li>Dar dados falsos, ou usar os dados de outra pessoa.</li>
            <li>
              Pedir ou propor serviços ilegais, ou o transporte de resíduos sem
              as autorizações exigidas por lei.
            </li>
            <li>
              Recolher dados de outros utilizadores da plataforma, por qualquer
              meio automático ou manual.
            </li>
            <li>
              Usar a plataforma para publicidade, spam, ou para contactar
              pessoas por razões alheias ao pedido em causa.
            </li>
            <li>
              Tentar aceder a partes da plataforma que não lhe são destinadas,
              ou perturbar o seu funcionamento.
            </li>
            <li>
              Combinar por fora um trabalho que chegou pela plataforma, para
              evitar a taxa.
            </li>
          </ul>
        </S>

        <S id="suspensao" titulo="12. Suspensão e encerramento de conta">
          <p>
            Pode encerrar a sua conta quando quiser, sem custo, pedindo-o por{" "}
            {IDENTIFICACAO.email}. Os pedidos e as facturas associados continuam
            guardados enquanto a lei nos obrigar a guardá-los.
          </p>
          <p>
            Podemos suspender ou encerrar uma conta que infrinja estes termos ou
            a lei. Dizemos-lhe porquê e pode contestar por escrito, salvo se a
            lei nos impedir de o comunicar. As medidas serão proporcionais ao
            que as motivou.
          </p>
        </S>

        <S id="responsabilidade" titulo="13. Responsabilidade">
          <p>
            A CLYON responde pelos serviços que presta — a plataforma, a
            estimativa, a apresentação do pedido, o registo da negociação — nos
            termos da lei.
          </p>
          <p>
            <strong>
              Não respondemos pela execução do serviço nem pelos danos causados
              durante a sua prestação
            </strong>
            , que são da responsabilidade do profissional que o executa. Também
            não respondemos pela veracidade do que cada utilizador declara sobre
            si.
          </p>
          <p>
            Não garantimos que a plataforma esteja sempre disponível. Fazemos o
            possível por avisar de interrupções previstas.
          </p>
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            Nada nestes termos afasta os direitos que a lei lhe dá enquanto
            consumidor. Se alguma cláusula for contrária a uma norma imperativa,
            vale a norma e não a cláusula, e o resto do documento mantém-se.
          </p>
        </S>

        <S id="resolucao" titulo="14. Direito de livre resolução">
          <p>
            Se é consumidor e contratou à distância, tem{" "}
            <strong>14 dias</strong> para desistir sem indicar motivo,
            contados da celebração do contrato (Decreto-Lei 24/2014).
          </p>
          <p>
            Quanto ao serviço prestado pelo profissional, esse direito exerce-se
            perante ele. Se pedir expressamente que o serviço comece dentro dos
            14 dias e ele for integralmente prestado nesse período, o direito de
            livre resolução extingue-se; se for prestado em parte, pode ter de
            pagar a parte já executada.
          </p>
          <p>
            Quanto à utilização da plataforma, basta encerrar a conta.
          </p>
        </S>

        <S id="dados" titulo="15. Dados pessoais">
          <p>
            Como tratamos os seus dados está na{" "}
            <Link
              href="/privacidade"
              className="font-semibold text-acao underline underline-offset-4"
            >
              Política de Privacidade
            </Link>
            , e o que guardamos no seu dispositivo está na{" "}
            <Link
              href="/cookies"
              className="font-semibold text-acao underline underline-offset-4"
            >
              Política de Cookies
            </Link>
            .
          </p>
          <p>
            Uma nota que pertence aqui: quando contrata um profissional, a
            morada e o contacto passam a estar com ele.{" "}
            <strong>
              A partir desse momento o profissional é responsável autónomo pelos
              dados que recebe
            </strong>{" "}
            e responde por eles perante si.
          </p>
        </S>

        <S id="alteracoes" titulo="16. Alterações a estes termos">
          <p>
            Podemos alterar estes termos. Se a alteração for relevante,
            avisamos com pelo menos 30 dias de antecedência por email ou na
            plataforma. Se não concordar, pode encerrar a conta sem custo.
          </p>
          <p>
            As alterações não se aplicam retroactivamente a trabalhos já
            fechados.
          </p>
        </S>

        <S id="litigios" titulo="17. Reclamações, litígios e lei aplicável">
          <p>
            Fale connosco primeiro: {IDENTIFICACAO.email}. Respondemos a todas
            as reclamações.
          </p>
          <p>
            Tem também à sua disposição o{" "}
            <a
              href={IDENTIFICACAO.livroDeReclamacoes}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-acao underline underline-offset-4"
            >
              Livro de Reclamações electrónico
            </a>
            .
          </p>
          <p>
            Em caso de litígio de consumo, pode recorrer à{" "}
            <a
              href={IDENTIFICACAO.ralSite}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-acao underline underline-offset-4"
            >
              {IDENTIFICACAO.ralNome}
            </a>
            , nos termos da Lei 144/2015.
            {/*
              Saiu «ou à plataforma europeia de resolução de litígios em linha»
              — 01-10-2026, decisão do dono. A plataforma ODR da UE foi encerrada
              a 20-07-2025 (Regulamento (UE) 2024/3228).
            */}
          </p>
          <p>
            Aplica-se a lei portuguesa. Sendo consumidor, mantém o direito de
            recorrer ao tribunal do seu domicílio.
          </p>
        </S>
      </div>
    </div>
  );
}
