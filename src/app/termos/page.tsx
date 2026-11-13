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
  EMPRESA_PARCEIRA_AO_PUBLICO,
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
/*
 * OS TERMOS DE 12-11-2026 (d5 e d6, Jurídico; CEO e dono). Os números do modelo
 * de 02–11/11 vêm das mesmas constantes que o site lê: a transferência
 * (`LIMITE_DA_TRANSFERENCIA`), as mudanças pela lista (`MAXIMO_DE_ESCOLHIDOS`,
 * o prazo de `prazo-de-resposta-do-parceiro.ts`, `TAXA_DAS_MUDANCAS`, a ordem
 * `ORDENACAO.frase`) e a guia de resíduos (`GUIA_NOS_TERMOS`).
 * `termos-12-11.test.ts` exige-as aqui.
 */
import { LIMITE_DA_TRANSFERENCIA } from "@/lib/transferencia-bancaria";
import { DEIXAR_A_CLYON_ESCOLHER, MAXIMO_DE_ESCOLHIDOS, ORDENACAO } from "@/lib/lista-de-parceiros-da-mudanca";
import { HORAS_PARA_RESPONDER, JANELA_DE_RESPOSTA } from "@/lib/prazo-de-resposta-do-parceiro";
import { SAIDAS_DO_CLIENTE } from "@/lib/escolhidos-sem-resposta";
import { TAXA_DAS_MUDANCAS_EM_PONTOS } from "@/lib/taxas-plataforma";
import { TEXTOS_DOS_PRECOS_DAS_MUDANCAS } from "@/lib/precos-das-mudancas-do-profissional";
import { SELO_DO_CARTAO } from "@/lib/parceiro-verificado";
import { GUIA_NOS_TERMOS } from "@/lib/guia-de-residuos";
/*
 * OS TERMOS DE 15-11-2026 — d10 (Jurídico; CEO e dono): o cliente paga ao
 * parceiro, duas faturas, nada pago à CLYON, valor em atraso e stand-by.
 * Mostram-se só a partir da data (`novoModeloEmVigor`, o mesmo interruptor do
 * resto do site; a página relê-se de hora a hora). Antes da data a página é a de
 * 12-11-2026, tal e qual. O texto antigo não se apaga: passa para a caixa
 * `RegrasAnteriores`, porque continua a valer para os trabalhos já pagos à
 * CLYON antes da data (o corte do código, `CORTE_DO_MODELO`).
 * `termos-15-11.test.ts` desenha a página nos dois lados da data.
 */
