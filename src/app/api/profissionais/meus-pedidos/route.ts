import { NextRequest, NextResponse } from "next/server";
import { negociacoesDoProfissional, getPool } from "@/lib/db";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";
import { vistaParaOEstado } from "@/lib/pedido-valores";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";
import { distanciasRodoviarias } from "@/lib/distancia-rodoviaria";
import { faseDoTrabalho, diasAteLibertar } from "@/lib/trabalho";

export const runtime = "nodejs";

/**
 * Os pedidos deste profissional, para o painel dele.
 *
 * A sessão vem do cookie e mais nada. O `providerId` NUNCA vem do corpo nem da
 * query: se viesse, bastava mudar um número no endereço para ler os pedidos —
 * e as negociações — de outro profissional.
 *
 * Cada pedido passa por `vistaDoProfissional` antes de sair. A consulta traz
 * colunas do pedido, e entre elas podia vir o valor máximo do cliente ou a
 * morada exacta no dia em que alguém acrescentasse um campo à consulta. A lista
 * de permissões é o que impede isso de acontecer por distracção.
 */
/**
 * O que vem da base transformado num ponto do mapa — ou nada.
 *
 * As coordenadas do trabalho chegam em TEXTO (saem de dentro do JSON), e as
 * do profissional podem chegar como DECIMAL. Um `"null"` de JSON vira NaN
 * aqui, e NaN devolve `null` — que é o que faz o ecrã calar-se em vez de
 * mostrar uma distância inventada.
 */
function ponto(
  lat: string | number | null | undefined,
  lng: string | number | null | undefined,
): { lat: number; lng: number } | null {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { lat: a, lng: b };
}

