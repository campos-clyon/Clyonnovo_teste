import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  getPool,
  ensureProvidersSchema,
  actividadeDosProfissionais,
  lerFotos,
  negociacoesParaMedirARapidez,
} from "@/lib/db";
import { DIAS_DA_MEDIDA, temposDeResposta, type TempoDeResposta } from "@/lib/tempo-de-resposta";
import { ibanEncurtado } from "@/lib/iban";
import { textoDaApp } from "@/lib/app-pro-no-telemovel";

export const runtime = "nodejs";

/**
 * Lista os profissionais do site para o painel, com a actividade de cada um.
 *
 * A actividade não é enfeite: sem ela não se distingue um profissional que
 * trabalha de um que recebe pedidos e nunca responde, ou de um que nunca
 * recebeu nada — e cada um desses casos pede uma acção diferente do
 * administrador. Vem de uma consulta agregada às negociações, e não de uma por
 * profissional.
 *
 * Devolve email, telefone, NIF, número de transportador e as fotografias da
 * viatura (com a matrícula à vista), que são dados pessoais e comerciais — daí
 * exigir sessão de administrador.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    await ensureProvidersSchema();
    const pool = await getPool();
    if (!pool) return NextResponse.json({ profissionais: [] });

    const [rows] = await pool.execute(
      `SELECT id, name, email, phone, nif, city, categorias, raioKm,
              emiteFatura, regimeIva, emiteGuiaTransporte, numeroTransportador,
              guiaVerificadaEm, guiaVerificadaPor, estado, isActive,
              baseLat, baseLng, createdAt,
              moradaFiscal, codigoPostalFiscal, localidadeFiscal, tipoVeiculo,
              fotosViaturaJson, fotoViaturaUrl,
              iban, ibanTitular, mbway, contaDeTeste, responsavel,
              -- Quem tem a app CLYON Pro (27-10-2026). O Gmail do teste não vai
              -- nesta lista: tem rota própria, só da secção Profissionais.
              appAbertaEm, appVersao,
              -- Se tem palavra-passe, e nunca qual: o hash não sai daqui.
              (passwordHash IS NOT NULL) AS temPalavraPasse
         FROM providers
        -- 'apagado' é a linha vazia que fica quando uma conta com história é
        -- apagada: as negociações antigas precisam dela, o painel não. Sem
        -- isto, "Profissional removido" ficava na lista para sempre.
        WHERE isClyon = 0 AND (estado IS NULL OR estado <> 'apagado')
        ORDER BY
          -- Quem espera verificação primeiro: é o que trava pedidos.
          (emiteGuiaTransporte = 1 AND guiaVerificadaEm IS NULL) DESC,
          (estado = 'pendente') DESC,
          createdAt DESC
        LIMIT 500`,
    ) as any[];

    const actividade = await actividadeDosProfissionais();
    /*
     * «RESPONDE EM» — 28-10-2026 (d5). A mediana dos últimos 30 dias, do envio
     * do pedido à primeira proposta dele. Só de leitura; se a consulta falhar,
     * a lista sai na mesma, sem a coluna.
     */
    const agora = new Date();
    const rapidez = await negociacoesParaMedirARapidez(new Date(agora.getTime() - DIAS_DA_MEDIDA * 86_400_000))
      .then((linhas) => temposDeResposta(linhas, agora))
      .catch((e): Map<number, TempoDeResposta> => {
        console.error("[api/admin/profissionais] rapidez:", e);
        return new Map();
      });

    const profissionais = (rows as Array<Record<string, unknown>>).map(
      ({ fotosViaturaJson, fotoViaturaUrl, ...p }) => ({
        ...p,
        /*
         * AS FOTOGRAFIAS DA VIATURA — 19-10-2026.
         *
         * A ajuda do perfil diz ao profissional «É assim que sabemos o que
         * cabe», e ninguém na CLYON as via sem ir à base. Lêem-se como o
         * perfil as lê: a lista, ou só a antiga quando o perfil é de antes de
         * haver lista. As duas colunas não seguem para o browser — só isto.
         */
        fotosViatura: lerFotos(
          fotosViaturaJson,
          typeof fotoViaturaUrl === "string" ? fotoViaturaUrl : null,
        ),
        /*
         * O IBAN sai ENCURTADO (`PT50 ···· 1234`), como no perfil que o próprio
         * vê. Esta lista vai inteira para o browser, com quinhentas linhas; o
         * «Editar perfil» só precisa de saber se há um, e para o mudar escreve-se
         * o novo — a máscara devolvida tal e qual é ignorada na gravação.
         */
        iban: typeof p.iban === "string" && p.iban ? ibanEncurtado(p.iban) : "",
        temPalavraPasse: Number(p.temPalavraPasse) === 1,
        contaDeTeste: Number(p.contaDeTeste) === 1,
        // «App: sim, aberta a … · versão», ou «sem app» — em hora de Lisboa, no servidor.
        app: textoDaApp(p.appAbertaEm as string | Date | null, (p.appVersao as string | null) ?? null),
        temApp: p.appAbertaEm != null,
        actividade:
          actividade.get(Number(p.id)) ?? { recebidos: 0, comProposta: 0, fechados: 0 },
        respondeEm: rapidez.get(Number(p.id)) ?? null,
      }),
    );

    return NextResponse.json({ profissionais });
  } catch (error) {
    console.error("[api/admin/profissionais GET]", error);
    return NextResponse.json({ error: "Erro ao listar profissionais" }, { status: 500 });
  }
}