import {
  DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO,
  IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO,
  PAGAMENTO_AO_PARCEIRO_DESDE_POR_EXTENSO,
  VERSAO_DOS_TERMOS_POR_EXTENSO,
  novoModeloEmVigor,
} from "@/lib/novo-modelo";
import { agoraDoModelo } from "@/lib/relogio-do-modelo";
import { RegrasAnteriores } from "@/components/RegrasAnteriores";

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
  ["mudancas-com-lista", "5-A. Mudanças com a lista de parceiros"],
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
  // O modelo de 15-11-2026 (d10): o texto novo só a partir da data.
  const novo = novoModeloEmVigor(agoraDoModelo());

  return (
    <div className="min-h-screen bg-white">
      <section className="sob-o-menu relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(135deg,#ecfeff_0%,#ffffff_42%,#f8fafc_100%)]">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-24 sm:px-6 lg:px-8 lg:pb-16">
          <h1 className="max-w-4xl text-[2.4rem] font-bold leading-[1.05] tracking-tight text-slate-950 sm:text-[3.6rem]">
            Termos e Condições
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
            Estas condições regulam a utilização da plataforma CLYON. Explicam o
            que fazemos, o que não fazemos, e quem responde por cada coisa.
            Valem para clientes e para parceiros.
          </p>
          {/* A data acompanha a última mudança do texto: 12-11-2026 (d5 e d6: a
              transferência, as mudanças pela lista, a dívida em partes, o
              «verificado», a ordem da lista e a guia de resíduos). */}
          {novo ? (
            <p className="mt-3 text-sm text-slate-500">
              Versão de {VERSAO_DOS_TERMOS_POR_EXTENSO}. Em vigor desde{" "}
              {PAGAMENTO_AO_PARCEIRO_DESDE_POR_EXTENSO}: é a partir desse dia que
              valem as regras de pagamento e de faturação dos pontos 6, 7, 7-A e 10.
              Os trabalhos já pagos à CLYON antes dessa data, os que nessa data já
              estavam concluídos e os trabalhos de valor fixo combinados com a CLYON
              continuam com as regras anteriores, até ao fim. Conta também como pago
              antes dessa data o trabalho cuja referência Multibanco da CLYON foi
              emitida antes dela e é paga antes de a referência expirar. Essas regras
              mantêm-se escritas nesses pontos.
            </p>
          ) : (
          <p className="mt-3 text-sm text-slate-500">
            Última atualização: 12 de novembro de 2026.
          </p>
          )}
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
            A CLYON <strong>liga clientes a parceiros independentes</strong>.
            Recebemos o que precisa de fazer, calculamos uma estimativa,
            mostramos o pedido aos parceiros que trabalham na sua zona e
            fazem esse tipo de serviço, e damos-lhe um sítio onde comparar as
            propostas e responder.
          </p>
          {/*
            O QUE É UM PARCEIRO — 01-11-2026 (Jurídico; decisão do dono). A
            palavra nomeia quem faz o serviço; quem passa a fatura é outra
            entidade e continua a chamar-se «empresa parceira» (a constante).
          */}
          <p>
            Neste documento, «parceiro» é a pessoa ou a empresa, independente
            da CLYON, inscrita e aprovada na plataforma, que presta o serviço ao
            cliente. Os parceiros não são sócios, agentes nem trabalhadores da
            CLYON e não agem em nome dela. Cada parceiro declara que é
            profissional na acepção da lei de defesa do consumidor, pelo que,
            perante ele, o cliente tem os direitos que essa lei lhe dá. A{" "}
            {EMPRESA_PARCEIRA_AO_PUBLICO}, que passa a fatura, é uma entidade
            diferente: não é o parceiro e não presta o serviço.
          </p>
          <p>
            <strong>
              O contrato de prestação de serviço é celebrado entre si e o
              parceiro que escolher. A CLYON não é parte nesse contrato.
            </strong>{" "}
            Quem vai a sua casa, quem carrega, quem transporta e quem trata dos
            resíduos é o parceiro. É ele o prestador do serviço, e é a ele
            que a lei atribui as obrigações correspondentes.
          </p>
          {/*
            QUEM FACTURA AO CLIENTE — 01-10-2026, decisão do dono.
            Dizia «quem emite a fatura é o profissional». Desde 22-09-2026 a
            factura ao cliente é da empresa parceira (ver ponto 6).
          */}
          {/*
            HÁ FACTURA EM TODAS AS VENDAS — 01-10-2026, decisão do dono, com os
            preços passados a IVA incluído. Dizia «quando a pede».
            SEM O NOME DA PARCEIRA — 26-10-2026, decisão do dono: ela não se
            expõe ao público; o nome vai só na factura que o cliente recebe.
          */}
          {novo ? (
            <>
              <p>
                Cada trabalho tem duas faturas: a da taxa da plataforma, emitida
                pela {EMPRESA_PARCEIRA_AO_PUBLICO} (que não é o parceiro que faz
                o serviço), e a do trabalho, emitida pelo parceiro — ver o ponto 6.
              </p>
              <p>
                O que contrata connosco é o acesso à plataforma e aos serviços que
                ela presta: a estimativa, a apresentação do pedido aos parceiros,
                o espaço de negociação, o registo do que foi combinado, o apoio ao
                longo do processo e a fatura da taxa da plataforma.{" "}
                <strong>O dinheiro do trabalho não passa pela CLYON:</strong> paga-o
                diretamente ao parceiro que contratou (ponto 7).
              </p>
            </>
          ) : (
          <>
          <p>
            A fatura ao cliente é emitida pela {EMPRESA_PARCEIRA_AO_PUBLICO}
            (que não é o parceiro que faz o serviço), em todas as vendas — ver
            o ponto 6.
          </p>
          <p>
            O que contrata connosco é o acesso à plataforma e aos serviços que
            ela presta: a estimativa, a apresentação do pedido aos
            parceiros, o espaço de negociação, o registo do que foi
            combinado, o apoio ao longo do processo e, se escolher pagar pela
            plataforma, a guarda do valor até à confirmação do trabalho.
          </p>
          </>
          )}
          {/*
            A EXCEPÇÃO — 12-11-2026 (d6). Confirmado no código: «Deixar a CLYON
            escolher por mim» salta a lista e o pedido segue o caminho de
            sempre — a equipa revê-o e envia-o aos parceiros elegíveis da zona,
            que respondem com propostas, e é o cliente quem aceita uma
            (SimulatorThreePhaseForm.tsx, onSemLista; api/simulador/pedido). «Pedir
            à CLYON que procure» envia-o a mais parceiros (DEPOIS_DE_CADA_SAIDA).
          */}
          <p>
            A CLYON não seleciona o parceiro por si, salvo quando o cliente nos
            pede que o façamos. Numa mudança, com «{DEIXAR_A_CLYON_ESCOLHER}», a
            equipa da CLYON revê o pedido e escolhe a que parceiros da zona o
            mostra; com «{SAIDAS_DO_CLIENTE.pedirAClyon}», envia-o a mais
            parceiros. Também nesses casos é o cliente quem aceita a proposta. A
            CLYON não garante que receba propostas, e não garante um preço — o
            preço resulta do que combinar com o parceiro.
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
            contacto com o parceiro escolhido.
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
              fechado, e pode mudar quando um parceiro olhar para o caso.
            </li>
            <li>
              O pedido é mostrado aos parceiros elegíveis. Antes de o
              contratar, o parceiro vê a zona, a descrição, as fotografias e
              o valor de partida — <strong>nunca a morada exata nem o seu
              contacto</strong>.
            </li>
            <li>
              Os parceiros respondem com propostas. Pode aceitar,
              contrapropor ou não responder. Cada lado tem{" "}
              {MAX_PROPOSTAS_POR_EXTENSO} propostas, e uma proposta fica de pé
              até alguém lhe responder.
            </li>
            <li>
              Quando aceita uma proposta, o trabalho fica fechado com esse
              parceiro e as outras negociações do mesmo pedido terminam. É
              nesse momento — e só nesse — que a morada exata e o seu contacto
              passam a estar disponíveis para ele{novo ? (
                <>
                  , e que o IBAN e o número MB WAY do parceiro passam a estar
                  disponíveis para si, para lhe pagar (ponto 7).
                </>
              ) : (
                "."
              )}
            </li>
          </ol>
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            Alguns pedidos chegam-nos por telefone ou por WhatsApp. Nesses casos
            é a CLYON que os regista na plataforma e que responde às propostas
            em nome do cliente, com o acordo dele. Fica registado quem o fez.
          </p>
        </S>

        {/*
          AS MUDANÇAS PELA LISTA — 12-11-2026 (d6, texto do Jurídico). O que o
          código faz: lista-de-parceiros-da-mudanca.ts (a lista e a ordem),
          mudanca-com-parceiros-escolhidos.ts (a tarifa congelada e o envio
          só aos escolhidos), prazo-de-resposta-do-parceiro.ts (o prazo),
          escolhidos-sem-resposta.ts (as três saídas), folha-da-mudanca.ts (a
          folha, que nunca se confirma sozinha) e conta-da-mudanca.ts (a conta).
        */}
        <S id="mudancas-com-lista" titulo="5-A. Mudanças com a lista de parceiros">
          <p>
            Em algumas mudanças mostramos-lhe os parceiros disponíveis na sua
            zona, cada um com o seu preço por hora (para 2 e para 3 pessoas), o
            mínimo de horas, o preço do quilómetro e o do material.{" "}
            {ORDENACAO.frase}
          </p>
          <p>
            Pode escolher até {MAXIMO_DE_ESCOLHIDOS} parceiros: o pedido vai
            logo aos escolhidos, com os preços desse momento, que ficam fixos
            para o seu pedido. Cada escolhido tem {HORAS_PARA_RESPONDER} horas
            para aceitar ou recusar o pedido, contadas entre as {JANELA_DE_RESPOSTA.abre}h e as{" "}
            {JANELA_DE_RESPOSTA.fecha}h, hora de Lisboa. Se não responderem,
            avisamo-lo e pode esperar, escolher outro parceiro da lista ou
            pedir-nos que procuremos mais.
          </p>
          <p>
            No dia, o parceiro regista a hora de chegada à origem, as pausas
            (que não se cobram), a hora de fim, os quilómetros e o material
            gasto. O valor final calcula-se com os preços fixados e só fica
            fechado quando confirmar essa folha.{" "}
            <strong>A folha nunca se confirma sozinha</strong>, e pode
            contestá-la dizendo porquê.
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
          {novo ? (
            <p>
              <strong>
                O preço de cada proposta é o total que o cliente paga, com IVA
                incluído, e tem duas partes: o trabalho do parceiro e a taxa da
                plataforma.
              </strong>{" "}
              O parceiro propõe o seu valor sem IVA; desse valor, {quota} é a
              taxa da plataforma e o resto é o trabalho do parceiro. A taxa da
              plataforma leva sempre IVA à taxa de {iva}. O trabalho do parceiro
              leva IVA se o parceiro cobrar IVA; se o parceiro estiver isento de
              IVA, o trabalho não leva IVA, e o preço que vê já tem isso em
              conta. Paga as duas partes ao parceiro, numa só vez (ponto 7).
            </p>
          ) : (
          <p>
            <strong>
              O preço de cada proposta é o que o cliente paga pelo trabalho, com
              IVA incluído, e já inclui a taxa da plataforma.
            </strong>{" "}
            O parceiro propõe o seu valor sem IVA; ao cliente é apresentado
            {/* Sem acréscimo ao cliente (a regra geral de 22-10-2026), o valor vai só com o IVA. */}
            esse valor {taxas.cliente > 0 ? "com a taxa da plataforma e " : ""}com IVA à taxa de {iva}. A CLYON
            fica com {quota} do que o cliente paga sem IVA, e o parceiro
            recebe o valor que propôs, descontada a taxa da plataforma. No pagamento em
            dinheiro, a divisão é a descrita no ponto 7.
          </p>
          )}
          <p>
            Nas mudanças com a lista de parceiros (ponto 5-A), a taxa da
            plataforma é de {TAXA_DAS_MUDANCAS_EM_PONTOS} e conta só sobre as
            horas e os quilómetros, descontada do preço do parceiro.{" "}
            {novo ? (
              <>
                O material não tem taxa e é faturado pelo parceiro, com IVA se
                ele cobrar IVA.
              </>
            ) : (
              <>
            O material
            não tem taxa, mas leva IVA.
              </>
            )}
          </p>
          {novo ? (
            <>
              <p>
                <strong>
                  Cada trabalho tem duas faturas, as duas juntas ao pedido, na sua
                  conta e na app:
                </strong>
              </p>
              <ul className="ml-5 list-disc space-y-2">
                <li>
                  <strong>a da taxa da plataforma</strong>, emitida pela{" "}
                  {EMPRESA_PARCEIRA_AO_PUBLICO} (que não é o parceiro que faz o
                  serviço), com o IVA dela;
                </li>
                <li>
                  <strong>a do trabalho</strong>, emitida pelo parceiro, com IVA
                  ou com a menção da isenção de IVA, conforme o regime dele.
                </li>
              </ul>
              <p>
                As duas levam o seu NIF, se o indicar, ou saem em nome de
                consumidor final. Para isso, o seu nome e o seu NIF passam também
                ao parceiro que contratar. No perfil de cada parceiro vê, antes de
                o escolher, o tipo de fatura que ele emite (com IVA ou com
                isenção) e se emite a guia de resíduos.
              </p>
            </>
          ) : (
          <p>
            <strong>Há fatura em todas as vendas.</strong> É emitida pela{" "}
            {EMPRESA_PARCEIRA_AO_PUBLICO} (não pelo parceiro que faz o
            serviço), com o NIF do cliente se ele o indicar, ou como consumidor
            final.
          </p>
          )}
          <p>
            Os preços de referência apresentados no site (por exemplo, «desde»)
            são indicativos e sem IVA. Na proposta, o preço já vem com IVA
            incluído.
          </p>
          <p>
            Para pedidos com negociação aberta antes de {IVA_INCLUIDO_DESDE_POR_EXTENSO}{" "}
            aplica-se o regime anterior: preço sem IVA e IVA só com fatura.
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
          {novo && (
            <>
              <p>
                <strong>
                  Paga diretamente ao parceiro que contratou.
                </strong>{" "}
                Escolhe como:
              </p>
              <ul className="ml-5 list-disc space-y-3">
                <li>
                  <strong>por transferência bancária</strong>, para o IBAN do
                  parceiro;
                </li>
                <li>
                  <strong>por MB WAY</strong>, para o número MB WAY do parceiro;
                </li>
                <li>
                  <strong>em dinheiro, no local.</strong> Não é possível pagar em
                  dinheiro trabalhos de valor igual ou superior a{" "}
                  {eurosRedondos(MAXIMO_EM_NUMERARIO)} (Lei n.º 92/2017).
                </li>
              </ul>
              <p>
                Paga o preço total da proposta (ponto 6), que já inclui a taxa da
                plataforma e o IVA. Não paga nada à parte: a taxa da plataforma
                recebe-a o parceiro consigo, por conta da CLYON, e entrega-a
                depois à CLYON. O momento do pagamento combina-o com o parceiro.
                Se pagar alguma coisa antes do trabalho, peça ao parceiro o recibo
                ou a fatura desse valor.
              </p>
              <p>
                <strong>
                  O IBAN e o número MB WAY do parceiro aparecem na página do
                  pedido depois de o contratar, e só a si.
                </strong>{" "}
                Pague só para esses dados. Se alguém lhe pedir que pague para outra
                conta ou outro número — mesmo que diga falar em nome do parceiro ou
                da CLYON —, não pague e fale connosco antes.
              </p>
              <p>
                <strong>
                  O dinheiro do trabalho é recebido pelo parceiro e fica sob a
                  responsabilidade dele.
                </strong>{" "}
                A CLYON não recebe, não guarda e não devolve o valor do trabalho.
                Guarde o comprovativo da transferência ou do MB WAY; no pagamento
                em dinheiro, a fatura do parceiro é o seu comprovativo.
              </p>
              <p>
                <strong>
                  Trabalhos acordados antes de {PAGAMENTO_AO_PARCEIRO_DESDE_POR_EXTENSO}.
                </strong>{" "}
                Se aceitou uma proposta antes dessa data e ainda não pagou nada à
                CLYON, o trabalho passa a seguir estas regras: paga diretamente ao
                parceiro, e a página do pedido mostra-lhe os dados dele. O preço
                total que aceitou não sobe; se o parceiro estiver isento de IVA,
                desce, e a página mostra o valor certo. Se já tinha uma referência
                Multibanco da CLYON emitida antes dessa data, pode pagá-la até à data
                que ela indica, e o trabalho continua com as regras
                anteriores, na caixa abaixo. Não pague as duas coisas: ou a
                referência da CLYON, ou o parceiro.
              </p>
            </>
          )}
          <RegrasAnteriores emCaixa={novo}>
          <p>No pedido, o cliente escolhe como paga:</p>
          <ul className="ml-5 list-disc space-y-3">
            <li>
              <strong>Pela plataforma.</strong> Depois de aceitar a proposta,
              recebe uma referência MB WAY ou Multibanco, processada pelo
              euPago, para pagar à CLYON. A CLYON guarda o valor e só o entrega
              ao parceiro depois de o cliente confirmar que o trabalho está
              feito (ou de o trabalho se considerar confirmado, nos termos do
              ponto 8). O parceiro pede então o levantamento, que é tratado
              em menos de 24 horas.
            </li>
            <li>
              <strong>Em dinheiro, ao parceiro, no fim do trabalho.</strong>{" "}
              Paga-lhe em mão o preço da proposta, com IVA incluído, e não paga
              mais nada à parte. O parceiro entrega depois à CLYON o IVA e a
              taxa da plataforma, por referência MB WAY ou Multibanco gerada
              quando o trabalho é confirmado. Não é possível pagar em dinheiro
              trabalhos de valor igual ou superior a{" "}
              {eurosRedondos(MAXIMO_EM_NUMERARIO)} (Lei n.º 92/2017).
            </li>
            {/*
              A TRANSFERÊNCIA — 02-11-2026 (dono), escrita a 12-11-2026 (d6).
              Cada forma de pagar é um ponto à parte desta lista, para se
              trocar sozinha quando o modelo de pagamento mudar.
            */}
            <li>
              <strong>
                Por transferência bancária, nos trabalhos de{" "}
                {eurosRedondos(LIMITE_DA_TRANSFERENCIA)} ou mais, com IVA.
              </strong>{" "}
              Transfere para a conta da CLYON indicada na página do pedido, com
              o descritivo «Pedido #» seguido do número do pedido. O pagamento
              só conta quando a CLYON confirmar que entrou, e até lá o trabalho
              não começa. A partir daí, valem as regras do pagamento pela
              plataforma.
            </li>
          </ul>
          {/*
            O DINHEIRO ANTES DO IVA INCLUÍDO — o regime de 21-09-2026, que
            continua a valer para as negociações abertas antes do corte.
          */}
          <p>
            Nas negociações abertas antes de {IVA_INCLUIDO_DESDE_POR_EXTENSO}, o
            pagamento em dinheiro segue o regime anterior: o cliente paga em mão
            ao parceiro o valor que ele propôs e paga à CLYON, por
            referência, a taxa da plataforma ({taxaNoDinheiro} sobre o valor
            do parceiro).
          </p>
          </RegrasAnteriores>
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
            já tiver contratado um parceiro, pedimos-lhe que diga porquê: o
            parceiro que perde o trabalho tem direito a saber.
          </p>
          {novo && (
            <p>
              Não paga nada à CLYON, por isso não há nada a devolver pela CLYON.
              Se tiver pago alguma coisa ao parceiro antes do trabalho e o pedido
              for cancelado, a devolução é com ele: foi ele quem recebeu, e é ele
              quem devolve, nos termos da lei e do que combinaram. Temos o registo
              do pedido e do que foi combinado e ajudamos a resolver (pontos 8 e
              17). Se a fatura da taxa da plataforma já tiver sido emitida, é
              anulada.
            </p>
          )}
          <RegrasAnteriores emCaixa={novo}>
          <p>
            <strong>
              Se o pedido for cancelado antes de o trabalho estar feito, o que
              tiver pago à CLYON é-lhe devolvido pelo mesmo meio, no prazo de{" "}
              {DIAS_PARA_DEVOLVER} dias.
            </strong>{" "}
            Se pagou por transferência, devolvemos por transferência para a
            conta de onde o dinheiro veio, ou para outra que nos indique por
            escrito.
          </p>
          <p>
            Depois de o trabalho estar confirmado — por si, ou automaticamente
            nos termos do ponto 8 — o valor é entregue ao parceiro e deixa
            de poder ser devolvido pela CLYON; cancelar o pedido a partir daí
            não o traz de volta. Qualquer reclamação sobre o trabalho segue os
            pontos 8 e 17.
          </p>
          </RegrasAnteriores>
        </S>

        <S id="execucao" titulo="8. Execução, confirmação e garantia">
          {/*
            A CONFIRMAÇÃO AUTOMÁTICA — 01-10-2026, decisão do dono: fica, e fica
            escrita. O prazo é `DIAS_ATE_LIBERTAR_SOZINHO` (trabalho.ts) e conta
            a partir de `execucaoEnviadaEm` — o momento em que o profissional
            marca o trabalho como feito, com fotografias. O cron
            `libertar-por-prazo` grava então a confirmação.

            SEM FOTOGRAFIAS NÃO HÁ PRAZO — 26-10-2026 (d22). As fotografias
            passaram a opcionais; sem elas, a CLYON confirma com o cliente
            (`prazoCorre` em trabalho.ts, e o cron só apanha os que as têm).

            SEM FOTOGRAFIAS DE TODO — 30-10-2026 (dono): o prazo volta a correr
            para todos, a contar do «Está feito».
          */}
          <p>
            O serviço é executado pelo parceiro, na data e nas condições que
            combinarem. Terminado o trabalho, o parceiro marca-o como feito,
            e pede-se-lhe então que confirme que está feito. A CLYON pode
            também confirmá-lo consigo.
          </p>
          <p>
            <strong>
              Se não responder, o trabalho considera-se confirmado{" "}
              {DIAS_ATE_LIBERTAR_SOZINHO} dias depois de o parceiro o marcar
              como feito
            </strong>
            {novo ? (
              <>
                {" "}— e, nos trabalhos que seguem as regras anteriores (já pagos à
                CLYON), o valor é entregue ao parceiro. Se alguma coisa estiver mal,
                fale connosco antes disso. A confirmação, por si ou por este prazo, é
                também o momento em que a taxa da plataforma passa a ser devida pelo
                parceiro à CLYON (ponto 10); não muda nada no que paga.
              </>
            ) : (
              <>
            {" "}— e, no pagamento pela plataforma, o valor é entregue ao
            parceiro. Se alguma coisa estiver mal, fale connosco antes
            disso.
              </>
            )}
          </p>
          <p>
            Nas mudanças com a lista de parceiros, o trabalho só se confirma
            quando o cliente confirma a folha (ponto 5-A).
          </p>
          <p>
            <strong>A garantia do serviço é do parceiro.</strong> Se alguma
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
            Depois de confirmar um trabalho pode avaliar o parceiro de 1 a 5
            estrelas e deixar um comentário. As avaliações são{" "}
            <strong>anónimas para o parceiro</strong>: ele vê a nota e o
            texto, não vê quem os escreveu.
          </p>
          {/*
            AS AVALIAÇÕES AO CLIENTE — 01-11-2026 (Jurídico; decisão do dono).
            Guardam-se enquanto a conta do cliente existir e saem quando ela é
            apagada (`apagarContaDeCliente`); a equipa remove uma no backoffice.
          */}
          <p>
            No fim de um trabalho, o parceiro que o fez pode também avaliá-lo a
            si, de 1 a 5 estrelas e, se quiser, com um comentário de até 500
            caracteres. Há uma avaliação por trabalho e não se altera depois de
            enviada. Só o cliente avaliado a vê, na sua conta e na app, com o
            primeiro nome do parceiro, o serviço e o dia. Não é mostrada a
            outros parceiros nem usada para decidir quem recebe os seus
            pedidos. Guarda-se enquanto a sua conta existir e apaga-se quando a
            apagar. Se achar que uma avaliação que recebeu é falsa, ofensiva ou
            tem dados pessoais, escreva-nos para {IDENTIFICACAO.email} e
            podemos removê-la.
          </p>
          <p>
            Clientes e parceiros escrevem o que é verdade, só sobre o trabalho.
            Não publicamos, e podemos remover, avaliações com insultos, dados
            pessoais (moradas, telefones, saúde ou de outras pessoas), ou que
            não digam respeito a um trabalho realmente feito.
          </p>
        </S>

        <S id="profissionais" titulo="10. Se é profissional">
          <p>
            A inscrição é gratuita e sujeita a aprovação. Ao inscrever-se,
            declara que exerce a actividade por conta própria, que está
            regularizado perante as Finanças e a Segurança Social, e que tem os
            meios e as autorizações necessários ao que se propõe fazer.{" "}
            {GUIA_NOS_TERMOS}
          </p>
          {/*
            O QUE QUER DIZER «VERIFICADO» — 01-11-2026, decisão do dono; desde
            12-11-2026 (d6) o que o código faz: o selo só com as três
            confirmações (parceiro-verificado.ts), e quem confirma não aprova (d10.2).
          */}
          <p>
            O selo «{SELO_DO_CARTAO}» só aparece em quem tem três confirmações
            feitas pela equipa da CLYON: o NIF, a identidade e o contacto. Quem
            confirma não é quem aprova. O selo não garante a qualidade de cada
            trabalho, que é do parceiro (ponto 8).
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
          {novo && (
            <>
              <p>
                É o prestador do serviço perante o cliente: responde pela execução
                e pelos danos e cumpre as obrigações fiscais que lhe correspondem.{" "}
                <strong>Recebe o pagamento diretamente do cliente</strong>, por
                transferência, MB WAY ou dinheiro no local, como o cliente
                escolher. Esse dinheiro é recebido por si e é da sua
                responsabilidade: a CLYON não o recebe, não o guarda e não responde
                por ele perante o cliente, incluindo nas devoluções.
              </p>
              <p>
                <strong>Fatura.</strong> Emite ao cliente a fatura do trabalho, pela
                parte que é sua, e junta-a ao pedido na app CLYON Pro ou no painel.
                No seu perfil indica o tipo de fatura que emite — com IVA ou com
                isenção de IVA — e se emite a guia de resíduos; o cliente vê-o antes
                de o escolher, e o que indicar tem de corresponder à verdade. A
                fatura da taxa da plataforma ao cliente é emitida pela{" "}
                {EMPRESA_PARCEIRA_AO_PUBLICO}.
              </p>
              <p>
                <strong>IBAN e MB WAY.</strong> Para receber trabalhos precisa de
                ter no perfil o IBAN, com o titular da conta, e o número MB WAY. Só
                o cliente que o contratar os vê, na página desse pedido, para lhe
                pagar; não aparecem a mais ninguém, nem na lista nem no seu perfil
                público. Quem se inscreve a partir de {PAGAMENTO_AO_PARCEIRO_DESDE_POR_EXTENSO} preenche-os na
                inscrição. Quem já estava aprovado antes dessa data pode preenchê-los
                até {IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO}, inclusive; a partir daí, enquanto faltarem, não pode aceitar
                pedidos nem enviar propostas.
              </p>
              <p>
                <strong>A taxa da plataforma e o valor em atraso.</strong> A taxa
                da plataforma (ponto 6; nas mudanças com a lista, a do ponto 5-A) e
                o IVA dela estão incluídos no preço que o cliente lhe paga e
                pertencem à CLYON: recebe-os do cliente por conta da CLYON e
                entrega-os à CLYON. Quando o trabalho fica confirmado (pelo
                cliente, ou pelo prazo do ponto 8), esse valor fica na sua conta
                como <strong>valor em atraso</strong>, com uma referência Multibanco
                ou um pedido MB WAY, gerados pelo euPago, para o pagar. Tem{" "}
                {DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias, contados dessa
                confirmação, para o pagar, e o pagamento conta quando o euPago o
                confirmar.
              </p>
              <p>
                <strong>Stand-by.</strong> Se passarem{" "}
                {DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias sem que o valor em atraso
                esteja pago, a sua conta fica em stand-by: continua a ver os
                pedidos, mas não pode aceitar pedidos nem enviar propostas — ao
                tentar, aparece «Pagar o valor em atraso», com a forma de o pagar.
                Os trabalhos que já tem contratados continuam a ser seus e pode
                terminá-los. Assim que o euPago confirmar o pagamento, a conta volta
                ao normal sozinha, sem precisar de nos pedir nada.
              </p>
              <p>
                <strong>
                  Trabalhos acordados antes de {PAGAMENTO_AO_PARCEIRO_DESDE_POR_EXTENSO}.
                </strong>{" "}
                Os que o cliente já tinha pago à CLYON — incluindo os pagos depois
                por uma referência Multibanco emitida antes dessa data —, os que já
                estavam concluídos e os de valor fixo combinados com a CLYON seguem
                as regras anteriores, na caixa abaixo: recebe através da CLYON. Os
                outros passam a estas regras: o cliente paga-lhe diretamente e passa
                à CLYON a taxa da plataforma e o IVA dela. Na página de cada
                trabalho vê por que regras ele segue.
              </p>
              <p>
                <strong>Aceitação destas condições.</strong> Pedimos-lhe que aceite
                estes Termos na versão em vigor, com uma caixa que marca, nunca
                pré-marcada: ao criar a palavra-passe, se for aprovado a partir de{" "}
                {PAGAMENTO_AO_PARCEIRO_DESDE_POR_EXTENSO}; e no primeiro acesso ao
                painel ou à app CLYON Pro depois dessa data, se já tinha conta.
                Guardamos a data e a hora em que aceitou e a versão que aceitou (a do
                topo desta página).
              </p>
            </>
          )}
          <RegrasAnteriores emCaixa={novo}>
          <p>
            É o prestador do serviço perante o cliente: responde pela execução e
            pelos danos e cumpre as obrigações fiscais que lhe correspondem.
            Recebe através da CLYON o valor que propôs, descontada a taxa da plataforma —
            ou em dinheiro, no local, quando o cliente escolhe essa forma de
            pagamento: nesse caso recebe do cliente o preço com IVA incluído e
            entrega à CLYON o IVA e a taxa da plataforma, por referência MB WAY
            ou Multibanco gerada quando o trabalho é confirmado, ou por
            abatimento no seu saldo. Pode pagá-los em separado. O que entregar
            ou for abatido conta primeiro para o IVA, que é do Estado, e depois
            para a taxa, começando pelos trabalhos mais antigos.
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
            trabalhos pagos em dinheiro até {novo ? "esse valor estar pago" : "a dívida estar paga"}.
          </p>
          </RegrasAnteriores>
          {/*
            A ORDEM DA LISTA NO CONTRATO DOS PARCEIROS — 12-11-2026 (d6):
            Regulamento (UE) 2019/1150, art. 5.º. A frase é a que o cliente lê
            em «Como ordenamos» (ORDENACAO.frase).
          */}
          <p>
            Nas mudanças com a lista de parceiros (ponto 5-A), os clientes da
            sua zona vêem-no com os seus preços, por esta ordem:{" "}
            {ORDENACAO.frase} Para aparecer, precisa de ter os preços gravados e
            «{TEXTOS_DOS_PRECOS_DAS_MUDANCAS.interruptor}» ligado. Os preços que
            o cliente vê ficam fixos para esse pedido. Se for escolhido, tem{" "}
            {HORAS_PARA_RESPONDER} horas para aceitar ou recusar o pedido, contadas entre as{" "}
            {JANELA_DE_RESPOSTA.abre}h e as {JANELA_DE_RESPOSTA.fecha}h, hora de
            Lisboa. A taxa da plataforma nestas mudanças é de{" "}
            {TAXA_DAS_MUDANCAS_EM_PONTOS} e conta só sobre as horas e os
            quilómetros; o material que fornecer não leva taxa.
          </p>
          <p>
            Os dados do cliente que lhe são mostrados
            {novo ? " — incluindo o nome e o NIF para a fatura — " : " "}destinam-se{" "}
            <strong>exclusivamente</strong> a executar{novo ? " e a faturar" : ""} aquele trabalho. Não os
            pode usar para outro fim, guardar depois de concluído, nem passar a
            terceiros. Contactar clientes da plataforma para trabalhos fora dela
            é motivo de encerramento da conta. Se avaliar um cliente, faça-o só
            sobre o trabalho, com verdade, sem insultos e sem dados pessoais
            dele ou de outras pessoas.
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
            {novo && (
              <>
                <li>
                  Pedir ao cliente, ou fazer, o pagamento de um trabalho para uma
                  conta ou um número diferentes dos que estão na página do pedido.
                </li>
                <li>
                  Usar o IBAN ou o número MB WAY de um parceiro para outra coisa
                  que não seja pagar-lhe aquele trabalho.
                </li>
              </>
            )}
            <li>
              Combinar por fora um trabalho que chegou pela plataforma, para
              evitar a taxa.
            </li>
          </ul>
        </S>

        <S id="suspensao" titulo="12. Suspensão e encerramento de conta">
          <p>
            Pode encerrar a sua conta quando quiser, sem custo, pedindo-o por{" "}
            {IDENTIFICACAO.email}. Os pedidos e as faturas associados continuam
            guardados enquanto a lei nos obrigar a guardá-los.
          </p>
          <p>
            Podemos suspender ou encerrar uma conta que infrinja estes termos ou
            a lei. Dizemos-lhe porquê e pode contestar por escrito, salvo se a
            lei nos impedir de o comunicar. As medidas serão proporcionais ao
            que as motivou.
          </p>
          {novo && (
            <p>
              O stand-by do ponto 10 não é um encerramento: acaba sozinho quando o
              valor em atraso é pago. Se achar que foi posto em stand-by por
              engano, escreva-nos para {IDENTIFICACAO.email}.
            </p>
          )}
          {novo && (
            <p>
              Não aceitar uma versão nova destes Termos também não é um
              encerramento: a conta continua sua, e pode encerrá-la sem custo se
              não concordar (ponto 16).
            </p>
          )}
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
            , que são da responsabilidade do parceiro que o executa. Também
            não respondemos pela veracidade do que cada utilizador declara sobre
            si.
          </p>
          {novo && (
            <p>
              O pagamento do trabalho faz-se entre o cliente e o parceiro. A CLYON
              não responde pelo dinheiro que não recebeu, nem por pagamentos
              feitos para dados diferentes dos que estão na página do pedido —
              salvo se o erro desses dados for da plataforma.
            </p>
          )}
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
            Quanto ao serviço prestado pelo parceiro, esse direito exerce-se
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
            Uma nota que pertence aqui: quando contrata um parceiro, a
            morada e o contacto passam a estar com ele.{" "}
            <strong>
              A partir desse momento o parceiro é responsável autónomo pelos
              dados que recebe
            </strong>{" "}
            e responde por eles perante si.
          </p>
        </S>

        <S id="alteracoes" titulo="16. Alterações a estes termos">
          {novo ? (
            <p>
              Podemos alterar estes termos. Se a alteração for relevante, avisamos
              com pelo menos 30 dias de antecedência por email ou na plataforma;
              aos parceiros, avisamos sempre num suporte que possam guardar (email,
              com o texto novo) e nunca com menos de 15 dias. Se não concordar, pode
              encerrar a conta sem custo, a qualquer momento durante o aviso.
            </p>
          ) : (
          <p>
            Podemos alterar estes termos. Se a alteração for relevante,
            avisamos com pelo menos 30 dias de antecedência por email ou na
            plataforma. Se não concordar, pode encerrar a conta sem custo.
          </p>
          )}
          <p>
            As alterações não se aplicam retroactivamente a trabalhos já
            fechados.
          </p>
          {novo && (
            <p>
              As regras de pagamento de {PAGAMENTO_AO_PARCEIRO_DESDE_POR_EXTENSO} valem para os trabalhos que não
              estavam pagos à CLYON nem concluídos nessa data. Os trabalhos já
              pagos à CLYON antes dela — incluindo os pagos depois por uma
              referência Multibanco emitida antes dela —, os já concluídos e os de
              valor fixo combinados com a CLYON continuam, até ao fim, com as
              regras com que foram acordados.
            </p>
          )}
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