export async function GET(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const linhas = await negociacoesDoProfissional(sessao.providerId);

    const agora = new Date();

    /*
     * O CONTEXTO DO CLIENTE, para os trabalhos contratados — e só o real.
     *
     * "Cliente desde X · N trabalhos confirmados" dá ao profissional o mesmo
     * tipo de confiança que o cliente ganhou do lado dele. Calcula-se pelo
     * email do pedido; um cliente de telefone sem email não tem historial
     * ligável, e nesse caso NÃO SE MOSTRA NADA — inventar "cliente novo"
     * seria adivinhar.
     */
    const emailsContratados = [
      ...new Set(
        linhas
          .filter((l) => l.estado === "acordada")
          .map((l) => (l as unknown as { contactEmail?: string | null }).contactEmail)
          .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
          .map((e) => e.trim().toLowerCase()),
      ),
    ];
    const contextoDoCliente = new Map<string, { desde: string | null; confirmados: number }>();
    /*
     * ISTO NUNCA PODE DERRUBAR A LISTA.
     *
     * "Cliente desde X · N trabalhos" e contexto agradavel de ter; a lista de
     * trabalhos e o painel inteiro. Uma consulta que falhe aqui dava-lhe "Erro
     * ao listar" e um ecra vazio -- ele perdia tudo por causa de uma linha de
     * enfeite. Falhando, cala-se: sem contexto, o painel continua de pe.
     */
    try {
      const pool = emailsContratados.length > 0 ? await getPool() : null;
      if (pool) {
        for (const email of emailsContratados) {
          const [uLinhas] = (await pool.execute(
            "SELECT createdAt FROM users WHERE email = ? AND deletedAt IS NULL LIMIT 1",
            [email],
          )) as any[];
          const [cLinhas] = (await pool.execute(
            `SELECT COUNT(*) AS n FROM negociacoes n
              JOIN simulatorOrders o ON o.id = n.pedidoId
             WHERE LOWER(o.contactEmail) = ? AND n.confirmadoEm IS NOT NULL`,
            [email],
          )) as any[];
          const desde = (uLinhas as Array<{ createdAt?: Date }>)[0]?.createdAt ?? null;
          contextoDoCliente.set(email, {
            desde: desde ? new Date(desde).toISOString() : null,
            confirmados: Number((cLinhas as Array<{ n: number }>)[0]?.n ?? 0),
          });
        }
      }
    } catch (e) {
      console.error("[profissionais/meus-pedidos] contexto do cliente", e);
    }

    /*
     * A DISTÂNCIA PELA ESTRADA, E NÃO EM LINHA RECTA.
     *
     * "Esses cálculos de km estão muito errados. Temos que usar valores reais
     * e calculados individualmente usando o endereço base do pro com o do
     * pedido — reais e verdadeiros."
     *
     * Era linha recta vezes 1,3. De Amora a Setúbal isso dá 29,6 km e a estrada
     * são 33,4; entre Almada e o Montijo, que são vizinhos por cima da água, o
     * erro passa dos 60%. Um número desses decide se ele atravessa o rio.
     *
     * Todas de uma vez: a base é a mesma para a lista inteira, e cada par
     * (base, pedido) fica guardado — a segunda pergunta é sempre igual à
     * primeira, e não se paga duas vezes por ela.
     */
    /*
     * E ISTO TAMBEM NAO. A distancia sai de uma API da Google e de uma tabela
     * de cache: duas coisas que podem estar em baixo sem o painel ter culpa.
     * Sem distancia, os cartoes aparecem sem o numero dos quilometros; sem
     * lista, ele nao tem painel nenhum.
     */
    let medidas: Awaited<ReturnType<typeof distanciasRodoviarias>> = [];
    try {
      medidas = await distanciasRodoviarias(
        linhas.map((l) => ({
          origem: ponto(l.baseLat, l.baseLng),
          destino: ponto(l.pedidoLat, l.pedidoLng),
        })),
      );
    } catch (e) {
      console.error("[profissionais/meus-pedidos] distancias", e);
      medidas = linhas.map(() => null);
    }

    const pedidos = linhas.map((l, i) => {
      // A morada e o contacto só entram na vista depois de ele ser contratado —
      // a decisão está numa função só, e não repetida a cada rota.
      const vista = vistaParaOEstado(l as unknown as Record<string, unknown>, l.estado) as Record<
        string,
        unknown
      >;
      const minimo = l.valorDesejadoCliente != null ? Number(l.valorDesejadoCliente) : null;
      const acordado = l.valorAcordado != null ? Number(l.valorAcordado) : null;
      const fase = faseDoTrabalho(l as never);

      return {
        negociacaoId: l.id,
        pedidoId: l.pedidoId,
        estado: l.estado,
        fase,
        diasAteLibertar: diasAteLibertar(l as never, agora),
        provaJson: l.provaJson ?? null,
        actualizadoEm: l.updatedAt,
        /*
         * As datas do fim, para o histórico da negociação.
         *
         * Não são dados do cliente — são do trabalho dele, e é ele que as
         * provocou. Sem elas o histórico ficava pelas propostas e parava no
         * momento do acordo, que é onde a maior parte da história começa.
         */
        execucaoEnviadaEm: l.execucaoEnviadaEm ?? null,
        confirmadoEm: l.confirmadoEm ?? null,
        pagoEm: l.pagoEm ?? null,
        avaliadoEm: l.avaliadoEm ?? null,
        arquivadoEm: l.arquivadoProfissionalEm ?? null,
        /* Quando ele abriu este trabalho pela primeira vez — null = por abrir. */
        abertoEm: l.abertoProfissionalEm ?? null,
        estrelas: l.estrelas ?? null,
        valorAcordado: acordado,
        propostas: l.propostasJson,
        // Só chegam preenchidos quando o trabalho é dele.
        morada: (vista.address as string | undefined) ?? null,
        contactoNome: (vista.contactName as string | undefined) ?? null,
        contactoTelefone: (vista.contactPhone as string | undefined) ?? null,
        clienteContexto:
          l.estado === "acordada"
            ? (contextoDoCliente.get(
                String(
                  (l as unknown as { contactEmail?: string | null }).contactEmail ?? "",
                )
                  .trim()
                  .toLowerCase(),
              ) ?? null)
            : null,
        // O que ele vê do pedido — nada além disto.
        serviceType: (vista.serviceType as string | undefined) ?? null,
        // A data marcada nao e contacto: ajuda a decidir ANTES de aceitar, e
        // e a espinha da agenda depois de contratar.
        dataAgendada: (l as unknown as { dataAgendada?: Date | string | null }).dataAgendada ?? null,
        // O dia em que o pedido foi feito — o zero de "amanha". Sem ele, a
        // palavra do cliente le-se contra hoje e mente ao fim de um dia.
        criadoEm:
          (l as unknown as { pedidoCriadoEm?: Date | string | null }).pedidoCriadoEm ?? null,
        // O que o valor MEDE: o trabalho todo, ou cada carga. Sem isto ele
        // propunha sobre uma unidade e o cliente lia outra -- e a conta so
        // batia mal no fim, com o trabalho ja feito.
        baseDoPreco: (l as unknown as { baseDoPreco?: string | null }).baseDoPreco ?? null,
        // O dia que ELE combinou com o cliente, depois de ser contratado. Nao
        // escreve por cima do que o cliente pediu -- ver `agenda-dos-trabalhos`.
        dataCombinada:
          (l as unknown as { dataCombinada?: Date | string | null }).dataCombinada ?? null,
        city: (vista.city as string | undefined) ?? null,
        urgency: (vista.urgency as string | undefined) ?? null,
        description: (vista.description as string | undefined) ?? null,
        filesJson: (vista.filesJson as string | undefined) ?? null,
        floor: (vista.floor as string | undefined) ?? null,
        hasElevator: (vista.hasElevator as string | undefined) ?? null,
        parkingDistance: (vista.parkingDistance as string | undefined) ?? null,
        /*
         * O que so alguns servicos tem.
         *
         * Uma mudanca sem destino e um preco a adivinhar: o trabalho e levar
         * as coisas de A para B, e ele so via o A. Um entulho sem numero de
         * sacos e a mesma coisa — trinta sacos e uma manha, trezentos sao um
         * dia inteiro e outro camiao.
         */
        moradaDestino: (vista.moradaDestino as string | undefined) ?? null,
        localidadeDestino: (vista.localidadeDestino as string | undefined) ?? null,
        andarDestino: (vista.andarDestino as string | undefined) ?? null,
        elevadorDestino: (vista.elevadorDestino as string | undefined) ?? null,
        estacionamentoDestino: (vista.estacionamentoDestino as string | undefined) ?? null,
        percursoKm:
          vista.percursoKm != null && Number.isFinite(Number(vista.percursoKm))
            ? Number(vista.percursoKm)
            : null,
        entulhoEstado: (vista.entulhoEstado as string | undefined) ?? null,
        entulhoQuantidade: (vista.entulhoQuantidade as string | undefined) ?? null,
        /*
         * A QUANTOS QUILOMETROS FICA O TRABALHO.
         *
         * A pergunta que ele faz primeiro, e a unica que o ecra nao respondia:
         * "Oeiras" nao diz se sao 10 km ou 60, e a diferenca decide se vale a
         * pena responder. E a MESMA conta que o backoffice ja mostrava ao
         * enviar o pedido ("Fred - 52,9 km"), so que agora tambem do lado de
         * quem faz o trabalho.
         *
         * Linha recta com a folga da estrada, e nao a estrada verdadeira: uma
         * chamada paga ao Maps por cada pedido de cada profissional, para dar
         * um numero que ele so quer por alto, nao se justifica. Vem `null`
         * quando falta o ponto de um dos lados -- e ai o ecra cala-se, em vez
         * de inventar um numero.
         */
        distanciaKm: medidas[i]?.km ?? null,
        /* Minutos de carro, quando a estrada foi mesmo consultada. */
        minutosDeCarro: medidas[i]?.minutos ?? null,
        /*
         * De onde veio o número: `estrada` é o percurso real, `estimativa` é a
         * linha recta com folga. Sai daqui para o ecrã poder ser honesto — um
         * número aproximado apresentado como medido é pior do que não o haver.
         */
        distanciaMedidaPor: medidas[i]?.origem ?? null,
        precisaFatura: Boolean(vista.precisaFatura),
        precisaGuiaTransporte: Boolean(vista.precisaGuiaTransporte),
        // Sempre o líquido. Nunca o bruto — ver taxas-plataforma.ts.
        querPagar: minimo,
        recebeSeAceitar: minimo != null ? quantoOProfissionalRecebe(minimo) : null,
        recebeSeFechado: acordado != null ? quantoOProfissionalRecebe(acordado) : null,
      };
    });

    return NextResponse.json({ nome: sessao.nome, pedidos });
  } catch (error) {
    /*
     * A MENSAGEM DIZ O QUE FALHOU, e nao so que falhou.
     *
     * "Erro ao listar" e uma parede: quem a le -- ele ou eu -- fica sem saber
     * por onde comecar, e a unica pista ficava num registo do servidor a que
     * ninguem chega a partir do telemovel.
     */
    console.error("[profissionais/meus-pedidos]", error);
    const porque = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Não foi possível carregar os seus trabalhos. Tente outra vez dentro de um minuto.",
        detalhe: porque.slice(0, 200),
      },
      { status: 500 },
    );
  }
}
